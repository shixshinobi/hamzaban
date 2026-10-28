import { BLOCK_PROTOCOL, profileInput } from "../shared/blocks"
import { languageName } from "../shared/languages"
import type { StyleProfile, TranslateRequest } from "../shared/types"

export interface BuiltPrompt {
  system: string
  user: string
  /** system + user in one string, for engines that only accept a single message. */
  combined: string
  smart: boolean
}

export function buildPrompt(
  req: TranslateRequest,
  style: StyleProfile | null
): BuiltPrompt {
  const target = languageName(req.targetLang)
  const source =
    req.sourceLang === "auto"
      ? "the source language (detect it)"
      : languageName(req.sourceLang)
  const profile = profileInput(req.text)
  const smart = !!req.smart && profile.layout !== "document"

  const parts: string[] = [
    `You are Hamzaban, a meticulous professional translator. Translate from ${source} into ${target}.`,
    "Preserve meaning, register, formatting, numbers, names and markdown structure.",
    "Output only the translation. Never add greetings, explanations or questions unless a block format below asks for notes.",
  ]
  if (req.targetLang === "fa") {
    parts.push(
      "Persian output rules: use standard Persian orthography with zero-width non-joiners (می‌شود، کتاب‌ها), Persian punctuation (، ؛ ؟ « »), and avoid Arabic letters ي and ك. Do not translate word-by-word; write natural contemporary Persian."
    )
  }
  if (style) {
    parts.push(
      `\n## Style profile: ${style.name}\n${style.instructions.trim()}`
    )
    if (style.glossary.length) {
      parts.push(
        "Mandatory glossary (always use these renderings):\n" +
          style.glossary.map((g) => `- ${g.source} => ${g.target}`).join("\n")
      )
    }
  }
  if (req.extraInstruction?.trim())
    parts.push(
      `\nExtra instruction for this request: ${req.extraInstruction.trim()}`
    )
  if (req.image) {
    parts.push(
      "\nThe input is an image. First read all visible text in natural reading order, then translate it. " +
        (smart
          ? 'Start with {"t":"quote","text":"<the original text you read>"} after the meta line, then the translation blocks.'
          : "Output the original text, then a line containing only ---, then the translation.")
    )
  }
  if (smart) parts.push(`\n## Output format\n${BLOCK_PROTOCOL}`)
  else if (profile.layout === "document")
    parts.push("Keep paragraph breaks exactly as in the source.")

  const system = parts.join("\n")
  const user = req.image && !req.text.trim() ? "(see attached image)" : req.text
  const combined = `${system}\n\n---\nTEXT TO TRANSLATE:\n${user}`
  return { system, user, combined, smart }
}
