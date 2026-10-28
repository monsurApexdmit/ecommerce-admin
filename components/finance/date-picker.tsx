"use client"

import * as React from "react"
import { CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { formatDate, todayIn } from "@/lib/finance-format"
import { cn } from "@/lib/utils"

const toLocal = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1) }
const pad = (n: number) => String(n).padStart(2, "0")
const fromLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

interface DatePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  /** Earliest / latest selectable day ("YYYY-MM-DD"). `max="today"` = today in the company time zone. */
  min?: string
  max?: string | "today"
  placeholder?: string
  className?: string
  disabled?: boolean
  "aria-label"?: string
}

/**
 * The app's date picker (PO-3): popover calendar on "YYYY-MM-DD" calendar dates. "Today" is the company's
 * today (company time zone), never UTC or the browser's zone.
 */
export function DatePicker({ id, value, onChange, min, max, placeholder = "Pick a date", className, disabled, ...props }: DatePickerProps) {
  const { timezone } = useCompanySettings()
  const [open, setOpen] = React.useState(false)
  const maxDay = max === "today" ? todayIn(timezone) : max
  const selected = value ? toLocal(value) : undefined
  const disabledDays = [
    ...(min ? [{ before: toLocal(min) }] : []),
    ...(maxDay ? [{ after: toLocal(maxDay) }] : []),
  ]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" disabled={disabled} aria-label={props["aria-label"]}
          className={cn("w-full justify-start gap-2 font-normal", !value && "text-muted-foreground", className)}>
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          {value ? formatDate(value, timezone) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? (maxDay ? toLocal(maxDay) : undefined)}
          captionLayout="dropdown"
          disabled={disabledDays}
          onSelect={(d) => { if (d) { onChange(fromLocal(d)); setOpen(false) } }}
        />
      </PopoverContent>
    </Popover>
  )
}
