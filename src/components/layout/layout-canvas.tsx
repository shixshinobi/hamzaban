import { PencilIcon, RotateCcwIcon } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { isRtl } from "@shared/languages"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useT } from "@/lib/i18n"
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
  style,
  onFix,
  onRetranslate,
}: {
  page: LayoutPage
  tr: (string | null)[]
  lang: string
  className?: string
  style?: React.CSSProperties
  /** Set when the reader may correct a region: saves their wording for it. */
  onFix?: (i: number, text: string) => void
  /** Translates one region again and gives back the new wording (not yet saved). */
  onRetranslate?: (i: number, previous: string) => Promise<string>
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
      style={{ aspectRatio: `${page.width} / ${page.height}`, ...style }}
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
            data-fixable={onFix ? "" : undefined}
            style={regionStyle(r, lang)}
            title={r.text}
          >
            <div dir={dir} className="selectable">
              {r.marker && <span className="hz-mark">{r.marker}</span>}
              {tr[i]}
            </div>
            {onFix && (
              <RegionFix
                original={r.text}
                text={tr[i]!}
                dir={dir}
                onSave={(text) => onFix(i, text)}
                onAgain={
                  onRetranslate ? () => onRetranslate(i, tr[i]!) : undefined
                }
              />
            )}
          </div>
        ) : null
      )}
    </div>
  )
}

/**
 * The pencil on a translated region: shows the original, lets the reader type the
 * right wording, or asks the engine for another translation of just this region.
 */
function RegionFix({
  original,
  text,
  dir,
  onSave,
  onAgain,
}: {
  original: string
  text: string
  dir: "rtl" | "ltr"
  onSave: (text: string) => void
  onAgain?: () => Promise<string>
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(text)
  const [busy, setBusy] = useState(false)
  const again = async () => {
    if (!onAgain) return
    setBusy(true)
    try {
      setDraft(await onAgain())
    } catch (e) {
      toast.error(t("fixFailed"), { description: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setDraft(text)
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className="hz-fix"
            aria-label={t("fixTranslation")}
            title={t("fixTranslation")}
          />
        }
      >
        <PencilIcon />
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <PopoverHeader>
          <PopoverTitle>{t("fixTranslation")}</PopoverTitle>
        </PopoverHeader>
        <Field>
          <FieldLabel>{t("fixOriginal")}</FieldLabel>
          <FieldDescription
            dir="auto"
            className="selectable max-h-28 overflow-y-auto rounded-md bg-muted/50 p-2"
          >
            {original}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="hz-fix-text">{t("fixYours")}</FieldLabel>
          <Textarea
            id="hz-fix-text"
            dir={dir}
            value={draft}
            rows={4}
            onChange={(e) => setDraft(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2">
          {onAgain && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void again()}
            >
              {busy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RotateCcwIcon data-icon="inline-start" />
              )}
              {t("fixAgain")}
            </Button>
          )}
          <Button
            size="sm"
            disabled={busy || !draft.trim()}
            onClick={() => {
              onSave(draft.trim())
              setOpen(false)
            }}
          >
            {t("fixSave")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
