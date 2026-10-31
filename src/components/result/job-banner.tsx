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

/** The time now, refreshed every `ms` while mounted (for smooth movement). */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/** Where a running translation is, for a page or picture waiting on it. */
export interface JobProgress {
  startedAt: number
  stage?: {
    stage: JobStage
    detail?: string
    /** Seconds the step may take before it is given up. */
    limit?: number
    /** When the step began. */
    at?: number
  }
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
 * One quiet line for a page being translated: a ring that fills as the wait runs out
 * (the seconds inside it), and what is happening, or a word of patience when the model
 * is slow to start or slow to write. It sits beside a heading and never covers the page.
 */
export function JobStatus({
  job,
  className,
}: {
  job: JobProgress
  className?: string
}) {
  const t = useT()
  const ui = useUiLang()
  const fmt = new Intl.NumberFormat(ui === "fa" ? "fa-IR" : "en")
  const { stage } = job
  // While waiting for an answer, the step's own limit is what the ring counts down.
  const limit = !job.receiving && !job.label ? stage?.limit : undefined
  const seconds = useElapsed(
    limit ? (stage?.at ?? job.startedAt) : job.startedAt
  )
  const total = useElapsed(job.startedAt)
  // The fuse burns smoothly, not a step a second.
  const now = useNow(200)
  const burnt = limit
    ? Math.min(1, (now - (stage?.at ?? job.startedAt)) / 1000 / limit)
    : null
  const label = job.label
    ? t(job.label)
    : job.receiving
      ? t("stageWriting")
      : stage
        ? stage.stage === "waiting"
          ? `${t("stageWaiting")} (${fmt.format(Number(stage.detail ?? 0))} ${t("secondsShort")})`
          : `${t(STAGE_LABEL[stage.stage])}${stage.detail ? ` ${stage.detail}` : ""}`
        : t("translating")
  // The row is narrow: a short word of patience, the whole of it on hover.
  const slow = job.label
    ? null
    : !job.receiving && total >= SLOW_START
      ? (["slowStartShort", "slowStart"] as const)
      : job.receiving && total >= SLOW_STREAM
        ? (["slowStreamShort", "slowStream"] as const)
        : null
  const text = slow ? t(slow[0]) : label
  const full = slow ? t(slow[1]) : label
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 text-xs text-muted-foreground",
        className
      )}
      aria-busy
      aria-live="polite"
      title={
        limit
          ? `${full} · ${fmt.format(seconds)} / ${fmt.format(limit)} ${t("secondsShort")}`
          : full
      }
    >
      <span className="truncate">{text}</span>
      <Ring burnt={burnt} value={fmt.format(limit ? seconds : total)} />
    </div>
  )
}

/**
 * A small ring around a number. With a known limit it is a fuse: full at the start,
 * burning down clockwise with a spark at the burning end, so what is left of the wait
 * shows at a glance. Without one (`burnt` null), a short arc turns.
 */
function Ring({ burnt, value }: { burnt: number | null; value: string }) {
  const r = 10
  const c = 2 * Math.PI * r
  const left = burnt === null ? 0.25 : 1 - burnt
  // Where the fuse burns, on the ring drawn from the top (the svg is turned a quarter).
  const angle = (burnt ?? 0) * 2 * Math.PI
  const tip = { x: 12 + r * Math.cos(angle), y: 12 + r * Math.sin(angle) }
  return (
    <span className="relative inline-flex size-6 shrink-0 items-center justify-center">
      <svg
        viewBox="0 0 24 24"
        overflow="visible"
        className={cn(
          "absolute inset-0 -rotate-90",
          burnt === null && "animate-spin [animation-duration:2s]"
        )}
        aria-hidden
      >
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          strokeWidth="2"
          className="stroke-foreground/10"
        />
        {/* What is left: from the burning end round to the top. */}
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className="stroke-foreground/45"
          strokeDasharray={`${c * left} ${c}`}
          strokeDashoffset={burnt === null ? 0 : -c * burnt}
        />
        {burnt !== null && burnt < 1 && (
          <g transform={`translate(${tip.x} ${tip.y})`} className="hz-spark">
            <circle r="2.6" className="hz-spark-glow" />
            <circle r="1.1" className="hz-spark-core" />
            {[0, 1, 2, 3].map((k) => (
              <line
                key={k}
                x1="0"
                y1="0"
                x2="0"
                y2="-3"
                className="hz-spark-ray"
                style={{
                  transform: `rotate(${k * 90 + 45}deg)`,
                  animationDelay: `${k * 0.12}s`,
                }}
              />
            ))}
          </g>
        )}
      </svg>
      <span className="text-[9px] leading-none tabular-nums">{value}</span>
    </span>
  )
}
