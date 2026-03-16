"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Input } from "@/components/ui/input"
import { Check, CreditCard, Banknote, Truck, Lock } from "lucide-react"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Card } from "@/components/ui/card"

interface CheckoutModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    totalAmount: number
    onConfirm: (paymentMethod: string) => void
}

export function CheckoutModal({ open, onOpenChange, totalAmount, onConfirm }: CheckoutModalProps) {
    const [paymentMethod, setPaymentMethod] = useState("Cash")
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
            <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                <VisuallyHidden asChild>
                    <DialogTitle>Payment Checkout</DialogTitle>
                </VisuallyHidden>

                {/* Header with Gradient */}
                <div className="bg-gradient-to-r from-blue-500 to-emerald-500 px-6 py-8 text-center text-white">
                    <p className="text-blue-100 text-sm font-medium mb-2">Total Amount Payable</p>
                    <p className="text-4xl font-black mb-1">${totalAmount.toFixed(2)}</p>
                    <div className="flex items-center justify-center gap-1 mt-3 text-blue-50 text-xs">
                        <Lock className="w-3 h-3" />
                        <span>Secure Payment</span>
                    </div>
                </div>

                <div className="px-6 py-6 space-y-6">
                    {/* Payment Method Selection */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Select Payment Method</h3>
                        <RadioGroup defaultValue="Cash" value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-3 gap-3">
                            {/* Cash Option */}
                            <div>
                                <RadioGroupItem value="Cash" id="cash" className="peer sr-only" />
                                <Label
                                    htmlFor="cash"
                                    className="flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 bg-white p-3 hover:border-blue-300 hover:bg-blue-50 peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all"
                                >
                                    <Banknote className="w-6 h-6 mb-2 text-gray-500 peer-data-[state=checked]:text-emerald-600" />
                                    <span className="font-semibold text-xs text-gray-700 text-center">Cash</span>
                                </Label>
                            </div>

                            {/* Card Option */}
                            <div>
                                <RadioGroupItem value="Card" id="card" className="peer sr-only" />
                                <Label
                                    htmlFor="card"
                                    className="flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 bg-white p-3 hover:border-blue-300 hover:bg-blue-50 peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all"
                                >
                                    <CreditCard className="w-6 h-6 mb-2 text-gray-500 peer-data-[state=checked]:text-emerald-600" />
                                    <span className="font-semibold text-xs text-gray-700 text-center">Card</span>
                                </Label>
                            </div>

                            {/* Online/COD Option */}
                            <div>
                                <RadioGroupItem value="Online" id="cod" className="peer sr-only" />
                                <Label
                                    htmlFor="cod"
                                    className="flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 bg-white p-3 hover:border-blue-300 hover:bg-blue-50 peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 cursor-pointer transition-all"
                                >
                                    <Truck className="w-6 h-6 mb-2 text-gray-500 peer-data-[state=checked]:text-emerald-600" />
                                    <span className="font-semibold text-xs text-gray-700 text-center">COD</span>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* Card Details Form */}
                    {paymentMethod === "Card" && (
                        <Card className="p-4 bg-blue-50 border border-blue-200 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold text-gray-700">Card Number</Label>
                                    <Input placeholder="0000 0000 0000 0000" className="bg-white" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-gray-700">Expiry</Label>
                                        <Input placeholder="MM/YY" className="bg-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-gray-700">CVC</Label>
                                        <Input placeholder="123" className="bg-white" />
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isProcessing}
                            className="flex-1 h-11 border-gray-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-11 font-bold text-base shadow-lg shadow-emerald-200"
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
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
