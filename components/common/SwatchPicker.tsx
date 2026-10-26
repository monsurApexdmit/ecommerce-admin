"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { WithTooltip } from "./WithTooltip"

export interface SwatchOption {
  value: string
  /** Accessible name / tooltip (e.g. "Navy"). */
  label: string
  /** CSS colour for the swatch fill. */
  color: string
  disabled?: boolean
}

interface SwatchPickerProps {
  options: SwatchOption[]
  value?: string
  onValueChange: (value: string) => void
  size?: "sm" | "default"
  className?: string
  "aria-label"?: string
}

/** Radiogroup of round colour swatches (Button-based, tooltip label, check on selected). */
export function SwatchPicker({ options, value, onValueChange, size = "default", className, ...props }: SwatchPickerProps) {
  return (
    <div role="radiogroup" aria-label={props["aria-label"]} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <WithTooltip key={o.value} content={o.label}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              role="radio"
              aria-checked={selected}
              aria-label={o.label}
              disabled={o.disabled}
              onClick={() => onValueChange(o.value)}
              className={cn("relative rounded-full p-0", size === "sm" ? "h-7 w-7" : "h-10 w-10", selected && "ring-2 ring-ring ring-offset-2")}
            >
              <span className="absolute inset-1 rounded-full" style={{ backgroundColor: o.color }} />
              {selected && <Check className="relative text-white drop-shadow" />}
            </Button>
          </WithTooltip>
        )
      })}
    </div>
  )
}
