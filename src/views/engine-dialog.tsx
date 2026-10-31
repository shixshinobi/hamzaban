import { ExternalLinkIcon, LanguagesIcon, RefreshCwIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { API_PRESETS, ENGINE_META } from "@shared/defaults"
import { PROVIDER_INFO, TIER_ORDER } from "@shared/providers"
import {
  bestGeminiModel,
  byTranslationFit,
  isGeminiApi,
  modelNote,
  translationFit,
  translationModels,
  type ModelNote,
} from "@shared/models"
import type { EngineConfig } from "@shared/types"
import {
  ProviderGuide,
  TIER_LABEL,
  UsagePanel,
} from "@/components/engines/provider-info"
import { Badge } from "@/components/ui/badge"
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
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { hz } from "@/lib/hz"
import { useT, useUiLang, type StringKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const NOTE_LABEL: Record<ModelNote, StringKey> = {
  best: "modelBest",
  recommended: "modelRecommended",
  fast: "modelFast",
}

export function newApiEngine(presetId = API_PRESETS[0].id): EngineConfig {
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
  // The list is grouped by how much it costs, most free quota first.
  const presetGroups = TIER_ORDER.map((tier) => ({
    tier,
    presets: API_PRESETS.filter(
      (p) => (PROVIDER_INFO[p.id]?.tier ?? "paid") === tier
    ),
  })).filter((g) => g.presets.length)
  const lang = ui === "fa" ? "fa" : "en"

  // Models fit for translation come first, under a heading of their own.
  const fitModels = models.filter((m) => translationFit(m))
  const modelGroups = [
    { key: "fit", models: fitModels },
    { key: "other", models: models.filter((m) => !translationFit(m)) },
  ].filter((g) => g.models.length)

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
      const sorted = isGeminiApi(draft.baseUrl) ? list : byTranslationFit(list)
      setModels(sorted)
      // A model that is not on this key's list moves to the best one for translation.
      const best = isGeminiApi(draft.baseUrl)
        ? bestGeminiModel(list)
        : (sorted.find((m) => translationFit(m) === "great") ?? null)
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
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
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
                  {presetGroups.map((g, i) => (
                    <SelectGroup key={g.tier}>
                      {i > 0 && <SelectSeparator />}
                      <SelectLabel>{t(TIER_LABEL[g.tier])}</SelectLabel>
                      {g.presets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex min-w-0 flex-col">
                            <span>{p.name}</span>
                            <span className="truncate text-xs text-muted-foreground">
                              {PROVIDER_INFO[p.id]?.quota[lang]}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {family === "api" && draft.preset && (
            <ProviderGuide
              key={draft.preset}
              presetId={draft.preset}
              keyUrl={preset?.keyUrl}
              open={!!isNew}
            />
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
                placeholder={t("baseUrlExample")}
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
                <PopoverContent className="w-[min(30rem,90vw)] p-0" align="end">
                  <Command>
                    <CommandInput placeholder={t("model")} />
                    <CommandList className="max-h-72">
                      <CommandEmpty>—</CommandEmpty>
                      {modelGroups.map((g) => (
                        <CommandGroup
                          key={g.key}
                          heading={
                            g.key === "fit" ? (
                              <span className="flex items-center gap-1 text-primary">
                                <LanguagesIcon className="size-3.5" />
                                {t("modelsForTranslation")}
                              </span>
                            ) : (
                              t("modelsOther")
                            )
                          }
                        >
                          {g.models.map((m) => {
                            const fit = translationFit(m)
                            return (
                              <CommandItem
                                key={m}
                                value={m}
                                data-checked={m === draft.model}
                                // Fit models stand out: tinted, in the foreground colour.
                                className={cn(
                                  fit && "bg-primary/[0.06] text-foreground",
                                  !fit && "text-muted-foreground"
                                )}
                                onSelect={() => {
                                  setDraft({ ...draft, model: m })
                                  setModelOpen(false)
                                }}
                              >
                                <span
                                  dir="ltr"
                                  className={cn(
                                    "truncate font-mono text-xs",
                                    fit && "font-semibold"
                                  )}
                                >
                                  {m}
                                </span>
                                {modelNote(m) ? (
                                  <span className="ms-auto shrink-0 text-xs text-muted-foreground">
                                    {t(NOTE_LABEL[modelNote(m)!])}
                                  </span>
                                ) : fit ? (
                                  <Badge
                                    variant={
                                      fit === "great" ? "default" : "secondary"
                                    }
                                    className="ms-auto shrink-0"
                                  >
                                    {t(
                                      fit === "great" ? "fitGreat" : "fitGood"
                                    )}
                                  </Badge>
                                ) : null}
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      ))}
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
          {family === "api" && !isNew && (
            <Field>
              <FieldLabel>{t("usageTitle")}</FieldLabel>
              <UsagePanel engine={draft} />
            </Field>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            // A gateway is unusable without the address it is reached at.
            disabled={family === "api" && !draft.baseUrl?.trim()}
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
