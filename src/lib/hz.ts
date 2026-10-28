import type { HzApi } from "../../electron/preload"

declare global {
  interface Window {
    hz: HzApi
  }
}

export const hz = window.hz
