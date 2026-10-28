import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { hz } from "@/lib/hz"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const MAC_SYMBOLS: Record<string, string> = {
  Command: "⌘",
  Cmd: "⌘",
  CommandOrControl: "⌘",
  CmdOrCtrl: "⌘",
  Ctrl: "⌃",
  Control: "⌃",
  Alt: "⌥",
  Option: "⌥",
  Shift: "⇧",
  Space: "Space",
}

export function formatAccel(accel: string, os?: string) {
  if (!accel) return ""
  return accel
    .split("+")
    .map((k) =>
      os === "darwin"
        ? (MAC_SYMBOLS[k] ?? k)
        : k
            .replace("CommandOrControl", "Ctrl")
            .replace("CmdOrCtrl", "Ctrl")
            .replace("Super", "Win")
    )
    .join(os === "darwin" ? "" : "+")
}

function keyName(e: KeyboardEvent): string | null {
  const c = e.code
  if (/^Key[A-Z]$/.test(c)) return c.slice(3)
  if (/^Digit\d$/.test(c)) return c.slice(5)
  if (/^F\d{1,2}$/.test(c)) return c
  if (/^Numpad\d$/.test(c)) return `num${c.slice(6)}`
  const map: Record<string, string> = {
    Space: "Space",
    Enter: "Enter",
    Tab: "Tab",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Insert: "Insert",
    Delete: "Delete",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
  }
  return map[c] ?? null
}

export function ShortcutRecorder({
  value,
  onChange,
  os,
}: {
  value: string
  onChange: (accel: string) => void
  os?: string
}) {
  const t = useT()
  const [recording, setRecording] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!recording) return
    // Global shortcuts would swallow the keys we want to record.
    void hz.shortcuts.suspend(true)
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === "Escape") {
        setRecording(false)
        return
      }
      const key = keyName(e)
      if (!key) return
      const mods: string[] = []
      if (e.ctrlKey) mods.push(os === "darwin" ? "Ctrl" : "CommandOrControl")
      if (e.metaKey) mods.push(os === "darwin" ? "Command" : "Super")
      if (e.altKey) mods.push("Alt")
      if (e.shiftKey) mods.push("Shift")
      if (!mods.length && !/^F\d+$/.test(key)) return
      onChange([...mods, key].join("+"))
      setRecording(false)
    }
    window.addEventListener("keydown", onKey, true)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      void hz.shortcuts.suspend(false)
    }
  }, [recording, onChange, os])

  const parts = formatAccel(value, os)
    .split(os === "darwin" ? /(?=[A-Z0-9])|(?<=[⌘⌃⌥⇧])/ : "+")
    .filter(Boolean)

  return (
    <Button
      ref={ref}
      variant="outline"
      size="sm"
      className={cn(
        "min-w-36 justify-center",
        recording && "ring-2 ring-primary/50"
      )}
      onClick={() => setRecording((v) => !v)}
      onBlur={() => setRecording(false)}
    >
      {recording ? (
        <span className="shimmer-text text-xs">{t("pressKeys")}</span>
      ) : (
        <KbdGroup dir="ltr">
          {parts.map((p, i) => (
            <Kbd key={i}>{p}</Kbd>
          ))}
        </KbdGroup>
      )}
    </Button>
  )
}
