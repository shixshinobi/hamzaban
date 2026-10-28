import { CheckIcon, CopyIcon, RotateCcwIcon, Volume2Icon } from "lucide-react"
import { useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { EngineGlyph, StatusDot } from "@/components/pickers"
import { hz } from "@/lib/hz"
import { useT } from "@/lib/i18n"
import { speak } from "@/lib/speech"
import { useApp, useEnabledEngines } from "@/lib/store"
import { cn } from "@/lib/utils"

export function IconAction({
  label,
  onClick,
  children,
  disabled,
  shortcut,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  shortcut?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ms-2 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

export function CopyAction({ text }: { text: string }) {
  const t = useT()
  const [done, setDone] = useState(false)
  return (
    <IconAction
      label={done ? t("copied") : t("copy")}
      disabled={!text}
      onClick={() => {
        void hz.clipboard.write(text)
        setDone(true)
        setTimeout(() => setDone(false), 1200)
      }}
    >
      {done ? <CheckIcon className="text-success" /> : <CopyIcon />}
    </IconAction>
  )
}

export function ResultActions({
  text,
  lang,
  onRetry,
  children,
}: {
  text: string
  lang: string
  onRetry?: () => void
  children?: ReactNode
}) {
  const t = useT()
  return (
    <div className="flex items-center gap-0.5">
      <CopyAction text={text} />
      <IconAction
        label={t("listen")}
        disabled={!text}
        onClick={() => speak(text, lang)}
      >
        <Volume2Icon />
      </IconAction>
      {onRetry && (
        <IconAction label={t("retry")} onClick={onRetry}>
          <RotateCcwIcon />
        </IconAction>
      )}
      {children}
    </div>
  )
}

/** QTranslate-style engine switcher: one click re-runs the same text on another engine. */
/** Quick engine switch under a result. It changes the same active engine as the toolbar picker. */
export function EngineChips({
  onPick,
  className,
}: {
  onPick?: (id: string) => void
  className?: string
}) {
  const engines = useEnabledEngines()
  const statuses = useApp((s) => s.statuses)
  const current = useApp((s) => s.settings!.activeEngineId)
  const update = useApp((s) => s.update)
  return (
    <div
      className={cn(
        "flex [scrollbar-width:none] items-center gap-1 overflow-x-auto",
        className
      )}
    >
      {engines.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => {
            if (e.id !== current) void update({ activeEngineId: e.id })
            onPick?.(e.id)
          }}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition",
            "hover:bg-accent hover:text-foreground",
            e.id === current && "glass-flat text-foreground"
          )}
        >
          <EngineGlyph engine={e} className="size-3.5" />
          {e.name}
          <StatusDot status={statuses[e.id]} />
        </button>
      ))}
    </div>
  )
}
