import type { TailorMeasurement, TailorOrderDetail } from "@/lib/tailorApi"
import { createI18n, isLang, localeTag } from "@/lib/i18n"
import {
  TAILOR_NS, garmentLabel, methodLabel, payStatusLabel, stageLabel, styleLabel,
  type TailorKey, type TailorT,
} from "@/components/tailor/i18n"

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Printed text in `lng` (English when missing/unknown); a fresh instance per print, as in lib/invoice-print.ts. */
function printT(lng?: string): { t: TailorT; lang: "en" | "bn" } {
  const lang = isLang(lng) ? lng : "en"
  const t = createI18n(lang).getFixedT(lang, TAILOR_NS) as TailorT
  return { t, lang }
}

const MEASURE_FIELDS: [keyof TailorMeasurement, TailorKey][] = [
  ["chest", "tailor:measField.chest"], ["waist", "tailor:measField.waist"], ["hip", "tailor:measField.hip"],
  ["shoulder", "tailor:measField.shoulder"], ["sleeve", "tailor:measField.sleeve"], ["length", "tailor:measField.length"],
  ["neck", "tailor:measField.neck"], ["bottomLength", "tailor:measField.bottom_length"], ["inseam", "tailor:measField.inseam"],
  ["pajamaWaist", "tailor:measField.pajama_waist"], ["pajamaLength", "tailor:measField.pajama_length"],
]

/** "Chest 42 · Length 42 · Shoulder 18" in `lng`; custom field names are the owner's and stay as typed. */
export function measurementText(m?: TailorMeasurement | null, lng?: string): string {
  if (!m) return ""
  const { t } = printT(lng)
  const parts = MEASURE_FIELDS.filter(([k]) => m[k] != null && m[k] !== ("" as never)).map(([k, key]) => `${t(key)} ${m[k]}`)
  Object.entries(m.customFields ?? {}).forEach(([k, v]) => parts.push(`${k} ${v}`))
  return parts.join(" · ")
}

const fmtDate = (lang: string, d?: string | null) =>
  d ? new Date(d.length <= 10 ? d + "T00:00:00" : d).toLocaleDateString(localeTag(lang), { month: "short", day: "numeric", year: "numeric" }) : "—"

function openPrint(title: string, body: string, lang: string) {
  const w = window.open("", "_blank")
  if (!w) return false
  w.document.write(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:system-ui,"Hind Siliguri","Noto Sans Bengali",sans-serif;color:#0E1525;margin:24px;max-width:900px}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;font-size:13px}.muted{color:#5B6478;font-size:12px}.co{font-weight:800;font-size:18px;margin:6px 0}.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:16px 0}.tot{margin-left:auto;width:280px}.t{display:flex;justify-content:space-between;padding:3px 0;font-size:13px}.t.g{border-top:2px solid #0E1525;margin-top:6px;padding-top:6px;font-weight:800;font-size:15px}.t.p{color:#0B5D57}.t.d{color:#B42318;font-weight:700}.foot{margin-top:32px;text-align:center;font-size:11px;color:#5B6478}</style></head><body>${body}</body></html>`)
  w.document.close(); w.focus()
  setTimeout(() => { try { w.print() } catch { /* ignore */ } }, 200)
  return true
}

/** Job card for the workshop. `lng` = the staff member's language (English when omitted). */
export function printJobCard(o: TailorOrderDetail, lng?: string): boolean {
  const { t, lang } = printT(lng)
  const rows = o.items.map((it) => {
    const fabric = it.fabricSource === "shop" && it.fabric
      ? `${it.fabric.name} · ${it.fabricQuantity} ${it.fabric.unit}`
      : it.ownFabricNote ? t("tailor:print.customerFabricNote", { note: it.ownFabricNote }) : t("tailor:print.customerFabric")
    const notes = [...it.styleOptions.map((s) => styleLabel(t, s)), it.notes].filter(Boolean).join(", ")
    return `<tr><td>${esc(garmentLabel(t, it.productType))}</td><td>${it.quantity}</td><td>${esc(fabric)}</td><td>${esc(measurementText(it.measurement, lang))}</td><td>${esc(notes)}</td></tr>`
  }).join("")
  return openPrint(o.orderNumber,
    `<h1>${esc(t("tailor:print.jobCard", { no: o.orderNumber }))}</h1><p><b>${esc(o.customer?.name)}</b> ${esc(o.customer?.phone)}<br>` +
    `${esc(t("tailor:print.orderDate"))}: ${esc(fmtDate(lang, o.orderDate))} &middot; ${esc(t("tailor:print.delivery"))}: ${esc(fmtDate(lang, o.deliveryDate))}${o.isUrgent ? ` &middot; ${esc(t("tailor:print.urgent"))}` : ""}<br>` +
    `${esc(t("tailor:print.dorji"))}: ${esc(o.dorjiNames.join(", ") || t("tailor:print.notAssigned"))}<br>${esc(t("tailor:print.status"))}: ${esc(stageLabel(t, o.stage))}</p>` +
    `<table><thead><tr><th>${esc(t("tailor:print.garment"))}</th><th>${esc(t("tailor:print.qty"))}</th><th>${esc(t("tailor:print.fabric"))}</th><th>${esc(t("tailor:print.measurements"))}</th><th>${esc(t("tailor:print.notes"))}</th></tr></thead><tbody>${rows}</tbody></table>` +
    (o.notes ? `<p>${esc(t("tailor:print.orderNote", { note: o.notes }))}</p>` : ""),
    lang)
}

/** Customer invoice. `lng` = the staff member's language (English when omitted). */
export function printInvoice(o: TailorOrderDetail, businessName: string, fc: (n: number) => string, lng?: string): boolean {
  const { t, lang } = printT(lng)
  const shopFabric = (it: TailorOrderDetail["items"][number]) => it.fabricSource === "shop" && it.fabric
  const rows = o.items.map((it, n) => `<tr><td>${n + 1}</td><td>${esc(garmentLabel(t, it.productType))}</td><td>${esc(shopFabric(it) ? it.fabric!.name : t("tailor:print.customerFabric"))}</td><td>${shopFabric(it) ? esc(it.fabricQuantity + " " + it.fabric!.unit) : "—"}</td><td>${it.quantity}</td><td>${esc(fc(it.stitchingPrice))}</td><td><b>${esc(fc(it.lineTotal))}</b></td></tr>`).join("")
  const c = o.charges
  const line = (l: string, v: string, cls = "") => `<div class="t ${cls}"><span>${esc(l)}</span><span>${esc(v)}</span></div>`
  const stitch = c.stitching || c.stitchingOrderLevel
  const pays = o.payments.map((p) => `<div class="t"><span>${esc(fmtDate(lang, p.paymentDate))} · ${esc(methodLabel(t, p.paymentMethod))}</span><span>${esc(fc(p.amount))}</span></div>`).join("")
  return openPrint(t("tailor:print.invoiceDoc", { no: o.orderNumber }),
    `<h1>${esc(t("tailor:print.invoice"))}</h1><div class="muted">${esc(o.orderNumber)} &middot; ${esc(stageLabel(t, o.stage))} &middot; ${esc(payStatusLabel(t, o.paymentStatus))}</div><div class="co">${esc(businessName || t("tailor:print.tailorShop"))}</div>` +
    `<div class="meta"><div><div class="muted">${esc(t("tailor:print.customer"))}</div><b>${esc(o.customer?.name)}</b><br>${esc(o.customer?.phone)}<br>${esc(o.customer?.address ?? "")}</div><div><div class="muted">${esc(t("tailor:print.orderDate"))}</div><b>${esc(fmtDate(lang, o.orderDate))}</b></div><div><div class="muted">${esc(t("tailor:print.deliveryDate"))}</div><b>${esc(fmtDate(lang, o.deliveryDate))}</b></div></div>` +
    `<table><thead><tr><th>#</th><th>${esc(t("tailor:print.garment"))}</th><th>${esc(t("tailor:print.fabric"))}</th><th>${esc(t("tailor:print.fabricQty"))}</th><th>${esc(t("tailor:print.pcs"))}</th><th>${esc(t("tailor:print.stitching"))}</th><th>${esc(t("tailor:print.amount"))}</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<div class="tot">${line(t("tailor:print.stitching"), fc(stitch))}${line(t("tailor:print.fabric"), fc(c.fabric))}${c.urgent > 0 ? line(t("tailor:print.urgentCharge"), fc(c.urgent)) : ""}${c.extra > 0 ? line(t("tailor:print.extraCharge"), fc(c.extra)) : ""}${c.discount > 0 ? line(t("tailor:print.discount"), "- " + fc(c.discount)) : ""}` +
    `${line(t("tailor:print.grandTotal"), fc(c.total), "g")}${pays}${line(t("tailor:print.paid"), fc(c.paid), "p")}${c.due > 0 ? line(t("tailor:print.due"), fc(c.due), "d") : ""}</div>` +
    (o.notes ? `<p class="muted">${esc(t("tailor:print.note", { note: o.notes }))}</p>` : "") + `<div class="foot">${esc(t("tailor:print.thanks"))} &middot; ${esc(businessName)}</div>`,
    lang)
}
