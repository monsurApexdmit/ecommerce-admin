"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
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
import { FIN_NS, payeeText, type FinKey } from "./i18n"

/** Payable breakdown line keys from the API → label keys (server label is the fallback). */
const BREAKDOWN_KEY: Record<string, FinKey> = {
  owed: "finance:payable.owed",
  not_yet_due: "finance:payable.notYetDue",
  credits: "finance:payable.credits",
  payable_now: "finance:payable.payableNow",
}

export interface PayoutPick { type: string; id: number }

/** Owed → not yet due → credits → payable now, as a sum that adds up (PO-2). */
export function PayableBreakdown({ row, money, date }: { row: PayableRow; money: (n: number) => string; date: (d?: string | null) => string }) {
  const { t } = useTranslation(FIN_NS)
  const lines = row.breakdown.length ? row.breakdown : [
    { key: "owed", label: "", amount: row.owed },
    { key: "not_yet_due", label: "", amount: -row.notYetDue },
    { key: "credits", label: "", amount: -row.credits },
    { key: "payable_now", label: "", amount: row.payableNow },
  ]
  return (
    <div className="rounded-lg border p-3 text-sm">
      <dl className="grid gap-1.5">
        {lines.map((l) => {
          const total = l.key === "payable_now"
          return (
            <div key={l.key} className={cn("flex items-baseline justify-between gap-4", total && "mt-1 border-t pt-2 font-semibold", !total && l.key !== "owed" && "pl-3 text-muted-foreground")}>
              <dt>{total ? "= " : l.key !== "owed" ? "− " : ""}{BREAKDOWN_KEY[l.key] ? t(BREAKDOWN_KEY[l.key]) : l.label}</dt>
              <dd className={cn("tabular-nums", total && l.amount < 0 && "text-destructive")}>
                {l.amount < 0 && !total ? money(Math.abs(l.amount)) : l.amount < 0 ? `−${money(Math.abs(l.amount))}` : money(l.amount)}
              </dd>
            </div>
          )
        })}
      </dl>
      {row.nextDue && <p className="mt-2 text-xs text-muted-foreground">{t("finance:payable.becomesPayable", { amount: money(row.nextDue.amount), date: date(row.nextDue.date) })}.</p>}
      {row.status === "they_owe_you" && <p className="mt-2 text-xs text-muted-foreground">{t("finance:payable.theyOweHint")}</p>}
    </div>
  )
}

function PartyButton({ row, onPick, money }: { row: PayableRow; onPick: (r: PayableRow) => void; money: (n: number) => string }) {
  const { t } = useTranslation(FIN_NS)
  const zero = row.payableNow <= 0
  return (
    <Button type="button" variant="ghost" onClick={() => onPick(row)}
      className={cn("h-auto w-full justify-between rounded-none border-b px-3 py-2.5 text-left last:border-b-0", zero && "text-muted-foreground")}>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{row.displayName}</span>
          <Badge variant="outline" className="px-1.5 font-normal">{payeeText(t, row.type)}</Badge>
        </span>
        <span className="block text-xs font-normal text-muted-foreground">{t("finance:payable.owedAmount", { amount: money(row.owed) })}{row.notYetDue ? ` · ${t("finance:payable.notYetDueAmount", { amount: money(row.notYetDue) })}` : ""}{row.credits ? ` · ${t("finance:payable.creditsAmount", { amount: money(row.credits) })}` : ""}</span>
      </span>
      <span className={cn("font-semibold tabular-nums", zero ? "text-muted-foreground" : "")}>{zero ? (row.payableNow < 0 ? t("finance:payable.theyOweYou") : money(0)) : money(row.payableNow)}</span>
    </Button>
  )
}

/**
 * Create payout (PO-1…PO-4): pick a supplier / dorji / staff member by what is payable now, see the breakdown,
 * then pay through the existing pay flows (supplier dues, payslips, dorji payouts).
 */
export function PayoutCreateDialog({ open, initial, onClose, onDone }: { open: boolean; initial: PayoutPick | null; onClose: () => void; onDone: () => void }) {
  const f = useFinanceFormat()
  const { t } = useTranslation(FIN_NS)
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
          else setErr(t("finance:payoutCreate.nothingOwedTo", { payee: payeeText(t, initial.type).toLowerCase() }))
        }
      })
      .catch((e) => setErr(financeError(e, t("finance:payoutCreate.loadFailed"))))
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
            <DialogTitle>{picked ? t("finance:payoutCreate.payName", { name: picked.displayName }) : t("finance:payoutCreate.title")}</DialogTitle>
            <DialogDescription>{picked ? `${payeeText(t, picked.type)} · ${t("finance:period.asOfNow").toLowerCase()}` : t("finance:payoutCreate.description")}</DialogDescription>
          </DialogHeader>

          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

          {!picked ? (
            <>
              <InputGroup>
                <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
                <InputGroupInput aria-label={t("finance:payoutCreate.search")} placeholder={t("finance:payoutCreate.searchPh")} value={q} onChange={(e) => setQ(e.target.value)} />
              </InputGroup>
              <div className="max-h-96 overflow-y-auto rounded-lg border">
                {loading && !data ? (
                  <div className="flex flex-col gap-2 p-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div>
                ) : payable.length === 0 && nothing.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">{q ? t("finance:payoutCreate.noMatch") : t("finance:payoutCreate.nobodyOwed")}</p>
                ) : (
                  <>
                    {payable.map((r) => <PartyButton key={`${r.type}-${r.id}`} row={r} onPick={setPicked} money={f.money} />)}
                    {nothing.length > 0 && (
                      <>
                        <p className="border-b bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">{t("finance:payable.nothingPayable")}</p>
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
                    <p className="p-3 text-sm text-muted-foreground">{t("finance:payoutCreate.noPayslips")}</p>
                  ) : docs.map((d) => (
                    <div key={`${d.documentType}-${d.documentId}`} className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{d.no || t("finance:payoutCreate.payslip")}</span>
                        {d.notYetDue && <Badge variant="secondary" className="ml-2">{t("finance:payable.notYetDue")}</Badge>}
                      </span>
                      <span className="tabular-nums">{f.money(d.due)}</span>
                      {canPay("staff") && d.salaryPaymentId != null && (
                        <Button type="button" size="sm" variant="outline"
                          onClick={() => setSalary({ paymentId: d.salaryPaymentId!, name: picked.displayName, amount: d.due, month: d.month ? f.bucket(d.month.slice(0, 7), d.monthLabel ?? d.no) : d.monthLabel ?? d.no, method: d.method })}>{t("finance:actions.pay")}</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {picked.type === "supplier" && docs && docs.some((d) => d.notYetDue) && (
                <p className="text-xs text-muted-foreground">{t("finance:payoutCreate.notDueUnticked")}</p>
              )}
            </div>
          )}

          <DialogFooter>
            {picked && !initial && (
              <WithTooltip content={t("finance:payoutCreate.back")}>
                <Button type="button" variant="ghost" size="icon" aria-label={t("finance:payoutCreate.back")} onClick={() => setPicked(null)}><ArrowLeft className="size-4" aria-hidden /></Button>
              </WithTooltip>
            )}
            <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>
            {picked && picked.type !== "staff" && (
              picked.payableNow > 0 && canPay(picked.type) ? (
                <Button type="button" onClick={pay} disabled={picked.type === "supplier" && docs == null}>{t("finance:payoutCreate.continueAmount", { amount: f.money(picked.payableNow) })}</Button>
              ) : (
                <WithTooltip content={!canPay(picked.type) ? t("finance:payoutCreate.noPermission") : picked.nextDue ? t("finance:payable.becomesPayable", { amount: f.money(picked.nextDue.amount), date: f.date(picked.nextDue.date) }) : t("finance:payable.nothingNow")}>
                  <span tabIndex={0}><Button type="button" disabled>{t("finance:payoutCreate.continue")}</Button></span>
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
