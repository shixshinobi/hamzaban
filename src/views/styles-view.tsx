import {
  CheckIcon,
  CopyPlusIcon,
  DownloadIcon,
  FeatherIcon,
  FileUpIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import type { StyleProfile } from "@shared/types"
import { GlassPanel } from "@/components/glass/glass-panel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { hz } from "@/lib/hz"
import { useT } from "@/lib/i18n"
import { useApp } from "@/lib/store"
import { cn } from "@/lib/utils"

function newId() {
  return `style-${Date.now().toString(36)}`
}

/** Parse a SKILL.md-style file: YAML-ish frontmatter (name, description) + markdown body. */
function parseSkill(content: string, fallbackName: string): StyleProfile {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(content)
  const meta: Record<string, string> = {}
  let body = content
  if (m) {
    body = m[2]
    for (const line of m[1].split("\n")) {
      const kv = /^(\w[\w-]*)\s*:\s*(.*)$/.exec(line)
      if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "")
    }
  }
  // An optional "## Glossary" section with "- source => target" lines becomes the glossary.
  const glossary: StyleProfile["glossary"] = []
  body = body.replace(
    /^##\s*(Glossary|واژه‌نامه)\s*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/im,
    (_all, _h, list: string) => {
      for (const line of list.split("\n")) {
        const g = /^\s*[-*]\s*(.+?)\s*(=>|→|:)\s*(.+)$/.exec(line)
        if (g) glossary.push({ source: g[1], target: g[3] })
      }
      return ""
    }
  )
  return {
    id: newId(),
    name: meta.name || fallbackName.replace(/\.md$/i, ""),
    description: meta.description || "",
    instructions: body.trim(),
    glossary,
    hue: Math.floor(Math.random() * 360),
  }
}

function toSkill(s: StyleProfile) {
  const gloss = s.glossary.length
    ? `\n\n## Glossary\n${s.glossary.map((g) => `- ${g.source} => ${g.target}`).join("\n")}\n`
    : "\n"
  return `---\nname: ${s.name}\ndescription: ${s.description}\n---\n\n${s.instructions.trim()}${gloss}`
}

export function StylesView() {
  const t = useT()
  const styles = useApp((s) => s.settings!.styles)
  const activeStyleId = useApp((s) => s.settings!.activeStyleId)
  const update = useApp((s) => s.update)
  const [selectedId, setSelectedId] = useState<string>(
    activeStyleId ?? styles[0]?.id
  )
  const selected = styles.find((s) => s.id === selectedId) ?? styles[0]
  const [draft, setDraft] = useState<StyleProfile | null>(selected ?? null)
  // Reset the draft whenever another style is selected or the stored one changes.
  const [draftSource, setDraftSource] = useState(selected)
  if (selected !== draftSource) {
    setDraftSource(selected)
    setDraft(selected ?? null)
  }

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(selected),
    [draft, selected]
  )
  const custom = styles.filter((s) => !s.builtin)

  const saveStyles = (list: StyleProfile[]) =>
    update({ styles: list.filter((s) => !s.builtin) })

  const create = (base?: Partial<StyleProfile>) => {
    const s: StyleProfile = {
      id: newId(),
      name: base?.name ?? t("newStyle"),
      description: base?.description ?? "",
      instructions: base?.instructions ?? "",
      glossary: base?.glossary ?? [],
      hue: base?.hue ?? Math.floor(Math.random() * 360),
    }
    void saveStyles([...custom, s]).then(() => setSelectedId(s.id))
  }

  const save = () => {
    if (!draft || draft.builtin) return
    void saveStyles(custom.map((s) => (s.id === draft.id ? draft : s))).then(
      () => toast.success(t("saved"))
    )
  }

  const remove = () => {
    if (!draft || draft.builtin) return
    void saveStyles(custom.filter((s) => s.id !== draft.id))
    if (activeStyleId === draft.id) void update({ activeStyleId: null })
    setSelectedId(styles[0].id)
  }

  const importSkill = async () => {
    const f = await hz.file.readText([
      { name: "Skill", extensions: ["md", "markdown", "txt"] },
    ])
    if (!f) return
    const s = parseSkill(f.content, f.name)
    await saveStyles([...custom, s])
    setSelectedId(s.id)
  }

  const readOnly = !!draft?.builtin

  return (
    <div className="grid h-full grid-cols-[18rem_minmax(0,1fr)] gap-3">
      <GlassPanel className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex flex-col gap-1 px-4 pt-4 pb-3">
          <h2 className="text-base font-semibold">{t("stylesTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("stylesHint")}</p>
          <div className="mt-2 flex gap-1.5">
            <Button size="sm" onClick={() => create()} className="flex-1">
              <PlusIcon data-icon="inline-start" />
              {t("newStyle")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void importSkill()}
              title={t("importSkill")}
            >
              <FileUpIcon data-icon="inline-start" />
              .md
            </Button>
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <ItemGroup className="gap-1 px-2 pb-2">
            {styles.map((s) => (
              <Item
                key={s.id}
                size="sm"
                variant={s.id === selected?.id ? "muted" : "default"}
                render={
                  <button type="button" onClick={() => setSelectedId(s.id)} />
                }
                className="cursor-pointer text-start"
              >
                <ItemMedia>
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      background: `oklch(0.68 0.15 ${s.hue})`,
                      boxShadow: `0 0 10px oklch(0.68 0.15 ${s.hue} / 0.6)`,
                    }}
                  />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="w-full">
                    <span className="truncate">{s.name}</span>
                    {s.id === activeStyleId && (
                      <CheckIcon className="ms-auto size-3.5 text-primary" />
                    )}
                  </ItemTitle>
                  <ItemDescription className="line-clamp-1">
                    {s.description}
                  </ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </ScrollArea>
      </GlassPanel>

      {draft && (
        <GlassPanel className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex h-14 shrink-0 items-center gap-2 border-b px-5">
            <FeatherIcon
              className="size-4"
              style={{ color: `oklch(0.65 0.15 ${draft.hue})` }}
            />
            <span className="truncate font-medium">{draft.name}</span>
            {readOnly && <Badge variant="secondary">{t("builtin")}</Badge>}
            <div className="flex-1" />
            {draft.id !== activeStyleId ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void update({ activeStyleId: draft.id })}
              >
                <CheckIcon data-icon="inline-start" />
                {t("useStyle")}
              </Button>
            ) : (
              <Badge>{t("active")}</Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => create({ ...draft, name: `${draft.name} 2` })}
            >
              <CopyPlusIcon data-icon="inline-start" />
              {t("duplicate")}
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("exportSkill")}
              onClick={() =>
                void hz.file.save({
                  name: `${draft.name}.md`,
                  content: toSkill(draft),
                  filters: [{ name: "Markdown", extensions: ["md"] }],
                })
              }
            >
              <DownloadIcon />
            </Button>
            {!readOnly && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t("delete")}
                onClick={remove}
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <FieldGroup className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="st-name">{t("name")}</FieldLabel>
                  <Input
                    id="st-name"
                    value={draft.name}
                    disabled={readOnly}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="st-desc">{t("description")}</FieldLabel>
                  <Input
                    id="st-desc"
                    value={draft.description}
                    disabled={readOnly}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="st-ins">{t("instructions")}</FieldLabel>
                <Textarea
                  id="st-ins"
                  dir="auto"
                  value={draft.instructions}
                  disabled={readOnly}
                  onChange={(e) =>
                    setDraft({ ...draft, instructions: e.target.value })
                  }
                  className="reading min-h-48 text-[14px]"
                />
                <FieldDescription>{t("instructionsHint")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel>{t("glossary")}</FieldLabel>
                <FieldDescription>{t("glossaryHint")}</FieldDescription>
                <div className="flex flex-col gap-1.5">
                  {draft.glossary.map((g, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[1fr_1fr_auto] gap-1.5"
                    >
                      <Input
                        dir="auto"
                        placeholder={t("sourceTerm")}
                        value={g.source}
                        disabled={readOnly}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            glossary: draft.glossary.map((x, j) =>
                              j === i ? { ...x, source: e.target.value } : x
                            ),
                          })
                        }
                      />
                      <Input
                        dir="auto"
                        placeholder={t("targetTerm")}
                        value={g.target}
                        disabled={readOnly}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            glossary: draft.glossary.map((x, j) =>
                              j === i ? { ...x, target: e.target.value } : x
                            ),
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={readOnly}
                        aria-label={t("delete")}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            glossary: draft.glossary.filter((_, j) => j !== i),
                          })
                        }
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ))}
                  {!readOnly && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          glossary: [
                            ...draft.glossary,
                            { source: "", target: "" },
                          ],
                        })
                      }
                    >
                      <PlusIcon data-icon="inline-start" />
                      {t("addTerm")}
                    </Button>
                  )}
                </div>
              </Field>
              {!readOnly && (
                <Field>
                  <FieldLabel>{t("color")}</FieldLabel>
                  <div className="flex items-center gap-3">
                    <span
                      className="size-5 shrink-0 rounded-full ring-1 ring-border"
                      style={{ background: `oklch(0.68 0.15 ${draft.hue})` }}
                    />
                    <Slider
                      value={[draft.hue]}
                      min={0}
                      max={359}
                      onValueChange={(v) =>
                        setDraft({
                          ...draft,
                          hue: Array.isArray(v) ? v[0] : (v as number),
                        })
                      }
                    />
                  </div>
                </Field>
              )}
            </FieldGroup>
          </ScrollArea>
          {!readOnly && (
            <div
              className={cn(
                "flex shrink-0 justify-end gap-2 border-t px-5 py-3 transition-opacity",
                !dirty && "opacity-60"
              )}
            >
              <Button
                variant="ghost"
                size="sm"
                disabled={!dirty}
                onClick={() => setDraft(selected ?? null)}
              >
                {t("cancel")}
              </Button>
              <Button size="sm" disabled={!dirty} onClick={save}>
                {t("save")}
              </Button>
            </div>
          )}
        </GlassPanel>
      )}
    </div>
  )
}
