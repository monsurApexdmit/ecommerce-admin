"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { CalendarDays, Store } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { addDaysYmd, addMonthsYmd, formatDate, monthEnd, monthStart, todayIn } from "@/lib/finance-format"
import { cn } from "@/lib/utils"
import { DatePicker } from "./date-picker"

/**
 * FND-2: one Period + Channel filter for every finance page.
 * State lives in the URL (`?period=&from=&to=&channel=`), is written once per change (debounced), and the
 * last choice is kept in sessionStorage so finance sidebar links and in-page finance links carry it along.
 * Period boundaries are worked out by the server in the company time zone (presets are sent as-is);
 * the client only computes a window for endpoints that take plain dates (e.g. Expenses).
 */

export const PERIOD_PRESETS = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["this_week", "This week"],
  ["last_7_days", "Last 7 days"],
  ["this_month", "This month"],
  ["last_month", "Last month"],
  ["last_30_days", "Last 30 days"],
  ["this_quarter", "This quarter"],
  ["last_quarter", "Last quarter"],
  ["this_year", "This year"],
  ["last_year", "Last year"],
  ["all_time", "All time"],
  ["custom", "Custom range"],
] as const
export type PeriodPreset = (typeof PERIOD_PRESETS)[number][0]
const PRESET_SET = new Set<string>(PERIOD_PRESETS.map(([v]) => v))
export const presetLabel = (p: string) => PERIOD_PRESETS.find(([v]) => v === p)?.[1] ?? p

export const CHANNELS = [
  ["all", "All channels"],
  ["pos", "POS"],
  ["online", "Online store"],
  ["manual", "Manual"],
] as const
export type Channel = (typeof CHANNELS)[number][0]
const CHANNEL_SET = new Set<string>(CHANNELS.map(([v]) => v))
export const channelLabel = (c?: string | null) => CHANNELS.find(([v]) => v === c)?.[1] ?? (c || "All channels")

export interface FinanceFilterValue { preset: PeriodPreset; from: string; to: string; channel: Channel }

// ─── Persistence (sessionStorage + subscribers, read by the sidebar) ────────

const STORE_KEY = "finance:filters"
const EVENT = "finance-filters-change"
const FILTER_KEYS = ["period", "from", "to", "channel"] as const

function readStored(): string {
  if (typeof window === "undefined") return ""
  try { return window.sessionStorage.getItem(STORE_KEY) ?? "" } catch { return "" }
}
function writeStored(qs: string) {
  try { window.sessionStorage.setItem(STORE_KEY, qs) } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVENT))
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", cb)
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb) }
}

/** The finance filter query ("period=…&channel=…") last used in this tab; "" on the server and before any choice. */
export function useFinanceQuery(): string {
  return React.useSyncExternalStore(subscribe, readStored, () => "")
}

/** Appends the remembered finance filters to a finance href (keeps the href's own query). */
export function withFinanceQuery(href: string, query: string): string {
  if (!query) return href
  const [path, own = ""] = href.split("?")
  const merged = new URLSearchParams(query)
  new URLSearchParams(own).forEach((v, k) => merged.set(k, v))
  const qs = merged.toString()
  return qs ? `${path}?${qs}` : path
}

/** Finance pages whose links should carry the filters. */
export const isFinanceHref = (href: string) => href.startsWith("/dashboard/finance") || href.startsWith("/dashboard/expenses")

// ─── Query (de)serialisation ────────────────────────────────────────────────

const YMD = /^\d{4}-\d{2}-\d{2}$/
function parse(sp: URLSearchParams | null, defaults: FinanceFilterValue): FinanceFilterValue {
  const from = sp?.get("from") ?? ""
  const to = sp?.get("to") ?? ""
  let preset = (sp?.get("period") ?? "") as PeriodPreset
  if (!PRESET_SET.has(preset)) preset = (from || to) ? "custom" : defaults.preset
  const ch = (sp?.get("channel") ?? "") as Channel
  return {
    preset,
    from: preset === "custom" && YMD.test(from) ? from : "",
    to: preset === "custom" && YMD.test(to) ? to : "",
    channel: CHANNEL_SET.has(ch) ? ch : defaults.channel,
  }
}
function serialise(v: FinanceFilterValue): URLSearchParams {
  const p = new URLSearchParams()
  p.set("period", v.preset)
  if (v.preset === "custom") { if (v.from) p.set("from", v.from); if (v.to) p.set("to", v.to) }
  if (v.channel !== "all") p.set("channel", v.channel)
  return p
}
const hasFilterParams = (sp: URLSearchParams | null) => !!sp && FILTER_KEYS.some((k) => sp.has(k))

// ─── Client-side window (for endpoints that only take dates) ────────────────

/** [from, to] in the company time zone ("" = open side). */
export function presetWindow(v: Pick<FinanceFilterValue, "preset" | "from" | "to">, tz: string): [string, string] {
  const t = todayIn(tz)
  const dow = (new Date(`${t}T12:00:00Z`).getUTCDay() + 6) % 7 // Monday = 0
  const qStart = `${t.slice(0, 4)}-${String(Math.floor((Number(t.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0")}-01`
  switch (v.preset) {
    case "today": return [t, t]
    case "yesterday": { const y = addDaysYmd(t, -1); return [y, y] }
    case "this_week": return [addDaysYmd(t, -dow), t]
    case "last_7_days": return [addDaysYmd(t, -6), t]
    case "this_month": return [monthStart(t), t]
    case "last_month": { const s = addMonthsYmd(t, -1); return [s, monthEnd(s)] }
    case "last_30_days": return [addDaysYmd(t, -29), t]
    case "this_quarter": return [qStart, t]
    case "last_quarter": { const s = addMonthsYmd(qStart, -3); return [s, addDaysYmd(qStart, -1)] }
    case "this_year": return [`${t.slice(0, 4)}-01-01`, t]
    case "last_year": { const y = Number(t.slice(0, 4)) - 1; return [`${y}-01-01`, `${y}-12-31`] }
    case "all_time": return ["", ""]
    default: return [v.from, v.to]
  }
}

/** Server period params: the preset (server works out the dates in the company time zone) or custom dates. */
export interface FinancePeriodParams { preset?: string; from?: string; to?: string; channel?: string }
export function toPeriodParams(v: FinanceFilterValue, withChannel = true): FinancePeriodParams {
  const ch = withChannel && v.channel !== "all" ? { channel: v.channel } : {}
  if (v.preset === "custom") return { preset: "custom", from: v.from || undefined, to: v.to || undefined, ...ch }
  return { preset: v.preset, ...ch }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface Options { defaultPreset?: PeriodPreset; debounceMs?: number }

/**
 * Filter state for a finance page. `value` is what the controls show (updates instantly); `applied` is the
 * debounced value pages fetch with and that is written to the URL (G-5: one URL write per change, no RSC request —
 * history.replaceState is synced into useSearchParams by the App Router).
 */
export function useFinanceFilters({ defaultPreset = "this_month", debounceMs = 250 }: Options = {}) {
  const sp = useSearchParams()
  const pathname = usePathname()
  const { timezone } = useCompanySettings()
  const defaults = React.useMemo<FinanceFilterValue>(() => ({ preset: defaultPreset, from: "", to: "", channel: "all" }), [defaultPreset])

  // Initial value from the URL (same on server and client → no hydration mismatch). Remembered filters are
  // adopted right after mount; `ready` stays false until then so pages don't fetch twice.
  const [value, setValue] = React.useState<FinanceFilterValue>(() => parse(sp, defaults))
  const [applied, setApplied] = React.useState<FinanceFilterValue>(value)
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    if (!hasFilterParams(sp)) {
      const stored = readStored()
      if (stored) { const v = parse(new URLSearchParams(stored), defaults); setValue(v); setApplied(v) }
    }
    setReady(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce draft → applied.
  React.useEffect(() => {
    const same = value.preset === applied.preset && value.from === applied.from && value.to === applied.to && value.channel === applied.channel
    if (same) return
    const t = setTimeout(() => setApplied(value), debounceMs)
    return () => clearTimeout(t)
  }, [value, applied, debounceMs])

  // applied → URL (one replaceState per change) + sessionStorage.
  const spString = sp?.toString() ?? ""
  React.useEffect(() => {
    if (!ready) return
    const own = serialise(applied)
    const merged = new URLSearchParams(spString)
    FILTER_KEYS.forEach((k) => merged.delete(k))
    own.forEach((v, k) => merged.set(k, v))
    const next = merged.toString()
    writeStored(own.toString())
    if (next !== spString && typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", `${pathname}${next ? `?${next}` : ""}`)
    }
  }, [applied, pathname, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Back/forward or an in-app link that changes the filter query → adopt it.
  React.useEffect(() => {
    if (!hasFilterParams(sp)) return
    const next = parse(sp, defaults)
    setValue((cur) => (cur.preset === next.preset && cur.from === next.from && cur.to === next.to && cur.channel === next.channel ? cur : next))
    setApplied((cur) => (cur.preset === next.preset && cur.from === next.from && cur.to === next.to && cur.channel === next.channel ? cur : next))
  }, [spString]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = React.useCallback((patch: Partial<FinanceFilterValue>) => setValue((cur) => {
    const next = { ...cur, ...patch }
    if (patch.preset && patch.preset !== "custom") { next.from = ""; next.to = "" }
    if (patch.preset === "custom" && !cur.from && !cur.to) {
      const [f, t] = presetWindow(cur, timezone)
      next.from = f; next.to = t
    }
    return next
  }), [timezone])

  const incomplete = applied.preset === "custom" && !applied.from && !applied.to
  const [wFrom, wTo] = presetWindow(applied, timezone)
  const label = applied.preset === "custom"
    ? (applied.from && applied.to ? (applied.from === applied.to ? formatDate(applied.from, timezone) : `${formatDate(applied.from, timezone)} – ${formatDate(applied.to, timezone)}`)
      : applied.from ? `From ${formatDate(applied.from, timezone)}` : applied.to ? `Up to ${formatDate(applied.to, timezone)}` : "Custom range")
    : presetLabel(applied.preset)

  return {
    value, applied, set, incomplete, timezone,
    /** False until remembered filters were adopted after mount — don't fetch before. */
    ready,
    /** Window in the company time zone ("" = open side). */
    from: wFrom, to: wTo,
    label,
    /** Server params (preset or custom dates) with channel. */
    params: toPeriodParams(applied),
    /** Server params without channel (for endpoints that don't split by channel). */
    periodParams: toPeriodParams(applied, false),
    /** Stable key for effects. */
    key: serialise(applied).toString(),
  }
}
export type FinanceFiltersState = ReturnType<typeof useFinanceFilters>

/** The Period (+ custom dates) and Channel controls. */
export function FinanceFilters({ filters, channel = true, className, idPrefix = "finance" }: {
  filters: FinanceFiltersState
  /** Show the Channel select (Overview, Payments, Transactions, Reports). */
  channel?: boolean
  className?: string
  idPrefix?: string
}) {
  const v = filters.value
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Select value={v.preset} onValueChange={(p) => filters.set({ preset: p as PeriodPreset })}>
        <SelectTrigger id={`${idPrefix}-period`} aria-label="Period" className="w-44">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_PRESETS.map(([p, l]) => <SelectItem key={p} value={p}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
      {v.preset === "custom" && (
        <>
          <DatePicker aria-label="From" className="w-40" value={v.from} max={v.to || "today"} onChange={(d) => filters.set({ from: d })} placeholder="From" />
          <span className="text-sm text-muted-foreground">to</span>
          <DatePicker aria-label="To" className="w-40" value={v.to} min={v.from || undefined} max="today" onChange={(d) => filters.set({ to: d })} placeholder="To" />
        </>
      )}
      {channel && (
        <Select value={v.channel} onValueChange={(c) => filters.set({ channel: c as Channel })}>
          <SelectTrigger id={`${idPrefix}-channel`} aria-label="Channel" className="w-40">
            <Store className="size-4 text-muted-foreground" aria-hidden />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map(([c, l]) => <SelectItem key={c} value={c}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

/** "As things stand now" marker for period-independent figures (FND-2 / PAY-3). */
export function AsOfNowLabel({ className }: { className?: string }) {
  return <span className={cn("rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground", className)}>As things stand now</span>
}
