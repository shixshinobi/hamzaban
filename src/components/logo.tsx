import { useId } from "react"
import { cn } from "@/lib/utils"

/** Two overlapping speech drops — two languages meeting. */
export function Logo({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 64 64" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.72 0.16 250)" />
          <stop offset="1" stopColor="oklch(0.58 0.2 275)" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.85 0.12 195)" />
          <stop offset="1" stopColor="oklch(0.68 0.14 220)" />
        </linearGradient>
        <linearGradient id={`${id}-s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M8 26c0-9.4 7.6-17 17-17h6c9.4 0 17 7.6 17 17s-7.6 17-17 17h-3l-9 7v-8.2C12.3 39.6 8 33.3 8 26Z"
        fill={`url(#${id}-a)`}
      />
      <path
        d="M56 38c0-7.7-6.3-14-14-14h-4c-7.7 0-14 6.3-14 14s6.3 14 14 14h2l7 5.5v-6.7C51.8 48.8 56 43.9 56 38Z"
        fill={`url(#${id}-b)`}
        fillOpacity="0.92"
      />
      <path
        d="M8 26c0-9.4 7.6-17 17-17h6c9.4 0 17 7.6 17 17"
        fill={`url(#${id}-s)`}
        opacity="0.6"
      />
    </svg>
  )
}
