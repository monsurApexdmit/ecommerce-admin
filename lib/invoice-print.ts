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

/** English words with South Asian grouping (lakh, crore), as written on Bangladeshi invoices */
function spell(n: number): string {
  if (n === 0) return "zero"
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "")
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + spell(n % 100) : "")
  if (n < 1e5) return spell(Math.floor(n / 1e3)) + " thousand" + (n % 1e3 ? " " + spell(n % 1e3) : "")
  if (n < 1e7) return spell(Math.floor(n / 1e5)) + " lakh" + (n % 1e5 ? " " + spell(n % 1e5) : "")
  return spell(Math.floor(n / 1e7)) + " crore" + (n % 1e7 ? " " + spell(n % 1e7) : "")
}
const titleCase = (s: string) => s.replace(/(^|[\s-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())

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

/** "Three Thousand Five Taka and Ninety-Nine Paisa Only"; other currencies fall back to "… and 99/100 only" */
function amountInWords(amount: number, t: PrintT, bn: boolean, taka: boolean): string {
  const whole = Math.floor(Math.abs(amount) + 1e-9)
  const cents = Math.round((Math.abs(amount) - whole) * 100)
  const say = (n: number) => (bn ? spellBn(n) : titleCase(spell(n)))
  const words = say(whole)
  if (taka) return cents ? t("print:invoice.wordsTakaPaisa", { words, paisa: say(cents) }) : t("print:invoice.wordsTaka", { words })
  return cents
    ? t("print:invoice.wordsCents", { words, cents: String(cents).padStart(2, "0") })
    : t("print:invoice.wordsOnly", { words })
}

/** Stored method text ("cash on delivery", "bkash", "sslcommerz"…) → a clean printed label */
function methodLabel(raw: string | undefined | null, t: PrintT): string {
  const m = String(raw ?? "").trim()
  const k = m.toLowerCase().replace(/[\s_-]+/g, "")
  if (!k) return "—"
  if (k === "cod" || k === "cashondelivery") return t("print:invoice.methods.cod")
  if (k === "cash") return t("print:invoice.methods.cash")
  if (k === "card") return t("print:invoice.methods.card")
  if (k === "bank" || k === "banktransfer") return t("print:invoice.methods.bank")
  if (k === "online") return t("print:invoice.methods.online")
  const BRANDS: Record<string, string> = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay", sslcommerz: "SSLCommerz", portwallet: "PortWallet", stripe: "Stripe", paypal: "PayPal", aamarpay: "aamarPay" }
  return BRANDS[k] ?? titleCase(m.toLowerCase())
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
  const taka = /৳|tk\b|bdt/i.test(money(1))

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
  const cancelled = order.status === "Cancelled"
  // Paid comes from the payment status / paid amount; the balance is always worked out from it.
  // (Some orders store due_amount = 0 while nothing is paid, e.g. cash on delivery from the online store.)
  const markedPaid = order.paymentStatus === "paid"
  const paid = markedPaid ? total : Math.min(total, o.paidAmount != null ? num(o.paidAmount) : 0)
  const due = cancelled ? 0 : Math.max(0, total - paid)
  const payKey = cancelled ? PAY_LABEL.cancelled
    : due <= 0.009 && total > 0 ? PAY_LABEL.paid
    : order.paymentStatus === "shipping_deposit_paid" ? PAY_LABEL.shipping_deposit_paid
    : paid > 0.009 ? PAY_LABEL.partially_paid
    : order.paymentStatus === "failed" ? PAY_LABEL.failed
    : PAY_LABEL.pending
  const pay = { label: t(`print:invoice.pay.${payKey.key}`), tone: payKey.tone }
  const showLineDisc = lineDisc > 0.009
  const method = methodLabel(order.method, t)
  const isCod = /cod|cash\s*on\s*delivery/i.test(String(order.method ?? ""))

  // ---- dates ----
  const issued = new Date(order.orderTime || (o.createdAt as string) || Date.now())
  const issuedDate = issued.toLocaleDateString(localeTag(lang), { day: "numeric", month: "short", year: "numeric" })
  const issuedTime = issued.toLocaleTimeString(localeTag(lang), { hour: "numeric", minute: "2-digit" })
  const printedOn = new Date().toLocaleString(localeTag(lang), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })

  // ---- parties ----
  const customerName = order.customerName || t("print:invoice.walkIn")
  const receiver = order.shippingFullName || customerName
  const shipLines = [
    [order.shippingAddressLine1, order.shippingAddressLine2].filter(Boolean).join(", "),
    [order.shippingCity, order.shippingState, order.shippingPostalCode].filter(Boolean).join(", "),
    order.shippingCountry,
  ].filter(Boolean) as string[]
  const contact = [order.shippingPhone, order.shippingEmail].filter(Boolean) as string[]
  const billContact = [o.customerPhone || order.shippingPhone, o.customerEmail || order.shippingEmail].filter(Boolean) as string[]
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
          ? `<div class="sub">${item.bundleItems.map((bi) => `${esc(bi.productName)} &times;${bi.qtyPerBundle * item.quantity}`).join(" &middot; ")}</div>`
          : ""
        return `
        <tr>
          <td class="c-no">${i + 1}</td>
          <td>
            <div class="item-name">${esc(item.productName)}${item.bundleItems?.length ? ` <span class="tag">${esc(t("print:invoice.bundle"))}</span>` : ""}</div>
            ${variant || sku ? `<div class="sub">${[variant, sku ? t("print:invoice.sku", { sku }) : ""].filter(Boolean).map(esc).join(" &middot; ")}</div>` : ""}
            ${subs}
          </td>
          <td class="n">${item.quantity}</td>
          <td class="n">${money(itemPrice(item))}</td>
          ${showLineDisc ? `<td class="n">${itemDiscount(item) > 0 ? "&minus;" + money(itemDiscount(item)) : "&mdash;"}</td>` : ""}
          <td class="n strong">${money(itemTotal(item))}</td>
        </tr>`
      }).join("")
    : `<tr><td class="c-no">1</td><td><div class="item-name">${esc(t("print:invoice.sale", { no: order.invoiceNo }))}</div></td>
         <td class="n">1</td><td class="n">${money(total)}</td>${showLineDisc ? "<td></td>" : ""}<td class="n strong">${money(total)}</td></tr>`

  const line = (label: string, value: string, cls = "") => `<div class="t-row ${cls}"><span>${label}</span><span class="n">${value}</span></div>`
  const totals = [
    line(esc(t("print:invoice.subtotal")), money(subtotal)),
    discount > 0.009 ? line(esc(order.couponCode ? t("print:invoice.discountCode", { code: order.couponCode }) : t("print:invoice.discount")), "&minus;" + money(discount)) : "",
    tax > 0.009 || (taxRate ?? 0) > 0 ? line(esc(taxRate ? t("print:invoice.taxRate", { rate: taxRate }) : t("print:invoice.tax")), money(tax)) : "",
    delivery > 0.009 ? line(esc(t("print:invoice.delivery")), money(delivery)) : "",
  ].join("")

  const notes = [
    o.deliveryNote ? `<p><b>${esc(t("print:invoice.deliveryNote"))}</b> ${esc(o.deliveryNote)}</p>` : "",
    order.notes ? `<p>${esc(order.notes).replace(/\n/g, "<br />")}</p>` : "",
  ].join("")

  const footerMsg = getCachedReceiptPrefs()?.footer
  const taxId = seller.bin || ctx.taxId || ""
  const sellerContact = [seller.phone, seller.email, seller.website].filter(Boolean).map(esc).join(" &nbsp;&middot;&nbsp; ")
  const regs = [taxId ? esc(t("print:invoice.binVat", { value: taxId })) : "", seller.licence ? esc(t("print:invoice.tradeLicence", { value: seller.licence })) : ""].filter(Boolean).join(" &nbsp;&middot;&nbsp; ")
  const stamp = cancelled ? `<div class="stamp bad">${esc(pay.label)}</div>` : payKey.tone === "ok" ? `<div class="stamp ok">${esc(pay.label)}</div>` : ""
  const payDetail = [
    txn ? esc(t("print:invoice.txn", { value: txn })) : "",
    isCod && due > 0.009 ? esc(t("print:invoice.payOnDelivery")) : "",
    courier ? esc(t("print:invoice.courier", { value: courier })) : "",
    zone ? esc(t("print:invoice.zone", { value: zone })) : "",
  ].filter(Boolean).join("<br />")

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8" />
<title>${esc(t("print:invoice.docTitle", { no: order.invoiceNo }))} — ${esc(seller.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap" />
<style>
  /* margin 0 keeps the browser's own header/footer (date, URL, page no.) off the paper */
  @page { size: A4; margin: 0; }
  :root { --ink: #0f172a; --muted: #64748b; --line: #e2e8f0; --soft: #f8fafc; --brand: #1e3a5f; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body { font-family: Inter, "Hind Siliguri", -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: var(--ink);
    font-size: 12.5px; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html[lang="bn"] body { font-family: "Hind Siliguri", Inter, sans-serif; }
  .sheet { position: relative; width: 210mm; min-height: 297mm; margin: 0 auto; padding: 0 16mm 14mm; display: flex; flex-direction: column; }
  @media screen { body { background: #e2e8f0; padding: 24px 0; } .sheet { background: #fff; box-shadow: 0 10px 30px rgba(15,23,42,.12); } }
  .n { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
  .strong { font-weight: 600; }
  .lbl { font-size: 9.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); margin-bottom: 5px; }
  html[lang="bn"] .lbl { letter-spacing: 0; font-size: 11px; }

  .band { height: 7px; background: var(--brand); margin: 0 -16mm 12mm; }

  /* header */
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 28px; }
  .brand { display: flex; gap: 14px; align-items: center; min-width: 0; }
  .logo { width: 60px; height: 60px; object-fit: contain; flex: none; }
  .mark { width: 56px; height: 56px; border-radius: 12px; background: var(--brand); color: #fff; flex: none;
    display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; }
  .seller-name { font-size: 20px; font-weight: 800; letter-spacing: -.01em; line-height: 1.2; }
  .seller-legal { font-size: 11.5px; color: var(--muted); }
  .doc { text-align: right; flex: none; }
  .doc h1 { font-size: 32px; font-weight: 800; letter-spacing: .14em; color: var(--brand); line-height: 1; }
  html[lang="bn"] .doc h1 { letter-spacing: 0; }
  .doc .no { margin-top: 8px; font-size: 13px; font-weight: 700; }

  .seller-meta { margin-top: 12px; font-size: 11.5px; color: #334155; }
  .seller-meta .regs { color: var(--muted); margin-top: 2px; }

  /* key facts strip */
  .facts { display: grid; grid-template-columns: repeat(4, 1fr); margin-top: 18px; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .facts > div { padding: 10px 14px; border-left: 1px solid var(--line); }
  .facts > div:first-child { border-left: 0; }
  .facts .v { font-weight: 700; font-size: 13px; }
  .facts .due-v { font-size: 15px; font-weight: 800; }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; }
  .pill.ok { background: #dcfce7; color: #166534; } .pill.warn { background: #fef3c7; color: #92400e; } .pill.bad { background: #fee2e2; color: #991b1b; }

  /* parties */
  .parties { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 18px; }
  .party { background: var(--soft); border-radius: 10px; padding: 12px 14px; }
  .party .name { font-weight: 700; font-size: 13px; }
  .party .lines { color: #334155; font-size: 11.5px; }

  /* items */
  .items-wrap { position: relative; margin-top: 20px; }
  table.items { width: 100%; border-collapse: separate; border-spacing: 0; }
  .items thead th { background: var(--brand); color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    padding: 9px 12px; text-align: left; }
  html[lang="bn"] .items thead th { letter-spacing: 0; font-size: 11.5px; }
  .items thead th:first-child { border-radius: 8px 0 0 8px; } .items thead th:last-child { border-radius: 0 8px 8px 0; }
  .items thead th.n { text-align: right; }
  .items td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .items tbody tr:nth-child(even) td { background: var(--soft); }
  .items tr { page-break-inside: avoid; }
  .c-no { width: 34px; color: var(--muted); }
  .item-name { font-weight: 600; }
  .sub { font-size: 11px; color: var(--muted); }
  .tag { font-size: 9px; font-weight: 700; text-transform: uppercase; background: var(--line); padding: 1px 6px; border-radius: 4px; }
  .left { position: relative; }
  .stamp { position: absolute; right: 24px; top: 92px; transform: rotate(-12deg); border: 3px solid; border-radius: 8px;
    padding: 4px 16px; font-size: 24px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; opacity: .22; pointer-events: none; }
  .stamp.ok { color: #15803d; } .stamp.bad { color: #b91c1c; }

  /* summary */
  .summary { display: flex; justify-content: space-between; gap: 28px; margin-top: 18px; page-break-inside: avoid; }
  .left { flex: 1; min-width: 0; }
  .words { border-left: 3px solid var(--brand); background: var(--soft); padding: 9px 12px; border-radius: 0 8px 8px 0; font-weight: 600; }
  .notes { margin-top: 14px; color: #334155; font-size: 11.5px; }
  .notes p + p { margin-top: 4px; }
  .totals { width: 300px; flex: none; }
  .t-row { display: flex; justify-content: space-between; gap: 16px; padding: 5px 2px; }
  .t-row.grand { margin-top: 6px; background: var(--brand); color: #fff; border-radius: 8px; padding: 10px 12px; font-size: 15px; font-weight: 800; }
  .t-row.paid { padding-top: 8px; color: #334155; }
  .t-row.due { border-top: 1px dashed #cbd5e1; margin-top: 4px; padding-top: 8px; font-weight: 800; font-size: 13.5px; }
  .t-row.due.open { color: #b91c1c; }
  .muted { color: var(--muted); }

  /* signatures + footer */
  .grow { flex: 1; min-height: 16px; }
  .sign { display: flex; justify-content: space-between; gap: 48px; margin-top: 40px; page-break-inside: avoid; }
  .sign div { flex: 1; max-width: 220px; border-top: 1px solid #94a3b8; padding-top: 6px; font-size: 11px; color: var(--muted); text-align: center; }
  .foot { margin-top: 22px; padding-top: 12px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; font-size: 10.5px; color: var(--muted); }
  .foot .msg { font-size: 12.5px; color: var(--ink); font-weight: 700; margin-bottom: 2px; }
  .foot .printed { text-align: right; white-space: nowrap; }
</style>
</head>
<body>
<div class="sheet">
  <div class="band"></div>

  <div class="top">
    <div class="brand">
      ${seller.logoUrl ? `<img class="logo" src="${esc(seller.logoUrl)}" alt="" />` : `<div class="mark">${esc(seller.name.charAt(0).toUpperCase())}</div>`}
      <div style="min-width:0">
        <div class="seller-name">${esc(seller.name)}</div>
        ${seller.legalName ? `<div class="seller-legal">${esc(seller.legalName)}</div>` : ""}
      </div>
    </div>
    <div class="doc">
      <h1>${esc(t("print:invoice.title"))}</h1>
      <div class="no">#${esc(order.invoiceNo)}</div>
    </div>
  </div>

  ${seller.addressLines.length || sellerContact || regs ? `<div class="seller-meta">
    ${seller.addressLines.length ? `<div>${seller.addressLines.map(esc).join(", ")}</div>` : ""}
    ${sellerContact ? `<div>${sellerContact}</div>` : ""}
    ${regs ? `<div class="regs">${regs}</div>` : ""}
  </div>` : ""}

  <div class="facts">
    <div><div class="lbl">${esc(t("print:invoice.date"))}</div><div class="v">${esc(issuedDate)}</div><div class="muted">${esc(issuedTime)}</div></div>
    <div><div class="lbl">${esc(t("print:invoice.status"))}</div><div><span class="pill ${pay.tone}">${esc(pay.label)}</span></div></div>
    <div><div class="lbl">${esc(t("print:invoice.payment"))}</div><div class="v">${esc(method)}</div>${payDetail || location ? `<div class="muted">${[payDetail, location ? esc(location) : ""].filter(Boolean).join("<br />")}</div>` : ""}</div>
    <div><div class="lbl">${esc(t("print:invoice.amountDue"))}</div><div class="due-v n" style="text-align:left">${money(due)}</div></div>
  </div>

  <div class="parties">
    <div class="party">
      <div class="lbl">${esc(t("print:invoice.billTo"))}</div>
      <div class="name">${esc(customerName)}</div>
      <div class="lines">${billContact.map(esc).join("<br />") || (order.customerId ? "" : esc(t("print:invoice.pointOfSale")))}</div>
    </div>
    <div class="party">
      <div class="lbl">${esc(t("print:invoice.shipTo"))}</div>
      ${hasShipping
        ? `<div class="name">${esc(receiver)}</div><div class="lines">${[...shipLines, ...contact].map(esc).join("<br />")}</div>`
        : `<div class="lines">${esc(t("print:invoice.collected"))}</div>`}
    </div>
  </div>

  <div class="items-wrap">
    <table class="items">
      <thead>
        <tr>
          <th class="c-no">#</th>
          <th>${esc(t("print:invoice.item"))}</th>
          <th class="n">${esc(t("print:invoice.qty"))}</th>
          <th class="n">${esc(t("print:invoice.unitPrice"))}</th>
          ${showLineDisc ? `<th class="n">${esc(t("print:invoice.discount"))}</th>` : ""}
          <th class="n">${esc(t("print:invoice.amount"))}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="summary">
    <div class="left">
      ${stamp}
      <div class="lbl">${esc(t("print:invoice.amountInWords"))}</div>
      <div class="words">${esc(amountInWords(total, t, lang === "bn", taka))}</div>
      ${showLineDisc ? `<p class="sub" style="margin-top:6px">${esc(t("print:invoice.lineDiscounts", { discount: "−" + money(lineDisc), gross: money(lineGross) }))}</p>` : ""}
      ${notes ? `<div class="notes"><div class="lbl">${esc(t("print:invoice.notes"))}</div>${notes}</div>` : ""}
    </div>
    <div class="totals">
      ${totals}
      ${line(esc(t("print:invoice.total")), money(total), "grand")}
      ${line(esc(t("print:invoice.paid")), money(paid), "paid")}
      ${line(esc(t("print:invoice.balanceDue")), money(due), due > 0.009 ? "due open" : "due")}
    </div>
  </div>

  <div class="grow"></div>

  <div class="sign">
    <div>${esc(t("print:invoice.customerSignature"))}</div>
    <div>${esc(t("print:invoice.authorisedSignature"))}</div>
  </div>

  <div class="foot">
    <div>
      <div class="msg">${esc(footerMsg || t("print:invoice.thanks"))}</div>
      ${esc(t("print:invoice.policy"))}
    </div>
    <div class="printed">${esc(t("print:invoice.generated", { date: printedOn }))}</div>
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
      // wait for the logo and web fonts (Bangla glyphs) before printing, at most ~2.5 s
      const img = w.document.querySelector("img.logo") as HTMLImageElement | null
      const logo = img && !img.complete ? new Promise<void>((r) => { img.onload = img.onerror = () => r() }) : Promise.resolve()
      const fonts = w.document.fonts?.ready ?? Promise.resolve()
      const timeout = new Promise<void>((r) => w.setTimeout(r, 2500))
      void Promise.race([Promise.all([logo, fonts]), timeout]).then(() => w.setTimeout(() => w.print(), 150))
    })
}
