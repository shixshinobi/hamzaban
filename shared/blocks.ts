// Generative UI protocol.
// Language models answer in JSON Lines: one self-contained UI block per line.
// Because every line is complete on its own, the renderer can mount components
// while the answer is still streaming. Lines that are not valid JSON degrade to
// plain paragraphs, so weaker models never break the screen.

export type Block =
  | { t: "meta"; layout?: Layout; title?: string; detected?: string }
  | { t: "word"; text: string; phonetic?: string; translation?: string }
  | { t: "sense"; pos: string; items: string[] }
  | { t: "def"; pos?: string; text: string }
  | { t: "ex"; src: string; tgt?: string }
  | { t: "syn"; items: string[] }
  | { t: "h"; text: string; level?: number }
  | { t: "p"; text: string }
  | { t: "list"; items: string[]; ordered?: boolean }
  | { t: "table"; rows: string[][] }
  | { t: "code"; text: string; lang?: string }
  | { t: "quote"; text: string }
  | { t: "alt"; items: { text: string; note?: string }[] }
  | { t: "note"; text: string; tone?: "info" | "warn" }
  | { t: "term"; items: { src: string; tgt: string }[] }

export type Layout = "dictionary" | "phrase" | "text" | "document"

/** Index of the brace closing the object that opens at `start`, or -1 if it is still incomplete. */
function objectEnd(text: string, start: number): number {
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === "\\") i++
      else if (c === '"') inString = false
    } else if (c === '"') inString = true
    else if (c === "{") depth++
    else if (c === "}" && --depth === 0) return i
  }
  return -1
}

/**
 * Pull blocks out of a model answer. JSON objects are found by brace matching rather
 * than by line, because chat web UIs often render the JSON Lines as one paragraph.
 * Anything that is not a block becomes plain paragraphs.
 */
export function parseBlocks(raw: string, final = false): Block[] {
  const blocks: Block[] = []
  const text = raw.replace(/\r/g, "").replace(/^\s*```[a-z]*\s*$/gim, "")
  let loose = ""
  const flush = () => {
    for (const p of loose.split(/\n{2,}/)) {
      const s = p.trim()
      if (s) blocks.push({ t: "p", text: s })
    }
    loose = ""
  }
  let i = 0
  while (i < text.length) {
    if (text[i] === "{") {
      const end = objectEnd(text, i)
      if (end === -1) {
        // Still streaming: hold the partial object back until it closes.
        if (final) loose += text.slice(i)
        break
      }
      try {
        const obj = JSON.parse(text.slice(i, end + 1))
        if (obj && typeof obj.t === "string") {
          flush()
          blocks.push(obj as Block)
          i = end + 1
          continue
        }
      } catch {
        // not a block; treat the brace as text
      }
    }
    loose += text[i]
    i++
  }
  flush()
  return blocks
}

/** Convert blocks to readable plain text, used for copy, history and replace-in-place. */
export function blocksToText(blocks: Block[]): string {
  const out: string[] = []
  for (const b of blocks) {
    switch (b.t) {
      case "word":
        out.push(b.translation ? b.translation : b.text)
        break
      case "sense":
        out.push(`${b.pos}: ${b.items.join("، ")}`)
        break
      case "p":
      case "h":
      case "quote":
      case "code":
        out.push(b.text)
        break
      case "list":
        out.push(b.items.map((i) => `• ${i}`).join("\n"))
        break
      case "table":
        out.push(b.rows.map((r) => r.join(" | ")).join("\n"))
        break
      default:
        break
    }
  }
  return out.join("\n\n").trim()
}

export interface InputProfile {
  layout: Layout
  chars: number
  words: number
  lines: number
  hasCode: boolean
}

/** Decide which result surface fits the input before any model has answered. */
export function profileInput(text: string): InputProfile {
  const trimmed = text.trim()
  const chars = trimmed.length
  const words = trimmed ? trimmed.split(/\s+/).length : 0
  const lines = trimmed ? trimmed.split(/\n/).length : 0
  const hasCode = /```|^\s{4}\S|[{};]\s*$/m.test(trimmed)
  let layout: Layout
  if (words <= 3 && chars <= 40 && !/[.!?؟。]$/.test(trimmed))
    layout = "dictionary"
  else if (chars <= 160) layout = "phrase"
  else if (chars <= 1400) layout = "text"
  else layout = "document"
  return { layout, chars, words, lines, hasCode }
}

export const BLOCK_PROTOCOL = `Answer ONLY in JSON Lines: one compact JSON object per line, no prose outside JSON, no code fences.
Each object has a "t" field. Available blocks:
{"t":"meta","layout":"dictionary|phrase|text|document","detected":"<ISO code of source language>"}  -> always the first line
{"t":"word","text":"<headword>","phonetic":"<IPA>","translation":"<best single translation>"}
{"t":"sense","pos":"<part of speech in target language>","items":["<translation>", "..."]}
{"t":"def","pos":"...","text":"<short definition in target language>"}
{"t":"ex","src":"<example in source language>","tgt":"<its translation>"}
{"t":"syn","items":["<source-language synonym>", "..."]}
{"t":"h","text":"<heading>","level":2}
{"t":"p","text":"<translated paragraph; inline **bold** and *italic* allowed>"}
{"t":"list","items":["..."],"ordered":false}
{"t":"table","rows":[["header","header"],["cell","cell"]]}
{"t":"code","text":"<code, untranslated>","lang":"<language>"}
{"t":"quote","text":"..."}
{"t":"alt","items":[{"text":"<alternative translation>","note":"<when to use it>"}]}
{"t":"note","text":"<short translator note about ambiguity, idiom or culture>","tone":"info"}
{"t":"term","items":[{"src":"<key term>","tgt":"<chosen translation>"}]}
Rules:
- For a single word or short term use layout "dictionary": word, 1-4 sense blocks, up to 2 def, 2 ex, syn.
- For a phrase or sentence use layout "phrase": one "p" with the translation, then optionally one "alt" with 1-3 alternatives and a "note" only if something is genuinely ambiguous.
- For longer text use layout "text": mirror the source structure with h / p / list / table / code / quote blocks in the same order as the source. Add "term" at the end only for important recurring terms.
- Never translate code, URLs, file paths or placeholders.
- Keep every JSON object on ONE line. Escape quotes and newlines inside strings.`
