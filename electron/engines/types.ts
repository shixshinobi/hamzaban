import type { BuiltPrompt } from "../prompt"
import type {
  DictionaryData,
  EngineConfig,
  ErrorCode,
  JobStage,
  TranslateRequest,
} from "../../shared/types"

export interface EngineContext {
  req: TranslateRequest
  engine: EngineConfig
  prompt: BuiltPrompt
  signal: AbortSignal
  /** Append streamed text. */
  delta: (text: string) => void
  /** Replace accumulated text with a full snapshot. */
  snapshot: (text: string) => void
  dictionary: (data: DictionaryData) => void
  /** Report progress before the answer starts. */
  stage: (stage: JobStage, detail?: string) => void
  detected: (lang: string) => void
  /** Writes the request image to a temp PNG and returns its path. */
  imageFile: () => Promise<string>
}

export type EngineRunner = (ctx: EngineContext) => Promise<string>

export class EngineError extends Error {
  code: ErrorCode
  /** HTTP status, when the error came from an API response. */
  status?: number
  /** The request got no response in time. */
  timedOut?: boolean
  /** The answer had started and broke off. */
  midStream?: boolean
  /** Seconds the host asks to wait before the next request (HTTP 429). */
  retryAfter?: number
  /** The quota that ran out is a daily one, so waiting a moment will not help. */
  daily?: boolean
  constructor(message: string, code: ErrorCode = "unknown", status?: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

/** Read a server-sent-events or NDJSON response body line by line. */
export async function* readLines(res: Response, signal: AbortSignal) {
  if (!res.body) return
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  try {
    while (true) {
      if (signal.aborted) throw new EngineError("cancelled", "cancelled")
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let i: number
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, "")
        buf = buf.slice(i + 1)
        yield line
      }
    }
    if (buf) yield buf
  } finally {
    reader.releaseLock()
  }
}

interface GoogleErrorDetail {
  "@type"?: string
  retryDelay?: string
  violations?: { quotaId?: string; quotaValue?: string }[]
}

function duration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.ceil((seconds % 3600) / 60)
  return h ? `${h} h ${m} min` : seconds >= 60 ? `${m} min` : `${seconds} s`
}

export async function httpError(res: Response): Promise<EngineError> {
  let detail = ""
  let details: GoogleErrorDetail[] = []
  try {
    const body = await res.text()
    try {
      // Gemini wraps its error object in an array.
      const parsed = JSON.parse(body)
      const j = Array.isArray(parsed) ? parsed[0] : parsed
      detail = j?.error?.message ?? j?.message ?? j?.error ?? body
      details = j?.error?.details ?? []
    } catch {
      detail = body
    }
  } catch {
    // ignore
  }
  if (res.status === 429) {
    // Google says which quota ran out and when it resets; other hosts send Retry-After.
    const delay = details.find((d) => d.retryDelay)?.retryDelay
    const header = Number(res.headers.get("retry-after"))
    const retryAfter = delay
      ? Math.ceil(parseFloat(delay))
      : header > 0
        ? header
        : undefined
    const violation = details.flatMap((d) => d.violations ?? [])[0]
    const daily = /PerDay/i.test(violation?.quotaId ?? "")
    const free = /FreeTier/i.test(violation?.quotaId ?? "")
    const limit = violation?.quotaValue
    const message = daily
      ? `Daily ${free ? "free-tier " : ""}limit reached${limit ? ` (${limit} requests a day for this model)` : ""}.${retryAfter ? ` It resets in about ${duration(retryAfter)}.` : ""}`
      : /per ?minute|PerMinute/i.test(`${violation?.quotaId} ${detail}`)
        ? `Per-minute limit reached${limit ? ` (${limit} requests a minute)` : ""}.`
        : /quota|billing/i.test(String(detail))
          ? "No quota left for this model on this key."
          : "Too many requests."
    const err = new EngineError(`HTTP 429 — ${message}`, "quota", 429)
    err.retryAfter = retryAfter
    err.daily = daily
    return err
  }
  const code = res.status === 401 || res.status === 403 ? "auth" : "network"
  const hint =
    res.status === 503
      ? "The model is overloaded right now. Try again shortly or pick another model."
      : ""
  return new EngineError(
    `HTTP ${res.status} — ${hint || String(detail).slice(0, 300)}`,
    code,
    res.status
  )
}
