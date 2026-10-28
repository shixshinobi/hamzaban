import { MinusIcon, SquareIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { hz } from "@/lib/hz"
import { useApp } from "@/lib/store"

/** Linux draws its own controls; Windows uses the native overlay, macOS the traffic lights. */
export function WindowControls() {
  const os = useApp((s) => s.platform?.os)
  if (os !== "linux") return null
  return (
    <div className="no-drag flex items-center gap-0.5" dir="ltr">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => hz.app.windowControl("minimize")}
        aria-label="Minimize"
      >
        <MinusIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => hz.app.windowControl("maximize")}
        aria-label="Maximize"
      >
        <SquareIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => hz.app.windowControl("close")}
        aria-label="Close"
      >
        <XIcon />
      </Button>
    </div>
  )
}
