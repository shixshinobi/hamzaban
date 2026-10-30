import { app, ipcMain } from "electron"
import fs from "node:fs"
import path from "node:path"
import { log } from "./log"

/**
 * The last PDF opened on the PDF page, kept so it is still there after a restart: a
 * copy of the file (the original may move or be deleted) and the page's work so far,
 * its extracted text and translations, as the renderer saves it.
 */
const dir = () => path.join(app.getPath("userData"), "recent-pdf")
const file = (name: string) => path.join(dir(), name)

/** Write to a temporary name first, so a crash never leaves half a file behind. */
function writeSafe(target: string, data: string | Uint8Array) {
  const tmp = `${target}.tmp`
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, target)
}

export function registerRecentPdf() {
  ipcMain.handle("pdf:remember", (_e, name: string, data: Uint8Array) => {
    fs.mkdirSync(dir(), { recursive: true })
    fs.rmSync(file("state.json"), { force: true })
    writeSafe(file("document.pdf"), data)
    writeSafe(file("meta.json"), JSON.stringify({ name: path.basename(name) }))
    log("pdf", "remembered", { kb: Math.round(data.byteLength / 1024) })
  })
  ipcMain.handle("pdf:save-state", (_e, state: unknown) => {
    if (!fs.existsSync(file("document.pdf"))) return
    writeSafe(file("state.json"), JSON.stringify(state))
  })
  ipcMain.handle("pdf:recall", () => {
    try {
      if (!fs.existsSync(file("document.pdf"))) return null
      const meta = JSON.parse(fs.readFileSync(file("meta.json"), "utf8")) as {
        name: string
      }
      let state: unknown = null
      try {
        state = JSON.parse(fs.readFileSync(file("state.json"), "utf8"))
      } catch {
        // No work saved yet, or it was cut short: the file alone still opens.
      }
      return {
        name: meta.name,
        data: new Uint8Array(fs.readFileSync(file("document.pdf"))),
        state,
      }
    } catch (e) {
      log("pdf", "recall failed", String(e))
      return null
    }
  })
  ipcMain.handle("pdf:forget", () => {
    fs.rmSync(dir(), { recursive: true, force: true })
  })
}
