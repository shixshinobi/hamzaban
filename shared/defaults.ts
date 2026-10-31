import type {
  EngineConfig,
  EngineFamily,
  EngineKind,
  Settings,
  StyleProfile,
} from "./types"

export const ENGINE_META: Record<
  EngineKind,
  { family: EngineFamily; vision: boolean; label: string; labelFa: string }
> = {
  google: {
    family: "free",
    vision: false,
    label: "Google Translate",
    labelFa: "گوگل ترنسلیت",
  },
  "chatgpt-web": {
    family: "web",
    vision: true,
    label: "ChatGPT (account)",
    labelFa: "ChatGPT (حساب کاربری)",
  },
  "claude-web": {
    family: "web",
    vision: true,
    label: "Claude (account)",
    labelFa: "Claude (حساب کاربری)",
  },
  "gemini-web": {
    family: "web",
    vision: true,
    label: "Gemini (account)",
    labelFa: "Gemini (حساب کاربری)",
  },
  "codex-cli": {
    family: "cli",
    vision: true,
    label: "Codex CLI",
    labelFa: "Codex CLI",
  },
  "claude-cli": {
    family: "cli",
    vision: true,
    label: "Claude Code",
    labelFa: "Claude Code",
  },
  "gemini-cli": {
    family: "cli",
    vision: true,
    label: "Gemini CLI",
    labelFa: "Gemini CLI",
  },
  ollama: { family: "local", vision: true, label: "Ollama", labelFa: "Ollama" },
  openai: {
    family: "api",
    vision: true,
    label: "OpenAI-compatible API",
    labelFa: "API سازگار با OpenAI",
  },
  anthropic: {
    family: "api",
    vision: true,
    label: "Anthropic API",
    labelFa: "API آنتروپیک",
  },
}

export interface ApiPreset {
  id: string
  name: string
  kind: "openai" | "anthropic"
  baseUrl: string
  model: string
  keyUrl?: string
}

/** Most free quota first; see shared/providers.ts for what each one gives. */
export const API_PRESETS: ApiPreset[] = [
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    kind: "openai",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    // The quickest to answer in a test in October 2026; the popular large models
    // often sat in the queue for over a minute.
    model: "openai/gpt-oss-20b",
    keyUrl: "https://build.nvidia.com",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    kind: "openai",
    baseUrl: "https://api.cerebras.ai/v1",
    model: "gpt-oss-120b",
    keyUrl: "https://cloud.cerebras.ai",
  },
  {
    id: "groq",
    name: "Groq",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    keyUrl: "https://console.groq.com/keys",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    // Free to use; any model ending in :free is.
    model: "google/gemma-4-31b-it:free",
    keyUrl: "https://openrouter.ai/keys",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    kind: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    // Recommended for translation and usable on every key; the flagship needs billing.
    model: "gemini-3.8-flash",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "zai",
    name: "Z.ai (GLM)",
    kind: "openai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    model: "glm-4.7-flash",
    keyUrl: "https://z.ai",
  },
  {
    id: "sambanova",
    name: "SambaNova",
    kind: "openai",
    baseUrl: "https://api.sambanova.ai/v1",
    model: "DeepSeek-V3.2",
    keyUrl: "https://cloud.sambanova.ai",
  },
  {
    id: "mistral",
    name: "Mistral",
    kind: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    keyUrl: "https://console.mistral.ai/api-keys",
  },
  {
    id: "avalai",
    name: "AvalAI",
    kind: "openai",
    baseUrl: "https://api.avalai.ir/v1",
    model: "gpt-5-mini",
    keyUrl: "https://avalai.ir",
  },
  {
    id: "gapgpt",
    name: "GapGPT",
    kind: "openai",
    baseUrl: "https://api.gapgpt.app/v1",
    model: "gpt-5-mini",
    keyUrl: "https://gapgpt.app",
  },
  {
    id: "metis",
    name: "Metis",
    kind: "openai",
    baseUrl: "https://api.metisai.ir/openai/v1",
    model: "gpt-5-mini",
    keyUrl: "https://metisai.ir",
  },
  {
    id: "boxapi",
    name: "BoxAPI",
    kind: "openai",
    baseUrl: "https://ai.boxapi.ir/ai/v1",
    // Its models are named maker/model, as on OpenRouter.
    model: "google/gemini-3.8-flash",
    keyUrl: "https://boxapi.ir/ai-api/",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    kind: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-5-mini",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-haiku-5-5",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "xai",
    name: "xAI Grok",
    kind: "openai",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-4",
    keyUrl: "https://console.x.ai",
  },
  {
    id: "custom",
    name: "Custom",
    kind: "openai",
    // Filled in from the service's docs; the field shows an example.
    baseUrl: "",
    model: "",
  },
]

export const DEFAULT_ENGINES: EngineConfig[] = [
  { id: "google", kind: "google", name: "Google", enabled: true },
  { id: "chatgpt-web", kind: "chatgpt-web", name: "ChatGPT", enabled: true },
  { id: "claude-web", kind: "claude-web", name: "Claude", enabled: true },
  { id: "gemini-web", kind: "gemini-web", name: "Gemini", enabled: true },
  { id: "codex-cli", kind: "codex-cli", name: "Codex", enabled: false },
  { id: "claude-cli", kind: "claude-cli", name: "Claude Code", enabled: false },
  { id: "gemini-cli", kind: "gemini-cli", name: "Gemini CLI", enabled: false },
  {
    id: "ollama",
    kind: "ollama",
    name: "Ollama",
    enabled: false,
    baseUrl: "http://localhost:11434",
    model: "",
  },
]

export const BUILTIN_STYLES: StyleProfile[] = [
  {
    id: "faithful",
    name: "وفادار و روان",
    description: "معنا دقیق منتقل شود، ولی متن مقصد طبیعی خوانده شود.",
    instructions:
      "معنای متن را کامل و بدون افزودن یا حذف منتقل کن. ساختار جمله‌ها را به شکل طبیعی زبان مقصد بازنویسی کن، نه واژه‌به‌واژه. لحن نویسنده را نگه دار.",
    glossary: [],
    hue: 220,
    builtin: true,
  },
  {
    id: "formal",
    name: "رسمی و اداری",
    description: "مناسب نامه، گزارش و متن‌های سازمانی.",
    instructions:
      "از زبان رسمی و مؤدبانه استفاده کن. از واژه‌های محاوره‌ای و شکسته پرهیز کن. جمله‌ها کامل و دقیق باشند. اصطلاحات تخصصی را به معادل جاافتاده برگردان.",
    glossary: [],
    hue: 250,
    builtin: true,
  },
  {
    id: "casual",
    name: "محاوره‌ای و صمیمی",
    description: "برای پیام، گفتگو و شبکه‌های اجتماعی.",
    instructions:
      "متن را مثل گفتگوی روزمره ترجمه کن. اگر زبان مقصد فارسی است از زبان گفتاری معیار و شکسته‌ی رایج استفاده کن. اصطلاحات عامیانه را با معادل طبیعی جایگزین کن، نه ترجمه‌ی تحت‌اللفظی.",
    glossary: [],
    hue: 32,
    builtin: true,
  },
  {
    id: "academic",
    name: "علمی و دانشگاهی",
    description: "مقاله، پایان‌نامه و متن پژوهشی.",
    instructions:
      "اصطلاحات علمی را با معادل مصوب یا رایج در متون دانشگاهی برگردان و در اولین تکرار، اصل انگلیسی را داخل پرانتز بیاور. ارجاع‌ها، فرمول‌ها و اعداد را دست نزن. لحن بی‌طرف و دقیق باشد.",
    glossary: [],
    hue: 165,
    builtin: true,
  },
  {
    id: "technical",
    name: "فنی و نرم‌افزاری",
    description: "مستندات، رابط کاربری و متن‌های برنامه‌نویسی.",
    instructions:
      "خواننده‌ی این متن برنامه‌نویس یا کاربر حرفه‌ای نرم‌افزار است.\n" +
      "- نام محصول‌ها، ابزارها، کتابخانه‌ها، توابع، دستورها، متغیرها، مسیر فایل‌ها و بلوک‌های کد را دقیقاً به همان شکل انگلیسی بنویس (مثل Claude Code، npm install، CLAUDE.md) و آوانویسی فارسی نکن.\n" +
      "- برای اصطلاحی که معادل فارسی جاافتاده دارد همان را به کار ببر (مخزن برای repository، شاخه برای branch، وابستگی برای dependency، پایگاه داده برای database). اگر برنامه‌نویس‌های فارسی‌زبان خود واژه‌ی انگلیسی را به کار می‌برند (API، commit، deploy، framework)، همان را با حروف لاتین بیاور.\n" +
      "- هر اصطلاح را در سراسر متن یک‌جور ترجمه کن.\n" +
      "- مثل یک نویسنده‌ی فنی فارسی‌زبان بنویس: روشن، دقیق و روان، بدون گرته‌برداری از ساختار جمله‌ی انگلیسی. چیزی اضافه یا کم نکن.",
    glossary: [],
    hue: 280,
    builtin: true,
  },
  {
    id: "literary",
    name: "ادبی",
    description: "داستان، شعر و نثر ادبی.",
    instructions:
      "به آهنگ و تصویرهای متن وفادار بمان. واژه‌های ادبی و خوش‌آهنگ انتخاب کن. استعاره‌ها را اگر در زبان مقصد کار می‌کنند نگه دار، وگرنه معادلی هم‌وزن بساز.",
    glossary: [],
    hue: 340,
    builtin: true,
  },
]

// Alt+Shift is the Windows keyboard-layout switch, so every default avoids it.
// Q is a nod to QTranslate's Ctrl+Q; all of these are free on GNOME/KDE too.
export const DEFAULT_SHORTCUTS = {
  translateSelection: "CommandOrControl+Alt+Q",
  replaceSelection: "CommandOrControl+Alt+R",
  captureScreen: "CommandOrControl+Alt+S",
  translateClipboard: "CommandOrControl+Alt+X",
  showMain: "CommandOrControl+Alt+H",
}

/** Everything Settings → Appearance can reset. */
export const APPEARANCE_DEFAULTS = {
  theme: "system",
  material: "auto",
  accent: "blue",
  backdrop: "aurora",
  transparency: 50,
  blur: 22,
} satisfies Partial<Settings>

export const DEFAULT_SETTINGS: Settings = {
  uiLanguage: "fa",
  ...APPEARANCE_DEFAULTS,
  sourceLang: "auto",
  targetLang: "fa",
  secondaryLang: "en",
  activeEngineId: "google",
  activeStyleId: "faithful",
  engines: DEFAULT_ENGINES,
  styles: BUILTIN_STYLES,
  shortcuts: DEFAULT_SHORTCUTS,
  smartLayout: true,
  imageMode: "vision",
  popupAutoHide: true,
  launchAtLogin: false,
  keepHistory: true,
  onboarded: false,
}

export function engineSupportsStyle(kind: EngineKind) {
  return kind !== "google"
}
