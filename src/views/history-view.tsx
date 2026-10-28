import {
  HistoryIcon,
  ImageIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useMemo, useState } from "react"
import { languageName } from "@shared/languages"
import type { HistoryItem } from "@shared/types"
import { GlassPanel } from "@/components/glass/glass-panel"
import { CopyAction } from "@/components/result/result-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { hz } from "@/lib/hz"
import { useT, useUiLang } from "@/lib/i18n"
import { useApp } from "@/lib/store"

function relTime(at: number, ui: "fa" | "en") {
  const rtf = new Intl.RelativeTimeFormat(ui === "fa" ? "fa-IR" : "en", {
    numeric: "auto",
  })
  const diff = (at - Date.now()) / 1000
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(Math.round(diff), "second")
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute")
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour")
  return rtf.format(Math.round(diff / 86400), "day")
}

export function HistoryView() {
  const t = useT()
  const ui = useUiLang()
  const setPending = useApp((s) => s.setPending)
  const setRoute = useApp((s) => s.setRoute)
  const [items, setItems] = useState<HistoryItem[]>([])
  const [q, setQ] = useState("")

  useEffect(() => {
    void hz.history.get().then(setItems)
  }, [])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s
      ? items.filter(
          (i) =>
            i.source.toLowerCase().includes(s) ||
            i.result.toLowerCase().includes(s)
        )
      : items
  }, [items, q])

  return (
    <GlassPanel className="flex h-full flex-col overflow-hidden">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-5">
        <h2 className="font-semibold">{t("historyTitle")}</h2>
        <InputGroup className="max-w-72">
          <InputGroupInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("historySearch")}
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          disabled={!items.length}
          onClick={() => {
            void hz.history.remove()
            setItems([])
          }}
        >
          <Trash2Icon data-icon="inline-start" />
          {t("clearHistory")}
        </Button>
      </div>
      {filtered.length === 0 ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon />
            </EmptyMedia>
            <EmptyTitle>{t("historyEmpty")}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-2 p-3">
            {filtered.map((it, i) => (
              <motion.div
                key={it.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.015 }}
                className="group glass-flat grid cursor-pointer grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-start gap-4 rounded-2xl px-4 py-3 transition hover:bg-accent"
                onClick={() => {
                  if (it.hasImage) return
                  setPending({ text: it.source, origin: "manual" })
                  setRoute("translate")
                }}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {it.hasImage && <ImageIcon className="size-3" />}
                    <span>
                      {languageName(it.sourceLang, ui)} →{" "}
                      {languageName(it.targetLang, ui)}
                    </span>
                    <span>·</span>
                    <span>{relTime(it.at, ui)}</span>
                  </div>
                  <p className="reading line-clamp-3 text-sm" dir="auto">
                    {it.source}
                  </p>
                </div>
                <p
                  className="reading line-clamp-4 text-sm text-foreground/85"
                  dir="auto"
                >
                  {it.result}
                </p>
                <div
                  className="flex flex-col items-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Badge variant="secondary">{it.engineName}</Badge>
                  <div className="flex opacity-0 transition group-hover:opacity-100">
                    <CopyAction text={it.result} />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("delete")}
                      onClick={() => {
                        void hz.history.remove(it.id)
                        setItems((list) => list.filter((x) => x.id !== it.id))
                      }}
                    >
                      <XIcon />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      )}
    </GlassPanel>
  )
}
