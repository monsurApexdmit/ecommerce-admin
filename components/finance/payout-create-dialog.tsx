"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Search } from "lucide-react"
import financeApi, { financeError, type PayableDocument, type PayableResult, type PayableRow } from "@/lib/financeApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { WithTooltip } from "@/components/common/WithTooltip"
import { cn } from "@/lib/utils"
import { SettleDueDialog, type SettleTarget } from "./settle-due-dialog"
import { SalaryPayDialog, TailorPaymentDialog, type SalaryPayTarget, type TailorPayTarget } from "./payout-dialogs"
import { useFinanceFormat } from "./finance-ui"

export const PAYEE_TYPE_LABEL: Record<string, string> = { supplier: "Supplier", dorji: "Dorji", staff: "Staff" }

export interface PayoutPick { type: string; id: number }

/** Owed → not yet due → credits → payable now, as a sum that adds up (PO-2). */
export function PayableBreakdown({ row, money, date }: { row: PayableRow; money: (n: number) => string; date: (d?: string | null) => string }) {
  const lines = row.breakdown.length ? row.breakdown : [
    { key: "owed", label: "Owed", amount: row.owed },
    { key: "not_yet_due", label: "Not yet due", amount: -row.notYetDue },
    { key: "credits", label: "Credits they owe you", amount: -row.credits },
    { key: "payable_now", label: "Payable now", amount: row.payableNow },
  ]
  return (
    <div className="rounded-lg border p-3 text-sm">
      <dl className="grid gap-1.5">
        {lines.map((l) => {
          const total = l.key === "payable_now"
          return (
            <div key={l.key} className={cn("flex items-baseline justify-between gap-4", total && "mt-1 border-t pt-2 font-semibold", !total && l.key !== "owed" && "pl-3 text-muted-foreground")}>
              <dt>{total ? "= " : l.key !== "owed" ? "− " : ""}{l.label}</dt>
              <dd className={cn("tabular-nums", total && l.amount < 0 && "text-destructive")}>
                {l.amount < 0 && !total ? money(Math.abs(l.amount)) : l.amount < 0 ? `−${money(Math.abs(l.amount))}` : money(l.amount)}
              </dd>
            </div>
          )
        })}
      </dl>
      {row.nextDue && <p className="mt-2 text-xs text-muted-foreground">{money(row.nextDue.amount)} becomes payable on {date(row.nextDue.date)}.</p>}
      {row.status === "they_owe_you" && <p className="mt-2 text-xs text-muted-foreground">Their credits are larger than what you owe — collect it from Receivables.</p>}
    </div>
  )
}

function PartyButton({ row, onPick, money }: { row: PayableRow; onPick: (r: PayableRow) => void; money: (n: number) => string }) {
  const zero = row.payableNow <= 0
  return (
    <Button type="button" variant="ghost" onClick={() => onPick(row)}
      className={cn("h-auto w-full justify-between rounded-none border-b px-3 py-2.5 text-left last:border-b-0", zero && "text-muted-foreground")}>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{row.displayName}</span>
          <Badge variant="outline" className="px-1.5 font-normal">{PAYEE_TYPE_LABEL[row.type] ?? row.type}</Badge>
        </span>
        <span className="block text-xs font-normal text-muted-foreground">Owed {money(row.owed)}{row.notYetDue ? ` · ${money(row.notYetDue)} not yet due` : ""}{row.credits ? ` · ${money(row.credits)} credits` : ""}</span>
      </span>
      <span className={cn("font-semibold tabular-nums", zero ? "text-muted-foreground" : "")}>{zero ? (row.payableNow < 0 ? "They owe you" : money(0)) : money(row.payableNow)}</span>
    </Button>
  )
}

/**
 * Create payout (PO-1…PO-4): pick a supplier / dorji / staff member by what is payable now, see the breakdown,
 * then pay through the existing pay flows (supplier dues, payslips, dorji payouts).
 */
export function PayoutCreateDialog({ open, initial, onClose, onDone }: { open: boolean; initial: PayoutPick | null; onClose: () => void; onDone: () => void }) {
  const f = useFinanceFormat()
  const { canWrite } = useSaasAuth()
  const [data, setData] = useState<PayableResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [q, setQ] = useState("")
  const [picked, setPicked] = useState<PayableRow | null>(null)
  const [docs, setDocs] = useState<PayableDocument[] | null>(null)
  const [settle, setSettle] = useState<SettleTarget | null>(null)
  const [salary, setSalary] = useState<SalaryPayTarget | null>(null)
  const [tailor, setTailor] = useState<TailorPayTarget | null>(null)

  useEffect(() => {
    if (!open) return
    setQ(""); setErr(""); setPicked(null); setDocs(null); setLoading(true)
    financeApi.getPayable()
      .then((r) => {
        setData(r)
        if (initial) {
          const row = r.rows.find((x) => x.type === initial.type && x.id === initial.id)
          if (row) setPicked(row)
          else setErr(`Nothing is owed to this ${PAYEE_TYPE_LABEL[initial.type]?.toLowerCase() ?? "payee"} right now.`)
        }
      })
      .catch((e) => setErr(financeError(e, "Could not load who can be paid.")))
      .finally(() => setLoading(false))
  }, [open, initial])

  useEffect(() => {
    setDocs(null)
    if (!picked || picked.type === "dorji") return
    let live = true
    financeApi.getPayableParty(picked.type, picked.id).then((r) => { if (live) setDocs(r.documents) }).catch(() => { if (live) setDocs([]) })
    return () => { live = false }
  }, [picked])

  const match = (r: PayableRow) => !q.trim() || r.displayName.toLowerCase().includes(q.trim().toLowerCase())
  const payable = useMemo(() => (data?.payable ?? []).filter(match), [data, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const nothing = useMemo(() => (data?.nothingPayable ?? []).filter(match), [data, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const canPay = (t: string) => (t === "supplier" ? canWrite("Dues") : t === "staff" ? canWrite("Salary Management") : canWrite("TailorPayments"))

  const pay = () => {
    if (!picked) return
    if (picked.type === "supplier") {
      const due = (docs ?? []).filter((d) => !d.notYetDue)
      setSettle({ party: "vendors", id: picked.id, name: picked.displayName, preselect: due.map((d) => ({ type: d.documentType, id: d.documentId })), suggestedAmount: picked.payableNow > 0 ? picked.payableNow : undefined })
    } else if (picked.type === "dorji") {
      setTailor({ kind: "dorji", id: picked.id })
    }
  }

  const done = () => { onDone(); onClose() }
  const subOpen = !!settle || !!salary || !!tailor

  return (
    <>
      <Dialog open={open && !subOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{picked ? `Pay ${picked.displayName}` : "Create payout"}</DialogTitle>
            <DialogDescription>{picked ? `${PAYEE_TYPE_LABEL[picked.type] ?? picked.type} · as things stand now` : "Who can be paid now, highest first. Amounts are as things stand now."}</DialogDescription>
          </DialogHeader>

          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

          {!picked ? (
            <>
              <InputGroup>
                <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
                <InputGroupInput aria-label="Search payees" placeholder="Supplier, dorji or staff name…" value={q} onChange={(e) => setQ(e.target.value)} />
              </InputGroup>
              <div className="max-h-96 overflow-y-auto rounded-lg border">
                {loading && !data ? (
                  <div className="flex flex-col gap-2 p-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div>
                ) : payable.length === 0 && nothing.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">{q ? "No payee matches." : "Nobody is owed anything."}</p>
                ) : (
                  <>
                    {payable.map((r) => <PartyButton key={`${r.type}-${r.id}`} row={r} onPick={setPicked} money={f.money} />)}
                    {nothing.length > 0 && (
                      <>
                        <p className="border-b bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">Nothing payable</p>
                        {nothing.map((r) => <PartyButton key={`${r.type}-${r.id}`} row={r} onPick={setPicked} money={f.money} />)}
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <PayableBreakdown row={picked} money={f.money} date={f.date} />
              {picked.type === "staff" && (
                <div className="rounded-lg border">
                  {docs == null ? <Skeleton className="m-3 h-10" /> : docs.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No unpaid payslips.</p>
                  ) : docs.map((d) => (
                    <div key={`${d.documentType}-${d.documentId}`} className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{d.no || "Payslip"}</span>
                        {d.notYetDue && <Badge variant="secondary" className="ml-2">Not yet due</Badge>}
                      </span>
                      <span className="tabular-nums">{f.money(d.due)}</span>
                      {canPay("staff") && d.salaryPaymentId != null && (
                        <Button type="button" size="sm" variant="outline"
                          onClick={() => setSalary({ paymentId: d.salaryPaymentId!, name: picked.displayName, amount: d.due, month: d.monthLabel ?? d.no, method: d.method })}>Pay</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {picked.type === "supplier" && docs && docs.some((d) => d.notYetDue) && (
                <p className="text-xs text-muted-foreground">Bills not yet due are left unticked in the next step; you can still include them.</p>
              )}
            </div>
          )}

          <DialogFooter>
            {picked && !initial && (
              <WithTooltip content="Back to the list">
                <Button type="button" variant="ghost" size="icon" aria-label="Back to the list" onClick={() => setPicked(null)}><ArrowLeft className="size-4" aria-hidden /></Button>
              </WithTooltip>
            )}
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            {picked && picked.type !== "staff" && (
              picked.payableNow > 0 && canPay(picked.type) ? (
                <Button type="button" onClick={pay} disabled={picked.type === "supplier" && docs == null}>Continue to pay {f.money(picked.payableNow)}</Button>
              ) : (
                <WithTooltip content={!canPay(picked.type) ? "You don't have permission to pay this." : picked.nextDue ? `${f.money(picked.nextDue.amount)} becomes payable on ${f.date(picked.nextDue.date)}` : "Nothing is payable now."}>
                  <span tabIndex={0}><Button type="button" disabled>Continue to pay</Button></span>
                </WithTooltip>
              )
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SettleDueDialog target={settle} onClose={() => setSettle(null)} onDone={done} />
      <SalaryPayDialog target={salary} onClose={() => setSalary(null)} onDone={done} />
      <TailorPaymentDialog target={tailor} onClose={() => setTailor(null)} onDone={done} />
    </>
  )
}
