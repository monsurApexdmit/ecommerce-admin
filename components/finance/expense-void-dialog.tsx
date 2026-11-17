"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import financeApi, { financeError } from "@/lib/financeApi"
import type { ExpenseResponse } from "@/lib/expenseApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { todayIn } from "@/lib/finance-format"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/common/FormField"
import { DatePicker } from "./date-picker"
import { FIN_NS, formatDateIn } from "./i18n"

/**
 * EXP-1: void an expense instead of deleting it. The row is kept (struck through with the reason) and a reversing
 * entry is posted on the void date, so a closed month's figures never change.
 */
export function ExpenseVoidDialog({ expense, onClose, onDone }: { expense: ExpenseResponse | null; onClose: () => void; onDone: () => void }) {
  const { formatCurrency, timezone } = useCompanySettings()
  const { t, i18n } = useTranslation(FIN_NS)
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
    if (!reason.trim()) { setErr(t("finance:void.reasonRequired")); return }
    if (date && expDate && date < expDate) { setErr(t("finance:void.beforeExpense")); return }
    if (date && date > today) { setErr(t("finance:void.future")); return }
    setBusy(true); setErr("")
    try {
      await financeApi.voidExpense(expense.id, { reason: reason.trim(), date: date || undefined })
      toast.success(t("finance:void.done"))
      onDone(); onClose()
    } catch (e) {
      setErr(financeError(e, t("finance:void.failed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!expense} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("finance:void.title")}</DialogTitle>
          <DialogDescription>
            {expense ? `${t("finance:void.summary", { title: expense.title, amount: formatCurrency(expense.amount), date: formatDateIn(i18n.language, expDate, timezone) })} ` : ""}
            {t("finance:void.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormField label={t("common:extra.reason")} htmlFor="void-reason" required>
            <Textarea id="void-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("finance:void.reasonPh")} />
          </FormField>
          <FormField label={t("finance:void.date")} htmlFor="void-date" description={t("finance:void.dateHelp")}>
            <DatePicker id="void-date" value={date} onChange={setDate} min={expDate || undefined} max="today" />
          </FormField>
          {err && <p className="text-sm font-medium text-destructive" role="alert">{err}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{t("common:actions.cancel")}</Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={busy}>{busy ? t("finance:void.voiding") : t("finance:void.title")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
