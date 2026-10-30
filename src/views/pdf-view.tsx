import {
  CheckIcon,
  DownloadIcon,
  FilePlusIcon,
  FileTextIcon,
  LanguagesIcon,
  PauseIcon,
  PlayIcon,
  SquareIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { isRtl, languageName } from "@shared/languages"
import type { ErrorCode } from "@shared/types"
import { GlassPanel } from "@/components/glass/glass-panel"
import { LayoutCanvas } from "@/components/layout/layout-canvas"
import { Markdown } from "@/components/result/blocks"
import {
  ErrorDetail,
  errorHint,
  errorTitle,
} from "@/components/result/error-text"
import { TranslateToolbar } from "@/components/translate-toolbar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { hz } from "@/lib/hz"
import { useT, useUiLang } from "@/lib/i18n"
import { pdfLayout, releaseLayout, type LayoutPage } from "@/lib/layout"
import { layoutHtml } from "@/lib/layout-export"
import { translatePieces } from "@/lib/layout-translate"
import { recognize } from "@/lib/ocr"
import { openPdf, pageText, renderPage, type PDFDocumentProxy } from "@/lib/pdf"
import { buildRequest } from "@/lib/request"
import { useApp } from "@/lib/store"
import { translateAsync } from "@/lib/translate-async"
import { cn } from "@/lib/utils"

interface PageState {
  n: number
  text: string | null
  result: string
  /** Translations of the page's finished chunks, kept so a stopped page resumes. */
  parts: string[]
  /** "partial": stopped with some chunks translated. */
  status: "idle" | "ocr" | "working" | "partial" | "done" | "error"
  error?: { message: string; code?: ErrorCode }
  /** The same page translated in place, for the "as the original" view. */
  layout?: LayoutState
}

interface LayoutState {
  page?: LayoutPage
  /** One per region; null until it is translated. */
  tr: (string | null)[]
  status: "reading" | "ocr" | "working" | "partial" | "done" | "error"
  error?: { message: string; code?: ErrorCode }
}

type View = "side" | "only" | "layout"

/** Errors that end a whole-document run instead of moving on to the next page. */
const STOP_ON: ErrorCode[] = [
  "quota",
  "auth",
  "blocked",
  "needs-login",
  "not-installed",
]

/** Pages go out in chunks of whole paragraphs, small enough to resume after a stop. */
function splitChunks(text: string, max = 2500) {
  const chunks: string[] = []
  let cur = ""
  for (const para of text.split(/\n{2,}/)) {
    if (cur && cur.length + para.length + 2 > max) {
      chunks.push(cur)
      cur = para
    } else cur = cur ? `${cur}\n\n${para}` : para
  }
  if (cur.trim()) chunks.push(cur)
  return chunks
}

function PageThumb({
  doc,
  n,
  width = 380,
}: {
  doc: PDFDocumentProxy
  n: number
  width?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && setVisible(true),
      { rootMargin: "400px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!visible || !ref.current) return
    let cancelled = false
    void doc.getPage(n).then(async (page) => {
      const canvas = await renderPage(page, width)
      if (cancelled || !ref.current) return
      canvas.className =
        "w-full h-auto rounded-lg bg-white shadow-md ring-1 ring-black/5"
      ref.current.replaceChildren(canvas)
    })
    return () => {
      cancelled = true
    }
  }, [visible, doc, n, width])
  return (
    <div ref={ref} className="w-full">
      <Skeleton className="aspect-[1/1.414] w-full rounded-lg" />
    </div>
  )
}

/** A page in the "as the original" view: the original beside its in-place translation. */
function LayoutCard({
  doc,
  p,
  lang,
  running,
  onTranslate,
}: {
  doc: PDFDocumentProxy
  p: PageState
  lang: string
  running: boolean
  onTranslate: () => void
}) {
  const t = useT()
  const ui = useUiLang()
  const lay = p.layout
  const busy =
    lay?.status === "reading" ||
    lay?.status === "ocr" ||
    lay?.status === "working"
  const total = lay?.page?.regions.length ?? 0
  const count = lay?.tr.filter(Boolean).length ?? 0
  const num = (v: number) => v.toLocaleString(ui === "fa" ? "fa-IR" : "en-US")
  return (
    <GlassPanel className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">
          {t("page")} {num(p.n)}
        </Badge>
        {busy && <Spinner className="size-3.5" />}
        {lay?.status === "reading" && (
          <span className="shimmer-text text-xs">{t("layoutReading")}</span>
        )}
        {lay?.status === "ocr" && (
          <span className="shimmer-text text-xs">{t("ocrRunning")}</span>
        )}
        {lay?.status === "working" && total > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {num(count)}/{num(total)}
          </span>
        )}
        {lay?.status === "done" && total > 0 && (
          <CheckIcon className="size-3.5 text-success" />
        )}
        {lay?.status === "partial" && (
          <Badge variant="secondary">
            <PauseIcon data-icon="inline-start" />
            {t("pagePartial")}
          </Badge>
        )}
        {lay?.status === "error" && (
          <TriangleAlertIcon className="size-3.5 text-destructive" />
        )}
        <div className="flex-1" />
        {!running && !busy && (
          <Button size="xs" variant="ghost" onClick={onTranslate}>
            <LanguagesIcon data-icon="inline-start" />
            {t("translatePage")}
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">
            {t("originalPage")}
          </span>
          {lay?.page ? (
            <LayoutCanvas page={lay.page} tr={[]} lang={lang} />
          ) : (
            <PageThumb doc={doc} n={p.n} width={720} />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">
            {t("translatedPage")}
          </span>
          {lay?.status === "error" && lay.error && (
            <PageError error={lay.error} />
          )}
          {lay?.page ? (
            total ? (
              <LayoutCanvas page={lay.page} tr={lay.tr} lang={lang} />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("layoutNoText")}
              </p>
            )
          ) : busy ? (
            <Skeleton className="aspect-[1/1.414] w-full rounded-lg" />
          ) : (
            <p className="text-sm text-muted-foreground">{t("layoutHint")}</p>
          )}
        </div>
      </div>
    </GlassPanel>
  )
}

function PageError({ error }: { error: NonNullable<PageState["error"]> }) {
  const t = useT()
  const hint = errorHint(error.code)
  return (
    <Alert variant="destructive" className="glass-flat border-0">
      <AlertTitle>{t(errorTitle(error.code))}</AlertTitle>
      <AlertDescription className="break-words">
        {hint && <p>{t(hint)}</p>}
        <ErrorDetail message={error.message} />
      </AlertDescription>
    </Alert>
  )
}

function exportDoc(
  pages: PageState[],
  name: string,
  format: "md" | "html" | "txt",
  targetLang: string
) {
  const done = pages.filter((p) => p.result)
  const base = name.replace(/\.pdf$/i, "")
  if (format === "txt")
    return {
      name: `${base}.${targetLang}.txt`,
      content: done.map((p) => p.result).join("\n\n\f\n\n"),
    }
  const md = done
    .map((p) => `<!-- page ${p.n} -->\n\n${p.result}`)
    .join("\n\n---\n\n")
  if (format === "md") return { name: `${base}.${targetLang}.md`, content: md }
  const dir = isRtl(targetLang) ? "rtl" : "ltr"
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  const body = done
    .map(
      (p) =>
        `<section><h6>${p.n}</h6>${p.result
          .split(/\n{2,}/)
          .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
          .join("")}</section>`
    )
    .join("\n")
  return {
    name: `${base}.${targetLang}.html`,
    content: `<!doctype html><html lang="${targetLang}" dir="${dir}"><meta charset="utf-8"><title>${esc(base)}</title>
<style>body{font-family:Vazirmatn,"Segoe UI",system-ui,sans-serif;max-width:46rem;margin:3rem auto;padding:0 1.5rem;line-height:2;color:#1d1f24}
section{border-bottom:1px solid #e6e7ea;padding:1.5rem 0}h6{color:#8a8f98;font-weight:500;margin:0 0 .5rem}p{text-align:justify}</style>
<body>${body}</body></html>`,
  }
}

export function PdfView() {
  const t = useT()
  const ui = useUiLang()
  const settings = useApp((s) => s.settings!)
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [name, setName] = useState("")
  const [pages, setPages] = useState<PageState[]>([])
  const [running, setRunning] = useState(false)
  const [view, setView] = useState<View>("side")
  const [dragOver, setDragOver] = useState(false)
  /** The file being picked or opened, for the loading state. */
  const [opening, setOpening] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  /** Pages whose text has been read so far. */
  const [extracted, setExtracted] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  // The latest pages, for loops that outlive the render they started in.
  const pagesRef = useRef<PageState[]>([])
  const loadId = useRef(0)

  const setAll = (next: PageState[]) => {
    pagesRef.current = next
    setPages(next)
  }
  const patch = (n: number, p: Partial<PageState>) =>
    setAll(pagesRef.current.map((x) => (x.n === n ? { ...x, ...p } : x)))

  const load = async (name: string, data: ArrayBuffer | Uint8Array) => {
    abortRef.current?.abort()
    const id = ++loadId.current
    setOpening(name)
    let d: PDFDocumentProxy
    try {
      d = await openPdf(data)
    } catch (e) {
      setOpening(null)
      toast.error(t("pdfOpenFailed"), {
        description: (e as Error).message,
      })
      return
    }
    if (id !== loadId.current) return
    for (const p of pagesRef.current) releaseLayout(p.layout?.page)
    setDoc(d)
    setName(name)
    setExtracted(0)
    setAll(
      Array.from({ length: d.numPages }, (_, i) => ({
        n: i + 1,
        text: null,
        result: "",
        parts: [],
        status: "idle",
      }))
    )
    setOpening(null)
    // Extract text up front so the reader can show it immediately; updates are batched
    // so a long document does not re-render every page for every page read.
    let batch: Record<number, string> = {}
    const flush = () => {
      const texts = batch
      batch = {}
      setAll(
        pagesRef.current.map((p) =>
          p.n in texts ? { ...p, text: texts[p.n] } : p
        )
      )
    }
    for (let n = 1; n <= d.numPages; n++) {
      if (id !== loadId.current) return
      batch[n] = await pageText(await d.getPage(n))
      if (n % 8 === 0 || n === d.numPages) {
        flush()
        setExtracted(n)
      }
    }
  }

  const chooseFile = async () => {
    setPicking(true)
    try {
      const f = await hz.file.readBinary(
        [{ name: "PDF", extensions: ["pdf"] }],
        (picked) => setOpening(picked)
      )
      if (f) await load(f.name, f.data)
      else setOpening(null)
    } catch (e) {
      setOpening(null)
      toast.error(t("pdfOpenFailed"), { description: (e as Error).message })
    } finally {
      setPicking(false)
    }
  }

  const translatePage = useCallback(
    async (n: number, signal: AbortSignal) => {
      if (!doc) return
      const page = pagesRef.current.find((p) => p.n === n)
      if (!page) return
      let text = page.text ?? (await pageText(await doc.getPage(n)))
      if (signal.aborted) return
      if (!text.trim()) {
        patch(n, { status: "ocr" })
        const canvas = await renderPage(await doc.getPage(n), 1400)
        text = await recognize(canvas, settings.sourceLang)
        patch(n, { text, status: "idle" })
        if (signal.aborted) return
      }
      if (!text.trim()) {
        patch(n, { status: "done", result: "" })
        return
      }
      const chunks = splitChunks(text)
      // A finished page asked for again starts over; a stopped one picks up where it was.
      const parts =
        page.status === "done" ? [] : page.parts.slice(0, chunks.length)
      patch(n, {
        status: "working",
        parts,
        result: parts.join("\n\n"),
        error: undefined,
      })
      for (let i = parts.length; i < chunks.length; i++) {
        const before = parts.join("\n\n")
        try {
          const req = {
            ...buildRequest(settings, { text: chunks[i] }),
            smart: false,
          }
          const out = await translateAsync(
            req,
            (partial) =>
              patch(n, {
                result: before ? `${before}\n\n${partial}` : partial,
              }),
            signal
          )
          parts.push(out.trim())
          patch(n, { parts: [...parts], result: parts.join("\n\n") })
        } catch (e) {
          const err = e as Error & { code?: ErrorCode }
          // Only finished chunks are kept; the one cut short is translated again later.
          patch(n, {
            result: parts.join("\n\n"),
            ...(signal.aborted
              ? { status: parts.length ? "partial" : "idle" }
              : {
                  status: "error",
                  error: { message: err.message, code: err.code },
                }),
          })
          return signal.aborted ? undefined : err
        }
      }
      patch(n, { status: "done" })
    },
    // patch only touches refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, settings]
  )

  const patchLayout = (n: number, p: Partial<LayoutState>) => {
    const cur = pagesRef.current.find((x) => x.n === n)?.layout
    patch(n, { layout: { tr: [], status: "reading", ...cur, ...p } })
  }

  /** Translates one page in place, keeping its layout. Returns the error that stopped it. */
  const translateLayout = useCallback(
    async (n: number, signal: AbortSignal) => {
      if (!doc) return
      let page = pagesRef.current.find((x) => x.n === n)?.layout?.page
      try {
        if (!page) {
          patchLayout(n, { status: "reading", error: undefined })
          page = await pdfLayout(
            await doc.getPage(n),
            settings.sourceLang,
            () => patchLayout(n, { status: "ocr" })
          )
          patchLayout(n, { page, tr: page.regions.map(() => null) })
        }
        if (signal.aborted) return patchLayout(n, { status: "partial" })
        const prev = pagesRef.current.find((x) => x.n === n)!.layout!
        // A finished page asked for again starts over; a stopped one picks up where it was.
        let tr = prev.status === "done" ? page.regions.map(() => null) : prev.tr
        patchLayout(n, { status: "working", tr, error: undefined })
        await translatePieces(
          page.regions.map((r) => r.text),
          tr,
          settings,
          (i, text) => {
            tr = tr.map((x, k) => (k === i ? text : x))
            patchLayout(n, { tr })
          },
          signal
        )
        patchLayout(n, { status: "done" })
      } catch (e) {
        const err = e as Error & { code?: ErrorCode }
        if (signal.aborted) return patchLayout(n, { status: "partial" })
        patchLayout(n, {
          status: "error",
          error: { message: err.message, code: err.code },
        })
        return err
      }
    },
    // patchLayout only touches refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, settings]
  )

  /** Translates the given pages in order, or every unfinished page. */
  const run = async (only?: number) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setRunning(true)
    const inPlace = view === "layout"
    const todo = only
      ? [only]
      : pagesRef.current
          .filter((p) => (inPlace ? p.layout?.status : p.status) !== "done")
          .map((p) => p.n)
    for (const n of todo) {
      if (ac.signal.aborted) break
      const err = await (inPlace ? translateLayout : translatePage)(
        n,
        ac.signal
      )
      // These fail the same way on every page: going on only burns more of the quota.
      if (err?.code && STOP_ON.includes(err.code)) {
        toast.error(t("pdfStopped"), { description: t(errorTitle(err.code)) })
        break
      }
    }
    if (abortRef.current === ac) setRunning(false)
  }

  const stop = () => {
    abortRef.current?.abort()
    setRunning(false)
  }

  useEffect(() => () => abortRef.current?.abort(), [])

  const inPlace = view === "layout"
  const doneCount = pages.filter(
    (p) => (inPlace ? p.layout?.status : p.status) === "done"
  ).length
  const started = inPlace
    ? pages.some((p) => p.layout?.tr.some(Boolean))
    : pages.some((p) => p.status === "partial" || p.parts.length)
  const laidOut = pages.filter((p) => p.layout?.tr.some(Boolean))
  const dir = isRtl(settings.targetLang) ? "rtl" : "ltr"

  const [exporting, setExporting] = useState(false)
  const saveLayout = async (format: "html" | "pdf") => {
    setExporting(true)
    try {
      const base = name.replace(/\.pdf$/i, "")
      const out = await layoutHtml(
        laidOut.map((p) => ({ page: p.layout!.page!, tr: p.layout!.tr })),
        settings.targetLang,
        base
      )
      const file = `${base}.${settings.targetLang}.${format}`
      const saved =
        format === "html"
          ? await hz.file.save({
              name: file,
              content: out.html,
              filters: [{ name: "HTML", extensions: ["html"] }],
            })
          : await hz.file.saveRendered({ name: file, format, ...out })
      if (saved) toast.success(t("exportSaved"), { description: saved })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const save = async (format: "md" | "html" | "txt") => {
    const out = exportDoc(pages, name, format, settings.targetLang)
    await hz.file.save({
      ...out,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    })
  }

  return (
    <div
      className="flex h-full flex-col gap-3"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const f = [...e.dataTransfer.files].find(
          (x) =>
            x.type === "application/pdf" ||
            x.name.toLowerCase().endsWith(".pdf")
        )
        if (f) void f.arrayBuffer().then((data) => load(f.name, data))
      }}
    >
      <TranslateToolbar />

      {opening !== null && !doc ? (
        <GlassPanel className="flex flex-1 items-center justify-center">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Spinner />
              </EmptyMedia>
              <EmptyTitle className="shimmer-text">
                {t("pdfOpening")}
              </EmptyTitle>
              <EmptyDescription dir="auto">{opening}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </GlassPanel>
      ) : !doc ? (
        <GlassPanel
          className={cn(
            "flex flex-1 items-center justify-center",
            dragOver && "ring-2 ring-primary/60"
          )}
        >
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileTextIcon />
              </EmptyMedia>
              <EmptyTitle>{t("pdfTitle")}</EmptyTitle>
              <EmptyDescription>{t("pdfHint")}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button disabled={picking} onClick={() => void chooseFile()}>
                {picking ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <FilePlusIcon data-icon="inline-start" />
                )}
                {t("chooseFile")}
              </Button>
            </EmptyContent>
          </Empty>
        </GlassPanel>
      ) : (
        <>
          <GlassPanel className="flex h-12 shrink-0 items-center gap-2 rounded-[20px] px-3">
            {opening !== null ? (
              <Spinner className="size-4 text-muted-foreground" />
            ) : (
              <FileTextIcon className="size-4 text-muted-foreground" />
            )}
            <span className="max-w-60 truncate text-sm font-medium" dir="auto">
              {opening ?? name}
            </span>
            <Badge variant="secondary">
              {pages.length.toLocaleString(ui === "fa" ? "fa-IR" : "en-US")}{" "}
              {t("pages")}
            </Badge>
            <div className="mx-2 flex max-w-56 flex-1 items-center gap-2">
              <Progress
                value={pages.length ? (doneCount / pages.length) * 100 : 0}
                className="h-1.5"
              />
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {doneCount}/{pages.length}
              </span>
            </div>
            {extracted < pages.length && (
              <span className="shimmer-text shrink-0 text-xs">
                {t("pdfReading")}{" "}
                {extracted.toLocaleString(ui === "fa" ? "fa-IR" : "en-US")}/
                {pages.length.toLocaleString(ui === "fa" ? "fa-IR" : "en-US")}
              </span>
            )}
            <div className="flex-1" />
            <ToggleGroup
              value={[view]}
              onValueChange={(v) => v[0] && setView(v[0] as View)}
              size="sm"
              variant="outline"
              spacing={0}
            >
              <ToggleGroupItem value="side">{t("sideBySide")}</ToggleGroupItem>
              <ToggleGroupItem value="only">
                {t("translationOnly")}
              </ToggleGroupItem>
              <ToggleGroupItem value="layout">
                {t("layoutView")}
              </ToggleGroupItem>
            </ToggleGroup>
            {running ? (
              <Button size="sm" variant="secondary" onClick={stop}>
                <SquareIcon data-icon="inline-start" />
                {t("stop")}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={doneCount === pages.length}
                onClick={() => void run()}
              >
                <PlayIcon data-icon="inline-start" />
                {started ? t("translateResume") : t("translateAll")}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      exporting ||
                      (!pages.some((p) => p.result) && !laidOut.length)
                    }
                  />
                }
              >
                {exporting ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <DownloadIcon data-icon="inline-start" />
                )}
                {t("export")}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {laidOut.length > 0 && (
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => void saveLayout("pdf")}>
                      {t("exportLayoutPdf")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void saveLayout("html")}>
                      {t("exportLayoutHtml")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                )}
                {laidOut.length > 0 && pages.some((p) => p.result) && (
                  <DropdownMenuSeparator />
                )}
                {pages.some((p) => p.result) && (
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => void save("md")}>
                      {t("exportMd")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void save("html")}>
                      {t("exportHtml")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void save("txt")}>
                      {t("exportTxt")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon-sm"
              variant="ghost"
              disabled={picking}
              onClick={() => void chooseFile()}
              aria-label={t("openAnother")}
            >
              {picking ? <Spinner /> : <FilePlusIcon />}
            </Button>
          </GlassPanel>

          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-3 pb-2">
              {pages.map((p) => (
                <motion.div
                  key={p.n}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(p.n, 8) * 0.02 }}
                  // Off-screen pages of a long document are skipped until scrolled to.
                  style={{
                    contentVisibility: "auto",
                    containIntrinsicSize: "auto 30rem",
                  }}
                >
                  {view === "layout" ? (
                    <LayoutCard
                      doc={doc}
                      p={p}
                      lang={settings.targetLang}
                      running={running}
                      onTranslate={() => void run(p.n)}
                    />
                  ) : (
                    <GlassPanel
                      className={cn(
                        "grid gap-4 p-4",
                        view === "side"
                          ? "grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,1fr)]"
                          : "grid-cols-[minmax(0,1fr)]"
                      )}
                    >
                      {view === "side" && (
                        <>
                          <PageThumb doc={doc} n={p.n} />
                          <div
                            className="reading selectable max-h-[28rem] overflow-y-auto text-[13.5px] leading-relaxed whitespace-pre-line text-muted-foreground"
                            dir="auto"
                          >
                            {p.text === null ? (
                              <Skeleton className="h-24 w-full" />
                            ) : (
                              p.text || (
                                <span className="italic">
                                  {t("noTextOnPage")}
                                </span>
                              )
                            )}
                          </div>
                        </>
                      )}
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {t("page")}{" "}
                            {p.n.toLocaleString(
                              ui === "fa" ? "fa-IR" : "en-US"
                            )}
                          </Badge>
                          {p.status === "working" && (
                            <Spinner className="size-3.5" />
                          )}
                          {p.status === "ocr" && (
                            <span className="shimmer-text text-xs">
                              {t("ocrRunning")}
                            </span>
                          )}
                          {p.status === "done" && p.result && (
                            <CheckIcon className="size-3.5 text-success" />
                          )}
                          {p.status === "partial" && (
                            <Badge variant="secondary">
                              <PauseIcon data-icon="inline-start" />
                              {t("pagePartial")}
                            </Badge>
                          )}
                          {p.status === "error" && (
                            <TriangleAlertIcon className="size-3.5 text-destructive" />
                          )}
                          <div className="flex-1" />
                          {!running && p.status !== "ocr" && (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => void run(p.n)}
                            >
                              <LanguagesIcon data-icon="inline-start" />
                              {t("translatePage")}
                            </Button>
                          )}
                        </div>
                        {p.result ? (
                          <div
                            className={cn(
                              "reading selectable text-[15px]",
                              p.status === "working" && "caret"
                            )}
                            dir={dir}
                          >
                            <Markdown text={p.result} />
                          </div>
                        ) : p.status === "error" && p.error ? (
                          <PageError error={p.error} />
                        ) : p.status === "working" ? (
                          <div className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-[90%]" />
                            <Skeleton className="h-4 w-[75%]" />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {languageName(settings.targetLang, ui)}
                          </p>
                        )}
                      </div>
                    </GlassPanel>
                  )}
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  )
}
