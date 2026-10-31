/**
 * Models that cannot translate text: media generation, speech, transcription,
 * embeddings, moderation, realtime/live audio and agent-only models. Covers the
 * naming used by Gemini, OpenAI and OpenAI-compatible hosts (OpenRouter, Groq, …).
 * ":batch" variants are for offline batch jobs, not live answers.
 */
const NOT_TEXT =
  /image|imagen|dall-e|sora|veo|lyria|tts|audio|speech|whisper|transcri|realtime|live|embed|moderation|guard|aqa|robotics|computer-use|customtools|search-preview|babbage|davinci|rerank|reward|retriever|safety|nemotron-parse|:batch/i

/**
 * Gemini text models fit for translation, from Google's model guide (ai.google.dev,
 * October 2026), with what each is good for. Lite models are left out: they translate
 * word by word, and undocumented or preview ids come and go.
 */
const GEMINI_TRANSLATORS: Record<string, ModelNote> = {
  "gemini-4-argon": "best",
  "gemini-3.8-flash": "recommended",
  "gemini-3.6-flash": "fast",
}

export type ModelNote = "best" | "recommended" | "fast"

export function modelNote(id: string): ModelNote | null {
  return GEMINI_TRANSLATORS[id] ?? null
}

/** A plain release id newer than the reviewed list, e.g. a future "gemini-4.1-flash". */
const isNewerGemini = (id: string) =>
  /^gemini-\d+(\.\d+)?-[a-z]+$/.test(id) &&
  !/lite|preview|exp|tts|live|image|transcribe/.test(id) &&
  version(id) > 3.8

const version = (id: string) =>
  Number(/(?:gemini|gpt|claude[a-z-]*?)-(\d+(?:\.\d+)?)/i.exec(id)?.[1] ?? 0)

/** Newest version first, then full models before mini/lite/nano, then stable before preview. */
function rank(a: string, b: string) {
  const score = (id: string) => [
    version(id),
    /lite|mini|nano|small|tiny/i.test(id) ? 0 : 1,
    /preview|exp|beta/i.test(id) ? 0 : 1,
  ]
  const [x, y] = [score(a), score(b)]
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]
  return a.localeCompare(b)
}

export function isGeminiApi(baseUrl?: string) {
  return !!baseUrl && baseUrl.includes("generativelanguage.googleapis.com")
}

/** The models from a provider's list that can translate, best first. */
export function translationModels(ids: string[], baseUrl?: string) {
  const gemini = isGeminiApi(baseUrl)
  return ids
    .filter((id) => !NOT_TEXT.test(id))
    .filter((id) => !gemini || id in GEMINI_TRANSLATORS || isNewerGemini(id))
    .sort(rank)
}

/**
 * The Gemini model to start with: the recommended Flash, which every key can use.
 * The flagship needs billing on the key's project, so it is a choice, not a default.
 */
export function bestGeminiModel(ids: string[]): string | null {
  const list = translationModels(ids, "generativelanguage.googleapis.com")
  return (
    list.find((id) => GEMINI_TRANSLATORS[id] === "recommended") ??
    list.find((id) => GEMINI_TRANSLATORS[id] !== "best") ??
    list[0] ??
    null
  )
}

export type TranslationFit = "great" | "good"

/** Families that translate well, Persian included: large, general, multilingual. */
const GREAT =
  /deepseek-(v[3-9]|chat|r1(?!-distill))|gpt-oss-120b|gpt-(4o|4\.1|5|6)|claude|gemini-\d[\d.]*-(flash|pro)(?!-lite)|kimi-k2|qwen[\d.]*-(max|plus)|qwen3[\d.]*-(235b|397b|480b)|llama-3\.3-70b|llama-3\.1-405b|llama-4|mistral-large|gemma-[34]-(27|31)b|glm-(4\.[5-9]|5)(?!.*flash)|grok-[3-9]|minimax-m|command-a|nemotron.*(super|ultra)/

/** Families that translate well enough when they are large enough. */
const GOOD =
  /qwen|gemma|mistral-(small|medium)|mixtral|llama|gpt-oss|glm|phi-4|command-r|nemotron|ernie|hunyuan|yi-large|jamba|deepseek/

/** Made for something else: code, maths, pictures, or too small to write well. */
const NOT_FOR_TRANSLATION =
  /coder|codestral|code-|codellama|math|-vl\b|-vl-|vision|ocr|guard|distill|tiny|nano|qwq|phi-\d+(\.\d+)?-mini|diffusion|llama-?2|chatqa|-v0\.1$/

/**
 * How well a model suits translation, judged from its name. Small models (under about
 * 12 billion parameters) translate word by word, so only larger ones are marked; a
 * name without a size is judged by its family. null: not marked, not hidden.
 */
export function translationFit(id: string): TranslationFit | null {
  const name = (id.split("/").pop() ?? id).toLowerCase().replace(/:free$/, "")
  if (NOT_TEXT.test(id) || NOT_FOR_TRANSLATION.test(name)) return null
  // "70b", "8b", "e4b"; a mixture-of-experts "30b-a3b" counts by its full size.
  const size = /(?:^|[-_])e?(\d+(?:\.\d+)?)b(?![a-z])/.exec(name)
  if (size && parseFloat(size[1]) < 12) return null
  if (GREAT.test(name)) return "great"
  if (GOOD.test(name)) return "good"
  return null
}

/** Models fit for translation first (best first), then the rest in their own order. */
export function byTranslationFit(ids: string[]) {
  const order = (id: string) => {
    const fit = translationFit(id)
    return fit === "great" ? 0 : fit === "good" ? 1 : 2
  }
  return ids
    .map((id, i) => ({ id, i, o: order(id) }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map((x) => x.id)
}
