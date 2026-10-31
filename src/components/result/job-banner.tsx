import { HourglassIcon, SparklesIcon } from "lucide-react"
import { useEffect, useState } from "react"
import type { JobStage } from "@shared/types"
import { useT, useUiLang, type StringKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const STAGE_LABEL: Record<JobStage, StringKey> = {
  sending: "stageSending",
  thinking: "stageThinking",
  retrying: "stageRetrying",
  waiting: "stageWaiting",
  opening: "stageOpening",
  attaching: "stageAttaching",
}

/** Seconds since `since`, ticking once a second while mounted. */
export function useElapsed(since: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return since ? Math.max(0, Math.floor((now - since) / 1000)) : 0
}

/** Where a running translation is, for a page or picture waiting on it. */
export interface JobProgress {
  startedAt: number
  stage?: { stage: JobStage; detail?: string }
  /** Text has started to arrive. */
  receiving: boolean
  /** e.g. "reading the layout"; shown instead of the request's stage. */
  label?: StringKey
}

/** No answer yet after this long: free services are often busy. */
const SLOW_START = 20
/** Still writing after this long: the answer is coming, only slowly. */
const SLOW_STREAM = 30

/**
 * A banner over a page being translated: what is happening, for how long, and a word
 * of patience when the model is slow to start or slow to write. Laid over a white page,
 * it takes a solid background (via className) so it stays readable.
 */
export function JobBanner({
  job,
  className,
}: {
  job: JobProgress
  className?: string
}) {
  const t = useT()
  const ui = useUiLang()
  const seconds = useElapsed(job.startedAt)
  const fmt = new Intl.NumberFormat(ui === "fa" ? "fa-IR" : "en")
  const { stage } = job
  const label = job.label
    ? t(job.label)
    : job.receiving
      ? t("stageWriting")
      : stage
        ? stage.stage === "waiting"
          ? `${t("stageWaiting")} (${fmt.format(Number(stage.detail ?? 0))} ${t("secondsShort")})`
          : `${t(STAGE_LABEL[stage.stage])}${stage.detail ? ` ${stage.detail}` : ""}`
        : t("translating")
  const hint = job.label
    ? null
    : !job.receiving && seconds >= SLOW_START
      ? t("slowStart")
      : job.receiving && seconds >= SLOW_STREAM
        ? t("slowStream")
        : null
  return (
    <div
      className={cn(
        "glass glass-strong flex flex-col gap-2 rounded-xl px-3 py-2.5",
        className
      )}
      aria-busy
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm">
        <SparklesIcon className="size-3.5 shrink-0 text-primary" />
        <span className="shimmer-text min-w-0 truncate font-medium">
          {label}
        </span>
        {seconds >= 2 && (
          <span className="ms-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {fmt.format(seconds)} {t("secondsShort")}
          </span>
        )}
      </div>
      <div className="indeterminate h-0.5 overflow-hidden rounded-full bg-muted" />
      {hint && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <HourglassIcon className="mt-0.5 size-3 shrink-0" />
          {hint}
        </p>
      )}
    </div>
  )
}
