import { useEffect, useRef } from "react"
import { hz } from "@/lib/hz"

/** Chromium's work-area origin, used only to notice a move to another display. */
type ScreenWithOrigin = Screen & { availLeft?: number; availTop?: number }

/**
 * Live blur: a capture of the display behind the window, lined up with the window and
 * blurred by the blur setting. The window is left out of screen capture (main process),
 * so the picture never contains itself. Capture stops while the window is hidden and
 * restarts when the window moves to another display.
 */
export function LiveBackdrop() {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const scr = window.screen as ScreenWithOrigin
    let stream: MediaStream | null = null
    let disposed = false
    let raf = 0
    let display = ""
    let placed = ""

    const stop = () => {
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
    }
    const start = async () => {
      stop()
      if (document.hidden) return
      try {
        const s = await navigator.mediaDevices.getDisplayMedia({
          // Windows' capture tops out near 25 fps anyway, so asking for more only costs.
          video: { frameRate: 30 },
          audio: false,
        })
        if (disposed || document.hidden) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (ref.current) ref.current.srcObject = s
        // The capture ends if the display goes away; pick up the new one.
        s.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (!disposed && stream === s) setTimeout(() => void start(), 1000)
        })
      } catch {
        // Refused or unsupported: the tint layer alone remains, like the clear material.
      }
    }

    // The page only knows the display's work area, which starts below a top taskbar,
    // so the display's own bounds come from the main process.
    let bounds = { x: 0, y: 0, width: scr.width, height: scr.height }
    const measure = () =>
      hz.app.displayBounds().then((b) => {
        bounds = b
        placed = ""
      })

    // Follow the window every frame, so dragging it keeps the picture in place.
    const tick = () => {
      const v = ref.current
      if (v) {
        const key = `${scr.availLeft},${scr.availTop},${scr.width},${scr.height}`
        if (key !== display) {
          const moved = !!display
          display = key
          // Moved to another display: its bounds and its capture are both new.
          void measure().then(() => {
            if (moved) void start()
          })
        }
        const dx = bounds.x - window.screenX
        const dy = bounds.y - window.screenY
        const next = `${bounds.width}|${bounds.height}|${dx}|${dy}`
        if (next !== placed) {
          placed = next
          v.style.width = `${bounds.width}px`
          v.style.height = `${bounds.height}px`
          v.style.transform = `translate(${dx}px, ${dy}px)`
        }
      }
      raf = requestAnimationFrame(tick)
    }

    const onVisibility = () => (document.hidden ? stop() : void start())
    document.addEventListener("visibilitychange", onVisibility)
    void start()
    raf = requestAnimationFrame(tick)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      document.removeEventListener("visibilitychange", onVisibility)
      stop()
    }
  }, [])

  return (
    <div className="live-backdrop" aria-hidden>
      <video ref={ref} autoPlay muted playsInline />
    </div>
  )
}
