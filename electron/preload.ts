import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron"
import type {
  EngineStatus,
  HistoryItem,
  Platform,
  PopupPayload,
  Settings,
  TranslateEvent,
  TranslateRequest,
} from "../shared/types"

function on<T extends unknown[]>(channel: string, fn: (...args: T) => void) {
  const handler = (_e: IpcRendererEvent, ...args: unknown[]) =>
    fn(...(args as T))
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api = {
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke("settings:get"),
    update: (patch: Partial<Settings>): Promise<Settings> =>
      ipcRenderer.invoke("settings:update", patch),
    onChange: (fn: (s: Settings) => void) => on("settings:changed", fn),
  },
  shortcuts: {
    apply: (): Promise<Record<string, boolean>> =>
      ipcRenderer.invoke("shortcuts:apply"),
    suspend: (v: boolean): Promise<Record<string, boolean>> =>
      ipcRenderer.invoke("shortcuts:suspend", v),
    onConflict: (fn: (actions: string[]) => void) =>
      on("shortcuts:conflict", fn),
  },
  translate: {
    start: (req: TranslateRequest, jobId: string): Promise<string> =>
      ipcRenderer.invoke("translate:start", req, jobId),
    cancel: (jobId: string): Promise<void> =>
      ipcRenderer.invoke("translate:cancel", jobId),
    onEvent: (fn: (e: TranslateEvent) => void) => on("translate:event", fn),
  },
  engines: {
    status: (id: string): Promise<EngineStatus> =>
      ipcRenderer.invoke("engine:status", id),
    models: (
      id: string,
      override?: { baseUrl?: string; apiKey?: string; kind?: string }
    ): Promise<string[]> => ipcRenderer.invoke("engine:models", id, override),
    login: (id: string): Promise<void> =>
      ipcRenderer.invoke("engine:login", id),
    install: (id: string): Promise<void> =>
      ipcRenderer.invoke("engine:install", id),
    logout: (id: string): Promise<void> =>
      ipcRenderer.invoke("engine:logout", id),
    onChange: (fn: () => void) => on("engines:changed", fn),
  },
  history: {
    get: (): Promise<HistoryItem[]> => ipcRenderer.invoke("history:get"),
    remove: (id?: string): Promise<void> =>
      ipcRenderer.invoke("history:remove", id),
  },
  popup: {
    onShow: (fn: (p: PopupPayload) => void) => on("popup:show", fn),
    ready: (): Promise<PopupPayload | null> =>
      ipcRenderer.invoke("popup:ready"),
    fit: (size: { width?: number; height: number }) =>
      ipcRenderer.send("popup:fit", size),
    close: () => ipcRenderer.send("popup:close"),
    pin: (v: boolean) => ipcRenderer.send("popup:pin", v),
    openInMain: (p: PopupPayload) => ipcRenderer.send("popup:open-main", p),
    replace: (text: string): Promise<void> =>
      ipcRenderer.invoke("popup:replace", text),
    manual: (): Promise<void> => ipcRenderer.invoke("popup:manual"),
  },
  capture: {
    start: (): Promise<void> => ipcRenderer.invoke("capture:start"),
    shot: (): Promise<{ dataUrl: string; scale: number } | null> =>
      ipcRenderer.invoke("capture:shot"),
    done: (dataUrl: string) => ipcRenderer.send("capture:done", dataUrl),
    cancel: () => ipcRenderer.send("capture:cancel"),
  },
  app: {
    platform: (): Promise<Platform> => ipcRenderer.invoke("app:platform"),
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke("app:open-external", url),
    onNav: (fn: (route: string) => void) => on("nav", fn),
    onTranslate: (fn: (p: PopupPayload) => void) => on("main:translate", fn),
    onTheme: (fn: (dark: boolean) => void) => on("theme:changed", fn),
    onPlatform: (fn: (p: Platform) => void) => on("platform:changed", fn),
    windowControl: (action: "minimize" | "maximize" | "close") =>
      ipcRenderer.send("window:control", action),
  },
  clipboard: {
    write: (text: string): Promise<void> =>
      ipcRenderer.invoke("clipboard:write", text),
    readImage: (): Promise<string | null> =>
      ipcRenderer.invoke("clipboard:read-image"),
  },
  file: {
    save: (opts: {
      name: string
      content: string
      filters?: { name: string; extensions: string[] }[]
    }): Promise<string | null> => ipcRenderer.invoke("file:save", opts),
    readText: (
      filters?: { name: string; extensions: string[] }[]
    ): Promise<{ name: string; content: string } | null> =>
      ipcRenderer.invoke("file:read-text", filters),
  },
}

export type HzApi = typeof api

contextBridge.exposeInMainWorld("hz", api)
