import { useEffect, useLayoutEffect, useRef, useState } from "react"
import "./looks.css"

/* The looks being compared: the interface exactly as it was on main, the same after
   the polish (what this branch ships), and two directions built on top of it. */
const LOOKS = [
  { id: "original", label: "ظاهر قبلی" },
  { id: "current", label: "ظاهر فعلی، صیقل‌خورده" },
  { id: "structure", label: "ساختار نو، با شیشه" },
  { id: "flat", label: "تخت" },
] as const

function initial() {
  const v = Number(new URLSearchParams(location.search).get("v"))
  // Without a choice in the address, the polished look this branch ships.
  return v >= 1 && v <= LOOKS.length ? v - 1 : 1
}

/**
 * A floating picker to flip between prototype looks (development only). Keys 1-3 and
 * the arrows switch; the choice survives a reload through `?v=` in the address.
 */
export default function LookPicker() {
  const [current, setCurrent] = useState(initial)
  const [ready, setReady] = useState(false)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const highlight = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const move = () => {
      const el = items.current[current]
      if (!el || !highlight.current) return
      highlight.current.style.width = `${el.offsetWidth}px`
      highlight.current.style.transform = `translateX(${el.offsetLeft}px)`
    }
    move()
    window.addEventListener("resize", move)
    return () => window.removeEventListener("resize", move)
  }, [current])

  useEffect(() => {
    const look = LOOKS[current].id
    if (look === "current") delete document.documentElement.dataset.look
    else document.documentElement.dataset.look = look
    const url = new URL(location.href)
    url.searchParams.set("v", String(current + 1))
    history.replaceState(history.state, "", url)
  }, [current])

  useEffect(() => {
    // The slide starts after the first paint, so the load does not animate.
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setReady(true))
    )
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)
        return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= LOOKS.length) setCurrent(n - 1)
      else if (e.key === "ArrowRight") setCurrent((c) => (c + 1) % LOOKS.length)
      else if (e.key === "ArrowLeft")
        setCurrent((c) => (c - 1 + LOOKS.length) % LOOKS.length)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  return (
    <nav
      className="proto-picker"
      data-position="top"
      data-ready={ready || undefined}
      aria-label="Prototype variants"
    >
      <span
        ref={highlight}
        className="proto-picker-highlight"
        aria-hidden="true"
      />
      {LOOKS.map((l, i) => (
        <button
          key={l.id}
          ref={(el) => {
            items.current[i] = el
          }}
          type="button"
          className="proto-picker-item"
          data-active={i === current || undefined}
          aria-current={i === current ? "true" : undefined}
          onClick={() => setCurrent(i)}
        >
          {l.label}
        </button>
      ))}
    </nav>
  )
}
