"use client"

import { useState, useEffect } from "react"
import { Trans, useTranslation } from "react-i18next"
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
    const { t } = useTranslation(["pos", "common"])
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
                    <DialogTitle>{t("pos:discountModal.title")}</DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <Tabs defaultValue="fixed" value={type} onValueChange={(v) => setType(v as any)} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="fixed">{t("pos:discountModal.fixed")}</TabsTrigger>
                            <TabsTrigger value="percentage">{t("pos:discountModal.percentage")}</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <FormField
                        label={t("pos:discountModal.value")}
                        htmlFor="pos-discount-value"
                        description={value ? <span className="block text-right"><Trans t={t} i18nKey="pos:discountModal.preview" values={{ amount: formatCurrency(calculatedDiscount()) }} components={{ b: <span className="font-medium text-foreground" /> }} /></span> : undefined}
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
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
                    <Button onClick={handleApply}>{t("pos:discountModal.apply")}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
