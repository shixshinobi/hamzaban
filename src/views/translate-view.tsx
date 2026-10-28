import {
  ClipboardPasteIcon,
  LanguagesIcon,
  MessageSquarePlusIcon,
  SquareIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { profileInput } from "@shared/blocks"
import { isRtl, languageName, textDir } from "@shared/languages"
import { GlassPanel } from "@/components/glass/glass-panel"
import {
  EngineChips,
  IconAction,
  ResultActions,
} from "@/components/result/result-actions"
import {
  ResultSurface,
  useResultModel,
} from "@/components/result/result-surface"
import { TranslateToolbar } from "@/components/translate-toolbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useT, useUiLang } from "@/lib/i18n"
import { speak } from "@/lib/speech"
import { useActiveEngine, useApp } from "@/lib/store"
import { useTranslator } from "@/lib/use-translator"
import { cn } from "@/lib/utils"

const DRAFT_KEY = "hz-draft"

export function TranslateView() {
  const t = useT()
  const ui = useUiLang()
  const settings = useApp((s) => s.settings!)
  const engine = useActiveEngine()
  const pending = useApp((s) => s.pending)
  const setPending = useApp((s) => s.setPending)
  const os = useApp((s) => s.platform?.os)
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(DRAFT_KEY) ?? ""
    } catch {
      return ""
    }
  })
  const [extra, setExtra] = useState("")
  const [showExtra, setShowExtra] = useState(false)
  const { state, translate, retry, cancel, clear } = useTranslator()
  const model = useResultModel(state)
  const lastRun = useRef("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const run = useCallback(
    (value = text, engineId?: string) => {
      if (!value.trim()) return
      lastRun.current = `${value}|${engineId ?? settings.activeEngineId}|${settings.targetLang}|${settings.sourceLang}|${settings.activeStyleId}`
      void translate({ text: value, engineId, extraInstruction: extra })
    },
    [
      text,
      translate,
      extra,
      settings.activeEngineId,
      settings.targetLang,
      settings.sourceLang,
      settings.activeStyleId,
    ]
  )

  // Hand-off from the popup or history.
  useEffect(() => {
    if (pending && !pending.image) {
      // One-off hand-off from another window; the store is the external system here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(pending.text)
      setPending(null)
      run(pending.text)
    }
  }, [pending, setPending, run])

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, text)
    } catch {
      // storage unavailable
    }
  }, [text])

  // Free engines translate as you type; account/API engines wait for Ctrl+Enter.
  useEffect(() => {
    if (engine.kind !== "google" || !text.trim()) return
    const key = `${text}|${settings.activeEngineId}|${settings.targetLang}|${settings.sourceLang}|${settings.activeStyleId}`
    if (key === lastRun.current) return
    const id = setTimeout(() => run(text), 550)
    return () => clearTimeout(id)
  }, [
    text,
    engine.kind,
    run,
    settings.activeEngineId,
    settings.targetLang,
    settings.sourceLang,
    settings.activeStyleId,
  ])

  // Re-run when the language pair, style or engine changes and something is already shown.
  // Google is left to the type-ahead effect above. The short delay folds several quick
  // changes into one request; account engines flag bursts of messages as bots.
  useEffect(() => {
    if (state.status === "idle" || !text.trim() || engine.kind === "google")
      return
    const id = setTimeout(() => run(text), 700)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.targetLang, settings.activeStyleId, settings.activeEngineId])

  const busy = state.status === "waiting" || state.status === "streaming"
  const inputLayout = profileInput(text).layout
  const compact =
    state.status !== "idle" &&
    (model.layout === "dictionary" || model.layout === "phrase") &&
    inputLayout !== "text" &&
    inputLayout !== "document"
  const targetLang = state.request?.targetLang ?? settings.targetLang
  const srcDir = text
    ? textDir(text)
    : isRtl(settings.sourceLang)
      ? "rtl"
      : ui === "fa"
        ? "rtl"
        : "ltr"
  const mod = os === "darwin" ? "⌘" : "Ctrl"

  return (
    <div className="flex h-full flex-col gap-3">
      <TranslateToolbar detected={state.detected}>
        <IconAction
          label={t("extraInstruction")}
          onClick={() => setShowExtra((v) => !v)}
          disabled={engine.kind === "google"}
        >
          <MessageSquarePlusIcon className={cn(showExtra && "text-primary")} />
        </IconAction>
      </TranslateToolbar>

      {showExtra && engine.kind !== "google" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          <Input
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={t("extraInstruction")}
            className="glass-flat h-10 rounded-2xl border-0 px-4"
          />
        </motion.div>
      )}

      {/* Generative layout: short inputs stack with a display-size result; long inputs sit side by side. */}
      <motion.div
        layout
        className={cn(
          "grid min-h-0 flex-1 gap-3",
          compact ? "grid-rows-[auto_1fr]" : "grid-cols-2"
        )}
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
      >
        <motion.div layout="position" className="min-h-0">
          <GlassPanel className={cn("flex flex-col", compact ? "" : "h-full")}>
            <Textarea
              ref={textareaRef}
              value={text}
              dir={srcDir}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  run()
                }
              }}
              placeholder={t("sourcePlaceholder")}
              className={cn(
                "reading resize-none border-0 bg-transparent px-5 pt-4 shadow-none focus-visible:ring-0 dark:bg-transparent",
                compact
                  ? "max-h-40 min-h-20 text-lg"
                  : "min-h-0 flex-1 text-[16px]"
              )}
              autoFocus
            />
            <div className="flex items-center gap-1 px-3 pb-3">
              <span className="px-2 text-xs text-muted-foreground tabular-nums">
                {text.length.toLocaleString(ui === "fa" ? "fa-IR" : "en-US")}{" "}
                {t("chars")}
              </span>
              <div className="flex-1" />
              <IconAction
                label={t("listen")}
                disabled={!text}
                onClick={() =>
                  speak(text, state.detected ?? settings.sourceLang)
                }
              >
                <Volume2Icon />
              </IconAction>
              <IconAction
                label={t("paste")}
                onClick={async () => {
                  const v = await navigator.clipboard.readText()
                  setText(v)
                  run(v)
                }}
              >
                <ClipboardPasteIcon />
              </IconAction>
              <IconAction
                label={t("clear")}
                disabled={!text}
                onClick={() => {
                  setText("")
                  clear()
                  textareaRef.current?.focus()
                }}
              >
                <XIcon />
              </IconAction>
              {busy ? (
                <Button size="sm" variant="secondary" onClick={cancel}>
                  <SquareIcon data-icon="inline-start" />
                  {t("stop")}
                </Button>
              ) : (
                <Button size="sm" onClick={() => run()} disabled={!text.trim()}>
                  {t("translate")}
                  <KbdGroup className="ms-1 opacity-70" dir="ltr">
                    <Kbd className="bg-primary-foreground/15 text-primary-foreground">
                      {mod}
                    </Kbd>
                    <Kbd className="bg-primary-foreground/15 text-primary-foreground">
                      ↵
                    </Kbd>
                  </KbdGroup>
                </Button>
              )}
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div layout="position" className="min-h-0">
          <GlassPanel sheen className="flex h-full flex-col overflow-hidden">
            <div className="flex h-11 shrink-0 items-center gap-2 px-4">
              {state.engineName ? (
                <Badge variant="secondary">{state.engineName}</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {languageName(targetLang, ui)}
                </span>
              )}
              {state.detected && settings.sourceLang === "auto" && (
                <span className="text-xs text-muted-foreground">
                  {t("detected")}
                  {languageName(state.detected, ui)}
                </span>
              )}
              <div className="flex-1" />
              <ResultActions
                text={model.plain}
                lang={targetLang}
                onRetry={state.status === "idle" ? undefined : () => retry()}
              />
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="px-5 pt-1 pb-5">
                <ResultSurface
                  state={state}
                  model={model}
                  size="main"
                  targetLang={targetLang}
                  onRetry={() => retry()}
                  empty={
                    <Empty className="min-h-64">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <LanguagesIcon />
                        </EmptyMedia>
                        <EmptyTitle>{t("resultEmpty")}</EmptyTitle>
                        <EmptyDescription>
                          {t("resultEmptyHint")}
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  }
                />
              </div>
            </ScrollArea>
            {state.status !== "idle" && (
              <div className="flex shrink-0 items-center gap-2 border-t px-3 py-2">
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("compareWith")}
                </span>
                <EngineChips />
              </div>
            )}
          </GlassPanel>
        </motion.div>
      </motion.div>
    </div>
  )
}
