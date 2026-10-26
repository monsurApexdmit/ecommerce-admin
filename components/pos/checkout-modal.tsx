"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Check, CreditCard, Banknote, Truck, Lock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { FormField } from "@/components/common/FormField"
import { SectionTitle } from "@/components/common/SectionTitle"
import { useCompanySettings } from "@/contexts/company-settings-context"

interface CheckoutModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    totalAmount: number
    onConfirm: (paymentMethod: string) => void
}

export function CheckoutModal({ open, onOpenChange, totalAmount, onConfirm }: CheckoutModalProps) {
    const [paymentMethod, setPaymentMethod] = useState("Cash")
    const [isProcessing, setIsProcessing] = useState(false)
    const [tenderedInput, setTenderedInput] = useState("")
    const { formatCurrency } = useCompanySettings()

    const tendered = parseFloat(tenderedInput) || 0
    const change = tendered - totalAmount
    const isValidCash = paymentMethod !== "Cash" || tendered >= totalAmount

    // Quick cash buttons: round up to nearest sensible denominations
    const quickAmounts = (() => {
        const amounts: number[] = []
        const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
        for (const s of steps) {
            const val = Math.ceil(totalAmount / s) * s
            if (!amounts.includes(val) && amounts.length < 4) amounts.push(val)
        }
        // always include exact amount first
        return [totalAmount, ...amounts.filter(a => a !== totalAmount)].slice(0, 4)
    })()

    const handleConfirm = () => {
        if (!isValidCash) return
        setIsProcessing(true)
        setTimeout(() => {
            setIsProcessing(false)
            onConfirm(paymentMethod)
            onOpenChange(false)
            setTenderedInput("")
        }, 1000)
    }

    const handleOpenChange = (v: boolean) => {
        if (!v) setTenderedInput("")
        onOpenChange(v)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader className="items-center text-center sm:text-center">
                    <DialogTitle className="sr-only">Payment Checkout</DialogTitle>
                    <p className="text-sm font-medium text-muted-foreground">Total Amount Payable</p>
                    <p className="text-4xl font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
                    <div className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3" />
                        <span>Secure Payment</span>
                    </div>
                </DialogHeader>
                <Separator />

                <div className="space-y-6">
                    {/* Payment Method Selection */}
                    <div className="space-y-4">
                        <SectionTitle>Select Payment Method</SectionTitle>
                        <ChoiceCardGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid-cols-3 gap-3" aria-label="Payment method">
                            <ChoiceCard value="Cash" icon={<Banknote className="size-5" />} title="Cash" className="items-center p-3" />
                            <ChoiceCard value="Card" icon={<CreditCard className="size-5" />} title="Card" className="items-center p-3" />
                            <ChoiceCard value="Online" icon={<Truck className="size-5" />} title="COD" className="items-center p-3" />
                        </ChoiceCardGroup>
                    </div>

                    {/* Cash Tendered */}
                    {paymentMethod === "Cash" && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <FormField label="Cash Tendered" htmlFor="checkout-tendered">
                                <Input
                                    id="checkout-tendered"
                                    type="number"
                                    inputMode="decimal"
                                    placeholder={`Min ${formatCurrency(totalAmount)}`}
                                    value={tenderedInput}
                                    onChange={e => setTenderedInput(e.target.value)}
                                    autoFocus
                                />
                            </FormField>
                            {/* Quick amount buttons */}
                            <div className="grid grid-cols-4 gap-2">
                                {quickAmounts.map(amt => (
                                    <Button
                                        key={amt}
                                        type="button"
                                        variant={tenderedInput === String(amt) ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setTenderedInput(String(amt))}
                                    >
                                        {formatCurrency(amt)}
                                    </Button>
                                ))}
                            </div>
                            {/* Change due */}
                            {tendered > 0 && (
                                <Alert variant={change >= 0 ? "default" : "destructive"} className="flex items-center justify-between">
                                    <span className="text-sm font-semibold">
                                        {change >= 0 ? "Change Due" : "Amount Short"}
                                    </span>
                                    <span className="text-xl font-bold tabular-nums">
                                        {formatCurrency(Math.abs(change))}
                                    </span>
                                </Alert>
                            )}
                        </div>
                    )}

                    {/* Card Details Form */}
                    {paymentMethod === "Card" && (
                        <Card className="gap-3 p-4 animate-in fade-in slide-in-from-top-2">
                            <FormField label="Card Number" htmlFor="checkout-card-number">
                                <Input id="checkout-card-number" placeholder="0000 0000 0000 0000" />
                            </FormField>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Expiry" htmlFor="checkout-card-expiry">
                                    <Input id="checkout-card-expiry" placeholder="MM/YY" />
                                </FormField>
                                <FormField label="CVC" htmlFor="checkout-card-cvc">
                                    <Input id="checkout-card-cvc" placeholder="123" />
                                </FormField>
                            </div>
                        </Card>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => handleOpenChange(false)}
                            disabled={isProcessing}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="lg"
                            className="flex-1"
                            onClick={handleConfirm}
                            disabled={isProcessing || !isValidCash}
                        >
                            {isProcessing ? "Processing..." : (
                                <>
                                    <Check />
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
