import type { ParseKeys, TFunction } from "i18next"

/** Namespaces used by the orders / sales screens: `useTranslation(ORDERS_NS)`. */
export const ORDERS_NS = ["orders", "common"] as const
type OrdersNs = typeof ORDERS_NS

/** A translation key of the orders screens ("orders:…" or "common:…"); tsc rejects unknown keys. */
export type OrdersKey = ParseKeys<OrdersNs>
/** `t` of `useTranslation(ORDERS_NS)`, for helpers that build display text outside a component. */
export type OrdersT = TFunction<OrdersNs>

const lower = (v?: string | null) => String(v ?? "").trim().toLowerCase()

/** Order status codes from the API (and derived stages) → display label keys. */
const ORDER_STATUS_KEY: Record<string, OrdersKey> = {
  pending: "common:orderStatus.pending",
  processing: "common:orderStatus.processing",
  confirmed: "common:orderStatus.confirmed",
  packed: "orders:labels.packed",
  shipped: "common:orderStatus.shipped",
  delivered: "common:orderStatus.delivered",
  completed: "common:orderStatus.completed",
  cancelled: "common:orderStatus.cancelled",
  canceled: "common:orderStatus.cancelled",
  returned: "common:orderStatus.returned",
  refunded: "common:orderStatus.refunded",
  on_hold: "common:orderStatus.onHold",
}

/** Translated label for an order status code ("Pending", "Delivered", …); falls back to the raw value. */
export function orderStatusLabel(t: OrdersT, status?: string | null): string {
  const key = ORDER_STATUS_KEY[lower(status).replace(/[\s-]+/g, "_")]
  return key ? t(key) : String(status ?? "")
}

/** Payment labels used by the lists (Paid / Partial / Due / Unpaid). */
const PAY_KEY: Record<string, OrdersKey> = {
  paid: "common:payment.paid",
  partial: "orders:labels.partial",
  partially_paid: "orders:labels.partial",
  due: "common:payment.due",
  unpaid: "common:payment.unpaid",
}

export function payLabel(t: OrdersT, label?: string | null): string {
  const key = PAY_KEY[lower(label)]
  return key ? t(key) : String(label ?? "")
}

/** Payment method codes sent to / received from the API → display labels (bKash, Nagad stay as brands). */
const METHOD_KEY: Record<string, OrdersKey> = {
  cash: "common:payment.cash",
  card: "common:payment.card",
  bank: "common:payment.bank",
  online: "orders:labels.online",
  cod: "orders:labels.cod",
}

export function methodLabel(t: OrdersT, method?: string | null): string {
  const key = METHOD_KEY[lower(method)]
  return key ? t(key) : String(method ?? "")
}

/** Order source / channel codes (manual, pos, storefront) → labels. */
const CHANNEL_KEY: Record<string, OrdersKey> = {
  pos: "orders:labels.pos",
  storefront: "orders:labels.onlineStore",
  online: "orders:labels.online",
  manual: "orders:labels.manual",
}

export function channelLabel(t: OrdersT, source?: string | null): string {
  const key = CHANNEL_KEY[lower(source)]
  if (key) return t(key)
  const s = String(source ?? "")
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""
}
