/**
 * Models that cannot translate text: media generation, speech, transcription,
 * embeddings, moderation, realtime/live audio and agent-only models. Covers the
 * naming used by Gemini, OpenAI and OpenAI-compatible hosts (OpenRouter, Groq, …).
 */
const NOT_TEXT =
  /image|imagen|dall-e|sora|veo|lyria|tts|audio|speech|whisper|transcri|realtime|live|embed|moderation|guard|aqa|robotics|computer-use|customtools|search-preview|babbage|davinci|rerank|reward|retriever|safety|nemotron-parse/i

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
