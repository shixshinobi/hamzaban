import { useCallback, useEffect, useRef, useState } from "react"
import type { ErrorCode } from "@shared/types"
import { imageLayout, releaseLayout, type LayoutPage } from "./layout"
import { translatePieces } from "./layout-translate"
import { useApp } from "./store"

export interface LayoutJob {
  /** The image this job belongs to. */
  src?: string
  page?: LayoutPage
  tr: (string | null)[]
  status: "idle" | "reading" | "ocr" | "working" | "partial" | "done" | "error"
  ocr: number
  error?: { message: string; code?: ErrorCode }
}

const IDLE: LayoutJob = { tr: [], status: "idle", ocr: 0 }

/** Translating one image in place: read its layout once, then translate its regions. */
export function useLayoutJob() {
  const settings = useApp((s) => s.settings!)
  const [job, setJob] = useState<LayoutJob>(IDLE)
  const ref = useRef(job)
  const abort = useRef<AbortController | null>(null)

  /** `fresh` drops earlier translations, e.g. after the target language changed. */
  const run = useCallback(
    async (src: string, fresh = false) => {
      abort.current?.abort()
      const ac = new AbortController()
      abort.current = ac
      // A newer run owns the state from the moment it starts.
      const set = (p: Partial<LayoutJob>) => {
        if (abort.current !== ac) return
        ref.current = { ...ref.current, ...p }
        setJob(ref.current)
      }
      try {
        let page = ref.current.src === src ? ref.current.page : undefined
        if (!page) {
          releaseLayout(ref.current.page)
          set({ ...IDLE, src, status: "reading" })
          page = await imageLayout(src, settings.sourceLang, (ocr) =>
            set({ status: "ocr", ocr })
          )
          if (abort.current !== ac) return releaseLayout(page)
          set({ page, tr: page.regions.map(() => null) })
        }
        let tr =
          fresh || ref.current.status === "done"
            ? page.regions.map(() => null)
            : ref.current.tr
        set({ status: "working", tr, error: undefined })
        await translatePieces(
          page.regions.map((r) => r.text),
          tr,
          settings,
          (i, text) => {
            tr = tr.map((x, k) => (k === i ? text : x))
            set({ tr })
          },
          ac.signal
        )
        set({ status: "done" })
      } catch (e) {
        const err = e as Error & { code?: ErrorCode }
        if (ac.signal.aborted)
          set({ status: ref.current.page ? "partial" : "idle" })
        else
          set({
            status: "error",
            error: { message: err.message, code: err.code },
          })
      }
    },
    [settings]
  )

  const stop = useCallback(() => abort.current?.abort(), [])

  const clear = useCallback(() => {
    abort.current?.abort()
    abort.current = null
    releaseLayout(ref.current.page)
    ref.current = IDLE
    setJob(IDLE)
  }, [])

  useEffect(() => () => abort.current?.abort(), [])

  return { job, run, stop, clear }
}
