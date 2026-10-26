"use client"

import { useCompanySettings } from "@/contexts/company-settings-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/common/FormField"

/** Values stored on the sale (`sells.method`). */
export type PosPaymentMethod = "Cash" | "Card" | "bKash" | "Nagad" | "Bank" | "COD"

export const POS_METHODS: PosPaymentMethod[] = ["Cash", "Card", "bKash", "Nagad", "Bank", "COD"]
/** Methods that carry a transaction reference. */
export const NEEDS_TXN: PosPaymentMethod[] = ["bKash", "Nagad", "Bank"]

/** Round the total up to note denominations for one-tap cash entry. */
export function quickTenders(total: number): number[] {
    const out: number[] = []
    for (const step of [100, 500, 1000, 5000]) {
        const v = Math.ceil(total / step) * step
        if (v > total + 0.005 && !out.includes(v)) out.push(v)
    }
    return out.slice(0, 3)
}

interface PosPaymentProps {
    total: number
    method: PosPaymentMethod
    onMethodChange: (m: PosPaymentMethod) => void
    /** "exact", a preset amount, or "custom" */
    tender: "exact" | "custom" | number
    onTenderChange: (t: "exact" | "custom" | number) => void
    tenderInput: string
    onTenderInput: (v: string) => void
    received: number
    /** Whether a named customer is attached (allows a due balance) */
    hasCustomer: boolean
    txnId: string
    onTxnChange: (v: string) => void
    /** Methods to offer; defaults to all */
    methods?: PosPaymentMethod[]
}

export function PosPayment({
    total, method, onMethodChange, tender, onTenderChange, tenderInput, onTenderInput, received, hasCustomer, txnId, onTxnChange, methods = POS_METHODS,
}: PosPaymentProps) {
    const { formatCurrency } = useCompanySettings()
    const short = Math.round((total - received) * 100) / 100
    const isShort = short > 0.005

    return (
        <div className="flex flex-col gap-3">
            <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-1.5">
                {methods.map((m) => {
                    const sel = method === m
                    return (
                        <Button
                            key={m}
                            type="button"
                            variant={sel ? "default" : "outline"}
                            role="radio"
                            aria-checked={sel}
                            onClick={() => onMethodChange(m)}
                        >
                            {m}
                        </Button>
                    )
                })}
            </div>

            {method === "Cash" && (
                <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-4 gap-1.5">
                        {(["exact", ...quickTenders(total)] as const).map((t) => {
                            const sel = tender === t
                            return (
                                <Button
                                    key={String(t)}
                                    type="button"
                                    variant={sel ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => onTenderChange(t)}
                                    className="tabular-nums"
                                >
                                    {t === "exact" ? "Exact" : formatCurrency(t).replace(/\.00$/, "")}
                                </Button>
                            )
                        })}
                    </div>
                    <Input
                        type="text"
                        inputMode="decimal"
                        aria-label="Amount received"
                        placeholder="Custom amount received"
                        value={tenderInput}
                        onChange={(e) => {
                            onTenderInput(e.target.value)
                            onTenderChange(e.target.value.trim() === "" ? "exact" : "custom")
                        }}
                    />
                    <Alert variant={isShort ? "destructive" : "default"} className="flex justify-between tabular-nums">
                        <span>Received {formatCurrency(received)}</span>
                        <span className="font-bold">
                            {isShort ? (hasCustomer ? "Due" : "Short") : "Change"} {formatCurrency(isShort ? short : received - total)}
                        </span>
                    </Alert>
                </div>
            )}

            {method === "COD" && (
                <Alert>
                    <AlertDescription>
                        Cash on delivery: nothing is collected now. The full total stays as a due balance on the customer, so a customer is required.
                    </AlertDescription>
                </Alert>
            )}

            {NEEDS_TXN.includes(method) && (
                <FormField label="Transaction ID" htmlFor="pos-txn-id">
                    <Input
                        id="pos-txn-id"
                        value={txnId}
                        onChange={(e) => onTxnChange(e.target.value)}
                        placeholder="e.g. 9JK4XY2LQ8"
                    />
                </FormField>
            )}
        </div>
    )
}
