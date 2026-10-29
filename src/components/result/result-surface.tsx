import {
  AppWindowIcon,
  DownloadIcon,
  KeyRoundIcon,
  LogInIcon,
  RotateCcwIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useMemo, useState } from "react"
import {
  blocksToText,
  parseBlocks,
  profileInput,
  type Block,
  type Layout,
} from "@shared/blocks"
import { isRtl, textDir } from "@shared/languages"
import type { JobStage } from "@shared/types"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { hz } from "@/lib/hz"
import { useT, useUiLang, type StringKey } from "@/lib/i18n"
import { useApp } from "@/lib/store"
import type { TranslationState } from "@/lib/use-translation"
import { cn } from "@/lib/utils"
import { Appear, BlockView, Markdown } from "./blocks"
import { DictionaryView, fromBlocks, fromGoogle } from "./dictionary-view"

export interface ResultModel {
  layout: Layout
  blocks: Block[] | null
  plain: string
  original?: string
}

/** Interpret the raw engine output into the shape the surface will render. */
export function useResultModel(state: TranslationState): ResultModel {
  return useMemo(() => {
    const req = state.request
    const inputLayout: Layout = req?.image
      ? "text"
      : profileInput(req?.text ?? "").layout
    const final = state.status === "done"
    if (state.smart && state.text) {
      const blocks = parseBlocks(state.text, final)
      const meta = blocks.find((b) => b.t === "meta") as
        Extract<Block, { t: "meta" }> | undefined
      const content = blocks.filter((b) => b.t !== "meta")
      const quote = content.find((b) => b.t === "quote") as
        Extract<Block, { t: "quote" }> | undefined
      return {
        layout: meta?.layout ?? inputLayout,
        blocks: content,
        plain:
          blocksToText(content.filter((b) => b.t !== "quote")) || state.text,
        original: quote?.text,
      }
    }
    // Plain answers to image requests: original, a --- line, then the translation.
    if (req?.image && /\n-{3,}\n/.test(state.text)) {
      const [orig, ...rest] = state.text.split(/\n-{3,}\n/)
      return {
        layout: inputLayout,
        blocks: null,
        plain: rest.join("\n").trim(),
        original: orig.trim(),
      }
    }
    return {
      layout: state.dictionary ? "dictionary" : inputLayout,
      blocks: null,
      plain: state.text,
    }
  }, [state])
}

const STAGE_LABEL: Record<JobStage, StringKey> = {
  sending: "stageSending",
  thinking: "stageThinking",
  retrying: "stageRetrying",
  waiting: "stageWaiting",
  opening: "stageOpening",
  attaching: "stageAttaching",
}

/** Seconds since `since`, ticking once a second while mounted. */
function useElapsed(since: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return since ? Math.max(0, Math.floor((now - since) / 1000)) : 0
}

function LoadingShape({
  layout,
  state,
}: {
  layout: Layout
  state: TranslationState
}) {
  const t = useT()
  const lang = useUiLang()
  const seconds = useElapsed(state.startedAt)
  const { stage, engineName } = state
  // Stages about one site or model name it; the rest name the engine.
  const fmt = new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en")
  const label = stage
    ? stage.stage === "waiting"
      ? `${t("stageWaiting")} (${fmt.format(Number(stage.detail ?? 0))} ${t("secondsShort")})`
      : stage.detail
        ? `${t(STAGE_LABEL[stage.stage])} ${stage.detail}`
        : `${t(STAGE_LABEL[stage.stage])}${engineName ? ` · ${engineName}` : ""}`
    : `${t("translating")}${engineName ? ` · ${engineName}` : ""}`
  return (
    <div className="flex flex-col gap-3" aria-busy>
      <div className="flex items-center gap-2 text-sm" aria-live="polite">
        <SparklesIcon className="size-3.5 shrink-0 text-primary" />
        <span className="shimmer-text min-w-0 truncate font-medium">
          {label}
        </span>
        {seconds >= 2 && (
          <span className="ms-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en").format(
              seconds
            )}{" "}
            {t("secondsShort")}
          </span>
        )}
      </div>
      <div className="indeterminate h-0.5 overflow-hidden rounded-full bg-muted" />
      {seconds >= 20 && (
        <p className="text-xs text-muted-foreground">{t("waitLong")}</p>
      )}
      {layout === "dictionary" ? (
        <>
          <Skeleton className="h-8 w-40" />
          <div className="flex gap-1.5">
            <Skeleton className="h-7 w-20 rounded-full" />
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        </>
      ) : (
        <>
          <Skeleton className="h-4 w-[92%]" />
          <Skeleton className="h-4 w-[78%]" />
          {layout !== "phrase" && (
            <>
              <Skeleton className="h-4 w-[85%]" />
              <Skeleton className="h-4 w-[60%]" />
            </>
          )}
        </>
      )}
    </div>
  )
}

function ErrorView({
  state,
  onRetry,
}: {
  state: TranslationState
  onRetry?: () => void
}) {
  const t = useT()
  const setRoute = useApp((s) => s.setRoute)
  const code = state.error?.code
  const title =
    code === "needs-login"
      ? t("errNeedsLogin")
      : code === "held"
        ? t("errHeld")
        : code === "quota"
          ? t("errQuota")
          : code === "not-installed"
            ? t("errNotInstalled")
            : code === "network"
              ? t("errNetwork")
              : code === "auth"
                ? t("errAuth")
                : t("errUnknown")
  return (
    <Alert variant="destructive" className="glass-flat border-0">
      <TriangleAlertIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="break-words" dir="auto">
        {code === "held" ? (
          t("errHeldHint")
        ) : code === "quota" ? (
          <>
            {state.error?.message}
            <br />
            {t("errQuotaHint")}
          </>
        ) : (
          state.error?.message
        )}
      </AlertDescription>
      <AlertAction className="flex gap-1">
        {code === "needs-login" && state.engineId && (
          <Button size="xs" onClick={() => hz.engines.login(state.engineId!)}>
            <LogInIcon data-icon="inline-start" />
            {t("signIn")}
          </Button>
        )}
        {code === "held" && state.engineId && (
          <Button size="xs" onClick={() => hz.engines.login(state.engineId!)}>
            <AppWindowIcon data-icon="inline-start" />
            {t("openWindow")}
          </Button>
        )}
        {code === "not-installed" && state.engineId && (
          <Button size="xs" onClick={() => hz.engines.install(state.engineId!)}>
            <DownloadIcon data-icon="inline-start" />
            {t("install")}
          </Button>
        )}
        {code === "auth" && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => setRoute("settings")}
          >
            <KeyRoundIcon data-icon="inline-start" />
            {t("configure")}
          </Button>
        )}
        {onRetry && (
          <Button size="xs" variant="ghost" onClick={onRetry}>
            <RotateCcwIcon data-icon="inline-start" />
            {t("retry")}
          </Button>
        )}
      </AlertAction>
    </Alert>
  )
}

const TYPE_SCALE: Record<Layout, { main: string; popup: string }> = {
  dictionary: { main: "text-base", popup: "text-[15px]" },
  phrase: { main: "text-[1.45rem] leading-[1.75]", popup: "text-[1.15rem]" },
  text: { main: "text-[16px]", popup: "text-[15px]" },
  document: { main: "text-[15.5px]", popup: "text-[15px]" },
}

/**
 * The generative result surface. It picks a presentation from what the engine
 * produced — dictionary card, display-size phrase, structured reading view —
 * and mounts structured blocks progressively while the model is still writing.
 */
export function ResultSurface({
  state,
  model,
  size,
  targetLang,
  onRetry,
  empty,
}: {
  state: TranslationState
  model: ResultModel
  size: "popup" | "main"
  targetLang: string
  onRetry?: () => void
  empty?: React.ReactNode
}) {
  const t = useT()
  const req = state.request
  const sourceLang =
    state.detected ??
    (req?.sourceLang === "auto" ? "en" : (req?.sourceLang ?? "en"))
  const dir = isRtl(targetLang)
    ? "rtl"
    : model.plain
      ? textDir(model.plain)
      : "ltr"
  const streaming = state.status === "streaming"

  if (state.status === "idle") return <>{empty}</>
  if (state.status === "error")
    return <ErrorView state={state} onRetry={onRetry} />
  if (state.status === "waiting" || (!state.text && !state.dictionary))
    return <LoadingShape layout={model.layout} state={state} />

  // Dictionary card: Google's native data, or the model's word/sense blocks.
  if (state.dictionary) {
    return (
      <DictionaryView
        model={fromGoogle(state.dictionary)}
        sourceLang={sourceLang}
        targetLang={targetLang}
        size={size}
      />
    )
  }
  if (
    model.blocks &&
    model.layout === "dictionary" &&
    model.blocks.some((b) => b.t === "word" || b.t === "sense")
  ) {
    const rest = model.blocks.filter(
      (b) => !["word", "sense", "def", "ex", "syn"].includes(b.t)
    )
    return (
      <div className="flex flex-col gap-4">
        <DictionaryView
          model={fromBlocks(model.blocks, req?.text ?? "")}
          sourceLang={sourceLang}
          targetLang={targetLang}
          size={size}
          streaming={streaming}
        />
        {rest.map((b, i) => (
          <Appear key={i} index={i}>
            <BlockView block={b} size={size} />
          </Appear>
        ))}
      </div>
    )
  }

  const scale = TYPE_SCALE[model.layout][size]
  return (
    <motion.div
      layout="position"
      className={cn(
        "reading selectable flex flex-col gap-3",
        scale,
        model.layout === "document" && size === "main" && "mx-auto max-w-[72ch]"
      )}
      dir={dir}
    >
      {model.original && (
        <Appear>
          <BlockView block={{ t: "quote", text: model.original }} size={size} />
        </Appear>
      )}
      {model.blocks ? (
        model.blocks
          .filter((b) => b.t !== "quote" || b.text !== model.original)
          .map((b, i, arr) => (
            <Appear
              key={i}
              index={i}
              className={cn(
                streaming && i === arr.length - 1 && b.t === "p" && "caret"
              )}
            >
              <BlockView block={b} size={size} />
            </Appear>
          ))
      ) : model.layout === "document" || model.layout === "text" ? (
        <div className={cn(streaming && "caret")}>
          <Markdown text={model.plain} />
        </div>
      ) : (
        <p
          className={cn(
            "whitespace-pre-wrap",
            streaming && "caret",
            model.layout === "phrase" && "font-medium tracking-tight"
          )}
        >
          {model.plain}
        </p>
      )}
      {state.status === "done" && !model.plain.trim() && !model.original && (
        <p className="text-sm text-muted-foreground">{t("errUnknown")}</p>
      )}
    </motion.div>
  )
}
