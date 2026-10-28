import { profileInput } from "@shared/blocks"
import { ENGINE_META } from "@shared/defaults"
import { guessLanguage } from "@shared/languages"
import type { Settings, TranslateRequest } from "@shared/types"

/**
 * Build a request from the current settings. If the text is already written in the
 * target language (e.g. Persian → Persian), translate into the secondary language.
 */
export function buildRequest(
  settings: Settings,
  input: {
    text: string
    image?: string
    engineId?: string
    sourceLang?: string
    targetLang?: string
    extraInstruction?: string
  }
): TranslateRequest {
  const engineId = input.engineId ?? settings.activeEngineId
  const engine = settings.engines.find((e) => e.id === engineId)
  const sourceLang = input.sourceLang ?? settings.sourceLang
  let targetLang = input.targetLang ?? settings.targetLang
  if (sourceLang === "auto" && input.text) {
    const guess = guessLanguage(input.text)
    if (guess && guess.split("-")[0] === targetLang.split("-")[0])
      targetLang = settings.secondaryLang
  } else if (sourceLang === targetLang) {
    targetLang = settings.secondaryLang
  }
  const isLlm = engine ? engine.kind !== "google" : false
  const layout = profileInput(input.text).layout
  return {
    text: input.text,
    image: input.image,
    sourceLang,
    targetLang,
    engineId,
    styleId: settings.activeStyleId,
    smart: isLlm && settings.smartLayout && layout !== "document",
    extraInstruction: input.extraInstruction,
  }
}

export function engineIsVision(settings: Settings, engineId: string) {
  const e = settings.engines.find((x) => x.id === engineId)
  return e ? ENGINE_META[e.kind].vision : false
}
