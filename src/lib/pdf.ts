import * as pdfjs from "pdfjs-dist"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url"

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const PDFJS_FILES = new URL("pdfjs/", document.baseURI).href

export type { PDFDocumentProxy }

export async function openPdf(
  data: ArrayBuffer | Uint8Array
): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({
    data: data instanceof Uint8Array ? data : new Uint8Array(data),
    // Keeps each font's name and weight, so in-place translations can stay bold.
    fontExtraProperties: true,
    // Image decoders, colour profiles, character maps and fonts pdf.js loads as needed
    // (copied next to the app by vite.config.ts). Without them JPEG 2000 and JBIG2
    // images are left blank, and some fonts and scripts do not draw.
    wasmUrl: PDFJS_FILES + "wasm/",
    iccUrl: PDFJS_FILES + "iccs/",
    cMapUrl: PDFJS_FILES + "cmaps/",
    cMapPacked: true,
    standardFontDataUrl: PDFJS_FILES + "standard_fonts/",
  }).promise
}

interface TextItemLike {
  str: string
  transform: number[]
  height: number
  hasEOL?: boolean
}

/** Rebuild readable paragraphs from positioned text runs. */
export async function pageText(page: PDFPageProxy): Promise<string> {
  const content = await page.getTextContent()
  // First pass: group runs into lines by baseline.
  const lines: { y: number; h: number; text: string }[] = []
  for (const raw of content.items) {
    const item = raw as TextItemLike
    if (typeof item.str !== "string" || !item.str.trim()) continue
    const y = item.transform[5]
    const h = Math.abs(item.transform[3]) || item.height || 10
    const line = lines[lines.length - 1]
    if (line && Math.abs(line.y - y) < h * 0.5) {
      line.text +=
        (line.text.endsWith(" ") || item.str.startsWith(" ") ? "" : " ") +
        item.str
    } else {
      lines.push({ y, h, text: item.str })
    }
  }
  // Second pass: a gap noticeably larger than the usual line pitch starts a new paragraph.
  const gaps = lines
    .slice(1)
    .map((l, i) => lines[i].y - l.y)
    .filter((g) => g > 0)
  const pitch = gaps.length
    ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)]
    : 0
  let out = ""
  lines.forEach((l, i) => {
    if (i > 0) {
      const gap = lines[i - 1].y - l.y
      const heading = Math.abs(l.h - lines[i - 1].h) > 1.5
      out += gap > pitch * 1.35 || gap < 0 || heading ? "\n\n" : "\n"
    }
    out += l.text
  })
  return out
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, "$1$2")
    .split(/\n{2,}/)
    .map((p) =>
      p
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join("\n\n")
}

export async function renderPage(
  page: PDFPageProxy,
  width: number
): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 })
  const scale = (width / base.width) * (window.devicePixelRatio || 1)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement("canvas")
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  // The print intent draws without waiting for animation frames, which a hidden
  // window never gets: OCR of a scanned page keeps going in the background.
  await page.render({ canvas, viewport, intent: "print" }).promise
  return canvas
}
