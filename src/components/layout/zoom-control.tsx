import { ZoomInIcon, ZoomOutIcon } from "lucide-react"
import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { useT, useUiLang } from "@/lib/i18n"

const STEPS = [0.4, 0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]

function read(key: string) {
  try {
    const v = Number(localStorage.getItem(key))
    return STEPS.includes(v) ? v : 1
  } catch {
    return 1
  }
}

/** A zoom level from STEPS, remembered per view on this computer. */
export function useZoom(key: string) {
  const [zoom, setZoom] = useState(() => read(key))
  const set = useCallback(
    (v: number) => {
      setZoom(v)
      try {
        localStorage.setItem(key, String(v))
      } catch {
        // A zoom that is not remembered is still applied.
      }
    },
    [key]
  )
  /** One step in or out: +1 or -1. */
  const step = useCallback(
    (dir: 1 | -1) =>
      setZoom((cur) => {
        const i = STEPS.indexOf(cur)
        const next = STEPS[Math.min(STEPS.length - 1, Math.max(0, i + dir))]
        try {
          localStorage.setItem(key, String(next))
        } catch {
          // as above
        }
        return next
      }),
    [key]
  )
  /**
   * Ctrl + wheel over the element zooms, as in a browser. A native listener, because
   * React's wheel listeners are passive and could not stop the window zooming instead.
   */
  const wheelRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return
      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey) return
        e.preventDefault()
        step(e.deltaY < 0 ? 1 : -1)
      }
      el.addEventListener("wheel", onWheel, { passive: false })
      return () => el.removeEventListener("wheel", onWheel)
    },
    [step]
  )
  return { zoom, set, step, wheelRef }
}

export function ZoomControl({
  zoom,
  onStep,
  onReset,
}: {
  zoom: number
  onStep: (dir: 1 | -1) => void
  onReset: () => void
}) {
  const t = useT()
  const ui = useUiLang()
  return (
    <ButtonGroup>
      <Button
        size="icon-sm"
        variant="outline"
        aria-label={t("zoomOut")}
        disabled={zoom <= STEPS[0]}
        onClick={() => onStep(-1)}
      >
        <ZoomOutIcon />
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="min-w-14 tabular-nums"
        aria-label={t("zoomReset")}
        onClick={onReset}
      >
        {ui === "fa"
          ? `${Math.round(zoom * 100).toLocaleString("fa-IR")}٪`
          : `${Math.round(zoom * 100)}%`}
      </Button>
      <Button
        size="icon-sm"
        variant="outline"
        aria-label={t("zoomIn")}
        disabled={zoom >= STEPS[STEPS.length - 1]}
        onClick={() => onStep(1)}
      >
        <ZoomInIcon />
      </Button>
    </ButtonGroup>
  )
}
