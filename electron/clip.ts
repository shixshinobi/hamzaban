// Thin wrapper over Electron's async (W3C-style) clipboard API.
import { clipboard, ClipboardItem } from "electron"

export const readText = () => clipboard.readText().catch(() => "")
export const writeText = (text: string) => clipboard.writeText(text)

/** Primary selection on Linux (middle-click buffer); empty elsewhere. */
export async function readSelectionText(): Promise<string> {
  if (process.platform !== "linux" || !clipboard.selection) return ""
  return clipboard.selection.readText().catch(() => "")
}

export async function readImageDataUrl(): Promise<string | null> {
  const items = await clipboard
    .read()
    .catch(() => [] as Electron.ClipboardItem[])
  for (const item of items) {
    const type = item.types.find((t) => t.startsWith("image/"))
    if (!type) continue
    const blob = (await item.getType(type)) as Blob
    const buf = Buffer.from(await blob.arrayBuffer())
    return `data:${type};base64,${buf.toString("base64")}`
  }
  return null
}

/** Snapshot every representation on the clipboard so it can be restored later. */
export async function snapshot(): Promise<Electron.ClipboardItem[]> {
  const items = await clipboard
    .read()
    .catch(() => [] as Electron.ClipboardItem[])
  const copies: Electron.ClipboardItem[] = []
  for (const item of items) {
    const record: Record<string, Blob | string> = {}
    for (const type of item.types) {
      try {
        const v = await item.getType(type)
        if (v instanceof Blob || typeof v === "string") record[type] = v
      } catch {
        // skip unreadable formats
      }
    }
    if (Object.keys(record).length) copies.push(new ClipboardItem(record))
  }
  return copies
}

export async function restore(items: Electron.ClipboardItem[]) {
  if (items.length) await clipboard.write(items).catch(() => clipboard.clear())
  else clipboard.clear()
}
