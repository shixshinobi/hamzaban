// Reads the text selected in whatever app has focus, and pastes text back into it.
// Windows: a long-lived PowerShell helper sends Ctrl+C / Ctrl+V through user32 after
//          waiting for the user to release the hotkey's modifier keys.
// macOS:   System Events keystrokes (needs Accessibility permission).
// Linux:   the PRIMARY selection is read directly; xdotool is used for copy/paste.

import { systemPreferences } from "electron"
import {
  readSelectionText,
  readText,
  restore,
  snapshot,
  writeText,
} from "./clip"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const WIN_HELPER = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class HzKeys {
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
  static readonly int[] Mods = { 0x10, 0x11, 0x12, 0x5B, 0x5C };
  static bool AnyDown() { foreach (int k in Mods) if ((GetAsyncKeyState(k) & 0x8000) != 0) return true; return false; }
  public static void Combo(byte key) {
    for (int i = 0; i < 60 && AnyDown(); i++) Thread.Sleep(10);
    foreach (int k in Mods) if ((GetAsyncKeyState(k) & 0x8000) != 0) keybd_event((byte)k, 0, 2, UIntPtr.Zero);
    keybd_event(0x11, 0, 0, UIntPtr.Zero);
    keybd_event(key, 0, 0, UIntPtr.Zero);
    Thread.Sleep(5);
    keybd_event(key, 0, 2, UIntPtr.Zero);
    keybd_event(0x11, 0, 2, UIntPtr.Zero);
  }
}
"@
[Console]::Out.WriteLine('ready')
while ($true) {
  $l = [Console]::In.ReadLine()
  if ($l -eq $null) { break }
  if ($l -eq 'copy') { [HzKeys]::Combo(0x43) }
  elseif ($l -eq 'paste') { [HzKeys]::Combo(0x56) }
  [Console]::Out.WriteLine('ok')
}
`

let winHelper: ChildProcessWithoutNullStreams | null = null
let winReady: Promise<void> | null = null
const pending: (() => void)[] = []

function ensureWinHelper() {
  if (winHelper && !winHelper.killed) return winReady!
  const script = path.join(os.tmpdir(), "hamzaban-keys.ps1")
  fs.writeFileSync(script, WIN_HELPER, "utf8")
  winHelper = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
    ],
    {
      windowsHide: true,
    }
  )
  winReady = new Promise((resolve) => {
    let buf = ""
    winHelper!.stdout.setEncoding("utf8")
    winHelper!.stdout.on("data", (d: string) => {
      buf += d
      let i: number
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (line === "ready") resolve()
        else if (line === "ok") pending.shift()?.()
      }
    })
  })
  winHelper.on("exit", () => {
    winHelper = null
    while (pending.length) pending.shift()?.()
  })
  return winReady
}

export function warmUpSelection() {
  if (process.platform === "win32") void ensureWinHelper()
}

export function disposeSelection() {
  winHelper?.kill()
}

function exec(cmd: string, args: string[]) {
  return new Promise<boolean>((resolve) => {
    const p = spawn(cmd, args)
    p.on("error", () => resolve(false))
    p.on("close", (code) => resolve(code === 0))
  })
}

async function sendKey(key: "copy" | "paste") {
  if (process.platform === "win32") {
    await ensureWinHelper()
    await new Promise<void>((resolve) => {
      pending.push(resolve)
      winHelper!.stdin.write(key + "\n")
      setTimeout(resolve, 1500)
    })
  } else if (process.platform === "darwin") {
    await sleep(120)
    const letter = key === "copy" ? "c" : "v"
    await exec("osascript", [
      "-e",
      `tell application "System Events" to keystroke "${letter}" using {command down}`,
    ])
  } else {
    await exec("xdotool", [
      "key",
      "--clearmodifiers",
      key === "copy" ? "ctrl+c" : "ctrl+v",
    ])
  }
}

export function macAccessibilityOk(prompt = false) {
  if (process.platform !== "darwin") return true
  return systemPreferences.isTrustedAccessibilityClient(prompt)
}

/** Grab the current selection, restoring the user's clipboard afterwards. */
export async function getSelectedText(): Promise<string> {
  if (process.platform === "linux") {
    const primary = await readSelectionText()
    if (primary.trim()) return primary
  }
  const saved = await snapshot()
  const marker = `__hz_${Date.now()}__`
  await writeText(marker)
  await sendKey("copy")
  let text = ""
  for (let i = 0; i < 30; i++) {
    const now = await readText()
    if (now !== marker) {
      text = now
      break
    }
    await sleep(20)
  }
  // Restore whatever the user had on the clipboard.
  await restore(saved)
  return text
}

/** Paste text into the focused app, keeping the user's clipboard intact. */
export async function pasteText(text: string) {
  const saved = await snapshot()
  await writeText(text)
  await sendKey("paste")
  await sleep(300)
  await restore(saved)
}
