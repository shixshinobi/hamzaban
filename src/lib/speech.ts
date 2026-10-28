let current: HTMLAudioElement | null = null

/** Pronounce text with Google's TTS voice, falling back to the system voice. */
export function speak(text: string, lang: string) {
  stopSpeaking()
  const clean = text.trim().slice(0, 200)
  if (!clean) return
  const code = lang === "auto" ? "en" : lang
  const url = `https://translate.google.com/translate_tts?${new URLSearchParams({ ie: "UTF-8", client: "tw-ob", tl: code, q: clean })}`
  const audio = new Audio(url)
  current = audio
  audio.play().catch(() => {
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = code
    speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  current?.pause()
  current = null
  speechSynthesis.cancel()
}
