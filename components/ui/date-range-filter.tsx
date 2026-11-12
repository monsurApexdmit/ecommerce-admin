"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CalendarDays } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DateRangeFilterProps {
  start: string
  end: string
  onChange: (start: string, end: string) => void
  className?: string
}

const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}

function presetRange(preset: string): [string, string] {
  const now = new Date()
  switch (preset) {
    case "today": return [iso(now), iso(now)]
    case "7d": { const s = new Date(now); s.setDate(s.getDate() - 6); return [iso(s), iso(now)] }
    case "30d": { const s = new Date(now); s.setDate(s.getDate() - 29); return [iso(s), iso(now)] }
    case "month": return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)]
    case "lastmonth": return [
      iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      iso(new Date(now.getFullYear(), now.getMonth(), 0)),
    ]
    default: return ["", ""]
  }
}

/** Preset dropdown (Today, 7 days, This month…) with a custom from/to option. */
export function DateRangeFilter({ start, end, onChange, className }: DateRangeFilterProps) {
  const { t } = useTranslation(["ui", "common"])
  const [preset, setPreset] = useState(start || end ? "custom" : "all")
  const custom = preset === "custom"

  const pick = (v: string) => {
    setPreset(v)
    if (v === "custom") return
    const [s, e] = presetRange(v)
    onChange(s, e)
  }

  return (
    <div className={className ?? "flex items-center gap-2"}>
      <Select value={preset} onValueChange={pick}>
        <SelectTrigger className="w-full lg:w-44">
          <CalendarDays className="size-4 text-muted-foreground" />
          <SelectValue placeholder={t("common:extra.anyDate")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("common:extra.anyDate")}</SelectItem>
          <SelectItem value="today">{t("common:time.today")}</SelectItem>
          <SelectItem value="7d">{t("common:time.last7Days")}</SelectItem>
          <SelectItem value="30d">{t("common:time.last30Days")}</SelectItem>
          <SelectItem value="month">{t("common:time.thisMonth")}</SelectItem>
          <SelectItem value="lastmonth">{t("ui:dateRange.lastMonth")}</SelectItem>
          <SelectItem value="custom">{t("ui:dateRange.custom")}</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <>
          <Input type="date" aria-label={t("common:extra.from")} className="w-36" value={start} onChange={(e) => onChange(e.target.value, end)} />
          <span className="text-muted-foreground text-sm">{t("ui:dateRange.to")}</span>
          <Input type="date" aria-label={t("common:extra.to")} className="w-36" value={end} onChange={(e) => onChange(start, e.target.value)} />
        </>
      )}
    </div>
  )
}
