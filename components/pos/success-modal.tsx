"use client"

import { useEffect, useState } from "react"
import { Check, Printer, Gift, Clock } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
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
    const html = `<html><head><title>Receipt</title><style>
      @page{size:80mm auto;margin:4mm 0}
      *{box-sizing:border-box}
      body{font-family:'Courier New',monospace;width:80mm;max-width:80mm;margin:0 auto;padding:4mm 5mm;color:#000;font-size:11px;line-height:1.4}
      .header{text-align:center;margin-bottom:8px;border-bottom:1px dashed #000;padding-bottom:8px}
      .store-name{font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}
      .meta{font-size:9px;margin-top:2px}
      .divider{border:none;border-top:1px dashed #000;margin:6px 0}
      .item-row{display:flex;justify-content:space-between;margin-bottom:2px;font-size:10px}
      .item-name{font-weight:bold;font-size:11px;margin-bottom:1px}
      .summary-row{display:flex;justify-content:space-between;margin-bottom:2px;font-size:10px}
      .total-row{display:flex;justify-content:space-between;font-size:13px;font-weight:bold;margin-top:6px;border-top:1px dashed #000;padding-top:6px}
      .footer{text-align:center;margin-top:10px;font-size:9px;border-top:1px dashed #000;padding-top:6px}
      @media print{@page{size:80mm auto;margin:4mm 0}body{width:80mm}}
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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <VisuallyHidden asChild>
          <DialogTitle>Order Confirmed</DialogTitle>
        </VisuallyHidden>
        {/* Success Header with Gradient */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 pt-8 pb-6 px-6 text-center relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <Gift className="absolute top-2 left-4 w-8 h-8 text-white rotate-12" />
            <Gift className="absolute bottom-2 right-4 w-8 h-8 text-white -rotate-12" />
          </div>

          {/* Animated checkmark */}
          <div className="relative z-10 flex justify-center mb-4">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
              <Check className="w-11 h-11 text-white" strokeWidth={2.5} />
            </div>
          </div>

          <h2 className="text-3xl font-black text-white mb-1">Order Confirmed!</h2>
          <p className="text-emerald-100 text-sm">Your payment has been processed successfully</p>
        </div>

        {/* Invoice and Details */}
        <div className="px-6 py-6 space-y-5">
          {/* Invoice Badge */}
          {orderDetails?.invoiceNo && (
            <div className="flex justify-center">
              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-4 py-2 text-sm font-semibold">
                Invoice #<span className="font-mono ml-1">{orderDetails.invoiceNo}</span>
              </Badge>
            </div>
          )}

          {/* Order Summary Card */}
          {orderDetails && (
            <Card className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
              <div className="space-y-3">
                {/* Customer */}
                {orderDetails.customer && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Customer</span>
                    <span className="font-semibold text-gray-900">{orderDetails.customer}</span>
                  </div>
                )}

                {/* Items Count */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Items</span>
                  <span className="font-semibold text-gray-900">{orderDetails.cart.length} item{orderDetails.cart.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Order Time */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Ordered
                  </span>
                  <span className="font-semibold text-gray-900 text-xs">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Price Breakdown */}
          {orderDetails && (
            <Card className="p-4 border border-gray-200">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">{formatCurrency(orderDetails.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{taxLabelText}</span>
                  <span className="text-gray-900">{formatCurrency(orderDetails.tax)}</span>
                </div>
                {orderDetails.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span className="font-medium">Discount</span>
                    <span className="font-medium">-{formatCurrency(orderDetails.discount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="font-bold text-gray-900">Total Amount</span>
                  <span className="text-2xl font-black text-emerald-600">{formatCurrency(orderDetails.total)}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            {orderDetails && (
              <Button
                variant="outline"
                className="w-full gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 h-11 font-semibold"
                onClick={handlePrint}
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </Button>
            )}
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-bold shadow-lg shadow-emerald-200"
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
