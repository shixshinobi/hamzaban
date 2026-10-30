import { createWorker, type Block, type Worker } from "tesseract.js"
import { findLanguage } from "@shared/languages"

let worker: Worker | null = null
let workerLangs = ""
let progressCb: ((p: number) => void) | undefined

function langsFor(source: string) {
  const code = findLanguage(source)?.ocr
  // Latin + Persian + Arabic covers most screenshots this app sees when the source is unknown.
  const set = new Set(["eng", "fas", "ara"])
  if (code) set.add(code)
  return [...set].join("+")
}

async function workerFor(source: string, onProgress?: (p: number) => void) {
  const langs = langsFor(source)
  progressCb = onProgress
  if (!worker || workerLangs !== langs) {
    await worker?.terminate()
    worker = await createWorker(langs, 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === "recognizing text") progressCb?.(m.progress)
      },
    })
    workerLangs = langs
  }
  return worker
}

/** Recognise text in an image (data URL or canvas) with Tesseract running locally. */
export async function recognize(
  image: string | HTMLCanvasElement,
  source = "auto",
  onProgress?: (p: number) => void
): Promise<string> {
  const w = await workerFor(source, onProgress)
  const { data } = await w.recognize(image)
  return data.text.replace(/\n{3,}/g, "\n\n").trim()
}

/** Recognise text with its layout: blocks, paragraphs and lines, each with a box. */
export async function recognizeBlocks(
  image: string | HTMLCanvasElement,
  source = "auto",
  onProgress?: (p: number) => void
): Promise<Block[]> {
  const w = await workerFor(source, onProgress)
  const { data } = await w.recognize(image, {}, { blocks: true, text: false })
  return data.blocks ?? []
}
