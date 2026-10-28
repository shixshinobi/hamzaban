// Types shared between the Electron main process and the renderer.

export type EngineKind =
  | "google"
  | "chatgpt-web"
  | "claude-web"
  | "gemini-web"
  | "codex-cli"
  | "claude-cli"
  | "gemini-cli"
  | "ollama"
  | "openai"
  | "anthropic"

export type EngineFamily = "free" | "web" | "cli" | "local" | "api"

export interface EngineConfig {
  id: string
  kind: EngineKind
  name: string
  enabled: boolean
  model?: string
  baseUrl?: string
  /** Stored encrypted on disk; the renderer only ever sees a masked value. */
  apiKey?: string
  /** For API engines: which preset the user started from (openai, openrouter, ...). */
  preset?: string
  /** For CLI engines: optional absolute path to the executable. */
  command?: string
}

export interface GlossaryTerm {
  source: string
  target: string
}

export interface StyleProfile {
  id: string
  name: string
  description: string
  instructions: string
  glossary: GlossaryTerm[]
  /** hue in degrees, used for the profile's accent chip */
  hue: number
  builtin?: boolean
}

export type ShortcutAction =
  | "translateSelection"
  | "replaceSelection"
  | "captureScreen"
  | "translateClipboard"
  | "showMain"

export type Shortcuts = Record<ShortcutAction, string>

export type UiLanguage = "fa" | "en"
export type ThemePref = "system" | "light" | "dark"
export type WindowMaterial = "auto" | "acrylic" | "mica" | "none"

export interface Settings {
  uiLanguage: UiLanguage
  theme: ThemePref
  material: WindowMaterial
  sourceLang: string
  targetLang: string
  /** Language used when the detected source already equals the target. */
  secondaryLang: string
  activeEngineId: string
  activeStyleId: string | null
  engines: EngineConfig[]
  styles: StyleProfile[]
  shortcuts: Shortcuts
  /** Ask language models for structured block output (generative UI). */
  smartLayout: boolean
  /** Image translation: let vision models read the image or always OCR locally first. */
  imageMode: "vision" | "ocr"
  popupAutoHide: boolean
  launchAtLogin: boolean
  keepHistory: boolean
  onboarded: boolean
}

export type TranslateMode = "auto" | "dictionary" | "text" | "document"

export interface TranslateRequest {
  text: string
  sourceLang: string
  targetLang: string
  engineId?: string
  styleId?: string | null
  mode?: TranslateMode
  /** PNG data URL for image translation */
  image?: string
  /** Ask for structured JSONL blocks instead of plain text. */
  smart?: boolean
  /** Free-form extra instruction for this one request. */
  extraInstruction?: string
}

export type TranslateEvent =
  | { jobId: string; type: "start"; engineId: string; engineName: string }
  | { jobId: string; type: "delta"; text: string }
  /** Full replacement of the accumulated text (web/CLI engines report snapshots). */
  | { jobId: string; type: "snapshot"; text: string }
  | { jobId: string; type: "dictionary"; data: DictionaryData }
  | { jobId: string; type: "detected"; lang: string }
  | { jobId: string; type: "done"; text: string }
  | { jobId: string; type: "error"; message: string; code?: ErrorCode }

export type ErrorCode =
  | "needs-login"
  | "not-installed"
  | "network"
  | "auth"
  /** A web session accepted the prompt but never started answering (usually its bot check). */
  | "held"
  | "cancelled"
  | "unsupported"
  | "unknown"

/** Dictionary-style result, produced natively by Google and by LLM blocks. */
export interface DictionaryData {
  word: string
  translation?: string
  phonetic?: string
  senses: {
    pos: string
    terms: { text: string; back?: string[]; score?: number }[]
  }[]
  definitions: { pos: string; gloss: string; example?: string }[]
  examples: string[]
  synonyms: string[]
}

export interface HistoryItem {
  id: string
  at: number
  source: string
  result: string
  sourceLang: string
  targetLang: string
  engineName: string
  hasImage?: boolean
}

export interface EngineStatus {
  id: string
  ok: boolean
  detail?: string
}

export interface PopupPayload {
  text: string
  image?: string
  autoReplace?: boolean
  origin: "selection" | "clipboard" | "capture" | "manual"
}

export interface Platform {
  os: "win32" | "darwin" | "linux"
  material: "acrylic" | "mica" | "vibrancy" | "none"
}
