export interface Language {
  code: string
  en: string
  fa: string
  rtl?: boolean
  /** tesseract traineddata code */
  ocr?: string
}

export const LANGUAGES: Language[] = [
  { code: "fa", en: "Persian", fa: "فارسی", rtl: true, ocr: "fas" },
  { code: "en", en: "English", fa: "انگلیسی", ocr: "eng" },
  { code: "ar", en: "Arabic", fa: "عربی", rtl: true, ocr: "ara" },
  { code: "tr", en: "Turkish", fa: "ترکی استانبولی", ocr: "tur" },
  { code: "fr", en: "French", fa: "فرانسوی", ocr: "fra" },
  { code: "de", en: "German", fa: "آلمانی", ocr: "deu" },
  { code: "es", en: "Spanish", fa: "اسپانیایی", ocr: "spa" },
  { code: "it", en: "Italian", fa: "ایتالیایی", ocr: "ita" },
  { code: "pt", en: "Portuguese", fa: "پرتغالی", ocr: "por" },
  { code: "ru", en: "Russian", fa: "روسی", ocr: "rus" },
  {
    code: "zh-CN",
    en: "Chinese (Simplified)",
    fa: "چینی ساده",
    ocr: "chi_sim",
  },
  {
    code: "zh-TW",
    en: "Chinese (Traditional)",
    fa: "چینی سنتی",
    ocr: "chi_tra",
  },
  { code: "ja", en: "Japanese", fa: "ژاپنی", ocr: "jpn" },
  { code: "ko", en: "Korean", fa: "کره‌ای", ocr: "kor" },
  { code: "hi", en: "Hindi", fa: "هندی", ocr: "hin" },
  { code: "ur", en: "Urdu", fa: "اردو", rtl: true, ocr: "urd" },
  { code: "ps", en: "Pashto", fa: "پشتو", rtl: true },
  { code: "ku", en: "Kurdish (Kurmanji)", fa: "کردی کرمانجی" },
  { code: "ckb", en: "Kurdish (Sorani)", fa: "کردی سورانی", rtl: true },
  { code: "az", en: "Azerbaijani", fa: "آذربایجانی", ocr: "aze" },
  { code: "hy", en: "Armenian", fa: "ارمنی" },
  { code: "ka", en: "Georgian", fa: "گرجی" },
  { code: "he", en: "Hebrew", fa: "عبری", rtl: true, ocr: "heb" },
  { code: "nl", en: "Dutch", fa: "هلندی", ocr: "nld" },
  { code: "sv", en: "Swedish", fa: "سوئدی", ocr: "swe" },
  { code: "no", en: "Norwegian", fa: "نروژی", ocr: "nor" },
  { code: "da", en: "Danish", fa: "دانمارکی", ocr: "dan" },
  { code: "fi", en: "Finnish", fa: "فنلاندی", ocr: "fin" },
  { code: "pl", en: "Polish", fa: "لهستانی", ocr: "pol" },
  { code: "uk", en: "Ukrainian", fa: "اوکراینی", ocr: "ukr" },
  { code: "cs", en: "Czech", fa: "چکی", ocr: "ces" },
  { code: "el", en: "Greek", fa: "یونانی", ocr: "ell" },
  { code: "ro", en: "Romanian", fa: "رومانیایی", ocr: "ron" },
  { code: "hu", en: "Hungarian", fa: "مجاری", ocr: "hun" },
  { code: "id", en: "Indonesian", fa: "اندونزیایی", ocr: "ind" },
  { code: "ms", en: "Malay", fa: "مالایی", ocr: "msa" },
  { code: "th", en: "Thai", fa: "تایلندی", ocr: "tha" },
  { code: "vi", en: "Vietnamese", fa: "ویتنامی", ocr: "vie" },
  { code: "bn", en: "Bengali", fa: "بنگالی", ocr: "ben" },
  { code: "ta", en: "Tamil", fa: "تامیلی", ocr: "tam" },
  { code: "sw", en: "Swahili", fa: "سواحیلی", ocr: "swa" },
  { code: "tg", en: "Tajik", fa: "تاجیکی" },
  { code: "uz", en: "Uzbek", fa: "ازبکی", ocr: "uzb" },
  { code: "la", en: "Latin", fa: "لاتین", ocr: "lat" },
]

export const AUTO: Language = {
  code: "auto",
  en: "Detect language",
  fa: "تشخیص خودکار",
}

export function findLanguage(code: string): Language | undefined {
  if (code === "auto") return AUTO
  return (
    LANGUAGES.find((l) => l.code === code) ??
    LANGUAGES.find((l) => l.code === code.split("-")[0])
  )
}

export function languageName(code: string, ui: "fa" | "en" = "en") {
  const l = findLanguage(code)
  return l ? l[ui] : code
}

export function isRtl(code: string) {
  return !!findLanguage(code)?.rtl
}

const RTL_CHARS = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/g
const LTR_CHARS = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/g

/** Guess direction of arbitrary text by counting strong characters. */
export function textDir(text: string): "rtl" | "ltr" {
  const sample = text.slice(0, 600)
  const rtl = sample.match(RTL_CHARS)?.length ?? 0
  const ltr = sample.match(LTR_CHARS)?.length ?? 0
  return rtl > ltr ? "rtl" : "ltr"
}

/** Cheap script-based guess used before an engine reports the detected language. */
export function guessLanguage(text: string): string | null {
  const s = text.slice(0, 400)
  if (/[پچژگکی]/.test(s)) return "fa"
  if (/[\u0600-\u06FF]/.test(s)) return "ar"
  if (/[\u0590-\u05FF]/.test(s)) return "he"
  if (/[\u0400-\u04FF]/.test(s)) return "ru"
  if (/[\u3040-\u30FF]/.test(s)) return "ja"
  if (/[\uAC00-\uD7AF]/.test(s)) return "ko"
  if (/[\u4E00-\u9FFF]/.test(s)) return "zh-CN"
  if (/[A-Za-z]/.test(s)) return "en"
  return null
}
