import type { SellResponse, SellItem } from "@/lib/sellsApi"
import { getCachedReceiptPrefs } from "@/lib/receipt-prefs"

const SELLER = {
  name: "Admin",
  addressLines: ["59 Station Rd, Purls Bridge", "United Kingdom"],
  phone: "019 579 034",
  email: "",
}

const fmt = (val: unknown) => Number(val ?? 0).toFixed(2)
const itemPrice = (item: SellItem) => item.unit_price ?? item.unitPrice ?? item.price ?? 0
const itemTotal = (item: SellItem) => item.total_price ?? item.totalPrice ?? (itemPrice(item) * item.quantity)

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

function spell(n: number): string {
  if (n === 0) return "zero"
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "")
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + spell(n % 100) : "")
  for (const [limit, word] of [[1e9, "million"], [1e6, "thousand"]] as const) {
    const unit = limit === 1e9 ? 1e6 : 1e3
    if (n < limit) return spell(Math.floor(n / unit)) + " " + word + (n % unit ? " " + spell(n % unit) : "")
  }
  return String(n)
}

function amountInWords(amount: number): string {
  const whole = Math.floor(Math.abs(amount))
  const cents = Math.round((Math.abs(amount) - whole) * 100)
  const words = spell(whole)
  return words.charAt(0).toUpperCase() + words.slice(1) + ` and ${String(cents).padStart(2, "0")}/100`
}

interface PrintCtx {
  formatCurrency: (n: number) => string
  taxId?: string | null
}

/**
 * Opens a print window with a two-copy A4 invoice (Customer + Merchant) for a
 * sale. Shared by the Orders and Sales pages.
 */
export function printSaleInvoice(order: SellResponse, ctx: PrintCtx): void {
  const formatCurrency = ctx.formatCurrency
  const settings = { taxId: ctx.taxId ?? undefined }
    const esc = (v: unknown) =>
      String(v ?? "").replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))

    const money = (n: number) => formatCurrency(n)

    // ---- figures -------------------------------------------------------
    const shippingCost = Number(fmt(order.shippingCost))
    const discount = Number(fmt(order.discount))
    const total = Number(order.amount)
    const subtotal = total - shippingCost + discount
    const deposit = Number(order.shippingDepositAmount ?? 0)

    // Split the total so the plate can set the cents smaller, like a cheque.
    const totalWhole = Math.floor(Math.abs(total))
    const totalCents = String(Math.round((Math.abs(total) - totalWhole) * 100)).padStart(2, "0")
    // Currency symbol = whatever formatCurrency puts before the first digit.
    const currencySymbol = money(0).replace(/[\d.,\s]/g, "") || "$"

    // ---- payment state -------------------------------------------------
    const ps = order.paymentStatus ?? ""
    const paid = ps === "paid"
    const payment =
      paid ? { label: "Paid", note: "Settled in full" }
      : ps === "shipping_deposit_paid" ? { label: "Deposit", note: "Shipping deposit received" }
      : ps === "failed" || ps === "cancelled" ? { label: ps, note: "Payment unsuccessful" }
      : ps === "pending_payment" ? { label: "Pending", note: "Awaiting payment" }
      : ps ? { label: ps, note: "" }
      : null

    const issued = new Date(order.orderTime)
    const issuedDate = issued.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    const issuedTime = issued.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    const stampDate = [issued.getDate(), issued.getMonth() + 1, issued.getFullYear()]
      .map((n, i) => (i < 2 ? String(n).padStart(2, "0") : String(n)))
      .join(" &middot; ")

    // ---- billed-to -----------------------------------------------------
    const buyerName = order.shippingFullName || order.customerName || "Walk-in Customer"
    const buyerLines = [
      order.shippingAddressLine1
        ? esc(order.shippingAddressLine1) + (order.shippingAddressLine2 ? ", " + esc(order.shippingAddressLine2) : "")
        : "",
      esc([order.shippingCity, order.shippingState, order.shippingPostalCode].filter(Boolean).join(", ")),
      esc(order.shippingCountry ?? ""),
      esc(order.shippingEmail ?? ""),
      esc(order.shippingPhone ?? ""),
    ].filter(Boolean)
    const buyerSub = buyerLines.length ? buyerLines.join("<br />") : "Point of sale"

    // ---- line items (table rows) --------------------------------------
    const itemsRows = order.items?.length
      ? order.items.map((item, i) => {
          const children = item.bundleItems?.length
            ? item.bundleItems.map(bi => `
              <tr class="sub">
                <td></td>
                <td class="desc"><span class="branch">&#8627;</span>${esc(bi.productName)}</td>
                <td class="num mono">${bi.qtyPerBundle}&times;${item.quantity}</td>
                <td class="num mono">&mdash;</td>
                <td class="num mono">&mdash;</td>
              </tr>`).join("")
            : ""
          return `
            <tr>
              <td class="num mono">${String(i + 1).padStart(2, "0")}</td>
              <td class="desc">${esc(item.productName)}${item.bundleItems?.length ? '<span class="tag">Bundle</span>' : ""}</td>
              <td class="num mono">${item.quantity}</td>
              <td class="num mono">${money(itemPrice(item))}</td>
              <td class="num mono strong">${money(itemTotal(item))}</td>
            </tr>${children}`
        }).join("")
      : `
        <tr>
          <td class="num mono">01</td>
          <td class="desc">${esc(order.customerName)}</td>
          <td class="num mono">1</td>
          <td class="num mono">${money(total)}</td>
          <td class="num mono strong">${money(total)}</td>
        </tr>`

    const sumRow = (label: string, value: string, cls = "") => `
      <div class="sum-row ${cls}"><span>${label}</span><b class="mono">${value}</b></div>`

    const summaryHtml = `
      ${sumRow("Subtotal", money(subtotal))}
      ${sumRow("Shipping", money(shippingCost))}
      ${discount > 0 ? sumRow("Discount", "-" + money(discount)) : ""}
      ${deposit > 0 ? sumRow("Deposit paid", money(deposit)) : ""}
      <div class="sum-total"><span>Total</span><b class="mono">${money(total)}</b></div>
      ${deposit > 0 && order.paymentStatus === "shipping_deposit_paid"
        ? `<div class="sum-note">Remaining on delivery: ${money(total - deposit)}</div>` : ""}`

    // One invoice copy. Rendered twice (customer + merchant) on a single A4.
    const copy = (label: string) => `
      <section class="copy">
        <div class="copy-tag">${label}</div>

        <header class="head">
          <div class="issuer">
            <div class="mark">${esc(SELLER.name.charAt(0).toUpperCase())}</div>
            <div>
              <div class="name">${esc(SELLER.name)}</div>
              <div class="sub">
                ${SELLER.addressLines.map(l => esc(l)).join(" &middot; ")}
                &middot; ${esc(SELLER.phone)}${settings?.taxId ? " &middot; Tax ID " + esc(settings.taxId) : ""}
              </div>
            </div>
          </div>
          <div class="doc">
            <div class="doc-word">INVOICE</div>
            <div class="doc-no mono">#${esc(order.invoiceNo)}</div>
          </div>
        </header>

        <div class="meta">
          <div class="meta-cell">
            <span class="lbl">Bill to</span>
            <span class="val">${esc(buyerName)}</span>
            <span class="sub2">${buyerSub}</span>
          </div>
          <div class="meta-cell">
            <span class="lbl">Date</span>
            <span class="val">${esc(issuedDate)}</span>
            <span class="sub2 mono">${esc(issuedTime)}</span>
          </div>
          <div class="meta-cell">
            <span class="lbl">Payment</span>
            <span class="val">${esc(order.method)}${payment ? ` &mdash; <span class="pay ${paid ? "ok" : "warn"}">${esc(payment.label)}</span>` : ""}</span>
            ${order.paymentTransactionId ? `<span class="sub2 mono txn">Txn ${esc(order.paymentTransactionId)}</span>` : ""}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="num" style="width:32px">#</th>
              <th>Description</th>
              <th class="num" style="width:48px">Qty</th>
              <th class="num" style="width:82px">Unit</th>
              <th class="num" style="width:90px">Amount</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>

        <div class="foot">
          <div class="terms">
            <span class="lbl">Notes</span>
            Goods once sold are subject to the return policy. Thank you for your business.
          </div>
          <div class="summary">${summaryHtml}</div>
        </div>
      </section>`

    const prefs = getCachedReceiptPrefs()
    const paper = prefs?.paper ?? "a4"
    const pageCss = paper === "a4" ? "@page{size:A4;margin:10mm}" : `@page{size:${paper}mm auto;margin:3mm} .page{max-width:${paper === "58" ? 52 : 74}mm !important;zoom:.5}`
    const footerHtml = prefs?.footer ? `<p style="text-align:center;font-size:11px;margin:10px 0 0">${esc(prefs.footer)}</p>` : ""
    const printWindow = window.open("", "_blank")
    if (!printWindow) return

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Invoice ${esc(order.invoiceNo)} &mdash; ${esc(SELLER.name)}</title>
<style>
  :root{
    --ink:#111827; --muted:#6b7280; --faint:#9ca3af; --line:#e5e7eb; --line-2:#d1d5db;
    --accent:#0f766e; --accent-soft:#ccfbf1; --ok:#047857; --ok-soft:#d1fae5;
    --warn:#b45309; --warn-soft:#fef3c7;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);
    font-size:12px;line-height:1.45;background:#f3f4f6;padding:16px}
  .mono{font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1}

  /* Page = two copies stacked, cut line between */
  .page{max-width:760px;margin:0 auto;background:#fff}
  .cut{display:flex;align-items:center;gap:10px;color:var(--faint);font-size:10px;
    letter-spacing:.14em;text-transform:uppercase;padding:6px 22px}
  .cut::before,.cut::after{content:"";flex:1;border-top:1.4px dashed var(--line-2)}
  .cut svg{width:14px;height:14px}

  .copy{position:relative;padding:26px 30px 22px}
  .copy-tag{position:absolute;top:20px;right:30px;font-size:9.5px;font-weight:700;
    letter-spacing:.14em;text-transform:uppercase;color:var(--accent);
    background:var(--accent-soft);padding:3px 9px;border-radius:99px}

  /* head */
  .head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;
    padding-bottom:14px;border-bottom:2px solid var(--ink)}
  .issuer{display:flex;gap:11px;align-items:center}
  .mark{width:34px;height:34px;border-radius:8px;background:var(--accent);color:#fff;flex:none;
    display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700}
  .name{font-size:14px;font-weight:700;letter-spacing:-.01em}
  .sub{font-size:10.5px;color:var(--muted);margin-top:2px;max-width:360px}
  .doc{text-align:right;padding-right:78px}
  .doc-word{font-size:20px;font-weight:800;letter-spacing:.08em}
  .doc-no{font-size:11px;color:var(--muted);margin-top:2px}

  /* meta */
  .meta{display:grid;grid-template-columns:1.5fr 1fr 1.2fr;gap:16px;padding:12px 0 14px;
    border-bottom:1px solid var(--line)}
  .meta-cell{display:flex;flex-direction:column;min-width:0}
  .meta-cell .lbl{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-bottom:3px}
  .meta-cell .val{font-size:12.5px;font-weight:600}
  .meta-cell .sub2{font-size:10.5px;color:var(--muted);margin-top:1px;line-height:1.5}
  .txn{word-break:break-all}
  .pay{font-size:10px;font-weight:700;padding:1px 7px;border-radius:99px}
  .pay.ok{background:var(--ok-soft);color:var(--ok)}
  .pay.warn{background:var(--warn-soft);color:var(--warn)}

  /* items */
  table{width:100%;border-collapse:collapse;margin-top:2px}
  th{text-align:left;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
    color:var(--muted);padding:8px 8px;border-bottom:1px solid var(--line)}
  th.num{text-align:right}
  td{padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;vertical-align:top}
  td.num{text-align:right}
  td.desc{font-weight:500}
  td.strong{font-weight:700}
  .tag{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:3px;
    background:var(--accent-soft);color:var(--accent);font-size:9px;font-weight:700;
    letter-spacing:.06em;text-transform:uppercase}
  .sub td{padding:4px 8px;border-bottom:1px solid #fafafa}
  .sub .desc{font-weight:400;color:var(--muted);font-size:11px}
  .branch{color:var(--faint);margin-right:5px}

  /* foot: notes + summary */
  .foot{display:flex;justify-content:space-between;gap:28px;margin-top:14px}
  .terms{flex:1;font-size:10.5px;color:var(--muted);max-width:320px}
  .terms .lbl{display:block;font-size:9px;font-weight:700;letter-spacing:.1em;
    text-transform:uppercase;color:var(--faint);margin-bottom:4px}
  .summary{width:230px}
  .sum-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:var(--muted)}
  .sum-row b{color:var(--ink);font-weight:500}
  .sum-total{display:flex;justify-content:space-between;align-items:baseline;
    margin-top:6px;padding-top:9px;border-top:2px solid var(--ink)}
  .sum-total span{font-size:13px;font-weight:700}
  .sum-total b{font-size:18px;font-weight:800;letter-spacing:-.02em}
  .sum-note{margin-top:5px;font-size:10px;color:var(--warn);text-align:right}

  ${pageCss}
  @media print{
    body{background:#fff;padding:0}
    .page{max-width:none}
    .copy{page-break-inside:avoid}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }
</style>
</head>
<body>
  <div class="page">
    ${copy("Customer Copy")}
    <div class="cut" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none"><path d="M8 8 4 12l4 4M16 8l4 4-4 4M6 3l12 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Cut here
    </div>
    ${copy("Merchant Copy")}
    ${footerHtml}
  </div>
</body>
</html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.setTimeout(() => printWindow.print(), 300)
}
