import arabicFont from "@fontsource-variable/vazirmatn/files/vazirmatn-arabic-wght-normal.woff2?url"
import latinFont from "@fontsource-variable/vazirmatn/files/vazirmatn-latin-wght-normal.woff2?url"
import { isRtl } from "@shared/languages"
import { loadImage, regionStyle, type LayoutPage } from "./layout"
import { fitText, LAYOUT_CSS } from "./layout-fit"

export interface LayoutSheet {
  page: LayoutPage
  tr: (string | null)[]
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")

async function dataUrl(url: string) {
  const blob = await (await fetch(url)).blob()
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

/** The page with every translated region's original text painted out, as one picture. */
async function background(sheet: LayoutSheet) {
  const { page, tr } = sheet
  const canvas = document.createElement("canvas")
  canvas.width = page.width
  canvas.height = page.height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(await loadImage(page.image), 0, 0)
  for (const [i, r] of page.regions.entries()) {
    if (!tr[i]) continue
    const [x, y, w, h] = r.box
    ctx.drawImage(
      await loadImage(r.patch),
      x * page.width,
      y * page.height,
      w * page.width,
      h * page.height
    )
  }
  return canvas.toDataURL("image/jpeg", 0.9)
}

/**
 * A self-contained HTML copy of the pages with the translations in place: the font,
 * the pictures and the fitting script are all inside, and it prints one sheet per page.
 */
export async function layoutHtml(
  sheets: LayoutSheet[],
  lang: string,
  title: string
) {
  const dir = isRtl(lang) ? "rtl" : "ltr"
  const [arabic, latin] = await Promise.all([
    dataUrl(arabicFont),
    dataUrl(latinFont),
  ])
  const pages: string[] = []
  for (const sheet of sheets) {
    const regions = sheet.page.regions
      .map((r, i) => {
        const text = sheet.tr[i]
        if (!text) return ""
        const style = Object.entries(regionStyle(r, lang))
          .map(([k, v]) => `${k}:${v}`)
          .join(";")
        return `<div class="hz-r" data-fit${r.pitch ? " data-multi" : ""} style="${esc(style)}"><div dir="${dir}">${r.marker ? `<span class="hz-mark">${esc(r.marker)}</span>` : ""}${esc(text)}</div></div>`
      })
      .join("")
    pages.push(
      `<section class="hz-page" style="aspect-ratio:${sheet.page.width}/${sheet.page.height}"><img class="hz-bg" alt="" src="${await background(sheet)}">${regions}</section>`
    )
  }
  const first = sheets[0].page
  const printW = Math.round(first.cssWidth)
  const printH = Math.round((first.cssWidth * first.height) / first.width)
  return {
    width: printW,
    height: printH,
    html: `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
@font-face{font-family:Vazirmatn;font-weight:100 900;src:url(${arabic}) format("woff2");unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC}
@font-face{font-family:Vazirmatn;font-weight:100 900;src:url(${latin}) format("woff2");unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212}
${LAYOUT_CSS}
body{margin:0;background:#e6e7eb}
main{max-width:${Math.max(printW, 600)}px;margin:24px auto;padding:0 16px;display:flex;flex-direction:column;gap:24px}
.hz-page{box-shadow:0 2px 12px rgb(0 0 0 / .12)}
@page{size:${printW}px ${printH}px;margin:0}
@media print{body{background:none}main{max-width:none;margin:0;padding:0;gap:0}.hz-page{box-shadow:none;width:100vw;height:100vh;break-after:page}}
</style></head><body><main>${pages.join("\n")}</main>
<script>(function(){var fit=${fitText.toString()};window.__hzFit=function(){fit(document)};document.fonts.ready.then(window.__hzFit);addEventListener("beforeprint",window.__hzFit)})()</script>
</body></html>`,
  }
}
