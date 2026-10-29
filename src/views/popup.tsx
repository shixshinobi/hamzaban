import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Maximize2Icon,
  PinIcon,
  PinOffIcon,
  ReplaceIcon,
  ScanTextIcon,
  XIcon,
} from "lucide-react"
import { motion } from "motion/react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { profileInput, type Layout } from "@shared/blocks"
import { languageName, textDir } from "@shared/languages"
import type { PopupPayload } from "@shared/types"
import { LiveBackdrop } from "@/components/glass/live-backdrop"
import { Logo } from "@/components/logo"
import { LanguagePicker } from "@/components/pickers"
import {
  EngineChips,
  IconAction,
  ResultActions,
} from "@/components/result/result-actions"
import {
  ResultSurface,
  useResultModel,
} from "@/components/result/result-surface"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { hz } from "@/lib/hz"
import { useT, useUiLang } from "@/lib/i18n"
import { useApp } from "@/lib/store"
import { useTranslator } from "@/lib/use-translator"
import { cn } from "@/lib/utils"

const WIDTH: Record<Layout, number> = {
  dictionary: 400,
  phrase: 460,
  text: 580,
  document: 820,
}

export function Popup() {
  const t = useT()
  const ui = useUiLang()
  const settings = useApp((s) => s.settings!)
  const update = useApp((s) => s.update)
  const live = useApp((s) => s.platform?.material === "live")
  const refreshStatus = useApp((s) => s.refreshStatus)
  const [payload, setPayload] = useState<PopupPayload | null>(null)
  const [text, setText] = useState("")
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [pinned, setPinned] = useState(false)
  const { state, ocr, translate, retry } = useTranslator()
  const model = useResultModel(state)
  const headerRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const run = useCallback(
    (p: {
      text: string
      image?: string
      engineId?: string
      targetLang?: string
    }) => {
      if (!p.text.trim() && !p.image) return
      void translate(p)
    },
    [translate]
  )

  useEffect(() => {
    void refreshStatus()
    const show = (p: PopupPayload) => {
      setPayload(p)
      setText(p.text)
      setExpanded(false)
      setEditing(p.origin === "manual" || (!p.text && !p.image))
      run({ text: p.text, image: p.image })
    }
    const off = hz.popup.onShow(show)
    void hz.popup.ready().then((p) => p && show(p))
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hz.popup.close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Generative sizing: measure what was rendered and ask the main process for a window that fits it.
  const layout: Layout = payload?.image
    ? "text"
    : state.status === "idle"
      ? profileInput(text).layout
      : model.layout
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const chrome =
          (headerRef.current?.offsetHeight ?? 0) +
          (footerRef.current?.offsetHeight ?? 0)
        const width = payload?.image ? 640 : WIDTH[layout]
        hz.popup.fit({ width, height: Math.ceil(el.scrollHeight + chrome + 2) })
      })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => {
      ro.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [layout, payload?.image])

  const targetLang = state.request?.targetLang ?? settings.targetLang
  const srcLang =
    state.detected ??
    (settings.sourceLang === "auto" ? null : settings.sourceLang)
  const ArrowIcon = ui === "fa" ? ArrowLeftIcon : ArrowRightIcon

  return (
    <div className="window-shell flex flex-col rounded-[inherit]">
      {live && <LiveBackdrop />}
      <div className="aurora" />
      <div
        ref={headerRef}
        className="drag flex h-11 shrink-0 items-center gap-1 ps-3 pe-1.5"
      >
        <Logo className="size-5" />
        <span className="ms-1 text-xs text-muted-foreground">
          {srcLang ? languageName(srcLang, ui) : t("detected").replace(":", "")}
        </span>
        <ArrowIcon className="size-3 text-muted-foreground" />
        <LanguagePicker
          value={targetLang}
          onChange={(lang) => {
            void update({ targetLang: lang })
            run({ text, image: payload?.image, targetLang: lang })
          }}
          className="h-7 px-1.5"
        />
        <div className="flex-1" />
        <IconAction
          label={pinned ? t("unpin") : t("pin")}
          onClick={() => {
            hz.popup.pin(!pinned)
            setPinned(!pinned)
          }}
        >
          {pinned ? <PinOffIcon className="text-primary" /> : <PinIcon />}
        </IconAction>
        <IconAction
          label={t("openInMain")}
          onClick={() =>
            hz.popup.openInMain({
              text,
              image: payload?.image,
              origin: "manual",
            })
          }
        >
          <Maximize2Icon />
        </IconAction>
        <IconAction label={t("close")} onClick={() => hz.popup.close()}>
          <XIcon />
        </IconAction>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div ref={contentRef} className="flex flex-col gap-3 px-4 pb-4">
          {payload?.image && (
            <motion.img
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              src={payload.image}
              alt=""
              className="max-h-40 w-fit max-w-full rounded-xl object-contain ring-1 ring-border"
            />
          )}
          {ocr.running && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ScanTextIcon className="size-3.5" />
              <span className="shimmer-text">{t("ocrRunning")}</span>
              <Progress value={ocr.progress * 100} className="h-1 flex-1" />
            </div>
          )}
          {editing ? (
            <Textarea
              autoFocus
              value={text}
              dir={text ? textDir(text) : "auto"}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  setEditing(false)
                  run({ text })
                }
              }}
              placeholder={t("sourcePlaceholder")}
              className="reading min-h-16 resize-none rounded-xl text-[15px]"
            />
          ) : (
            (text || ocr.text) && (
              <button
                type="button"
                onClick={() =>
                  expanded ? setEditing(true) : setExpanded(true)
                }
                dir={textDir(text || ocr.text || "")}
                className={cn(
                  "reading text-start text-[13.5px] leading-relaxed text-muted-foreground transition hover:text-foreground",
                  !expanded && "line-clamp-2"
                )}
              >
                {text || ocr.text}
              </button>
            )
          )}
          {(text || payload?.image) && !editing && (
            <div className="h-px bg-border" />
          )}
          <ResultSurface
            state={state}
            model={model}
            size="popup"
            targetLang={targetLang}
            onRetry={() => retry()}
          />
        </div>
      </div>

      {state.status !== "idle" && (
        <div
          ref={footerRef}
          className="flex h-11 shrink-0 items-center gap-1 border-t ps-1.5 pe-2"
        >
          <ResultActions
            text={model.plain}
            lang={targetLang}
            onRetry={() => retry()}
          >
            {payload?.origin === "selection" && (
              <IconAction
                label={t("replace")}
                disabled={!model.plain || state.status !== "done"}
                onClick={() => hz.popup.replace(model.plain)}
              >
                <ReplaceIcon />
              </IconAction>
            )}
          </ResultActions>
          <EngineChips
            className="ms-1 min-w-0 flex-1"
            onPick={(id) => run({ text, image: payload?.image, engineId: id })}
          />
        </div>
      )}
    </div>
  )
}
