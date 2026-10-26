import type { ShipmentResponse } from "@/lib/shipmentsApi"
import type { SellResponse } from "@/lib/sellsApi"

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))

interface LabelOptions {
  /** Cash the courier must collect, 0 when prepaid */
  cod: number
  formatCurrency: (n: number) => string
  /** Delivery address; taken from the order when available */
  order?: Pick<SellResponse, "customerName" | "shippingFullName" | "shippingPhone" | "shippingAddressLine1" | "shippingAddressLine2" | "shippingCity" | "shippingState" | "shippingPostalCode" | "shippingCountry"> | null
}

function labelMarkup(shipment: ShipmentResponse, opts: LabelOptions): string {
  const o = opts.order
  const name = o?.shippingFullName || shipment.sell?.customerName || o?.customerName || ""
  const phone = o?.shippingPhone || shipment.sell?.customerPhone || ""
  const address = o
    ? [
        [o.shippingAddressLine1, o.shippingAddressLine2].filter(Boolean).join(", "),
        [o.shippingCity, o.shippingState, o.shippingPostalCode].filter(Boolean).join(", "),
        o.shippingCountry,
      ].filter(Boolean).join("<br>")
    : esc(shipment.sell?.area ?? "")
  return `<div class="label">
  <div class="row"><h1>${esc(shipment.carrier || "Shipment")}</h1><span>${esc(shipment.shippingMethod || "")}</span></div>
  <div class="box"><div class="muted">Tracking</div><div class="big">${esc(shipment.trackingNumber || "—")}</div></div>
  <div class="box"><div class="muted">Deliver to</div>
    <div style="font-size:18px;font-weight:700">${esc(name)}</div>
    <div>${esc(phone)}</div>
    <div style="margin-top:6px;font-size:14px">${address}</div></div>
  <div class="row"><div><div class="muted">Order</div><div>#${esc(shipment.sell?.invoiceNo ?? "")}</div></div>
    <div><div class="muted">Weight</div><div>${shipment.weight ? esc(shipment.weight) + " kg" : "—"}</div></div></div>
  ${opts.cod > 0 ? `<div class="cod">COD ${esc(opts.formatCurrency(opts.cod))}</div>` : `<div class="cod" style="font-size:18px">PREPAID</div>`}
  ${shipment.notes ? `<div style="font-size:12px">Note: ${esc(shipment.notes)}</div>` : ""}
</div>`
}

const STYLE = `<style>
  @page { size: 4in 6in; margin: 0 }
  .label { page-break-after: always; break-after: page }
  * { box-sizing: border-box }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000 }
  .label { width: 4in; height: 6in; padding: 0.25in; display: flex; flex-direction: column; gap: 10px; border: 1px solid #000 }
  .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px }
  h1 { font-size: 20px; margin: 0 }
  .muted { font-size: 11px; color: #444; text-transform: uppercase; letter-spacing: .05em }
  .box { border: 2px solid #000; padding: 8px; border-radius: 4px }
  .big { font-size: 22px; font-weight: 700; letter-spacing: .04em; word-break: break-all }
  .cod { text-align: center; border: 3px solid #000; padding: 8px; font-size: 24px; font-weight: 700 }
</style>`

function openPrint(title: string, labels: string): void {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${STYLE}</head><body onload="window.print()">${labels}</body></html>`
  const w = window.open("", "_blank", "width=480,height=720")
  if (!w) return
  w.document.write(html)
  w.document.close()
}

/** Opens a printable 4×6 shipping label for a shipment. */
export function printShippingLabel(shipment: ShipmentResponse, opts: LabelOptions): void {
  openPrint(`Label ${shipment.trackingNumber || shipment.id}`, labelMarkup(shipment, opts))
}

/** One print document with a label per page, so a single window handles a whole batch. */
export function printShippingLabels(items: { shipment: ShipmentResponse; opts: LabelOptions }[]): void {
  if (items.length === 0) return
  openPrint(`${items.length} shipping labels`, items.map((i) => labelMarkup(i.shipment, i.opts)).join(""))
}
