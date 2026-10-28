"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import financeApi, { financeError } from "@/lib/financeApi"
import type { ExpenseResponse } from "@/lib/expenseApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { todayIn, formatDate } from "@/lib/finance-format"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/common/FormField"
import { DatePicker } from "./date-picker"

/**
 * EXP-1: void an expense instead of deleting it. The row is kept (struck through with the reason) and a reversing
 * entry is posted on the void date, so a closed month's figures never change.
 */
export function ExpenseVoidDialog({ expense, onClose, onDone }: { expense: ExpenseResponse | null; onClose: () => void; onDone: () => void }) {
  const { formatCurrency, timezone } = useCompanySettings()
  const [reason, setReason] = useState("")
  const [date, setDate] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const today = todayIn(timezone)
  const expDate = (expense?.expenseDate ?? "").slice(0, 10)

  useEffect(() => {
    if (!expense) return
    setReason(""); setDate(todayIn(timezone)); setErr(""); setBusy(false)
  }, [expense, timezone])

  const submit = async () => {
    if (!expense) return
    if (!reason.trim()) { setErr("Give a reason for voiding."); return }
    if (date && expDate && date < expDate) { setErr("The void date cannot be before the expense date."); return }
    if (date && date > today) { setErr("The void date cannot be in the future."); return }
    setBusy(true); setErr("")
    try {
      await financeApi.voidExpense(expense.id, { reason: reason.trim(), date: date || undefined })
      toast.success("Expense voided")
      onDone(); onClose()
    } catch (e) {
      setErr(financeError(e, "Could not void this expense."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!expense} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void expense</DialogTitle>
          <DialogDescription>
            {expense ? `${expense.title} · ${formatCurrency(expense.amount)} on ${formatDate(expDate, timezone)}. ` : ""}
            The expense stays in the list, struck through. A reversing entry is posted on the void date, so closed months never change.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormField label="Reason" htmlFor="void-reason" required>
            <Textarea id="void-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate bill" />
          </FormField>
          <FormField label="Void date" htmlFor="void-date" description="Must be in an open month, on or after the expense date.">
            <DatePicker id="void-date" value={date} onChange={setDate} min={expDate || undefined} max="today" />
          </FormField>
          {err && <p className="text-sm font-medium text-destructive" role="alert">{err}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={busy}>{busy ? "Voiding…" : "Void expense"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
