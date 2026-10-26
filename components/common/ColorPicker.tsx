"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export const DEFAULT_COLOR_PRESETS = [
  "#000000", "#525252", "#a3a3a3", "#e5e5e5", "#ffffff", "#ef4444",
  "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981",
  "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#2449e8", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#78716c",
]

/** Normalises `#abc` / `abc` / `#AABBCC` to lowercase `#aabbcc`; returns null when invalid. */
export function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#/, "")
  if (/^[0-9a-f]{3}$/i.test(v)) return `#${v.split("").map((c) => c + c).join("")}`.toLowerCase()
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v}`.toLowerCase()
  return null
}

function HexInput({ value, onChange, id, disabled, className }: { value: string; onChange: (hex: string) => void; id?: string; disabled?: boolean; className?: string }) {
  const [draft, setDraft] = React.useState(value)
  React.useEffect(() => setDraft(value), [value])
  return (
    <Input
      id={id}
      value={draft}
      disabled={disabled}
      maxLength={7}
      spellCheck={false}
      aria-invalid={normalizeHex(draft) ? undefined : true}
      onChange={(e) => {
        setDraft(e.target.value)
        const hex = normalizeHex(e.target.value)
        if (hex) onChange(hex)
      }}
      onBlur={() => setDraft(value)}
      className={cn("font-mono uppercase", className)}
    />
  )
}

interface ColorPickerProps {
  /** Hex colour, e.g. `#2449e8`. */
  value: string
  /** Called with a normalised lowercase `#rrggbb`. */
  onChange: (hex: string) => void
  /** id for the inline hex Input (when `showInput`), otherwise for the trigger. */
  id?: string
  disabled?: boolean
  presets?: string[]
  /** `sm` = tiny inline swatch (chips), `default` = button-sized. */
  size?: "sm" | "default"
  /** Also render a hex Input next to the swatch trigger. */
  showInput?: boolean
  "aria-label"?: string
  className?: string
}

/** Swatch Button that opens a Popover with preset swatches + hex Input. Replaces native `<input type="color">`. */
export function ColorPicker({ value, onChange, id, disabled, presets = DEFAULT_COLOR_PRESETS, size = "default", showInput, className, ...props }: ColorPickerProps) {
  const current = normalizeHex(value) ?? value
  const trigger = (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          id={showInput ? undefined : id}
          disabled={disabled}
          aria-label={props["aria-label"] ?? `Pick colour (current ${current})`}
          className={cn("shrink-0 p-0", size === "sm" ? "h-4 w-4 rounded-sm" : "h-9 w-9")}
        >
          <span className="size-full rounded-[inherit]" style={{ backgroundColor: current }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <div className="grid grid-cols-6 gap-2">
          {presets.map((c) => (
            <Button
              key={c}
              type="button"
              variant="outline"
              size="sm"
              aria-label={c}
              aria-pressed={current === c}
              onClick={() => onChange(c)}
              className={cn("h-7 w-full p-0", current === c && "ring-2 ring-ring ring-offset-1")}
            >
              <span className="size-full rounded-[inherit]" style={{ backgroundColor: c }} />
            </Button>
          ))}
        </div>
        <HexInput value={current} onChange={onChange} disabled={disabled} />
      </PopoverContent>
    </Popover>
  )
  if (!showInput) return <div className={cn("inline-flex", className)}>{trigger}</div>
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {trigger}
      <HexInput id={id} value={current} onChange={onChange} disabled={disabled} className="flex-1" />
    </div>
  )
}
