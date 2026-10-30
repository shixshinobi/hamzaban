/**
 * Shrink every translated region's text until it fits the original's box: a single
 * line keeps to one line, a paragraph keeps to its height. A line that cannot fit even
 * small is allowed to wrap. Font sizes scale with the page width, so a fit holds at any
 * zoom. Self-contained on purpose: exported pages carry it as their own script.
 */
export function fitText(root: ParentNode) {
  const MIN = 0.55
  root.querySelectorAll<HTMLElement>("[data-fit]").forEach((box) => {
    const inner = box.querySelector<HTMLElement>(":scope > div")
    if (!inner || !box.clientWidth) return
    box.removeAttribute("data-wrap")
    const multi = box.hasAttribute("data-multi")
    const fits = () =>
      multi || box.hasAttribute("data-wrap")
        ? inner.scrollHeight <= box.clientHeight + 1
        : inner.scrollWidth <= box.clientWidth + 1
    const search = () => {
      box.style.setProperty("--fit", "1")
      if (fits()) return true
      let lo = MIN
      let hi = 1
      box.style.setProperty("--fit", String(lo))
      if (!fits()) return false
      for (let k = 0; k < 7; k++) {
        const mid = (lo + hi) / 2
        box.style.setProperty("--fit", String(mid))
        if (fits()) lo = mid
        else hi = mid
      }
      box.style.setProperty("--fit", String(lo))
      return true
    }
    if (search() || multi) return
    box.setAttribute("data-wrap", "")
    if (!search()) box.style.setProperty("--fit", String(MIN))
  })
}

/** Shared by the app and exported pages, so both look the same. */
export const LAYOUT_CSS = `
.hz-page{position:relative;width:100%;container-type:inline-size;overflow:hidden;background:#fff}
.hz-page>.hz-bg{position:absolute;inset:0;width:100%;height:100%;display:block;user-select:none}
.hz-r{position:absolute;display:flex;flex-direction:column;justify-content:center}
.hz-r[data-multi]{justify-content:flex-start}
.hz-page{font-family:"Vazirmatn Variable",Vazirmatn,"Segoe UI",system-ui,sans-serif}
.hz-r>div{position:relative;font-family:var(--f, inherit);font-size:calc(var(--s) * var(--fit, 1) * 1cqw);line-height:var(--lh);color:var(--c);font-weight:var(--w);text-align:var(--a);text-align-last:var(--al);white-space:nowrap;overflow-wrap:break-word}
.hz-r[data-multi]>div,.hz-r[data-wrap]>div{white-space:normal}
`
