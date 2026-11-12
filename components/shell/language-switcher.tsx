"use client"

import { Check, Languages } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { WithTooltip } from "@/components/common/WithTooltip"
import { LANGUAGES, rememberLanguage } from "@/lib/i18n"

/** Top-bar language picker; the choice is kept per browser in the admin-lang cookie. */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation(["common"])
  const current = LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ?? LANGUAGES[0]

  return (
    <DropdownMenu>
      <WithTooltip content={t("common:language.switchTo")}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="gap-1.5 px-2.5" aria-label={`${t("common:language.switchTo")} (${current.label})`}>
            <Languages className="size-4" aria-hidden />
            <span className="text-xs font-semibold">{current.short}</span>
          </Button>
        </DropdownMenuTrigger>
      </WithTooltip>
      <DropdownMenuContent align="end" className="min-w-36">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            lang={l.code}
            onSelect={() => {
              rememberLanguage(l.code)
              void i18n.changeLanguage(l.code)
            }}
            className="justify-between gap-3"
          >
            {l.label}
            {l.code === current.code && <Check className="size-4" aria-hidden />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
