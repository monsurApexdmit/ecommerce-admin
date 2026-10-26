"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WithTooltip } from "@/components/common/WithTooltip"

// Runtime-selectable brand accents. The value is written to the `--brand` CSS
// var on <html>; every brand-tinted element (active nav, buttons, badges, POS
// price/checkout) reads that var, so the whole UI recolours instantly.
// Persisted in localStorage under `brand-accent`.
export const ACCENTS = [
  { name: "Emerald", value: "#059669" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
  { name: "Amber", value: "#d97706" },
  { name: "Sky", value: "#0284c7" },
] as const

export const ACCENT_STORAGE_KEY = "brand-accent"

/** Applies an accent immediately and persists it. Safe to call from anywhere. */
export function applyAccent(value: string) {
  document.documentElement.style.setProperty("--brand", value)
  localStorage.setItem(ACCENT_STORAGE_KEY, value)
}

/**
 * Labelled accent picker for the settings page. Larger swatches with a checked
 * state and the colour name, versus the compact topbar variant.
 */
export function AccentPicker() {
  const [mounted, setMounted] = useState(false)
  const [accent, setAccent] = useState<string>(ACCENTS[0].value)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(ACCENT_STORAGE_KEY)
    if (saved) setAccent(saved)
  }, [])

  const pick = (value: string) => {
    setAccent(value)
    applyAccent(value)
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Accent color</p>
        <p className="text-xs text-muted-foreground">
          Applies across buttons, active navigation, and highlights.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Accent color">
        {ACCENTS.map((a) => {
          const active = mounted && accent === a.value
          return (
            <WithTooltip key={a.value} content={a.name}>
              <Button
                type="button"
                variant={active ? "default" : "outline"}
                onClick={() => pick(a.value)}
                aria-label={a.name}
                aria-pressed={active}
              >
                <span
                  className="flex size-5 items-center justify-center rounded-full"
                  style={{ background: a.value }}
                >
                  {active && <Check className="size-3 text-white" strokeWidth={3} />}
                </span>
                <span>{a.name}</span>
              </Button>
            </WithTooltip>
          )
        })}
      </div>
    </div>
  )
}
