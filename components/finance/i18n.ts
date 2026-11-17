import type { ParseKeys, TFunction } from "i18next"
import { localeTag } from "@/lib/i18n"
import { DEFAULT_TZ, formatDate, formatDateTime, type DateStyle } from "@/lib/finance-format"

/** Namespaces used by the finance screens: `useTranslation(FIN_NS)`. */
export const FIN_NS = ["finance", "common"] as const
type FinNs = typeof FIN_NS

/** A translation key of the finance screens ("finance:…" or "common:…"); tsc rejects unknown keys. */
export type FinKey = ParseKeys<FinNs>
/** `t` of `useTranslation(FIN_NS)`, for helpers that build display text outside a component. */
export type FinT = TFunction<FinNs>

/** "in_transit" → "In transit" (raw fallback for codes without a translation). */
const pretty = (v: string) => { const s = v.replace(/[_-]+/g, " ").trim(); return s.charAt(0).toUpperCase() + s.slice(1) }

// ─── API codes → label keys (codes stay as data; labels translated at render) ─

/** Ledger source types. */
export const SOURCE_KEY: Record<string, FinKey> = {
  sale: "finance:source.sale",
  cod: "finance:source.cod",
  refund: "finance:source.refund",
  supplier_payment: "finance:source.supplier_payment",
  supplier_refund: "finance:source.supplier_refund",
  expense: "finance:source.expense",
  salary: "finance:source.salary",
  dorji_payout: "finance:source.dorji_payout",
  tailor_payment: "finance:source.tailor_payment",
  manual: "finance:source.manual",
  transfer: "finance:source.transfer",
  expense_void: "finance:source.expense_void",
}
export const SOURCE_TYPES = Object.keys(SOURCE_KEY)
/** Translated ledger source; unknown codes fall back to the server label, then the raw code. */
export function sourceText(t: FinT, type?: string | null, serverLabel?: string | null): string {
  const k = type ? SOURCE_KEY[type] : undefined
  if (k) return t(k)
  return serverLabel || (type ? pretty(type) : "—")
}

export const ACCOUNT_TYPE_KEY: Record<string, FinKey> = {
  cash: "finance:accountType.cash",
  bank: "finance:accountType.bank",
  mobile_wallet: "finance:accountType.mobile_wallet",
  card: "finance:accountType.card",
  other: "finance:accountType.other",
}
export const ACCOUNT_TYPE_CODES = Object.keys(ACCOUNT_TYPE_KEY)
export function accountTypeText(t: FinT, type?: string | null, serverLabel?: string | null): string {
  const k = type ? ACCOUNT_TYPE_KEY[type] : undefined
  return k ? t(k) : serverLabel || type || "—"
}

/** Payment method keys (FINANCE_API_CONTRACT.md → Enums) and the stored method values of the pay dialogs. */
const METHOD_KEY: Record<string, FinKey> = {
  cash: "finance:method.cash",
  bank: "finance:method.bank",
  bank_transfer: "finance:method.bank",
  card: "finance:method.card",
  bkash: "finance:method.bkash",
  nagad: "finance:method.nagad",
  rocket: "finance:method.rocket",
  online: "finance:method.online",
  cod: "finance:method.cod",
  cheque: "finance:method.cheque",
  check: "finance:method.cheque",
  other: "finance:method.other",
}
/** Method keys in the contract order (selects). */
export const METHOD_CODES = ["cash", "bank", "card", "bkash", "nagad", "rocket", "online", "cod", "cheque"]
const methodNorm = (m: string) => m.trim().toLowerCase().replace(/[\s-]+/g, "_")
export function methodText(t: FinT, method?: string | null, serverLabel?: string | null): string {
  const k = method ? METHOD_KEY[methodNorm(method)] : undefined
  if (k) return t(k)
  const l = serverLabel || method
  if (!l) return "—"
  const k2 = METHOD_KEY[methodNorm(l)]
  return k2 ? t(k2) : l
}

export const PAYEE_KEY: Record<string, FinKey> = {
  supplier: "finance:payee.supplier",
  dorji: "finance:payee.dorji",
  staff: "finance:payee.staff",
  salary: "finance:payee.salary",
}
export function payeeText(t: FinT, type?: string | null, serverLabel?: string | null): string {
  const k = type ? PAYEE_KEY[type] : undefined
  return k ? t(k) : serverLabel || (type ? pretty(type) : "—")
}

/** Stock movement types. */
export const MOVE_KEY: Record<string, FinKey> = {
  opening: "finance:moveType.opening",
  receive: "finance:moveType.receive",
  sell: "finance:moveType.sell",
  return: "finance:moveType.return",
  transfer: "finance:moveType.transfer",
  adjustment: "finance:moveType.adjustment",
  damage: "finance:moveType.damage",
}
export const MOVE_CODES = Object.keys(MOVE_KEY)
export function moveText(t: FinT, type?: string | null, serverLabel?: string | null): string {
  const k = type ? MOVE_KEY[type] : undefined
  return k ? t(k) : serverLabel || (type ? pretty(type) : "—")
}

// ─── Dates in the UI language (company time zone) ───────────────────────────

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
  month: { month: "short", year: "numeric" },
  monthLong: { month: "long", year: "numeric" },
  day: { day: "numeric", month: "short" },
}
const cache = new Map<string, Intl.DateTimeFormat>()
function dtf(locale: string, tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${tz}|${JSON.stringify(opts)}`
  let f = cache.get(key)
  if (!f) {
    try { f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: tz }) } catch { f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: DEFAULT_TZ }) }
    cache.set(key, f)
  }
  return f
}
function parse(v: string | Date): { date: Date; dateOnly: boolean } | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : { date: v, dateOnly: false }
  const s = String(v).trim()
  if (!s) return null
  if (DATE_ONLY.test(s)) { const [y, m, d] = s.split("-").map(Number); return { date: new Date(Date.UTC(y, m - 1, d, 12)), dateOnly: true } }
  const d = new Date(s.includes("T") || s.includes(" ") ? s.replace(" ", "T") : s)
  return Number.isNaN(d.getTime()) ? null : { date: d, dateOnly: false }
}

/** Like lib/finance-format `formatDate`, in the UI language (English keeps the exact same output). */
export function formatDateIn(lng: string, v: string | Date | null | undefined, tz: string = DEFAULT_TZ, style: DateStyle = "short"): string {
  const locale = localeTag(lng)
  if (locale === "en-GB") return formatDate(v, tz, style)
  if (v == null || v === "") return "—"
  const p = parse(v)
  if (!p) return String(v)
  return dtf(locale, p.dateOnly ? "UTC" : tz, STYLES[style]).format(p.date)
}

export function formatDateTimeIn(lng: string, v: string | Date | null | undefined, tz: string = DEFAULT_TZ): string {
  const locale = localeTag(lng)
  if (locale === "en-GB") return formatDateTime(v, tz)
  if (v == null || v === "") return "—"
  const p = parse(v)
  if (!p) return String(v)
  if (p.dateOnly) return formatDateIn(lng, v, tz)
  return dtf(locale, tz, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(p.date)
}

/**
 * Bucket / month label from its key: "2026-10" → "October 2026", "2026-10-28" → "28 Oct";
 * anything else (server label such as "Week 43") is returned as is.
 */
export function periodKeyLabel(lng: string, key: string | null | undefined, fallback: string, monthStyle: "month" | "monthLong" = "monthLong"): string {
  const k = String(key ?? "")
  if (/^\d{4}-\d{2}$/.test(k)) return formatDateIn(lng, `${k}-01`, "UTC", monthStyle)
  if (DATE_ONLY.test(k)) return formatDateIn(lng, k, "UTC", "day")
  return fallback
}

/** Shipment / tailor order status codes shown on Receivables → label keys. */
const STATUS_KEY: Record<string, FinKey> = {
  pending: "common:orderStatus.pending",
  delivered: "common:orderStatus.delivered",
  cancelled: "common:orderStatus.cancelled",
  returned: "common:orderStatus.returned",
  picked_up: "finance:status.picked_up",
  in_transit: "finance:status.in_transit",
  out_for_delivery: "finance:status.out_for_delivery",
  failed: "finance:status.failed",
  measurement_taken: "finance:status.measurement_taken",
  assigned: "finance:status.assigned",
  cutting: "finance:status.cutting",
  stitching: "finance:status.stitching",
  ready: "finance:status.ready",
}
/** Translated status; unknown codes are shown in sentence case. */
export function statusText(t: FinT, status?: string | null): string {
  if (!status) return "—"
  const k = STATUS_KEY[status.trim().toLowerCase().replace(/[\s-]+/g, "_")]
  return k ? t(k) : pretty(status.toLowerCase())
}
