import { useEffect, useState } from "react"
import type { Settings } from "@shared/types"

/** Accent color, glass transparency and blur, as CSS on the root element. */
export function applyAppearance(
  s: Partial<Pick<Settings, "accent" | "backdrop" | "transparency" | "blur">>
) {
  const html = document.documentElement
  if (s.accent) html.dataset.accent = s.accent
  if (s.backdrop) html.dataset.backdrop = s.backdrop
  if (s.transparency !== undefined) {
    // 50 is the designed look; lower goes towards opaque, higher towards clear glass.
    const t = s.transparency
    const factor =
      t <= 50 ? 1 + ((50 - t) / 50) * 1.4 : 1 - ((t - 50) / 50) * 0.7
    html.style.setProperty("--surface-o", factor.toFixed(3))
  }
  if (s.blur !== undefined)
    html.style.setProperty("--glass-blur", `${s.blur}px`)
}

const QUERY = "(prefers-color-scheme: dark)"

/**
 * The main process sets nativeTheme.themeSource from settings, which drives
 * prefers-color-scheme in every window, so following the media query is enough.
 */
export function useDarkMode() {
  const [dark, setDark] = useState(() => window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = () => setDark(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return dark
}

export function useThemeClass() {
  const dark = useDarkMode()
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])
}
