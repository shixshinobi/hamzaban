import { isGeminiApi } from "../../shared/models"
import { EngineError, httpError, readLines, type EngineRunner } from "./types"

function dataUrlParts(dataUrl: string) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  return m ? { mime: m[1], data: m[2] } : { mime: "image/png", data: dataUrl }
}

function netError(e: unknown, signal: AbortSignal): never {
  if (e instanceof EngineError) throw e
  const msg = (e as Error)?.message ?? String(e)
  throw new EngineError(msg, signal.aborted ? "cancelled" : "network")
}

export const runOpenAI: EngineRunner = async ({
  engine,
  prompt,
  req,
  signal,
  delta,
}) => {
  const base = (engine.baseUrl || "https://api.openai.com/v1").replace(
    /\/+$/,
    ""
  )
  if (!engine.model)
    throw new EngineError("No model selected for this API engine.", "auth")
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
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: engine.model,
      stream: true,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content },
      ],
      // Gemini models always think; translation needs little of it and a lot less waiting.
      ...(isGeminiApi(base) ? { reasoning_effort: "low" } : {}),
    }),
  }).catch((e) => netError(e, signal))
  if (!res.ok) throw await httpError(res)
  let full = ""
  for await (const line of readLines(res, signal)) {
    if (!line.startsWith("data:")) continue
    const payload = line.slice(5).trim()
    if (payload === "[DONE]") break
    try {
      const j = JSON.parse(payload)
      const piece: string = j.choices?.[0]?.delta?.content ?? ""
      if (piece) {
        full += piece
        delta(piece)
      }
    } catch {
      // keep-alive or partial line
    }
  }
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
  for await (const line of readLines(res, signal)) {
    if (!line.startsWith("data:")) continue
    try {
      const j = JSON.parse(line.slice(5))
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
  return full
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
