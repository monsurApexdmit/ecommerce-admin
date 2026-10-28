import { Alert } from "react-native"
import * as Print from "expo-print"
import * as Sharing from "expo-sharing"
import type { TailorAssignmentRow, TailorMeasurement, TailorOrderDetail, TailorStage } from "@/types/tailor"
import { TAILOR_STAGE_LABEL, stageOf, tailorMethodLabel, tailorPayLabel } from "@/types/tailor"

type Fc = (n: number) => string

// ─── Dates ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0")
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayIso = () => isoOf(new Date())
export const addDaysIso = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoOf(d) }
export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + "T00:00:00").getTime())

export const fmtDate = (d?: string | null) =>
  d ? new Date(d.length <= 10 ? d + "T00:00:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"

/** "5 min ago" / "3 days ago" */
export function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (!isFinite(s)) return ""
  if (s < 60) return "just now"
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo} mo ago`
  return `${Math.floor(mo / 12)} yr ago`
}

/** "Overdue 2d" / "Due today" / "In 3 days" with a colour. */
export function whenText(daysLeft: number | null, stage: TailorStage): { text: string; color: string } {
  if (stage === "delivered") return { text: "Delivered", color: "#64748b" }
  if (stage === "cancelled") return { text: "Cancelled", color: "#64748b" }
  if (daysLeft == null) return { text: "No delivery date", color: "#64748b" }
  if (daysLeft < 0) return { text: `Overdue ${-daysLeft}d`, color: "#dc2626" }
  if (daysLeft === 0) return { text: "Due today", color: "#d97706" }
  return { text: `In ${daysLeft} day${daysLeft === 1 ? "" : "s"}`, color: daysLeft <= 1 ? "#d97706" : "#64748b" }
}

/** Stage name for a raw status-log value. */
export const stageName = (raw: string) => TAILOR_STAGE_LABEL[stageOf(raw)] ?? raw

// ─── Measurements / KPI icons ────────────────────────────────────────────────

const MEASURE_FIELDS: [keyof TailorMeasurement, string][] = [
  ["chest", "chest"], ["waist", "waist"], ["hip", "hip"], ["shoulder", "shoulder"], ["sleeve", "sleeve"], ["length", "length"],
  ["neck", "neck"], ["bottomLength", "bottom length"], ["inseam", "inseam"], ["pajamaWaist", "pajama waist"], ["pajamaLength", "pajama length"],
]

/** "chest 42 · length 42 · shoulder 18" */
export function measurementText(m?: TailorMeasurement | null): string {
  if (!m) return ""
  return MEASURE_FIELDS.filter(([k]) => m[k] != null && m[k] !== ("" as never)).map(([k, label]) => `${label} ${m[k]}`).join(" · ")
}

const KPI_ICONS: [RegExp, string][] = [
  [/overdue/i, "alert-circle-outline"], [/due this week|due soon/i, "calendar-outline"], [/ready/i, "cube-outline"],
  [/deliver/i, "checkmark-done-outline"], [/dorji/i, "people-outline"], [/open|pieces|stitch/i, "cut-outline"],
  [/fabric|stock/i, "layers-outline"], [/owe|unpaid|balance|commission/i, "wallet-outline"],
  [/revenue|income|collected|sales|value/i, "trending-up-outline"], [/order/i, "bag-handle-outline"], [/average|avg/i, "bar-chart-outline"],
]

/** Ionicons glyph for a tailor KPI tile, chosen from its label (mirrors the web KpiIcon). */
export const kpiIcon = (label: string) => KPI_ICONS.find(([re]) => re.test(label))?.[1] ?? "checkmark-circle-outline"

export const TONE_COLORS: Record<string, { fg: string; bg: string }> = {
  blue: { fg: "#2563eb", bg: "#dbeafe" }, teal: { fg: "#0d9488", bg: "#ccfbf1" }, purple: { fg: "#7c3aed", bg: "#ede9fe" },
  amber: { fg: "#d97706", bg: "#fef3c7" }, red: { fg: "#dc2626", bg: "#fee2e2" }, muted: { fg: "#64748b", bg: "#f1f5f9" },
}

// ─── Print / share ───────────────────────────────────────────────────────────

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const STYLE = `body{font-family:Arial,sans-serif;color:#0E1525;margin:24px}table{width:100%;border-collapse:collapse;margin:16px 0}
th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;font-size:13px}.muted{color:#5B6478;font-size:12px}
.co{font-weight:800;font-size:18px;margin:6px 0}.meta{display:flex;gap:24px;margin:16px 0}.meta>div{flex:1}.tot{margin-left:auto;width:280px}
.t{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}.t.g{border-top:2px solid #0E1525;margin-top:6px;padding-top:6px;font-weight:800;font-size:15px}
.t.p{color:#0B5D57}.t.d{color:#B42318;font-weight:700}.foot{margin-top:32px;text-align:center;font-size:11px;color:#5B6478}
.card{border:1px solid #D5DAE5;border-radius:8px;padding:12px 16px;margin-bottom:16px;page-break-inside:avoid}h2{margin:0 0 8px;font-size:16px}`

const page = (title: string, body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`

export function jobCardHtml(o: TailorOrderDetail): string {
  const rows = o.items.map((it) => {
    const fabric = it.fabricSource === "shop" && it.fabric ? `${it.fabric.name} · ${it.fabricQuantity} ${it.fabric.unit}` : `Customer fabric${it.ownFabricNote ? ": " + it.ownFabricNote : ""}`
    const notes = [...it.styleOptions, it.notes].filter(Boolean).join(", ")
    return `<tr><td>${esc(it.productType)}</td><td>${it.quantity}</td><td>${esc(fabric)}</td><td>${esc(measurementText(it.measurement))}</td><td>${esc(notes)}</td></tr>`
  }).join("")
  return page(o.orderNumber, `<h1>Job card ${esc(o.orderNumber)}</h1><p><b>${esc(o.customer?.name)}</b> ${esc(o.customer?.phone)}<br>Order date: ${esc(fmtDate(o.orderDate))} &middot; Delivery: ${esc(fmtDate(o.deliveryDate))}${o.isUrgent ? " &middot; URGENT" : ""}<br>Dorji: ${esc(o.dorjiNames.join(", ") || "Not assigned")}<br>Status: ${esc(TAILOR_STAGE_LABEL[o.stage])}</p>` +
    `<table><thead><tr><th>Garment</th><th>Qty</th><th>Fabric</th><th>Measurements</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>` +
    (o.notes ? `<p>Order note: ${esc(o.notes)}</p>` : ""))
}

export function invoiceHtml(o: TailorOrderDetail, businessName: string, fc: Fc): string {
  const rows = o.items.map((it, n) => `<tr><td>${n + 1}</td><td>${esc(it.productType)}</td><td>${esc(it.fabricSource === "shop" && it.fabric ? it.fabric.name : "Customer fabric")}</td><td>${it.fabricSource === "shop" && it.fabric ? esc(it.fabricQuantity + " " + it.fabric.unit) : "—"}</td><td>${it.quantity}</td><td>${esc(fc(it.stitchingPrice))}</td><td><b>${esc(fc(it.lineTotal))}</b></td></tr>`).join("")
  const c = o.charges
  const line = (l: string, v: string, cls = "") => `<div class="t ${cls}"><span>${l}</span><span>${esc(v)}</span></div>`
  const stitch = c.stitching || c.stitchingOrderLevel
  const pays = o.payments.map((p) => `<div class="t"><span>${esc(fmtDate(p.paymentDate))} · ${esc(tailorPayLabel(p))} · ${esc(tailorMethodLabel(p.paymentMethod))}</span><span>${esc(fc(p.amount))}</span></div>`).join("")
  return page("Invoice " + o.orderNumber, `<h1>INVOICE</h1><div class="muted">${esc(o.orderNumber)} &middot; ${esc(TAILOR_STAGE_LABEL[o.stage])} &middot; ${esc(o.paymentStatus)}</div><div class="co">${esc(businessName || "Tailor shop")}</div>` +
    `<div class="meta"><div><div class="muted">Customer</div><b>${esc(o.customer?.name)}</b><br>${esc(o.customer?.phone)}<br>${esc(o.customer?.address ?? "")}</div><div><div class="muted">Order date</div><b>${esc(fmtDate(o.orderDate))}</b></div><div><div class="muted">Delivery date</div><b>${esc(fmtDate(o.deliveryDate))}</b></div></div>` +
    `<table><thead><tr><th>#</th><th>Garment</th><th>Fabric</th><th>Fabric qty</th><th>Pcs</th><th>Stitching</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<div class="tot">${line("Stitching", fc(stitch))}${line("Fabric", fc(c.fabric))}${c.urgent > 0 ? line("Urgent charge", fc(c.urgent)) : ""}${c.extra > 0 ? line("Extra charge", fc(c.extra)) : ""}${c.discount > 0 ? line("Discount", "- " + fc(c.discount)) : ""}` +
    `${line("Grand total", fc(c.total), "g")}${pays}${line("Paid", fc(c.paid), "p")}${c.due > 0 ? line("Due", fc(c.due), "d") : ""}</div>` +
    (o.notes ? `<p class="muted">Note: ${esc(o.notes)}</p>` : "") + `<div class="foot">Thank you for your business${businessName ? ` &middot; ${esc(businessName)}` : ""}</div>`)
}

export function assignmentCardsHtml(list: TailorAssignmentRow[], fc: Fc): string {
  const body = list.map((r) => `<div class="card"><h2>${esc(r.orderNumber ?? "—")} · ${esc(r.task ?? "")}</h2>
    <table><tr><td>Customer</td><td>${esc(r.customerName ?? "—")}</td></tr><tr><td>Dorji</td><td>${esc(r.dorjiName ?? "—")}</td></tr>
    <tr><td>Pieces</td><td>${r.pieces}</td></tr><tr><td>Given</td><td>${esc(fmtDate(r.assignedDate))}</td></tr><tr><td>Due back</td><td>${esc(fmtDate(r.dueDate))}</td></tr>
    <tr><td>Rate per piece</td><td>${esc(fc(r.ratePerPiece))}</td></tr><tr><td>Dorji charge</td><td>${esc(fc(r.dorjiCharge))}</td></tr>
    ${r.adminNotes ? `<tr><td>Notes</td><td>${esc(r.adminNotes)}</td></tr>` : ""}</table></div>`).join("")
  return page("Job cards", body)
}

/** Print an HTML document, or render it to PDF and open the share sheet. */
export async function printOrShareHtml(html: string, mode: "print" | "share", title = "Document"): Promise<void> {
  try {
    if (mode === "print") {
      await Print.printAsync({ html })
      return
    }
    const { uri } = await Print.printToFileAsync({ html })
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: title, UTI: "com.adobe.pdf" })
    } else {
      Alert.alert("Sharing unavailable", "Sharing is not available on this device.")
    }
  } catch {
    Alert.alert(mode === "print" ? "Print failed" : "Share failed", "Could not open the print / share dialog.")
  }
}

/** Action sheet: Print / Share PDF / Cancel. */
export function askPrintOrShare(title: string, makeHtml: () => string) {
  Alert.alert(title, undefined, [
    { text: "Print", onPress: () => void printOrShareHtml(makeHtml(), "print", title) },
    { text: "Share PDF", onPress: () => void printOrShareHtml(makeHtml(), "share", title) },
    { text: "Cancel", style: "cancel" },
  ])
}
