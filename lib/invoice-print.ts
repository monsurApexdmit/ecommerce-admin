import type { SellResponse, SellItem } from "@/lib/sellsApi"
import { settingsApi } from "@/lib/settingsApi"
import { saasCompanyApi } from "@/lib/saasCompanyApi"
import { getCachedReceiptPrefs } from "@/lib/receipt-prefs"
import type { TFunction } from "i18next"
import { createI18n, isLang, localeTag } from "@/lib/i18n"

/* ------------------------------------------------------------------ */
/* Seller (company) details — loaded from settings + company profile   */
/* ------------------------------------------------------------------ */

export interface InvoiceSeller {
  name: string
  legalName?: string
  logoUrl?: string
  addressLines: string[]
  phone?: string
  email?: string
  website?: string
  bin?: string
  licence?: string
}

let sellerCache: InvoiceSeller | null = null
let sellerInflight: Promise<InvoiceSeller> | null = null

/** Company details for invoices (cached; call `resetInvoiceSeller` after editing settings). */
export function loadInvoiceSeller(): Promise<InvoiceSeller> {
  if (sellerCache) return Promise.resolve(sellerCache)
  sellerInflight ??= Promise.allSettled([settingsApi.getAll(), saasCompanyApi.getProfile()])
    .then(([s, p]) => {
      const all = s.status === "fulfilled" ? (s.value as any)?.data : undefined
      const g = all?.general ?? {}
      const b = all?.business ?? {}
      const prof = p.status === "fulfilled" ? (p.value as any)?.data ?? {} : {}
      const cityLine = [prof.city, prof.state, prof.zipCode].filter(Boolean).join(", ")
      sellerCache = {
        name: b.businessName || g.storeName || prof.name || "Your business",
        legalName: g.legalName && g.legalName !== (b.businessName || g.storeName) ? g.legalName : undefined,
        logoUrl: b.logoUrl || prof.logo || undefined,
        addressLines: [prof.address || g.storeAddress, cityLine, prof.country].filter(Boolean) as string[],
        phone: g.storePhone || prof.phone || undefined,
        email: g.storeEmail || undefined,
        website: b.website || prof.website || undefined,
        bin: g.bin || undefined,
        licence: g.licence || undefined,
      }
      return sellerCache
    })
    .finally(() => { sellerInflight = null })
  return sellerInflight
}

export const resetInvoiceSeller = () => { sellerCache = null }

if (typeof window !== "undefined") {
  window.addEventListener("receipt-prefs-stale", resetInvoiceSeller)
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const num = (v: unknown) => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const itemPrice = (item: SellItem) => num(item.unit_price ?? item.unitPrice ?? item.price)
const itemDiscount = (item: SellItem) => num(item.discount)
const itemTotal = (item: SellItem) =>
  num(item.total_price ?? item.totalPrice ?? itemPrice(item) * item.quantity - itemDiscount(item))

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]

function spell(n: number): string {
  if (n === 0) return "zero"
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "")
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + spell(n % 100) : "")
  if (n < 1e6) return spell(Math.floor(n / 1e3)) + " thousand" + (n % 1e3 ? " " + spell(n % 1e3) : "")
  if (n < 1e9) return spell(Math.floor(n / 1e6)) + " million" + (n % 1e6 ? " " + spell(n % 1e6) : "")
  return String(n)
}

// Bangla number words 0–99 (irregular), then শত / হাজার / লক্ষ / কোটি (South Asian grouping)
const BN_0_99 = ("শূন্য এক দুই তিন চার পাঁচ ছয় সাত আট নয় দশ এগারো বারো তেরো চৌদ্দ পনেরো ষোলো সতেরো আঠারো উনিশ " +
  "বিশ একুশ বাইশ তেইশ চব্বিশ পঁচিশ ছাব্বিশ সাতাশ আঠাশ উনত্রিশ ত্রিশ একত্রিশ বত্রিশ তেত্রিশ চৌত্রিশ পঁয়ত্রিশ ছত্রিশ সাঁইত্রিশ আটত্রিশ উনচল্লিশ " +
  "চল্লিশ একচল্লিশ বিয়াল্লিশ তেতাল্লিশ চুয়াল্লিশ পঁয়তাল্লিশ ছেচল্লিশ সাতচল্লিশ আটচল্লিশ উনপঞ্চাশ পঞ্চাশ একান্ন বাহান্ন তিপ্পান্ন চুয়ান্ন পঞ্চান্ন ছাপ্পান্ন সাতান্ন আটান্ন উনষাট " +
  "ষাট একষট্টি বাষট্টি তেষট্টি চৌষট্টি পঁয়ষট্টি ছেষট্টি সাতষট্টি আটষট্টি উনসত্তর সত্তর একাত্তর বাহাত্তর তিয়াত্তর চুয়াত্তর পঁচাত্তর ছিয়াত্তর সাতাত্তর আটাত্তর উনআশি " +
  "আশি একাশি বিরাশি তিরাশি চুরাশি পঁচাশি ছিয়াশি সাতাশি আটাশি উননব্বই নব্বই একানব্বই বিরানব্বই তিরানব্বই চুরানব্বই পঁচানব্বই ছিয়ানব্বই সাতানব্বই আটানব্বই নিরানব্বই").split(" ")

function spellBn(n: number): string {
  if (n < 100) return BN_0_99[n]
  const parts: string[] = []
  const unit = (div: number, word: string) => {
    const q = Math.floor(n / div)
    if (q) { parts.push(`${div === 1e7 ? spellBn(q) : BN_0_99[q]} ${word}`); n %= div }
  }
  unit(1e7, "কোটি"); unit(1e5, "লক্ষ"); unit(1e3, "হাজার"); unit(100, "শত")
  if (n) parts.push(BN_0_99[n])
  return parts.join(" ")
}

type PrintT = TFunction<["print", "common"]>

function amountInWords(amount: number, t: PrintT, bn: boolean): string {
  const whole = Math.floor(Math.abs(amount))
  const cents = Math.round((Math.abs(amount) - whole) * 100)
  const raw = bn ? spellBn(whole) : spell(whole)
  const words = bn ? raw : raw.charAt(0).toUpperCase() + raw.slice(1)
  return cents
    ? t("print:invoice.wordsCents", { words, cents: String(cents).padStart(2, "0") })
    : t("print:invoice.wordsOnly", { words })
}

type PayKey = "paid" | "partial" | "unpaid" | "deposit" | "failed" | "cancelled"
const PAY_LABEL: Record<string, { key: PayKey; tone: "ok" | "warn" | "bad" }> = {
  paid: { key: "paid", tone: "ok" },
  partially_paid: { key: "partial", tone: "warn" },
  partial: { key: "partial", tone: "warn" },
  pending: { key: "unpaid", tone: "warn" },
  pending_payment: { key: "unpaid", tone: "warn" },
  shipping_deposit_paid: { key: "deposit", tone: "warn" },
  failed: { key: "failed", tone: "bad" },
  cancelled: { key: "cancelled", tone: "bad" },
}

/** Printed labels in `lng` (English when missing/unknown); a fresh instance per print. */
function printT(lng?: string): { t: PrintT; lang: "en" | "bn" } {
  const lang = isLang(lng) ? lng : "en"
  const t: PrintT = createI18n(lang).getFixedT(lang, ["print", "common"])
  return { t, lang }
}

interface PrintCtx {
  formatCurrency: (n: number) => string
  taxId?: string | null
}

/* ------------------------------------------------------------------ */
/* Invoice HTML                                                         */
/* ------------------------------------------------------------------ */

function invoiceHtml(order: SellResponse, ctx: PrintCtx, seller: InvoiceSeller, t: PrintT, lang: "en" | "bn"): string {
  const money = (n: number) => ctx.formatCurrency(n)
  const o = order as SellResponse & Record<string, any>
  const items = order.items ?? []

  // ---- figures: total = lines − order discount + tax + delivery ----
  const lineGross = items.reduce((s, it) => s + itemPrice(it) * it.quantity, 0)
  const lineDisc = items.reduce((s, it) => s + itemDiscount(it), 0)
  const subtotal = items.length ? items.reduce((s, it) => s + itemTotal(it), 0) : num(order.amount)
  const discount = num(order.discount)
  const delivery = num(order.shippingCost)
  const total = num(order.amount)
  const storedTax = o.taxAmount != null ? num(o.taxAmount) : null
  const derivedTax = Math.max(0, total - (subtotal - discount + delivery))
  const tax = storedTax ?? (derivedTax > 0.009 ? derivedTax : 0)
  const taxRate = o.taxRate != null ? num(o.taxRate) : null
  const paid = o.paidAmount != null ? num(o.paidAmount) : (order.paymentStatus === "paid" ? total : 0)
  const due = o.dueAmount != null ? num(o.dueAmount) : Math.max(0, total - paid)
  const cancelled = order.status === "Cancelled"
  const payKey = cancelled ? PAY_LABEL.cancelled
    : due <= 0.009 && total > 0 ? PAY_LABEL.paid
    : PAY_LABEL[order.paymentStatus ?? ""] ?? (paid > 0 ? PAY_LABEL.partially_paid : PAY_LABEL.pending)
  const pay = { label: t(`print:invoice.pay.${payKey.key}`), tone: payKey.tone }
  const showLineDisc = lineDisc > 0.009

  // ---- dates ----
  const issued = new Date(order.orderTime || (o.createdAt as string) || Date.now())
  const issuedDate = issued.toLocaleDateString(localeTag(lang), { day: "numeric", month: "short", year: "numeric" })
  const issuedTime = issued.toLocaleTimeString(localeTag(lang), { hour: "numeric", minute: "2-digit" })

  // ---- parties ----
  const customerName = order.customerName || t("print:invoice.walkIn")
  const receiver = order.shippingFullName || customerName
  const shipLines = [
    [order.shippingAddressLine1, order.shippingAddressLine2].filter(Boolean).join(", "),
    [order.shippingCity, order.shippingState, order.shippingPostalCode].filter(Boolean).join(", "),
    order.shippingCountry,
  ].filter(Boolean) as string[]
  const contact = [order.shippingPhone, order.shippingEmail].filter(Boolean) as string[]
  const hasShipping = shipLines.length > 0
  const courier = o.courier || o.carrier
  const zone = o.zoneName
  const txn = o.transactionId || order.paymentTransactionId
  const location = o.locationName

  // ---- line items ----
  const rows = items.length
    ? items.map((item, i) => {
        const variant = (item as any).variantName || (item as any).variant_name
        const sku = (item as any).sku
        const subs = item.bundleItems?.length
          ? `<div class="bundle">${item.bundleItems.map((bi) => `${esc(bi.productName)} &times;${bi.qtyPerBundle * item.quantity}`).join(" &middot; ")}</div>`
          : ""
        return `
        <tr>
          <td class="c-no">${i + 1}</td>
          <td class="c-item">
            <div class="item-name">${esc(item.productName)}${item.bundleItems?.length ? ` <span class="tag">${esc(t("print:invoice.bundle"))}</span>` : ""}</div>
            ${variant || sku ? `<div class="item-sub">${[variant, sku ? t("print:invoice.sku", { sku }) : ""].filter(Boolean).map(esc).join(" &middot; ")}</div>` : ""}
            ${subs}
          </td>
          <td class="c-num">${item.quantity}</td>
          <td class="c-num">${money(itemPrice(item))}</td>
          ${showLineDisc ? `<td class="c-num">${itemDiscount(item) > 0 ? "&minus;" + money(itemDiscount(item)) : "&mdash;"}</td>` : ""}
          <td class="c-num c-amt">${money(itemTotal(item))}</td>
        </tr>`
      }).join("")
    : `<tr><td class="c-no">1</td><td class="c-item"><div class="item-name">${esc(t("print:invoice.sale", { no: order.invoiceNo }))}</div></td>
         <td class="c-num">1</td><td class="c-num">${money(total)}</td>${showLineDisc ? "<td></td>" : ""}<td class="c-num c-amt">${money(total)}</td></tr>`

  const totalRow = (label: string, value: string, cls = "") =>
    `<tr class="${cls}"><td>${label}</td><td class="c-num">${value}</td></tr>`

  const totals = [
    totalRow(esc(t("print:invoice.subtotal")), money(subtotal)),
    discount > 0.009 ? totalRow(esc(order.couponCode ? t("print:invoice.discountCode", { code: order.couponCode }) : t("print:invoice.discount")), "&minus;" + money(discount)) : "",
    tax > 0.009 || (taxRate ?? 0) > 0 ? totalRow(esc(taxRate ? t("print:invoice.taxRate", { rate: taxRate }) : t("print:invoice.tax")), money(tax)) : "",
    delivery > 0.009 ? totalRow(esc(t("print:invoice.delivery")), money(delivery)) : "",
    totalRow(esc(t("print:invoice.total")), money(total), "grand"),
    totalRow(esc(t("print:invoice.paid")), money(paid)),
    totalRow(esc(t("print:invoice.balanceDue")), money(due), due > 0.009 ? "due" : "due settled"),
  ].join("")

  const notes = [
    o.deliveryNote ? `<p><b>${esc(t("print:invoice.deliveryNote"))}</b> ${esc(o.deliveryNote)}</p>` : "",
    order.notes ? `<p>${esc(order.notes).replace(/\n/g, "<br />")}</p>` : "",
  ].join("")

  const footerMsg = getCachedReceiptPrefs()?.footer
  const taxId = seller.bin || ctx.taxId || ""
  const sellerInfo = [
    ...seller.addressLines.map(esc),
    [seller.phone, seller.email].filter(Boolean).map(esc).join(" &middot; "),
    seller.website ? esc(seller.website) : "",
  ].filter(Boolean).join("<br />")
  const regs = [taxId ? esc(t("print:invoice.binVat", { value: taxId })) : "", seller.licence ? esc(t("print:invoice.tradeLicence", { value: seller.licence })) : ""].filter(Boolean).join(" &middot; ")

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<title>${esc(t("print:invoice.docTitle", { no: order.invoiceNo }))} — ${esc(seller.name)}</title>
<style>
  @page { size: A4; margin: 14mm 14mm 16mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827;
    font-size: 12px; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { width: 100%; max-width: 182mm; margin: 0 auto; }
  @media screen { body { background: #f3f4f6; padding: 24px 0; } .sheet { background: #fff; padding: 14mm; box-shadow: 0 1px 4px rgba(0,0,0,.12); } }
  .num, .c-num { font-variant-numeric: tabular-nums; }

  /* header */
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .brand { display: flex; gap: 12px; align-items: flex-start; max-width: 60%; }
  .logo { width: 52px; height: 52px; object-fit: contain; flex: none; }
  .mark { width: 52px; height: 52px; border-radius: 10px; background: #111827; color: #fff; flex: none;
    display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; }
  .seller-name { font-size: 17px; font-weight: 700; line-height: 1.2; }
  .seller-legal { font-size: 11px; color: #4b5563; }
  .seller-info { font-size: 11px; color: #4b5563; margin-top: 4px; }
  .regs { font-size: 10.5px; color: #4b5563; margin-top: 3px; }
  .doc { text-align: right; }
  .doc h1 { font-size: 28px; font-weight: 800; letter-spacing: .06em; line-height: 1; }
  .doc table { margin: 10px 0 0 auto; border-collapse: collapse; font-size: 11.5px; }
  .doc td { padding: 1px 0 1px 14px; text-align: right; }
  .doc td:first-child { color: #6b7280; }
  .doc td:last-child { font-weight: 600; }
  .pill { display: inline-block; padding: 1px 8px; border-radius: 99px; font-size: 10.5px; font-weight: 700; }
  .pill.ok { background: #dcfce7; color: #166534; } .pill.warn { background: #fef3c7; color: #92400e; } .pill.bad { background: #fee2e2; color: #991b1b; }
  hr { border: 0; border-top: 2px solid #111827; margin: 16px 0 14px; }

  /* parties */
  .parties { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .party .lbl, .lbl { font-size: 9.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
  .party .name { font-weight: 700; font-size: 12.5px; }
  .party .lines { color: #374151; font-size: 11.5px; }

  /* items */
  table.items { width: 100%; border-collapse: collapse; margin-top: 18px; }
  .items thead th { background: #f3f4f6; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: #374151; padding: 8px 10px; text-align: left; border-top: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; }
  .items th.c-num, .items td.c-num { text-align: right; white-space: nowrap; }
  .items td { padding: 9px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .items tr { page-break-inside: avoid; }
  .c-no { width: 30px; color: #6b7280; }
  .item-name { font-weight: 600; }
  .item-sub, .bundle { font-size: 10.5px; color: #6b7280; }
  .c-amt { font-weight: 600; }
  .tag { font-size: 9px; font-weight: 700; text-transform: uppercase; background: #e5e7eb; padding: 1px 5px; border-radius: 3px; }

  /* totals */
  .bottom { display: flex; justify-content: space-between; gap: 28px; margin-top: 16px; page-break-inside: avoid; }
  .words { flex: 1; font-size: 11.5px; }
  .words p { margin-bottom: 8px; color: #374151; }
  table.totals { width: 270px; border-collapse: collapse; font-size: 12px; }
  .totals td { padding: 5px 0; }
  .totals td.c-num { text-align: right; }
  .totals tr.grand td { border-top: 2px solid #111827; padding-top: 8px; font-size: 15px; font-weight: 800; }
  .totals tr.due td { border-top: 1px solid #d1d5db; font-weight: 700; }
  .totals tr.due:not(.settled) td { color: #b91c1c; }

  /* signatures + footer */
  .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 56px; page-break-inside: avoid; }
  .sign div { flex: 1; max-width: 220px; border-top: 1px solid #6b7280; padding-top: 6px; font-size: 11px; color: #4b5563; text-align: center; }
  .foot { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10.5px; color: #6b7280; }
  .foot .msg { font-size: 12px; color: #111827; font-weight: 600; margin-bottom: 2px; }
</style>
</head>
<body>
<div class="sheet">
  <div class="top">
    <div class="brand">
      ${seller.logoUrl ? `<img class="logo" src="${esc(seller.logoUrl)}" alt="" />` : `<div class="mark">${esc(seller.name.charAt(0).toUpperCase())}</div>`}
      <div>
        <div class="seller-name">${esc(seller.name)}</div>
        ${seller.legalName ? `<div class="seller-legal">${esc(seller.legalName)}</div>` : ""}
        ${sellerInfo ? `<div class="seller-info">${sellerInfo}</div>` : ""}
        ${regs ? `<div class="regs">${regs}</div>` : ""}
      </div>
    </div>
    <div class="doc">
      <h1>${esc(t("print:invoice.title"))}</h1>
      <table>
        <tr><td>${esc(t("print:invoice.invoiceNo"))}</td><td>${esc(order.invoiceNo)}</td></tr>
        <tr><td>${esc(t("print:invoice.date"))}</td><td>${esc(issuedDate)}, ${esc(issuedTime)}</td></tr>
        <tr><td>${esc(t("print:invoice.status"))}</td><td><span class="pill ${pay.tone}">${esc(pay.label)}</span></td></tr>
        ${location ? `<tr><td>${esc(t("print:invoice.location"))}</td><td>${esc(location)}</td></tr>` : ""}
      </table>
    </div>
  </div>

  <hr />

  <div class="parties">
    <div class="party">
      <div class="lbl">${esc(t("print:invoice.billTo"))}</div>
      <div class="name">${esc(customerName)}</div>
      <div class="lines">${[...(hasShipping ? [] : contact)].map(esc).join("<br />") || (order.customerId ? "" : esc(t("print:invoice.pointOfSale")))}</div>
    </div>
    <div class="party">
      <div class="lbl">${esc(t("print:invoice.shipTo"))}</div>
      ${hasShipping
        ? `<div class="name">${esc(receiver)}</div><div class="lines">${[...shipLines, ...contact].map(esc).join("<br />")}</div>`
        : `<div class="lines">${esc(t("print:invoice.collected"))}</div>`}
    </div>
    <div class="party">
      <div class="lbl">${esc(t("print:invoice.payment"))}</div>
      <div class="name">${esc(order.method || "—")}</div>
      <div class="lines">${[txn ? esc(t("print:invoice.txn", { value: txn })) : "", courier ? esc(t("print:invoice.courier", { value: courier })) : "", zone ? esc(t("print:invoice.zone", { value: zone })) : ""].filter(Boolean).join("<br />")}</div>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="c-no">#</th>
        <th>${esc(t("print:invoice.item"))}</th>
        <th class="c-num">${esc(t("print:invoice.qty"))}</th>
        <th class="c-num">${esc(t("print:invoice.unitPrice"))}</th>
        ${showLineDisc ? `<th class="c-num">${esc(t("print:invoice.discount"))}</th>` : ""}
        <th class="c-num">${esc(t("print:invoice.amount"))}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="bottom">
    <div class="words">
      <div class="lbl">${esc(t("print:invoice.amountInWords"))}</div>
      <p>${esc(amountInWords(total, t, lang === "bn"))}</p>
      ${notes ? `<div class="lbl">${esc(t("print:invoice.notes"))}</div>${notes}` : ""}
      ${showLineDisc ? `<p class="item-sub">${esc(t("print:invoice.lineDiscounts", { discount: "\u2212" + money(lineDisc), gross: money(lineGross) }))}</p>` : ""}
    </div>
    <table class="totals">${totals}</table>
  </div>

  <div class="sign">
    <div>${esc(t("print:invoice.customerSignature"))}</div>
    <div>${esc(t("print:invoice.authorisedSignature"))}</div>
  </div>

  <div class="foot">
    <div class="msg">${esc(footerMsg || t("print:invoice.thanks"))}</div>
    ${esc(t("print:invoice.policy"))}
  </div>
</div>
</body>
</html>`
}

/**
 * Opens a print window with a standard single-copy A4 invoice for a sale.
 * Shared by the Orders and Sales pages and the New sale form.
 * The window opens immediately (so popup blockers allow it), then fills in once
 * the company details are loaded (cached after the first print).
 * `lng` ("en" | "bn", e.g. the caller's `i18n.language`) sets the printed labels; English when omitted.
 */
export function printSaleInvoice(order: SellResponse, ctx: PrintCtx, lng?: string): void {
  const { t, lang } = printT(lng)
  const w = window.open("", "_blank")
  if (!w) return
  w.document.write(`<!DOCTYPE html><title>${esc(t("print:invoice.docTitle", { no: order.invoiceNo }))}</title><p style="font-family:sans-serif;padding:24px;color:#6b7280">${esc(t("print:invoice.preparing"))}</p>`)

  void loadInvoiceSeller()
    .catch((): InvoiceSeller => ({ name: t("print:invoice.yourBusiness"), addressLines: [] }))
    .then((seller) => {
      w.document.open()
      w.document.write(invoiceHtml(order, ctx, seller, t, lang))
      w.document.close()
      w.focus()
      // wait for the logo before printing so it isn't missing on paper
      const img = w.document.querySelector("img.logo") as HTMLImageElement | null
      const go = () => w.setTimeout(() => w.print(), 150)
      if (img && !img.complete) { img.onload = go; img.onerror = go } else go()
    })
}
