import { app, safeStorage } from "electron"
import fs from "node:fs"
import path from "node:path"
import {
  BUILTIN_STYLES,
  DEFAULT_ENGINES,
  DEFAULT_SETTINGS,
} from "../shared/defaults"
import type { EngineConfig, HistoryItem, Settings } from "../shared/types"

const MASK = "••••••"

const dir = () => app.getPath("userData")
const settingsFile = () => path.join(dir(), "settings.json")
const historyFile = () => path.join(dir(), "history.json")

let settings: Settings | null = null
let history: HistoryItem[] | null = null
const listeners = new Set<(s: Settings) => void>()

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T
  } catch {
    return fallback
  }
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8")
  fs.renameSync(tmp, file)
}

function encrypt(value: string) {
  if (!value) return value
  if (safeStorage.isEncryptionAvailable()) {
    return `enc:${safeStorage.encryptString(value).toString("base64")}`
  }
  return `b64:${Buffer.from(value).toString("base64")}`
}

function decrypt(value?: string) {
  if (!value) return ""
  try {
    if (value.startsWith("enc:"))
      return safeStorage.decryptString(Buffer.from(value.slice(4), "base64"))
    if (value.startsWith("b64:"))
      return Buffer.from(value.slice(4), "base64").toString()
  } catch {
    return ""
  }
  return value
}

/** Merge stored settings with defaults so new engines/styles appear after upgrades. */
function migrate(stored: Partial<Settings>): Settings {
  const shortcuts = { ...DEFAULT_SETTINGS.shortcuts, ...stored.shortcuts }
  // Early builds defaulted to Alt+Shift+…, which collides with the Windows layout switch.
  for (const k of Object.keys(shortcuts) as (keyof typeof shortcuts)[]) {
    if (shortcuts[k].startsWith("Alt+Shift+"))
      shortcuts[k] = DEFAULT_SETTINGS.shortcuts[k]
  }
  const s: Settings = { ...DEFAULT_SETTINGS, ...stored, shortcuts }
  const engines = stored.engines ?? []
  for (const def of DEFAULT_ENGINES) {
    if (!engines.some((e) => e.id === def.id)) engines.push(def)
  }
  s.engines = engines
  const styles = (stored.styles ?? []).filter((st) => !st.builtin)
  s.styles = [...BUILTIN_STYLES, ...styles]
  if (!s.engines.some((e) => e.id === s.activeEngineId))
    s.activeEngineId = "google"
  return s
}

export function getSettings(): Settings {
  if (!settings)
    settings = migrate(readJson<Partial<Settings>>(settingsFile(), {}))
  return settings
}

/** Settings safe for the renderer: API keys are masked. */
export function publicSettings(): Settings {
  const s = getSettings()
  return {
    ...s,
    engines: s.engines.map((e) => ({
      ...e,
      apiKey: e.apiKey ? MASK + decrypt(e.apiKey).slice(-4) : "",
    })),
  }
}

export function getEngine(id: string): EngineConfig | undefined {
  const e = getSettings().engines.find((x) => x.id === id)
  return e ? { ...e, apiKey: decrypt(e.apiKey) } : undefined
}

export function updateSettings(patch: Partial<Settings>): Settings {
  const current = getSettings()
  const next: Settings = { ...current, ...patch }
  if (patch.engines) {
    next.engines = patch.engines.map((e) => {
      const prev = current.engines.find((p) => p.id === e.id)
      let apiKey = e.apiKey ?? ""
      if (apiKey.startsWith(MASK)) apiKey = prev?.apiKey ?? ""
      else apiKey = encrypt(apiKey.trim())
      return { ...e, apiKey }
    })
  }
  if (patch.styles)
    next.styles = [
      ...BUILTIN_STYLES,
      ...patch.styles.filter((st) => !st.builtin),
    ]
  settings = next
  writeJson(settingsFile(), next)
  const pub = publicSettings()
  for (const l of listeners) l(pub)
  return pub
}

export function onSettingsChange(fn: (s: Settings) => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getHistory(): HistoryItem[] {
  if (!history) history = readJson<HistoryItem[]>(historyFile(), [])
  return history
}

export function addHistory(item: HistoryItem) {
  if (!getSettings().keepHistory) return
  const h = getHistory()
  const dup = h.findIndex(
    (x) =>
      x.source === item.source &&
      x.targetLang === item.targetLang &&
      x.engineName === item.engineName
  )
  if (dup >= 0) h.splice(dup, 1)
  h.unshift(item)
  history = h.slice(0, 300)
  writeJson(historyFile(), history)
}

export function removeHistory(id?: string) {
  history = id ? getHistory().filter((x) => x.id !== id) : []
  writeJson(historyFile(), history)
}
