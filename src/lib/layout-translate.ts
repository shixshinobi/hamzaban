import type { JobStage, Settings } from "@shared/types"
import { buildRequest } from "./request"
import { translateAsync } from "./translate-async"

/** One request carries at most this much text, so a page is one or a few requests. */
const BATCH_CHARS = 2200
const BATCH_PIECES = 45

const INSTRUCTION =
  "The input is a list of separate pieces of text from one page, each starting with a marker such as [1]. " +
  "Translate every piece on its own. Start each translated piece with its marker exactly as written, " +
  "keep the pieces in the same order with a blank line between them, and output nothing else."

/**
 * Translate the text of a page's regions, in batches of numbered pieces. Pieces that
 * already have a translation are skipped, so a stopped page picks up where it was.
 * `onPiece` fires as soon as each piece has fully arrived.
 */
export async function translatePieces(
  texts: string[],
  done: (string | null)[],
  settings: Settings,
  onPiece: (i: number, text: string) => void,
  signal: AbortSignal,
  opts: {
    /** Where the request is, for the page's progress banner. */
    onProgress?: (p: {
      stage?: { stage: JobStage; detail?: string }
      receiving: boolean
    }) => void
    /** Added to the instruction, e.g. what was wrong with an earlier translation. */
    note?: string
  } = {}
) {
  const todo = texts.map((_, i) => i).filter((i) => done[i] == null)
  const got = new Set<number>()
  for (const batch of batches(todo, texts)) await run(batch)
  // A piece the engine dropped or merged gets one more try, in a batch of its own.
  const missed = todo.filter((i) => !got.has(i))
  for (const batch of batches(missed, texts)) await run(batch)

  async function run(batch: number[]) {
    const text = batch.map((i, k) => `[${k + 1}] ${texts[i]}`).join("\n\n")
    const req = {
      ...buildRequest(settings, {
        text,
        extraInstruction: opts.note
          ? `${INSTRUCTION} ${opts.note}`
          : INSTRUCTION,
      }),
      smart: false,
    }
    opts.onProgress?.({ receiving: false })
    const take = (out: string, final: boolean) => {
      const pieces = parsePieces(out)
      // A lone piece sometimes comes back without its marker.
      if (final && !pieces.size && batch.length === 1 && out.trim())
        pieces.set(1, out.replace(/\s+/g, " ").trim())
      // While streaming, the last marker seen may still be growing.
      const last = final ? Infinity : Math.max(0, ...pieces.keys())
      for (const [k, t] of pieces) {
        const i = batch[k - 1]
        if (i === undefined || k >= last || got.has(i) || !t) continue
        got.add(i)
        onPiece(i, t)
      }
    }
    let receiving = false
    const out = await translateAsync(
      req,
      (partial) => {
        if (!receiving && partial.trim()) {
          receiving = true
          opts.onProgress?.({ receiving })
        }
        take(partial, false)
      },
      signal,
      (stage, detail) =>
        opts.onProgress?.({ stage: { stage, detail }, receiving })
    )
    take(out, true)
  }
}

function batches(ids: number[], texts: string[]) {
  const out: number[][] = []
  let cur: number[] = []
  let chars = 0
  for (const i of ids) {
    const n = texts[i].length + 8
    if (cur.length && (chars + n > BATCH_CHARS || cur.length >= BATCH_PIECES)) {
      out.push(cur)
      cur = []
      chars = 0
    }
    cur.push(i)
    chars += n
  }
  if (cur.length) out.push(cur)
  return out
}

/**
 * Split a reply into its numbered pieces. Persian and Arabic digits, mirrored brackets
 * and markdown emphasis around the marker are all accepted.
 */
export function parsePieces(out: string) {
  const re =
    /(?:^|\n)\s*[*_]*[[\]【「(]\s*([0-9۰-۹٠-٩]{1,3})\s*[[\]】」)][*_]*[ \t:.-]*/g
  const marks = [...out.matchAll(re)]
  const pieces = new Map<number, string>()
  marks.forEach((m, j) => {
    const start = m.index + m[0].length
    const end = j + 1 < marks.length ? marks[j + 1].index : out.length
    const text = out.slice(start, end).replace(/\s+/g, " ").trim()
    const k = Number(
      m[1]
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    )
    if (!pieces.has(k)) pieces.set(k, text)
  })
  return pieces
}

/**
 * Translate one piece again, after the reader marked its translation as wrong. The
 * earlier attempt goes with it, so the engine does not hand the same words back.
 */
export async function retranslatePiece(
  text: string,
  previous: string,
  settings: Settings,
  signal = new AbortController().signal
) {
  let out = ""
  await translatePieces([text], [null], settings, (_, t) => (out = t), signal, {
    note: `The reader found this earlier translation of the piece wrong: «${previous}». Translate the piece again, more accurately and faithfully to the original.`,
  })
  if (!out) throw new Error("The engine returned no translation.")
  return out
}
