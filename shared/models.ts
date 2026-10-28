/** Gemini models that do not write text: media generation, speech, embeddings and the like. */
const GEMINI_NOT_TEXT =
  /image|tts|audio|live|embedding|aqa|robotics|computer-use|veo|imagen|lyria|gemma|learnlm/i

/**
 * The strongest Gemini text model in a list: newest version first, then full models
 * before Flash-Lite, then stable before preview. Returns null when nothing fits.
 */
export function bestGeminiModel(ids: string[]): string | null {
  const score = (id: string) => [
    Number(/^gemini-(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? 0),
    /lite/i.test(id) ? 0 : 1,
    /preview|exp/i.test(id) ? 0 : 1,
  ]
  const candidates = ids.filter(
    (id) => /^gemini-\d/.test(id) && !GEMINI_NOT_TEXT.test(id)
  )
  candidates.sort((a, b) => {
    const [x, y] = [score(a), score(b)]
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]
    return a.localeCompare(b)
  })
  return candidates[0] ?? null
}

export function isGeminiApi(baseUrl?: string) {
  return !!baseUrl && baseUrl.includes("generativelanguage.googleapis.com")
}
