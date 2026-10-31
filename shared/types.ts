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
/** "clear": a fully transparent window, so what is behind it shows unblurred. */
/** "live": clear, plus a live blurred copy of the screen behind the window (Windows). */
export type WindowMaterial =
  "auto" | "acrylic" | "mica" | "clear" | "live" | "none"
/** What is drawn behind the glass panels. */
export type Backdrop = "aurora" | "orbs" | "gradient" | "grid" | "plain"
export type AccentColor =
  "blue" | "violet" | "pink" | "red" | "orange" | "green" | "teal" | "graphite"

export interface Settings {
  uiLanguage: UiLanguage
  theme: ThemePref
  material: WindowMaterial
  accent: AccentColor
  backdrop: Backdrop
  /** How see-through the glass surfaces are, 0 (opaque) to 100. */
  transparency: number
  /** Backdrop blur behind the glass surfaces, in pixels. */
  blur: number
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

/** What a job is doing before its first words arrive, shown while the user waits. */
export type JobStage =
  | "sending"
  | "thinking"
  | "retrying"
  /** Waiting out a per-minute rate limit; `detail` is the number of seconds. */
  | "waiting"
  | "opening"
  | "attaching"

export type TranslateEvent =
  | { jobId: string; type: "start"; engineId: string; engineName: string }
  /** `detail` carries the model being tried when the stage is "retrying". */
  | { jobId: string; type: "stage"; stage: JobStage; detail?: string }
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
  /** The key's request quota is used up (daily, or per minute after waiting once). */
  | "quota"
  /** The host refuses this network outright (Google's edge does this for some regions and VPN exits). */
  | "blocked"
  | "cancelled"
  | "unsupported"
  | "unknown"

/**
 * What an API engine has used, as counted by the app on this computer (days in UTC).
 * Tokens come from the provider's own figures when it sends them, and are estimated
 * from the length of the text when it does not.
 */
export interface EngineUsage {
  day: string
  requests: number
  tokens: number
  /** Some of today's tokens are estimates. */
  estimated: boolean
  month: string
  monthRequests: number
  monthTokens: number
  /** The day's quota as the provider last reported it with an answer. */
  reported?: {
    requestsLeft?: number
    requestsLimit?: number
    tokensLeft?: number
    tokensLimit?: number
    at: number
  }
}

/** What a provider says about the key itself, for those that can be asked (OpenRouter). */
export interface RemoteUsage {
  /** Credit spent, in dollars. */
  creditsUsed?: number
  creditsLimit?: number | null
  creditsLeft?: number | null
  freeTier?: boolean
  /** Free-model requests today. */
  freeToday?: { used?: number; limit?: number; remaining?: number }
}

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
  material: "acrylic" | "mica" | "vibrancy" | "clear" | "live" | "none"
}
