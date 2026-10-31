import { useSyncExternalStore } from "react"

/* Whether the comparison picker shows the original look: the interface exactly as it
   was on main before the polish. Each polished spot asks this and falls back to its
   old value. Only the picker (development builds) ever sets it; delete this file with
   the rest of the folder once a look is chosen. */

const listeners = new Set<() => void>()
let observer: MutationObserver | null = null

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!observer) {
    observer = new MutationObserver(() => listeners.forEach((l) => l()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-look"],
    })
  }
  return () => {
    listeners.delete(cb)
    if (!listeners.size) {
      observer?.disconnect()
      observer = null
    }
  }
}

const isOriginal = () => document.documentElement.dataset.look === "original"

export function useOriginalLook() {
  return useSyncExternalStore(subscribe, isOriginal)
}

/** `classes` with each polished piece swapped back for the one it replaced. */
export function asOriginal(classes: string, swaps: [string, string][]) {
  return swaps.reduce((s, [polished, old]) => s.replace(polished, old), classes)
}
