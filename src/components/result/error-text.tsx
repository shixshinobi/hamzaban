import type { ErrorCode } from "@shared/types"
import type { StringKey } from "@/lib/i18n"

const TITLE: Partial<Record<ErrorCode, StringKey>> = {
  "needs-login": "errNeedsLogin",
  held: "errHeld",
  quota: "errQuota",
  blocked: "errBlocked",
  "not-installed": "errNotInstalled",
  network: "errNetwork",
  auth: "errAuth",
}

const HINT: Partial<Record<ErrorCode, StringKey>> = {
  held: "errHeldHint",
  quota: "errQuotaHint",
  blocked: "errBlockedHint",
}

/** What went wrong, in the interface language. */
export const errorTitle = (code?: ErrorCode): StringKey =>
  (code && TITLE[code]) || "errUnknown"

/** What to do about it, for the errors that have a known way out. */
export const errorHint = (code?: ErrorCode): StringKey | undefined =>
  code && HINT[code]

/**
 * The engine's own message. It is English and technical, so it reads left to right
 * on its own line, lined up with the localized text above it.
 */
export function ErrorDetail({ message }: { message?: string }) {
  if (!message) return null
  return (
    <span
      dir="ltr"
      className="block font-mono text-xs break-words opacity-75 rtl:text-right"
    >
      {message}
    </span>
  )
}
