"use client"

import * as React from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export interface SegmentedOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
  "aria-label"?: string
}

interface SegmentedControlProps {
  value: string
  onValueChange: (value: string) => void
  options: SegmentedOption[]
  size?: "sm" | "default" | "lg"
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

/** Single-choice pill/segment row (ToggleGroup, radio semantics); never deselects. Replaces `role="radio"` chip buttons. */
export function SegmentedControl({ value, onValueChange, options, size = "sm", disabled, className, ...props }: SegmentedControlProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size={size}
      value={value}
      disabled={disabled}
      onValueChange={(v) => { if (v) onValueChange(v) }}
      className={cn("w-fit max-w-full flex-wrap", className)}
      {...props}
    >
      {options.map((o) => (
        // Segments start at their label's width and grow to fill a full-width group; they never shrink
        // below the label (the base item is equal-width `flex-1 min-w-0`, which clipped long labels)
        <ToggleGroupItem key={o.value} value={o.value} disabled={o.disabled} aria-label={o["aria-label"]}
          className="flex-auto shrink-0 whitespace-nowrap px-3">

          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
