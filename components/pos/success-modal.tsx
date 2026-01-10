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
    }
}

export function SuccessModal({ open, onOpenChange, onClose, orderDetails }: SuccessModalProps) {

    const handlePrint = () => {
        if (!orderDetails) return;

        const printWindow = window.open('', '_blank', 'height=600,width=800');

        if (!printWindow) {
            alert("Please allow popups to print the invoice.");
            return;
        }

        const html = `
      <html>
        <head>
          <title>Invoice</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .total { display: flex; justify-content: space-between; font-weight: bold; margin-top: 5px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; }
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>KachaBazar</h2>
            <p>Dhaka, Bangladesh</p>
            <p>Date: ${new Date().toLocaleString()}</p>
            ${orderDetails.customer ? `<p>Customer: ${orderDetails.customer}</p>` : ''}
          </div>
          
          <div>
            ${orderDetails.cart.map(item => `
              <div class="item">
                <span>${item.name} x ${item.quantity}</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
          </div>
          
          <div class="divider"></div>
          
          <div class="item">
            <span>Subtotal</span>
            <span>$${orderDetails.subtotal.toFixed(2)}</span>
          </div>
          <div class="item">
            <span>Tax (10%)</span>
            <span>$${orderDetails.tax.toFixed(2)}</span>
          </div>
          ${orderDetails.discount > 0 ? `
            <div class="item">
              <span>Discount</span>
              <span>-$${orderDetails.discount.toFixed(2)}</span>
            </div>
          ` : ''}
          
          <div class="divider"></div>
          
          <div class="total">
            <span>Total</span>
            <span>$${orderDetails.total.toFixed(2)}</span>
          </div>
          
          <div class="footer">
            <p>Thank you for shopping with us!</p>
          </div>
        </body>
      </html>
    `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();

        // Wait for content to load then print
        printWindow.setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.close();
        }, 250);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-sm flex flex-col items-center justify-center text-center p-8 gap-6">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                    <Check className="w-10 h-10 text-emerald-600" strokeWidth={3} />
                </div>

                <div className="space-y-2">
                    <DialogTitle className="text-2xl font-bold text-gray-900">Payment Successful!</DialogTitle>
                    <p className="text-gray-500">
                        Your order has been processed successfully.
                    </p>
                </div>

                <div className="flex flex-col gap-3 w-full">
                    {orderDetails && (
                        <Button
                            variant="outline"
                            className="w-full gap-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                            onClick={handlePrint}
                        >
                            <Printer className="w-4 h-4" />
                            Print Invoice
                        </Button>
                    )}

                    <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base"
                        onClick={onClose}
                    >
                        Done
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
