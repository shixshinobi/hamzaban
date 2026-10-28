import { ScanTextIcon } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { Kbd } from "@/components/ui/kbd"
import { hz } from "@/lib/hz"
import { useT } from "@/lib/i18n"

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Full-screen overlay over a frozen screenshot; drag a rectangle to translate it. */
export function Capture() {
  const t = useT()
  const [shot, setShot] = useState<{ dataUrl: string; scale: number } | null>(
    null
  )
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    void hz.capture.shot().then(setShot)
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && hz.capture.cancel()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const finish = (r: Rect) => {
    const img = imgRef.current
    if (!img || !shot || r.w < 6 || r.h < 6) {
      setRect(null)
      return
    }
    // The screenshot is captured at device-pixel resolution; crop in those pixels.
    const sx = img.naturalWidth / window.innerWidth
    const sy = img.naturalHeight / window.innerHeight
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(r.w * sx)
    canvas.height = Math.round(r.h * sy)
    canvas
      .getContext("2d")!
      .drawImage(
        img,
        r.x * sx,
        r.y * sy,
        r.w * sx,
        r.h * sy,
        0,
        0,
        canvas.width,
        canvas.height
      )
    hz.capture.done(canvas.toDataURL("image/png"))
  }

  return (
    <div
      className="fixed inset-0 cursor-crosshair select-none"
      onContextMenu={(e) => {
        e.preventDefault()
        hz.capture.cancel()
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        setStart({ x: e.clientX, y: e.clientY })
        setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 })
      }}
      onPointerMove={(e) => {
        if (!start) return
        setRect({
          x: Math.min(start.x, e.clientX),
          y: Math.min(start.y, e.clientY),
          w: Math.abs(e.clientX - start.x),
          h: Math.abs(e.clientY - start.y),
        })
      }}
      onPointerUp={() => {
        setStart(null)
        if (rect) finish(rect)
      }}
    >
      {shot && (
        <img
          ref={imgRef}
          src={shot.dataUrl}
          alt=""
          className="pointer-events-none absolute inset-0 size-full"
          draggable={false}
        />
      )}
      {/* Dim everything except the selection using a giant box-shadow. */}
      {rect && rect.w > 0 ? (
        <div
          className="pointer-events-none absolute rounded-md ring-2 ring-white/90"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.w,
            height: rect.h,
            boxShadow:
              "0 0 0 100vmax oklch(0.1 0.01 265 / 0.55), 0 0 30px oklch(0.7 0.15 255 / 0.6)",
          }}
        >
          <span
            className="absolute start-0 -top-7 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white"
            dir="ltr"
          >
            {Math.round(rect.w)} × {Math.round(rect.h)}
          </span>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[oklch(0.1_0.01_265/0.45)]" />
      )}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: start ? 0 : 1, y: 0 }}
        className="glass glass-strong pointer-events-none absolute top-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm"
      >
        <ScanTextIcon className="size-4 text-primary" />
        <span>{t("captureHint")}</span>
        <Kbd>Esc</Kbd>
      </motion.div>
    </div>
  )
}
