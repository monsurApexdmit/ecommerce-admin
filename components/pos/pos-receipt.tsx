"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { localeTag } from "@/lib/i18n"
import { METHOD_LABEL, isPosMethod } from "@/components/pos/pos-payment"
import { WALK_IN_NAME } from "@/components/pos/pos-customer-picker"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { UserAvatar } from "@/components/common/UserAvatar"
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
    const { t, i18n } = useTranslation(["pos", "common"])
    const { formatCurrency: fc } = useCompanySettings()
    if (!receipt) return null
    const { sale, received, location, businessName, taxLabel, customerPhone } = receipt
    const txn = sale.paymentTransactionId || ""

    const items = (sale.items ?? []).map((i: any) => ({
        qty: i.quantity ?? 1,
        name: i.productName ?? i.product_name ?? t("pos:receipt.item"),
        total: Number(i.totalPrice ?? i.total_price ?? (Number(i.unitPrice ?? i.unit_price ?? 0) * (i.quantity ?? 1))),
    }))
    const total = Number(sale.amount) || 0
    const paid = Number(sale.paidAmount) || 0
    const discount = Number(sale.discount) || 0
    const shipping = Number(sale.shippingCost) || 0
    const subtotal = items.reduce((s, i) => s + i.total, 0)
    const tax = Math.max(0, Math.round((total - subtotal + discount - shipping) * 100) / 100)
    const owing = paid < total - 0.005
    const balanceLabel = owing ? t("pos:receipt.balanceDue") : t("common:money.change")
    const balance = owing ? total - paid : Math.max(0, received - total)
    const when = new Date(sale.orderTime).toLocaleString(localeTag(i18n.language), { dateStyle: "medium", timeStyle: "short" })
    // walk-in name and method codes are stored in English; show them in the staff member's language
    const customerName = !sale.customerName || sale.customerName === WALK_IN_NAME ? t("pos:walkIn") : sale.customerName
    const method = isPosMethod(sale.method) ? t(METHOD_LABEL[sale.method]) : sale.method
    const discountLabel = sale.couponCode ? t("pos:receipt.discountCode", { code: sale.couponCode }) : t("common:money.discount")
    const paidLabel = t("pos:receipt.paidWith", { method })

    const print = async () => {
        const prefs = getCachedReceiptPrefs() ?? (await loadReceiptPrefs())
        const pageSize = prefs.paper === "a4" ? "A4" : `${prefs.paper}mm auto`
        const bodyWidth = prefs.paper === "a4" ? "180mm" : prefs.paper === "58" ? "50mm" : "72mm"
        const rows = items.map((i) => `<tr><td>${esc(i.qty)} × ${esc(i.name)}</td><td style="text-align:right">${esc(fc(i.total))}</td></tr>`).join("")
        const html = `<!doctype html><html lang="${esc(i18n.language)}"><head><meta charset="utf-8"><title>${esc(t("pos:receipt.title", { no: sale.invoiceNo }))}</title>
<style>@page{size:${pageSize};margin:4mm}body{font-family:Arial,sans-serif;font-size:12px;color:#000;width:${bodyWidth};margin:0 auto}
h1{font-size:16px;text-align:center;margin:0 0 4px}p{margin:2px 0;text-align:center}table{width:100%;border-collapse:collapse;margin:8px 0}
td{padding:2px 0}.sep{border-top:1px dashed #000;margin:6px 0}.tot td{font-weight:700;font-size:14px}</style></head>
<body onload="window.print()"><h1>${esc(businessName || t("pos:receipt.receipt"))}</h1>
<p>${esc(t("pos:receipt.line", { no: sale.invoiceNo, when }))}</p><p>${esc(customerName)}${customerPhone ? ` · ${esc(customerPhone)}` : ""} · ${esc(location)}</p>${txn ? `<p>${esc(t("pos:receipt.txn", { id: txn }))}</p>` : ""}<div class="sep"></div>
<table>${rows}</table><div class="sep"></div>
<table><tr><td>${esc(t("common:money.subtotal"))}</td><td style="text-align:right">${esc(fc(subtotal))}</td></tr>
<tr><td>${esc(discountLabel)}</td><td style="text-align:right">${esc(fc(discount))}</td></tr>
<tr><td>${esc(taxLabel)}</td><td style="text-align:right">${esc(fc(tax))}</td></tr>
<tr class="tot"><td>${esc(t("common:money.total"))}</td><td style="text-align:right">${esc(fc(total))}</td></tr>
<tr><td>${esc(paidLabel)}</td><td style="text-align:right">${esc(fc(paid))}</td></tr>
<tr><td>${esc(balanceLabel)}</td><td style="text-align:right">${esc(fc(balance))}</td></tr></table>
<div class="sep"></div><p>${esc(prefs.footer || t("pos:receipt.thanks"))}</p></body></html>`
        const w = window.open("", "_blank", "width=420,height=640")
        if (!w) return
        w.document.write(html)
        w.document.close()
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent showCloseButton={false} className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-[400px]">
                <DialogHeader className="items-center gap-1 px-6 pb-4 pt-6 text-center sm:text-center">
                    <UserAvatar className="mb-1 size-12" fallback={<Check className="size-6" aria-hidden />} />
                    <DialogTitle className="text-xl">{businessName || t("pos:receipt.saleComplete")}</DialogTitle>
                    <DialogDescription>
                        {t("pos:receipt.lineHash", { no: sale.invoiceNo, when })}
                    </DialogDescription>
                    <p className="text-sm text-muted-foreground">{customerName}{customerPhone ? ` · ${customerPhone}` : ""} · {location}</p>
                    {txn && <p className="text-sm text-muted-foreground">{t("pos:receipt.txn", { id: txn })}</p>}
                </DialogHeader>
                <Separator />
                <div className="flex flex-col gap-1.5 px-6 py-4 text-sm">
                    {items.map((i, idx) => (
                        <div key={idx} className="flex justify-between gap-3">
                            <span>{i.qty} × {i.name}</span>
                            <span className="tabular-nums">{fc(i.total)}</span>
                        </div>
                    ))}
                </div>
                <Separator />
                <div className="flex flex-col gap-1.5 px-6 py-4 text-sm tabular-nums">
                    <InfoList className="gap-1.5">
                        <InfoRow label={t("common:money.subtotal")} value={<span className="font-normal">{fc(subtotal)}</span>} />
                        <InfoRow label={discountLabel} value={<span className="font-normal">{discount ? `−${fc(discount)}` : fc(0)}</span>} />
                        <InfoRow label={taxLabel} value={<span className="font-normal">{fc(tax)}</span>} />
                        <Separator />
                        <InfoRow label={<span className="font-bold text-foreground">{t("common:money.total")}</span>} value={<span className="text-2xl font-bold">{fc(total)}</span>} className="items-baseline" />
                        <InfoRow label={paidLabel} value={<span className="font-normal">{fc(paid)}</span>} />
                        <InfoRow label={<span className={cn("font-semibold", owing ? "text-destructive" : "text-foreground")}>{balanceLabel}</span>} value={<span className={cn("font-semibold", owing && "text-destructive")}>{fc(balance)}</span>} />
                    </InfoList>
                    <p className="mt-2 text-center text-xs text-muted-foreground">{t("pos:receipt.thanks")}</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-2 px-6 py-4">
                    <Button type="button" variant="outline" size="lg" onClick={print} className="min-w-0"><span className="truncate">{t("pos:receipt.print")}</span></Button>
                    <Button type="button" size="lg" onClick={onClose} className="min-w-0"><span className="truncate">{t("pos:receipt.newSale")}</span></Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
