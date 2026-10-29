import { StrictMode, useEffect } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import { LiquidFilter } from "@/components/glass/liquid-filter"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { hz } from "@/lib/hz"
import { useApp } from "@/lib/store"
import { applyAppearance, useThemeClass } from "@/lib/theme"
import { Capture } from "@/views/capture"
import { MainWindow } from "@/views/main-window"
import { Popup } from "@/views/popup"

const route = window.location.hash.replace("#", "") || "main"

function Root() {
  useThemeClass()
  const settings = useApp((s) => s.settings)
  const platform = useApp((s) => s.platform)

  useEffect(() => {
    void useApp.getState().init()
    return hz.app.onPlatform((p) => useApp.setState({ platform: p }))
  }, [])

  useEffect(() => {
    const html = document.documentElement
    const lang = settings?.uiLanguage ?? "fa"
    html.lang = lang
    html.dir = lang === "fa" ? "rtl" : "ltr"
    html.dataset.os = platform?.os ?? ""
    html.dataset.material = platform?.material ?? "none"
    html.dataset.window = route
  }, [settings?.uiLanguage, platform])

  useEffect(() => {
    if (settings) applyAppearance(settings)
  }, [settings])

  if (route === "capture") return <Capture />
  if (!settings || !platform) return null

  return (
    <TooltipProvider delay={500}>
      <LiquidFilter />
      {route === "popup" ? <Popup /> : <MainWindow />}
      <Toaster position="bottom-center" />
    </TooltipProvider>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
