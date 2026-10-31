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
    <GlassPanel
      data-part="toolbar"
      className="flex h-12 shrink-0 items-center gap-1 rounded-[20px] px-2"
    >
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
              // On: the text in full colour and the icon lit with the accent. Off: faded
              // well back, so the two states cannot be mistaken.
              className={cn(
                "transition-[color,opacity]",
                smart
                  ? // Hovered, it shows as a button like its neighbours, so it reads as
                    // something to click to turn it off.
                    "text-foreground aria-pressed:bg-transparent aria-pressed:hover:bg-muted"
                  : "text-muted-foreground opacity-45 hover:opacity-80"
              )}
            />
          }
        >
          <SparklesIcon
            data-icon="inline-start"
            className={cn(smart && "fill-primary/40 text-primary")}
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
