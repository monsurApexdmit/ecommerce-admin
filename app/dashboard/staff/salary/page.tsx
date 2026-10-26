"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Banknote, Check, Clock, Download, Printer, Trash2, Users, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { staffUiApi, type Payroll, type PayrollRow, type StaffSalarySummary } from "@/lib/staffApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

const HIST_SIZE = 5
const METHODS = ["Cash", "bKash", "Bank transfer", "Check"]
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-dash-warn-soft text-dash-warn-fg" },
  paid: { label: "Paid", cls: "bg-dash-success-soft text-dash-success-fg" },
  not_generated: { label: "Not generated", cls: "bg-dash-neutral-soft text-dash-neutral-fg" },
}
const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent disabled:opacity-60"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Salary</h1>
          <p className="mt-1 text-sm text-dash-muted">Run monthly payroll with bonuses, advances and leave — then pay in one go.</p>
        </div>
        {canGenerate && <button type="button" disabled={busy} onClick={generate} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-40">Generate {data?.label} payroll</button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Month" className="flex gap-1.5">
          {(data?.months ?? [{ month, label: month }]).map((m) => (
            <button key={m.month} type="button" aria-pressed={month === m.month} onClick={() => { setMonth(m.month); setPage(1); setSelId(null) }}
              className={cn("h-10 rounded-full border px-3.5 text-[13px] font-semibold", month === m.month ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{m.label}</button>
          ))}
        </div>
        {data && <span className="text-[13px] text-dash-muted">Payday: <strong className="text-dash-ink">{fmtD(data.payday)}</strong> · {data.daysLeft >= 0 ? `${data.daysLeft} day${data.daysLeft === 1 ? "" : "s"} left` : `${Math.abs(data.daysLeft)} days ago`}</span>}
      </div>

      {loading || !s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[110px] rounded-[14px]" />)}</div>
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
        <section className="w-full min-w-0 flex-1 rounded-[14px] border border-dash-border bg-dash-card">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <h2 className="font-dash-display text-base font-bold">Payroll · {data?.label ?? month}</h2>
            <div className="flex gap-2">
              <button type="button" onClick={handleExport} className={outlineBtn}><Download className="size-4" aria-hidden /> Export</button>
              <button type="button" disabled={busy || !s || s.pendingCount === 0} onClick={payAll} className="h-11 rounded-[10px] bg-dash-ink px-4 text-[13px] font-semibold text-dash-bg disabled:opacity-40">Pay all pending · {formatCurrency(s?.pendingNet ?? 0)}</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                  <th className="py-3 pl-4 pr-2 font-semibold">Staff</th><th className="px-2 py-3 text-right font-semibold">Base</th><th className="px-2 py-3 text-right font-semibold">+ Bonus / OT</th>
                  <th className="px-2 py-3 text-right font-semibold">− Advance / leave</th><th className="px-2 py-3 text-right font-semibold">Net pay</th><th className="px-2 py-3 font-semibold">Method</th>
                  <th className="px-2 py-3 font-semibold">Status</th><th className="py-3 pl-2 pr-4 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? [1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-11 rounded" /></td></tr>) :
                  pageRows.length === 0 ? (
                    <tr><td colSpan={8} className="py-14 text-center"><Users className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                      <p className="font-semibold">No one on payroll</p><p className="text-sm text-dash-muted">Add a monthly salary to a staff member first.</p></td></tr>
                  ) : pageRows.map((r) => (
                    <tr key={r.staffId} className={selId === r.staffId ? "bg-dash-accent-soft/40" : ""}>
                      <td className="border-b border-dash-border-soft py-3 pl-4 pr-2"><button type="button" onClick={() => pick(r)} className="flex flex-col text-left"><span className="font-semibold">{r.name}</span><span className="text-xs text-dash-muted">{r.role ?? "—"}</span></button></td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">{formatCurrency(r.base)}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">{r.bonus ? formatCurrency(r.bonus) : "—"}{r.bonusNote && <div className="text-xs text-dash-muted">{r.bonusNote}</div>}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">{r.deduction ? formatCurrency(r.deduction) : "—"}{r.deductionNote && <div className="text-xs text-dash-muted">{r.deductionNote}</div>}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-right font-bold tabular-nums">{formatCurrency(r.net)}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3">{r.method ?? "—"}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3"><span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", STATUS[r.status].cls)}>{STATUS[r.status].label}</span></td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === "pending" && <button type="button" disabled={busy} onClick={() => setConfirmPay(r)} className="h-9 rounded-lg bg-dash-ink px-3 text-[13px] font-semibold text-dash-bg disabled:opacity-40">Pay {formatCurrency(r.net)}</button>}
                          {r.status === "paid" && (
                            <>
                              <button type="button" onClick={() => pick(r)} className="text-[13px] font-semibold text-dash-accent hover:underline">Payslip</button>
                              <button type="button" aria-label={`Delete payment record for ${r.name}`} title="Delete payment record" disabled={busy} onClick={() => reverse(r)}
                                className="flex size-9 items-center justify-center rounded-lg border border-dash-border hover:bg-dash-neutral-soft"><Trash2 className="size-4" /></button>
                            </>
                          )}
                                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot><tr className="font-bold"><td className="px-4 py-3">Total</td><td className="px-2 py-3 text-right tabular-nums">{formatCurrency(tot.base)}</td><td className="px-2 py-3 text-right tabular-nums">{formatCurrency(tot.add)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{formatCurrency(tot.ded)}</td><td className="px-2 py-3 text-right tabular-nums">{formatCurrency(tot.net)}</td><td colSpan={3} /></tr></tfoot>
              )}
            </table>
          </div>
          {!loading && rows.length > 0 && (
            <div className="p-4 pt-3"><PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(rows.length / perPage))} itemsPerPage={perPage} totalItems={rows.length}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
          )}
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-5 xl:w-[360px]">
          <div className="flex items-center justify-between"><h2 className="font-dash-display text-lg font-bold">Payslip</h2><span className="text-xs text-dash-muted">{data?.label ?? month}</span></div>
          {!sel ? <p className="py-8 text-center text-sm text-dash-muted">Pick a person to see and adjust their payslip.</p> : (
            <>
              <div className="flex flex-col gap-1.5 rounded-xl bg-dash-bg p-3.5 text-[13px]">
                <div className="text-sm font-bold">{sel.name}</div>
                <div className="text-xs text-dash-muted">{sel.role ?? "—"} · joined {fmtD(sel.joined)}</div>
                <div className="mt-1 flex justify-between"><span className="text-dash-muted">Base salary</span><span className="tabular-nums">{formatCurrency(sel.base)}</span></div>
                <div className="flex justify-between"><span className="text-dash-muted">+ Bonus / OT</span><span className="tabular-nums">{formatCurrency(Number(bonus) || 0)}</span></div>
                <div className="flex justify-between"><span className="text-dash-muted">− Advance / leave</span><span className="tabular-nums">{formatCurrency(Number(deduct) || 0)}</span></div>
                <div className="flex justify-between border-t border-dashed border-dash-border pt-2"><strong>Net pay</strong><strong className="font-dash-display text-lg tabular-nums">{formatCurrency(previewNet)}</strong></div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Add bonus (৳)<input type="number" min={0} step="any" disabled={locked} className={input} value={bonus} onChange={(e) => setBonus(e.target.value)} /></label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Deduct (৳)<input type="number" min={0} step="any" disabled={locked} className={input} value={deduct} onChange={(e) => setDeduct(e.target.value)} /></label>
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Paid via<select disabled={locked} className={input} value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
              <div className="flex gap-2">
                {!locked && <button type="button" disabled={busy} onClick={saveAdjust} className="h-11 flex-1 rounded-[10px] bg-dash-accent text-sm font-semibold text-white disabled:opacity-40">Save payslip</button>}
                <button type="button" onClick={printSlip} className={cn(outlineBtn, "flex-1")}><Printer className="size-4" aria-hidden /> Print payslip</button>
              </div>
              <div className="flex flex-col gap-1.5 border-t border-dash-border-soft pt-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Salary history · {sel.name}</h3>
                {!hist ? <Skeleton className="h-12 rounded-lg" /> : hist.history.length === 0 ? <span className="text-[13px] text-dash-muted">No salary records yet.</span> : hist.history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-[13px]"><span>{h.label}</span><span className="flex items-center gap-2"><strong className="tabular-nums">{formatCurrency(h.net)}</strong>
                    <span className={cn("rounded-full px-2 py-px text-[11px] font-bold", h.status === "paid" ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-warn-soft text-dash-warn-fg")}>{h.status}</span></span></div>
                ))}
              </div>
              <span aria-live="polite" className="flex h-4 items-center gap-1 text-xs text-dash-muted">
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? <><Check className="size-3.5 text-dash-success-fg" aria-hidden /> Saved</> : !locked ? "Changes save automatically" : null}
              </span>
              <span className="text-xs text-dash-muted">Paid salaries are added to Expenses → Salaries automatically.</span>
            </>
          )}
        </aside>
      </div>

      {ungenerated.length > 0 && (
        <section aria-label="Not generated" className="rounded-[14px] border border-dashed border-dash-border bg-dash-card">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
            <div>
              <h2 className="font-dash-display text-base font-bold">Not generated yet · {ungenerated.length}</h2>
              <p className="text-sm text-dash-muted">These people have no {data?.label} payslip. Generate payroll to add them.</p>
            </div>
            <button type="button" disabled={busy} onClick={generate} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-40">Generate {data?.label} payroll</button>
          </div>
          <ul className="divide-y divide-dash-border-soft">
            {ungenerated.map((r) => (
              <li key={r.staffId} className="flex items-center justify-between px-5 py-3 text-sm">
                <span><span className="font-semibold">{r.name}</span> <span className="text-xs text-dash-muted">{r.role ?? "—"}</span></span>
                <span className="tabular-nums text-dash-muted">{formatCurrency(r.base)}</span>
              </li>
            ))}
          </ul>
        </section>
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

      <section aria-label="History" className="rounded-[14px] border border-dash-border bg-dash-card">
        <h2 className="p-5 pb-3 font-dash-display text-base font-bold">Payroll history</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead><tr className="bg-dash-bg text-left text-xs text-dash-muted"><th className="py-3 pl-5 pr-2 font-semibold">Month</th><th className="px-2 py-3 font-semibold">People</th><th className="px-2 py-3 text-right font-semibold">Net payroll</th>
              <th className="px-2 py-3 text-right font-semibold">Paid</th><th className="px-2 py-3 text-right font-semibold">Pending</th><th className="py-3 pl-2 pr-5 text-right font-semibold">Open</th></tr></thead>
            <tbody>
              {hRows.map((h) => (
                <tr key={h.month}><td className="border-t border-dash-border-soft py-3 pl-5 pr-2 font-semibold">{h.label}</td><td className="border-t border-dash-border-soft px-2 py-3 tabular-nums">{h.people}</td>
                  <td className="border-t border-dash-border-soft px-2 py-3 text-right tabular-nums">{formatCurrency(h.net)}</td><td className="border-t border-dash-border-soft px-2 py-3 text-right tabular-nums">{formatCurrency(h.paid)}</td>
                  <td className="border-t border-dash-border-soft px-2 py-3 text-right tabular-nums">{formatCurrency(h.pending)}</td>
                  <td className="border-t border-dash-border-soft py-3 pl-2 pr-5 text-right"><button type="button" onClick={() => { setMonth(h.month); window.scrollTo({ top: 0, behavior: "smooth" }) }} className="text-[13px] font-semibold text-dash-accent hover:underline">View</button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.history ?? []).length === 0 && <div className="px-5 pb-5 text-sm text-dash-muted">No payroll has been generated yet.</div>}
        {(data?.history ?? []).length > HIST_SIZE && <div className="p-4"><PaginationControl currentPage={histPage} totalPages={Math.ceil((data?.history.length ?? 0) / HIST_SIZE)} itemsPerPage={HIST_SIZE} totalItems={data?.history.length ?? 0} onPageChange={setHistPage} onItemsPerPageChange={() => {}} /></div>}
      </section>
    </div>
  )
}
