import {
  ChevronDownIcon,
  ExternalLinkIcon,
  GiftIcon,
  RefreshCwIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"
import { useState } from "react"
import { API_PRESETS } from "@shared/defaults"
import {
  PROVIDER_INFO,
  PROVIDERS_CHECKED,
  type ProviderTier,
} from "@shared/providers"
import type { EngineConfig, EngineUsage, RemoteUsage } from "@shared/types"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ItemDescription } from "@/components/ui/item"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { hz } from "@/lib/hz"
import { useT, useUiLang, type StringKey } from "@/lib/i18n"
import { useUsage } from "@/lib/use-usage"
import { cn } from "@/lib/utils"

export const TIER_LABEL: Record<ProviderTier, StringKey> = {
  free: "tierFree",
  limited: "tierLimited",
  iran: "tierIran",
  paid: "tierPaid",
  custom: "tierCustom",
}

/** What a provider gives, and how to get its key. */
export function ProviderGuide({
  presetId,
  keyUrl,
  open,
}: {
  presetId: string
  keyUrl?: string
  /** The steps start open (adding a key) or folded (editing one). */
  open: boolean
}) {
  const t = useT()
  const ui = useUiLang()
  const info = PROVIDER_INFO[presetId]
  if (!info) return null
  const lang = ui === "fa" ? "fa" : "en"
  return (
    <Alert className="glass-flat border-0">
      <AlertTitle className="flex flex-wrap items-center gap-2">
        <Badge variant={info.tier === "free" ? "default" : "secondary"}>
          {t(TIER_LABEL[info.tier])}
        </Badge>
        <span>{info.quota[lang]}</span>
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <ul className="flex list-disc flex-col gap-1 ps-4">
          {info.facts[lang].map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <Collapsible defaultOpen={open}>
          <CollapsibleTrigger
            render={<Button size="xs" variant="ghost" className="-ms-2" />}
          >
            {t("keyGuide")}
            <ChevronDownIcon data-icon="inline-end" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ol
              className={cn(
                "flex list-decimal flex-col gap-1 ps-4 pt-1",
                ui === "fa" && "[list-style-type:persian]"
              )}
            >
              {info.steps[lang].map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
        <div className="flex flex-wrap gap-2">
          {keyUrl && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => hz.app.openExternal(keyUrl)}
            >
              {t("getKey")}
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          )}
          {info.limitsUrl && (
            <Button
              size="xs"
              variant="outline"
              onClick={() => hz.app.openExternal(info.limitsUrl!)}
            >
              {t("providerLimits")}
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          )}
        </div>
        {info.tier !== "custom" && (
          <p className="text-xs">
            {t("quotaChecked").replace("{date}", PROVIDERS_CHECKED[lang])}
          </p>
        )}
      </AlertDescription>
    </Alert>
  )
}

function useNum() {
  const ui = useUiLang()
  return (v: number) => v.toLocaleString(ui === "fa" ? "fa-IR" : "en-US")
}

/**
 * The separator between figures. A middle dot next to Persian digits reads as the
 * Persian zero, so Persian takes its own comma.
 */
function useSep() {
  return useUiLang() === "fa" ? "، " : " · "
}

/** "12 requests · ≈8,400 tokens" for one day or month. */
function amounts(
  t: ReturnType<typeof useT>,
  num: (v: number) => string,
  requests: number,
  tokens: number,
  estimated: boolean,
  sep: string
) {
  return `${num(requests)} ${t("usageRequests")}${sep}${estimated ? "≈" : ""}${num(tokens)} ${t("usageTokens")}`
}

/** A line for the list of engines; nothing until the engine has been used today. */
export function UsageSummary({ engineId }: { engineId: string }) {
  const t = useT()
  const num = useNum()
  const sep = useSep()
  const u = useUsage()[engineId]
  if (!u?.requests) return null
  const left = u.reported?.requestsLeft
  return (
    <ItemDescription className="truncate tabular-nums">
      {t("usageToday")}:{" "}
      {amounts(t, num, u.requests, u.tokens, u.estimated, sep)}
      {left !== undefined && `${sep}${num(left)} ${t("usageLeft")}`}
    </ItemDescription>
  )
}

/** Usage of one API engine: the app's own count, and what the provider reports. */
export function UsagePanel({ engine }: { engine: EngineConfig }) {
  const t = useT()
  const num = useNum()
  const sep = useSep()
  const u: EngineUsage | undefined = useUsage()[engine.id]
  const openRouter = (engine.baseUrl ?? "").includes("openrouter.ai")
  const [remote, setRemote] = useState<RemoteUsage | null>(null)
  const [checking, setChecking] = useState(false)
  const check = async () => {
    setChecking(true)
    try {
      setRemote(
        await hz.usage.remote(engine.id, {
          baseUrl: engine.baseUrl,
          apiKey: engine.apiKey,
        })
      )
    } finally {
      setChecking(false)
    }
  }
  const r = u?.reported
  return (
    <div className="flex flex-col gap-2 text-sm">
      {u?.requests ? (
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
          <span className="text-muted-foreground">{t("usageToday")}</span>
          <span>{amounts(t, num, u.requests, u.tokens, u.estimated, sep)}</span>
          <span className="text-muted-foreground">{t("usageMonth")}</span>
          <span>
            {amounts(t, num, u.monthRequests, u.monthTokens, u.estimated, sep)}
          </span>
        </div>
      ) : (
        <p className="text-muted-foreground">{t("usageNone")}</p>
      )}
      {r?.requestsLeft !== undefined && r.requestsLimit ? (
        <Meter
          label={t("usageReportedRequests")}
          left={r.requestsLeft}
          limit={r.requestsLimit}
          num={num}
        />
      ) : null}
      {r?.tokensLeft !== undefined && r.tokensLimit ? (
        <Meter
          label={t("usageReportedTokens")}
          left={r.tokensLeft}
          limit={r.tokensLimit}
          num={num}
        />
      ) : null}
      {openRouter && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{t("usageRemote")}</span>
            <Button
              size="xs"
              variant="ghost"
              disabled={checking || !engine.apiKey}
              onClick={() => void check()}
            >
              {checking ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCwIcon data-icon="inline-start" />
              )}
              {t("usageCheck")}
            </Button>
          </div>
          {remote && (
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
              {remote.freeToday?.remaining !== undefined && (
                <>
                  <span className="text-muted-foreground">
                    {t("usageFreeToday")}
                  </span>
                  <span>
                    {num(remote.freeToday.used ?? 0)}
                    {remote.freeToday.limit !== undefined &&
                      ` / ${num(remote.freeToday.limit)}`}
                  </span>
                </>
              )}
              {remote.creditsUsed !== undefined && (
                <>
                  <span className="text-muted-foreground">
                    {t("usageCredits")}
                  </span>
                  <span dir="ltr" className="text-start">
                    ${remote.creditsUsed.toFixed(4)}
                  </span>
                </>
              )}
              {typeof remote.creditsLeft === "number" && (
                <>
                  <span className="text-muted-foreground">
                    {t("usageCreditsLeft")}
                  </span>
                  <span dir="ltr" className="text-start">
                    ${remote.creditsLeft.toFixed(2)}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t("usageCounted")}</p>
    </div>
  )
}

function Meter({
  label,
  left,
  limit,
  num,
}: {
  label: string
  left: number
  limit: number
  num: (v: number) => string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {num(left)} / {num(limit)}
        </span>
      </div>
      <Progress value={(left / limit) * 100} className="h-1.5" />
    </div>
  )
}

/** The free providers the announcement points to, most free quota first. */
const SHOWCASE = ["nvidia", "cerebras", "groq"]

/**
 * An announcement at the top of the engines list: strong models are free with a key,
 * which nobody would guess before opening "Add API key". Shown until the user has a
 * key from a free provider, or closes it.
 */
export function FreeModelsBanner({
  hasFreeKey,
  onAdd,
}: {
  hasFreeKey: boolean
  onAdd: (presetId: string) => void
}) {
  const t = useT()
  const ui = useUiLang()
  const lang = ui === "fa" ? "fa" : "en"
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem("hz-free-models-banner") === "closed"
    } catch {
      return false
    }
  })
  if (hasFreeKey || closed) return null
  const close = () => {
    setClosed(true)
    try {
      localStorage.setItem("hz-free-models-banner", "closed")
    } catch {
      // Closed for this session only.
    }
  }
  return (
    <div className="free-models-banner relative overflow-hidden rounded-2xl p-4">
      <Button
        size="icon-xs"
        variant="ghost"
        className="absolute end-2 top-2"
        aria-label={t("dismiss")}
        onClick={close}
      >
        <XIcon />
      </Button>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
          <GiftIcon />
        </div>
        <div className="flex min-w-0 flex-col gap-2 pe-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{t("freeModelsTitle")}</h3>
            <Badge>{t("tierFree")}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{t("freeModelsBody")}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {SHOWCASE.map((id) => (
              <Button
                key={id}
                size="sm"
                variant={id === SHOWCASE[0] ? "default" : "outline"}
                onClick={() => onAdd(id)}
                title={PROVIDER_INFO[id]?.quota[lang]}
              >
                {id === SHOWCASE[0] && (
                  <SparklesIcon data-icon="inline-start" />
                )}
                {API_PRESETS.find((p) => p.id === id)?.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
