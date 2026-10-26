"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { FormField } from "@/components/common/FormField"
import { Percent, DollarSign } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCompanySettings } from "@/contexts/company-settings-context"

interface DiscountModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onApplyDiscount: (amount: number, type: 'fixed' | 'percentage') => void
    currentSubtotal: number
}

export function DiscountModal({ open, onOpenChange, onApplyDiscount, currentSubtotal }: DiscountModalProps) {
    const [value, setValue] = useState("")
    const [type, setType] = useState<'fixed' | 'percentage'>('fixed')
    const { formatCurrency } = useCompanySettings()

    // Reset when opened
    useEffect(() => {
        if (open) {
            setValue("")
            setType("fixed")
        }
    }, [open])

    const handleApply = () => {
        const numValue = parseFloat(value)
        if (isNaN(numValue) || numValue < 0) return

        onApplyDiscount(numValue, type)
        onOpenChange(false)
    }

    const calculatedDiscount = () => {
        const num = parseFloat(value)
        if (isNaN(num)) return 0
        if (type === 'fixed') return num
        return (currentSubtotal * num) / 100
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>Add Discount</DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <Tabs defaultValue="fixed" value={type} onValueChange={(v) => setType(v as any)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="fixed">Fixed Amount</TabsTrigger>
                            <TabsTrigger value="percentage">Percentage</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <FormField
                        label="Discount Value"
                        htmlFor="pos-discount-value"
                        description={value ? <span className="block text-right">Discount: <span className="font-medium text-foreground">-{formatCurrency(calculatedDiscount())}</span></span> : undefined}
                    >
                        <InputGroup>
                            <InputGroupAddon>
                                {type === 'fixed' ? <DollarSign /> : <Percent />}
                            </InputGroupAddon>
                            <InputGroupInput
                                id="pos-discount-value"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                type="number"
                                placeholder={type === 'fixed' ? "0.00" : "0"}
                                autoFocus
                            />
                        </InputGroup>
                    </FormField>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleApply}>Apply Discount</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
