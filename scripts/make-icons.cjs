// Renders the app/tray icons from SVG using Electron's offscreen renderer.
// Run with: pnpm icons
const { app, BrowserWindow } = require("electron")
const fs = require("node:fs")
const path = require("node:path")

const out = path.join(__dirname, "..", "build")
fs.mkdirSync(out, { recursive: true })

const BACK =
  "M8 26c0-9.4 7.6-17 17-17h6c9.4 0 17 7.6 17 17s-7.6 17-17 17h-3l-9 7v-8.2C12.3 39.6 8 33.3 8 26Z"
const FRONT =
  "M56 38c0-7.7-6.3-14-14-14h-4c-7.7 0-14 6.3-14 14s6.3 14 14 14h2l7 5.5v-6.7C51.8 48.8 56 43.9 56 38Z"

// The same two speech drops as the in-app logo (src/components/logo.tsx), with no tile
// behind them, so the taskbar, dock and tray show exactly what the window header shows.
// At 32 px and below the overlap turns to mush, so small sizes cut a thin gap around the
// front drop, make it opaque and drop the shine.
const logo = (box) => (size) => {
  const small = size <= 32
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}">
  <defs>
    <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="oklch(0.72 0.16 250)"/>
      <stop offset="1" stop-color="oklch(0.58 0.2 275)"/>
    </linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="oklch(0.85 0.12 195)"/>
      <stop offset="1" stop-color="oklch(0.68 0.14 220)"/>
    </linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="white" stop-opacity="0.75"/>
      <stop offset="0.5" stop-color="white" stop-opacity="0"/>
    </linearGradient>
    <mask id="gap" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
      <rect width="64" height="64" fill="white"/>
      <path d="${FRONT}" fill="black" stroke="black" stroke-width="${(2 * 54) / size}" stroke-linejoin="round"/>
    </mask>
  </defs>
  <path d="${BACK}" fill="url(#a)"${small ? ' mask="url(#gap)"' : ""}/>
  <path d="${FRONT}" fill="url(#b)" fill-opacity="${small ? 1 : 0.92}"/>
  ${small ? "" : `<path d="M8 26c0-9.4 7.6-17 17-17h6c9.4 0 17 7.6 17 17" fill="url(#s)" opacity="0.6"/>`}
</svg>`
}

// The drops span x 8-56 and y 9-57.5; a slightly tighter box lets them fill the icon.
const appIcon = logo("5 6.5 54 54")
const trayColor = logo("6 7.5 52 52")

const trayTemplate = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <path d="M56 38c0-7.7-6.3-14-14-14h-4c-7.7 0-14 6.3-14 14s6.3 14 14 14h2l7 5.5v-6.7C51.8 48.8 56 43.9 56 38Z" fill="#000" fill-opacity="0.55"/>
  <path d="M8 26c0-9.4 7.6-17 17-17h6c9.4 0 17 7.6 17 17s-7.6 17-17 17h-3l-9 7v-8.2C12.3 39.6 8 33.3 8 26Z" fill="#000"/>
</svg>`

// Each size is drawn on its own at 4x and scaled down with the best filter, so small
// icons stay smooth instead of being squeezed out of one large bitmap. Windows gets
// .ico files holding every size it asks for (taskbar, title bar, tray, Explorer).
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256]
const TRAY_ICO_SIZES = [16, 20, 24, 32, 40, 48]

const targets = [
  { file: "icon.png", svg: appIcon, size: 1024 },
  { file: "icon.ico", svg: appIcon, sizes: ICO_SIZES },
  { file: "tray.ico", svg: trayColor, sizes: TRAY_ICO_SIZES },
  { file: "tray.png", svg: trayColor, size: 24 },
  { file: "tray@2x.png", svg: trayColor, size: 48 },
  { file: "trayTemplate.png", svg: () => trayTemplate, size: 22 },
  { file: "trayTemplate@2x.png", svg: () => trayTemplate, size: 44 },
]

/** ICO container with PNG-compressed entries (supported since Windows Vista). */
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  let offset = header.length
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt16LE(1, e + 4)
    header.writeUInt16LE(32, e + 6)
    header.writeUInt32LE(data.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...pngs.map((p) => p.data)])
}

async function render(svg, size) {
  const px = Math.min(size * 4, 2048)
  const win = new BrowserWindow({
    show: false,
    width: px,
    height: px,
    frame: false,
    transparent: true,
    useContentSize: true,
    enableLargerThanScreen: true,
    webPreferences: { offscreen: true, zoomFactor: 1 },
  })
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg.replace("<svg ", `<svg width="${px}" height="${px}" shape-rendering="geometricPrecision" `)}</body></html>`
  const tmp = path.join(require("node:os").tmpdir(), `hz-icon-${px}.html`)
  fs.writeFileSync(tmp, html)
  await win.loadFile(tmp)
  await new Promise((r) => setTimeout(r, 300))
  const img = await win.webContents.capturePage({
    x: 0,
    y: 0,
    width: px,
    height: px,
  })
  win.destroy()
  return img.resize({ width: size, height: size, quality: "best" }).toPNG()
}

app.disableHardwareAcceleration()
app.on("window-all-closed", () => {})
app.whenReady().then(async () => {
  for (const t of targets) {
    const data = t.sizes
      ? ico(
          await Promise.all(
            t.sizes.map(async (size) => ({
              size,
              data: await render(t.svg(size), size),
            }))
          )
        )
      : await render(t.svg(t.size), t.size)
    fs.writeFileSync(path.join(out, t.file), data)
    console.log("wrote", t.file)
  }
  app.quit()
})
