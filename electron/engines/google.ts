import { profileInput } from "../../shared/blocks"
import type { DictionaryData } from "../../shared/types"
import { EngineError, httpError, type EngineRunner } from "./types"

// Uses the same public endpoint as the Google Translate browser widgets; no key required.
const ENDPOINT = "https://translate.googleapis.com/translate_a/single"

interface GtxResponse {
  sentences?: {
    trans?: string
    orig?: string
    translit?: string
    src_translit?: string
  }[]
  dict?: {
    pos: string
    terms: string[]
    entry?: { word: string; reverse_translation?: string[]; score?: number }[]
  }[]
  definitions?: { pos: string; entry: { gloss: string; example?: string }[] }[]
  examples?: { example: { text: string }[] }
  synsets?: { pos: string; entry: { synonym: string[] }[] }[]
  src?: string
}

function chunk(text: string, max = 1500): string[] {
  if (text.length <= max) return [text]
  const out: string[] = []
  let rest = text
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max)
    if (cut < max * 0.5)
      cut = Math.max(
        rest.lastIndexOf(". ", max),
        rest.lastIndexOf("。", max),
        rest.lastIndexOf("؟", max)
      )
    if (cut < max * 0.3) cut = rest.lastIndexOf(" ", max)
    if (cut <= 0) cut = max
    out.push(rest.slice(0, cut + 1))
    rest = rest.slice(cut + 1)
  }
  if (rest) out.push(rest)
  return out
}

async function call(
  q: string,
  sl: string,
  tl: string,
  dict: boolean,
  signal: AbortSignal
): Promise<GtxResponse> {
  const params = new URLSearchParams({
    client: "gtx",
    sl,
    tl,
    hl: tl,
    dj: "1",
    ie: "UTF-8",
    oe: "UTF-8",
  })
  for (const dt of dict ? ["t", "bd", "rm", "md", "ex", "ss"] : ["t", "rm"])
    params.append("dt", dt)
  const res = await fetch(`${ENDPOINT}?${params}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams({ q }).toString(),
    signal,
  }).catch((e) => {
    throw new EngineError(
      String(e?.message ?? e),
      signal.aborted ? "cancelled" : "network"
    )
  })
  if (!res.ok) throw await httpError(res)
  return (await res.json()) as GtxResponse
}

export const runGoogle: EngineRunner = async (ctx) => {
  const { req, signal } = ctx
  if (!req.text.trim())
    throw new EngineError(
      "Google Translate cannot read images directly; OCR is used first.",
      "unsupported"
    )
  const isWord = profileInput(req.text).layout === "dictionary"
  const sl = req.sourceLang || "auto"
  let full = ""
  for (const piece of chunk(req.text)) {
    const data = await call(piece, sl, req.targetLang, isWord, signal)
    if (data.src) ctx.detected(data.src)
    const translated = (data.sentences ?? []).map((s) => s.trans ?? "").join("")
    full += translated
    ctx.delta(translated)
    if (isWord) {
      const translit = data.sentences?.find((s) => s.src_translit)?.src_translit
      const d: DictionaryData = {
        word: req.text.trim(),
        translation: translated.trim(),
        phonetic: translit,
        senses: (data.dict ?? []).map((g) => ({
          pos: g.pos,
          terms: (g.entry ?? g.terms.map((t) => ({ word: t })))
            .slice(0, 8)
            .map((e) => ({
              text: (e as { word: string }).word,
              back: (
                e as { reverse_translation?: string[] }
              ).reverse_translation?.slice(0, 4),
              score: (e as { score?: number }).score,
            })),
        })),
        definitions: (data.definitions ?? []).flatMap((g) =>
          g.entry
            .slice(0, 2)
            .map((e) => ({ pos: g.pos, gloss: e.gloss, example: e.example }))
        ),
        examples: (data.examples?.example ?? [])
          .slice(0, 3)
          .map((e) => e.text.replace(/<\/?b>/g, "")),
        synonyms: [
          ...new Set(
            (data.synsets ?? []).flatMap((s) =>
              s.entry.flatMap((e) => e.synonym)
            )
          ),
        ].slice(0, 10),
      }
      if (d.senses.length || d.definitions.length) ctx.dictionary(d)
    }
  }
  return full
}

export function googleTtsUrl(text: string, lang: string) {
  const params = new URLSearchParams({
    ie: "UTF-8",
    client: "tw-ob",
    tl: lang,
    q: text.slice(0, 200),
  })
  return `https://translate.google.com/translate_tts?${params}`
}
