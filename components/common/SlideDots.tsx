"use client"

import * as React from "react"
import { cva } from "class-variance-authority"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const dotVariants = cva("h-1.5 min-w-0 rounded-full p-0 px-0 transition-all", {
  variants: {
    tone: {
      default: "bg-primary hover:bg-primary",
      light: "bg-white hover:bg-white",
    },
    active: {
      true: "w-6 opacity-100",
      false: "w-1.5 opacity-50 hover:opacity-80",
    },
  },
  defaultVariants: { tone: "default", active: false },
})

interface SlideDotsProps {
  /** Number of slides (ignored when `indices` is given). */
  count?: number
  /** Explicit slide indices to show dots for (e.g. only enabled slides). */
  indices?: number[]
  current: number
  onSelect: (index: number) => void
  /** `light` for dots over images/dark backgrounds. */
  tone?: "default" | "light"
  /** aria-label prefix, e.g. "Show slide" -> "Show slide 2". */
  label?: string
  className?: string
}

/** Carousel pager dots built from Button; active dot is wider. Replaces raw `<button style={{ width }}>` dots. */
export function SlideDots({ count = 0, indices, current, onSelect, tone = "default", label = "Show slide", className }: SlideDotsProps) {
  const list = indices ?? Array.from({ length: count }, (_, i) => i)
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {list.map((i) => (
        <Button
          key={i}
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`${label} ${i + 1}`}
          aria-current={i === current ? "true" : undefined}
          onClick={() => onSelect(i)}
          className={dotVariants({ tone, active: i === current })}
        />
      ))}
    </div>
  )
}
