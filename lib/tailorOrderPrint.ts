import { TAILOR_STAGE_LABEL, tailorMethodLabel, type TailorMeasurement, type TailorOrderDetail } from "@/lib/tailorApi"

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const MEASURE_FIELDS: [keyof TailorMeasurement, string][] = [
  ["chest", "chest"], ["waist", "waist"], ["hip", "hip"], ["shoulder", "shoulder"], ["sleeve", "sleeve"], ["length", "length"],
  ["neck", "neck"], ["bottomLength", "bottom length"], ["inseam", "inseam"], ["pajamaWaist", "pajama waist"], ["pajamaLength", "pajama length"],
]

/** "chest 42 · length 42 · shoulder 18" */
export function measurementText(m?: TailorMeasurement | null): string {
  if (!m) return ""
  const parts = MEASURE_FIELDS.filter(([k]) => m[k] != null && m[k] !== ("" as never)).map(([k, label]) => `${label} ${m[k]}`)
  Object.entries(m.customFields ?? {}).forEach(([k, v]) => parts.push(`${k} ${v}`))
  return parts.join(" · ")
}

const fmtDate = (d?: string | null) => (d ? new Date(d.length <= 10 ? d + "T00:00:00" : d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

function openPrint(title: string, body: string) {
  const w = window.open("", "_blank")
  if (!w) return false
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:system-ui,sans-serif;color:#0E1525;margin:24px;max-width:900px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;font-size:13px}.muted{color:#5B6478;font-size:12px}.co{font-weight:800;font-size:18px;margin:6px 0}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:16px 0}.tot{margin-left:auto;width:280px}.t{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}.t.g{border-top:2px solid #0E1525;margin-top:6px;padding-top:6px;font-weight:800;font-size:15px}.t.p{color:#0B5D57}.t.d{color:#B42318;font-weight:700}.foot{margin-top:32px;text-align:center;font-size:11px;color:#5B6478}</style></head><body>${body}</body></html>`)
  w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch { /* ignore */ } }, 200)
  return true
}

export function printJobCard(o: TailorOrderDetail): boolean {
  const rows = o.items.map((it) => {
    const fabric = it.fabricSource === "shop" && it.fabric ? `${it.fabric.name} · ${it.fabricQuantity} ${it.fabric.unit}` : `Customer fabric${it.ownFabricNote ? ": " + it.ownFabricNote : ""}`
    const notes = [...it.styleOptions, it.notes].filter(Boolean).join(", ")
    return `<tr><td>${esc(it.productType)}</td><td>${it.quantity}</td><td>${esc(fabric)}</td><td>${esc(measurementText(it.measurement))}</td><td>${esc(notes)}</td></tr>`
  }).join("")
  return openPrint(o.orderNumber, `<h1>Job card ${esc(o.orderNumber)}</h1><p><b>${esc(o.customer?.name)}</b> ${esc(o.customer?.phone)}<br>Order date: ${esc(fmtDate(o.orderDate))} &middot; Delivery: ${esc(fmtDate(o.deliveryDate))}${o.isUrgent ? " &middot; URGENT" : ""}<br>Dorji: ${esc(o.dorjiNames.join(", ") || "Not assigned")}<br>Status: ${esc(TAILOR_STAGE_LABEL[o.stage])}</p>` +
    `<table><thead><tr><th>Garment</th><th>Qty</th><th>Fabric</th><th>Measurements</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>` +
    (o.notes ? `<p>Order note: ${esc(o.notes)}</p>` : ""))
}

export function printInvoice(o: TailorOrderDetail, businessName: string, fc: (n: number) => string): boolean {
  const rows = o.items.map((it, n) => `<tr><td>${n + 1}</td><td>${esc(it.productType)}</td><td>${esc(it.fabricSource === "shop" && it.fabric ? it.fabric.name : "Customer fabric")}</td><td>${it.fabricSource === "shop" && it.fabric ? esc(it.fabricQuantity + " " + it.fabric.unit) : "—"}</td><td>${it.quantity}</td><td>${esc(fc(it.stitchingPrice))}</td><td><b>${esc(fc(it.lineTotal))}</b></td></tr>`).join("")
  const c = o.charges
  const line = (l: string, v: string, cls = "") => `<div class="t ${cls}"><span>${l}</span><span>${esc(v)}</span></div>`
  const stitch = c.stitching || c.stitchingOrderLevel
  const pays = o.payments.map((p) => `<div class="t"><span>${esc(fmtDate(p.paymentDate))} · ${esc(tailorMethodLabel(p.paymentMethod))}</span><span>${esc(fc(p.amount))}</span></div>`).join("")
  return openPrint("Invoice " + o.orderNumber, `<h1>INVOICE</h1><div class="muted">${esc(o.orderNumber)} &middot; ${esc(TAILOR_STAGE_LABEL[o.stage])} &middot; ${esc(o.paymentStatus)}</div><div class="co">${esc(businessName || "Tailor shop")}</div>` +
    `<div class="meta"><div><div class="muted">Customer</div><b>${esc(o.customer?.name)}</b><br>${esc(o.customer?.phone)}<br>${esc(o.customer?.address ?? "")}</div><div><div class="muted">Order date</div><b>${esc(fmtDate(o.orderDate))}</b></div><div><div class="muted">Delivery date</div><b>${esc(fmtDate(o.deliveryDate))}</b></div></div>` +
    `<table><thead><tr><th>#</th><th>Garment</th><th>Fabric</th><th>Fabric qty</th><th>Pcs</th><th>Stitching</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<div class="tot">${line("Stitching", fc(stitch))}${line("Fabric", fc(c.fabric))}${c.urgent > 0 ? line("Urgent charge", fc(c.urgent)) : ""}${c.extra > 0 ? line("Extra charge", fc(c.extra)) : ""}${c.discount > 0 ? line("Discount", "- " + fc(c.discount)) : ""}` +
    `${line("Grand total", fc(c.total), "g")}${pays}${line("Paid", fc(c.paid), "p")}${c.due > 0 ? line("Due", fc(c.due), "d") : ""}</div>` +
    (o.notes ? `<p class="muted">Note: ${esc(o.notes)}</p>` : "") + `<div class="foot">Thank you for your business &middot; ${esc(businessName)}</div>`)
}
