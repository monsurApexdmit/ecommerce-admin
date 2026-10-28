"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
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

const errMsg = (e: any, fallback: string) => {
  const errs = e?.response?.data?.errors
  return (errs && (Object.values(errs).flat()[0] as string)) || e?.response?.data?.message || fallback
}

// ─── Salary payslip ──────────────────────────────────────────────────────────

const SALARY_METHODS = ["Cash", "bKash", "Bank transfer", "Check"]

export interface SalaryPayTarget { paymentId: number; name: string; amount: number; method?: string | null; month?: string | null }

/** Pays one generated payslip — same call as Staff → Salary management (POST /salary-payments/{id}/pay). */
export function SalaryPayDialog({ target, onClose, onDone }: { target: SalaryPayTarget | null; onClose: () => void; onDone: () => void }) {
  const { formatCurrency, timezone } = useCompanySettings()
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
    if (date > todayStr(timezone)) { setErr("Payment date cannot be in the future."); return }
    setBusy(true); setErr("")
    try {
      await staffUiApi.payPayment(target.paymentId, { method, date })
      toast.success(`Paid ${formatCurrency(target.amount)} to ${target.name}`)
      onDone(); onClose()
    } catch (e) {
      setErr(errMsg(e, "Could not pay this payslip."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pay salary</DialogTitle>
          <DialogDescription>{target?.name}{target?.month ? ` · ${target.month}` : ""}. Bonus and deductions are edited in Salary management.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <StatTile label="Net pay" value={formatCurrency(target?.amount ?? 0)} className="p-3" />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Paid via" htmlFor="salary-pay-method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="salary-pay-method" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{SALARY_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Date" htmlFor="salary-pay-date">
              <DatePicker id="salary-pay-date" max="today" value={date} onChange={setDate} />
            </FormField>
          </div>
          {err && <p className="text-sm font-medium text-destructive" role="alert">{err}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy}>{busy ? "Paying…" : `Pay ${formatCurrency(target?.amount ?? 0)}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tailor: dorji payout / customer order payment ───────────────────────────

const TAILOR_METHODS: [string, string][] = [["cash", "Cash"], ["bank", "Bank transfer"], ["bkash", "bKash"], ["nagad", "Nagad"], ["card", "Card"]]

export interface TailorPayTarget { kind: TailorLedgerKind; id?: number | null }

/**
 * Dorji payout (kind "dorji") or tailor order payment (kind "customer") — same call as Tailor → Payments
 * (POST /tailor/payments/record), with the payable list from /tailor/payments/options.
 */
export function TailorPaymentDialog({ target, onClose, onDone }: { target: TailorPayTarget | null; onClose: () => void; onDone: () => void }) {
  const { formatCurrency, timezone } = useCompanySettings()
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
      .catch(() => setErr("Could not load what is owed."))
  }, [target])

  const current = opts.find((o) => String(o.id) === pick)
  const bal = current?.balance ?? 0
  const amt = Number(amount) || 0
  const label = (o: TailorPayableOption) => kind === "customer"
    ? `${o.orderNumber} · ${o.name ?? "Unknown"} — due ${formatCurrency(o.balance)}`
    : `${o.name} — unpaid ${formatCurrency(o.balance)}`

  const submit = async () => {
    if (!current) { setErr(kind === "customer" ? "No orders have a balance due." : "No dorji has unpaid finished work."); return }
    if (!(amt > 0)) { setErr("Enter an amount greater than 0."); return }
    if (amt > bal + 0.005) { setErr(`Amount is more than the balance (${formatCurrency(bal)}).`); return }
    if (date > todayStr(timezone)) { setErr("Payment date cannot be in the future."); return }
    setBusy(true); setErr("")
    try {
      await tailorApi.recordPayment({
        kind, orderId: kind === "customer" ? current.id : undefined, dorjiId: kind === "dorji" ? current.id : undefined,
        amount: amt, expectedBalance: bal, paymentMethod: method, paymentDate: date, reference: ref.trim(),
      })
      toast.success(`${kind === "dorji" ? "Paid" : "Received"} ${formatCurrency(amt)}`)
      onDone(); onClose()
    } catch (e: any) {
      if (e?.response?.status === 409) tailorApi.getPayableOptions(kind).then(setOpts).catch(() => {})
      setErr(errMsg(e, "Could not record the payment."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "dorji" ? "Pay dorji" : "Collect tailor payment"}</DialogTitle>
          <DialogDescription>{kind === "dorji" ? "Pays for finished work. Recorded as a dorji payout expense." : "Records a payment against a tailor order's balance."}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <FormField label={kind === "dorji" ? "Dorji" : "Order"} htmlFor="tailor-pay-pick">
            <Select value={pick} onValueChange={(v) => { setPick(v); const o = opts.find((x) => String(x.id) === v); if (o) setAmount(String(o.balance)) }}>
              <SelectTrigger id="tailor-pay-pick" className="w-full"><SelectValue placeholder={opts.length ? "Choose…" : "Nothing owed"} /></SelectTrigger>
              <SelectContent>{opts.map((o) => <SelectItem key={o.id} value={String(o.id)}>{label(o)}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Amount" htmlFor="tailor-pay-amount" required>
              <Input id="tailor-pay-amount" type="number" inputMode="decimal" min="0" step="0.01" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <FormField label="Method" htmlFor="tailor-pay-method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="tailor-pay-method" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{TAILOR_METHODS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Date" htmlFor="tailor-pay-date">
              <DatePicker id="tailor-pay-date" max="today" value={date} onChange={setDate} />
            </FormField>
            <FormField label="Reference (optional)" htmlFor="tailor-pay-ref">
              <Input id="tailor-pay-ref" value={ref} maxLength={100} onChange={(e) => setRef(e.target.value)} />
            </FormField>
          </div>
          {err && <p className="text-sm font-medium text-destructive" role="alert">{err}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy || !current}>{busy ? "Saving…" : kind === "dorji" ? "Pay" : "Record payment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
