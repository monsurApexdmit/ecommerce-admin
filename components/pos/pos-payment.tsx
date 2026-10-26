"use client"

import { useCompanySettings } from "@/contexts/company-settings-context"
import { cn } from "@/lib/utils"

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
                        <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={sel}
                            onClick={() => onMethodChange(m)}
                            className={cn(
                                "h-[46px] rounded-[10px] border-2 text-[13px] font-bold transition-colors",
                                sel
                                    ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg"
                                    : "border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft",
                            )}
                        >
                            {m}
                        </button>
                    )
                })}
            </div>

            {method === "Cash" && (
                <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-4 gap-1.5">
                        {(["exact", ...quickTenders(total)] as const).map((t) => {
                            const sel = tender === t
                            return (
                                <button
                                    key={String(t)}
                                    type="button"
                                    onClick={() => onTenderChange(t)}
                                    className={cn(
                                        "h-[38px] rounded-lg border text-[13px] font-semibold tabular-nums",
                                        sel ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card text-dash-ink",
                                    )}
                                >
                                    {t === "exact" ? "Exact" : formatCurrency(t).replace(/\.00$/, "")}
                                </button>
                            )
                        })}
                    </div>
                    <input
                        type="text"
                        inputMode="decimal"
                        aria-label="Amount received"
                        placeholder="Custom amount received"
                        value={tenderInput}
                        onChange={(e) => {
                            onTenderInput(e.target.value)
                            onTenderChange(e.target.value.trim() === "" ? "exact" : "custom")
                        }}
                        className="h-10 rounded-lg border border-dash-border bg-dash-card px-3 text-sm text-dash-ink outline-none focus-visible:border-dash-accent"
                    />
                    <div
                        className={cn(
                            "flex justify-between rounded-[10px] px-3 py-2.5 text-sm tabular-nums",
                            isShort ? "bg-dash-danger-soft text-dash-danger-fg" : "bg-dash-success-soft text-dash-success-fg",
                        )}
                    >
                        <span>Received {formatCurrency(received)}</span>
                        <span className="font-bold">
                            {isShort ? (hasCustomer ? "Due" : "Short") : "Change"} {formatCurrency(isShort ? short : received - total)}
                        </span>
                    </div>
                </div>
            )}

            {method === "COD" && (
                <p className="rounded-[10px] bg-dash-warn-soft p-3 text-[13px] leading-snug text-dash-warn-fg">
                    Cash on delivery: nothing is collected now. The full total stays as a due balance on the customer, so a customer is required.
                </p>
            )}

            {NEEDS_TXN.includes(method) && (
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                    Transaction ID
                    <input
                        value={txnId}
                        onChange={(e) => onTxnChange(e.target.value)}
                        placeholder="e.g. 9JK4XY2LQ8"
                        className="h-10 rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
                    />
                </label>
            )}
        </div>
    )
}
