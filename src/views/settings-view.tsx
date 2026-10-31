import {
  BugIcon,
  DownloadIcon,
  GlobeIcon,
  InfoIcon,
  LogInIcon,
  LogOutIcon,
  MailIcon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SendIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react"
import { useRef, useState } from "react"
import {
  APPEARANCE_DEFAULTS,
  DEFAULT_SHORTCUTS,
  ENGINE_META,
} from "@shared/defaults"
import { APP_VERSION, FEEDBACK } from "@shared/links"
import type {
  AccentColor,
  Backdrop,
  EngineConfig,
  EngineFamily,
  Settings,
  ShortcutAction,
  ThemePref,
  WindowMaterial,
} from "@shared/types"
import { GlassPanel } from "@/components/glass/glass-panel"
import { Logo } from "@/components/logo"
import { EngineGlyph, LanguagePicker, StatusDot } from "@/components/pickers"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { hz } from "@/lib/hz"
import { useT, useUiLang, type StringKey } from "@/lib/i18n"
import { useApp } from "@/lib/store"
import { applyAppearance } from "@/lib/theme"
import { cn } from "@/lib/utils"
import { useOriginalLook } from "@/prototype/look"
import {
  FreeModelsBanner,
  UsageSummary,
} from "@/components/engines/provider-info"
import { PROVIDER_INFO } from "@shared/providers"
import { EngineDialog, newApiEngine } from "./engine-dialog"
import { ShortcutRecorder } from "./shortcut-recorder"

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(v) => v[0] && onChange(v[0] as T)}
      variant="outline"
      size="sm"
      spacing={0}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

const ACCENTS: { id: AccentColor; key: StringKey; hue: number }[] = [
  { id: "blue", key: "accentBlue", hue: 262 },
  { id: "violet", key: "accentViolet", hue: 295 },
  { id: "pink", key: "accentPink", hue: 350 },
  { id: "red", key: "accentRed", hue: 22 },
  { id: "orange", key: "accentOrange", hue: 50 },
  { id: "green", key: "accentGreen", hue: 150 },
  { id: "teal", key: "accentTeal", hue: 192 },
  { id: "graphite", key: "accentGraphite", hue: 265 },
]
const swatch = (a: AccentColor) => {
  const hue = ACCENTS.find((x) => x.id === a)!.hue
  return `oklch(0.62 ${a === "graphite" ? 0.02 : 0.17} ${hue})`
}

const BACKDROPS: { id: Backdrop; key: StringKey }[] = [
  { id: "aurora", key: "backdropAurora" },
  { id: "orbs", key: "backdropOrbs" },
  { id: "gradient", key: "backdropGradient" },
  { id: "grid", key: "backdropGrid" },
  { id: "plain", key: "backdropPlain" },
]

/** Ready-made combinations of backdrop, color and glass. */
const THEMES: {
  id: string
  key: StringKey
  look: Pick<Settings, "backdrop" | "accent" | "transparency" | "blur">
}[] = [
  {
    id: "liquid",
    key: "themeLiquid",
    look: { backdrop: "aurora", accent: "blue", transparency: 50, blur: 22 },
  },
  {
    id: "pure",
    key: "themePure",
    look: { backdrop: "plain", accent: "blue", transparency: 72, blur: 22 },
  },
  {
    id: "orbs",
    key: "themeOrbs",
    look: { backdrop: "orbs", accent: "violet", transparency: 62, blur: 28 },
  },
  {
    id: "sunset",
    key: "themeSunset",
    look: {
      backdrop: "gradient",
      accent: "orange",
      transparency: 55,
      blur: 24,
    },
  },
  {
    id: "blossom",
    key: "themeBlossom",
    look: { backdrop: "orbs", accent: "pink", transparency: 56, blur: 34 },
  },
  {
    id: "grid",
    key: "themeGrid",
    look: { backdrop: "grid", accent: "teal", transparency: 64, blur: 10 },
  },
  {
    id: "minimal",
    key: "themeMinimal",
    look: { backdrop: "plain", accent: "graphite", transparency: 20, blur: 16 },
  },
]

/** A small picture of a backdrop in a given color, for the theme and backdrop pickers. */
function previewBackground(backdrop: Backdrop, accent: AccentColor) {
  const h = ACCENTS.find((x) => x.id === accent)!.hue
  const c = accent === "graphite" ? 0.02 : 0.16
  const col = (l: number, dh: number, a: number) =>
    `oklch(${l} ${c} ${h + dh} / ${a})`
  switch (backdrop) {
    case "aurora":
      return `radial-gradient(60% 70% at 20% 25%, ${col(0.78, 0, 0.8)}, transparent 70%), radial-gradient(55% 60% at 85% 35%, ${col(0.82, -65, 0.6)}, transparent 70%), radial-gradient(60% 60% at 60% 95%, ${col(0.8, 58, 0.5)}, transparent 70%)`
    case "orbs":
      return `radial-gradient(circle at 25% 30%, ${col(0.72, 0, 0.85)} 0 14px, transparent 15px), radial-gradient(circle at 75% 70%, ${col(0.7, -50, 0.8)} 0 18px, transparent 19px), radial-gradient(circle at 80% 22%, ${col(0.78, 55, 0.75)} 0 8px, transparent 9px)`
    case "gradient":
      return `linear-gradient(135deg, ${col(0.78, -40, 0.75)}, ${col(0.74, 0, 0.7)} 45%, ${col(0.8, 50, 0.65)})`
    case "grid":
      return `radial-gradient(circle, oklch(0.5 0 0 / 0.35) 1px, transparent 1.4px) 0 0 / 7px 7px, radial-gradient(70% 80% at 85% 10%, ${col(0.8, 0, 0.6)}, transparent 70%)`
    case "plain":
      return "var(--muted)"
  }
}

/**
 * A slider that previews while dragging and saves on release, with a tick at the
 * default value. The track stays left-to-right in both languages, like a gauge.
 */
function TuningSlider({
  value,
  fallback,
  min,
  max,
  label,
  unit,
  onPreview,
  onCommit,
}: {
  value: number
  fallback: number
  min: number
  max: number
  label: string
  unit?: string
  onPreview: (v: number) => void
  onCommit: (v: number) => void
}) {
  const ui = useUiLang()
  const [draft, setDraft] = useState<number | null>(null)
  const shown = draft ?? value
  const pct = (fallback - min) / (max - min)
  // A detent for the pointer: within 2% of the range (one step on short ranges) the
  // thumb holds on the default. Arrow keys move one step at a time with no pull, so the
  // values right beside the default stay reachable.
  const zone = Math.max(1, Math.round((max - min) * 0.02))
  const last = useRef(value)
  const pick = (v: number | readonly number[], reason?: string) => {
    const n = Array.isArray(v) ? v[0] : (v as number)
    last.current =
      reason !== "keyboard" && Math.abs(n - fallback) <= zone ? fallback : n
    return last.current
  }
  const atDefault = shown === fallback
  return (
    <div className="flex w-56 items-center gap-3">
      <div className="relative flex-1" dir="ltr">
        {/* The thumb stays inside the track, so its centre runs from 6px to 100% - 6px. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors",
            atDefault ? "bg-primary" : "bg-muted-foreground/50"
          )}
          style={{ left: `calc(6px + (100% - 12px) * ${pct})` }}
        />
        <Slider
          value={[shown]}
          min={min}
          max={max}
          aria-label={label}
          onValueChange={(v, e) => {
            const n = pick(v, e.reason)
            setDraft(n)
            onPreview(n)
          }}
          onValueCommitted={() => {
            setDraft(null)
            onCommit(last.current)
          }}
        />
      </div>
      <span className="w-12 shrink-0 text-end text-xs text-muted-foreground tabular-nums">
        {shown.toLocaleString(ui === "fa" ? "fa-IR" : "en-US")}
        {unit === "%" && ui === "fa" ? "٪" : unit}
      </span>
    </div>
  )
}

function GeneralSettings() {
  const t = useT()
  const original = useOriginalLook()
  const s = useApp((st) => st.settings!)
  const os = useApp((st) => st.platform?.os)
  const update = useApp((st) => st.update)
  return (
    <FieldGroup>
      <FieldSet>
        <FieldLegend>{t("settingsGeneral")}</FieldLegend>
        <Field orientation="horizontal">
          <FieldLabel>{t("uiLanguage")}</FieldLabel>
          <Segmented
            value={s.uiLanguage}
            onChange={(uiLanguage) => void update({ uiLanguage })}
            options={[
              { value: "fa", label: "فارسی" },
              { value: "en", label: "English" },
            ]}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldLabel>{t("theme")}</FieldLabel>
          <Segmented<ThemePref>
            value={s.theme}
            onChange={(theme) => void update({ theme })}
            options={[
              { value: "system", label: t("themeSystem") },
              { value: "light", label: t("themeLight") },
              { value: "dark", label: t("themeDark") },
            ]}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel>{t("material")}</FieldLabel>
            <FieldDescription>{t("materialHint")}</FieldDescription>
          </FieldContent>
          <Segmented<WindowMaterial>
            value={s.material}
            onChange={(material) => void update({ material })}
            options={[
              { value: "auto", label: t("materialAuto") },
              ...(os === "win32"
                ? [
                    { value: "acrylic" as const, label: t("materialAcrylic") },
                    { value: "mica" as const, label: t("materialMica") },
                  ]
                : []),
              { value: "clear", label: t("materialClear") },
              ...(os === "win32"
                ? [{ value: "live" as const, label: t("materialLive") }]
                : []),
              { value: "none", label: t("materialNone") },
            ]}
          />
        </Field>
        {s.material === "live" && (
          <Alert>
            <InfoIcon />
            <AlertDescription>{t("materialLiveNote")}</AlertDescription>
          </Alert>
        )}
      </FieldSet>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>{t("appearance")}</FieldLegend>
        <Field>
          <FieldLabel>{t("themes")}</FieldLabel>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((th) => {
              const active = (
                Object.keys(th.look) as (keyof typeof th.look)[]
              ).every((k) => s[k] === th.look[k])
              return (
                <button
                  key={th.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => void update(th.look)}
                  className={cn(
                    original
                      ? "group flex flex-col gap-1.5 rounded-xl p-1.5 text-start text-xs transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      : "group flex flex-col gap-1.5 rounded-xl p-1.5 text-start text-xs transition-[background-color,box-shadow,scale] duration-150 ease-(--ease-out) outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]",
                    active
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "ring-1 ring-border hover:bg-accent"
                  )}
                >
                  <span
                    className="relative flex h-14 items-end overflow-hidden rounded-lg p-1.5"
                    style={{
                      background: previewBackground(
                        th.look.backdrop,
                        th.look.accent
                      ),
                    }}
                  >
                    <span
                      className="h-6 w-3/4 rounded-md ring-1 ring-white/50"
                      style={{
                        background: `oklch(1 0 0 / ${(0.65 - th.look.transparency / 220).toFixed(2)})`,
                        backdropFilter: `blur(${Math.round(th.look.blur / 4)}px)`,
                      }}
                    />
                    <span
                      className="absolute end-1.5 top-1.5 size-2.5 rounded-full"
                      style={{ background: swatch(th.look.accent) }}
                    />
                  </span>
                  <span className="px-0.5 font-medium">{t(th.key)}</span>
                </button>
              )
            })}
          </div>
        </Field>
        <Field orientation="horizontal">
          <FieldLabel>{t("backdrop")}</FieldLabel>
          <ToggleGroup
            value={[s.backdrop]}
            onValueChange={(v) =>
              v[0] && void update({ backdrop: v[0] as Backdrop })
            }
            size="sm"
            spacing={1}
          >
            {BACKDROPS.map((b) => (
              <ToggleGroupItem
                key={b.id}
                value={b.id}
                aria-label={t(b.key)}
                title={t(b.key)}
                className="h-8 w-10 rounded-lg p-0.5"
              >
                <span
                  className="size-full rounded-md ring-1 ring-border"
                  style={{ background: previewBackground(b.id, s.accent) }}
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <Field orientation="horizontal">
          <FieldLabel>{t("accent")}</FieldLabel>
          <ToggleGroup
            value={[s.accent]}
            onValueChange={(v) =>
              v[0] && void update({ accent: v[0] as AccentColor })
            }
            size="sm"
            spacing={1}
          >
            {ACCENTS.map((a) => (
              <ToggleGroupItem
                key={a.id}
                value={a.id}
                aria-label={t(a.key)}
                title={t(a.key)}
                className="size-7 rounded-full p-0"
              >
                <span
                  className="size-4 rounded-full ring-1 ring-border"
                  style={{ background: swatch(a.id) }}
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel>{t("transparency")}</FieldLabel>
            <FieldDescription>{t("transparencyHint")}</FieldDescription>
          </FieldContent>
          <TuningSlider
            label={t("transparency")}
            value={s.transparency}
            fallback={APPEARANCE_DEFAULTS.transparency}
            min={0}
            max={100}
            unit="%"
            onPreview={(transparency) => applyAppearance({ transparency })}
            onCommit={(transparency) => void update({ transparency })}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel>{t("blur")}</FieldLabel>
            <FieldDescription>{t("blurHint")}</FieldDescription>
          </FieldContent>
          <TuningSlider
            label={t("blur")}
            value={s.blur}
            fallback={APPEARANCE_DEFAULTS.blur}
            min={0}
            max={40}
            onPreview={(blur) => applyAppearance({ blur })}
            onCommit={(blur) => void update({ blur })}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel>{t("appearanceReset")}</FieldLabel>
            <FieldDescription>{t("appearanceResetHint")}</FieldDescription>
          </FieldContent>
          <Button
            size="sm"
            variant="outline"
            disabled={(
              Object.keys(
                APPEARANCE_DEFAULTS
              ) as (keyof typeof APPEARANCE_DEFAULTS)[]
            ).every((k) => s[k] === APPEARANCE_DEFAULTS[k])}
            onClick={() => void update({ ...APPEARANCE_DEFAULTS })}
          >
            <RotateCcwIcon data-icon="inline-start" />
            {t("reset")}
          </Button>
        </Field>
      </FieldSet>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>{t("defaultLanguages")}</FieldLegend>
        <Field orientation="horizontal">
          <FieldLabel>
            {t("from")} / {t("to")}
          </FieldLabel>
          <div className="flex items-center gap-1">
            <LanguagePicker
              value={s.sourceLang}
              onChange={(sourceLang) => void update({ sourceLang })}
              allowAuto
              size="default"
            />
            <span className="text-muted-foreground">→</span>
            <LanguagePicker
              value={s.targetLang}
              onChange={(targetLang) => void update({ targetLang })}
              size="default"
            />
          </div>
        </Field>
        <Field orientation="horizontal">
          <FieldLabel>{t("secondaryLang")}</FieldLabel>
          <LanguagePicker
            value={s.secondaryLang}
            onChange={(secondaryLang) => void update({ secondaryLang })}
            size="default"
          />
        </Field>
        <Field orientation="horizontal">
          <FieldLabel>{t("imageMode")}</FieldLabel>
          <Segmented
            value={s.imageMode}
            onChange={(imageMode) => void update({ imageMode })}
            options={[
              { value: "vision", label: t("imageModeVision") },
              { value: "ocr", label: t("imageModeOcr") },
            ]}
          />
        </Field>
      </FieldSet>
      <FieldSeparator />
      <FieldSet>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="sw-login">{t("launchAtLogin")}</FieldLabel>
          <Switch
            id="sw-login"
            checked={s.launchAtLogin}
            onCheckedChange={(launchAtLogin) => void update({ launchAtLogin })}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="sw-hide">{t("popupAutoHide")}</FieldLabel>
          <Switch
            id="sw-hide"
            checked={s.popupAutoHide}
            onCheckedChange={(popupAutoHide) => void update({ popupAutoHide })}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="sw-hist">{t("keepHistory")}</FieldLabel>
          <Switch
            id="sw-hist"
            checked={s.keepHistory}
            onCheckedChange={(keepHistory) => void update({ keepHistory })}
          />
        </Field>
      </FieldSet>
    </FieldGroup>
  )
}

function statusLabel(
  t: (k: StringKey) => string,
  e: EngineConfig,
  detail?: string,
  ok?: boolean
) {
  if (ok === undefined) return t("statusChecking")
  if (ok)
    return (
      e.model || (detail && !detail.includes(":") ? detail : t("statusReady"))
    )
  if (detail === "signed-out") return t("statusSignedOut")
  if (detail?.startsWith("not-installed")) return t("statusMissing")
  if (detail === "no-key") return t("statusNoKey")
  return t("statusOffline")
}

function EngineSettings() {
  const t = useT()
  const ui = useUiLang()
  const engines = useApp((s) => s.settings!.engines)
  const statuses = useApp((s) => s.statuses)
  const update = useApp((s) => s.update)
  const refreshStatus = useApp((s) => s.refreshStatus)
  const [editing, setEditing] = useState<{
    engine: EngineConfig
    isNew: boolean
  } | null>(null)
  const [checking, setChecking] = useState(false)
  const [signingOut, setSigningOut] = useState<string | null>(null)
  const familyLabel: Record<EngineFamily, string> = {
    free: t("familyFree"),
    web: t("familyWeb"),
    cli: t("familyCli"),
    local: t("familyLocal"),
    api: t("familyApi"),
  }

  const save = async (e: EngineConfig) => {
    const exists = engines.some((x) => x.id === e.id)
    await update({
      engines: exists
        ? engines.map((x) => (x.id === e.id ? e : x))
        : [...engines, e],
    })
    void refreshStatus(e.id)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <p className="flex-1 text-sm text-muted-foreground">
          {t("enginesHint")}
        </p>
        <Button
          size="sm"
          variant="ghost"
          disabled={checking}
          aria-label={t("statusChecking")}
          onClick={() => {
            setChecking(true)
            void refreshStatus().finally(() => setChecking(false))
          }}
        >
          <RefreshCwIcon
            data-icon="inline-start"
            className={cn(checking && "animate-spin")}
          />
        </Button>
        <Button
          size="sm"
          onClick={() => setEditing({ engine: newApiEngine(), isNew: true })}
        >
          <PlusIcon data-icon="inline-start" />
          {t("addApiEngine")}
        </Button>
      </div>
      <FreeModelsBanner
        hasFreeKey={engines.some(
          (e) => e.preset && PROVIDER_INFO[e.preset]?.tier === "free"
        )}
        onAdd={(id) => setEditing({ engine: newApiEngine(id), isNew: true })}
      />
      <ItemGroup className="gap-2">
        {engines.map((e) => {
          const meta = ENGINE_META[e.kind]
          const st = statuses[e.id]
          return (
            <Item key={e.id} variant="outline" className="glass-flat border-0">
              <ItemMedia variant="icon">
                <EngineGlyph engine={e} />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {e.name}
                  <Badge variant="secondary">{familyLabel[meta.family]}</Badge>
                </ItemTitle>
                <ItemDescription className="flex items-center gap-1.5">
                  {e.enabled && <StatusDot status={st} />}
                  <span dir="auto" className="truncate">
                    {e.enabled
                      ? statusLabel(t, e, st?.detail, st?.ok)
                      : ui === "fa"
                        ? meta.labelFa
                        : meta.label}
                  </span>
                </ItemDescription>
                {meta.family === "api" && <UsageSummary engineId={e.id} />}
              </ItemContent>
              <ItemActions>
                {meta.family === "web" && e.enabled && (
                  <>
                    {st?.ok ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={signingOut === e.id}
                        onClick={() => {
                          setSigningOut(e.id)
                          void hz.engines
                            .logout(e.id)
                            .then(() => refreshStatus(e.id))
                            .finally(() => setSigningOut(null))
                        }}
                      >
                        {signingOut === e.id ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <LogOutIcon data-icon="inline-start" />
                        )}
                        {t("signOut")}
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant={st?.ok ? "ghost" : "default"}
                      onClick={() => void hz.engines.login(e.id)}
                      title={t("webLoginNote")}
                    >
                      <LogInIcon data-icon="inline-start" />
                      {t("signIn")}
                    </Button>
                  </>
                )}
                {meta.family === "cli" && e.enabled && st && !st.ok && (
                  <Button
                    size="sm"
                    onClick={() => void hz.engines.install(e.id)}
                  >
                    <DownloadIcon data-icon="inline-start" />
                    {t("install")}
                  </Button>
                )}
                {meta.family === "cli" && e.enabled && st?.ok && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void hz.engines.login(e.id)}
                  >
                    <LogInIcon data-icon="inline-start" />
                    {t("signIn")}
                  </Button>
                )}
                {meta.family !== "free" && meta.family !== "web" && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("configure")}
                    onClick={() => setEditing({ engine: e, isNew: false })}
                  >
                    <SlidersHorizontalIcon />
                  </Button>
                )}
                {meta.family === "api" && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("delete")}
                    onClick={() =>
                      void update({
                        engines: engines.filter((x) => x.id !== e.id),
                      })
                    }
                  >
                    <Trash2Icon />
                  </Button>
                )}
                <Switch
                  checked={e.enabled}
                  disabled={e.id === "google"}
                  onCheckedChange={(enabled) => {
                    void update({
                      engines: engines.map((x) =>
                        x.id === e.id ? { ...x, enabled } : x
                      ),
                    }).then(() => {
                      if (enabled) void refreshStatus(e.id)
                    })
                  }}
                />
              </ItemActions>
            </Item>
          )
        })}
      </ItemGroup>
      {editing && (
        <EngineDialog
          key={editing.engine.id}
          engine={editing.engine}
          isNew={editing.isNew}
          open
          onOpenChange={(v) => !v && setEditing(null)}
          onSave={(e) => void save(e)}
        />
      )}
    </div>
  )
}

const SHORTCUT_LABELS: Record<ShortcutAction, StringKey> = {
  translateSelection: "scTranslateSelection",
  replaceSelection: "scReplaceSelection",
  captureScreen: "scCaptureScreen",
  translateClipboard: "scTranslateClipboard",
  showMain: "scShowMain",
}

function ShortcutSettings() {
  const t = useT()
  const shortcuts = useApp((s) => s.settings!.shortcuts)
  const os = useApp((s) => s.platform?.os)
  const update = useApp((s) => s.update)
  return (
    <FieldGroup>
      <FieldDescription>{t("shortcutsHint")}</FieldDescription>
      {(Object.keys(SHORTCUT_LABELS) as ShortcutAction[]).map((a) => (
        <Field key={a} orientation="horizontal">
          <FieldLabel>{t(SHORTCUT_LABELS[a])}</FieldLabel>
          <div className="flex items-center gap-1">
            <ShortcutRecorder
              value={shortcuts[a]}
              os={os}
              onChange={(accel) =>
                void update({ shortcuts: { ...shortcuts, [a]: accel } })
              }
            />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={t("reset")}
              disabled={shortcuts[a] === DEFAULT_SHORTCUTS[a]}
              onClick={() =>
                void update({
                  shortcuts: { ...shortcuts, [a]: DEFAULT_SHORTCUTS[a] },
                })
              }
            >
              <RotateCcwIcon />
            </Button>
          </div>
        </Field>
      ))}
    </FieldGroup>
  )
}

function About() {
  const t = useT()
  const os = useApp((s) => s.platform?.os ?? "")
  // Version and OS go into every report, so a bug can be reproduced without a back-and-forth.
  const info = `Hamzaban ${APP_VERSION} · ${os} · ${navigator.userAgent.match(/Electron\/[\d.]+/)?.[0] ?? ""}`
  const body = `${t("feedbackBody")}\n\n\n---\n${info}`
  const channels = [
    FEEDBACK.github && {
      label: t("feedbackGithub"),
      icon: BugIcon,
      url: `${FEEDBACK.github.replace(/\/+$/, "")}/issues/new?body=${encodeURIComponent(body)}`,
    },
    FEEDBACK.email && {
      label: t("feedbackEmail"),
      icon: MailIcon,
      url: `mailto:${FEEDBACK.email}?subject=${encodeURIComponent(t("feedbackSubject"))}&body=${encodeURIComponent(body)}`,
    },
    FEEDBACK.telegram && {
      label: t("feedbackTelegram"),
      icon: SendIcon,
      url: FEEDBACK.telegram,
    },
    FEEDBACK.website && {
      label: t("feedbackWebsite"),
      icon: GlobeIcon,
      url: FEEDBACK.website,
    },
  ].filter((c) => !!c)
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Logo className="size-16" />
      <div className="text-xl font-semibold">{t("appName")}</div>
      <div className="text-sm text-muted-foreground">{t("tagline")}</div>
      <Badge variant="secondary" dir="ltr">
        v{APP_VERSION}
      </Badge>
      <div className="text-sm text-muted-foreground">{t("madeFor")}</div>
      {channels.length > 0 && (
        <>
          <Separator className="my-3 max-w-48" />
          <div className="font-medium">{t("feedback")}</div>
          <p className="max-w-80 text-sm text-muted-foreground">
            {t("feedbackHint")}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {channels.map((c) => (
              <Button
                key={c.label}
                variant="outline"
                size="sm"
                onClick={() => hz.app.openExternal(c.url)}
              >
                <c.icon data-icon="inline-start" />
                {c.label}
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function SettingsView() {
  const t = useT()
  return (
    <GlassPanel className="h-full overflow-hidden">
      <Tabs defaultValue="general" className="flex h-full flex-col gap-0">
        <div className="flex h-14 shrink-0 items-center gap-4 border-b px-5">
          <h2 className="font-semibold">{t("navSettings")}</h2>
          <TabsList>
            <TabsTrigger value="general">{t("settingsGeneral")}</TabsTrigger>
            <TabsTrigger value="engines">{t("settingsEngines")}</TabsTrigger>
            <TabsTrigger value="shortcuts">
              {t("settingsShortcuts")}
            </TabsTrigger>
            <TabsTrigger value="about">{t("settingsAbout")}</TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="mx-auto max-w-3xl p-6">
            <TabsContent value="general">
              <GeneralSettings />
            </TabsContent>
            <TabsContent value="engines">
              <EngineSettings />
            </TabsContent>
            <TabsContent value="shortcuts">
              <ShortcutSettings />
            </TabsContent>
            <TabsContent value="about">
              <About />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </GlassPanel>
  )
}
