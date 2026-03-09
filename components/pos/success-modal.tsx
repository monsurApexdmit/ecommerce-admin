"use client"

import { Check, Printer } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

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

export function SuccessModal({ open, onOpenChange, onClose, orderDetails }: SuccessModalProps) {

  const handlePrint = () => {
    if (!orderDetails) return
    const printWindow = window.open('', '_blank', 'height=600,width=800')
    if (!printWindow) { alert("Please allow popups to print the invoice."); return }
    const html = `<html><head><title>Receipt</title><style>
      @page{size:80mm auto;margin:0}
      body{font-family:'Courier New',monospace;width:80mm;margin:0;padding:10px;color:#000;font-size:12px;line-height:1.4}
      .header{text-align:center;margin-bottom:15px;border-bottom:1px dashed #000;padding-bottom:10px}
      .store-name{font-size:16px;font-weight:bold;text-transform:uppercase;margin-bottom:5px}
      .meta{font-size:10px;margin-top:5px}
      .divider{border-top:1px dashed #000;margin:10px 0}
      .item-row{display:flex;justify-content:space-between;margin-bottom:4px}
      .item-name{font-weight:bold;flex:1;margin-right:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .summary-row{display:flex;justify-content:space-between;margin-bottom:3px}
      .total-row{display:flex;justify-content:space-between;font-size:14px;font-weight:bold;margin-top:10px;border-top:1px dashed #000;padding-top:10px}
      .footer{text-align:center;margin-top:20px;font-size:10px}
      @media print{body{width:100%}.no-print{display:none}}
    </style></head><body>
      <div class="header">
        <div class="store-name">Admin</div>
        <div class="meta">59 Station Rd, Dhaka</div>
        <div class="meta">Tel: 019579034</div>
        <div class="meta">Date: ${new Date().toLocaleString()}</div>
        ${orderDetails.invoiceNo ? `<div class="meta">Invoice: ${orderDetails.invoiceNo}</div>` : ''}
        ${orderDetails.customer ? `<div class="meta">Customer: ${orderDetails.customer}</div>` : ''}
      </div>
      <div class="items">
        ${orderDetails.cart.map(item => `
          <div class="item-row"><div class="item-name">${item.name}</div></div>
          <div class="item-row" style="font-size:11px;color:#333;">
            <span>${item.quantity} x $${item.price.toFixed(2)}</span>
            <span>$${(item.price * item.quantity).toFixed(2)}</span>
          </div>`).join('')}
      </div>
      <div class="divider"></div>
      <div class="summary-row"><span>Subtotal</span><span>$${orderDetails.subtotal.toFixed(2)}</span></div>
      <div class="summary-row"><span>Tax (10%)</span><span>$${orderDetails.tax.toFixed(2)}</span></div>
      ${orderDetails.discount > 0 ? `<div class="summary-row"><span>Discount</span><span>-$${orderDetails.discount.toFixed(2)}</span></div>` : ''}
      <div class="total-row"><span>Total</span><span>$${orderDetails.total.toFixed(2)}</span></div>
      <div class="footer"><p>Thank you for shopping!</p><p style="margin-top:5px">Return Policy: 7 days with receipt</p></div>
    </body></html>`
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close() }, 250)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm flex flex-col items-center justify-center text-center p-8 gap-6">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
          <Check className="w-10 h-10 text-emerald-600" strokeWidth={3} />
        </div>
        <div className="space-y-2">
          <DialogTitle className="text-2xl font-bold text-gray-900">Payment Successful!</DialogTitle>
          {orderDetails?.invoiceNo && (
            <p className="text-sm font-mono text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full inline-block">
              {orderDetails.invoiceNo}
            </p>
          )}
          <p className="text-gray-500">Your order has been processed successfully.</p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          {orderDetails && (
            <Button variant="outline" className="w-full gap-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50" onClick={handlePrint}>
              <Printer className="w-4 h-4" />
              Print Receipt
            </Button>
          )}
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base" onClick={onClose}>
            New Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
