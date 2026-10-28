import * as React from "react"
import { cn } from "@/lib/utils"

type GlassPanelProps = React.ComponentProps<"div"> & {
  strong?: boolean
  /** Track the pointer and draw a moving specular highlight. */
  sheen?: boolean
}

export function GlassPanel({
  className,
  strong,
  sheen,
  onPointerMove,
  ...props
}: GlassPanelProps) {
  const handleMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (sheen) {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`)
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`)
      }
      onPointerMove?.(e)
    },
    [sheen, onPointerMove]
  )
  return (
    <div
      data-slot="glass-panel"
      className={cn(
        "glass rounded-2xl",
        strong && "glass-strong",
        sheen && "sheen",
        className
      )}
      onPointerMove={handleMove}
      {...props}
    />
  )
}
