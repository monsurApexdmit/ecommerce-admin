"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

// Runtime-selectable brand accents. The value is written to the `--brand` CSS
// var on <html>; every brand-tinted element (active nav, upgrade button, badges)
// reads that var, so the whole UI recolours instantly. Persisted in localStorage.
const ACCENTS = [
  { name: "Emerald", value: "#059669" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
] as const

const STORAGE_KEY = "brand-accent"

export function ThemeAccentControls() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [accent, setAccent] = useState<string>(ACCENTS[0].value)

  // next-themes / localStorage are client-only — wait for mount to avoid hydration mismatch.
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setAccent(saved)
      document.documentElement.style.setProperty("--brand", saved)
    }
  }, [])

  const pickAccent = (value: string) => {
    setAccent(value)
    document.documentElement.style.setProperty("--brand", value)
    localStorage.setItem(STORAGE_KEY, value)
  }

  if (!mounted) {
    // Reserve space so the topbar doesn't shift after hydration.
    return <div className="h-8 w-[120px]" aria-hidden />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <div className="flex items-center gap-1">
      {/* Accent swatches */}
      <div className="flex items-center gap-1.5 px-1" role="group" aria-label="Accent color">
        {ACCENTS.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => pickAccent(a.value)}
            title={a.name}
            aria-label={a.name}
            aria-pressed={accent === a.value}
            className={`size-4 rounded-full ring-offset-2 ring-offset-background transition-shadow ${
              accent === a.value ? "ring-2 ring-foreground/40" : "hover:ring-2 hover:ring-foreground/20"
            }`}
            style={{ background: a.value }}
          />
        ))}
      </div>

      {/* Theme toggle */}
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </button>
    </div>
  )
}
