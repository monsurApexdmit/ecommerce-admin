import type { ShipmentResponse, ShipmentStatus } from "@/lib/shipmentsApi"

export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  pending: "Pending pickup",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Failed",
  returned: "Returned",
}

export const STATUS_STYLE: Record<ShipmentStatus, string> = {
  pending: "bg-dash-warn-soft text-dash-warn-fg",
  picked_up: "bg-dash-accent-soft text-dash-accent-fg",
  in_transit: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
  out_for_delivery: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
  delivered: "bg-dash-success-soft text-dash-success-fg",
  failed: "bg-dash-danger-soft text-dash-danger-fg",
  returned: "bg-dash-danger-soft text-dash-danger-fg",
}

const FLOW: ShipmentStatus[] = ["pending", "picked_up", "in_transit", "out_for_delivery", "delivered"]
export const TIMELINE_STEPS = FLOW

/** The single "happy path" next step, or null when finished. */
export function nextStep(cur: ShipmentStatus): ShipmentStatus | null {
  const i = FLOW.indexOf(cur)
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null
}

export const NEXT_STEP_LABEL: Partial<Record<ShipmentStatus, string>> = {
  picked_up: "Mark picked up",
  in_transit: "Mark in transit",
  out_for_delivery: "Out for delivery",
  delivered: "Mark delivered",
}

/** Forward-only: later steps (and Failed) while active; Failed can only become Returned. */
export function validNextStatuses(cur: ShipmentStatus): ShipmentStatus[] {
  if (cur === "failed") return ["returned"]
  const i = FLOW.indexOf(cur)
  if (i < 0 || cur === "delivered") return []
  return [...FLOW.slice(i + 1), "failed"]
}

export type CodKind = "none" | "prepaid" | "to_collect" | "collected" | "delivered_unpaid" | "returning"

export interface CodView { amount: number; kind: CodKind; label: string; cls: string; collected: boolean }

const norm = (v?: string | null) => (v ?? "").toLowerCase().replace(/[^a-z]/g, "")

/** COD state from the server's `codState`, with a sell-based fallback for older rows. */
export function codView(s: ShipmentResponse): CodView {
  const sell = s.sell
  const amount = Number(s.codAmount) || (sell && sell.method === "COD" && sell.paymentStatus !== "paid" ? Number(sell.amount) : 0)
  const st = norm(s.codState)
  let kind: CodKind
  if (st) {
    if (st.includes("return")) kind = "returning"
    else if (st.includes("prepaid") || st === "none" || st === "na") kind = "prepaid"
    else if (st.includes("collected") || st === "paid" || st === "settled") kind = "collected"
    else if (st.includes("deliver") || st.includes("record") || st.includes("awaiting")) kind = "delivered_unpaid"
    else kind = "to_collect"
  } else if (amount <= 0) {
    kind = sell?.paymentStatus === "paid" ? "prepaid" : "none"
  } else if (s.codCollected === true || s.codCollected === 1) kind = "collected"
  else if (s.status === "failed" || s.status === "returned") kind = "returning"
  else if (s.status === "delivered") kind = "delivered_unpaid"
  else kind = "to_collect"
  const map: Record<CodKind, [string, string]> = {
    none: ["—", "text-dash-muted"],
    prepaid: ["Prepaid", "text-dash-muted"],
    to_collect: ["To collect", "text-dash-warn-fg"],
    collected: ["Collected", "text-dash-success-fg"],
    delivered_unpaid: ["Delivered · record payment", "text-dash-warn-fg"],
    returning: ["Returning", "text-dash-danger-fg"],
  }
  return { amount: kind === "prepaid" || kind === "none" ? 0 : amount, kind, label: map[kind][0], cls: map[kind][1], collected: kind === "collected" }
}

export const shortDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"
