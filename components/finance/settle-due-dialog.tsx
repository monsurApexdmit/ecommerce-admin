"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
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
import { fmtDate, todayStr } from "./finance-ui"
import { DatePicker } from "./date-picker"

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
      .catch(() => { setDocs([]); setPicked(new Set()); setAmount(""); setErr("Could not load the open documents.") })
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
    if (date > todayStr(timezone)) { setErr("Payment date cannot be in the future."); return }
    if (picked.size === 0) { setErr("Select at least one document."); return }
    if (!(amt > 0)) { setErr("Enter an amount above zero."); return }
    if (amt > pickedDue + 0.005) { setErr(`That is more than the ${formatCurrency(pickedDue)} due on the selected documents.`); return }
    setBusy(true); setErr("")
    try {
      await dueApi.settle(target.party, target.id, {
        amount: amt, method, date, reference: ref.trim() || undefined,
        documentIds: docs.filter((d) => picked.has(key(d))).map((d) => ({ type: d.documentType, id: d.documentId })),
      })
      toast.success(`${isCust ? "Collected" : "Paid"} ${formatCurrency(amt)} ${isCust ? "from" : "to"} ${target.name}`)
      onDone()
      onClose()
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not record the payment.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isCust ? "Collect payment" : "Pay supplier"}</DialogTitle>
          <DialogDescription>
            {target?.name}. The amount is applied to the oldest selected {isCust ? "invoices" : "purchase orders"} first.{" "}
            <Link className="underline underline-offset-2" href={isCust ? "/dashboard/dues/customers" : "/dashboard/dues/vendors"}>Open {isCust ? "customer" : "supplier"} dues</Link>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {loading ? <Skeleton className="h-28" /> : (
            <div className="max-h-48 overflow-y-auto rounded-lg border">
              {docs.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Nothing is due.</p> : docs.map((d) => (
                <label key={key(d)} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                  <Checkbox checked={picked.has(key(d))} onCheckedChange={() => toggle(d)} aria-label={`Include ${d.no}`} />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{d.no}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{fmtDate(d.date, timezone)} · {d.ageDays}d</span>
                  </span>
                  <span className="tabular-nums">{formatCurrency(d.due)}</span>
                </label>
              ))}
            </div>
          )}
          <StatTile label="Selected due" value={formatCurrency(pickedDue)} className="p-3" />
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Amount" htmlFor="settle-amount" required>
              <Input id="settle-amount" type="number" inputMode="decimal" min="0" step="0.01" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </FormField>
            <FormField label="Method" htmlFor="settle-method">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="settle-method" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Date" htmlFor="settle-date">
              <DatePicker id="settle-date" max="today" value={date} onChange={setDate} />
            </FormField>
            <FormField label="Reference (optional)" htmlFor="settle-ref">
              <Input id="settle-ref" value={ref} maxLength={100} onChange={(e) => setRef(e.target.value)} />
            </FormField>
          </div>
          {err && <p className="text-sm font-medium text-destructive" role="alert">{err}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy || loading || docs.length === 0}>
            {busy ? "Saving…" : isCust ? "Collect" : "Pay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
