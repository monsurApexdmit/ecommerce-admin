"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { staffUiApi } from "@/lib/staffApi"
import { tailorApi, type TailorLedgerKind, type TailorPayableOption } from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/common/FormField"
import { StatTile } from "@/components/common/StatTile"
import { todayStr } from "./finance-ui"
import { DatePicker } from "./date-picker"
import { FIN_NS, methodText } from "./i18n"

const errMsg = (e: any, fallback: string) => {
  const errs = e?.response?.data?.errors
  return (errs && (Object.values(errs).flat()[0] as string)) || e?.response?.data?.message || fallback
}

// ─── Salary payslip ──────────────────────────────────────────────────────────

/** Stored values (sent to the API as is); labels are translated at render. */
const SALARY_METHODS = ["Cash", "bKash", "Bank transfer", "Check"]

export interface SalaryPayTarget { paymentId: number; name: string; amount: number; method?: string | null; month?: string | null }

/** Pays one generated payslip — same call as Staff → Salary management (POST /salary-payments/{id}/pay). */
export function SalaryPayDialog({ target, onClose, onDone }: { target: SalaryPayTarget | null; onClose: () => void; onDone: () => void }) {
  const { formatCurrency, timezone } = useCompanySettings()
  const { t } = useTranslation(FIN_NS)
  const [method, setMethod] = useState("Cash")
  const [date, setDate] = useState(todayStr(timezone))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!target) return
    setMethod(target.method && SALARY_METHODS.includes(target.method) ? target.method : "Cash")
    setDate(todayStr(timezone)); setErr(""); setBusy(false)
  }, [target])

  const submit = async () => {
    if (!target) return
    if (date > todayStr(timezone)) { setErr(t("finance:form.paymentDateFuture")); return }
    setBusy(true); setErr("")
    try {
      await staffUiApi.payPayment(target.paymentId, { method, date })
      toast.success(t("finance:salaryPay.paid", { amount: formatCurrency(target.amount), name: target.name }))
      onDone(); onClose()
    } catch (e) {
      setErr(errMsg(e, t("finance:salaryPay.failed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("finance:salaryPay.title")}</DialogTitle>
          <DialogDescription>{target?.name}{target?.month ? ` · ${target.month}` : ""}. {t("finance:salaryPay.description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <StatTile label={t("finance:salaryPay.netPay")} value={formatCurrency(target?.amount ?? 0)} className="p-3" />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("finance:salaryPay.paidVia")} htmlFor="salary-pay-method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="salary-pay-method" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{SALARY_METHODS.map((m) => <SelectItem key={m} value={m}>{methodText(t, m)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label={t("common:fields.date")} htmlFor="salary-pay-date">
              <DatePicker id="salary-pay-date" max="today" value={date} onChange={setDate} />
            </FormField>
          </div>
          {err && <p className="text-sm font-medium text-destructive" role="alert">{err}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" onClick={submit} disabled={busy}>{busy ? t("finance:actions.paying") : t("finance:salaryPay.payAmount", { amount: formatCurrency(target?.amount ?? 0) })}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tailor: dorji payout / customer order payment ───────────────────────────

/** Method keys sent to the API; labels translated at render. */
const TAILOR_METHODS = ["cash", "bank", "bkash", "nagad", "card"]

export interface TailorPayTarget { kind: TailorLedgerKind; id?: number | null }

/**
 * Dorji payout (kind "dorji") or tailor order payment (kind "customer") — same call as Tailor → Payments
 * (POST /tailor/payments/record), with the payable list from /tailor/payments/options.
 */
export function TailorPaymentDialog({ target, onClose, onDone }: { target: TailorPayTarget | null; onClose: () => void; onDone: () => void }) {
  const { formatCurrency, timezone } = useCompanySettings()
  const { t } = useTranslation(FIN_NS)
  const kind = target?.kind ?? "dorji"
  const [opts, setOpts] = useState<TailorPayableOption[]>([])
  const [pick, setPick] = useState("")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("cash")
  const [date, setDate] = useState(todayStr(timezone))
  const [ref, setRef] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!target) return
    setErr(""); setRef(""); setDate(todayStr(timezone)); setMethod("cash"); setBusy(false); setOpts([]); setPick(""); setAmount("")
    tailorApi.getPayableOptions(target.kind)
      .then((list) => {
        setOpts(list)
        const first = list.find((o) => o.id === target.id) ?? list[0]
        if (first) { setPick(String(first.id)); setAmount(String(first.balance)) }
      })
      .catch(() => setErr(t("finance:tailorPay.loadFailed")))
  }, [target])

  const current = opts.find((o) => String(o.id) === pick)
  const bal = current?.balance ?? 0
  const amt = Number(amount) || 0
  const label = (o: TailorPayableOption) => kind === "customer"
    ? t("finance:tailorPay.orderOption", { order: o.orderNumber, name: o.name ?? t("common:status.unknown"), amount: formatCurrency(o.balance) })
    : t("finance:tailorPay.dorjiOption", { name: o.name, amount: formatCurrency(o.balance) })

  const submit = async () => {
    if (!current) { setErr(kind === "customer" ? t("finance:tailorPay.noOrders") : t("finance:tailorPay.noDorji")); return }
    if (!(amt > 0)) { setErr(t("finance:form.amountAboveZero")); return }
    if (amt > bal + 0.005) { setErr(t("finance:tailorPay.overBalance", { amount: formatCurrency(bal) })); return }
    if (date > todayStr(timezone)) { setErr(t("finance:form.paymentDateFuture")); return }
    setBusy(true); setErr("")
    try {
      await tailorApi.recordPayment({
        kind, orderId: kind === "customer" ? current.id : undefined, dorjiId: kind === "dorji" ? current.id : undefined,
        amount: amt, expectedBalance: bal, paymentMethod: method, paymentDate: date, reference: ref.trim(),
      })
      toast.success(kind === "dorji" ? t("finance:tailorPay.paidToast", { amount: formatCurrency(amt) }) : t("finance:tailorPay.receivedToast", { amount: formatCurrency(amt) }))
      onDone(); onClose()
    } catch (e: any) {
      if (e?.response?.status === 409) tailorApi.getPayableOptions(kind).then(setOpts).catch(() => {})
      setErr(errMsg(e, t("finance:form.recordFailed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "dorji" ? t("finance:tailorPay.payDorji") : t("finance:tailorPay.collectTitle")}</DialogTitle>
          <DialogDescription>{kind === "dorji" ? t("finance:tailorPay.dorjiDesc") : t("finance:tailorPay.customerDesc")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormField label={kind === "dorji" ? t("finance:payee.dorji") : t("finance:col.order")} htmlFor="tailor-pay-pick">
            <Select value={pick} onValueChange={(v) => { setPick(v); const o = opts.find((x) => String(x.id) === v); if (o) setAmount(String(o.balance)) }}>
              <SelectTrigger id="tailor-pay-pick" className="w-full"><SelectValue placeholder={opts.length ? t("finance:tailorPay.choose") : t("finance:tailorPay.nothingOwed")} /></SelectTrigger>
              <SelectContent>{opts.map((o) => <SelectItem key={o.id} value={String(o.id)}>{label(o)}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("common:money.amount")} htmlFor="tailor-pay-amount" required>
              <Input id="tailor-pay-amount" type="number" inputMode="decimal" min="0" step="0.01" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <FormField label={t("finance:col.method")} htmlFor="tailor-pay-method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="tailor-pay-method" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{TAILOR_METHODS.map((v) => <SelectItem key={v} value={v}>{methodText(t, v)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label={t("common:fields.date")} htmlFor="tailor-pay-date">
              <DatePicker id="tailor-pay-date" max="today" value={date} onChange={setDate} />
            </FormField>
            <FormField label={t("finance:form.referenceOptional")} htmlFor="tailor-pay-ref">
              <Input id="tailor-pay-ref" value={ref} maxLength={100} onChange={(e) => setRef(e.target.value)} />
            </FormField>
          </div>
          {err && <p className="text-sm font-medium text-destructive" role="alert">{err}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" onClick={submit} disabled={busy || !current}>{busy ? t("common:actions.saving") : kind === "dorji" ? t("finance:actions.pay") : t("finance:actions.recordPayment")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
