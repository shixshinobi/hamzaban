import { app, BrowserWindow, dialog } from "electron"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { log } from "./log"

export interface RenderedSave {
  name: string
  html: string
  format: "pdf" | "png"
  /** One page's size in CSS pixels. */
  width: number
  height: number
}

/**
 * Save a page built by the renderer (a translated layout) as PDF or PNG. The HTML is
 * drawn in a hidden window of its own, with no preload and no way to navigate, so the
 * PDF keeps real, selectable text and the picture is drawn at the page's own size.
 */
export async function saveRendered(
  parent: BrowserWindow | undefined,
  opts: RenderedSave
) {
  const ext = opts.format
  const r = await dialog.showSaveDialog(parent!, {
    defaultPath: opts.name,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  })
  if (r.canceled || !r.filePath) return null
  const tmp = path.join(app.getPath("temp"), `hamzaban-${randomUUID()}.html`)
  fs.writeFileSync(tmp, opts.html, "utf8")
  const png = ext === "png"
  const win = new BrowserWindow({
    show: false,
    width: Math.max(200, Math.round(opts.width)),
    height: Math.max(200, Math.round(opts.height)),
    useContentSize: true,
    enableLargerThanScreen: true,
    webPreferences: {
      // Drawn off screen: a hidden window may never paint, or finish decoding pictures.
      offscreen: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  const wc = win.webContents
  wc.on("will-navigate", (e) => e.preventDefault())
  wc.setWindowOpenHandler(() => ({ action: "deny" }))
  const started = Date.now()
  try {
    await win.loadFile(tmp)
    // Wait for the font and pictures, then let the page fit its text.
    await wc.executeJavaScript(
      `document.fonts.ready
        .then(() => Promise.all([...document.images].map((i) =>
          i.complete ? 0 : new Promise((done) => { i.onload = i.onerror = done }))))
        .then(() => { window.__hzFit && window.__hzFit(); return true })`
    )
    let data: Buffer
    if (png) {
      // The picture is the first page, edge to edge.
      await wc.insertCSS(
        "main{margin:0!important;padding:0!important;max-width:none!important}.hz-page{box-shadow:none!important;width:100vw!important}body{overflow:hidden}"
      )
      // A window cannot be taller than the screen, so the page is laid out at its own
      // size through the DevTools protocol and captured past the window's edge.
      const w = Math.round(opts.width)
      const h = Math.round(opts.height)
      wc.debugger.attach("1.3")
      try {
        await wc.debugger.sendCommand("Emulation.setDeviceMetricsOverride", {
          width: w,
          height: h,
          deviceScaleFactor: 1,
          mobile: false,
        })
        await wc.executeJavaScript("window.__hzFit && window.__hzFit(); true")
        const shot = (await wc.debugger.sendCommand("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
          clip: { x: 0, y: 0, width: w, height: h, scale: 1 },
        })) as { data: string }
        data = Buffer.from(shot.data, "base64")
      } finally {
        wc.debugger.detach()
      }
    } else {
      data = await wc.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })
    }
    fs.writeFileSync(r.filePath, data)
    log("export", ext, {
      ms: Date.now() - started,
      kb: Math.round(data.length / 1024),
    })
    return r.filePath
  } finally {
    win.destroy()
    fs.rmSync(tmp, { force: true })
  }
}
