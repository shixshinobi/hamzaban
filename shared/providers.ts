/**
 * What each API provider gives for translation, shown when picking one: how much is
 * free, what it costs and how to get a key. Free tiers change without notice; these
 * figures were checked in October 2026 (Aban 1405) and are approximate.
 */

export type ProviderTier = "free" | "limited" | "iran" | "paid" | "custom"

type Text = { fa: string; en: string }
type Lines = { fa: string[]; en: string[] }

export interface ProviderInfo {
  tier: ProviderTier
  /** One line for the list of providers. */
  quota: Text
  /** What to know before choosing it. */
  facts: Lines
  /** How to get a key, step by step. */
  steps: Lines
  /** The provider's own page with the current limits. */
  limitsUrl?: string
  /** It reports what is left of the day's quota with every answer, shown under usage. */
  reportsLimits?: boolean
}

export const PROVIDERS_CHECKED: Text = { fa: "آبان ۱۴۰۵", en: "October 2026" }

/** Order of the groups in the list, most free quota first. */
export const TIER_ORDER: ProviderTier[] = [
  "free",
  "limited",
  "iran",
  "paid",
  "custom",
]

export const PROVIDER_INFO: Record<string, ProviderInfo> = {
  nvidia: {
    tier: "free",
    quota: {
      fa: "رایگان، بدون سقف روزانه؛ حدود ۴۰ درخواست در دقیقه",
      en: "Free, no daily cap; about 40 requests a minute",
    },
    facts: {
      fa: [
        "با حساب رایگان برنامه‌ی توسعه‌دهندگان NVIDIA کار می‌کند.",
        "بیش از ۸۰ مدل دارد، از جمله DeepSeek، Kimi، Gemma و Mistral Large.",
        "برای ترجمه‌ی حجم زیاد، مثل یک کتاب کامل، بهترین گزینه‌ی رایگان است.",
        "درخواست‌ها در صف می‌مانند و مدل‌های پرطرفدار در ساعت‌های شلوغ ممکن است بیش از یک دقیقه طول بکشند. در آزمایش ما openai/gpt-oss-20b در حدود ۱۰ ثانیه جواب داد.",
      ],
      en: [
        "Works with a free NVIDIA Developer Program account.",
        "Over 80 models, including DeepSeek, Kimi, Gemma and Mistral Large.",
        "The best free choice for large jobs such as a whole book.",
        "Requests wait in a queue, and popular models can take over a minute at busy hours. In our test openai/gpt-oss-20b answered in about 10 seconds.",
      ],
    },
    steps: {
      fa: [
        "به build.nvidia.com بروید و با ایمیل حساب بسازید.",
        "یکی از مدل‌ها را باز کنید و «Get API Key» را بزنید.",
        "کلید را که با nvapi- شروع می‌شود کپی کنید و اینجا بچسبانید.",
      ],
      en: [
        "Go to build.nvidia.com and sign up with your email.",
        "Open any model and choose “Get API Key”.",
        "Copy the key (it starts with nvapi-) and paste it here.",
      ],
    },
  },
  cerebras: {
    tier: "free",
    quota: {
      fa: "رایگان: حدود ۱ میلیون توکن در روز (تقریباً ۴۰۰ صفحه)",
      en: "Free: about 1 million tokens a day (roughly 400 pages)",
    },
    facts: {
      fa: [
        "بسیار سریع است؛ یک صفحه در یکی دو ثانیه ترجمه می‌شود.",
        "تعداد درخواست در دقیقه کم است، پس صفحه‌ها کمی با فاصله فرستاده می‌شوند.",
        "باقی‌مانده‌ی سهمیه‌ی روز را خودش گزارش می‌دهد و برنامه نشانش می‌دهد.",
      ],
      en: [
        "Very fast: a page takes a second or two.",
        "Few requests a minute, so pages go out a little apart.",
        "It reports what is left of the day, and the app shows it.",
      ],
    },
    steps: {
      fa: [
        "به cloud.cerebras.ai بروید و حساب بسازید.",
        "از منوی API Keys یک کلید تازه بسازید.",
        "کلید را کپی کنید و اینجا بچسبانید.",
      ],
      en: [
        "Go to cloud.cerebras.ai and sign up.",
        "Create a key under API Keys.",
        "Copy it and paste it here.",
      ],
    },
    limitsUrl: "https://inference-docs.cerebras.ai/support/rate-limits",
    reportsLimits: true,
  },
  groq: {
    tier: "free",
    quota: {
      fa: "رایگان: حدود ۱٬۰۰۰ درخواست در روز برای مدل‌های بزرگ",
      en: "Free: about 1,000 requests a day on the large models",
    },
    facts: {
      fa: [
        "بدون کارت بانکی؛ حدود ۳۰ درخواست در دقیقه.",
        "مدل‌های بزرگ سقف ۱۰۰ تا ۲۰۰ هزار توکن در روز هم دارند (حدود ۵۰ تا ۸۰ صفحه).",
        "مدل‌های کوچک تا ۱۴٬۴۰۰ درخواست در روز می‌دهند، ولی ترجمه‌شان ضعیف‌تر است.",
        "باقی‌مانده‌ی درخواست‌های روز را خودش گزارش می‌دهد.",
      ],
      en: [
        "No card needed; about 30 requests a minute.",
        "Large models are also capped at 100–200 thousand tokens a day (50–80 pages).",
        "Small models allow up to 14,400 requests a day but translate less well.",
        "It reports the requests left for the day.",
      ],
    },
    steps: {
      fa: [
        "به console.groq.com بروید و وارد شوید.",
        "در بخش API Keys روی «Create API Key» بزنید.",
        "کلید را که با gsk_ شروع می‌شود کپی کنید و اینجا بچسبانید.",
      ],
      en: [
        "Go to console.groq.com and sign in.",
        "Under API Keys, choose “Create API Key”.",
        "Copy the key (it starts with gsk_) and paste it here.",
      ],
    },
    limitsUrl: "https://console.groq.com/settings/limits",
    reportsLimits: true,
  },
  openrouter: {
    tier: "free",
    quota: {
      fa: "مدل‌های :free رایگان‌اند: ۵۰ درخواست در روز، یا ۱٬۰۰۰ پس از یک بار خرید ۱۰ دلار اعتبار",
      en: ":free models: 50 requests a day, or 1,000 once you have bought $10 of credit",
    },
    facts: {
      fa: [
        "صدها مدل از سازندگان مختلف با یک کلید؛ مدل‌های رایگان پسوند :free دارند.",
        "حدود ۲۰ درخواست در دقیقه؛ روز بر اساس ساعت UTC (۳:۳۰ بامداد تهران) نو می‌شود.",
        "اعتبار مصرف‌شده و سهمیه‌ی امروز را از خود OpenRouter می‌پرسد و نشان می‌دهد.",
      ],
      en: [
        "Hundreds of models from many makers on one key; free ones end in :free.",
        "About 20 requests a minute; the day resets at midnight UTC.",
        "Shows the credit used and today's free quota, as OpenRouter reports them.",
      ],
    },
    steps: {
      fa: [
        "به openrouter.ai بروید و وارد شوید.",
        "در بخش Keys روی «Create Key» بزنید.",
        "کلید را که با sk-or- شروع می‌شود کپی کنید و اینجا بچسبانید.",
        "برای ترجمه‌ی رایگان، مدلی با پسوند :free انتخاب کنید.",
      ],
      en: [
        "Go to openrouter.ai and sign in.",
        "Under Keys, choose “Create Key”.",
        "Copy the key (it starts with sk-or-) and paste it here.",
        "Pick a model ending in :free to translate for free.",
      ],
    },
    limitsUrl: "https://openrouter.ai/docs/api-reference/limits",
  },
  gemini: {
    tier: "limited",
    quota: {
      fa: "رایگان: حدود ۲۰ درخواست در روز برای هر مدل Flash؛ مدل‌های Flash-Lite حدود ۵۰۰",
      en: "Free: about 20 requests a day per Flash model; Flash-Lite about 500",
    },
    facts: {
      fa: [
        "هر صفحه‌ی PDF یک درخواست است، پس با سهمیه‌ی رایگان روزی حدود ۲۰ صفحه می‌شود.",
        "سهمیه نیمه‌شب به وقت کالیفرنیا (حدود ۱۰:۳۰ صبح تهران) نو می‌شود.",
        "گوگل اتصال از ایران را رد می‌کند؛ فقط با VPN کار می‌کند.",
        "با فعال کردن Billing برای پروژه‌ی همین کلید، سقف خیلی بالاتر می‌رود.",
      ],
      en: [
        "Each PDF page is one request, so the free tier covers about 20 pages a day.",
        "The quota resets at midnight Pacific time.",
        "Google refuses connections from Iran; it only works over a VPN.",
        "Enabling billing on the key's project raises the limits a lot.",
      ],
    },
    steps: {
      fa: [
        "یک VPN با سروری بیرون از ایران روشن کنید؛ گوگل درخواست‌های ایران را رد می‌کند.",
        "به aistudio.google.com/apikey بروید و با حساب گوگل خود وارد شوید.",
        "اگر بار اول است، شرایط استفاده را بپذیرید.",
        "روی «Create API key» بزنید. اگر پروژه‌ای ندارید، گوگل خودش یکی می‌سازد.",
        "کلید را که با AIza شروع می‌شود کپی کنید و اینجا بچسبانید.",
        "«دریافت فهرست مدل‌ها» را بزنید تا برنامه بهترین مدل ترجمه را انتخاب کند.",
        "کلید را به کسی ندهید؛ هر کس آن را داشته باشد از سهمیه‌ی شما استفاده می‌کند.",
      ],
      en: [
        "Turn on a VPN with a server outside Iran; Google refuses requests from Iran.",
        "Go to aistudio.google.com/apikey and sign in with your Google account.",
        "Accept the terms if this is your first time.",
        "Choose “Create API key”. Google creates a project for it if you have none.",
        "Copy the key (it starts with AIza) and paste it here.",
        "Choose “Fetch models” and the app picks the best model for translation.",
        "Keep the key to yourself: anyone who has it uses your quota.",
      ],
    },
    limitsUrl: "https://aistudio.google.com/usage",
  },
  zai: {
    tier: "limited",
    quota: {
      fa: "مدل‌های GLM Flash رایگان‌اند؛ هم‌زمان فقط یک درخواست",
      en: "GLM Flash models are free; one request at a time",
    },
    facts: {
      fa: [
        "مدل‌های پولی هم دارد؛ برای ترجمه‌ی رایگان مدلی با Flash در نامش انتخاب کنید.",
        "چون هم‌زمان یک درخواست می‌پذیرد، برای حجم زیاد کند است.",
      ],
      en: [
        "It has paid models too; pick one with Flash in its name to translate for free.",
        "One request at a time makes it slow for large jobs.",
      ],
    },
    steps: {
      fa: [
        "به z.ai بروید و با ایمیل حساب بسازید.",
        "از بخش API Keys یک کلید بسازید و اینجا بچسبانید.",
      ],
      en: [
        "Go to z.ai and sign up with your email.",
        "Create a key under API Keys and paste it here.",
      ],
    },
  },
  sambanova: {
    tier: "limited",
    quota: {
      fa: "رایگان: حدود ۲۰۰ هزار توکن در روز برای هر مدل، با سقف کم درخواست",
      en: "Free: about 200 thousand tokens a day per model, with a low request cap",
    },
    facts: {
      fa: [
        "حدود ۲۰ درخواست در دقیقه؛ بعضی منابع سقف روزانه‌ی درخواست را هم کم گزارش کرده‌اند.",
        "مدل‌های DeepSeek V3.2 و Llama 3.3 را دارد که فارسی را خوب ترجمه می‌کنند.",
        "رایگان فقط تا وقتی است که روش پرداختی به حساب اضافه نکرده باشید.",
      ],
      en: [
        "About 20 requests a minute; some sources report a low daily request cap too.",
        "Has DeepSeek V3.2 and Llama 3.3, which translate Persian well.",
        "Free only while no payment method is on the account.",
      ],
    },
    steps: {
      fa: [
        "به cloud.sambanova.ai بروید و حساب بسازید.",
        "از بخش API Keys یک کلید بسازید و اینجا بچسبانید.",
      ],
      en: [
        "Go to cloud.sambanova.ai and sign up.",
        "Create a key under API Keys and paste it here.",
      ],
    },
  },
  mistral: {
    tier: "limited",
    quota: {
      fa: "سهمیه‌ی رایگان ماهانه دارد، ولی شرایطش در ۲۰۲۶ تغییر کرده است",
      en: "Has a monthly free allowance, but its terms changed in 2026",
    },
    facts: {
      fa: [
        "سقف واقعی فقط در پنل خودش دیده می‌شود؛ پیش از ترجمه‌ی حجم زیاد آن را ببینید.",
        "ممکن است تأیید شماره‌ی تلفن بخواهد.",
      ],
      en: [
        "The real limits only show in its console; check them before a large job.",
        "It may ask to verify a phone number.",
      ],
    },
    steps: {
      fa: [
        "به console.mistral.ai بروید و حساب بسازید.",
        "در بخش API Keys یک کلید بسازید و اینجا بچسبانید.",
      ],
      en: [
        "Go to console.mistral.ai and sign up.",
        "Create a key under API Keys and paste it here.",
      ],
    },
    limitsUrl: "https://admin.mistral.ai/plateforme/limits",
  },
  avalai: iranGateway("avalai.ir"),
  gapgpt: iranGateway("gapgpt.app"),
  metis: iranGateway("metisai.ir"),
  boxapi: iranGateway("boxapi.ir", {
    fa: "برای امتحان، اعتبار رایگان آزمایشی می‌دهد. نام مدل‌ها به شکل سازنده/مدل است، مثل google/gemini-3.8-flash.",
    en: "Gives free trial credit to try it. Models are named maker/model, e.g. google/gemini-3.8-flash.",
  }),
  openai: paid(
    { fa: "پولی؛ هزینه بر اساس توکن", en: "Paid per token" },
    "platform.openai.com"
  ),
  anthropic: paid(
    { fa: "پولی؛ هزینه بر اساس توکن", en: "Paid per token" },
    "console.anthropic.com"
  ),
  deepseek: paid(
    {
      fa: "پولی ولی بسیار ارزان؛ ترجمه‌ی فارسی خوب",
      en: "Paid but very cheap; good Persian",
    },
    "platform.deepseek.com"
  ),
  xai: paid(
    { fa: "پولی؛ هزینه بر اساس توکن", en: "Paid per token" },
    "console.x.ai"
  ),
  custom: {
    tier: "custom",
    quota: {
      fa: "هر سرویس واسط یا محلی که API آن سازگار با OpenAI باشد",
      en: "Any gateway or local server with an OpenAI-compatible API",
    },
    facts: {
      fa: [
        "برای سرویس‌های واسط (third-party) که این فهرست ندارد، یا سرورهایی مثل LM Studio.",
        "سهمیه و قیمت را خود سرویس تعیین می‌کند؛ آن را در پنل سرویس ببینید.",
      ],
      en: [
        "For third-party gateways not in this list, or servers such as LM Studio.",
        "The service sets its own quota and prices; check them in its dashboard.",
      ],
    },
    steps: {
      fa: [
        "در مستندات سرویس، آدرس درخواست را پیدا کنید؛ معمولاً شبیه https://…/v1/chat/completions است.",
        "بخش پیش از /chat/completions را در «نشانی API» بگذارید؛ معمولاً به /v1 ختم می‌شود.",
        "کلید سرویس را بچسبانید.",
        "«دریافت فهرست مدل‌ها» را بزنید و مدل را انتخاب کنید. اگر فهرست نیامد، نام مدل را از مستندات سرویس بنویسید.",
      ],
      en: [
        "Find the request URL in the service's docs; it usually looks like https://…/v1/chat/completions.",
        "Put the part before /chat/completions in “Base URL”; it usually ends in /v1.",
        "Paste the service's key.",
        "Choose “Fetch models” and pick one. If no list comes back, type the model name from the docs.",
      ],
    },
  },
}

/** Iranian gateways: paid in rials, reachable without a VPN. */
function iranGateway(site: string, extra?: Text): ProviderInfo {
  const info: ProviderInfo = {
    tier: "iran",
    quota: {
      fa: "پولی با پرداخت ریالی؛ بدون نیاز به VPN",
      en: "Paid in rials; no VPN needed",
    },
    facts: {
      fa: [
        "واسطی ایرانی برای مدل‌های GPT، Claude، Gemini و دیگران با یک کلید.",
        "هزینه بر اساس توکن از اعتبار حساب کم می‌شود؛ قیمت هر مدل را در سایت ببینید.",
        "مدل‌های موجود را با «دریافت فهرست مدل‌ها» بگیرید؛ نام‌ها ممکن است با سازنده‌ی اصلی فرق کند.",
      ],
      en: [
        "An Iranian gateway to GPT, Claude, Gemini and more on one key.",
        "Each request's tokens come off the account balance; see each model's price on the site.",
        "Use “Fetch models” for what it offers; names may differ from the original maker's.",
      ],
    },
    steps: {
      fa: [
        `به ${site} بروید و حساب بسازید.`,
        "حساب را شارژ کنید.",
        "در پنل، بخش کلیدهای API، یک کلید بسازید و اینجا بچسبانید.",
      ],
      en: [
        `Go to ${site} and sign up.`,
        "Top up the account.",
        "Create an API key in the dashboard and paste it here.",
      ],
    },
  }
  if (extra) {
    info.facts.fa.push(extra.fa)
    info.facts.en.push(extra.en)
  }
  return info
}

function paid(quota: Text, site: string): ProviderInfo {
  return {
    tier: "paid",
    quota,
    facts: {
      fa: [
        "سهمیه‌ی رایگان ندارد؛ پیش از استفاده باید حساب را شارژ کنید.",
        "سرویس خارجی است و از ایران معمولاً فقط با VPN و کارت بانکی خارجی در دسترس است.",
      ],
      en: [
        "No free quota; the account needs credit first.",
        "A foreign service: from Iran it usually needs a VPN and a foreign card.",
      ],
    },
    steps: {
      fa: [
        `به ${site} بروید و وارد شوید.`,
        "اعتبار بخرید و در بخش API Keys یک کلید بسازید.",
        "کلید را کپی کنید و اینجا بچسبانید.",
      ],
      en: [
        `Go to ${site} and sign in.`,
        "Buy credit and create a key under API Keys.",
        "Copy it and paste it here.",
      ],
    },
  }
}
