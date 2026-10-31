import { app } from "electron"
import fs from "node:fs"
import path from "node:path"
import type { EngineConfig, EngineUsage, RemoteUsage } from "../shared/types"
import { log } from "./log"

/**
 * Requests and tokens each API engine has used, kept in userData/usage.json so the
 * count survives restarts. Only numbers are kept, never the text translated.
 */
const file = () => path.join(app.getPath("userData"), "usage.json")

let store: Record<string, EngineUsage> | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
let listener: ((all: Record<string, EngineUsage>) => void) | undefined

const today = () => new Date().toISOString().slice(0, 10)

function load() {
  if (store) return store
  try {
    store = JSON.parse(fs.readFileSync(file(), "utf8"))
  } catch {
    store = {}
  }
  return store!
}

/** Today's entry for an engine, starting a new day or month as needed. */
function entry(engineId: string): EngineUsage {
  const all = load()
  const day = today()
  const month = day.slice(0, 7)
  const cur = all[engineId]
  if (cur?.day === day) return cur
  const next: EngineUsage = {
    day,
    requests: 0,
    tokens: 0,
    estimated: false,
    month,
    monthRequests: cur?.month === month ? cur.monthRequests : 0,
    monthTokens: cur?.month === month ? cur.monthTokens : 0,
    // A count from the provider is about its own day; yesterday's says nothing now.
    reported: undefined,
  }
  all[engineId] = next
  return next
}

function changed() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(file(), JSON.stringify(store))
    } catch (e) {
      log("usage", "save failed", String(e))
    }
  }, 800)
  listener?.(getUsage())
}

export function onUsageChange(fn: (all: Record<string, EngineUsage>) => void) {
  listener = fn
}

/** Forget the usage of engines that have been deleted. */
export function pruneUsage(engineIds: string[]) {
  const all = load()
  const gone = Object.keys(all).filter((id) => !engineIds.includes(id))
  if (!gone.length) return
  for (const id of gone) delete all[id]
  changed()
}

export function getUsage(): Record<string, EngineUsage> {
  const all = load()
  // Days that have passed show as empty rather than as yesterday's figures.
  for (const id of Object.keys(all)) entry(id)
  return { ...all }
}

/** One answered request. `tokens` is the provider's count, or an estimate. */
export function recordUsage(
  engineId: string,
  tokens: number,
  estimated: boolean
) {
  const e = entry(engineId)
  e.requests++
  e.tokens += tokens
  e.estimated ||= estimated
  e.monthRequests++
  e.monthTokens += tokens
  changed()
}

/**
 * The day's quota from a provider's response headers. Cerebras sends daily figures
 * with a "-day" suffix; Groq's plain request figures are per day (its token figures
 * are per minute and are left out).
 */
export function recordLimits(engineId: string, host: string, h: Headers) {
  const n = (k: string) => {
    const v = h.get(k)
    return v !== null && v !== "" && Number.isFinite(Number(v))
      ? Number(v)
      : undefined
  }
  const daily = {
    requestsLimit: n("x-ratelimit-limit-requests-day"),
    requestsLeft: n("x-ratelimit-remaining-requests-day"),
    tokensLimit: n("x-ratelimit-limit-tokens-day"),
    tokensLeft: n("x-ratelimit-remaining-tokens-day"),
  }
  if (host.endsWith("groq.com")) {
    daily.requestsLimit ??= n("x-ratelimit-limit-requests")
    daily.requestsLeft ??= n("x-ratelimit-remaining-requests")
  }
  if (Object.values(daily).every((v) => v === undefined)) return
  entry(engineId).reported = { ...daily, at: Date.now() }
  changed()
}

/** What OpenRouter says about a key: credit spent and today's free requests. */
export async function remoteUsage(
  engine: EngineConfig
): Promise<RemoteUsage | null> {
  const base = (engine.baseUrl ?? "").replace(/\/+$/, "")
  if (!base.includes("openrouter.ai") || !engine.apiKey) return null
  const res = await fetch(`${base}/key`, {
    headers: { Authorization: `Bearer ${engine.apiKey}` },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return null
  const d = ((await res.json()) as { data?: Record<string, unknown> }).data
  if (!d) return null
  const num = (v: unknown) => (typeof v === "number" ? v : undefined)
  const free = d.free_model_daily_requests as
    { used?: number; limit?: number; remaining?: number } | undefined
  return {
    creditsUsed: num(d.usage),
    creditsLimit: d.limit === null ? null : num(d.limit),
    creditsLeft: d.limit_remaining === null ? null : num(d.limit_remaining),
    freeTier: typeof d.is_free_tier === "boolean" ? d.is_free_tier : undefined,
    freeToday: free
      ? {
          used: num(free.used),
          limit: num(free.limit),
          remaining: num(free.remaining),
        }
      : undefined,
  }
}
