import { CheckIcon, CopyIcon, InfoIcon, TriangleAlertIcon } from "lucide-react"
import { motion } from "motion/react"
import { useState, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Block } from "@shared/blocks"
import { textDir } from "@shared/languages"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { hz } from "@/lib/hz"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useOriginalLook } from "@/prototype/look"

export function Appear({
  children,
  index = 0,
  className,
}: {
  children: ReactNode
  index?: number
  className?: string
}) {
  const original = useOriginalLook()
  return (
    <motion.div
      className={className}
      // A short rise with no blur: a filter on every streamed block costs a repaint
      // per frame, and an ancestor with one cuts nested glass off from its backdrop.
      // The original look (comparison picker) keeps the entrance it had on main.
      {...(original
        ? {
            initial: { opacity: 0, y: 6, filter: "blur(6px)" },
            animate: { opacity: 1, y: 0, filter: "blur(0px)" },
            transition: {
              duration: 0.38,
              ease: [0.22, 1, 0.36, 1],
              delay: Math.min(index, 6) * 0.03,
            },
          }
        : {
            initial: { opacity: 0, y: 4 },
            animate: { opacity: 1, y: 0 },
            transition: {
              duration: 0.24,
              ease: [0.23, 1, 0.32, 1],
              delay: Math.min(index, 6) * 0.03,
            },
          })}
    >
      {children}
    </motion.div>
  )
}

/** Inline markdown only: bold, italic, code and links inside a paragraph. */
export function Inline({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      allowedElements={["p", "strong", "em", "code", "a", "del", "br"]}
      unwrapDisallowed
      components={{
        p: ({ children }) => <>{children}</>,
        code: ({ children }) => (
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.88em]">
            {children}
          </code>
        ),
        a: ({ children, href }) => (
          <a
            className="text-primary underline-offset-4 hover:underline"
            onClick={(e) => (
              e.preventDefault(),
              href && hz.app.openExternal(href)
            )}
            href={href}
          >
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

/** Full markdown for plain (non-block) document output. */
export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h2 className="mt-5 mb-2 text-xl font-semibold first:mt-0">
            {children}
          </h2>
        ),
        h2: ({ children }) => (
          <h3 className="mt-5 mb-2 text-lg font-semibold first:mt-0">
            {children}
          </h3>
        ),
        h3: ({ children }) => (
          <h4 className="mt-4 mb-1.5 font-semibold first:mt-0">{children}</h4>
        ),
        p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="mb-3 list-disc ps-6 marker:text-muted-foreground">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-3 list-decimal ps-6 marker:text-muted-foreground">
            {children}
          </ol>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-3 border-s-2 border-primary/40 ps-4 text-muted-foreground">
            {children}
          </blockquote>
        ),
        code: ({ children, className }) =>
          className ? (
            <code className={className}>{children}</code>
          ) : (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.88em]">
              {children}
            </code>
          ),
        pre: ({ children }) => (
          <pre
            dir="ltr"
            className="mb-3 overflow-x-auto rounded-xl bg-muted p-3 font-mono text-[13px] leading-relaxed"
          >
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="mb-3 overflow-hidden rounded-xl ring-1 ring-border">
            <Table>{children}</Table>
          </div>
        ),
        thead: ({ children }) => <TableHeader>{children}</TableHeader>,
        tbody: ({ children }) => <TableBody>{children}</TableBody>,
        tr: ({ children }) => <TableRow>{children}</TableRow>,
        th: ({ children }) => <TableHead>{children}</TableHead>,
        td: ({ children }) => (
          <TableCell className="whitespace-normal">{children}</TableCell>
        ),
        a: ({ children, href }) => (
          <a
            className="text-primary underline-offset-4 hover:underline"
            onClick={(e) => (
              e.preventDefault(),
              href && hz.app.openExternal(href)
            )}
            href={href}
          >
            {children}
          </a>
        ),
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

function CopyChip({
  text,
  children,
  className,
}: {
  text: string
  children: ReactNode
  className?: string
}) {
  const [done, setDone] = useState(false)
  const original = useOriginalLook()
  return (
    <button
      type="button"
      className={cn(
        original
          ? "group/chip inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm ring-1 ring-border transition hover:bg-accent hover:ring-primary/30 active:scale-[0.98]"
          : "group/chip inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sm ring-1 ring-border transition-[background-color,box-shadow,scale] duration-150 ease-(--ease-out) hover:bg-accent hover:ring-primary/30 active:scale-[0.97]",
        className
      )}
      onClick={() => {
        void hz.clipboard.write(text)
        setDone(true)
        setTimeout(() => setDone(false), 1000)
      }}
    >
      {children}
      {done && <CheckIcon className="size-3 text-success" />}
    </button>
  )
}

export function CodeBlock({ text, lang }: { text: string; lang?: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="group/code relative" dir="ltr">
      <pre className="overflow-x-auto rounded-xl bg-muted p-3 pe-10 font-mono text-[13px] leading-relaxed">
        <code>{text}</code>
      </pre>
      {lang && (
        <span className="absolute end-10 top-2 text-[10px] tracking-wide text-muted-foreground uppercase">
          {lang}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute end-2 top-2 opacity-0 group-hover/code:opacity-100"
        onClick={() => {
          void hz.clipboard.write(text)
          setDone(true)
          setTimeout(() => setDone(false), 1000)
        }}
      >
        {done ? <CheckIcon /> : <CopyIcon />}
      </Button>
    </div>
  )
}

/** Renders one generative-UI block. Dictionary-specific blocks are composed by DictionaryView. */
export function BlockView({
  block,
  size,
}: {
  block: Block
  size: "popup" | "main"
}) {
  const t = useT()
  switch (block.t) {
    case "h":
      return (
        <h3
          className={cn(
            "font-semibold tracking-tight",
            (block.level ?? 2) <= 2 ? "text-lg" : "text-base"
          )}
        >
          {block.text}
        </h3>
      )
    case "p":
      return (
        <p
          className={cn(
            "whitespace-pre-wrap",
            size === "main" && "text-[15.5px]"
          )}
          dir="auto"
        >
          <Inline text={block.text} />
        </p>
      )
    case "list": {
      const Tag = block.ordered ? "ol" : "ul"
      return (
        <Tag
          className={cn(
            "flex flex-col gap-1 ps-6 marker:text-muted-foreground",
            block.ordered ? "list-decimal" : "list-disc"
          )}
        >
          {block.items.map((it, i) => (
            <li key={i}>
              <Inline text={it} />
            </li>
          ))}
        </Tag>
      )
    }
    case "table": {
      const [head, ...rows] = block.rows
      return (
        <div className="overflow-hidden rounded-xl ring-1 ring-border">
          <Table>
            {head && (
              <TableHeader>
                <TableRow>
                  {head.map((c, i) => (
                    <TableHead key={i}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  {r.map((c, j) => (
                    <TableCell key={j} className="whitespace-normal">
                      <Inline text={c} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )
    }
    case "code":
      return <CodeBlock text={block.text} lang={block.lang} />
    case "quote":
      return (
        <blockquote
          className="border-s-2 border-primary/40 ps-4 text-muted-foreground"
          dir={textDir(block.text)}
        >
          <span className="mb-1 block text-xs font-medium tracking-wide text-muted-foreground/80">
            {t("originalText")}
          </span>
          <span className="whitespace-pre-wrap">{block.text}</span>
        </blockquote>
      )
    case "alt":
      return (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("alternatives")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {block.items.map((a, i) => (
              <CopyChip key={i} text={a.text}>
                <span>{a.text}</span>
                {a.note && (
                  <span className="text-xs text-muted-foreground">
                    · {a.note}
                  </span>
                )}
              </CopyChip>
            ))}
          </div>
        </div>
      )
    case "note":
      return (
        <Alert className="glass-flat border-0">
          {block.tone === "warn" ? <TriangleAlertIcon /> : <InfoIcon />}
          <AlertTitle>{t("note")}</AlertTitle>
          <AlertDescription>
            <Inline text={block.text} />
          </AlertDescription>
        </Alert>
      )
    case "term":
      return (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("terms")}
          </span>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-1.5">
            {block.items.map((it, i) => (
              <div
                key={i}
                className="glass-flat flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm"
              >
                <span dir="auto" className="truncate text-muted-foreground">
                  {it.src}
                </span>
                <span dir="auto" className="truncate font-medium">
                  {it.tgt}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    case "def":
      return (
        <p className="text-sm text-muted-foreground">
          {block.pos && (
            <Badge variant="outline" className="me-1.5">
              {block.pos}
            </Badge>
          )}
          <Inline text={block.text} />
        </p>
      )
    default:
      return null
  }
}

export { CopyChip }
