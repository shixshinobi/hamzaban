import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { blocksToText, parseBlocks } from "../../shared/blocks"
import type {
  EngineKind,
  EngineStatus,
  TranslateEvent,
  TranslateRequest,
} from "../../shared/types"
import { log } from "../log"
import { buildPrompt } from "../prompt"
import { addHistory, getEngine, getSettings } from "../store"
import { listModels, runAnthropic, runOllama, runOpenAI } from "./api"
import { CLI_INFO, CLI_RUNNERS, cliVersion } from "./cli"
import { runGoogle } from "./google"
import { EngineError, type EngineRunner } from "./types"
import { runWeb, webLoggedIn } from "./web"

const RUNNERS: Record<EngineKind, EngineRunner> = {
  google: runGoogle,
  "chatgpt-web": runWeb,
  "claude-web": runWeb,
  "gemini-web": runWeb,
  "codex-cli": CLI_RUNNERS["codex-cli"]!,
  "claude-cli": CLI_RUNNERS["claude-cli"]!,
  "gemini-cli": CLI_RUNNERS["gemini-cli"]!,
  ollama: runOllama,
  openai: runOpenAI,
  anthropic: runAnthropic,
}

const jobs = new Map<string, AbortController>()
let counter = 0

export function startTranslation(
  req: TranslateRequest,
  emit: (e: TranslateEvent) => void,
  id?: string
): string {
  const jobId = id ?? `job-${Date.now()}-${++counter}`
  const ac = new AbortController()
  jobs.set(jobId, ac)
  void execute(jobId, req, ac, emit)
  return jobId
}

export function cancelTranslation(jobId: string) {
  jobs.get(jobId)?.abort()
  jobs.delete(jobId)
}

async function execute(
  jobId: string,
  req: TranslateRequest,
  ac: AbortController,
  emit: (e: TranslateEvent) => void
) {
  const settings = getSettings()
  const engine =
    getEngine(req.engineId ?? settings.activeEngineId) ?? getEngine("google")!
  const styleId =
    req.styleId === undefined ? settings.activeStyleId : req.styleId
  const style =
    engine.kind === "google"
      ? null
      : (settings.styles.find((s) => s.id === styleId) ?? null)
  const prompt = buildPrompt(
    { ...req, smart: req.smart ?? settings.smartLayout },
    style
  )
  let acc = ""
  let tmpImage: string | null = null
  emit({ jobId, type: "start", engineId: engine.id, engineName: engine.name })
  const started = Date.now()
  log("job", jobId.slice(0, 8), "start", {
    engine: engine.kind,
    image: !!req.image,
    chars: req.text.length,
    smart: prompt.smart,
  })
  // CLIs give no sign of progress until they answer.
  if (engine.kind.endsWith("-cli"))
    emit({ jobId, type: "stage", stage: "thinking" })
  try {
    const text = await RUNNERS[engine.kind]({
      req,
      engine,
      prompt,
      signal: ac.signal,
      delta: (t) => {
        acc += t
        emit({ jobId, type: "delta", text: t })
      },
      snapshot: (t) => {
        acc = t
        emit({ jobId, type: "snapshot", text: t })
      },
      dictionary: (data) => emit({ jobId, type: "dictionary", data }),
      stage: (stage, detail, limit) =>
        emit({ jobId, type: "stage", stage, detail, limit }),
      detected: (lang) => emit({ jobId, type: "detected", lang }),
      imageFile: async () => {
        if (tmpImage) return tmpImage
        const [meta, b64 = ""] = (req.image ?? "").split(",")
        // CLIs pick the decoder from the extension, so it has to match the bytes.
        const ext = /image\/jpe?g/.test(meta)
          ? "jpg"
          : /image\/webp/.test(meta)
            ? "webp"
            : "png"
        tmpImage = path.join(os.tmpdir(), `hamzaban-${jobId}.${ext}`)
        fs.writeFileSync(tmpImage, Buffer.from(b64, "base64"))
        return tmpImage
      },
    })
    const final = text || acc
    log("job", jobId.slice(0, 8), "done", {
      ms: Date.now() - started,
      chars: final.length,
    })
    emit({ jobId, type: "done", text: final })
    if (final.trim()) {
      addHistory({
        id: jobId,
        at: Date.now(),
        source: req.text || "(image)",
        result: prompt.smart
          ? blocksToText(parseBlocks(final, true)) || final
          : final,
        sourceLang: req.sourceLang,
        targetLang: req.targetLang,
        engineName: engine.name,
        hasImage: !!req.image,
      })
    }
  } catch (e) {
    const err =
      e instanceof EngineError
        ? e
        : new EngineError((e as Error)?.message ?? String(e))
    log("job", jobId.slice(0, 8), "error", {
      ms: Date.now() - started,
      code: ac.signal.aborted ? "cancelled" : err.code,
      message: err.message,
    })
    emit({
      jobId,
      type: "error",
      message: err.message,
      code: ac.signal.aborted ? "cancelled" : err.code,
    })
  } finally {
    jobs.delete(jobId)
    if (tmpImage) fs.rm(tmpImage, { force: true }, () => {})
  }
}

/** Translate and wait for the final text — used by replace-in-place. */
export function translateOnce(req: TranslateRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    startTranslation({ ...req, smart: false }, (e) => {
      if (e.type === "done") resolve(e.text)
      if (e.type === "error") reject(new Error(e.message))
    })
  })
}

export async function engineStatus(id: string): Promise<EngineStatus> {
  const engine = getEngine(id)
  if (!engine) return { id, ok: false, detail: "missing" }
  switch (engine.kind) {
    case "google":
      return { id, ok: true }
    case "chatgpt-web":
    case "claude-web":
    case "gemini-web": {
      const ok = await webLoggedIn(engine.kind)
      return { id, ok, detail: ok ? "signed-in" : "signed-out" }
    }
    case "codex-cli":
    case "claude-cli":
    case "gemini-cli": {
      const v = await cliVersion(engine.kind, engine.command)
      return {
        id,
        ok: !!v,
        detail: v ?? `not-installed:${CLI_INFO[engine.kind]?.install}`,
      }
    }
    case "ollama":
      try {
        const models = await listModels(
          "ollama",
          engine.baseUrl || "http://localhost:11434",
          ""
        )
        return {
          id,
          ok: models.length > 0,
          detail: models.length ? `${models.length} models` : "no-models",
        }
      } catch {
        return { id, ok: false, detail: "not-running" }
      }
    default:
      return {
        id,
        ok: !!engine.apiKey && !!engine.model,
        detail: engine.apiKey
          ? engine.model
            ? "ready"
            : "no-model"
          : "no-key",
      }
  }
}

export async function engineModels(
  id: string,
  override?: { baseUrl?: string; apiKey?: string; kind?: string }
) {
  const engine = getEngine(id)
  const kind = override?.kind ?? engine?.kind ?? "openai"
  let apiKey = override?.apiKey ?? ""
  if (!apiKey || apiKey.startsWith("••")) apiKey = engine?.apiKey ?? ""
  const baseUrl = override?.baseUrl ?? engine?.baseUrl ?? ""
  return listModels(kind, baseUrl, apiKey)
}
