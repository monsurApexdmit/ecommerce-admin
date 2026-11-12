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
import { useTranslation } from "react-i18next"

// Values are sent to the backend as-is; only the label is translated
const METHODS = [
  ["Cash", "customers:shared.methods.cash"],
  ["bKash", "customers:shared.methods.bkash"],
  ["Card", "customers:shared.methods.card"],
  ["Bank", "customers:shared.methods.bank"],
] as const

interface Props {
  customerId: number
  due: number
  onPaid: () => void
  onCancel: () => void
}

/** Inline "Get payment" form: records a payment against the customer's open dues. */
export function GetPaymentForm({ customerId, due, onPaid, onCancel }: Props) {
  const { t } = useTranslation(["customers", "common"])
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const [amount, setAmount] = useState(String(due))
  const [method, setMethod] = useState("Cash")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    const n = Number(amount)
    if (!(n > 0)) return setError(t("customers:payment.errAmount"))
    if (n > due + 0.001) return setError(t("customers:payment.errMax", { due: formatCurrency(due) }))
    setError("")
    setSaving(true)
    try {
      await dueApi.settle("customers", customerId, { amount: n, method })
      const methodKey = METHODS.find(([v]) => v === method)?.[1]
      toast({ title: t("customers:payment.recorded"), description: t("customers:payment.recordedDesc", { amount: formatCurrency(n), method: methodKey ? t(methodKey) : method }) })
      onPaid()
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || t("customers:payment.failed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="gap-2.5 p-3">
      <FormField label={t("customers:payment.amount", { due: formatCurrency(due) })} htmlFor={`get-payment-amount-${customerId}`}>
        <Input id={`get-payment-amount-${customerId}`} type="number" min={0} max={due} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </FormField>
      <SegmentedControl
        aria-label={t("common:payment.method")}
        value={method}
        onValueChange={setMethod}
        options={METHODS.map(([value, key]) => ({ value, label: t(key) }))}
      />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" onClick={submit} disabled={saving} className="flex-1">
          {saving ? t("common:actions.saving") : t("customers:payment.record")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>{t("common:actions.cancel")}</Button>
      </div>
    </Card>
  )
}
