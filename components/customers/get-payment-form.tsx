"use client"

import { useState } from "react"
import { dueApi } from "@/lib/dueApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const METHODS = ["Cash", "bKash", "Card", "Bank"]

interface Props {
  customerId: number
  due: number
  onPaid: () => void
  onCancel: () => void
}

/** Inline "Get payment" form: records a payment against the customer's open dues. */
export function GetPaymentForm({ customerId, due, onPaid, onCancel }: Props) {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const [amount, setAmount] = useState(String(due))
  const [method, setMethod] = useState("Cash")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    const n = Number(amount)
    if (!(n > 0)) return setError("Enter an amount above 0")
    if (n > due + 0.001) return setError(`Amount can't be more than the ${formatCurrency(due)} due`)
    setError("")
    setSaving(true)
    try {
      await dueApi.settle("customers", customerId, { amount: n, method })
      toast({ title: "Payment recorded", description: `${formatCurrency(n)} received by ${method}` })
      onPaid()
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Could not record the payment")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-dash-border bg-dash-bg p-3">
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Amount received (due {formatCurrency(due)})
        <input type="number" min={0} max={due} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
          className="h-10 rounded-lg border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent" />
      </label>
      <div role="radiogroup" aria-label="Payment method" className="flex flex-wrap gap-1.5">
        {METHODS.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)}
            className={cn("h-9 rounded-lg border-2 px-3 text-[13px] font-semibold", method === m ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>
            {m}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-xs text-dash-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={saving} className="h-10 flex-1 rounded-lg bg-dash-accent text-[13px] font-semibold text-white disabled:opacity-40">
          {saving ? "Saving…" : "Record payment"}
        </button>
        <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-dash-border bg-dash-card px-3 text-[13px] font-semibold hover:bg-dash-neutral-soft">Cancel</button>
      </div>
    </div>
  )
}
