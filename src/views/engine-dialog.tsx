import { ExternalLinkIcon, RefreshCwIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { API_PRESETS, ENGINE_META } from "@shared/defaults"
import {
  bestGeminiModel,
  isGeminiApi,
  modelNote,
  translationModels,
  type ModelNote,
} from "@shared/models"
import type { EngineConfig } from "@shared/types"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { hz } from "@/lib/hz"
import { useT, useUiLang, type StringKey } from "@/lib/i18n"

const NOTE_LABEL: Record<ModelNote, StringKey> = {
  best: "modelBest",
  recommended: "modelRecommended",
  fast: "modelFast",
}

export function newApiEngine(presetId = "openai"): EngineConfig {
  const p = API_PRESETS.find((x) => x.id === presetId) ?? API_PRESETS[0]
  return {
    id: `api-${Date.now().toString(36)}`,
    kind: p.kind,
    name: p.name,
    enabled: true,
    baseUrl: p.baseUrl,
    model: p.model,
    preset: p.id,
    apiKey: "",
  }
}

export function EngineDialog({
  engine,
  open,
  onOpenChange,
  onSave,
  isNew,
}: {
  engine: EngineConfig
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (e: EngineConfig) => void
  isNew?: boolean
}) {
  const t = useT()
  const ui = useUiLang()
  const [draft, setDraft] = useState(engine)
  const [models, setModels] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const family = ENGINE_META[draft.kind].family
  const preset = API_PRESETS.find((p) => p.id === draft.preset)
  const presetItems = API_PRESETS.map((p) => ({ label: p.name, value: p.id }))

  const fetchModels = async () => {
    setLoading(true)
    try {
      // Only models that can translate, best first (no image, speech or embedding models).
      const list = translationModels(
        await hz.engines.models(draft.id, {
          baseUrl: draft.baseUrl,
          apiKey: draft.apiKey,
          kind: draft.kind,
        }),
        draft.baseUrl
      )
      setModels(list)
      // For Gemini, move to the strongest text model this key can use.
      const best = isGeminiApi(draft.baseUrl) ? bestGeminiModel(list) : null
      if (best && !list.includes(draft.model ?? "")) {
        setDraft((d) => ({ ...d, model: best }))
        toast.success(`${t("modelPicked")} ${best}`)
      } else setModelOpen(true)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isNew ? t("addApiEngine") : `${t("editEngine")} · ${engine.name}`}
          </DialogTitle>
          <DialogDescription>
            {ui === "fa"
              ? ENGINE_META[draft.kind].labelFa
              : ENGINE_META[draft.kind].label}
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          {family === "api" && (
            <Field>
              <FieldLabel>{t("provider")}</FieldLabel>
              <Select
                items={presetItems}
                value={draft.preset ?? "custom"}
                onValueChange={(v) => {
                  const p = API_PRESETS.find((x) => x.id === v)
                  if (p)
                    setDraft({
                      ...draft,
                      preset: p.id,
                      kind: p.kind,
                      baseUrl: p.baseUrl,
                      model: p.model,
                      name:
                        isNew || draft.name === preset?.name
                          ? p.name
                          : draft.name,
                    })
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {presetItems.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
          {family === "api" && (
            <Field>
              <FieldLabel htmlFor="eng-name">{t("name")}</FieldLabel>
              <Input
                id="eng-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
          )}
          {(family === "api" || family === "local") && (
            <Field>
              <FieldLabel htmlFor="eng-url">{t("baseUrl")}</FieldLabel>
              <Input
                id="eng-url"
                dir="ltr"
                value={draft.baseUrl ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, baseUrl: e.target.value })
                }
              />
            </Field>
          )}
          {family === "api" && (
            <Field>
              <FieldLabel htmlFor="eng-key">{t("apiKey")}</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="eng-key"
                  dir="ltr"
                  type="password"
                  autoComplete="off"
                  value={draft.apiKey ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, apiKey: e.target.value })
                  }
                  placeholder="sk-…"
                />
                {preset?.keyUrl && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="xs"
                      onClick={() => hz.app.openExternal(preset.keyUrl!)}
                    >
                      {t("getKey")}
                      <ExternalLinkIcon data-icon="inline-end" />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>
            </Field>
          )}
          {family !== "web" && (
            <Field>
              <FieldLabel htmlFor="eng-model">{t("model")}</FieldLabel>
              <Popover
                open={modelOpen && models.length > 0}
                onOpenChange={setModelOpen}
              >
                <InputGroup>
                  <InputGroupInput
                    id="eng-model"
                    dir="ltr"
                    value={draft.model ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, model: e.target.value })
                    }
                    placeholder={family === "cli" ? "default" : ""}
                  />
                  {family !== "cli" && (
                    <InputGroupAddon align="inline-end">
                      <PopoverTrigger
                        render={
                          <InputGroupButton
                            size="xs"
                            onClick={(e) => (
                              e.preventDefault(),
                              void fetchModels()
                            )}
                            disabled={loading}
                          />
                        }
                      >
                        {loading ? <Spinner /> : <RefreshCwIcon />}
                        {t("fetchModels")}
                      </PopoverTrigger>
                    </InputGroupAddon>
                  )}
                </InputGroup>
                <PopoverContent className="w-80 p-0" align="end">
                  <Command>
                    <CommandInput placeholder={t("model")} />
                    <CommandList className="max-h-72">
                      <CommandEmpty>—</CommandEmpty>
                      <CommandGroup>
                        {models.map((m) => (
                          <CommandItem
                            key={m}
                            value={m}
                            data-checked={m === draft.model}
                            onSelect={() => {
                              setDraft({ ...draft, model: m })
                              setModelOpen(false)
                            }}
                          >
                            <span
                              dir="ltr"
                              className="truncate font-mono text-xs"
                            >
                              {m}
                            </span>
                            {modelNote(m) && (
                              <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                                {t(NOTE_LABEL[modelNote(m)!])}
                              </span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>
          )}
          {family === "cli" && (
            <Field>
              <FieldLabel htmlFor="eng-cmd">{t("executable")}</FieldLabel>
              <Input
                id="eng-cmd"
                dir="ltr"
                value={draft.command ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, command: e.target.value })
                }
              />
              <FieldDescription>{t("cliNote")}</FieldDescription>
            </Field>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            onClick={() => {
              onSave(draft)
              onOpenChange(false)
            }}
          >
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
