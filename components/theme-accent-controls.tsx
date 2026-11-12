"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { useTranslation } from "react-i18next"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WithTooltip } from "@/components/common/WithTooltip"
import { ACCENT_STORAGE_KEY } from "@/components/accent-picker"

/**
 * Topbar theme toggle. The accent-color picker lives on the Company Settings
 * page now; this component only owns the light/dark switch, but it still
 * re-applies the saved accent on load so the choice persists across reloads.
 */
export function ThemeAccentControls() {
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useTranslation(["ui", "common"])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY)
    if (saved) document.documentElement.style.setProperty("--brand", saved)
  }, [])

  if (!mounted) {
    return <div className="size-11" aria-hidden />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <WithTooltip content={isDark ? t("ui:theme.toLight") : t("ui:theme.toDark")}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? t("ui:theme.toLight") : t("ui:theme.toDark")}
      >
        {isDark ? <Sun className="size-[18px] text-amber-400" /> : <Moon className="size-[18px]" />}
      </Button>
    </WithTooltip>
  )
}
