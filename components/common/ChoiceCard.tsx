"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ChoiceCardContextValue {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}

const ChoiceCardContext = React.createContext<ChoiceCardContextValue>({})

interface ChoiceCardGroupProps extends Omit<React.ComponentProps<"div">, "onChange" | "defaultValue"> {
  value?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
}

/** Accessible radiogroup of rich option cards (arrow keys move + select). Layout (grid cols/gap) via `className`. */
export function ChoiceCardGroup({ value, onValueChange, disabled, className, onKeyDown, ...props }: ChoiceCardGroupProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e)
    if (e.defaultPrevented) return
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]
    if (!keys.includes(e.key)) return
    const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'))
    const idx = radios.indexOf(document.activeElement as HTMLButtonElement)
    if (idx < 0 || radios.length === 0) return
    e.preventDefault()
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1
    const next = radios[(idx + step + radios.length) % radios.length]
    next.focus()
    next.click()
  }
  return (
    <ChoiceCardContext.Provider value={{ value, onValueChange, disabled }}>
      <div role="radiogroup" aria-disabled={disabled || undefined} className={cn("grid gap-2", className)} onKeyDown={handleKeyDown} {...props} />
    </ChoiceCardContext.Provider>
  )
}

interface ChoiceCardProps extends Omit<React.ComponentProps<typeof Button>, "value" | "title" | "variant"> {
  value: string
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
}

/** One selectable card (`role="radio"`) inside `ChoiceCardGroup`; extra content goes in `children`. */
export function ChoiceCard({ value, title, description, icon, className, children, disabled, onClick, ...props }: ChoiceCardProps) {
  const ctx = React.useContext(ChoiceCardContext)
  const checked = ctx.value === value
  return (
    <Button
      type="button"
      variant="outline"
      role="radio"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled || ctx.disabled}
      onClick={(e) => { onClick?.(e); if (!e.defaultPrevented) ctx.onValueChange?.(value) }}
      className={cn(
        "h-auto w-full flex-col items-start justify-start gap-1 whitespace-normal p-4 text-left",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary/5 data-[state=checked]:ring-1 data-[state=checked]:ring-primary",
        className,
      )}
      {...props}
    >
      {(icon || title) && (
        <span className="flex items-center gap-2 font-medium">
          {icon}
          {title}
        </span>
      )}
      {description && <span className="text-xs font-normal text-muted-foreground">{description}</span>}
      {children}
    </Button>
  )
}
