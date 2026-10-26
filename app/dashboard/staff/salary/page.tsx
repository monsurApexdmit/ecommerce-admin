"use client"

import { Fragment, Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Banknote, Check, Clock, Download, Printer, Trash2, Users, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { PaginationControl } from "@/components/ui/pagination-control"
import { staffUiApi, type Payroll, type PayrollRow, type StaffSalarySummary } from "@/lib/staffApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { StatusBadge } from "@/components/common/StatusBadge"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const HIST_SIZE = 5
const METHODS = ["Cash", "bKash", "Bank transfer", "Check"]
const STATUS: Record<string, { label: string }> = {
  pending: { label: "Pending" },
  paid: { label: "Paid" },
  not_generated: { label: "Not generated" },
}
const fmtD = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")
const curMonth = () => new Date().toISOString().slice(0, 7)

export default function SalaryPage() {
  return <Suspense fallback={null}><SalaryInner /></Suspense>
}

function SalaryInner() {
  const searchParams = useSearchParams()
  const staffParam = Number(searchParams.get("staff")) || null
  const staffApplied = useRef(false)
  const { formatCurrency } = useCompanySettings()
  const blocked = useModuleGuard("Staff")

  const [month, setMonth] = useState(curMonth())
  const [data, setData] = useState<Payroll | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [histPage, setHistPage] = useState(1)

  const [selId, setSelId] = useState<number | null>(null)
  const [bonus, setBonus] = useState("")
  const [deduct, setDeduct] = useState("")
  const [method, setMethod] = useState("Cash")
  const [hist, setHist] = useState<StaffSalarySummary | null>(null)
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle")
  const [confirmPay, setConfirmPay] = useState<PayrollRow | null>(null)

  const load = useCallback(async (m = month) => {
    try { setData(await staffUiApi.getPayroll(m)) } catch (e: any) { setData(null); toast.error(e?.response?.data?.message || "Failed to load payroll") } finally { setLoading(false) }
  }, [month])
  useEffect(() => { setLoading(true); load(month) }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  const allRows = data?.rows ?? []
  const rows = allRows.filter((r) => r.status !== "not_generated")
  const ungenerated = allRows.filter((r) => r.status === "not_generated")
  const sel = rows.find((r) => r.staffId === selId) ?? null
  const locked = sel?.status === "paid"

  const pick = async (r: PayrollRow) => {
    setSaveState("idle"); setSelId(r.staffId); setBonus(r.bonus ? String(r.bonus) : ""); setDeduct(r.deduction ? String(r.deduction) : ""); setMethod(r.method || "Cash"); setHist(null)
    try { setHist(await staffUiApi.getSalarySummary(r.staffId)) } catch { setHist(null) }
  }

  // Deep link: ?staff=<id> opens that staff member's payslip once payroll loads
  useEffect(() => {
    if (staffApplied.current || !staffParam || !rows.length) return
    const r = rows.find((x) => x.staffId === staffParam)
    staffApplied.current = true
    if (r) { pick(r); const i = rows.indexOf(r); setPage(Math.floor(i / perPage) + 1) }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // Preselect the first generated row when nothing is selected (after the ?staff= link had its chance)
  useEffect(() => {
    if (selId || !rows.length || (staffParam && !staffApplied.current)) return
    pick(rows[0])
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave edited payslip fields (debounced); the Save button still works
  useEffect(() => {
    if (!sel || !sel.paymentId || sel.status !== "pending") return
    const b = Number(bonus) || 0, d = Number(deduct) || 0
    if (b === sel.bonus && d === sel.deduction && method === (sel.method || "Cash")) return
    if (b < 0 || d < 0 || d > sel.base + b) return
    const id = sel.paymentId, sid = sel.staffId
    const t = setTimeout(async () => {
      setSaveState("saving")
      try {
        await staffUiApi.adjustPayment(id, { bonus: b, deduction: d, method })
        setSaveState("saved"); await load()
      } catch (e: any) { setSaveState("idle"); toast.error(e?.response?.data?.message || "Could not save the payslip.") }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonus, deduct, method, sel?.staffId, sel?.bonus, sel?.deduction, sel?.method])

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true)
    try { await fn(); toast.success(ok); await load() } catch (e: any) { toast.error(e?.response?.data?.message || "That did not work.") } finally { setBusy(false) }
  }

  const generate = () => act(() => staffUiApi.generatePayroll(month), `${data?.label ?? month} payroll generated`)
  const payOne = (r: PayrollRow) => { setConfirmPay(null); return r.paymentId && act(() => staffUiApi.payPayment(r.paymentId!, { method: r.method ?? undefined }), `Paid ${formatCurrency(r.net)} to ${r.name}`) }
  const payAll = () => {
    if (!window.confirm(`Pay all pending salaries (${formatCurrency(data?.stats.pendingNet ?? 0)})?`)) return
    act(() => staffUiApi.payAll(month), "Pending salaries paid")
  }
  const reverse = (r: PayrollRow) => {
    if (!r.paymentId || !window.confirm(`Delete the payment record for ${r.name}? The linked expense is removed.`)) return
    act(() => staffUiApi.reversePayment(r.paymentId!), "Payment record deleted")
  }
  const saveAdjust = async () => {
    if (!sel) return
    if (!sel.paymentId) { toast.error("Generate the payroll first."); return }
    const b = Number(bonus) || 0, d = Number(deduct) || 0
    if (b < 0 || d < 0) { toast.error("Amounts cannot be negative."); return }
    if (d > sel.base + b) { toast.error("The deduction is more than the pay."); return }
    await act(() => staffUiApi.adjustPayment(sel.paymentId!, { bonus: b, deduction: d, method }), "Payslip updated")
    setSaveState("saved")
  }

  const printSlip = () => {
    if (!sel) return
    const w = window.open("", "_blank", "width=640,height=760")
    if (!w) { toast.error("Allow pop-ups to print"); return }
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))
    const b = Number(bonus) || 0, d = Number(deduct) || 0
    w.document.write(`<!doctype html><title>Payslip</title><body style="font-family:sans-serif;padding:28px">
      <h2 style="margin:0">Payslip — ${esc(data?.label ?? month)}</h2>
      <p style="color:#5B6478">${esc(sel.name)} · ${esc(sel.role ?? "")} · joined ${fmtD(sel.joined)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px">
        <tr><td style="padding:6px 0">Base salary</td><td style="text-align:right">${formatCurrency(sel.base)}</td></tr>
        <tr><td style="padding:6px 0">+ Bonus / OT</td><td style="text-align:right">${formatCurrency(b)}</td></tr>
        <tr><td style="padding:6px 0">− Advance / leave</td><td style="text-align:right">${formatCurrency(d)}</td></tr>
        <tr><td style="padding:10px 0;border-top:1px solid #ccc"><strong>Net pay</strong></td><td style="text-align:right;border-top:1px solid #ccc"><strong>${formatCurrency(Math.max(0, sel.base + b - d))}</strong></td></tr>
      </table><p style="color:#5B6478">Paid via ${esc(method)} · ${esc(STATUS[sel.status].label)}</p></body>`)
    w.document.close(); w.focus(); w.print()
  }

  const handleExport = () => {
    exportToCSV(rows.map((r) => ({ staff: r.name, role: r.role ?? "", base: r.base, bonus: r.bonus, deduction: r.deduction, net: r.net, method: r.method ?? "", status: STATUS[r.status].label })),
      `payroll-${month}`, ["staff", "role", "base", "bonus", "deduction", "net", "method", "status"])
  }

  if (blocked) return blocked

  const s = data?.stats
  const pageRows = rows.slice((page - 1) * perPage, page * perPage)
  const hRows = (data?.history ?? []).slice((histPage - 1) * HIST_SIZE, histPage * HIST_SIZE)
  const tot = rows.reduce((a, r) => ({ base: a.base + r.base, add: a.add + r.bonus, ded: a.ded + r.deduction, net: a.net + r.net }), { base: 0, add: 0, ded: 0, net: 0 })
  const canGenerate = !!s && s.notGenerated > 0
  const previewNet = sel ? Math.max(0, sel.base + (Number(bonus) || 0) - (Number(deduct) || 0)) : 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Salary"
        description="Run monthly payroll with bonuses, advances and leave — then pay in one go."
        actions={canGenerate && <Button type="button" disabled={busy} onClick={generate}>Generate {data?.label} payroll</Button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Month" className="flex gap-1.5">
          {(data?.months ?? [{ month, label: month }]).map((m) => (
            <Button key={m.month} type="button" size="sm" variant={month === m.month ? "default" : "outline"} aria-pressed={month === m.month} onClick={() => { setMonth(m.month); setPage(1); setSelId(null) }}>{m.label}</Button>
          ))}
        </div>
        {data && <span className="text-sm text-muted-foreground">Payday: <strong className="text-foreground">{fmtD(data.payday)}</strong> · {data.daysLeft >= 0 ? `${data.daysLeft} day${data.daysLeft === 1 ? "" : "s"} left` : `${Math.abs(data.daysLeft)} days ago`}</span>}
      </div>

      {loading || !s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: "Base salaries", value: formatCurrency(s.baseTotal), icon: <Users className="size-4" />, color: "blue", hint: `${s.peopleCount} ${s.peopleCount === 1 ? "person" : "people"} on payroll` },
          { label: "Net to pay", value: formatCurrency(s.netTotal), icon: <Wallet className="size-4" />, color: "purple", hint: "After bonus & deductions" },
          { label: "Paid", value: formatCurrency(s.paid), icon: <Banknote className="size-4" />, color: "green", hint: `${s.paidCount} paid` },
          { label: "Still pending", value: formatCurrency(s.pendingNet), icon: <Clock className="size-4" />, color: "yellow", hint: `${s.pendingCount} ${s.pendingCount === 1 ? "person" : "people"}${s.notGenerated ? ` · ${s.notGenerated} not generated yet` : ""}` },
          { label: "Paid this year", value: formatCurrency(s.paidThisYear), icon: <Banknote className="size-4" />, color: "green", hint: `Jan – ${new Date().toLocaleDateString("en-US", { month: "short" })} ${new Date().getFullYear()}` },
        ]} />
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full min-w-0 flex-1 gap-0 pb-0 pt-4">
          <CardHeader className="px-4 pb-4">
            <CardTitle>Payroll · {data?.label ?? month}</CardTitle>
            <CardAction className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export</Button>
              <Button type="button" disabled={busy || !s || s.pendingCount === 0} onClick={payAll}>Pay all pending · {formatCurrency(s?.pendingNet ?? 0)}</Button>
            </CardAction>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Staff</TableHead><TableHead className="text-right">Base</TableHead><TableHead className="text-right">+ Bonus / OT</TableHead>
                  <TableHead className="text-right">− Advance / leave</TableHead><TableHead className="text-right">Net pay</TableHead><TableHead>Method</TableHead>
                  <TableHead>Status</TableHead><TableHead className="pr-4 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={8} className="px-4 py-3"><Skeleton className="h-11" /></TableCell></TableRow>) :
                  pageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={8}>
                      <EmptyState icon={Users} title="No one on payroll" description="Add a monthly salary to a staff member first." className="p-4 md:p-6" />
                    </TableCell></TableRow>
                  ) : pageRows.map((r) => (
                    <TableRow key={r.staffId} data-state={selId === r.staffId ? "selected" : undefined}>
                      <TableCell className="pl-4"><Button type="button" variant="ghost" onClick={() => pick(r)} className="h-auto flex-col items-start gap-0 text-left"><span className="font-semibold">{r.name}</span><span className="text-xs text-muted-foreground">{r.role ?? "—"}</span></Button></TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.base)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.bonus ? formatCurrency(r.bonus) : "—"}{r.bonusNote && <div className="text-xs text-muted-foreground">{r.bonusNote}</div>}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.deduction ? formatCurrency(r.deduction) : "—"}{r.deductionNote && <div className="text-xs text-muted-foreground">{r.deductionNote}</div>}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{formatCurrency(r.net)}</TableCell>
                      <TableCell>{r.method ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={r.status} label={STATUS[r.status].label} /></TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === "pending" && <Button type="button" size="sm" disabled={busy} onClick={() => setConfirmPay(r)}>Pay {formatCurrency(r.net)}</Button>}
                          {r.status === "paid" && (
                            <>
                              <Button type="button" variant="link" size="sm" onClick={() => pick(r)}>Payslip</Button>
                              <WithTooltip content="Delete payment record">
                                <span tabIndex={busy ? 0 : undefined} className="inline-flex">
                                  <Button type="button" variant="outline" size="icon" aria-label={`Delete payment record for ${r.name}`} disabled={busy} onClick={() => reverse(r)}><Trash2 className="size-4" /></Button>
                                </span>
                              </WithTooltip>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
              {rows.length > 0 && (
                <TableFooter><TableRow className="font-bold"><TableCell className="px-4">Total</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(tot.base)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(tot.add)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(tot.ded)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(tot.net)}</TableCell><TableCell colSpan={3} /></TableRow></TableFooter>
              )}
            </Table>
          </div>
          {!loading && rows.length > 0 && (
            <div className="p-4 pt-3"><PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(rows.length / perPage))} itemsPerPage={perPage} totalItems={rows.length}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
          )}
        </Card>

        <Card role="complementary" className="w-full shrink-0 gap-3.5 p-5 xl:w-[360px]">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Payslip</h2><span className="text-xs text-muted-foreground">{data?.label ?? month}</span></div>
          {!sel ? <p className="py-8 text-center text-sm text-muted-foreground">Pick a person to see and adjust their payslip.</p> : (
            <>
              <Card className="gap-1.5 bg-muted/50 p-3.5 text-sm shadow-none">
                <div className="font-semibold">{sel.name}</div>
                <div className="text-xs text-muted-foreground">{sel.role ?? "—"} · joined {fmtD(sel.joined)}</div>
                <InfoList className="mt-1 gap-1.5">
                  <InfoRow label="Base salary" value={<span className="font-normal tabular-nums">{formatCurrency(sel.base)}</span>} />
                  <InfoRow label="+ Bonus / OT" value={<span className="font-normal tabular-nums">{formatCurrency(Number(bonus) || 0)}</span>} />
                  <InfoRow label="− Advance / leave" value={<span className="font-normal tabular-nums">{formatCurrency(Number(deduct) || 0)}</span>} />
                  <Separator />
                  <InfoRow label={<strong className="text-foreground">Net pay</strong>} value={<span className="text-lg font-bold tabular-nums">{formatCurrency(previewNet)}</span>} />
                </InfoList>
              </Card>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Add bonus (৳)" htmlFor="salary-bonus"><Input id="salary-bonus" type="number" min={0} step="any" disabled={locked} value={bonus} onChange={(e) => setBonus(e.target.value)} /></FormField>
                <FormField label="Deduct (৳)" htmlFor="salary-deduct"><Input id="salary-deduct" type="number" min={0} step="any" disabled={locked} value={deduct} onChange={(e) => setDeduct(e.target.value)} /></FormField>
              </div>
              <FormField label="Paid via" htmlFor="salary-method"><Select disabled={locked} value={method} onValueChange={setMethod}><SelectTrigger id="salary-method" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></FormField>
              <div className="flex gap-2">
                {!locked && <Button type="button" disabled={busy} onClick={saveAdjust} className="flex-1">Save payslip</Button>}
                <Button type="button" variant="outline" onClick={printSlip} className="flex-1"><Printer className="size-4" aria-hidden /> Print payslip</Button>
              </div>
              <Separator />
              <div className="flex flex-col gap-1.5">
                <SectionTitle>Salary history · {sel.name}</SectionTitle>
                {!hist ? <Skeleton className="h-12" /> : hist.history.length === 0 ? <span className="text-sm text-muted-foreground">No salary records yet.</span> : hist.history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-sm"><span>{h.label}</span><span className="flex items-center gap-2"><strong className="tabular-nums">{formatCurrency(h.net)}</strong>
                    <StatusBadge status={h.status} variant={h.status === "paid" ? "default" : "secondary"} /></span></div>
                ))}
              </div>
              <span aria-live="polite" className="flex h-4 items-center gap-1 text-xs text-muted-foreground">
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? <><Check className="size-3.5" aria-hidden /> Saved</> : !locked ? "Changes save automatically" : null}
              </span>
              <span className="text-xs text-muted-foreground">Paid salaries are added to Expenses → Salaries automatically.</span>
            </>
          )}
        </Card>
      </div>

      {ungenerated.length > 0 && (
        <SectionCard
          aria-label="Not generated"
          className="border-dashed"
          title={`Not generated yet · ${ungenerated.length}`}
          description={`These people have no ${data?.label} payslip. Generate payroll to add them.`}
          actions={<Button type="button" disabled={busy} onClick={generate}>Generate {data?.label} payroll</Button>}
          contentClassName="px-0"
        >
          <ItemGroup>
            {ungenerated.map((r, i) => (
              <Fragment key={r.staffId}>
                {i > 0 && <ItemSeparator />}
                <Item size="sm" className="px-6">
                  <ItemContent className="flex-row items-baseline gap-1"><ItemTitle>{r.name}</ItemTitle><span className="text-xs text-muted-foreground">{r.role ?? "—"}</span></ItemContent>
                  <ItemActions className="tabular-nums text-muted-foreground">{formatCurrency(r.base)}</ItemActions>
                </Item>
              </Fragment>
            ))}
          </ItemGroup>
        </SectionCard>
      )}

      <AlertDialog open={!!confirmPay} onOpenChange={(o) => { if (!o) setConfirmPay(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pay {confirmPay?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Mark {confirmPay ? formatCurrency(confirmPay.net) : ""} as paid for {data?.label}. This is added to Expenses → Salaries.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmPay && payOne(confirmPay)}>Pay {confirmPay ? formatCurrency(confirmPay.net) : ""}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SectionCard aria-label="History" title="Payroll history" contentClassName="px-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[560px]">
            <TableHeader><TableRow><TableHead className="pl-6">Month</TableHead><TableHead>People</TableHead><TableHead className="text-right">Net payroll</TableHead>
              <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Pending</TableHead><TableHead className="pr-6 text-right">Open</TableHead></TableRow></TableHeader>
            <TableBody>
              {hRows.map((h) => (
                <TableRow key={h.month}><TableCell className="pl-6 font-semibold">{h.label}</TableCell><TableCell className="tabular-nums">{h.people}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(h.net)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(h.paid)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(h.pending)}</TableCell>
                  <TableCell className="pr-6 text-right"><Button type="button" variant="link" size="sm" onClick={() => { setMonth(h.month); window.scrollTo({ top: 0, behavior: "smooth" }) }}>View</Button></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {(data?.history ?? []).length === 0 && <div className="px-6 pt-2 text-sm text-muted-foreground">No payroll has been generated yet.</div>}
        {(data?.history ?? []).length > HIST_SIZE && <div className="px-4 pt-4"><PaginationControl currentPage={histPage} totalPages={Math.ceil((data?.history.length ?? 0) / HIST_SIZE)} itemsPerPage={HIST_SIZE} totalItems={data?.history.length ?? 0} onPageChange={setHistPage} onItemsPerPageChange={() => {}} /></div>}
      </SectionCard>
    </div>
  )
}
