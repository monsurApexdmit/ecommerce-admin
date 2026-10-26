import type { SellResponse } from "@/lib/sellsApi"

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))

/** One printable packing slip per order (invoice, customer, address, items with quantities, no prices). */
export function printPackingSlips(orders: SellResponse[]): void {
  if (orders.length === 0) return
  const pages = orders.map((o) => {
    const addr = [
      [o.shippingAddressLine1, o.shippingAddressLine2].filter(Boolean).join(", "),
      [o.shippingCity, o.shippingState, o.shippingPostalCode].filter(Boolean).join(", "),
      o.shippingCountry,
    ].filter(Boolean).map(esc).join("<br>")
    const rows = (o.items ?? []).map((it, i) => `
      <tr><td class="n">${i + 1}</td><td>${esc(it.productName)}${it.bundleItems?.length ? ` <span class="m">(bundle)</span>` : ""}</td><td class="r">${it.quantity}</td></tr>`).join("")
    const totalQty = (o.items ?? []).reduce((n, it) => n + (it.quantity ?? 1), 0)
    return `<section class="pg">
      <h1>Packing slip</h1>
      <div class="m">Invoice #${esc(o.invoiceNo)} &middot; ${esc(new Date(o.orderTime).toLocaleString())}</div>
      <p><strong>${esc(o.shippingFullName || o.customerName)}</strong>
        ${o.shippingPhone ? `<br>${esc(o.shippingPhone)}` : ""}${addr ? `<br>${addr}` : ""}</p>
      <table><thead><tr><th class="n">#</th><th>Item</th><th class="r">Qty</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3" class="m">No item details</td></tr>`}</tbody>
        <tfoot><tr><td></td><td class="r">Total units</td><td class="r">${totalQty}</td></tr></tfoot></table>
      ${o.notes ? `<p class="m">Note: ${esc(o.notes)}</p>` : ""}
    </section>`
  }).join("")

  const w = window.open("", "_blank")
  if (!w) return
  w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />
<title>Packing slips</title>
<style>
  body{font-family:system-ui,Arial,sans-serif;color:#111827;margin:0}
  .pg{padding:32px;page-break-after:always;max-width:720px}
  .pg:last-child{page-break-after:auto}
  h1{font-size:22px;margin:0 0 4px}
  .m{color:#6b7280;font-size:12px}
  table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}
  th,td{border-bottom:1px solid #e5e7eb;padding:8px 6px;text-align:left}
  .r{text-align:right}.n{width:36px}
  tfoot td{font-weight:700}
</style></head><body>${pages}</body></html>`)
  w.document.close()
  w.focus()
  w.setTimeout(() => w.print(), 300)
}
