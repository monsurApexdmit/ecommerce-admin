"use client"

import { useEffect, useState } from "react"
import { Check, Printer, Clock } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { UserAvatar } from "@/components/common/UserAvatar"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { settingsApi } from "@/lib/settingsApi"

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface SuccessModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  formatCurrency?: (amount: number) => string
  taxLabel?: string
  orderDetails?: {
    cart: CartItem[]
    subtotal: number
    tax: number
    discount: number
    total: number
    customer: string
    invoiceNo?: string
  }
}

interface StoreInfo {
  storeName: string
  storePhone: string
  storeAddress: string
}

export function SuccessModal({ open, onOpenChange, onClose, orderDetails, formatCurrency: fmt, taxLabel }: SuccessModalProps) {
  const { formatCurrency: companyFormatCurrency } = useCompanySettings()
  const formatCurrency = fmt ?? companyFormatCurrency
  const taxLabelText = taxLabel ?? "Tax"
  const [storeInfo, setStoreInfo] = useState<StoreInfo>({ storeName: "", storePhone: "", storeAddress: "" })

  useEffect(() => {
    settingsApi.getAll().then(res => {
      const g = res.data?.general ?? {}
      setStoreInfo({
        storeName: g.storeName ?? "",
        storePhone: g.storePhone ?? "",
        storeAddress: g.storeAddress ?? "",
      })
    }).catch(() => {})
  }, [])

  const handlePrint = () => {
    if (!orderDetails) return
    const printWindow = window.open('', '_blank', 'height=600,width=800')
    if (!printWindow) { alert("Please allow popups to print the invoice."); return }
    const html = `<html><head><title>Receipt</title><meta name="viewport" content="width=80mm"><style>
      /* 80mm thermal roll. size:80mm auto keeps the sheet as tall as the
         content (no blank A4 page). Real thermal printers honour this; if a
         browser preview still shows A4, pick the 80mm/Roll paper in the dialog. */
      @page{size:80mm auto;margin:0}
      *{box-sizing:border-box}
      html,body{width:80mm;margin:0;padding:0;background:#fff}
      body{font-family:'Courier New',ui-monospace,monospace;padding:3mm 4mm;color:#000;font-size:11px;line-height:1.35}
      .header{text-align:center;margin-bottom:6px;border-bottom:1px dashed #000;padding-bottom:6px}
      .store-name{font-size:14px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
      .meta{font-size:9px;margin-top:1px}
      .divider{border:none;border-top:1px dashed #000;margin:5px 0}
      .item-row{display:flex;justify-content:space-between;gap:6px;margin-bottom:1px;font-size:10px}
      .item-name{font-weight:bold;font-size:11px;margin-bottom:1px;word-break:break-word}
      .summary-row{display:flex;justify-content:space-between;margin-bottom:1px;font-size:10px}
      .total-row{display:flex;justify-content:space-between;font-size:13px;font-weight:bold;margin-top:5px;border-top:1px dashed #000;padding-top:5px}
      .footer{text-align:center;margin-top:8px;font-size:9px;border-top:1px dashed #000;padding-top:5px}
      @media print{
        html,body{width:80mm}
        body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      }
    </style></head><body>
      <div class="header">
        <div class="store-name">${storeInfo.storeName || "Store"}</div>
        ${storeInfo.storeAddress ? `<div class="meta">${storeInfo.storeAddress}</div>` : ''}
        ${storeInfo.storePhone ? `<div class="meta">Tel: ${storeInfo.storePhone}</div>` : ''}
        <div class="meta">Date: ${new Date().toLocaleString()}</div>
        ${orderDetails.invoiceNo ? `<div class="meta">Invoice: ${orderDetails.invoiceNo}</div>` : ''}
        ${orderDetails.customer ? `<div class="meta">Customer: ${orderDetails.customer}</div>` : ''}
      </div>
      <div class="items">
        ${orderDetails.cart.map(item => `
          <div class="item-name">${item.name}</div>
          <div class="item-row">
            <span>${item.quantity} x ${formatCurrency(item.price)}</span>
            <span><b>${formatCurrency(item.price * item.quantity)}</b></span>
          </div>`).join('')}
      </div>
      <div class="divider"></div>
      <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(orderDetails.subtotal)}</span></div>
      <div class="summary-row"><span>${taxLabelText}</span><span>${formatCurrency(orderDetails.tax)}</span></div>
      ${orderDetails.discount > 0 ? `<div class="summary-row"><span>Discount</span><span>-${formatCurrency(orderDetails.discount)}</span></div>` : ''}
      <div class="total-row"><span>Total</span><span>${formatCurrency(orderDetails.total)}</span></div>
      <div class="footer"><p>Thank you for shopping!</p><p style="margin-top:5px">Return Policy: 7 days with receipt</p></div>
    </body></html>`
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close() }, 250)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:text-center">
          <UserAvatar className="mb-2 size-16 animate-in zoom-in duration-500" fallback={<Check className="size-8" strokeWidth={2.5} />} />
          <DialogTitle className="text-2xl">Order Confirmed!</DialogTitle>
          <DialogDescription>Your payment has been processed successfully</DialogDescription>
        </DialogHeader>

        {/* Invoice and Details */}
        <div className="space-y-5">
          {/* Invoice Badge */}
          {orderDetails?.invoiceNo && (
            <div className="flex justify-center">
              <Badge variant="secondary">
                Invoice #<span className="font-mono">{orderDetails.invoiceNo}</span>
              </Badge>
            </div>
          )}

          {/* Order Summary Card */}
          {orderDetails && (
            <Card className="p-4">
              <InfoList className="gap-3">
                {/* Customer */}
                {orderDetails.customer && <InfoRow label="Customer" value={orderDetails.customer} className="items-center" />}

                {/* Items Count */}
                <InfoRow label="Items" value={`${orderDetails.cart.length} item${orderDetails.cart.length !== 1 ? 's' : ''}`} className="items-center" />

                {/* Order Time */}
                <InfoRow
                  label={<span className="flex items-center gap-2"><Clock className="size-4" />Ordered</span>}
                  value={<span className="text-xs">{new Date().toLocaleTimeString()}</span>}
                  className="items-center"
                />
              </InfoList>
            </Card>
          )}

          {/* Price Breakdown */}
          {orderDetails && (
            <Card className="p-4">
              <InfoList>
                <InfoRow label="Subtotal" value={<span className="font-normal">{formatCurrency(orderDetails.subtotal)}</span>} />
                <InfoRow label={taxLabelText} value={<span className="font-normal">{formatCurrency(orderDetails.tax)}</span>} />
                {orderDetails.discount > 0 && (
                  <InfoRow label="Discount" value={`-${formatCurrency(orderDetails.discount)}`} />
                )}
                <Separator />
                <InfoRow label={<span className="font-bold text-foreground">Total Amount</span>} value={<span className="text-2xl font-bold">{formatCurrency(orderDetails.total)}</span>} className="items-center" />
              </InfoList>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            {orderDetails && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={handlePrint}
              >
                <Printer />
                Print Receipt
              </Button>
            )}
            <Button
              size="lg"
              className="w-full"
              onClick={onClose}
            >
              Complete & Start New Order
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
