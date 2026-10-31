import { useCallback, useEffect, useRef, useState } from "react"
import type { ErrorCode } from "@shared/types"
import type { JobProgress } from "@/components/result/job-banner"
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
  /** What the running step is doing, for the banner over the picture. */
  progress?: JobProgress
}

const IDLE: LayoutJob = { tr: [], status: "idle", ocr: 0 }

/** A request (or reading step) just started: its clock starts now. */
const started = (label?: JobProgress["label"]): JobProgress => ({
  startedAt: Date.now(),
  receiving: false,
  label,
})

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
          set({
            ...IDLE,
            src,
            status: "reading",
            progress: started("layoutReading"),
          })
          page = await imageLayout(src, settings.sourceLang, (ocr) =>
            set({
              status: "ocr",
              ocr,
              progress: { ...ref.current.progress!, label: "ocrRunning" },
            })
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
          ac.signal,
          {
            onProgress: (p) =>
              set({
                progress:
                  !p.stage && !p.receiving
                    ? started()
                    : { ...(ref.current.progress ?? started()), ...p },
              }),
          }
        )
        set({ status: "done", progress: undefined })
      } catch (e) {
        const err = e as Error & { code?: ErrorCode }
        if (ac.signal.aborted)
          set({
            status: ref.current.page ? "partial" : "idle",
            progress: undefined,
          })
        else
          set({
            status: "error",
            error: { message: err.message, code: err.code },
            progress: undefined,
          })
      }
    },
    [settings]
  )

  const stop = useCallback(() => abort.current?.abort(), [])

  /** The reader's own wording for one region. */
  const setPiece = useCallback((i: number, text: string) => {
    if (!ref.current.page) return
    ref.current = {
      ...ref.current,
      tr: ref.current.tr.map((x, k) => (k === i ? text : x)),
    }
    setJob(ref.current)
  }, [])

  const clear = useCallback(() => {
    abort.current?.abort()
    abort.current = null
    releaseLayout(ref.current.page)
    ref.current = IDLE
    setJob(IDLE)
  }, [])

  useEffect(() => () => abort.current?.abort(), [])

  return { job, run, stop, clear, setPiece }
}
