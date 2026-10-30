import { useEffect, useLayoutEffect, useRef } from "react"
import { isRtl } from "@shared/languages"
import { loadImage, regionStyle, type LayoutPage } from "@/lib/layout"
import { fitText, LAYOUT_CSS } from "@/lib/layout-fit"
import { cn } from "@/lib/utils"

// One copy of the layout rules for every page on screen.
if (!document.getElementById("hz-layout-css")) {
  const style = document.createElement("style")
  style.id = "hz-layout-css"
  style.textContent = LAYOUT_CSS
  document.head.appendChild(style)
}

/** Each page's patch pictures, loaded once and dropped with the page. */
const patchCache = new WeakMap<
  LayoutPage,
  Map<number, Promise<HTMLImageElement>>
>()

function patchImage(page: LayoutPage, i: number) {
  let pages = patchCache.get(page)
  if (!pages) patchCache.set(page, (pages = new Map()))
  let img = pages.get(i)
  if (!img) pages.set(i, (img = loadImage(page.regions[i].patch)))
  return img
}

/**
 * The page as it looks, with each translated region laid over its original spot.
 * Regions without a translation yet show the original.
 */
export function LayoutCanvas({
  page,
  tr,
  lang,
  className,
}: {
  page: LayoutPage
  tr: (string | null)[]
  lang: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const patches = useRef<HTMLCanvasElement>(null)
  const dir = isRtl(lang) ? "rtl" : "ltr"

  // Patches are painted onto one canvas at their exact pixels: as separate pictures,
  // each scaled on its own, a thin rule running through them shows seams.
  useEffect(() => {
    const canvas = patches.current
    if (!canvas) return
    let live = true
    void Promise.all(
      page.regions.map((_, i) => (tr[i] ? patchImage(page, i) : null))
    ).then((imgs) => {
      if (!live) return
      const ctx = canvas.getContext("2d")!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      imgs.forEach((img, i) => {
        if (!img) return
        const [x, y] = page.regions[i].box
        ctx.drawImage(
          img,
          Math.round(x * page.width),
          Math.round(y * page.height)
        )
      })
    })
    return () => {
      live = false
    }
  }, [page, tr])

  useLayoutEffect(() => {
    if (ref.current) fitText(ref.current)
  }, [page, tr, lang])

  // Fit again once the font has loaded, and when a hidden page first gets a size.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    void document.fonts.ready.then(() => fitText(el))
    let width = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (!width && el.clientWidth) fitText(el)
      width = el.clientWidth
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        "hz-page rounded-lg shadow-md ring-1 ring-black/5",
        className
      )}
      style={{ aspectRatio: `${page.width} / ${page.height}` }}
    >
      <img className="hz-bg" src={page.image} alt="" draggable={false} />
      <canvas
        ref={patches}
        className="hz-bg"
        width={page.width}
        height={page.height}
      />
      {page.regions.map((r, i) =>
        tr[i] ? (
          <div
            key={i}
            className="hz-r"
            data-fit=""
            data-multi={r.pitch ? "" : undefined}
            style={regionStyle(r, lang)}
            title={r.text}
          >
            <div dir={dir} className="selectable">
              {tr[i]}
            </div>
          </div>
        ) : null
      )}
    </div>
  )
}
