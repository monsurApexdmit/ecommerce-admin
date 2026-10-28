"use client"

import * as React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { DEFAULT_TZ, addDaysYmd, formatDate, formatDateTime, formatNumber, todayIn } from "@/lib/finance-format"
import { compactMoney, currencySymbol } from "@/components/dashboard/format"
import { exportToCSV } from "@/lib/export-import-utils"
import { cn } from "@/lib/utils"

// ─── Dates & formatting (FND-3: company time zone, fixed locale) ─────────────

/** Today in the company time zone ("YYYY-MM-DD"). Use `useFinanceFormat().today` inside components. */
export const todayStr = (tz: string = DEFAULT_TZ) => todayIn(tz)
export const addDays = addDaysYmd

/** "28 Oct 2026". Date-only strings are calendar dates (never shifted); timestamps are shown in the company time zone. */
export const fmtDate = (d?: string | null, tz: string = DEFAULT_TZ) => formatDate(d ?? null, tz)

/** Formatting bound to the company settings: currency, time zone, today. */
export function useFinanceFormat() {
  const { formatCurrency, timezone, currency } = useCompanySettings()
  return React.useMemo(() => ({
    tz: timezone,
    currencyCode: currency,
    money: (n: number) => formatCurrency(n),
    date: (d?: string | null) => formatDate(d ?? null, timezone),
    longDate: (d?: string | null) => formatDate(d ?? null, timezone, "long"),
    dateTime: (d?: string | null) => formatDateTime(d ?? null, timezone),
    number: formatNumber,
    today: todayIn(timezone),
  }), [formatCurrency, timezone, currency])
}

/** Small "BDT" label next to figures (currency comes from the response, else the company setting). */
export function CurrencyTag({ code, className }: { code?: string | null; className?: string }) {
  const { currency } = useCompanySettings()
  const c = code || currency
  if (!c) return null
  return <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground", className)} title={`All amounts in ${c}`}>{c}</span>
}

// ─── Labels ──────────────────────────────────────────────────────────────────

/** Ledger source types (labels match the server's `sourceLabel`). */
export const SOURCE_LABELS: Record<string, string> = {
  sale: "Sale payment",
  cod: "COD collection",
  refund: "Customer refund",
  supplier_payment: "Supplier payment",
  supplier_refund: "Supplier refund",
  expense: "Expense",
  salary: "Salary",
  dorji_payout: "Dorji payout",
  tailor_payment: "Tailor payment",
  manual: "Manual entry",
  transfer: "Transfer",
  expense_void: "Expense voided",
}
export const sourceLabel = (s?: string | null) => (s ? SOURCE_LABELS[s] ?? s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—")

/** G-7: sentence case for raw status / method texts ("in_transit" → "In transit"), acronyms kept ("cod" → "COD"). */
export function sentenceCase(v?: string | null): string {
  if (!v) return "—"
  const t = v.replace(/[_-]+/g, " ").trim().toLowerCase()
  const s = t.charAt(0).toUpperCase() + t.slice(1)
  return s.replace(/\bcod\b/gi, "COD").replace(/\bpos\b/gi, "POS").replace(/\bvat\b/gi, "VAT").replace(/\bbkash\b/gi, "bKash")
}

export const ACCOUNT_TYPES: [string, string][] = [
  ["cash", "Cash"], ["bank", "Bank"], ["mobile_wallet", "Mobile wallet"], ["card", "Card"], ["other", "Other"],
]
export const accountTypeLabel = (t?: string | null) => ACCOUNT_TYPES.find(([v]) => v === t)?.[1] ?? (t || "—")

/** Payment method keys the server normalises every stored method to (FINANCE_API_CONTRACT.md → Enums). */
export const METHOD_KEYS: [string, string][] = [
  ["cash", "Cash"], ["bank", "Bank transfer"], ["card", "Card"], ["bkash", "bKash"], ["nagad", "Nagad"],
  ["rocket", "Rocket"], ["online", "Online"], ["cod", "Cash on delivery"], ["cheque", "Cheque"],
]

// ─── Money cells ─────────────────────────────────────────────────────────────

/** Amount coloured by direction: money in green "+", money out red "−". */
export function DirectionAmount({ direction, amount, format, className }: { direction: "in" | "out"; amount: number; format: (n: number) => string; className?: string }) {
  return (
    <span className={cn("font-medium tabular-nums", direction === "in" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive", className)}>
      {direction === "in" ? "+" : "−"}{format(Math.abs(amount))}
    </span>
  )
}

/** Signed money: negative red, positive default (or green with `positiveTone`). */
export function SignedMoney({ value, format, positiveTone, className }: { value: number; format: (n: number) => string; positiveTone?: boolean; className?: string }) {
  return (
    <span className={cn("tabular-nums", value < 0 ? "text-destructive" : positiveTone && value > 0 ? "text-emerald-600 dark:text-emerald-400" : "", className)}>
      {value < 0 ? "−" : ""}{format(Math.abs(value))}
    </span>
  )
}

/** "+12.5% vs previous" hint for a KPI. */
export function ChangeHint({ current, previous, invert }: { current: number; previous?: number | null; invert?: boolean }) {
  if (previous == null) return null
  if (previous === 0) return <span className="text-muted-foreground">{current === 0 ? "No change" : "New vs previous period"}</span>
  const pct = ((current - previous) / Math.abs(previous)) * 100
  const good = invert ? pct < 0 : pct > 0
  return (
    <span className={cn(pct === 0 ? "text-muted-foreground" : good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
      {pct > 0 ? "+" : ""}{pct.toFixed(1)}% vs previous period
    </span>
  )
}

// ─── Charts (CSS bars, same approach as the dashboard and reports pages) ─────

export interface InOutBucket { label: string; in: number; out: number }

/** Paired bars per bucket: money in (green) vs money out (red). */
export function InOutChart({ buckets, format, height = 180 }: { buckets: InOutBucket[]; format: (n: number) => string; height?: number }) {
  const symbol = currencySymbol(format)
  const peak = Math.max(1, ...buckets.map((b) => Math.max(b.in, b.out)))
  if (!buckets.some((b) => b.in || b.out)) return <p className="py-10 text-center text-sm text-muted-foreground">No money moved in this period.</p>
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: Math.max(360, buckets.length * 28) }}>
        <div className="flex items-end gap-1.5 border-b" style={{ height }} role="img" aria-label="Money in versus money out">
          {buckets.map((b) => (
            <div key={b.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5" title={`${b.label}: in ${format(b.in)}, out ${format(b.out)}`}>
              <div className="w-1/2 max-w-4 rounded-t-sm bg-emerald-500" style={{ height: `${b.in ? Math.max(2, (b.in / peak) * 100) : 0}%` }} />
              <div className="w-1/2 max-w-4 rounded-t-sm bg-rose-500" style={{ height: `${b.out ? Math.max(2, (b.out / peak) * 100) : 0}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {buckets.map((b, i) => (
            <span key={b.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground">
              {buckets.length > 16 && i % Math.ceil(buckets.length / 12) !== 0 ? "" : b.label}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" aria-hidden /> Money in</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-rose-500" aria-hidden /> Money out</span>
        <span className="ml-auto tabular-nums">Peak {compactMoney(peak, symbol)}</span>
      </div>
    </div>
  )
}

const MIX_COLORS = ["#2449E8", "#0F766E", "#F59E0B", "#5B21B6", "#B42318", "#7C8AA8", "#0891B2", "#DB2777"]

/** Horizontal bars for a breakdown (expenses by category, balances by account…). */
export function MixBars({ items, format, empty = "Nothing to show for this period.", limit = 8 }: {
  items: { label: string; value: number; hint?: string; color?: string }[]
  format: (n: number) => string
  empty?: string
  limit?: number
}) {
  const top = items.slice(0, limit)
  const peak = Math.max(1, ...top.map((i) => Math.abs(i.value)))
  if (top.length === 0) return <p className="py-6 text-sm text-muted-foreground">{empty}</p>
  return (
    <div className="flex flex-col gap-3">
      {top.map((m, i) => (
        <div key={`${m.label}-${i}`} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{m.label}{m.hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{m.hint}</span>}</span>
            <span className={cn("tabular-nums", m.value < 0 ? "text-destructive" : "text-muted-foreground")}>{m.value < 0 ? "−" : ""}{format(Math.abs(m.value))}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${Math.round((Math.abs(m.value) / peak) * 100)}%`, background: m.value < 0 ? "var(--destructive)" : m.color || MIX_COLORS[i % MIX_COLORS.length] }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Stacked aging bar (Current / 1–30 / 31–60 / 60+ …). */
export function AgingBar({ buckets, format }: { buckets: { label: string; amount: number; count?: number }[]; format: (n: number) => string }) {
  const colors = ["#0F766E", "#F59E0B", "#EA580C", "#B42318", "#7F1D1D"]
  const total = buckets.reduce((n, b) => n + Math.max(0, b.amount), 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Aging breakdown">
        {total > 0 && buckets.map((b, i) => b.amount > 0 && (
          <div key={b.label} style={{ width: `${(b.amount / total) * 100}%`, background: colors[i % colors.length] }} />
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {buckets.map((b, i) => (
          <div key={b.label} className="flex items-start gap-2 text-sm">
            <span className="mt-1 size-2.5 flex-none rounded-sm" style={{ background: colors[i % colors.length] }} aria-hidden />
            <div className="min-w-0">
              <p className="text-muted-foreground">{b.label}</p>
              <p className="font-semibold tabular-nums">{format(b.amount)}</p>
              {b.count != null && <p className="text-xs text-muted-foreground">{b.count} {b.count === 1 ? "item" : "items"}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TileSkeletons({ n = 4 }: { n?: number }) {
  return <>{Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-[110px]" />)}</>
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

/**
 * Download rows as CSV through the shared exportToCSV (object rows keyed by the header's snake_case form).
 * Values are stringified so zeros survive (exportToCSV drops falsy values).
 */
export function downloadCsv<T>(filename: string, columns: [string, (row: T) => string | number | null | undefined][], rows: T[]) {
  const headers = columns.map(([h]) => h)
  const key = (h: string) => h.toLowerCase().replace(/ /g, "_")
  const data = rows.map((r) => Object.fromEntries(columns.map(([h, get]) => {
    const v = get(r)
    return [key(h), v == null ? "" : String(v)]
  })))
  exportToCSV(data, filename, headers)
}

/** Plain number for CSV cells (2 decimals, no currency symbol). */
export const csvMoney = (n: number | null | undefined) => (Number(n) || 0).toFixed(2)
