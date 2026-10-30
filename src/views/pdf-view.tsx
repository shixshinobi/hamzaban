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
import { Markdown } from "@/components/result/blocks"
import { TranslateToolbar } from "@/components/translate-toolbar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
  error?: string
}

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

function PageThumb({ doc, n }: { doc: PDFDocumentProxy; n: number }) {
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
      const canvas = await renderPage(page, 380)
      if (cancelled || !ref.current) return
      canvas.className =
        "w-full h-auto rounded-lg bg-white shadow-md ring-1 ring-black/5"
      ref.current.replaceChildren(canvas)
    })
    return () => {
      cancelled = true
    }
  }, [visible, doc, n])
  return (
    <div ref={ref} className="w-full">
      <Skeleton className="aspect-[1/1.414] w-full rounded-lg" />
    </div>
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
  const [view, setView] = useState<"side" | "only">("side")
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
          // Only finished chunks are kept; the one cut short is translated again later.
          patch(n, {
            result: parts.join("\n\n"),
            ...(signal.aborted
              ? { status: parts.length ? "partial" : "idle" }
              : { status: "error", error: (e as Error).message }),
          })
          return signal.aborted
            ? undefined
            : (e as Error & { code?: ErrorCode })
        }
      }
      patch(n, { status: "done" })
    },
    // patch only touches refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doc, settings]
  )

  /** Translates the given pages in order, or every unfinished page. */
  const run = async (only?: number) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setRunning(true)
    const todo = only
      ? [only]
      : pagesRef.current.filter((p) => p.status !== "done").map((p) => p.n)
    for (const n of todo) {
      if (ac.signal.aborted) break
      const err = await translatePage(n, ac.signal)
      // These fail the same way on every page: going on only burns more of the quota.
      if (err?.code && STOP_ON.includes(err.code)) {
        toast.error(t("pdfStopped"), { description: err.message })
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

  const doneCount = pages.filter((p) => p.status === "done").length
  const started = pages.some((p) => p.status === "partial" || p.parts.length)
  const dir = isRtl(settings.targetLang) ? "rtl" : "ltr"

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
              onValueChange={(v) => v[0] && setView(v[0] as "side" | "only")}
              size="sm"
              variant="outline"
              spacing={0}
            >
              <ToggleGroupItem value="side">{t("sideBySide")}</ToggleGroupItem>
              <ToggleGroupItem value="only">
                {t("translationOnly")}
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
                  <Button size="sm" variant="outline" disabled={!doneCount} />
                }
              >
                <DownloadIcon data-icon="inline-start" />
                {t("export")}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
                          {p.n.toLocaleString(ui === "fa" ? "fa-IR" : "en-US")}
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
                      ) : p.status === "error" ? (
                        <p className="text-sm text-destructive" dir="auto">
                          {p.error}
                        </p>
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
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  )
}
