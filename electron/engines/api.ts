import { isGeminiApi, translationModels } from "../../shared/models"
import { log } from "../log"
import { recordLimits, recordUsage } from "../usage"
import {
  EngineError,
  httpError,
  readLines,
  type EngineContext,
  type EngineRunner,
} from "./types"

function dataUrlParts(dataUrl: string) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  return m ? { mime: m[1], data: m[2] } : { mime: "image/png", data: dataUrl }
}

function netError(e: unknown, signal: AbortSignal): never {
  if (e instanceof EngineError) throw e
  const msg = (e as Error)?.message ?? String(e)
  throw new EngineError(msg, signal.aborted ? "cancelled" : "network")
}

/** The answer did not start, and another model may well succeed. */
const RETRYABLE = new Set([404, 429, 500, 502, 503, 504])

const geminiLists = new Map<string, Promise<string[]>>()

/** The key's translation-capable Gemini models, best first, fetched once per session. */
function geminiModels(engine: EngineContext["engine"]) {
  const key = `${engine.baseUrl}|${(engine.apiKey ?? "").slice(-6)}`
  let list = geminiLists.get(key)
  if (!list) {
    list = listModels("openai", engine.baseUrl ?? "", engine.apiKey ?? "")
      .then((ids) => translationModels(ids, engine.baseUrl))
      .catch(() => [])
    geminiLists.set(key, list)
  }
  return list
}

/**
 * Models whose daily quota ran out, until the time Google said it resets. Asking again
 * before then only burns more of the user's requests and time.
 */
const exhausted = new Map<string, { until: number; error: EngineError }>()
const exhaustedKey = (engine: EngineContext["engine"], model: string) =>
  `${engine.baseUrl}|${(engine.apiKey ?? "").slice(-6)}|${model}`

function spentError(engine: EngineContext["engine"], model: string) {
  const hit = exhausted.get(exhaustedKey(engine, model))
  if (!hit) return null
  if (hit.until > Date.now()) return hit.error
  exhausted.delete(exhaustedKey(engine, model))
  return null
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(id)
        reject(new EngineError("cancelled", "cancelled"))
      },
      { once: true }
    )
  })

export const runOpenAI: EngineRunner = async (ctx) => {
  const { engine } = ctx
  if (!engine.model)
    throw new EngineError("No model selected for this API engine.", "auth")
  if (!isGeminiApi(engine.baseUrl)) return openAIOnce(ctx, engine.model)
  // Gemini models are often overloaded for a while (503), and Pro models have no quota
  // on keys without billing (429). Rather than fail, try the next best model.
  const tried = [engine.model]
  let first: EngineError | null = null
  let resent = false
  let waited = false
  const nextModel = async () => {
    if (tried.length >= 4) return null
    const next = (await geminiModels(engine)).find(
      (m) => !tried.includes(m) && !spentError(engine, m)
    )
    if (next) tried.push(next)
    return next ?? null
  }
  for (;;) {
    const model = tried[tried.length - 1]
    const spent = spentError(engine, model)
    if (spent) {
      first ??= spent
      const next = await nextModel()
      if (!next) throw first
      log("api", `${model} is out of daily quota, using ${next}`)
      ctx.stage("retrying", next)
      continue
    }
    let wrote = false
    try {
      return await openAIOnce(
        {
          ...ctx,
          delta: (t) => {
            wrote = true
            ctx.delta(t)
          },
        },
        model
      )
    } catch (e) {
      const err = e as EngineError
      const retry = err.status ? RETRYABLE.has(err.status) : err.timedOut
      if ((wrote && !err.midStream) || !retry || ctx.signal.aborted)
        throw first ?? err
      if (wrote) ctx.snapshot("") // drop the cut-off half answer before the retry
      // An answer cut off half way is usually a one-off: the same model gets one more go.
      if (err.midStream && !resent) {
        resent = true
        log("api", `${model} cut off (${err.status}), sending again`)
        ctx.stage("retrying", model)
        continue
      }
      if (err.status === 429 && err.daily) {
        exhausted.set(exhaustedKey(engine, model), {
          until: Date.now() + (err.retryAfter ?? 3600) * 1000,
          error: err,
        })
      } else if (err.status === 429 && !waited && (err.retryAfter ?? 0) <= 60) {
        // A per-minute limit clears in seconds: wait it out rather than spend another model.
        waited = true
        const s = err.retryAfter ?? 20
        log("api", `${model} rate limited, waiting ${s}s`)
        ctx.stage("waiting", `${s}`)
        await wait(s * 1000, ctx.signal)
        continue
      }
      first ??= err
      const next = await nextModel()
      if (!next) throw first
      log("api", `${model} failed (${err.status ?? "timeout"}), trying ${next}`)
      ctx.stage("retrying", next)
    }
  }
}

async function openAIOnce(
  { engine, prompt, req, signal, delta, stage }: EngineContext,
  model: string
): Promise<string> {
  const base = (engine.baseUrl || "https://api.openai.com/v1").replace(
    /\/+$/,
    ""
  )
  const content: unknown = req.image
    ? [
        { type: "text", text: prompt.user },
        { type: "image_url", image_url: { url: req.image } },
      ]
    : prompt.user
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (engine.apiKey) headers.Authorization = `Bearer ${engine.apiKey}`
  if (base.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://github.com/hamzaban"
    headers["X-Title"] = "Hamzaban"
  }
  const started = Date.now()
  const step = (name: string, extra?: unknown) =>
    log(
      "api",
      `${((Date.now() - started) / 1000).toFixed(1)}s`,
      name,
      ...(extra === undefined ? [] : [extra])
    )
  stage("sending")
  step("request", {
    host: new URL(base).host,
    model,
    image: !!req.image,
    imageKB: req.image ? Math.round(req.image.length / 1365) : 0,
  })
  // No answer at all after a while usually means a stuck connection: give up with a
  // clear error instead of spinning forever. Each streamed piece resets the clock.
  const idle = new AbortController()
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  const armIdle = (ms: number) => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => idle.abort(), ms)
  }
  // Gemini can switch to another model, so a silent one is dropped sooner.
  const firstWait = isGeminiApi(base) ? 60 : 90
  armIdle(firstWait * 1000)
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    signal: AbortSignal.any([signal, idle.signal]),
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content },
      ],
      // Gemini models always think; translation needs little of it and a lot less waiting.
      ...(isGeminiApi(base) ? { reasoning_effort: "low" } : {}),
    }),
  }).catch((e) => {
    clearTimeout(idleTimer)
    step("failed before a response", { message: (e as Error)?.message })
    if (idle.signal.aborted && !signal.aborted) {
      const err = new EngineError(
        `${model} did not respond in ${firstWait} s.`,
        "network"
      )
      err.timedOut = true
      throw err
    }
    return netError(e, signal)
  })
  step("response", { status: res.status })
  recordLimits(engine.id, new URL(base).host, res.headers)
  if (!res.ok) {
    clearTimeout(idleTimer)
    throw await httpError(res)
  }
  stage("thinking")
  let full = ""
  let finish = ""
  let tokens: number | undefined
  // Gemini reports a failure part way through as a plain (multi-line) JSON body
  // appended to the stream, so lines outside the SSE framing are collected.
  let stray = ""
  try {
    for await (const line of readLines(res, signal)) {
      armIdle(60000)
      if (!line.startsWith("data:")) {
        if (stray || /^\s*[[{]/.test(line)) stray += line + "\n"
        continue
      }
      const payload = line.slice(5).trim()
      if (payload === "[DONE]") break
      let j: {
        error?: { message?: string }
        choices?: { delta?: { content?: string }; finish_reason?: string }[]
        usage?: { total_tokens?: number }
        x_groq?: { usage?: { total_tokens?: number } }
      }
      try {
        j = JSON.parse(payload)
      } catch {
        continue // keep-alive or partial line
      }
      if (j.error) {
        step("stream error", j.error)
        throw new EngineError(j.error.message ?? "API error", "unknown")
      }
      // Most providers send the request's token count with the last piece.
      tokens = j.usage?.total_tokens ?? j.x_groq?.usage?.total_tokens ?? tokens
      const choice = j.choices?.[0]
      if (choice?.finish_reason) finish = choice.finish_reason
      const piece = choice?.delta?.content ?? ""
      if (piece) {
        if (!full) step("first text")
        full += piece
        delta(piece)
      }
    }
  } catch (e) {
    if (idle.signal.aborted && !signal.aborted) {
      step("stalled")
      throw new EngineError(
        `${new URL(base).host} stopped sending for 60 s.`,
        "network"
      )
    }
    throw e
  } finally {
    clearTimeout(idleTimer)
  }
  if (stray) {
    let error: { code?: number; message?: string; status?: string } | undefined
    try {
      const parsed = JSON.parse(stray)
      error = (Array.isArray(parsed) ? parsed[0] : parsed)?.error
    } catch {
      // not JSON after all
    }
    step("stream error", error ?? stray.slice(0, 300))
    if (error) {
      const err = new EngineError(
        `${model} stopped part way: ${error.message ?? error.status ?? "server error"}`,
        "network",
        error.code ?? 503
      )
      err.midStream = true
      throw err
    }
  }
  step("done", { chars: full.length, finish, tokens })
  recordUsage(
    engine.id,
    tokens ?? estimateTokens(prompt.system + prompt.user, full),
    tokens === undefined
  )
  if (!full.trim())
    throw new EngineError(
      finish && finish !== "stop"
        ? `The model returned no text (finish reason: ${finish}).`
        : "The model returned no text.",
      "unknown"
    )
  return full
}

export const runAnthropic: EngineRunner = async ({
  engine,
  prompt,
  req,
  signal,
  delta,
}) => {
  const base = (engine.baseUrl || "https://api.anthropic.com")
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "")
  if (!engine.apiKey)
    throw new EngineError("Anthropic API key is missing.", "auth")
  const content: unknown[] = []
  if (req.image) {
    const { mime, data } = dataUrlParts(req.image)
    content.push({
      type: "image",
      source: { type: "base64", media_type: mime, data },
    })
  }
  content.push({ type: "text", text: prompt.user })
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": engine.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: engine.model || "claude-haiku-5-5",
      max_tokens: 16000,
      stream: true,
      system: prompt.system,
      messages: [{ role: "user", content }],
    }),
  }).catch((e) => netError(e, signal))
  if (!res.ok) throw await httpError(res)
  let full = ""
  let tokens = 0
  for await (const line of readLines(res, signal)) {
    if (!line.startsWith("data:")) continue
    try {
      const j = JSON.parse(line.slice(5))
      // Input tokens come at the start, output tokens at the end.
      tokens +=
        (j.message?.usage?.input_tokens ?? 0) + (j.usage?.output_tokens ?? 0)
      if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
        full += j.delta.text
        delta(j.delta.text)
      } else if (j.type === "error") {
        throw new EngineError(j.error?.message ?? "Anthropic error")
      }
    } catch (e) {
      if (e instanceof EngineError) throw e
    }
  }
  recordUsage(
    engine.id,
    tokens || estimateTokens(prompt.system + prompt.user, full),
    !tokens
  )
  return full
}

/**
 * A rough token count for providers that send none: about three characters a token
 * across English and Persian. Shown with "≈" in the app.
 */
function estimateTokens(input: string, output: string) {
  return Math.round((input.length + output.length) / 3)
}

export const runOllama: EngineRunner = async ({
  engine,
  prompt,
  req,
  signal,
  delta,
}) => {
  const base = (engine.baseUrl || "http://localhost:11434").replace(/\/+$/, "")
  if (!engine.model)
    throw new EngineError(
      "Choose an Ollama model in settings.",
      "not-installed"
    )
  const user: Record<string, unknown> = { role: "user", content: prompt.user }
  if (req.image) user.images = [dataUrlParts(req.image).data]
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: engine.model,
      stream: true,
      messages: [{ role: "system", content: prompt.system }, user],
    }),
  }).catch(() => {
    if (signal.aborted) throw new EngineError("cancelled", "cancelled")
    throw new EngineError("Ollama is not running on " + base, "not-installed")
  })
  if (!res.ok) throw await httpError(res)
  let full = ""
  for await (const line of readLines(res, signal)) {
    if (!line.trim()) continue
    try {
      const j = JSON.parse(line)
      if (j.error) throw new EngineError(j.error)
      const piece: string = j.message?.content ?? ""
      if (piece) {
        full += piece
        delta(piece)
      }
    } catch (e) {
      if (e instanceof EngineError) throw e
    }
  }
  return full
}

/** List models offered by an engine endpoint, for the model picker in settings. */
export async function listModels(
  kind: string,
  baseUrl: string,
  apiKey: string
): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, "")
  if (kind === "ollama") {
    const res = await fetch(`${base}/api/tags`)
    if (!res.ok) throw await httpError(res)
    const j = (await res.json()) as { models?: { name: string }[] }
    return (j.models ?? []).map((m) => m.name)
  }
  if (kind === "anthropic") {
    const res = await fetch(
      `${base.replace(/\/v1$/, "")}/v1/models?limit=100`,
      {
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      }
    )
    if (!res.ok) throw await httpError(res)
    const j = (await res.json()) as { data?: { id: string }[] }
    return (j.data ?? []).map((m) => m.id)
  }
  const res = await fetch(`${base}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  })
  if (!res.ok) throw await httpError(res)
  const j = (await res.json()) as { data?: { id: string }[] }
  // Gemini lists ids as "models/gemini-…"; chat requests take the bare id.
  return (j.data ?? []).map((m) => m.id.replace(/^models\//, "")).sort()
}
