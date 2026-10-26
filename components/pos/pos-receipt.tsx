"use client"

import { Check } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useCompanySettings } from "@/contexts/company-settings-context"
import type { SellResponse } from "@/lib/sellsApi"
import { getCachedReceiptPrefs, loadReceiptPrefs } from "@/lib/receipt-prefs"

const esc = (v: unknown) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))

export interface ReceiptData {
    sale: SellResponse
    /** Cash handed over (cash sales); equals the total for other methods */
    received: number
    location: string
    businessName: string
    taxLabel: string
    customerPhone?: string
}

interface Props {
    receipt: ReceiptData | null
    onClose: () => void
}

/** Sale-complete receipt with Print / New sale, as in the design. */
export function PosReceipt({ receipt, onClose }: Props) {
    const { formatCurrency: fc } = useCompanySettings()
    if (!receipt) return null
    const { sale, received, location, businessName, taxLabel, customerPhone } = receipt
    const txn = sale.paymentTransactionId || ""

    const items = (sale.items ?? []).map((i: any) => ({
        qty: i.quantity ?? 1,
        name: i.productName ?? i.product_name ?? "Item",
        total: Number(i.totalPrice ?? i.total_price ?? (Number(i.unitPrice ?? i.unit_price ?? 0) * (i.quantity ?? 1))),
    }))
    const total = Number(sale.amount) || 0
    const paid = Number(sale.paidAmount) || 0
    const discount = Number(sale.discount) || 0
    const shipping = Number(sale.shippingCost) || 0
    const subtotal = items.reduce((s, i) => s + i.total, 0)
    const tax = Math.max(0, Math.round((total - subtotal + discount - shipping) * 100) / 100)
    const owing = paid < total - 0.005
    const balanceLabel = owing ? "Balance due" : "Change"
    const balance = owing ? total - paid : Math.max(0, received - total)
    const when = new Date(sale.orderTime).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })

    const print = async () => {
        const prefs = getCachedReceiptPrefs() ?? (await loadReceiptPrefs())
        const pageSize = prefs.paper === "a4" ? "A4" : `${prefs.paper}mm auto`
        const bodyWidth = prefs.paper === "a4" ? "180mm" : prefs.paper === "58" ? "50mm" : "72mm"
        const rows = items.map((i) => `<tr><td>${esc(i.qty)} × ${esc(i.name)}</td><td style="text-align:right">${esc(fc(i.total))}</td></tr>`).join("")
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(sale.invoiceNo)}</title>
<style>@page{size:${pageSize};margin:4mm}body{font-family:Arial,sans-serif;font-size:12px;color:#000;width:${bodyWidth};margin:0 auto}
h1{font-size:16px;text-align:center;margin:0 0 4px}p{margin:2px 0;text-align:center}table{width:100%;border-collapse:collapse;margin:8px 0}
td{padding:2px 0}.sep{border-top:1px dashed #000;margin:6px 0}.tot td{font-weight:700;font-size:14px}</style></head>
<body onload="window.print()"><h1>${esc(businessName || "Receipt")}</h1>
<p>Receipt ${esc(sale.invoiceNo)} · ${esc(when)}</p><p>${esc(sale.customerName)}${customerPhone ? ` · ${esc(customerPhone)}` : ""} · ${esc(location)}</p>${txn ? `<p>Txn ${esc(txn)}</p>` : ""}<div class="sep"></div>
<table>${rows}</table><div class="sep"></div>
<table><tr><td>Subtotal</td><td style="text-align:right">${esc(fc(subtotal))}</td></tr>
<tr><td>Discount${sale.couponCode ? ` (${esc(sale.couponCode)})` : ""}</td><td style="text-align:right">${esc(fc(discount))}</td></tr>
<tr><td>${esc(taxLabel)}</td><td style="text-align:right">${esc(fc(tax))}</td></tr>
<tr class="tot"><td>Total</td><td style="text-align:right">${esc(fc(total))}</td></tr>
<tr><td>Paid (${esc(sale.method)})</td><td style="text-align:right">${esc(fc(paid))}</td></tr>
<tr><td>${balanceLabel}</td><td style="text-align:right">${esc(fc(balance))}</td></tr></table>
<div class="sep"></div><p>${esc(prefs.footer || "Thank you for shopping with us.")}</p></body></html>`
        const w = window.open("", "_blank", "width=420,height=640")
        if (!w) return
        w.document.write(html)
        w.document.close()
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent showCloseButton={false} className="max-h-[92vh] gap-0 overflow-y-auto rounded-[18px] border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[400px]">
                <div className="flex flex-col items-center gap-1 border-b border-dashed border-dash-border px-6 pb-4 pt-6 text-center">
                    <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-dash-success-soft text-dash-success-fg">
                        <Check className="size-6" aria-hidden />
                    </span>
                    <DialogTitle className="font-dash-display text-xl font-bold">{businessName || "Sale complete"}</DialogTitle>
                    <DialogDescription className="text-[13px] text-dash-muted">
                        Receipt #{sale.invoiceNo} · {when}
                    </DialogDescription>
                    <p className="text-[13px] text-dash-muted">{sale.customerName}{customerPhone ? ` · ${customerPhone}` : ""} · {location}</p>
                    {txn && <p className="text-[13px] text-dash-muted">Txn {txn}</p>}
                </div>
                <div className="flex flex-col gap-1.5 border-b border-dashed border-dash-border px-6 py-4 text-sm">
                    {items.map((i, idx) => (
                        <div key={idx} className="flex justify-between gap-3">
                            <span>{i.qty} × {i.name}</span>
                            <span className="tabular-nums">{fc(i.total)}</span>
                        </div>
                    ))}
                </div>
                <div className="flex flex-col gap-1.5 px-6 py-4 text-sm tabular-nums">
                    <div className="flex justify-between"><span className="text-dash-muted">Subtotal</span><span>{fc(subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-dash-muted">Discount{sale.couponCode ? ` (${sale.couponCode})` : ""}</span><span>{discount ? `−${fc(discount)}` : fc(0)}</span></div>
                    <div className="flex justify-between"><span className="text-dash-muted">{taxLabel}</span><span>{fc(tax)}</span></div>
                    <div className="flex items-baseline justify-between border-t border-dashed border-dash-border pt-2">
                        <span className="font-bold">Total</span>
                        <span className="font-dash-display text-2xl font-bold">{fc(total)}</span>
                    </div>
                    <div className="flex justify-between"><span className="text-dash-muted">Paid ({sale.method})</span><span>{fc(paid)}</span></div>
                    <div className={`flex justify-between font-semibold ${owing ? "text-dash-danger-fg" : "text-dash-success-fg"}`}><span>{balanceLabel}</span><span>{fc(balance)}</span></div>
                    <p className="mt-2 text-center text-xs text-dash-muted">Thank you for shopping with us.</p>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-dash-border px-6 py-4">
                    <button type="button" onClick={print} className="h-12 rounded-xl border border-dash-border bg-dash-card text-sm font-semibold hover:bg-dash-neutral-soft">Print receipt</button>
                    <button type="button" onClick={onClose} className="h-12 rounded-xl bg-dash-accent text-sm font-bold text-white">New sale</button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
