import { CropIcon, LanguagesIcon, ReplaceIcon } from "lucide-react"
import { Logo } from "@/components/logo"
import { LanguagePicker } from "@/components/pickers"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { Kbd } from "@/components/ui/kbd"
import { useT } from "@/lib/i18n"
import { useApp } from "@/lib/store"
import { formatAccel } from "./shortcut-recorder"

export function Onboarding() {
  const t = useT()
  const s = useApp((st) => st.settings!)
  const os = useApp((st) => st.platform?.os)
  const update = useApp((st) => st.update)
  const rows = [
    {
      icon: LanguagesIcon,
      label: t("scTranslateSelection"),
      accel: s.shortcuts.translateSelection,
    },
    {
      icon: CropIcon,
      label: t("scCaptureScreen"),
      accel: s.shortcuts.captureScreen,
    },
    {
      icon: ReplaceIcon,
      label: t("scReplaceSelection"),
      accel: s.shortcuts.replaceSelection,
    },
  ]
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && void update({ onboarded: true })}
    >
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader className="items-center text-center">
          <Logo className="mb-2 size-14" />
          <DialogTitle className="text-xl">{t("welcomeTitle")}</DialogTitle>
          <DialogDescription>{t("welcomeBody")}</DialogDescription>
        </DialogHeader>
        <ItemGroup className="gap-1">
          {rows.map((r) => (
            <Item key={r.label} size="sm" className="glass-flat border-0">
              <ItemMedia variant="icon">
                <r.icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{r.label}</ItemTitle>
              </ItemContent>
              <ItemActions>
                <Kbd dir="ltr">{formatAccel(r.accel, os)}</Kbd>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
        <Field orientation="horizontal">
          <FieldLabel>{t("welcomeTarget")}</FieldLabel>
          <LanguagePicker
            value={s.targetLang}
            onChange={(targetLang) => void update({ targetLang })}
            size="default"
          />
        </Field>
        <DialogFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={() => void update({ onboarded: true })}
          >
            {t("start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
