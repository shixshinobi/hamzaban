import { useState } from "react"
import {
  ChevronDownIcon,
  CpuIcon,
  FeatherIcon,
  GlobeIcon,
  KeyRoundIcon,
  MessageCircleIcon,
  TerminalIcon,
  type LucideIcon,
} from "lucide-react"
import { ENGINE_META } from "@shared/defaults"
import { AUTO, LANGUAGES, languageName } from "@shared/languages"
import type { EngineConfig, EngineFamily, EngineStatus } from "@shared/types"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useT, useUiLang } from "@/lib/i18n"
import { useApp, useEnabledEngines } from "@/lib/store"
import { cn } from "@/lib/utils"

const RECENT_KEY = "hz-recent-langs"

function recentLangs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
  } catch {
    return []
  }
}

function pushRecent(code: string) {
  if (code === "auto") return
  const list = [code, ...recentLangs().filter((c) => c !== code)].slice(0, 4)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // storage unavailable
  }
}

export function LanguagePicker({
  value,
  onChange,
  allowAuto,
  detected,
  size = "sm",
  className,
}: {
  value: string
  onChange: (code: string) => void
  allowAuto?: boolean
  detected?: string | null
  size?: "sm" | "default"
  className?: string
}) {
  const t = useT()
  const ui = useUiLang()
  const [open, setOpen] = useState(false)
  const recent = recentLangs().filter((c) => c !== value)
  const label =
    value === "auto" && detected
      ? `${languageName(detected, ui)}`
      : languageName(value, ui)
  const pick = (code: string) => {
    pushRecent(code)
    onChange(code)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size={size}
            className={cn("gap-1.5 font-medium", className)}
          />
        }
      >
        {value === "auto" && (
          <span className="text-xs text-primary">{detected ? "✦" : ""}</span>
        )}
        <span className="truncate">
          {value === "auto" && !detected ? AUTO[ui] : label}
        </span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={t("searchLanguage")} />
          <CommandList className="max-h-80">
            <CommandEmpty>{t("noLanguage")}</CommandEmpty>
            {(allowAuto || recent.length > 0) && (
              <CommandGroup>
                {allowAuto && (
                  <CommandItem
                    value={`auto ${AUTO.en} ${AUTO.fa}`}
                    data-checked={value === "auto"}
                    onSelect={() => pick("auto")}
                  >
                    {AUTO[ui]}
                  </CommandItem>
                )}
                {recent.map((code) => (
                  <CommandItem
                    key={`r-${code}`}
                    value={`recent ${code} ${languageName(code, "en")} ${languageName(code, "fa")}`}
                    onSelect={() => pick(code)}
                  >
                    {languageName(code, ui)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {(allowAuto || recent.length > 0) && <CommandSeparator />}
            <CommandGroup>
              {LANGUAGES.map((l) => (
                <CommandItem
                  key={l.code}
                  value={`${l.code} ${l.en} ${l.fa}`}
                  data-checked={value === l.code}
                  onSelect={() => pick(l.code)}
                >
                  <span>{l[ui]}</span>
                  <span className="ms-auto text-xs text-muted-foreground">
                    {ui === "fa" ? l.en : l.fa}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export const FAMILY_ICON: Record<EngineFamily, LucideIcon> = {
  free: GlobeIcon,
  web: MessageCircleIcon,
  cli: TerminalIcon,
  local: CpuIcon,
  api: KeyRoundIcon,
}

export function StatusDot({
  status,
  className,
}: {
  status?: EngineStatus
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full",
        status === undefined
          ? "bg-muted-foreground/40"
          : status.ok
            ? "bg-success shadow-[0_0_8px_var(--success)]"
            : "bg-warning",
        className
      )}
    />
  )
}

export function EngineGlyph({
  engine,
  className,
}: {
  engine: EngineConfig
  className?: string
}) {
  const Icon = FAMILY_ICON[ENGINE_META[engine.kind].family]
  return <Icon className={className} />
}

export function EnginePicker({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  const t = useT()
  const ui = useUiLang()
  const engines = useEnabledEngines()
  const statuses = useApp((s) => s.statuses)
  const [open, setOpen] = useState(false)
  const current = engines.find((e) => e.id === value) ?? engines[0]
  const families: EngineFamily[] = ["free", "web", "cli", "local", "api"]
  const familyLabel: Record<EngineFamily, string> = {
    free: t("familyFree"),
    web: t("familyWeb"),
    cli: t("familyCli"),
    local: t("familyLocal"),
    api: t("familyApi"),
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-1.5", className)}
          />
        }
      >
        {current && <EngineGlyph engine={current} />}
        <span className="truncate font-medium">{current?.name}</span>
        <StatusDot status={current ? statuses[current.id] : undefined} />
        <ChevronDownIcon data-icon="inline-end" className="opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandList className="max-h-96">
            {families.map((f) => {
              const list = engines.filter(
                (e) => ENGINE_META[e.kind].family === f
              )
              if (!list.length) return null
              return (
                <CommandGroup key={f} heading={familyLabel[f]}>
                  {list.map((e) => (
                    <CommandItem
                      key={e.id}
                      value={`${e.id} ${e.name}`}
                      data-checked={e.id === value}
                      onSelect={() => {
                        onChange(e.id)
                        setOpen(false)
                      }}
                    >
                      <EngineGlyph engine={e} />
                      <span className="truncate">{e.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {e.model ||
                          (ui === "fa" ? ENGINE_META[e.kind].labelFa : "")}
                      </span>
                      <StatusDot status={statuses[e.id]} className="ms-auto" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function StylePicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
}) {
  const t = useT()
  const styles = useApp((s) => s.settings!.styles)
  const [open, setOpen] = useState(false)
  const current = styles.find((s) => s.id === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            disabled={disabled}
          />
        }
        title={disabled ? t("styleGoogleNote") : t("style")}
      >
        <FeatherIcon
          data-icon="inline-start"
          style={
            current ? { color: `oklch(0.65 0.15 ${current.hue})` } : undefined
          }
        />
        <span className="max-w-32 truncate">
          {current?.name ?? t("noStyle")}
        </span>
        <ChevronDownIcon data-icon="inline-end" className="opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandList className="max-h-96">
            <CommandGroup>
              <CommandItem
                value="none"
                data-checked={!value}
                onSelect={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                {t("noStyle")}
              </CommandItem>
              {styles.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.id} ${s.name} ${s.description}`}
                  data-checked={s.id === value}
                  onSelect={() => {
                    onChange(s.id)
                    setOpen(false)
                  }}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: `oklch(0.68 0.15 ${s.hue})` }}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{s.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {s.description}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
