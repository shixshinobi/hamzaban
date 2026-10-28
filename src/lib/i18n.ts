import { useApp } from "./store"

const STRINGS = {
  appName: ["همزبان", "Hamzaban"],
  tagline: ["مترجم شیشه‌ای دسکتاپ", "Liquid-glass desktop translator"],
  madeFor: ["ساخته‌شده برای ترویج دانش", "Made to promote knowledge"],
  feedback: ["بازخورد", "Feedback"],
  feedbackHint: [
    "مشکلی دیدید یا پیشنهادی دارید؟ از هر راهی که راحت‌ترید بنویسید.",
    "Found a problem or have an idea? Write through whichever channel suits you.",
  ],
  feedbackGithub: ["گزارش در گیت‌هاب", "Report on GitHub"],
  feedbackEmail: ["ایمیل", "Email"],
  feedbackTelegram: ["تلگرام", "Telegram"],
  feedbackWebsite: ["وب‌سایت", "Website"],
  feedbackSubject: ["بازخورد همزبان", "Hamzaban feedback"],
  feedbackBody: [
    "توضیح دهید چه شد یا چه پیشنهادی دارید:",
    "Describe what happened or what you suggest:",
  ],

  navTranslate: ["ترجمه", "Translate"],
  navImage: ["تصویر", "Image"],
  navPdf: ["PDF", "PDF"],
  navStyles: ["سبک‌ها", "Styles"],
  navHistory: ["تاریخچه", "History"],
  navSettings: ["تنظیمات", "Settings"],

  sourcePlaceholder: [
    "متن را اینجا بنویسید یا بچسبانید…",
    "Type or paste text…",
  ],
  translate: ["ترجمه", "Translate"],
  translating: ["در حال ترجمه", "Translating"],
  stop: ["توقف", "Stop"],
  retry: ["دوباره", "Retry"],
  copy: ["کپی", "Copy"],
  copied: ["کپی شد", "Copied"],
  listen: ["شنیدن", "Listen"],
  paste: ["چسباندن", "Paste"],
  clear: ["پاک کردن", "Clear"],
  swap: ["جابه‌جایی زبان‌ها", "Swap languages"],
  replace: ["جایگزینی در متن", "Replace selection"],
  openInMain: ["باز کردن در پنجره‌ی اصلی", "Open in main window"],
  pin: ["سنجاق کردن", "Pin"],
  unpin: ["برداشتن سنجاق", "Unpin"],
  close: ["بستن", "Close"],
  chars: ["نویسه", "chars"],
  detected: ["تشخیص: ", "Detected: "],
  from: ["از", "From"],
  to: ["به", "To"],
  searchLanguage: ["جستجوی زبان…", "Search language…"],
  noLanguage: ["زبانی پیدا نشد", "No language found"],
  engine: ["موتور ترجمه", "Engine"],
  style: ["سبک و لحن", "Style & tone"],
  noStyle: ["بدون سبک", "No style"],
  styleGoogleNote: [
    "سبک فقط روی مدل‌های زبانی اعمال می‌شود.",
    "Styles apply to language models only.",
  ],
  smartLayout: ["چیدمان هوشمند", "Smart layout"],
  smartLayoutHint: [
    "مدل زبانی خروجی را به شکل کارت، جدول و توضیح می‌چیند.",
    "The model lays out cards, tables and notes.",
  ],
  compareWith: ["ترجمه با", "Try with"],
  resultEmpty: [
    "ترجمه اینجا نمایش داده می‌شود",
    "The translation appears here",
  ],
  resultEmptyHint: [
    "متنی بنویسید، یا هر جای سیستم متنی را انتخاب کنید و میانبر را بزنید.",
    "Type something, or select text anywhere and press the shortcut.",
  ],
  alternatives: ["معادل‌های دیگر", "Alternatives"],
  examples: ["نمونه‌ها", "Examples"],
  synonyms: ["هم‌معنی‌ها", "Synonyms"],
  definitions: ["تعریف", "Definitions"],
  terms: ["واژه‌نامه‌ی این متن", "Key terms"],
  note: ["یادداشت مترجم", "Translator's note"],
  originalText: ["متن اصلی", "Original text"],
  showOriginal: ["نمایش متن اصلی", "Show original"],
  hideOriginal: ["پنهان کردن متن اصلی", "Hide original"],
  extraInstruction: [
    "دستور اضافه برای همین ترجمه (اختیاری)",
    "Extra instruction for this translation (optional)",
  ],

  errNeedsLogin: ["ابتدا وارد حساب شوید", "Sign in first"],
  errNotInstalled: ["این ابزار نصب نیست", "This tool is not installed"],
  errNetwork: ["اتصال برقرار نشد", "Couldn't connect"],
  errHeld: [
    "پیام فرستاده شد ولی جوابی نیامد",
    "The message was sent but no answer came",
  ],
  errHeldHint: [
    "سایت احتمالاً درخواست‌های پشت‌سرهم را بررسی امنیتی می‌کند. پنجره‌اش را باز کنید و اگر چیزی خواست تأیید کنید، یا چند دقیقه بعد دوباره امتحان کنید. برای استفاده‌ی پایدار از حساب ChatGPT، موتور Codex CLI را فعال کنید.",
    "The site is probably running a security check on rapid requests. Open its window and confirm anything it asks, or try again in a few minutes. For reliable use of a ChatGPT account, enable the Codex CLI engine.",
  ],
  openWindow: ["باز کردن پنجره", "Open window"],
  errAuth: ["کلید یا دسترسی معتبر نیست", "Key or access is invalid"],
  errUnknown: ["ترجمه انجام نشد", "Translation failed"],
  signIn: ["ورود", "Sign in"],
  signOut: ["خروج از حساب", "Sign out"],
  install: ["نصب", "Install"],
  configure: ["تنظیم", "Configure"],

  imageTitle: ["ترجمه‌ی تصویر", "Translate an image"],
  imageHint: [
    "تصویر را اینجا رها کنید، بچسبانید یا ناحیه‌ای از صفحه را انتخاب کنید.",
    "Drop an image, paste one, or pick a region of the screen.",
  ],
  captureScreen: ["انتخاب از صفحه", "Capture screen"],
  fromClipboard: ["از کلیپ‌بورد", "From clipboard"],
  chooseFile: ["انتخاب فایل", "Choose file"],
  ocrRunning: ["در حال خواندن متن تصویر", "Reading text from image"],
  ocrEmpty: ["متنی در تصویر پیدا نشد.", "No text was found in the image."],
  ocrFailed: [
    "خواندن متن تصویر انجام نشد.",
    "Could not read the text in the image.",
  ],
  imageRefused: [
    "این موتور تصویر را نپذیرفت؛ متن تصویر روی همین سیستم خوانده و ترجمه می‌شود.",
    "This engine did not accept the image; reading its text locally instead.",
  ],
  ocrLocal: ["خواندن متن با OCR محلی", "Read with local OCR"],
  captureHint: [
    "ناحیه‌ای را برای ترجمه انتخاب کنید",
    "Drag to select an area to translate",
  ],
  captureEsc: ["Esc برای لغو", "Esc to cancel"],

  pdfTitle: ["ترجمه‌ی PDF", "Translate a PDF"],
  pdfHint: [
    "فایل PDF را اینجا رها کنید. متن هر صفحه جدا ترجمه می‌شود و می‌توانید خروجی بگیرید.",
    "Drop a PDF here. Each page is translated and can be exported.",
  ],
  pages: ["صفحه", "pages"],
  page: ["صفحه‌ی", "Page"],
  translateAll: ["ترجمه‌ی همه‌ی صفحه‌ها", "Translate all pages"],
  translatePage: ["ترجمه‌ی این صفحه", "Translate page"],
  export: ["خروجی", "Export"],
  exportMd: ["Markdown (.md)", "Markdown (.md)"],
  exportHtml: ["صفحه‌ی وب (.html)", "Web page (.html)"],
  exportTxt: ["متن ساده (.txt)", "Plain text (.txt)"],
  openAnother: ["فایل دیگر", "Open another"],
  noTextOnPage: [
    "این صفحه متن قابل استخراج ندارد؛ با OCR خوانده می‌شود.",
    "No extractable text; OCR will be used.",
  ],
  sideBySide: ["کنار هم", "Side by side"],
  translationOnly: ["فقط ترجمه", "Translation only"],

  stylesTitle: ["سبک‌ها و اسکیل‌ها", "Styles & skills"],
  stylesHint: [
    "به مدل بگویید با چه لحن و واژه‌هایی ترجمه کند.",
    "Tell the model what tone and words to use.",
  ],
  newStyle: ["سبک جدید", "New style"],
  importSkill: ["وارد کردن اسکیل (.md)", "Import skill (.md)"],
  exportSkill: ["خروجی اسکیل", "Export skill"],
  duplicate: ["کپی از این سبک", "Duplicate"],
  delete: ["حذف", "Delete"],
  name: ["نام", "Name"],
  description: ["توضیح کوتاه", "Short description"],
  instructions: ["دستورالعمل سبک", "Style instructions"],
  instructionsHint: [
    "مثل یک پرامپت بنویسید: لحن، مخاطب، واژه‌های ممنوع، قالب خروجی…",
    "Write it like a prompt: tone, audience, banned words, format…",
  ],
  glossary: ["واژه‌نامه‌ی اجباری", "Mandatory glossary"],
  glossaryHint: [
    "این واژه‌ها همیشه با همین معادل ترجمه می‌شوند.",
    "These terms are always translated this way.",
  ],
  addTerm: ["افزودن واژه", "Add term"],
  sourceTerm: ["واژه‌ی مبدأ", "Source term"],
  targetTerm: ["معادل", "Translation"],
  color: ["رنگ", "Color"],
  builtin: ["پیش‌فرض", "Built-in"],
  useStyle: ["استفاده از این سبک", "Use this style"],
  active: ["فعال", "Active"],
  save: ["ذخیره", "Save"],
  saved: ["ذخیره شد", "Saved"],
  cancel: ["انصراف", "Cancel"],

  historyTitle: ["تاریخچه", "History"],
  historyEmpty: ["هنوز ترجمه‌ای ثبت نشده", "No translations yet"],
  historySearch: ["جستجو در تاریخچه…", "Search history…"],
  clearHistory: ["پاک کردن همه", "Clear all"],

  settingsGeneral: ["عمومی", "General"],
  settingsEngines: ["موتورها", "Engines"],
  settingsShortcuts: ["میانبرها", "Shortcuts"],
  settingsAbout: ["درباره", "About"],
  uiLanguage: ["زبان برنامه", "App language"],
  theme: ["پوسته", "Theme"],
  themeSystem: ["سیستم", "System"],
  themeLight: ["روشن", "Light"],
  themeDark: ["تیره", "Dark"],
  material: ["جنس پنجره", "Window material"],
  materialAuto: ["خودکار", "Auto"],
  materialAcrylic: ["شیشه‌ی مات", "Acrylic"],
  materialMica: ["میکا", "Mica"],
  materialNone: ["ساده", "Solid"],
  materialHint: [
    "شیشه‌ی واقعی سیستم‌عامل روی ویندوز ۱۱ و مک. روی لینوکس نمای شیشه‌ای داخل برنامه ساخته می‌شود.",
    "Native glass on Windows 11 and macOS; drawn in-app on Linux.",
  ],
  launchAtLogin: ["اجرا هنگام ورود به سیستم", "Launch at login"],
  popupAutoHide: [
    "بستن پنجره‌ی شناور با کلیک بیرون",
    "Hide popup when it loses focus",
  ],
  keepHistory: ["نگه‌داشتن تاریخچه", "Keep history"],
  defaultLanguages: ["زبان‌های پیش‌فرض", "Default languages"],
  secondaryLang: [
    "زبان دوم (وقتی متن به زبان مقصد است)",
    "Second language (when text is already in the target)",
  ],
  imageMode: ["خواندن تصویر", "Reading images"],
  imageModeVision: ["مدل بینایی (دقیق‌تر)", "Vision model (better)"],
  imageModeOcr: ["همیشه OCR محلی", "Always local OCR"],

  enginesHint: [
    "موتورهای بدون کلید با حساب کاربری خودتان کار می‌کنند. برای هر کلید API مدل جداگانه تعیین کنید.",
    "Keyless engines use your own accounts. Each API key has its own model.",
  ],
  familyFree: ["رایگان", "Free"],
  familyWeb: ["حساب کاربری", "Account"],
  familyCli: ["خط فرمان", "CLI"],
  familyLocal: ["محلی", "Local"],
  familyApi: ["کلید API", "API key"],
  addApiEngine: ["افزودن کلید API", "Add API key"],
  editEngine: ["ویرایش موتور", "Edit engine"],
  provider: ["سرویس‌دهنده", "Provider"],
  baseUrl: ["نشانی API", "Base URL"],
  apiKey: ["کلید API", "API key"],
  model: ["مدل", "Model"],
  fetchModels: ["دریافت فهرست مدل‌ها", "Fetch models"],
  getKey: ["دریافت کلید", "Get a key"],
  modelPicked: [
    "بهترین مدل در دسترس این کلید انتخاب شد:",
    "Picked the best model this key can use:",
  ],
  executable: ["مسیر فایل اجرایی (اختیاری)", "Executable path (optional)"],
  statusReady: ["آماده", "Ready"],
  statusSignedOut: ["وارد نشده", "Signed out"],
  statusMissing: ["نصب نیست", "Not installed"],
  statusChecking: ["بررسی…", "Checking…"],
  statusNoKey: ["کلید ندارد", "No key"],
  statusOffline: ["در دسترس نیست", "Unavailable"],
  webLoginNote: [
    "یک‌بار در پنجره‌ای که باز می‌شود وارد شوید. اگر ورود با گوگل مسدود شد، با ایمیل وارد شوید.",
    "Sign in once in the window that opens. If Google sign-in is blocked, use email.",
  ],
  cliNote: [
    "پس از نصب، یک‌بار در ترمینال وارد حساب شوید.",
    "After installing, sign in once in the terminal.",
  ],

  shortcutsHint: [
    "میانبرها در کل سیستم کار می‌کنند. روی هر کدام بزنید و کلیدهای جدید را فشار دهید.",
    "Shortcuts work system-wide. Click one and press new keys.",
  ],
  scTranslateSelection: ["ترجمه‌ی متن انتخاب‌شده", "Translate selection"],
  scReplaceSelection: [
    "ترجمه و جایگزینی متن انتخاب‌شده",
    "Translate & replace selection",
  ],
  scCaptureScreen: ["انتخاب ناحیه از صفحه و ترجمه", "Capture screen region"],
  scTranslateClipboard: ["ترجمه‌ی کلیپ‌بورد", "Translate clipboard"],
  scShowMain: ["باز کردن همزبان", "Open Hamzaban"],
  pressKeys: ["کلیدها را فشار دهید…", "Press keys…"],
  reset: ["بازنشانی", "Reset"],
  shortcutConflict: [
    "این میانبرها توسط برنامه‌ی دیگری گرفته شده‌اند",
    "These shortcuts are taken by another app",
  ],

  welcomeTitle: ["به همزبان خوش آمدید", "Welcome to Hamzaban"],
  welcomeBody: [
    "هر جای سیستم متنی را انتخاب کنید و میانبر را بزنید تا ترجمه کنار نشانگر ظاهر شود.",
    "Select text anywhere and press the shortcut — the translation appears next to your cursor.",
  ],
  welcomeTarget: [
    "معمولاً به چه زبانی ترجمه می‌کنید؟",
    "What do you usually translate into?",
  ],
  start: ["شروع", "Get started"],
} as const

export type StringKey = keyof typeof STRINGS

export function translateKey(key: StringKey, lang: "fa" | "en") {
  return STRINGS[key][lang === "fa" ? 0 : 1]
}

export function useT() {
  const lang = useApp((s) => s.settings?.uiLanguage ?? "fa")
  return (key: StringKey) => translateKey(key, lang)
}

export function useUiLang() {
  return useApp((s) => s.settings?.uiLanguage ?? "fa")
}
