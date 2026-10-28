import {
  BugIcon,
  DownloadIcon,
  GlobeIcon,
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
import { useState } from "react"
import { DEFAULT_SHORTCUTS, ENGINE_META } from "@shared/defaults"
import { APP_VERSION, FEEDBACK } from "@shared/links"
import type {
  EngineConfig,
  EngineFamily,
  ShortcutAction,
  ThemePref,
  WindowMaterial,
} from "@shared/types"
import { GlassPanel } from "@/components/glass/glass-panel"
import { Logo } from "@/components/logo"
import { EngineGlyph, LanguagePicker, StatusDot } from "@/components/pickers"
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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { hz } from "@/lib/hz"
import { useT, useUiLang, type StringKey } from "@/lib/i18n"
import { useApp } from "@/lib/store"
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

function GeneralSettings() {
  const t = useT()
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
              { value: "none", label: t("materialNone") },
            ]}
          />
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
        <Button size="sm" variant="ghost" onClick={() => void refreshStatus()}>
          <RefreshCwIcon data-icon="inline-start" />
        </Button>
        <Button
          size="sm"
          onClick={() => setEditing({ engine: newApiEngine(), isNew: true })}
        >
          <PlusIcon data-icon="inline-start" />
          {t("addApiEngine")}
        </Button>
      </div>
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
              </ItemContent>
              <ItemActions>
                {meta.family === "web" && e.enabled && (
                  <>
                    {st?.ok ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void hz.engines
                            .logout(e.id)
                            .then(() => refreshStatus(e.id))
                        }
                      >
                        <LogOutIcon data-icon="inline-start" />
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
