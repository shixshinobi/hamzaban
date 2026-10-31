import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Notification,
  screen,
  shell,
  systemPreferences,
  Tray,
} from "electron"
import fs from "node:fs"
import path from "node:path"
import type {
  EngineConfig,
  PopupPayload,
  Settings,
  ShortcutAction,
  TranslateRequest,
} from "../shared/types"
import { readImageDataUrl, readText, writeText } from "./clip"
import { log } from "./log"
import { registerRecentPdf } from "./recent-pdf"
import { getUsage, onUsageChange, pruneUsage, remoteUsage } from "./usage"
import { saveRendered, type RenderedSave } from "./render-export"
import {
  cancelTranslation,
  engineModels,
  engineStatus,
  startTranslation,
  translateOnce,
} from "./engines"
import { CLI_INFO, openTerminal } from "./engines/cli"
import {
  destroyWebWindows,
  openWebLogin,
  setGoogleBlockedListener,
  setLoginChangeListener,
  siteForKind,
  webLogout,
} from "./engines/web"
import {
  disposeSelection,
  getSelectedText,
  macAccessibilityOk,
  pasteText,
  warmUpSelection,
} from "./selection"
import {
  getEngine,
  getHistory,
  getSettings,
  onSettingsChange,
  publicSettings,
  removeHistory,
  updateSettings,
} from "./store"
import {
  allWindows,
  closeCapture,
  createMainWindow,
  fitPopup,
  getCaptureShot,
  getMainWindow,
  getPopupWindow,
  hidePopup,
  ICON,
  platformInfo,
  popupRendererReady,
  applyCaptureExclusion,
  isTransparentMaterial,
  rebuildWindows,
  refreshTitleBar,
  setupLiveCapture,
  setPopupPinned,
  showPopup,
  startCapture,
  warmUpPopup,
} from "./windows"

app.setName("Hamzaban")
if (process.platform === "win32") app.setAppUserModelId("app.hamzaban")
// Development only: `HZ_DEBUG_PORT=9333 pnpm dev` opens the windows to DevTools tooling.
if (!app.isPackaged && process.env.HZ_DEBUG_PORT)
  app.commandLine.appendSwitch(
    "remote-debugging-port",
    process.env.HZ_DEBUG_PORT
  )

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let tray: Tray | null = null
let shortcutsSuspended = false
const fa = () => getSettings().uiLanguage === "fa"

function broadcast(channel: string, ...args: unknown[]) {
  for (const w of allWindows())
    if (!w.isDestroyed()) w.webContents.send(channel, ...args)
}

function notify(body: string) {
  if (Notification.isSupported())
    new Notification({
      title: "Hamzaban",
      body,
      icon: ICON,
      silent: true,
    }).show()
}

// ---------- actions bound to global shortcuts and the tray ----------

async function translateSelection() {
  if (!macAccessibilityOk(true)) {
    notify(
      fa()
        ? "برای خواندن متن انتخاب‌شده، دسترسی Accessibility را به همزبان بدهید."
        : "Grant Accessibility access to read selected text."
    )
    return
  }
  const text = (await getSelectedText()).trim()
  showPopup({ text, origin: text ? "selection" : "manual" })
}

async function replaceSelection() {
  const text = (await getSelectedText()).trim()
  if (!text) {
    notify(fa() ? "متنی انتخاب نشده است." : "Nothing is selected.")
    return
  }
  const s = getSettings()
  try {
    const result = await translateOnce({
      text,
      sourceLang: s.sourceLang,
      targetLang: s.targetLang,
    })
    if (result.trim()) await pasteText(result.trim())
  } catch (e) {
    notify(
      `${fa() ? "ترجمه انجام نشد" : "Translation failed"}: ${(e as Error).message}`
    )
  }
}

async function translateClipboard() {
  const text = (await readText()).trim()
  const image = text ? null : await readImageDataUrl()
  if (image) showPopup({ text: "", image, origin: "clipboard" })
  else showPopup({ text, origin: text ? "clipboard" : "manual" })
}

async function captureScreen() {
  if (
    process.platform === "darwin" &&
    systemPreferences.getMediaAccessStatus("screen") !== "granted"
  ) {
    notify(
      fa()
        ? "برای ترجمه از روی صفحه، اجازه‌ی Screen Recording را بدهید."
        : "Allow Screen Recording to translate from the screen."
    )
  }
  try {
    await startCapture()
  } catch (e) {
    notify((e as Error).message)
  }
}

const ACTIONS: Record<ShortcutAction, () => void> = {
  translateSelection: () => void translateSelection(),
  replaceSelection: () => void replaceSelection(),
  captureScreen: () => void captureScreen(),
  translateClipboard: () => void translateClipboard(),
  showMain: () => createMainWindow(true),
}

function registerShortcuts(): Record<string, boolean> {
  globalShortcut.unregisterAll()
  const result: Record<string, boolean> = {}
  if (shortcutsSuspended) return result
  for (const [action, accel] of Object.entries(getSettings().shortcuts) as [
    ShortcutAction,
    string,
  ][]) {
    if (!accel) continue
    try {
      result[action] = globalShortcut.register(accel, ACTIONS[action])
    } catch {
      result[action] = false
    }
  }
  return result
}

// ---------- tray ----------

// Every tray file is drawn at its final size (with @2x / .ico variants for high DPI),
// so none of them is resized here.
function trayIcon() {
  const name =
    process.platform === "darwin"
      ? "trayTemplate.png"
      : process.platform === "win32"
        ? "tray.ico"
        : "tray.png"
  const file = path.join(path.dirname(ICON), name)
  const img = nativeImage.createFromPath(fs.existsSync(file) ? file : ICON)
  if (process.platform === "darwin") img.setTemplateImage(true)
  return img
}

function buildTray() {
  const f = fa()
  const sc = getSettings().shortcuts
  const menu = Menu.buildFromTemplate([
    {
      label: f ? "باز کردن همزبان" : "Open Hamzaban",
      click: () => createMainWindow(true),
      accelerator: sc.showMain,
      registerAccelerator: false,
    },
    { type: "separator" },
    {
      label: f ? "ترجمه‌ی متن انتخاب‌شده" : "Translate selection",
      click: () => void translateSelection(),
      accelerator: sc.translateSelection,
      registerAccelerator: false,
    },
    {
      label: f ? "ترجمه از روی صفحه" : "Translate from screen",
      click: () => void captureScreen(),
      accelerator: sc.captureScreen,
      registerAccelerator: false,
    },
    {
      label: f ? "ترجمه‌ی کلیپ‌بورد" : "Translate clipboard",
      click: () => void translateClipboard(),
      accelerator: sc.translateClipboard,
      registerAccelerator: false,
    },
    { type: "separator" },
    {
      label: f ? "تنظیمات" : "Settings",
      click: () => {
        createMainWindow(true)
        getMainWindow()?.webContents.send("nav", "settings")
      },
    },
    {
      label: f ? "خروج" : "Quit",
      click: () => {
        ;(app as unknown as { quitting?: boolean }).quitting = true
        app.quit()
      },
    },
  ])
  if (!tray) {
    tray = new Tray(trayIcon())
    tray.on("click", () => createMainWindow(true))
  }
  tray.setToolTip("Hamzaban")
  tray.setContextMenu(menu)
}

// ---------- IPC ----------

function applySettingsSideEffects(prev: Settings, next: Settings) {
  if (prev.theme !== next.theme) nativeTheme.themeSource = next.theme
  if (JSON.stringify(prev.shortcuts) !== JSON.stringify(next.shortcuts))
    registerShortcuts()
  if (
    prev.uiLanguage !== next.uiLanguage ||
    JSON.stringify(prev.shortcuts) !== JSON.stringify(next.shortcuts)
  )
    buildTray()
  if (prev.launchAtLogin !== next.launchAtLogin) {
    app.setLoginItemSettings({
      openAtLogin: next.launchAtLogin,
      args: ["--hidden"],
    })
  }
  if (prev.material !== next.material) {
    const info = platformInfo()
    // Both of these settings resolve to a transparent window, whatever the OS.
    const was = prev.material === "clear" || prev.material === "live"
    applyCaptureExclusion()
    if (
      process.platform !== "linux" &&
      was !== isTransparentMaterial(info.material)
    ) {
      rebuildWindows()
    } else if (
      process.platform === "win32" &&
      !isTransparentMaterial(info.material)
    ) {
      for (const w of [getMainWindow(), getPopupWindow()]) {
        if (!w) continue
        w.setBackgroundMaterial(
          info.material === "mica" || info.material === "acrylic"
            ? info.material
            : "none"
        )
        w.setBackgroundColor(
          info.material === "none"
            ? nativeTheme.shouldUseDarkColors
              ? "#15161a"
              : "#f5f6f8"
            : "#00000000"
        )
      }
    }
    broadcast("platform:changed", info)
  }
}

function registerIpc() {
  ipcMain.handle("settings:get", () => publicSettings())
  ipcMain.handle("settings:update", (_e, patch: Partial<Settings>) => {
    const prev = { ...getSettings() }
    const next = updateSettings(patch)
    applySettingsSideEffects(prev, getSettings())
    return next
  })
  ipcMain.handle("shortcuts:apply", () => registerShortcuts())
  ipcMain.handle("shortcuts:suspend", (_e, v: boolean) => {
    shortcutsSuspended = v
    return registerShortcuts()
  })

  ipcMain.handle(
    "translate:start",
    (e, req: TranslateRequest, jobId?: string) => {
      const wc = e.sender
      return startTranslation(
        req,
        (ev) => {
          if (!wc.isDestroyed()) wc.send("translate:event", ev)
        },
        jobId
      )
    }
  )
  ipcMain.handle("translate:cancel", (_e, jobId: string) =>
    cancelTranslation(jobId)
  )

  ipcMain.handle("engine:status", (_e, id: string) => engineStatus(id))
  ipcMain.handle(
    "engine:models",
    (
      _e,
      id: string,
      override?: { baseUrl?: string; apiKey?: string; kind?: string }
    ) => engineModels(id, override)
  )
  ipcMain.handle("usage:get", () => getUsage())
  ipcMain.handle(
    "usage:remote",
    async (
      _e,
      id: string,
      override?: { baseUrl?: string; apiKey?: string }
    ) => {
      const engine = getEngine(id)
      const merged = { ...engine, ...override } as EngineConfig
      try {
        return await remoteUsage(merged)
      } catch {
        return null
      }
    }
  )
  ipcMain.handle("engine:login", async (_e, id: string) => {
    const engine = getEngine(id)
    if (!engine) return
    if (siteForKind(engine.kind)) return openWebLogin(engine.kind)
    const cli = CLI_INFO[engine.kind]
    if (cli) openTerminal(cli.login)
  })
  ipcMain.handle("engine:install", (_e, id: string) => {
    const engine = getEngine(id)
    const cli = engine && CLI_INFO[engine.kind]
    if (cli) openTerminal(cli.install)
  })
  ipcMain.handle("engine:logout", (_e, id: string) => {
    const engine = getEngine(id)
    if (engine) return webLogout(engine.kind)
  })

  ipcMain.handle("history:get", () => getHistory())
  ipcMain.handle("history:remove", (_e, id?: string) => removeHistory(id))

  ipcMain.on("popup:fit", (_e, size: { width?: number; height: number }) =>
    fitPopup(size)
  )
  ipcMain.on("popup:close", () => hidePopup())
  ipcMain.on("popup:pin", (_e, v: boolean) => setPopupPinned(v))
  ipcMain.on("popup:open-main", (_e, payload: PopupPayload) => {
    hidePopup()
    const win = createMainWindow(true)
    const send = () => win.webContents.send("main:translate", payload)
    if (win.webContents.isLoading())
      win.webContents.once("did-finish-load", send)
    else send()
  })
  ipcMain.handle("popup:replace", async (_e, text: string) => {
    hidePopup()
    await new Promise((r) => setTimeout(r, 150))
    await pasteText(text)
  })
  ipcMain.handle("popup:manual", () =>
    showPopup({ text: "", origin: "manual" })
  )
  ipcMain.handle("popup:ready", () => popupRendererReady())

  ipcMain.handle("capture:start", () => captureScreen())
  ipcMain.handle("capture:shot", () => getCaptureShot())
  ipcMain.on("capture:done", (_e, dataUrl: string) => {
    closeCapture()
    showPopup({ text: "", image: dataUrl, origin: "capture" })
  })
  ipcMain.on("capture:cancel", () => closeCapture())

  ipcMain.handle("app:platform", () => platformInfo())
  ipcMain.handle("app:display-bounds", (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    return win
      ? screen.getDisplayMatching(win.getBounds()).bounds
      : screen.getPrimaryDisplay().bounds
  })
  ipcMain.handle("app:open-external", (_e, url: string) => {
    if (/^(https?:\/\/|mailto:)/.test(url)) return shell.openExternal(url)
  })
  ipcMain.handle("clipboard:write", (_e, text: string) => writeText(text))
  ipcMain.handle("clipboard:read-image", () => readImageDataUrl())
  ipcMain.handle(
    "file:save",
    async (
      e,
      opts: { name: string; content: string; filters?: Electron.FileFilter[] }
    ) => {
      const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
      const r = await dialog.showSaveDialog(win!, {
        defaultPath: opts.name,
        filters: opts.filters,
      })
      if (r.canceled || !r.filePath) return null
      fs.writeFileSync(r.filePath, opts.content, "utf8")
      return r.filePath
    }
  )
  ipcMain.handle("file:save-rendered", (e, opts: RenderedSave) =>
    saveRendered(BrowserWindow.fromWebContents(e.sender) ?? undefined, opts)
  )
  ipcMain.handle(
    "file:read-text",
    async (e, filters?: Electron.FileFilter[]) => {
      const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
      const r = await dialog.showOpenDialog(win!, {
        properties: ["openFile"],
        filters,
      })
      if (r.canceled || !r.filePaths[0]) return null
      return {
        name: path.basename(r.filePaths[0]),
        content: fs.readFileSync(r.filePaths[0], "utf8"),
      }
    }
  )
  // A native dialog with plain extension filters opens at once; an <input type=file>
  // with MIME types first walks the Windows registry for matching extensions.
  // Only a path chosen in this dialog may be read back.
  const picked = new Set<string>()
  // Each kind of file opens where the last one came from. Left to itself, Windows starts
  // in its last-visited folder, which may be a OneDrive or network folder that takes
  // seconds to list; a local folder opens at once.
  const lastDir = new Map<string, string>()
  ipcMain.handle("file:pick", async (e, filters?: Electron.FileFilter[]) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const kind = filters?.[0]?.extensions[0] ?? "*"
    const asked = Date.now()
    // The parent loses focus the moment the dialog is on screen.
    win?.once("blur", () =>
      log("file", "dialog shown", { ms: Date.now() - asked })
    )
    const r = await dialog.showOpenDialog(win!, {
      properties: ["openFile"],
      filters,
      defaultPath: lastDir.get(kind) ?? app.getPath("downloads"),
    })
    const file = r.filePaths[0]
    if (r.canceled || !file) return null
    lastDir.set(kind, path.dirname(file))
    picked.add(file)
    return { name: path.basename(file), path: file }
  })
  ipcMain.handle("file:read-binary", async (_e, file: string) => {
    if (!picked.delete(file)) throw new Error("File was not picked")
    return new Uint8Array(await fs.promises.readFile(file))
  })

  ipcMain.on(
    "window:control",
    (e, action: "minimize" | "maximize" | "close") => {
      const win = BrowserWindow.fromWebContents(e.sender)
      if (!win) return
      if (action === "minimize") win.minimize()
      else if (action === "maximize") {
        if (win.isMaximized()) win.unmaximize()
        else win.maximize()
      } else win.close()
    }
  )
}

/**
 * Google does not allow signing in from inside other apps ("This browser or app may not be
 * secure"). Say so plainly and point to the official routes instead.
 */
async function explainGoogleBlock(site: string) {
  const fa = getSettings().uiLanguage === "fa"
  if (site !== "gemini") {
    await dialog.showMessageBox({
      type: "info",
      title: "Hamzaban",
      message: fa
        ? "گوگل ورود از داخل برنامه‌ها را نمی‌پذیرد"
        : "Google does not allow sign-in inside apps",
      detail: fa
        ? "به جای «ادامه با گوگل»، با ایمیل و رمز عبور (یا Microsoft / Apple) وارد شوید."
        : "Instead of “Continue with Google”, sign in with email and password (or Microsoft / Apple).",
      buttons: [fa ? "باشه" : "OK"],
    })
    return
  }
  const { response } = await dialog.showMessageBox({
    type: "info",
    title: "Hamzaban",
    message: fa
      ? "گوگل ورود از داخل برنامه‌ها را نمی‌پذیرد"
      : "Google does not allow sign-in inside apps",
    detail: fa
      ? "این محدودیت امنیتی خود گوگل است و Gemini فقط با حساب گوگل کار می‌کند. دو راه رسمی هست:\n\n• Gemini CLI: ورود در مرورگر خودتان انجام می‌شود و اگر اشتراک Google AI Pro یا Ultra دارید، سهمیه‌ی بیشتر همان اشتراک را می‌گیرد. بعد از نصب، موتور «Gemini CLI» را در تنظیمات روشن کنید.\n• کلید API از Google AI Studio (رایگان یا پولی): در تنظیمات ← موتورها، «افزودن کلید API» و سرویس Google Gemini را انتخاب کنید. هزینه‌ی کلید API جدا از اشتراک Gemini حساب می‌شود."
      : "This is Google's own security rule, and Gemini only works with a Google account. There are two official routes:\n\n• Gemini CLI: you sign in in your own browser, and a Google AI Pro or Ultra subscription gives it that plan's higher limits. After installing, turn on the “Gemini CLI” engine in Settings.\n• An API key from Google AI Studio (free tier or paid): in Settings → Engines, choose “Add API key” and the Google Gemini service. API usage is billed separately from a Gemini subscription.",
    buttons: [
      fa ? "نصب Gemini CLI" : "Install Gemini CLI",
      fa ? "گرفتن کلید API" : "Get an API key",
      fa ? "بستن" : "Close",
    ],
    defaultId: 0,
    cancelId: 2,
  })
  if (response === 0) {
    const cli = CLI_INFO["gemini-cli"]!
    openTerminal(`${cli.install} && ${cli.login}`)
  } else if (response === 1) {
    void shell.openExternal("https://aistudio.google.com/apikey")
    createMainWindow(true)
    getMainWindow()?.webContents.send("nav", "settings")
  }
}

// ---------- lifecycle ----------

app.on("second-instance", () => createMainWindow(true))

// Log errors from Hamzaban's own windows. The ChatGPT/Claude/Gemini session windows are
// left out: their sites print plenty of harmless noise.
app.on("web-contents-created", (_e, wc) => {
  const ours = () => {
    const url = wc.getURL()
    return (
      url.startsWith("file:") ||
      (!!process.env.VITE_DEV_SERVER_URL &&
        url.startsWith(process.env.VITE_DEV_SERVER_URL))
    )
  }
  wc.on("console-message", (ev) => {
    const e = ev as unknown as {
      level: string | number
      message: string
      sourceId?: string
      lineNumber?: number
    }
    if (
      (e.level === "error" ||
        e.level === "warning" ||
        e.level === 3 ||
        e.level === 2) &&
      ours()
    )
      log(
        "renderer",
        `${e.message} (${e.sourceId ?? ""}:${e.lineNumber ?? ""})`
      )
  })
  wc.on("preload-error", (_ev, p, err) => log("preload", `${p}: ${err}`))
  wc.on("render-process-gone", (_ev, d) => ours() && log("renderer", "gone", d))
})

app.whenReady().then(() => {
  nativeTheme.themeSource = getSettings().theme
  nativeTheme.on("updated", () => {
    refreshTitleBar()
    broadcast("theme:changed", nativeTheme.shouldUseDarkColors)
  })
  registerIpc()
  registerRecentPdf()
  setupLiveCapture()
  onSettingsChange((s) => {
    broadcast("settings:changed", s)
    pruneUsage(s.engines.map((e) => e.id))
  })
  onUsageChange((u) => broadcast("usage:changed", u))
  setLoginChangeListener(() => broadcast("engines:changed"))
  setGoogleBlockedListener((site) => void explainGoogleBlock(site))
  buildTray()
  const results = registerShortcuts()
  createMainWindow(!process.argv.includes("--hidden"))
  warmUpSelection()
  setTimeout(warmUpPopup, 1500)
  // The first file dialog in a process loads the Windows shell's folder and icon
  // handlers (OneDrive's among them), which can take seconds. Load them while idle.
  if (process.platform === "win32")
    setTimeout(
      () => void app.getFileIcon(app.getPath("downloads")).catch(() => {}),
      4000
    )
  const failed = Object.entries(results).filter(([, ok]) => !ok)
  if (failed.length) {
    setTimeout(
      () =>
        getMainWindow()?.webContents.send(
          "shortcuts:conflict",
          failed.map(([a]) => a)
        ),
      2500
    )
  }
  app.on("activate", () => createMainWindow(true))
})

app.on("before-quit", () => {
  ;(app as unknown as { quitting?: boolean }).quitting = true
  destroyWebWindows()
  getPopupWindow()?.destroy()
})

app.on("will-quit", () => {
  globalShortcut.unregisterAll()
  disposeSelection()
})

// Keep running in the tray when every window is closed.
app.on("window-all-closed", () => {})
