import { useEffect, useState } from "react"
import type { EngineUsage } from "@shared/types"
import { hz } from "./hz"

/** Each API engine's usage, kept up to date as requests finish. */
export function useUsage() {
  const [usage, setUsage] = useState<Record<string, EngineUsage>>({})
  useEffect(() => {
    let live = true
    void hz.usage.get().then((u) => live && setUsage(u))
    const off = hz.usage.onChange(setUsage)
    return () => {
      live = false
      off()
    }
  }, [])
  return usage
}
