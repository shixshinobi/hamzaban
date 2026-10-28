import { useCallback, useEffect, useRef, useState } from "react"
import type { DictionaryData, ErrorCode, TranslateRequest } from "@shared/types"
import { hz } from "./hz"

export type JobStatus = "idle" | "waiting" | "streaming" | "done" | "error"

export interface TranslationState {
  status: JobStatus
  text: string
  dictionary: DictionaryData | null
  detected: string | null
  engineId: string | null
  engineName: string | null
  error: { message: string; code?: ErrorCode } | null
  smart: boolean
  request: TranslateRequest | null
}

const EMPTY: TranslationState = {
  status: "idle",
  text: "",
  dictionary: null,
  detected: null,
  engineId: null,
  engineName: null,
  error: null,
  smart: false,
  request: null,
}

/** Runs one translation at a time and folds the main-process event stream into state. */
export function useTranslation(
  onError?: (code: ErrorCode | undefined) => boolean
) {
  const [state, setState] = useState<TranslationState>(EMPTY)
  const jobRef = useRef<string | null>(null)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  useEffect(
    () =>
      hz.translate.onEvent((e) => {
        if (e.jobId !== jobRef.current) return
        // The caller may take over a failure (e.g. retry an image with OCR) instead of showing it.
        if (
          e.type === "error" &&
          e.code !== "cancelled" &&
          onErrorRef.current?.(e.code)
        )
          return
        setState((s) => {
          switch (e.type) {
            case "start":
              return { ...s, engineId: e.engineId, engineName: e.engineName }
            case "delta":
              return { ...s, status: "streaming", text: s.text + e.text }
            case "snapshot":
              return { ...s, status: "streaming", text: e.text }
            case "dictionary":
              return { ...s, dictionary: e.data }
            case "detected":
              return { ...s, detected: e.lang }
            case "done":
              jobRef.current = null
              return { ...s, status: "done", text: e.text || s.text }
            case "error":
              jobRef.current = null
              if (e.code === "cancelled")
                return { ...s, status: s.text ? "done" : "idle" }
              return {
                ...s,
                status: "error",
                error: { message: e.message, code: e.code },
              }
          }
        })
      }),
    []
  )

  const cancel = useCallback(() => {
    if (jobRef.current) void hz.translate.cancel(jobRef.current)
    jobRef.current = null
  }, [])

  const run = useCallback(
    async (req: TranslateRequest) => {
      cancel()
      setState({
        ...EMPTY,
        status: "waiting",
        smart: !!req.smart,
        request: req,
      })
      const id = crypto.randomUUID()
      jobRef.current = id
      await hz.translate.start(req, id)
    },
    [cancel]
  )

  /** Show a failure that happened before the request reached an engine (e.g. OCR). */
  const fail = useCallback((message: string) => {
    jobRef.current = null
    setState((s) => ({ ...s, status: "error", error: { message } }))
  }, [])

  const reset = useCallback(() => {
    cancel()
    setState(EMPTY)
  }, [cancel])

  useEffect(() => cancel, [cancel])

  return { state, run, cancel, reset, fail }
}
