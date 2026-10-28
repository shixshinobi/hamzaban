import { app } from "electron"
import fs from "node:fs"
import path from "node:path"

let file: string | null = null

export function logFile() {
  return path.join(app.getPath("userData"), "logs", "hamzaban.log")
}

/**
 * Diagnostics log in userData/logs/hamzaban.log (rotated at 1 MB).
 * Only steps, timings and errors are written; never the text being translated.
 */
export function log(scope: string, ...parts: unknown[]) {
  const line = `${new Date().toISOString()} [${scope}] ${parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ")}`
  if (!app.isPackaged) console.log(line)
  try {
    if (!file) {
      file = logFile()
      fs.mkdirSync(path.dirname(file), { recursive: true })
      if (fs.existsSync(file) && fs.statSync(file).size > 1_000_000)
        fs.renameSync(file, `${file}.1`)
    }
    fs.appendFileSync(file, `${line}\n`)
  } catch {
    // logging must never break a translation
  }
}
