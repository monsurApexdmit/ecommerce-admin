"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/common/FormField"
import { StatTile } from "@/components/common/StatTile"
import { paymentApi } from "@/lib/paymentApi"
import { type SellResponse } from "@/lib/sellsApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"

export const PAYMENT_METHODS = ["Cash", "bKash", "Nagad", "Card", "Bank", "COD"] as const
const NEEDS_REFERENCE = new Set(["bKash", "Nagad", "Bank", "Card"])

/** Outstanding balance of a sale (0 when paid or cancelled). */
export function salePaymentDue(s: SellResponse): number {
  if (s.status === "Cancelled" || s.paymentStatus === "paid") return 0
  const amount = Number(s.amount) || 0
  return Math.max(0, Math.round((amount - (Number(s.paidAmount) || 0)) * 100) / 100)
}

interface RecordPaymentDialogProps {
  /** Sales to pay. One sale: editable (partial) amount. Several: each sale's full due is paid. */
  sales: SellResponse[]
  onClose: () => void
  /** Called after at least one payment was recorded. */
  onDone: () => void
}

export function RecordPaymentDialog({ sales, onClose, onDone }: RecordPaymentDialogProps) {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const [method, setMethod] = useState<string>("Cash")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [saving, setSaving] = useState(false)

  const single = sales.length === 1
  const totalDue = sales.reduce((n, s) => n + salePaymentDue(s), 0)
  const open = sales.length > 0

  useEffect(() => {
    if (open) {
      setMethod("Cash"); setReference(""); setSaving(false)
      setAmount(sales.length === 1 ? String(salePaymentDue(sales[0])) : "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sales.map((s) => s.id).join(",")])

  const parsed = Number(amount)
  let error = ""
  if (single) {
    if (!amount.trim() || !Number.isFinite(parsed) || parsed <= 0) error = "Enter an amount greater than 0"
    else if (Math.round(parsed * 100) > Math.round(totalDue * 100)) error = `Amount exceeds the due of ${formatCurrency(totalDue)}`
  } else if (totalDue <= 0) error = "Nothing is due on the selected sales"

  const submit = async () => {
    if (error) return
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    const payable = sales.filter((s) => salePaymentDue(s) > 0)
    const results = await Promise.allSettled(
      payable.map((s) =>
        paymentApi.recordPayment("sells", s.id, {
          amount: single ? parsed : salePaymentDue(s),
          paymentMethod: method,
          paymentDate: today,
          referenceNo: reference.trim() || undefined,
        }),
      ),
    )
    const failed = results.filter((r) => r.status === "rejected").length
    const ok = payable.length - failed
    if (failed) {
      const first = results.find((r): r is PromiseRejectedResult => r.status === "rejected")
      const msg = (first?.reason as any)?.response?.data?.message
      toast({ variant: "destructive", title: "Some payments failed", description: msg || `${failed} of ${payable.length} were not recorded` })
    } else {
      const remaining = single ? Math.max(0, totalDue - parsed) : 0
      toast({
        title: "Payment recorded",
        description: single
          ? remaining > 0 ? `${formatCurrency(parsed)} received. ${formatCurrency(remaining)} still due.` : "Sale is fully paid"
          : `${ok} sale${ok === 1 ? "" : "s"} marked as paid`,
      })
    }
    setSaving(false)
    if (ok > 0) onDone()
    if (!failed) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            {single
              ? `Invoice #${sales[0]?.invoiceNo}. Enter less than the due to record a partial payment.`
              : `Pays the full due of each of the ${sales.length} selected sales.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <StatTile label="Total due" value={formatCurrency(totalDue)} className="p-3" />
          {single ? (
            <FormField label="Amount" htmlFor="record-payment-amount" error={error || undefined}>
              <Input
                id="record-payment-amount"
                type="number" inputMode="decimal" min="0" step="0.01" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!!error}
                className="tabular-nums"
              />
            </FormField>
          ) : error ? (
            <p className="text-xs font-medium text-destructive">{error}</p>
          ) : null}
          <FormField label="Payment method" htmlFor="record-payment-method">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="record-payment-method" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          {NEEDS_REFERENCE.has(method) && (
            <FormField label="Transaction ID (optional)" htmlFor="record-payment-reference">
              <Input
                id="record-payment-reference"
                value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100}
              />
            </FormField>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={saving || !!error}>
            {saving ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
