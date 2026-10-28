import { Volume2Icon } from "lucide-react"
import type { Block } from "@shared/blocks"
import { isRtl } from "@shared/languages"
import type { DictionaryData } from "@shared/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useT, useUiLang } from "@/lib/i18n"
import { speak } from "@/lib/speech"
import { cn } from "@/lib/utils"
import { Appear, CopyChip, Inline } from "./blocks"

export interface DictModel {
  word: string
  phonetic?: string
  translation?: string
  senses: { pos: string; items: { text: string; back?: string[] }[] }[]
  defs: { pos?: string; text: string; example?: string }[]
  examples: { src: string; tgt?: string }[]
  synonyms: string[]
}

export function fromGoogle(d: DictionaryData): DictModel {
  return {
    word: d.word,
    phonetic: d.phonetic,
    translation: d.translation,
    senses: d.senses.map((s) => ({
      pos: s.pos,
      items: s.terms.map((t) => ({ text: t.text, back: t.back })),
    })),
    defs: d.definitions.map((x) => ({
      pos: x.pos,
      text: x.gloss,
      example: x.example,
    })),
    examples: d.examples.map((src) => ({ src })),
    synonyms: d.synonyms,
  }
}

export function fromBlocks(blocks: Block[], fallbackWord: string): DictModel {
  const m: DictModel = {
    word: fallbackWord,
    senses: [],
    defs: [],
    examples: [],
    synonyms: [],
  }
  for (const b of blocks) {
    if (b.t === "word")
      Object.assign(m, {
        word: b.text || fallbackWord,
        phonetic: b.phonetic,
        translation: b.translation,
      })
    else if (b.t === "sense")
      m.senses.push({ pos: b.pos, items: b.items.map((text) => ({ text })) })
    else if (b.t === "def") m.defs.push({ pos: b.pos, text: b.text })
    else if (b.t === "ex") m.examples.push({ src: b.src, tgt: b.tgt })
    else if (b.t === "syn") m.synonyms.push(...b.items)
    else if (b.t === "p" && !m.translation) m.translation = b.text
  }
  return m
}

export function DictionaryView({
  model,
  sourceLang,
  targetLang,
  size,
  streaming,
}: {
  model: DictModel
  sourceLang: string
  targetLang: string
  size: "popup" | "main"
  streaming?: boolean
}) {
  const t = useT()
  // Runs keep their own direction but line up with the UI edge (Chromium lacks text-align: match-parent).
  const MATCH = { textAlign: useUiLang() === "fa" ? "right" : "left" } as const
  const srcDir = isRtl(sourceLang) ? "rtl" : "ltr"
  const tgtDir = isRtl(targetLang) ? "rtl" : "ltr"
  return (
    <div className="flex flex-col gap-4">
      <Appear className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span
            dir={srcDir}
            className={cn(
              "font-semibold tracking-tight",
              size === "main" ? "text-3xl" : "text-2xl"
            )}
          >
            {model.word}
          </span>
          {model.phonetic && (
            <span dir="ltr" className="font-mono text-sm text-muted-foreground">
              {model.phonetic}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            className="self-center"
            onClick={() => speak(model.word, sourceLang)}
            aria-label={t("listen")}
          >
            <Volume2Icon />
          </Button>
        </div>
        {model.translation && (
          <div
            dir={tgtDir}
            style={MATCH}
            className={cn(
              "reading font-medium text-primary",
              size === "main" ? "text-2xl" : "text-xl",
              streaming && !model.senses.length && "caret"
            )}
          >
            {model.translation}
          </div>
        )}
      </Appear>

      {model.senses.length > 0 && (
        <div className="flex flex-col gap-3">
          {model.senses.map((s, i) => (
            <Appear key={i} index={i} className="flex flex-col gap-1.5">
              <Badge variant="outline" className="w-fit">
                {s.pos}
              </Badge>
              <div className="flex flex-wrap gap-1.5">
                {s.items.map((it, j) => (
                  <CopyChip
                    key={j}
                    text={it.text}
                    className={cn(j === 0 && "bg-primary/10 ring-primary/25")}
                  >
                    <span dir="auto" className="reading leading-normal">
                      {it.text}
                    </span>
                    {it.back && it.back.length > 0 && size === "main" && (
                      <span
                        className="text-xs text-muted-foreground"
                        dir={srcDir}
                      >
                        {it.back.slice(0, 3).join(", ")}
                      </span>
                    )}
                  </CopyChip>
                ))}
              </div>
            </Appear>
          ))}
        </div>
      )}

      {(model.defs.length > 0 || model.examples.length > 0) && <Separator />}

      {model.defs.length > 0 && (
        <Appear className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("definitions")}
          </span>
          {model.defs.slice(0, size === "main" ? 6 : 3).map((d, i) => (
            <div key={i} className="flex flex-col gap-0.5 text-sm">
              <div>
                {d.pos && (
                  <span className="me-1.5 text-xs text-muted-foreground">
                    {d.pos}
                  </span>
                )}
                <span dir="auto">
                  <Inline text={d.text} />
                </span>
              </div>
              {d.example && (
                <div
                  dir="auto"
                  className="text-muted-foreground italic"
                  style={MATCH}
                >
                  “{d.example}”
                </div>
              )}
            </div>
          ))}
        </Appear>
      )}

      {model.examples.length > 0 && (
        <Appear className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("examples")}
          </span>
          {model.examples.slice(0, size === "main" ? 5 : 2).map((ex, i) => (
            <div
              key={i}
              className="flex flex-col gap-0.5 border-s-2 border-primary/30 ps-3 text-sm"
            >
              <span
                dir={srcDir}
                className="text-muted-foreground"
                style={MATCH}
              >
                {ex.src}
              </span>
              {ex.tgt && (
                <span
                  dir={tgtDir}
                  className="reading leading-normal"
                  style={MATCH}
                >
                  {ex.tgt}
                </span>
              )}
            </div>
          ))}
        </Appear>
      )}

      {model.synonyms.length > 0 && (
        <Appear className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("synonyms")}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {model.synonyms.slice(0, 10).map((s) => (
              <Badge key={s} variant="secondary" dir={srcDir}>
                {s}
              </Badge>
            ))}
          </div>
        </Appear>
      )}
    </div>
  )
}
