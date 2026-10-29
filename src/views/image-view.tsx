import {
  ClipboardPasteIcon,
  CropIcon,
  ImageUpIcon,
  ScanTextIcon,
  SquareIcon,
  XIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { GlassPanel } from "@/components/glass/glass-panel"
import { EngineChips, ResultActions } from "@/components/result/result-actions"
import {
  ResultSurface,
  useResultModel,
} from "@/components/result/result-surface"
import { TranslateToolbar } from "@/components/translate-toolbar"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { hz } from "@/lib/hz"
import { useT } from "@/lib/i18n"
import { useApp } from "@/lib/store"
import { useTranslator } from "@/lib/use-translator"
import { cn } from "@/lib/utils"

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
}

function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export function ImageView() {
  const t = useT()
  const settings = useApp((s) => s.settings!)
  const pending = useApp((s) => s.pending)
  const setPending = useApp((s) => s.setPending)
  const [image, setImage] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [picking, setPicking] = useState(false)
  const { state, ocr, translate, retry, cancel, clear } = useTranslator()
  const model = useResultModel(state)

  const load = useCallback(
    (dataUrl: string, forceOcr = false) => {
      setImage(dataUrl)
      void translate({ text: "", image: dataUrl, forceOcr })
    },
    [translate]
  )

  useEffect(() => {
    if (pending?.image) {
      // One-off hand-off from the popup or the capture overlay.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load(pending.image)
      setPending(null)
    }
  }, [pending, load, setPending])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // The page stays mounted while others are open; only take pastes when it is shown.
      if (useApp.getState().route !== "image") return
      const file = [...(e.clipboardData?.files ?? [])].find((f) =>
        f.type.startsWith("image/")
      )
      if (file) void fileToDataUrl(file).then((d) => load(d))
    }
    window.addEventListener("paste", onPaste)
    return () => window.removeEventListener("paste", onPaste)
  }, [load])

  const onFiles = async (files: FileList | null) => {
    const file = [...(files ?? [])].find((f) => f.type.startsWith("image/"))
    if (file) load(await fileToDataUrl(file))
  }

  const chooseFile = async () => {
    setPicking(true)
    try {
      const f = await hz.file.readBinary([
        { name: t("imageFiles"), extensions: Object.keys(IMAGE_TYPES) },
      ])
      if (!f) return
      const ext = f.name.split(".").pop()?.toLowerCase() ?? ""
      const blob = new Blob([f.data as BlobPart], {
        type: IMAGE_TYPES[ext] ?? "image/png",
      })
      load(await fileToDataUrl(blob))
    } finally {
      setPicking(false)
    }
  }

  // Translate the same image again when the engine, language or style changes.
  const rerun = useRef(retry)
  useEffect(() => {
    rerun.current = retry
  })
  const prefs = `${settings.activeEngineId}|${settings.targetLang}|${settings.sourceLang}|${settings.activeStyleId}`
  const lastPrefs = useRef(prefs)
  useEffect(() => {
    if (prefs === lastPrefs.current) return
    lastPrefs.current = prefs
    if (!image) return
    // Several quick changes become one request.
    const id = setTimeout(
      () => rerun.current({ engineId: undefined, forceOcr: false }),
      700
    )
    return () => clearTimeout(id)
  }, [prefs, image])

  const targetLang = state.request?.targetLang ?? settings.targetLang
  const busy =
    state.status === "waiting" || state.status === "streaming" || ocr.running

  return (
    <div
      className="flex h-full flex-col gap-3"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        void onFiles(e.dataTransfer.files)
      }}
    >
      <TranslateToolbar detected={state.detected} />

      {!image ? (
        <GlassPanel
          className={cn(
            "flex flex-1 items-center justify-center transition",
            dragOver && "ring-2 ring-primary/60"
          )}
        >
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScanTextIcon />
              </EmptyMedia>
              <EmptyTitle>{t("imageTitle")}</EmptyTitle>
              <EmptyDescription>{t("imageHint")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row flex-wrap justify-center gap-2">
              <Button onClick={() => hz.capture.start()}>
                <CropIcon data-icon="inline-start" />
                {t("captureScreen")}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const d = await hz.clipboard.readImage()
                  if (d) load(d)
                }}
              >
                <ClipboardPasteIcon data-icon="inline-start" />
                {t("fromClipboard")}
              </Button>
              <Button
                variant="outline"
                disabled={picking}
                onClick={() => void chooseFile()}
              >
                {picking ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <ImageUpIcon data-icon="inline-start" />
                )}
                {t("chooseFile")}
              </Button>
            </EmptyContent>
          </Empty>
        </GlassPanel>
      ) : (
        // The row must be capped at the available height, or a long result stretches the
        // panel past the window instead of scrolling inside it.
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] grid-rows-[minmax(0,1fr)] gap-3">
          <GlassPanel className="relative flex min-h-0 flex-col overflow-hidden">
            <div className="flex h-11 shrink-0 items-center gap-1 px-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => hz.capture.start()}
              >
                <CropIcon data-icon="inline-start" />
                {t("captureScreen")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => load(image, true)}
              >
                <ScanTextIcon data-icon="inline-start" />
                {t("ocrLocal")}
              </Button>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("clear")}
                onClick={() => {
                  setImage(null)
                  clear()
                }}
              >
                <XIcon />
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
              <motion.img
                key={image}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                src={image}
                alt=""
                className="max-h-full max-w-full rounded-xl object-contain shadow-lg ring-1 ring-border"
              />
            </div>
            {ocr.running && (
              <div className="glass glass-strong absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-xl px-3 py-2 text-xs">
                <span className="shimmer-text shrink-0 font-medium">
                  {t("ocrRunning")}
                </span>
                <Progress value={ocr.progress * 100} className="h-1 flex-1" />
              </div>
            )}
          </GlassPanel>

          <GlassPanel sheen className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex h-11 shrink-0 items-center px-4">
              <span className="text-xs text-muted-foreground">
                {state.engineName}
              </span>
              <div className="flex-1" />
              {busy ? (
                <Button size="sm" variant="secondary" onClick={cancel}>
                  <SquareIcon data-icon="inline-start" />
                  {t("stop")}
                </Button>
              ) : (
                <ResultActions
                  text={model.plain}
                  lang={targetLang}
                  onRetry={() => retry()}
                />
              )}
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-3 px-5 pt-1 pb-5">
                {ocr.text && (
                  <details className="text-sm text-muted-foreground">
                    <summary className="cursor-pointer select-none">
                      {t("originalText")}
                    </summary>
                    <p
                      className="selectable mt-2 whitespace-pre-wrap"
                      dir="auto"
                    >
                      {ocr.text}
                    </p>
                  </details>
                )}
                <ResultSurface
                  state={state}
                  model={model}
                  size="main"
                  targetLang={targetLang}
                  onRetry={() => retry()}
                />
              </div>
            </ScrollArea>
            <div className="flex shrink-0 items-center gap-2 border-t px-3 py-2">
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("compareWith")}
              </span>
              <EngineChips />
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  )
}
