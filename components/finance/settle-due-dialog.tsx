"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import dueApi, { type DueDocument, type DueParty } from "@/lib/dueApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/common/FormField"
import { StatTile } from "@/components/common/StatTile"
import { todayStr, useFinanceFormat } from "./finance-ui"
import { DatePicker } from "./date-picker"
import { FIN_NS, methodText } from "./i18n"

/** Stored values (sent to the Dues API as is); labels are translated at render. */
const METHODS = ["Cash", "bKash", "Nagad", "Bank", "Card", "Other"]

export interface SettleTarget {
  party: DueParty; id: number; name: string
  /** Documents to tick by default (e.g. only those payable now); default: all open documents. */
  preselect?: { type: string; id: number | null }[]
  /** Default amount when lower than the selected due (e.g. payable now after supplier credits). */
  suggestedAmount?: number
}

/**
 * Collect a customer due / pay a supplier due. Same API and allocation rules as the Dues pages
 * (POST /dues/customers/{id}/collect, /dues/vendors/{id}/pay), as a dialog.
 */
export function SettleDueDialog({ target, onClose, onDone }: { target: SettleTarget | null; onClose: () => void; onDone: () => void }) {
  const { formatCurrency, timezone } = useCompanySettings()
  const { t } = useTranslation(FIN_NS)
  const fmt = useFinanceFormat()
  const isCust = target?.party === "customers"
  const [docs, setDocs] = useState<DueDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("Cash")
  const [date, setDate] = useState(todayStr(timezone))
  const [ref, setRef] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const key = (d: DueDocument) => `${d.documentType}-${d.documentId ?? 0}`

  useEffect(() => {
    if (!target) return
    setErr(""); setRef(""); setDate(todayStr(timezone)); setMethod("Cash"); setBusy(false)
    setLoading(true)
    dueApi.getDocuments(target.party, target.id)
      .then((res) => {
        setDocs(res.documents)
        const pre = target.preselect?.length
          ? res.documents.filter((d) => target.preselect!.some((p) => p.type === d.documentType && (p.id ?? 0) === (d.documentId ?? 0)))
          : res.documents
        const chosen = pre.length ? pre : res.documents
        setPicked(new Set(chosen.map(key)))
        const due = Math.round(chosen.reduce((a, d) => a + d.due, 0) * 100) / 100
        const sug = target.suggestedAmount
        setAmount(String(sug != null && sug > 0 && sug < due ? Math.round(sug * 100) / 100 : due))
      })
      .catch(() => { setDocs([]); setPicked(new Set()); setAmount(""); setErr(t("finance:settle.loadFailed")) })
      .finally(() => setLoading(false))
  }, [target])

  const pickedDue = docs.filter((d) => picked.has(key(d))).reduce((a, d) => a + d.due, 0)
  const amt = Number(amount) || 0

  const toggle = (d: DueDocument) => {
    const next = new Set(picked)
    if (next.has(key(d))) next.delete(key(d)); else next.add(key(d))
    setPicked(next)
    setAmount(String(Math.round(docs.filter((x) => next.has(key(x))).reduce((a, x) => a + x.due, 0) * 100) / 100))
  }

  const submit = async () => {
    if (!target) return
    if (date > todayStr(timezone)) { setErr(t("finance:form.paymentDateFuture")); return }
    if (picked.size === 0) { setErr(t("finance:settle.selectOne")); return }
    if (!(amt > 0)) { setErr(t("finance:form.amountAboveZero")); return }
    if (amt > pickedDue + 0.005) { setErr(t("finance:settle.overDue", { amount: formatCurrency(pickedDue) })); return }
    setBusy(true); setErr("")
    try {
      await dueApi.settle(target.party, target.id, {
        amount: amt, method, date, reference: ref.trim() || undefined,
        documentIds: docs.filter((d) => picked.has(key(d))).map((d) => ({ type: d.documentType, id: d.documentId })),
      })
      toast.success(isCust ? t("finance:settle.collectedFrom", { amount: formatCurrency(amt), name: target.name }) : t("finance:settle.paidTo", { amount: formatCurrency(amt), name: target.name }))
      onDone()
      onClose()
    } catch (e: any) {
      setErr(e?.response?.data?.message || t("finance:form.recordFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCust ? t("finance:settle.collectTitle") : t("finance:settle.payTitle")}</DialogTitle>
          <DialogDescription>
            {target?.name}. {isCust ? t("finance:settle.oldestInvoices") : t("finance:settle.oldestPOs")}{" "}
            <Link className="underline underline-offset-2" href={isCust ? "/dashboard/dues/customers" : "/dashboard/dues/vendors"}>{isCust ? t("finance:settle.openCustomerDues") : t("finance:settle.openSupplierDues")}</Link>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {loading ? <Skeleton className="h-28" /> : (
            <div className="max-h-48 overflow-y-auto rounded-lg border">
              {docs.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t("finance:settle.nothingDue")}</p> : docs.map((d) => (
                <label key={key(d)} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                  <Checkbox checked={picked.has(key(d))} onCheckedChange={() => toggle(d)} aria-label={t("finance:settle.include", { no: d.no })} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{d.no}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{fmt.date(d.date)} · {t("finance:settle.ageDays", { count: d.ageDays })}</span>
                  </span>
                  <span className="tabular-nums">{formatCurrency(d.due)}</span>
                </label>
              ))}
            </div>
          )}
          <StatTile label={t("finance:settle.selectedDue")} value={formatCurrency(pickedDue)} className="p-3" />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label={t("common:money.amount")} htmlFor="settle-amount" required>
              <Input id="settle-amount" type="number" inputMode="decimal" min="0" step="0.01" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <FormField label={t("finance:col.method")} htmlFor="settle-method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="settle-method" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m === "Bank" ? t("common:payment.bank") : methodText(t, m)}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label={t("common:fields.date")} htmlFor="settle-date">
              <DatePicker id="settle-date" max="today" value={date} onChange={setDate} />
            </FormField>
            <FormField label={t("finance:form.referenceOptional")} htmlFor="settle-ref">
              <Input id="settle-ref" value={ref} maxLength={100} onChange={(e) => setRef(e.target.value)} />
            </FormField>
          </div>
          {err && <p className="text-sm font-medium text-destructive" role="alert">{err}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" onClick={submit} disabled={busy || loading || docs.length === 0}>
            {busy ? t("common:actions.saving") : isCust ? t("finance:actions.collect") : t("finance:actions.pay")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
