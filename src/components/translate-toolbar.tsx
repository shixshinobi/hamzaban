import { ArrowLeftRightIcon, SparklesIcon } from "lucide-react"
import { motion } from "motion/react"
import { useState, type ReactNode } from "react"
import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { EnginePicker, LanguagePicker, StylePicker } from "@/components/pickers"
import { GlassPanel } from "@/components/glass/glass-panel"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { useApp, useActiveEngine } from "@/lib/store"
import { cn } from "@/lib/utils"

/** Language pair, engine, style and smart-layout controls shared by every translate screen. */
export function TranslateToolbar({
  detected,
  children,
}: {
  detected?: string | null
  children?: ReactNode
}) {
  const t = useT()
  const settings = useApp((s) => s.settings!)
  const update = useApp((s) => s.update)
  const engine = useActiveEngine()
  const isLlm = engine.kind !== "google"
  const [spin, setSpin] = useState(0)

  const swap = () => {
    const src =
      settings.sourceLang === "auto"
        ? (detected ?? settings.secondaryLang)
        : settings.sourceLang
    void update({ sourceLang: settings.targetLang, targetLang: src })
    setSpin((n) => n + 1)
  }

  const smart = settings.smartLayout && isLlm
  return (
    <GlassPanel className="flex h-12 shrink-0 items-center gap-1 rounded-[20px] px-2">
      <LanguagePicker
        value={settings.sourceLang}
        onChange={(sourceLang) => void update({ sourceLang })}
        allowAuto
        detected={detected}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={swap}
              aria-label={t("swap")}
            />
          }
        >
          <motion.span
            animate={{ rotate: spin * 180 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex"
          >
            <ArrowLeftRightIcon />
          </motion.span>
        </TooltipTrigger>
        <TooltipContent>{t("swap")}</TooltipContent>
      </Tooltip>
      <LanguagePicker
        value={settings.targetLang}
        onChange={(targetLang) => void update({ targetLang })}
      />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <EnginePicker
        value={settings.activeEngineId}
        onChange={(activeEngineId) => void update({ activeEngineId })}
      />
      <StylePicker
        value={settings.activeStyleId}
        onChange={(activeStyleId) => void update({ activeStyleId })}
        disabled={!isLlm}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              size="sm"
              pressed={smart}
              disabled={!isLlm}
              onPressedChange={(smartLayout) => void update({ smartLayout })}
              aria-label={t("smartLayout")}
              // On, it reads as lit: tinted with the accent and outlined; off, it fades.
              className={cn(
                "transition-colors",
                smart
                  ? "bg-primary/15 text-primary ring-1 ring-primary/40 hover:bg-primary/20 hover:text-primary aria-pressed:bg-primary/15"
                  : "text-muted-foreground"
              )}
            />
          }
        >
          <SparklesIcon
            data-icon="inline-start"
            className={cn(
              smart ? "fill-primary/40 text-primary" : "opacity-60"
            )}
          />
          <span className="hidden lg:inline">{t("smartLayout")}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          {isLlm ? t("smartLayoutHint") : t("styleGoogleNote")}
        </TooltipContent>
      </Tooltip>
      <div className="flex-1" />
      {children}
    </GlassPanel>
  )
}
