import type { BuiltPrompt } from "../prompt"
import type {
  DictionaryData,
  EngineConfig,
  ErrorCode,
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
  detected: (lang: string) => void
  /** Writes the request image to a temp PNG and returns its path. */
  imageFile: () => Promise<string>
}

export type EngineRunner = (ctx: EngineContext) => Promise<string>

export class EngineError extends Error {
  code: ErrorCode
  constructor(message: string, code: ErrorCode = "unknown") {
    super(message)
    this.code = code
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

export async function httpError(res: Response): Promise<EngineError> {
  let detail = ""
  try {
    const body = await res.text()
    try {
      const j = JSON.parse(body)
      detail = j.error?.message ?? j.message ?? j.error ?? body
    } catch {
      detail = body
    }
  } catch {
    // ignore
  }
  const code = res.status === 401 || res.status === 403 ? "auth" : "network"
  return new EngineError(
    `HTTP ${res.status}${detail ? ` — ${String(detail).slice(0, 300)}` : ""}`,
    code
  )
}
