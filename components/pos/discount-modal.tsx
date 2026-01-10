"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Percent, DollarSign } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface DiscountModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onApplyDiscount: (amount: number, type: 'fixed' | 'percentage') => void
    currentSubtotal: number
}

export function DiscountModal({ open, onOpenChange, onApplyDiscount, currentSubtotal }: DiscountModalProps) {
    const [value, setValue] = useState("")
    const [type, setType] = useState<'fixed' | 'percentage'>('fixed')

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

                    <div className="space-y-2">
                        <Label>Discount Value</Label>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                {type === 'fixed' ? <DollarSign className="w-4 h-4" /> : <Percent className="w-4 h-4" />}
                            </div>
                            <Input
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                type="number"
                                placeholder={type === 'fixed' ? "0.00" : "0"}
                                className="pl-9"
                                autoFocus
                            />
                        </div>
                        {value && (
                            <p className="text-sm text-gray-500 text-right">
                                Discount: <span className="font-medium text-emerald-600">-${calculatedDiscount().toFixed(2)}</span>
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleApply} className="bg-emerald-600 hover:bg-emerald-700">Apply Discount</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
