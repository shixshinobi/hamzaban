import type { JobStage, TranslateRequest } from "@shared/types"
import { hz } from "./hz"

/**
 * Promise-style translation for batch work (PDF pages). Streams partial text to
 * `onText` and the request's stages (sending, thinking, retrying…) to `onStage`.
 */
export function translateAsync(
  req: TranslateRequest,
  onText?: (text: string) => void,
  signal?: AbortSignal,
  onStage?: (stage: JobStage, detail?: string, limit?: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cancelled = () =>
      Object.assign(new Error("cancelled"), { code: "cancelled" })
    // A stop pressed before this call would never fire "abort" again.
    if (signal?.aborted) return reject(cancelled())
    const id = crypto.randomUUID()
    let acc = ""
    const off = hz.translate.onEvent((e) => {
      if (e.jobId !== id) return
      if (e.type === "delta") acc += e.text
      if (e.type === "snapshot") acc = e.text
      if (e.type === "delta" || e.type === "snapshot") onText?.(acc)
      if (e.type === "stage") onStage?.(e.stage, e.detail, e.limit)
      if (e.type === "done") {
        off()
        resolve(e.text || acc)
      }
      if (e.type === "error") {
        off()
        reject(Object.assign(new Error(e.message), { code: e.code }))
      }
    })
    // Settle right away instead of waiting for the engine to wind down.
    signal?.addEventListener(
      "abort",
      () => {
        off()
        void hz.translate.cancel(id)
        reject(cancelled())
      },
      { once: true }
    )
    void hz.translate.start(req, id)
  })
}
