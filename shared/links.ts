declare const __APP_VERSION__: string

/** From package.json, filled in at build time (vite.config.ts). */
export const APP_VERSION = __APP_VERSION__

/**
 * Where feedback goes. An empty value hides that option in Settings → About, so a
 * channel can be added later (a Telegram group, the app's website) without code changes.
 */
export const FEEDBACK = {
  /** Repository URL, e.g. https://github.com/<user>/hamzaban; issues open at /issues/new. */
  github: "https://github.com/shixshinobi/hamzaban",
  email: "mohamadishahabedin@gmail.com",
  /** Telegram username or group link, e.g. https://t.me/<name>. */
  telegram: "",
  website: "",
}
