import { useEffect, useState } from "react"

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
