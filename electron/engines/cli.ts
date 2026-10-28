import { execFile, spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { EngineKind } from "../../shared/types"
import { EngineError, type EngineContext, type EngineRunner } from "./types"

const isWin = process.platform === "win32"

export const CLI_INFO: Partial<
  Record<EngineKind, { bin: string; install: string; login: string }>
> = {
  "codex-cli": {
    bin: "codex",
    install: "npm i -g @openai/codex",
    login: "codex login",
  },
  "claude-cli": {
    bin: "claude",
    install: "npm i -g @anthropic-ai/claude-code",
    login: "claude",
  },
  "gemini-cli": {
    bin: "gemini",
    install: "npm i -g @google/gemini-cli",
    login: "gemini",
  },
}

/** GUI apps on macOS/Linux do not inherit the shell PATH; add the usual install locations. */
export function cliEnv(): NodeJS.ProcessEnv {
  const home = os.homedir()
  const extra = isWin
    ? [
        path.join(process.env.APPDATA ?? "", "npm"),
        path.join(home, ".local", "bin"),
        path.join(home, "scoop", "shims"),
      ]
    : [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        path.join(home, ".local/bin"),
        path.join(home, ".npm-global/bin"),
        path.join(home, ".bun/bin"),
        path.join(home, ".volta/bin"),
      ]
  const nvm = process.env.NVM_BIN ? [process.env.NVM_BIN] : []
  const sep = isWin ? ";" : ":"
  return {
    ...process.env,
    PATH: [...nvm, ...extra, process.env.PATH ?? ""].join(sep),
    NO_COLOR: "1",
    FORCE_COLOR: "0",
  }
}

function quote(arg: string) {
  if (isWin)
    return /[\s"&|<>^%]/.test(arg) ? `"${arg.replace(/"/g, '""')}"` : arg
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

interface RunOpts {
  bin: string
  args: string[]
  stdin: string
  signal: AbortSignal
  onStdout?: (chunk: string) => void
}

function run({
  bin,
  args,
  stdin,
  signal,
  onStdout,
}: RunOpts): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const cmd = [quote(bin), ...args.map(quote)].join(" ")
    const child = spawn(cmd, {
      shell: true,
      env: cliEnv(),
      cwd: os.tmpdir(),
      windowsHide: true,
    })
    let stdout = ""
    let stderr = ""
    const kill = () => {
      if (isWin && child.pid)
        spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          windowsHide: true,
        })
      else child.kill("SIGTERM")
    }
    signal.addEventListener("abort", kill, { once: true })
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (d: string) => {
      stdout += d
      onStdout?.(d)
    })
    child.stderr.on("data", (d: string) => (stderr += d))
    child.on("error", (e) =>
      reject(new EngineError(e.message, "not-installed"))
    )
    child.on("close", (code) => {
      signal.removeEventListener("abort", kill)
      if (signal.aborted)
        return reject(new EngineError("cancelled", "cancelled"))
      const notFound =
        /not recognized|command not found|No such file|ENOENT/i.test(stderr)
      if (notFound && !stdout)
        return reject(
          new EngineError(`${bin} is not installed`, "not-installed")
        )
      resolve({ stdout, stderr, code: code ?? 0 })
    })
    child.stdin.end(stdin, "utf8")
  })
}

function loginHint(stderr: string, kind: EngineKind) {
  if (/log ?in|auth|unauthori[sz]ed|credential|api key/i.test(stderr)) {
    throw new EngineError(
      `Sign in first: run "${CLI_INFO[kind]?.login}"`,
      "needs-login"
    )
  }
}

/** First match for an executable on the (extended) PATH. */
function onPath(bin: string) {
  const exts = isWin ? [".cmd", ".exe", ".bat", ""] : [""]
  for (const dir of (cliEnv().PATH ?? "").split(isWin ? ";" : ":")) {
    for (const ext of exts) {
      if (dir && fs.existsSync(path.join(dir, bin + ext))) return true
    }
  }
  return false
}

let bundledCodex: Promise<string | null> | null = null

/** The Codex desktop app (Microsoft Store on Windows, Codex.app on macOS) ships the CLI inside. */
function findBundledCodex(): Promise<string | null> {
  bundledCodex ??= new Promise((resolve) => {
    if (process.platform === "darwin") {
      const p = "/Applications/Codex.app/Contents/Resources/codex"
      return resolve(fs.existsSync(p) ? p : null)
    }
    if (!isWin) return resolve(null)
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "(Get-AppxPackage -Name OpenAI.Codex).InstallLocation",
      ],
      { windowsHide: true, timeout: 15000 },
      (_err, stdout) => {
        const dir = (stdout ?? "").trim().split(/\r?\n/)[0]
        const exe = dir ? path.join(dir, "app", "resources", "codex.exe") : ""
        resolve(exe && fs.existsSync(exe) ? exe : null)
      }
    )
  })
  return bundledCodex.then((p) => {
    // The Store path changes with every app update.
    if (p && !fs.existsSync(p)) {
      bundledCodex = null
      return findBundledCodex()
    }
    return p
  })
}

async function codexBin(command?: string) {
  if (command) return command
  if (onPath("codex")) return "codex"
  return (await findBundledCodex()) ?? "codex"
}

const codexFlags = new Map<string, Promise<string>>()

/** `codex exec --help`, cached per binary, to use newer flags only where they exist. */
function codexHelp(bin: string) {
  let help = codexFlags.get(bin)
  if (!help) {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 15000)
    help = run({ bin, args: ["exec", "--help"], stdin: "", signal: ac.signal })
      .then((r) => r.stdout + r.stderr)
      .catch(() => "")
      .finally(() => clearTimeout(t))
    codexFlags.set(bin, help)
  }
  return help
}

const runCodex = async (ctx: EngineContext) => {
  const { engine, prompt, req, signal } = ctx
  const bin = await codexBin(engine.command)
  const help = await codexHelp(bin)
  const out = path.join(os.tmpdir(), `hamzaban-codex-${Date.now()}.txt`)
  const args = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--color",
    "never",
    "--output-last-message",
    out,
  ]
  // Translation needs none of the user's Codex setup (MCP servers, rules, high reasoning
  // effort), and loading it doubles the time. Runs are not kept in the Codex history either.
  if (help.includes("--ephemeral")) args.push("--ephemeral")
  if (help.includes("--ignore-user-config")) args.push("--ignore-user-config")
  if (help.includes("--ignore-rules")) args.push("--ignore-rules")
  args.push("-c", "model_reasoning_effort=low")
  if (engine.model) args.push("-m", engine.model)
  if (req.image) args.push("-i", await ctx.imageFile())
  args.push("-")
  const r = await run({
    bin,
    args,
    stdin: prompt.combined,
    signal,
  })
  let text: string
  try {
    text = fs.readFileSync(out, "utf8")
    fs.rmSync(out, { force: true })
  } catch {
    text = r.stdout
  }
  if (!text.trim()) {
    loginHint(r.stderr, "codex-cli")
    throw new EngineError(
      r.stderr.trim().split("\n").slice(-3).join("\n") ||
        "Codex returned nothing"
    )
  }
  ctx.snapshot(text)
  return text
}

const runClaudeCode = async (ctx: EngineContext) => {
  const { engine, prompt, req, signal } = ctx
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
  ]
  if (engine.model) args.push("--model", engine.model)
  let stdin = prompt.combined
  if (req.image) {
    const file = await ctx.imageFile()
    args.push("--allowedTools", "Read")
    stdin += `\n\nThe image to translate is at: ${file}\nRead it with the Read tool, then answer exactly in the required format.`
  }
  let full = ""
  let buf = ""
  let result = ""
  let isError = false
  const r = await run({
    bin: engine.command || "claude",
    args,
    stdin,
    signal,
    onStdout: (chunk) => {
      buf += chunk
      let i: number
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i)
        buf = buf.slice(i + 1)
        try {
          const j = JSON.parse(line)
          if (
            j.type === "stream_event" &&
            j.event?.type === "content_block_delta" &&
            j.event.delta?.type === "text_delta"
          ) {
            full += j.event.delta.text
            ctx.delta(j.event.delta.text)
          } else if (j.type === "result") {
            result = j.result ?? ""
            isError = !!j.is_error
          }
        } catch {
          // non-JSON output line
        }
      }
    },
  })
  if (isError) {
    loginHint(result, "claude-cli")
    throw new EngineError(result || "Claude Code error")
  }
  const final = result || full
  if (!final.trim()) {
    loginHint(r.stderr + r.stdout, "claude-cli")
    throw new EngineError(r.stderr.trim() || "Claude Code returned nothing")
  }
  if (final !== full) ctx.snapshot(final)
  return final
}

const runGeminiCli = async (ctx: EngineContext) => {
  const { engine, prompt, req, signal } = ctx
  const args: string[] = []
  if (engine.model) args.push("-m", engine.model)
  const tail = req.image
    ? `@${(await ctx.imageFile()).replace(/\\/g, "/")} Translate this image following the instructions above.`
    : "Follow the instructions above."
  args.push("-p", tail)
  let full = ""
  const r = await run({
    bin: engine.command || "gemini",
    args,
    stdin: prompt.combined,
    signal,
    onStdout: (d) => {
      full += d
      ctx.delta(d)
    },
  })
  if (!full.trim()) {
    loginHint(r.stderr, "gemini-cli")
    throw new EngineError(
      r.stderr.trim().split("\n").slice(-3).join("\n") ||
        "Gemini CLI returned nothing"
    )
  }
  return full
}

export const CLI_RUNNERS: Partial<Record<EngineKind, EngineRunner>> = {
  "codex-cli": runCodex,
  "claude-cli": runClaudeCode,
  "gemini-cli": runGeminiCli,
}

export async function cliVersion(
  kind: EngineKind,
  command?: string
): Promise<string | null> {
  const info = CLI_INFO[kind]
  if (!info) return null
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 15000)
  try {
    const bin =
      kind === "codex-cli" ? await codexBin(command) : command || info.bin
    const r = await run({
      bin,
      args: ["--version"],
      stdin: "",
      signal: ac.signal,
    })
    const v = r.stdout.trim().split("\n")[0]
    return r.code === 0 && v ? v : null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

/** Open a terminal running a command, used for CLI sign-in. */
export function openTerminal(command: string) {
  if (isWin) {
    spawn("cmd.exe", ["/c", "start", "cmd.exe", "/k", command], {
      env: cliEnv(),
      detached: true,
      windowsHide: false,
    })
  } else if (process.platform === "darwin") {
    spawn("osascript", [
      "-e",
      `tell application "Terminal" to do script "${command.replace(/"/g, '\\"')}"`,
      "-e",
      'tell application "Terminal" to activate',
    ])
  } else {
    for (const term of [
      "x-terminal-emulator",
      "gnome-terminal",
      "konsole",
      "xterm",
    ]) {
      try {
        const args =
          term === "gnome-terminal"
            ? ["--", "bash", "-lc", `${command}; exec bash`]
            : ["-e", `bash -lc '${command}; exec bash'`]
        const p = spawn(term, args, { env: cliEnv(), detached: true })
        p.on("error", () => {})
        return
      } catch {
        // try next terminal
      }
    }
  }
}
