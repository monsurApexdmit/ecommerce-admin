/**
 * Shared date / number formatting for Finance (FND-3, G-2).
 *
 * Every function takes the company time zone explicitly and uses a fixed locale, so the server render and the
 * browser render produce the same text (no hydration mismatch) and nothing is shown in UTC or in the viewer's
 * own time zone. Date-only strings ("YYYY-MM-DD") are calendar dates: they are never shifted by a time zone.
 */

export const DEFAULT_TZ = "Asia/Dhaka"
const LOCALE = "en-GB"

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function dtf(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tz}|${JSON.stringify(opts)}`
  let f = fmtCache.get(key)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: tz })
    } catch {
      f = new Intl.DateTimeFormat(LOCALE, { ...opts, timeZone: DEFAULT_TZ })
    }
    fmtCache.set(key, f)
  }
  return f
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Parse "YYYY-MM-DD" (as a UTC calendar date) or an ISO timestamp. */
function toDate(v: string | Date): { date: Date; dateOnly: boolean } | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : { date: v, dateOnly: false }
  const s = String(v).trim()
  if (!s) return null
  if (DATE_ONLY.test(s)) {
    const [y, m, d] = s.split("-").map(Number)
    return { date: new Date(Date.UTC(y, m - 1, d, 12)), dateOnly: true }
  }
  const d = new Date(s.includes("T") || s.includes(" ") ? s.replace(" ", "T") : s)
  return Number.isNaN(d.getTime()) ? null : { date: d, dateOnly: false }
}

export type DateStyle = "short" | "long" | "month" | "monthLong" | "day"
const STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short", year: "numeric" }, // 28 Oct 2026
  long: { day: "numeric", month: "long", year: "numeric" }, // 28 October 2026
  month: { month: "short", year: "numeric" }, // Oct 2026
  monthLong: { month: "long", year: "numeric" }, // October 2026
  day: { day: "numeric", month: "short" }, // 28 Oct
}

/** "28 Oct 2026" — date-only strings are calendar dates; timestamps are shown in `tz`. */
export function formatDate(v: string | Date | null | undefined, tz: string = DEFAULT_TZ, style: DateStyle = "short"): string {
  if (v == null || v === "") return "—"
  const p = toDate(v)
  if (!p) return String(v)
  return dtf(p.dateOnly ? "UTC" : tz, STYLES[style]).format(p.date)
}

/** "28 Oct 2026, 14:03" in `tz` (date-only strings fall back to the date). */
export function formatDateTime(v: string | Date | null | undefined, tz: string = DEFAULT_TZ): string {
  if (v == null || v === "") return "—"
  const p = toDate(v)
  if (!p) return String(v)
  if (p.dateOnly) return formatDate(v, tz)
  return dtf(tz, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(p.date)
}

/** The calendar date ("YYYY-MM-DD") of `at` (default now) in `tz`. */
export function dateIn(tz: string = DEFAULT_TZ, at: Date = new Date()): string {
  const parts = dtf(tz, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at)
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "01"
  return `${get("year")}-${get("month")}-${get("day")}`
}

/** Today in the company time zone. */
export const todayIn = (tz: string = DEFAULT_TZ) => dateIn(tz)

// ─── Calendar-date arithmetic on "YYYY-MM-DD" (time-zone free) ──────────────

const pad = (n: number) => String(n).padStart(2, "0")
const ymdUTC = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const parseYmd = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, (m || 1) - 1, d || 1)) }

export function addDaysYmd(iso: string, n: number): string { const d = parseYmd(iso); d.setUTCDate(d.getUTCDate() + n); return ymdUTC(d) }
export const monthStart = (iso: string) => `${iso.slice(0, 7)}-01`
export function monthEnd(iso: string): string { const d = parseYmd(monthStart(iso)); d.setUTCMonth(d.getUTCMonth() + 1, 0); return ymdUTC(d) }
export function addMonthsYmd(iso: string, n: number): string { const d = parseYmd(monthStart(iso)); d.setUTCMonth(d.getUTCMonth() + n); return ymdUTC(d) }
export const daysBetween = (a: string, b: string) => Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86_400_000)

/** "2026-10" → "October 2026". */
export const monthLabel = (ym: string, style: "month" | "monthLong" = "monthLong") => formatDate(`${ym.slice(0, 7)}-01`, "UTC", style)

// ─── Numbers ─────────────────────────────────────────────────────────────────

const numFmt = new Intl.NumberFormat("en-US")
/** "1,234" with a fixed locale (same text on server and client). */
export const formatNumber = (n: number | null | undefined) => numFmt.format(Number(n) || 0)
export const formatPct = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(digits)}%`)
