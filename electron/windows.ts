import {
  app,
  BrowserWindow,
  desktopCapturer,
  nativeTheme,
  screen,
  type BrowserWindowConstructorOptions,
} from "electron"
import os from "node:os"
import path from "node:path"
import { profileInput } from "../shared/blocks"
import type { Platform, PopupPayload, WindowMaterial } from "../shared/types"
import { getSettings } from "./store"

const DIST = path.join(__dirname, "../dist")
const PRELOAD = path.join(__dirname, "preload.cjs")
// Windows takes the multi-size .ico so the taskbar and title bar never scale a bitmap down.
export const ICON = path.join(
  app.isPackaged ? process.resourcesPath : path.join(__dirname, "../build"),
  process.platform === "win32" ? "icon.ico" : "icon.png"
)

let mainWin: BrowserWindow | null = null
let popupWin: BrowserWindow | null = null
let captureWin: BrowserWindow | null = null
let captureShot: { dataUrl: string; scale: number } | null = null
let popupPinned = false
let popupAnchor: { x: number; y: number } | null = null
let popupReady = false
/** Set once the user drags the popup's edge; auto-fit then leaves the size alone until the next show. */
let popupUserSized = false
let popupFitSize: { width: number; height: number } | null = null
let pendingPopup: PopupPayload | null = null

/** Windows 11 22H2+ supports Mica/Acrylic; macOS always has vibrancy. */
export function platformInfo(): Platform {
  const material = resolveMaterial(getSettings().material)
  return { os: process.platform as Platform["os"], material }
}

function resolveMaterial(pref: WindowMaterial): Platform["material"] {
  if (pref === "none") return "none"
  if (process.platform === "darwin") return "vibrancy"
  if (process.platform === "win32") {
    const build = Number(os.release().split(".")[2] ?? 0)
    if (build < 22621) return "none"
    return pref === "mica" ? "mica" : "acrylic"
  }
  return "none"
}

function load(win: BrowserWindow, route: string) {
  const dev = process.env.VITE_DEV_SERVER_URL
  if (dev) void win.loadURL(`${dev}#${route}`)
  else void win.loadFile(path.join(DIST, "index.html"), { hash: route })
}

function glass(kind: "main" | "popup"): BrowserWindowConstructorOptions {
  const material = resolveMaterial(getSettings().material)
  const base: BrowserWindowConstructorOptions = {
    show: false,
    icon: ICON,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      sandbox: false,
      spellcheck: false,
    },
  }
  if (process.platform === "win32") {
    return {
      ...base,
      backgroundMaterial:
        material === "acrylic" || material === "mica" ? material : "none",
      titleBarStyle: "hidden",
      ...(kind === "main"
        ? {
            titleBarOverlay: {
              color: "#00000000",
              symbolColor: symbolColor(),
              height: 48,
            },
          }
        : {}),
      ...(material === "none"
        ? {
            backgroundColor: nativeTheme.shouldUseDarkColors
              ? "#15161a"
              : "#f5f6f8",
          }
        : {}),
    }
  }
  if (process.platform === "darwin") {
    return {
      ...base,
      vibrancy: kind === "popup" ? "popover" : "under-window",
      visualEffectState: "active",
      ...(kind === "main"
        ? {
            titleBarStyle: "hiddenInset",
            trafficLightPosition: { x: 18, y: 18 },
          }
        : { frame: false }),
    }
  }
  return { ...base, frame: false, transparent: true }
}

function symbolColor() {
  return nativeTheme.shouldUseDarkColors ? "#e8e8ec" : "#2a2a30"
}

export function refreshTitleBar() {
  if (process.platform !== "win32" || !mainWin || mainWin.isDestroyed()) return
  mainWin.setTitleBarOverlay({
    color: "#00000000",
    symbolColor: symbolColor(),
    height: 48,
  })
}

export function getMainWindow() {
  return mainWin && !mainWin.isDestroyed() ? mainWin : null
}

export function createMainWindow(show = true) {
  if (mainWin && !mainWin.isDestroyed()) {
    if (show) {
      if (mainWin.isMinimized()) mainWin.restore()
      mainWin.show()
      mainWin.focus()
    }
    return mainWin
  }
  mainWin = new BrowserWindow({
    ...glass("main"),
    width: 1180,
    height: 760,
    minWidth: 780,
    minHeight: 540,
    title: "Hamzaban",
  })
  load(mainWin, "main")
  mainWin.once("ready-to-show", () => show && mainWin?.show())
  mainWin.on("close", (e) => {
    if (!(app as unknown as { quitting?: boolean }).quitting) {
      e.preventDefault()
      mainWin?.hide()
    }
  })
  return mainWin
}

function ensurePopup() {
  if (popupWin && !popupWin.isDestroyed()) return popupWin
  popupReady = false
  popupWin = new BrowserWindow({
    ...glass("popup"),
    width: 460,
    height: 300,
    minWidth: 320,
    minHeight: 160,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    resizable: true,
    title: "Hamzaban",
  })
  popupWin.setAlwaysOnTop(true, "pop-up-menu")
  if (process.platform === "darwin")
    popupWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  load(popupWin, "popup")
  popupWin.webContents.on("did-start-loading", () => (popupReady = false))
  // will-resize only fires for manual resizing (Windows, macOS); Linux compares against the last fitted size.
  popupWin.on("will-resize", () => (popupUserSized = true))
  if (process.platform === "linux") {
    popupWin.on("resize", () => {
      const [w, h] = popupWin?.getSize() ?? [0, 0]
      if (
        popupFitSize &&
        (Math.abs(w - popupFitSize.width) > 2 ||
          Math.abs(h - popupFitSize.height) > 2)
      )
        popupUserSized = true
    })
  }
  popupWin.on("blur", () => {
    if (
      !popupPinned &&
      getSettings().popupAutoHide &&
      !popupWin?.webContents.isDevToolsOpened()
    )
      popupWin?.hide()
  })
  popupWin.on("close", (e) => {
    if (!(app as unknown as { quitting?: boolean }).quitting) {
      e.preventDefault()
      popupWin?.hide()
    }
  })
  return popupWin
}

/** Pick an initial popup size from the input so short words get a card and long text a reader. */
function initialPopupSize(payload: PopupPayload) {
  if (payload.image) return { width: 620, height: 440 }
  const layout = profileInput(payload.text).layout
  return (
    {
      dictionary: { width: 400, height: 280 },
      phrase: { width: 460, height: 240 },
      text: { width: 580, height: 420 },
      document: { width: 820, height: 640 },
    }[layout] ?? { width: 460, height: 300 }
  )
}

function clampToWorkArea(x: number, y: number, width: number, height: number) {
  const wa = screen.getDisplayNearestPoint({ x, y }).workArea
  const w = Math.min(width, wa.width - 16)
  const h = Math.min(height, wa.height - 16)
  let nx = x
  let ny = y
  if (nx + w > wa.x + wa.width - 8) nx = wa.x + wa.width - w - 8
  if (ny + h > wa.y + wa.height - 8)
    ny = Math.max(wa.y + 8, (popupAnchor?.y ?? y) - h - 12)
  nx = Math.max(wa.x + 8, nx)
  ny = Math.max(wa.y + 8, ny)
  return {
    x: Math.round(nx),
    y: Math.round(ny),
    width: Math.round(w),
    height: Math.round(h),
  }
}

export function showPopup(payload: PopupPayload) {
  const win = ensurePopup()
  const cursor = screen.getCursorScreenPoint()
  popupAnchor = { x: cursor.x, y: cursor.y }
  const size = initialPopupSize(payload)
  const bounds =
    payload.origin === "manual"
      ? (() => {
          const wa = screen.getDisplayNearestPoint(cursor).workArea
          return {
            x: wa.x + (wa.width - size.width) / 2,
            y: wa.y + wa.height * 0.22,
            ...size,
          }
        })()
      : clampToWorkArea(cursor.x + 14, cursor.y + 20, size.width, size.height)
  popupUserSized = false
  popupFitSize = {
    width: Math.round(bounds.width),
    height: Math.round(bounds.height),
  }
  win.setBounds({
    ...bounds,
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    ...popupFitSize,
  })
  if (popupReady) win.webContents.send("popup:show", payload)
  else pendingPopup = payload
  win.show()
  win.focus()
}

/** The popup renderer measures its content and asks for a matching window size. */
export function fitPopup(req: { width?: number; height: number }) {
  if (!popupWin || popupWin.isDestroyed() || popupUserSized) return
  const b = popupWin.getBounds()
  const width = req.width ?? b.width
  const next = clampToWorkArea(b.x, b.y, width, req.height)
  if (
    Math.abs(next.height - b.height) < 2 &&
    Math.abs(next.width - b.width) < 2
  )
    return
  popupFitSize = { width: next.width, height: next.height }
  popupWin.setBounds(
    {
      x: b.x,
      y: next.y < b.y ? next.y : b.y,
      width: next.width,
      height: next.height,
    },
    process.platform === "darwin"
  )
}

/** Build the popup ahead of time so the first shortcut press opens instantly. */
export function warmUpPopup() {
  ensurePopup()
}

/** Called by the popup renderer once its listeners are mounted; hands over any queued payload. */
export function popupRendererReady(): PopupPayload | null {
  popupReady = true
  const p = pendingPopup
  pendingPopup = null
  return p
}

export function hidePopup() {
  popupWin?.hide()
}

export function setPopupPinned(v: boolean) {
  popupPinned = v
}

export function getPopupWindow() {
  return popupWin && !popupWin.isDestroyed() ? popupWin : null
}

export async function startCapture() {
  hidePopup()
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { width, height } = display.size
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: Math.round(width * display.scaleFactor),
      height: Math.round(height * display.scaleFactor),
    },
  })
  const source =
    sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  if (!source) throw new Error("Screen capture is not available")
  captureShot = {
    dataUrl: source.thumbnail.toDataURL(),
    scale: source.thumbnail.getSize().width / width,
  }
  if (captureWin && !captureWin.isDestroyed()) captureWin.destroy()
  captureWin = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    show: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    enableLargerThanScreen: true,
    fullscreenable: false,
    backgroundColor: "#000000",
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      sandbox: false,
    },
  })
  captureWin.setAlwaysOnTop(true, "screen-saver")
  captureWin.setBounds(display.bounds)
  load(captureWin, "capture")
  captureWin.once("ready-to-show", () => {
    captureWin?.show()
    captureWin?.focus()
  })
}

export function getCaptureShot() {
  return captureShot
}

export function closeCapture() {
  captureShot = null
  if (captureWin && !captureWin.isDestroyed()) captureWin.destroy()
  captureWin = null
}

export function allWindows() {
  return BrowserWindow.getAllWindows()
}
