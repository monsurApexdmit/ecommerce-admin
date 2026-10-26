"use client"

import { useState } from "react"
import { dueApi } from "@/lib/dueApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { FormField } from "@/components/common/FormField"
import { SegmentedControl } from "@/components/common/SegmentedControl"

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
    <Card className="gap-2.5 p-3">
      <FormField label={`Amount received (due ${formatCurrency(due)})`} htmlFor={`get-payment-amount-${customerId}`}>
        <Input id={`get-payment-amount-${customerId}`} type="number" min={0} max={due} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </FormField>
      <SegmentedControl
        aria-label="Payment method"
        value={method}
        onValueChange={setMethod}
        options={METHODS.map((m) => ({ value: m, label: m }))}
      />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" onClick={submit} disabled={saving} className="flex-1">
          {saving ? "Saving…" : "Record payment"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  )
}
