"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Check, CreditCard, Banknote, User, Truck } from "lucide-react"

interface CheckoutModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    totalAmount: number
    onConfirm: (paymentMethod: string) => void
}

export function CheckoutModal({ open, onOpenChange, totalAmount, onConfirm }: CheckoutModalProps) {
    const [paymentMethod, setPaymentMethod] = useState("cash")
    const [isProcessing, setIsProcessing] = useState(false)

    const handleConfirm = () => {
        setIsProcessing(true)
        // Simulate processing
        setTimeout(() => {
            setIsProcessing(false)
            onConfirm(paymentMethod)
            onOpenChange(false)
        }, 1000)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Order Confirmation</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Total Amount Display */}
                    <div className="bg-emerald-50 p-4 rounded-lg text-center border border-emerald-100">
                        <p className="text-sm text-emerald-600 font-medium mb-1">Total Amount Payable</p>
                        <p className="text-3xl font-bold text-emerald-700">${totalAmount.toFixed(2)}</p>
                    </div>

                    <div className="space-y-3">
                        <Label className="text-base">Payment Method</Label>
                        <RadioGroup defaultValue="cash" value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-3 gap-4">
                            <div>
                                <RadioGroupItem value="cash" id="cash" className="peer sr-only" />
                                <Label
                                    htmlFor="cash"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all h-full"
                                >
                                    <Banknote className="mb-3 h-6 w-6 text-gray-500 peer-data-[state=checked]:text-emerald-600" />
                                    <span className="font-semibold text-gray-700">Cash</span>
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="card" id="card" className="peer sr-only" />
                                <Label
                                    htmlFor="card"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all h-full"
                                >
                                    <CreditCard className="mb-3 h-6 w-6 text-gray-500 peer-data-[state=checked]:text-emerald-600" />
                                    <span className="font-semibold text-gray-700">Card</span>
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="cod" id="cod" className="peer sr-only" />
                                <Label
                                    htmlFor="cod"
                                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all h-full"
                                >
                                    <Truck className="mb-3 h-6 w-6 text-gray-500 peer-data-[state=checked]:text-emerald-600" />
                                    <span className="font-semibold text-gray-700 text-sm text-center">COD</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {paymentMethod === "card" && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-1">
                                <Label>Card Number</Label>
                                <Input placeholder="0000 0000 0000 0000" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Expiry</Label>
                                    <Input placeholder="MM/YY" />
                                </div>
                                <div className="space-y-1">
                                    <Label>CVC</Label>
                                    <Input placeholder="123" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                        Cancel
                    </Button>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700 min-w-[120px]"
                        onClick={handleConfirm}
                        disabled={isProcessing}
                    >
                        {isProcessing ? "Processing..." : (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                Confirm Order
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
