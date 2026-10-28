import { useMemo } from "react"
import { create } from "zustand"
import type {
  EngineStatus,
  Platform,
  PopupPayload,
  Settings,
} from "@shared/types"
import { hz } from "./hz"

export type Route =
  "translate" | "image" | "pdf" | "styles" | "history" | "settings"

interface AppState {
  settings: Settings | null
  platform: Platform | null
  route: Route
  statuses: Record<string, EngineStatus | undefined>
  /** Work handed over from the popup / history to the main window views. */
  pending: PopupPayload | null
  setPending: (p: PopupPayload | null) => void
  setRoute: (r: Route) => void
  update: (patch: Partial<Settings>) => Promise<void>
  refreshStatus: (id?: string) => Promise<void>
  init: () => Promise<void>
}

export const useApp = create<AppState>((set, get) => ({
  settings: null,
  platform: null,
  route: "translate",
  statuses: {},
  pending: null,
  setPending: (pending) => set({ pending }),
  setRoute: (route) => set({ route }),
  update: async (patch) => {
    const current = get().settings
    if (current) set({ settings: { ...current, ...patch } })
    const next = await hz.settings.update(patch)
    set({ settings: next })
  },
  refreshStatus: async (id) => {
    const ids = id
      ? [id]
      : (get()
          .settings?.engines.filter((e) => e.enabled)
          .map((e) => e.id) ?? [])
    await Promise.all(
      ids.map(async (eid) => {
        set((s) => ({ statuses: { ...s.statuses, [eid]: undefined } }))
        const st = await hz.engines
          .status(eid)
          .catch(() => ({ id: eid, ok: false }))
        set((s) => ({ statuses: { ...s.statuses, [eid]: st } }))
      })
    )
  },
  init: async () => {
    const [settings, platform] = await Promise.all([
      hz.settings.get(),
      hz.app.platform(),
    ])
    set({ settings, platform })
    hz.settings.onChange((s) => set({ settings: s }))
    hz.engines.onChange(() => void get().refreshStatus())
    hz.app.onTranslate((p) =>
      set({ pending: p, route: p.image ? "image" : "translate" })
    )
  },
}))

export function useSettings() {
  return useApp((s) => s.settings!)
}

/** Enabled engines; memoised so the selector returns a stable array. */
export function useEnabledEngines() {
  const engines = useApp((s) => s.settings!.engines)
  return useMemo(() => engines.filter((e) => e.enabled), [engines])
}

export function useActiveEngine() {
  return useApp(
    (s) =>
      s.settings!.engines.find((e) => e.id === s.settings!.activeEngineId) ??
      s.settings!.engines[0]
  )
}
