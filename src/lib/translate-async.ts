import type { TranslateRequest } from "@shared/types"
import { hz } from "./hz"

/** Promise-style translation for batch work (PDF pages). Streams partial text to `onText`. */
export function translateAsync(
  req: TranslateRequest,
  onText?: (text: string) => void,
  signal?: AbortSignal
): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    let acc = ""
    const off = hz.translate.onEvent((e) => {
      if (e.jobId !== id) return
      if (e.type === "delta") acc += e.text
      if (e.type === "snapshot") acc = e.text
      if (e.type === "delta" || e.type === "snapshot") onText?.(acc)
      if (e.type === "done") {
        off()
        resolve(e.text || acc)
      }
      if (e.type === "error") {
        off()
        reject(Object.assign(new Error(e.message), { code: e.code }))
      }
    })
    signal?.addEventListener("abort", () => void hz.translate.cancel(id), {
      once: true,
    })
    void hz.translate.start(req, id)
  })
}
