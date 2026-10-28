import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { translateKey, type StringKey } from "./i18n"
import { recognize } from "./ocr"
import { buildRequest, engineIsVision } from "./request"
import { useApp } from "./store"
import { useTranslation } from "./use-translation"

export interface TranslateInput {
  text: string
  image?: string
  engineId?: string
  sourceLang?: string
  targetLang?: string
  extraInstruction?: string
  forceOcr?: boolean
}

/**
 * Translation entry point used by every screen. Images go straight to vision
 * models; for Google (or when the user prefers it) text is read locally first.
 */
// Read the UI language at call time so the callbacks below stay stable across renders.
const t = (key: StringKey) =>
  translateKey(key, useApp.getState().settings?.uiLanguage ?? "fa")

export function useTranslator() {
  const last = useRef<TranslateInput | null>(null)
  const fallback = useRef<((input: TranslateInput) => void) | null>(null)
  // A web session that refuses the image (signed out, upload quota) falls back to local OCR.
  const { state, run, cancel, reset, fail } = useTranslation((code) => {
    const input = last.current
    if (
      code !== "unsupported" ||
      !input?.image ||
      input.forceOcr ||
      !fallback.current
    )
      return false
    toast.info(t("imageRefused"))
    fallback.current({ ...input, forceOcr: true })
    return true
  })
  const [ocr, setOcr] = useState<{
    running: boolean
    progress: number
    text: string | null
  }>({ running: false, progress: 0, text: null })

  const translate = useCallback(
    async (input: TranslateInput) => {
      const settings = useApp.getState().settings!
      last.current = input
      const engineId = input.engineId ?? settings.activeEngineId
      let text = input.text
      let image = input.image
      if (
        image &&
        (input.forceOcr ||
          settings.imageMode === "ocr" ||
          !engineIsVision(settings, engineId))
      ) {
        setOcr({ running: true, progress: 0, text: null })
        try {
          text = await recognize(
            image,
            input.sourceLang ?? settings.sourceLang,
            (p) => setOcr((o) => ({ ...o, progress: p }))
          )
        } catch (e) {
          console.error("OCR failed", e)
          setOcr({ running: false, progress: 0, text: null })
          return fail(t("ocrFailed"))
        }
        setOcr({ running: false, progress: 1, text })
        image = undefined
        if (!text.trim()) return fail(t("ocrEmpty"))
      } else {
        setOcr({ running: false, progress: 0, text: null })
      }
      await run(buildRequest(settings, { ...input, text, image, engineId }))
    },
    [run, fail]
  )
  useEffect(() => {
    fallback.current = (input) => void translate(input)
  }, [translate])

  const retry = useCallback(
    (patch?: Partial<TranslateInput>) => {
      if (last.current) void translate({ ...last.current, ...patch })
    },
    [translate]
  )

  const clear = useCallback(() => {
    reset()
    setOcr({ running: false, progress: 0, text: null })
    last.current = null
  }, [reset])

  return { state, ocr, translate, retry, cancel, clear, lastInput: last }
}
