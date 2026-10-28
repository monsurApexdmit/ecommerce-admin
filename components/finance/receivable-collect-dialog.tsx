"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import financeApi, { financeError, type FinanceAccount, type SupplierReceivableRow } from "@/lib/financeApi"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/common/FormField"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { StatTile } from "@/components/common/StatTile"
import { DatePicker } from "./date-picker"
import { METHOD_KEYS, useFinanceFormat } from "./finance-ui"

/**
 * RCV-2: a supplier whose credits exceed what you owe them → Collect. Either record the money they paid you
 * (POST /finance/receivables/suppliers/{id}/receive, money in to an account) or leave it to be offset: credits are
 * already netted against the next "payable now", so nothing needs to be posted.
 */
export function ReceivableCollectDialog({ row, onClose, onDone }: { row: SupplierReceivableRow | null; onClose: () => void; onDone: () => void }) {
  const f = useFinanceFormat()
  const owes = row ? Math.abs(Math.min(0, row.net)) : 0
  const [mode, setMode] = useState<"receive" | "offset">("receive")
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [accountId, setAccountId] = useState("")
  const [method, setMethod] = useState("cash")
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(f.today)
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!row) return
    setMode("receive"); setErr(""); setBusy(false); setReference(""); setNote(""); setMethod("cash"); setDate(f.today)
    setAmount(String(Math.round(Math.abs(Math.min(0, row.net)) * 100) / 100))
    financeApi.getAccounts({ includeInactive: false }).then((r) => {
      setAccounts(r.accounts)
      const def = r.accounts.find((a) => a.isDefault) ?? r.accounts[0]
      setAccountId(def ? String(def.id) : "")
    }).catch(() => setAccounts([]))
  }, [row]) // eslint-disable-line react-hooks/exhaustive-deps

  const amt = Number(amount) || 0

  const submit = async () => {
    if (!row) return
    if (!(amt > 0)) { setErr("Amount must be greater than zero."); return }
    if (amt > owes + 0.005) { setErr(`Amount is more than the supplier owes you (${f.money(owes)}).`); return }
    if (!date) { setErr("Choose the date."); return }
    setBusy(true); setErr("")
    try {
      await financeApi.receiveFromSupplier(row.vendorId, {
        amount: amt, date, accountId: accountId ? Number(accountId) : undefined, method,
        reference: reference.trim() || undefined, note: note.trim() || undefined,
      })
      toast.success(`Received ${f.money(amt)} from ${row.displayName}`)
      onDone(); onClose()
    } catch (e) {
      setErr(financeError(e, "Could not record the payment."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Collect from {row?.displayName}</DialogTitle>
          <DialogDescription>Their credits (returns credited to you) are larger than what you owe them.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <StatTile label="They owe you" value={f.money(owes)} className="p-3"
            hint={row ? `Credits ${f.money(row.credits)} − owed to them ${f.money(row.owed)}` : undefined} />
          <SegmentedControl aria-label="How to settle" value={mode} onValueChange={(v) => setMode(v as typeof mode)}
            options={[{ value: "receive", label: "Record payment received" }, { value: "offset", label: "Offset against next payout" }]} />
          {mode === "offset" ? (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              Nothing to post. Supplier credits are already taken off what is payable to them: the next bill from {row?.displayName} is reduced by {f.money(owes)} on{" "}
              <Link href="/dashboard/finance/payouts" className="font-medium text-foreground underline underline-offset-2">Payouts</Link>.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Amount" htmlFor="rcv-amount" required>
                <Input id="rcv-amount" type="number" inputMode="decimal" min="0" step="0.01" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </FormField>
              <FormField label="Date" htmlFor="rcv-date" required>
                <DatePicker id="rcv-date" max="today" value={date} onChange={setDate} />
              </FormField>
              <FormField label="Into account" htmlFor="rcv-account">
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="rcv-account" className="w-full"><SelectValue placeholder="Default account" /></SelectTrigger>
                  <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label="Method" htmlFor="rcv-method">
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger id="rcv-method" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{METHOD_KEYS.filter(([k]) => k !== "cod").map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label="Reference (optional)" htmlFor="rcv-ref" className="sm:col-span-2">
                <Input id="rcv-ref" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} />
              </FormField>
              <FormField label="Note (optional)" htmlFor="rcv-note" className="sm:col-span-2">
                <Textarea id="rcv-note" rows={2} value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
              </FormField>
            </div>
          )}
          {err && <p className="text-sm font-medium text-destructive" role="alert">{err}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{mode === "offset" ? "Close" : "Cancel"}</Button>
          {mode === "receive" && <Button type="button" onClick={submit} disabled={busy}>{busy ? "Saving…" : `Record ${f.money(amt)} received`}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
