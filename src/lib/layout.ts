import { Util } from "pdfjs-dist"
import type { PDFPageProxy } from "pdfjs-dist"
import { isRtl } from "@shared/languages"
import { recognizeBlocks } from "./ocr"

/**
 * A page rebuilt for in-place translation: the picture of the page, and every piece
 * of text on it with where it sits and how it looks. Translations are laid over the
 * picture at the same spots, on a patch where the original text is painted out.
 */
export interface LayoutPage {
  /** Size of the picture in pixels. */
  width: number
  height: number
  /** The page's own width in CSS pixels, for print. */
  cssWidth: number
  /** The page as it was (object URL). */
  image: string
  regions: LayoutRegion[]
}

/** "left" and "right" are physical: a single line kept to the column edge it sat on. */
export type LayoutAlign =
  "start" | "center" | "end" | "justify" | "left" | "right"

export interface LayoutRegion {
  text: string
  /** Left, top, width and height, as fractions of the page. */
  box: [number, number, number, number]
  /** Font size as a fraction of the page width. */
  size: number
  /** Line pitch over font size; 0 for a single line. */
  pitch: number
  bold: boolean
  serif: boolean
  /** Relative to the source text's direction, except for "left" and "right". */
  align: LayoutAlign
  color: string
  /** The page inside `box` with the text painted out (object URL). */
  patch: string
}

/** One line of text on the picture, in pixels. */
interface Line {
  x0: number
  x1: number
  top: number
  bottom: number
  baseline: number
  size: number
  bold: boolean
  serif: boolean
  text: string
}

/** Pages are pictured at this width: sharp on screen and in print, still quick to paint. */
const RASTER_WIDTH = 1700

// ---------- sources ----------

/** A PDF page: its own text layer when it has one, OCR when it is a scan. */
export async function pdfLayout(
  page: PDFPageProxy,
  sourceLang: string,
  onOcr?: (p: number) => void
): Promise<LayoutPage> {
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(RASTER_WIDTH / base.width, 4)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement("canvas")
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  // The print intent draws without waiting for animation frames, which a hidden
  // window never gets, so a long document keeps going in the background.
  await page.render({ canvas, viewport, intent: "print" }).promise
  let blocks = groupLines(await pdfLines(page, viewport.transform, scale))
  if (!blocks.length) {
    onOcr?.(0)
    blocks = await ocrBlocks(canvas, sourceLang, onOcr)
  }
  // PDF points are 1/72 in; CSS pixels are 1/96 in.
  return build(canvas, blocks, (base.width * 96) / 72)
}

/** An image: OCR finds the text and its place. */
export async function imageLayout(
  src: string,
  sourceLang: string,
  onOcr?: (p: number) => void
): Promise<LayoutPage> {
  const img = await loadImage(src)
  const canvas = document.createElement("canvas")
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext("2d")!.drawImage(img, 0, 0)
  return build(
    canvas,
    await ocrBlocks(canvas, sourceLang, onOcr),
    img.naturalWidth
  )
}

interface PdfTextItem {
  str: string
  transform: number[]
  width: number
  fontName: string
}

async function pdfLines(
  page: PDFPageProxy,
  vt: number[],
  scale: number
): Promise<Line[]> {
  const content = await page.getTextContent()
  const styles = content.styles as Record<
    string,
    {
      ascent?: number
      descent?: number
      vertical?: boolean
      fontFamily?: string
    }
  >
  const lines: Line[] = []
  for (const raw of content.items) {
    const item = raw as PdfTextItem
    if (typeof item.str !== "string" || !item.str.trim()) continue
    const style = styles[item.fontName] ?? {}
    if (style.vertical) continue
    const [a, b, c, d, x, y] = Util.transform(vt, item.transform)
    // Rotated text stays as it is on the picture.
    if (Math.abs(b) > Math.abs(a) * 0.05 || Math.abs(c) > Math.abs(d) * 0.05)
      continue
    const size = Math.hypot(c, d)
    if (size < 2) continue
    const ascent = style.ascent && style.ascent > 0.5 ? style.ascent : 0.88
    const descent = Math.abs(style.descent ?? -0.22) || 0.22
    const width = item.width * scale
    const next: Line = {
      x0: x,
      x1: x + width,
      top: y - size * ascent,
      bottom: y + size * descent,
      baseline: y,
      size,
      bold: isBold(page, item.fontName),
      serif: style.fontFamily === "serif",
      text: item.str,
    }
    // Runs on the same baseline that touch each other are one line.
    const line = lines.findLast(
      (l) =>
        Math.abs(l.baseline - y) < size * 0.35 &&
        Math.abs(l.size - size) < size * 0.25 &&
        x - l.x1 < size * 1.2 &&
        x > l.x0 - size
    )
    if (line) {
      const gap = x - line.x1
      const space =
        gap > size * 0.15 && !/\s$/.test(line.text) && !/^\s/.test(item.str)
      line.text += (space ? " " : "") + item.str
      line.x1 = Math.max(line.x1, next.x1)
      line.top = Math.min(line.top, next.top)
      line.bottom = Math.max(line.bottom, next.bottom)
      line.bold &&= next.bold
    } else lines.push(next)
  }
  for (const l of lines) l.text = l.text.replace(/\s+/g, " ").trim()
  return lines.filter((l) => l.text)
}

function isBold(page: PDFPageProxy, fontName: string) {
  try {
    if (!page.commonObjs.has(fontName)) return false
    const font = page.commonObjs.get(fontName) as {
      name?: string
      bold?: boolean
      black?: boolean
    }
    return !!(
      font.bold ||
      font.black ||
      /bold|black|heavy/i.test(font.name ?? "")
    )
  } catch {
    return false
  }
}

/**
 * Lines into blocks: a line joins the block above it when it has the same size and
 * weight, sits one line pitch below and overlaps it sideways. Searching every open
 * block, not just the last one, keeps the columns of a newspaper apart.
 */
function groupLines(lines: Line[]): Line[][] {
  const sorted = [...lines].sort((p, q) => p.top - q.top || p.x0 - q.x0)
  const blocks: Line[][] = []
  for (const line of sorted) {
    let best: Line[] | null = null
    let bestGap = Infinity
    for (const block of blocks) {
      const last = block[block.length - 1]
      const size = Math.max(line.size, last.size)
      if (Math.abs(line.size - last.size) > size * 0.2) continue
      if (line.bold !== last.bold) continue
      const pitch = line.baseline - last.baseline
      if (pitch < size * 0.6 || pitch > size * 1.9) continue
      const x0 = Math.min(...block.map((l) => l.x0))
      const x1 = Math.max(...block.map((l) => l.x1))
      const overlap = Math.min(x1, line.x1) - Math.max(x0, line.x0)
      if (overlap < Math.min(x1 - x0, line.x1 - line.x0) * 0.5) continue
      // A short line ending a sentence closes its paragraph.
      if (last.x1 < x1 - size * 2 && /[.!?:؟。»"”]$/.test(last.text)) continue
      if (pitch < bestGap) {
        best = block
        bestGap = pitch
      }
    }
    if (best) best.push(line)
    else blocks.push([line])
  }
  return blocks
}

/**
 * OCR lines into blocks. Tesseract's own paragraphs are not used: with a narrow gutter
 * it reads across both columns as one line, so lines are cut at wide gaps between words
 * and then grouped the same way as a PDF's text.
 */
async function ocrBlocks(
  canvas: HTMLCanvasElement,
  sourceLang: string,
  onProgress?: (p: number) => void
): Promise<Line[][]> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  const lines: Line[] = []
  for (const block of await recognizeBlocks(canvas, sourceLang, onProgress))
    for (const para of block.paragraphs)
      for (const l of para.lines) {
        const lineBase = l.baseline
          ? (l.baseline.y0 + l.baseline.y1) / 2
          : l.bbox.y1
        const words = l.words.filter((w) => w.text.trim())
        const tall = (w: (typeof words)[number]) => w.bbox.y1 - w.bbox.y0
        const ref = median(words.map(tall))
        let run: typeof words = []
        const flush = () => {
          if (!run.length) return
          const text = run
            .map((w) => w.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
          const conf = run.reduce((a, w) => a + w.confidence, 0) / run.length
          const x0 = Math.min(...run.map((w) => w.bbox.x0))
          const x1 = Math.max(...run.map((w) => w.bbox.x1))
          // Word boxes are loose (one under a chart takes in the bars above it), so the
          // text's height is measured from the ink itself.
          const ink = inkBand(ctx, {
            x: x0,
            y: Math.min(...run.map((w) => w.bbox.y0)),
            w: Math.max(1, x1 - x0),
            h: Math.max(
              1,
              Math.max(...run.map((w) => w.bbox.y1)) -
                Math.min(...run.map((w) => w.bbox.y0))
            ),
          })
          const top = ink.y
          const bottom = ink.y + ink.h
          const h = ink.h
          // Shapes, chart lines and photo texture come back as low-confidence noise.
          if (text && conf >= 60 && h < median(run.map(tall)) * 3)
            lines.push({
              x0,
              x1,
              top,
              bottom,
              // A piece of a line that sits apart has its own baseline.
              baseline:
                Math.abs(bottom - lineBase) < h * 0.4
                  ? lineBase
                  : bottom - h * 0.2,
              // A piece's height is steady from line to line (Tesseract's row height
              // is not) and runs a little under the font size. A size read too large
              // is shrunk back by the fit; one read too small is not.
              size: h * 1.15,
              bold: false,
              serif: false,
              text,
            })
          run = []
        }
        for (const w of words) {
          const prev = run[run.length - 1]
          // A wide gap is a gutter, and a jump in size is text from another box.
          const big =
            prev &&
            Math.max(tall(w), tall(prev)) / Math.min(tall(w), tall(prev)) > 1.8
          if (
            prev &&
            (w.bbox.x0 - prev.bbox.x1 > ref * 1.6 ||
              (big && w.bbox.x0 - prev.bbox.x1 > ref * 0.8))
          )
            flush()
          run.push(w)
        }
        flush()
      }
  // OCR does not report weight, so text read from a picture stays regular.
  return mergeOverlaps(groupLines(lines))
}

/**
 * OCR sometimes reads one box of text as two overlapping blocks (lines taken in the
 * wrong order). Overlapping blocks are one region, its lines read top to bottom.
 */
function mergeOverlaps(blocks: Line[][]): Line[][] {
  const box = (b: Line[]) => ({
    x0: Math.min(...b.map((l) => l.x0)),
    x1: Math.max(...b.map((l) => l.x1)),
    y0: Math.min(...b.map((l) => l.top)),
    y1: Math.max(...b.map((l) => l.bottom)),
  })
  const area = (r: ReturnType<typeof box>) => (r.x1 - r.x0) * (r.y1 - r.y0)
  const out = [...blocks]
  for (let i = 0; i < out.length; i++)
    for (let j = i + 1; j < out.length; j++) {
      const a = box(out[i])
      const b = box(out[j])
      const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)
      const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)
      if (w <= 0 || h <= 0 || w * h < Math.min(area(a), area(b)) * 0.3) continue
      out[i] = [...out[i], ...out[j]].sort(
        (p, q) => p.top - q.top || p.x0 - q.x0
      )
      out.splice(j, 1)
      j = i
    }
  return out
}

// ---------- building the page ----------

async function build(
  canvas: HTMLCanvasElement,
  blocks: Line[][],
  cssWidth: number
): Promise<LayoutPage> {
  const W = canvas.width
  const H = canvas.height
  const image = blobUrl(canvas, "image/jpeg")
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  // Text with no letters (page numbers, figures on a chart axis) reads the same in any
  // language, so it stays as it is on the picture.
  const kept = blocks.filter((b) => b.some((l) => /\p{L}/u.test(l.text)))
  const looks = kept.map((b) => b.map((l) => lineLook(ctx, l)))
  // Every line is painted out on one working copy, then each block's patch is cut from it.
  for (const block of kept)
    for (const l of block) erase(ctx, withoutRules(ctx, padded(l, W, H)))
  const regions: LayoutRegion[] = []
  for (const [i, block] of kept.entries()) {
    const text = joinLines(block.map((l) => l.text))
    const dir = isRtl(guessDir(text)) ? "rtl" : "ltr"
    const single = block.length > 1 ? null : lineAlign(block[0], kept, dir)
    const x0 = single?.span?.[0] ?? Math.min(...block.map((l) => l.x0))
    const x1 = single?.span?.[1] ?? Math.max(...block.map((l) => l.x1))
    const top = Math.min(...block.map((l) => l.top))
    const bottom = Math.max(...block.map((l) => l.bottom))
    const size = median(block.map((l) => l.size))
    const box = clampBox(
      x0 - size * 0.12,
      top - size * 0.1,
      x1 + size * 0.12,
      bottom + size * 0.1,
      W,
      H
    )
    const pitch =
      block.length > 1
        ? (block[block.length - 1].baseline - block[0].baseline) /
          (block.length - 1) /
          size
        : 0
    regions.push({
      text,
      box: [box.x / W, box.y / H, box.w / W, box.h / H],
      size: size / W,
      pitch,
      bold: block.every((l) => l.bold),
      serif: block.every((l) => l.serif),
      align: single?.align ?? alignOf(block, dir),
      color: median(
        looks[i].map((c) => c.text),
        true
      ),
      patch: blobUrl(crop(canvas, box), "image/png"),
    })
  }
  return { width: W, height: H, cssWidth, image, regions }
}

/** "rtl" when most letters are from a right-to-left script, so isRtl can read it. */
function guessDir(text: string) {
  const rtl = (text.match(/[\u0590-\u08ff]/g) ?? []).length
  const all = (text.match(/\p{L}/gu) ?? []).length
  return rtl > all / 2 ? "fa" : "en"
}

function joinLines(lines: string[]) {
  return lines
    .join("\n")
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, "$1$2")
    .replace(/\s*\n\s*/g, " ")
    .trim()
}

/**
 * A single line that starts on a column's edge (a heading over its column) takes the
 * column's width and starts where it does, so a translation into a language written the
 * other way round lines up with its paragraph. A line on no column is centred on where
 * it was (a title, a label on a chart).
 */
function lineAlign(
  line: Line,
  blocks: Line[][],
  dir: "ltr" | "rtl"
): { align: LayoutAlign; span?: [number, number] } {
  // Only paragraphs make a column edge; other short lines lining up is chance.
  const near = (a: number, b: number, size: number) =>
    Math.abs(a - b) < Math.min(line.size, size) * 0.4
  // The nearest paragraph above or below is the line's own column.
  const gap = (b: Line[]) =>
    Math.max(
      0,
      Math.min(...b.map((l) => l.top)) - line.bottom,
      line.top - Math.max(...b.map((l) => l.bottom))
    )
  const columns = blocks
    .filter((b) => b.length > 1)
    .sort((p, q) => gap(p) - gap(q))
  for (const b of columns) {
    const x0 = Math.min(...b.map((l) => l.x0))
    const x1 = Math.max(...b.map((l) => l.x1))
    const onStart =
      dir === "ltr"
        ? near(x0, line.x0, b[0].size)
        : near(x1, line.x1, b[0].size)
    const onEnd =
      dir === "ltr"
        ? near(x1, line.x1, b[0].size)
        : near(x0, line.x0, b[0].size)
    if (!onStart && !onEnd) continue
    // Widen only into empty space: nothing else may sit beside the line.
    const span: [number, number] = [
      Math.min(x0, line.x0),
      Math.max(x1, line.x1),
    ]
    const crowded = blocks.some((o) =>
      o.some(
        (l) =>
          l !== line &&
          l.bottom > line.top &&
          l.top < line.bottom &&
          l.x1 > span[0] &&
          l.x0 < span[1]
      )
    )
    if (onStart)
      return crowded
        ? { align: dir === "ltr" ? "left" : "right" }
        : { align: "start", span }
    return { align: dir === "ltr" ? "right" : "left" }
  }
  return { align: "center" }
}

/** How a block's lines line up. A paragraph's last line is free to end short. */
function alignOf(block: Line[], dir: "ltr" | "rtl"): LayoutAlign {
  if (block.length < 2) return "start"
  const tol = median(block.map((l) => l.size)) * 0.6
  const even = (xs: number[]) => Math.max(...xs) - Math.min(...xs) < tol
  const body = block.slice(0, -1)
  const left = even(block.map((l) => l.x0))
  const right = even(block.map((l) => l.x1))
  const [start, end] = dir === "ltr" ? [left, right] : [right, left]
  const bodyEnd = even(body.map((l) => (dir === "ltr" ? l.x1 : l.x0)))
  if (start && bodyEnd) return "justify"
  if (even(block.map((l) => (l.x0 + l.x1) / 2))) return "center"
  return !start && end ? "end" : "start"
}

// ---------- pixels ----------

type RGB = [number, number, number]

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function clampBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  W: number,
  H: number
): Rect {
  const x = Math.max(0, Math.floor(x0))
  const y = Math.max(0, Math.floor(y0))
  return {
    x,
    y,
    w: Math.max(1, Math.min(W, Math.ceil(x1)) - x),
    h: Math.max(1, Math.min(H, Math.ceil(y1)) - y),
  }
}

function padded(l: Line, W: number, H: number) {
  const p = l.size * 0.12
  return clampBox(l.x0 - p, l.top - p * 0.6, l.x1 + p, l.bottom + p * 0.6, W, H)
}

const dist = (p: RGB, q: RGB) =>
  Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2])

function median(xs: number[]): number
function median(xs: RGB[], color: true): string
function median(xs: (number | RGB)[], color?: true): number | string {
  if (color) {
    const cs = xs as RGB[]
    if (!cs.length) return "#1a1a1a"
    const ch = (i: number) => median(cs.map((c) => c[i]))
    return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`
  }
  const s = [...(xs as number[])].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : 0
}

function medianRgb(px: RGB[]): RGB {
  const ch = (i: number) => median(px.map((c) => c[i]))
  return [ch(0), ch(1), ch(2)]
}

/** The ring of pixels just outside a rectangle: what the text sits on. */
function ring(ctx: CanvasRenderingContext2D, r: Rect) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const o = clampBox(r.x - 2, r.y - 2, r.x + r.w + 2, r.y + r.h + 2, W, H)
  const d = ctx.getImageData(o.x, o.y, o.w, o.h).data
  const at = (x: number, y: number): RGB => {
    const i = (y * o.w + x) * 4
    return [d[i], d[i + 1], d[i + 2]]
  }
  const px: RGB[] = []
  for (let x = 0; x < o.w; x++) px.push(at(x, 0), at(x, o.h - 1))
  for (let y = 1; y < o.h - 1; y++) px.push(at(0, y), at(o.w - 1, y))
  return { px, o, at }
}

/** The colour of a line's text: its pixels that differ most from the background. */
function lineLook(ctx: CanvasRenderingContext2D, l: Line) {
  const r = clampBox(
    l.x0,
    l.top,
    l.x1,
    l.bottom,
    ctx.canvas.width,
    ctx.canvas.height
  )
  const bg = medianRgb(ring(ctx, r).px)
  const d = ctx.getImageData(r.x, r.y, r.w, r.h).data
  const ink: { c: RGB; d: number }[] = []
  // Every few pixels is plenty for a colour.
  for (let i = 0; i < d.length; i += 4 * 3) {
    const c: RGB = [d[i], d[i + 1], d[i + 2]]
    const k = dist(c, bg)
    if (k > 90) ink.push({ c, d: k })
  }
  ink.sort((p, q) => q.d - p.d)
  const top = ink.slice(0, Math.max(1, Math.floor(ink.length * 0.4)))
  const lum = bg[0] * 0.3 + bg[1] * 0.59 + bg[2] * 0.11
  const text: RGB = ink.length
    ? medianRgb(top.map((x) => x.c))
    : lum > 128
      ? [26, 26, 26]
      : [245, 245, 245]
  return { bg, text }
}

/**
 * The rows of a rectangle that hold the text: the band with the most ink, ignoring rules
 * (rows inked nearly end to end) and specks above or below it.
 */
function inkBand(ctx: CanvasRenderingContext2D, r: Rect): Rect {
  const bg = medianRgb(ring(ctx, r).px)
  const d = ctx.getImageData(r.x, r.y, r.w, r.h).data
  const rows: number[] = []
  for (let y = 0; y < r.h; y++) {
    let ink = 0
    for (let x = 0; x < r.w; x++) {
      const i = (y * r.w + x) * 4
      if (dist([d[i], d[i + 1], d[i + 2]], bg) > 80) ink++
    }
    rows.push(ink > r.w * 0.85 ? 0 : ink)
  }
  let best = { y: 0, h: r.h, ink: 0 }
  for (let y = 0; y < r.h;) {
    if (!rows[y]) {
      y++
      continue
    }
    let end = y
    let sum = 0
    // A one-row gap (between a letter and its dot) does not end the band.
    while (end < r.h && (rows[end] || rows[end + 1])) sum += rows[end++]
    if (sum > best.ink) best = { y, h: end - y, ink: sum }
    y = end + 1
  }
  return best.ink ? { x: r.x, y: r.y + best.y, w: r.w, h: best.h } : r
}

/**
 * Shrink a line's rectangle so it stops short of a rule drawn just above or below the
 * text (a masthead's underline, a table border): a row that is ink nearly end to end is
 * a line, not letters, and stays on the page.
 */
function withoutRules(ctx: CanvasRenderingContext2D, r: Rect): Rect {
  if (r.h < 4) return r
  const bg = medianRgb(ring(ctx, r).px)
  const d = ctx.getImageData(r.x, r.y, r.w, r.h).data
  const ruled = (y: number) => {
    let ink = 0
    for (let x = 0; x < r.w; x++) {
      const i = (y * r.w + x) * 4
      if (dist([d[i], d[i + 1], d[i + 2]], bg) > 60) ink++
    }
    return ink > r.w * 0.85
  }
  let top = 0
  let bottom = r.h
  for (let y = Math.floor(r.h * 0.6); y < r.h; y++)
    if (ruled(y)) {
      bottom = y
      break
    }
  for (let y = Math.ceil(r.h * 0.4); y >= 0; y--)
    if (ruled(y)) {
      top = y + 1
      break
    }
  return bottom - top < r.h * 0.4 ? r : { ...r, y: r.y + top, h: bottom - top }
}

/**
 * Paint text out of a rectangle. A plain background is filled with its colour; on a
 * gradient or a photo each column blends from the pixel above to the one below, using
 * the other side (or the background colour) where one of them is itself text.
 */
function erase(ctx: CanvasRenderingContext2D, r: Rect) {
  const { px, o, at } = ring(ctx, r)
  const bg = medianRgb(px)
  const spread = px.reduce((s, c) => s + dist(c, bg), 0) / px.length
  if (spread < 14) {
    ctx.fillStyle = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`
    ctx.fillRect(r.x, r.y, r.w, r.h)
    return
  }
  const img = ctx.getImageData(r.x, r.y, r.w, r.h)
  const d = img.data
  const ox = r.x - o.x
  const oy = r.y - o.y
  for (let x = 0; x < r.w; x++) {
    let above = at(ox + x, 0)
    let below = at(ox + x, o.h - 1)
    const a = dist(above, bg) > 70
    const b = dist(below, bg) > 70
    if (a && !b) above = below
    else if (b && !a) below = above
    else if (a && b) above = below = bg
    for (let y = 0; y < r.h; y++) {
      const t = r.h > 1 ? (y + oy) / (o.h - 1) : 0.5
      const i = (y * r.w + x) * 4
      d[i] = above[0] + (below[0] - above[0]) * t
      d[i + 1] = above[1] + (below[1] - above[1]) * t
      d[i + 2] = above[2] + (below[2] - above[2]) * t
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, r.x, r.y)
}

function crop(canvas: HTMLCanvasElement, r: Rect) {
  const c = document.createElement("canvas")
  c.width = r.w
  c.height = r.h
  c.getContext("2d")!.drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h)
  return c
}

/**
 * Encoded synchronously: toBlob's callback is held back in a hidden window, which would
 * stall a document translated while the app sits in the tray.
 */
function blobUrl(canvas: HTMLCanvasElement, type: string) {
  const data = canvas.toDataURL(type, 0.92)
  const bin = atob(data.slice(data.indexOf(",") + 1))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type }))
}

/** Waits for the load event: img.decode() never settles in a hidden window. */
export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("The image could not be read."))
    img.src = src
  })
}

/** Free the pictures of pages that are no longer shown. */
export function releaseLayout(page: LayoutPage | undefined) {
  if (!page) return
  URL.revokeObjectURL(page.image)
  for (const r of page.regions) URL.revokeObjectURL(r.patch)
}

/** CSS variables for a region's translated text (see LAYOUT_CSS). */
export function regionStyle(r: LayoutRegion, targetLang: string) {
  const rtl = isRtl(targetLang)
  const [x, y, w, h] = r.box
  const pct = (v: number) => `${(v * 100).toFixed(3)}%`
  return {
    left: pct(x),
    top: pct(y),
    width: pct(w),
    height: pct(h),
    "--s": (r.size * 100).toFixed(4),
    // Persian needs a little more room between lines than Latin text set tight.
    "--lh": String(r.pitch ? Math.max(r.pitch, rtl ? 1.35 : 1.1) : 1.2),
    "--c": r.color,
    "--w": r.bold ? "700" : "400",
    // Persian has no serif face here; Latin text keeps the original's kind of font.
    "--f": r.serif && !rtl ? 'Georgia, "Times New Roman", serif' : "inherit",
    "--a": r.align,
    "--al": r.align === "justify" ? "start" : "auto",
  } as Record<string, string>
}
