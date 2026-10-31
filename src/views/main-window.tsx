import {
  FeatherIcon,
  FileTextIcon,
  HistoryIcon,
  LanguagesIcon,
  ScanTextIcon,
  Settings2Icon,
  type LucideIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { lazy, Suspense, useEffect, useState } from "react"
import { toast } from "sonner"
import { LiveBackdrop } from "@/components/glass/live-backdrop"
import { Logo } from "@/components/logo"
import { WindowControls } from "@/components/glass/window-controls"
import { Kbd } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { hz } from "@/lib/hz"
import { useT, type StringKey } from "@/lib/i18n"
import { useApp, type Route } from "@/lib/store"
import { cn } from "@/lib/utils"
import { useOriginalLook } from "@/prototype/look"
import { HistoryView } from "./history-view"
import { ImageView } from "./image-view"
import { Onboarding } from "./onboarding"
import { PdfView } from "./pdf-view"
import { SettingsView } from "./settings-view"
import { StylesView } from "./styles-view"
import { TranslateView } from "./translate-view"
import { formatAccel } from "./shortcut-recorder"

const NAV: { id: Route; icon: LucideIcon; label: StringKey }[] = [
  { id: "translate", icon: LanguagesIcon, label: "navTranslate" },
  { id: "image", icon: ScanTextIcon, label: "navImage" },
  { id: "pdf", icon: FileTextIcon, label: "navPdf" },
  { id: "styles", icon: FeatherIcon, label: "navStyles" },
  { id: "history", icon: HistoryIcon, label: "navHistory" },
]

function NavButton({
  id,
  icon: Icon,
  label,
  active,
}: {
  id: Route
  icon: LucideIcon
  label: StringKey
  active: boolean
}) {
  const t = useT()
  const setRoute = useApp((s) => s.setRoute)
  const original = useOriginalLook()
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={() => setRoute(id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              original
                ? "relative flex size-11 flex-col items-center justify-center gap-0.5 rounded-[18px] text-muted-foreground transition-colors outline-none"
                : "relative flex size-11 flex-col items-center justify-center gap-0.5 rounded-[18px] text-muted-foreground transition-[color,scale] duration-150 ease-(--ease-out) outline-none active:scale-[0.96]",
              "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              active && "text-foreground"
            )}
          />
        }
      >
        {active && (
          <motion.span
            layoutId="nav-drop"
            className="glass glass-strong liquid absolute inset-0 rounded-[18px]"
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 34,
              mass: 0.9,
            }}
          />
        )}
        <Icon
          className={cn(
            "relative size-[19px] transition-transform",
            active && "scale-105 text-primary"
          )}
          strokeWidth={active ? 2.1 : 1.8}
        />
        <span
          className={
            original
              ? "relative text-[10px] leading-none font-medium"
              : "relative text-[11px] leading-none font-medium"
          }
        >
          {t(label)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="inline-start">{t(label)}</TooltipContent>
    </Tooltip>
  )
}

function headerInset(os?: string): React.CSSProperties {
  if (os === "darwin") return { paddingInlineStart: 0, paddingLeft: 84 }
  if (os === "win32")
    return {
      paddingRight:
        "calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw) + 8px)",
    }
  return {}
}

const KEPT: Route[] = ["translate", "image", "pdf"]

// The picker for the looks being compared on this branch; development builds only.
const LookPicker = import.meta.env.DEV
  ? lazy(() => import("@/prototype/look-picker"))
  : null

/* Switching pages happens many times a day: a short fade that only keeps the change
   from looking like a flash. Opacity alone, so the glass panels are not re-rasterised
   at every frame of a scale, and the old page leaves faster than the new one arrives
   (the two overlap instead of waiting on each other). */
const PAGE_IN = { duration: 0.16, ease: [0.23, 1, 0.32, 1] } as const
const PAGE_OUT = { duration: 0.1, ease: [0.23, 1, 0.32, 1] } as const
// The page change as it was on main, for the original look of the comparison picker.
const ORIGINAL_PAGE = { duration: 0.22, ease: [0.22, 1, 0.36, 1] } as const

export function MainWindow() {
  const t = useT()
  const route = useApp((s) => s.route)
  const [visited, setVisited] = useState<Route[]>([route])
  if (KEPT.includes(route) && !visited.includes(route))
    setVisited([...visited, route])
  const setRoute = useApp((s) => s.setRoute)
  const os = useApp((s) => s.platform?.os)
  const live = useApp((s) => s.platform?.material === "live")
  const settings = useApp((s) => s.settings!)
  const refreshStatus = useApp((s) => s.refreshStatus)
  const original = useOriginalLook()

  useEffect(() => {
    void refreshStatus()
    const offNav = hz.app.onNav((r) => setRoute(r as Route))
    const offConflict = hz.shortcuts.onConflict((actions) =>
      toast.warning(t("shortcutConflict"), { description: actions.join("، ") })
    )
    // Rounded corners are drawn by the page for transparent windows (see index.css).
    const offMax = hz.app.onMaximized((max) =>
      document.documentElement.toggleAttribute("data-maximized", max)
    )
    return () => {
      offNav()
      offConflict()
      offMax()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="window-shell flex flex-col">
      {live && <LiveBackdrop />}
      <div className="aurora" />
      <header
        className="drag flex h-12 shrink-0 items-center gap-3 px-4"
        style={headerInset(os)}
      >
        <div className="flex items-center gap-2">
          <Logo className="size-6" />
          <span className="text-[15px] font-semibold tracking-tight">
            {t("appName")}
          </span>
        </div>
        <div className="flex-1" />
        <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <span>{t("scTranslateSelection")}</span>
          <Kbd dir="ltr">
            {formatAccel(settings.shortcuts.translateSelection, os)}
          </Kbd>
        </div>
        <WindowControls />
      </header>

      <div className="flex min-h-0 flex-1 gap-3 px-3 pb-3">
        <nav className="glass flex w-[60px] shrink-0 flex-col items-center gap-1 rounded-[26px] p-2">
          {NAV.map((n) => (
            <NavButton key={n.id} {...n} active={route === n.id} />
          ))}
          <div className="flex-1" />
          <NavButton
            id="settings"
            icon={Settings2Icon}
            label="navSettings"
            active={route === "settings"}
          />
        </nav>

        <main className="relative min-w-0 flex-1">
          {/* Work pages stay mounted once opened, so a loaded PDF, an image and their
              translations (even one still running) survive a visit to another page.
              No `filter` in these transitions: an ancestor with one cuts every panel's
              backdrop blur off from the background, and the blur setting stops working. */}
          {KEPT.filter((r) => visited.includes(r)).map((r) => (
            <motion.div
              key={r}
              className="absolute inset-0"
              hidden={route !== r}
              inert={route !== r}
              initial={false}
              animate={
                original
                  ? route === r
                    ? { opacity: 1, scale: 1 }
                    : { opacity: 0, scale: 0.985 }
                  : { opacity: route === r ? 1 : 0 }
              }
              transition={original ? ORIGINAL_PAGE : PAGE_IN}
            >
              {r === "translate" && <TranslateView />}
              {r === "image" && <ImageView />}
              {r === "pdf" && <PdfView />}
            </motion.div>
          ))}
          <AnimatePresence mode={original ? "wait" : undefined} initial={false}>
            {!KEPT.includes(route) && (
              <motion.div
                key={route}
                className="absolute inset-0"
                {...(original
                  ? {
                      initial: { opacity: 0, scale: 0.985 },
                      animate: { opacity: 1, scale: 1 },
                      exit: { opacity: 0, scale: 0.99 },
                      transition: ORIGINAL_PAGE,
                    }
                  : {
                      initial: { opacity: 0 },
                      animate: { opacity: 1, transition: PAGE_IN },
                      exit: { opacity: 0, transition: PAGE_OUT },
                    })}
              >
                {route === "styles" && <StylesView />}
                {route === "history" && <HistoryView />}
                {route === "settings" && <SettingsView />}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      {!settings.onboarded && <Onboarding />}
      {LookPicker && (
        <Suspense>
          <LookPicker />
        </Suspense>
      )}
    </div>
  )
}
