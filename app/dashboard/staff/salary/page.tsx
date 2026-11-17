"use client"

import { Fragment, Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Banknote, Check, Clock, Download, Printer, Trash2, Users, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Trans, useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { localeTag } from "@/lib/i18n"
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
type K = ParseKeys<["account", "common"]>
// Method values are sent to the backend as-is; the map gives their display labels.
const METHODS = ["Cash", "bKash", "Bank transfer", "Check"]
const METHOD_KEY: Record<string, K> = {
  Cash: "account:staff.payMethods.cash", bKash: "account:staff.payMethods.bkash", "Bank transfer": "account:staff.payMethods.bank", Check: "account:staff.payMethods.check",
}
const STATUS: Record<string, { label: K }> = {
  pending: { label: "common:orderStatus.pending" },
  paid: { label: "common:payment.paid" },
  not_generated: { label: "account:staff.payroll.status.notGenerated" },
}
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
  const { t, i18n } = useTranslation(["account", "common"])
  const lang = localeTag(i18n.language)
  const fmtD = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(lang, { month: "short", day: "numeric", year: "numeric" }) : "—")
  /** "2026-11" → "Nov 2026" in the UI language; anything else (API label) as-is */
  const mLabel = (ym?: string | null, fallback?: string | null) => (ym && /^\d{4}-\d{2}$/.test(ym) ? new Date(`${ym}-01T12:00:00`).toLocaleDateString(lang, { month: "short", year: "numeric" }) : fallback ?? ym ?? "")
  const methodLabel = (m?: string | null) => (m && METHOD_KEY[m] ? t(METHOD_KEY[m]) : m ?? "")
  const statusLabel = (s: string) => (STATUS[s] ? t(STATUS[s].label) : s)

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
    try { setData(await staffUiApi.getPayroll(m)) } catch (e: any) { setData(null); toast.error(e?.response?.data?.message || t("account:staff.payroll.loadFailed")) } finally { setLoading(false) }
  }, [month]) // eslint-disable-line react-hooks/exhaustive-deps
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
    const timer = setTimeout(async () => {
      setSaveState("saving")
      try {
        await staffUiApi.adjustPayment(id, { bonus: b, deduction: d, method })
        setSaveState("saved"); await load()
      } catch (e: any) { setSaveState("idle"); toast.error(e?.response?.data?.message || t("account:staff.payroll.payslipSaveFailed")) }
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonus, deduct, method, sel?.staffId, sel?.bonus, sel?.deduction, sel?.method])

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true)
    try { await fn(); toast.success(ok); await load() } catch (e: any) { toast.error(e?.response?.data?.message || t("account:staff.payroll.failed")) } finally { setBusy(false) }
  }

  const curLabel = data ? mLabel(data.month, data.label) : mLabel(month)
  const generate = () => act(() => staffUiApi.generatePayroll(month), t("account:staff.payroll.generated", { month: curLabel }))
  const payOne = (r: PayrollRow) => { setConfirmPay(null); return r.paymentId && act(() => staffUiApi.payPayment(r.paymentId!, { method: r.method ?? undefined }), t("account:staff.payroll.paidTo", { amount: formatCurrency(r.net), name: r.name })) }
  const payAll = () => {
    if (!window.confirm(t("account:staff.payroll.payAllConfirm", { amount: formatCurrency(data?.stats.pendingNet ?? 0) }))) return
    act(() => staffUiApi.payAll(month), t("account:staff.payroll.pendingPaid"))
  }
  const reverse = (r: PayrollRow) => {
    if (!r.paymentId || !window.confirm(t("account:staff.payroll.reverseConfirm", { name: r.name }))) return
    act(() => staffUiApi.reversePayment(r.paymentId!), t("account:staff.payroll.recordDeleted"))
  }
  const saveAdjust = async () => {
    if (!sel) return
    if (!sel.paymentId) { toast.error(t("account:staff.payroll.generateFirst")); return }
    const b = Number(bonus) || 0, d = Number(deduct) || 0
    if (b < 0 || d < 0) { toast.error(t("account:staff.payroll.negative")); return }
    if (d > sel.base + b) { toast.error(t("account:staff.payroll.tooMuch")); return }
    await act(() => staffUiApi.adjustPayment(sel.paymentId!, { bonus: b, deduction: d, method }), t("account:staff.payroll.payslipUpdated"))
    setSaveState("saved")
  }

  const printSlip = () => {
    if (!sel) return
    const w = window.open("", "_blank", "width=640,height=760")
    if (!w) { toast.error(t("account:staff.payroll.allowPopups")); return }
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))
    const b = Number(bonus) || 0, d = Number(deduct) || 0
    w.document.write(`<!doctype html><html lang="${esc(i18n.language)}"><meta charset="utf-8"><title>${esc(t("account:staff.payroll.print.title"))}</title><body style="font-family:sans-serif;padding:28px">
      <h2 style="margin:0">${esc(t("account:staff.payroll.print.heading", { month: curLabel }))}</h2>
      <p style="color:#5B6478">${esc(sel.name)} · ${esc(sel.role ?? "")} · ${esc(t("account:staff.payroll.print.joined", { date: fmtD(sel.joined) }))}</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px">
        <tr><td style="padding:6px 0">${esc(t("account:staff.payroll.baseSalary"))}</td><td style="text-align:right">${formatCurrency(sel.base)}</td></tr>
        <tr><td style="padding:6px 0">${esc(t("account:staff.payroll.bonus"))}</td><td style="text-align:right">${formatCurrency(b)}</td></tr>
        <tr><td style="padding:6px 0">${esc(t("account:staff.payroll.deduction"))}</td><td style="text-align:right">${formatCurrency(d)}</td></tr>
        <tr><td style="padding:10px 0;border-top:1px solid #ccc"><strong>${esc(t("account:staff.payroll.netPay"))}</strong></td><td style="text-align:right;border-top:1px solid #ccc"><strong>${formatCurrency(Math.max(0, sel.base + b - d))}</strong></td></tr>
      </table><p style="color:#5B6478">${esc(t("account:staff.payroll.print.paidVia", { method: methodLabel(method), status: statusLabel(sel.status) }))}</p></body></html>`)
    w.document.close(); w.focus(); w.print()
  }

  const handleExport = () => {
    exportToCSV(rows.map((r) => ({ staff: r.name, role: r.role ?? "", base: r.base, bonus: r.bonus, deduction: r.deduction, net: r.net, method: r.method ?? "", status: statusLabel(r.status) })),
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
        title={t("account:staff.payroll.title")}
        description={t("account:staff.payroll.description")}
        actions={canGenerate && <Button type="button" disabled={busy} onClick={generate}>{t("account:staff.payroll.generate", { month: curLabel })}</Button>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label={t("account:staff.payroll.monthAria")} className="flex gap-1.5">
          {(data?.months ?? [{ month, label: month }]).map((m) => (
            <Button key={m.month} type="button" size="sm" variant={month === m.month ? "default" : "outline"} aria-pressed={month === m.month} onClick={() => { setMonth(m.month); setPage(1); setSelId(null) }}>{mLabel(m.month, m.label)}</Button>
          ))}
        </div>
        {data && <span className="text-sm text-muted-foreground"><Trans t={t} i18nKey="account:staff.payroll.payday" values={{ date: fmtD(data.payday) }} components={{ b: <strong className="text-foreground" /> }} /> · {data.daysLeft >= 0 ? t("account:staff.payroll.daysLeft", { count: data.daysLeft }) : t("account:staff.payroll.daysAgo", { count: Math.abs(data.daysLeft) })}</span>}
      </div>

      {loading || !s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: t("account:staff.payroll.stats.base"), value: formatCurrency(s.baseTotal), icon: <Users className="size-4" />, color: "blue", hint: t("account:staff.payroll.stats.people", { count: s.peopleCount }) },
          { label: t("account:staff.payroll.stats.net"), value: formatCurrency(s.netTotal), icon: <Wallet className="size-4" />, color: "purple", hint: t("account:staff.payroll.stats.netHint") },
          { label: t("common:payment.paid"), value: formatCurrency(s.paid), icon: <Banknote className="size-4" />, color: "green", hint: t("account:staff.payroll.stats.paidCount", { count: s.paidCount }) },
          { label: t("account:staff.payroll.stats.pending"), value: formatCurrency(s.pendingNet), icon: <Clock className="size-4" />, color: "yellow", hint: [t("account:staff.payroll.stats.pendingPeople", { count: s.pendingCount }), s.notGenerated ? t("account:staff.payroll.stats.notGeneratedYet", { count: s.notGenerated }) : ""].filter(Boolean).join(" · ") },
          { label: t("account:staff.payroll.stats.paidThisYear"), value: formatCurrency(s.paidThisYear), icon: <Banknote className="size-4" />, color: "green", hint: t("account:staff.payroll.stats.yearRange", { from: new Date(new Date().getFullYear(), 0, 1).toLocaleDateString(lang, { month: "short" }), to: new Date().toLocaleDateString(lang, { month: "short", year: "numeric" }) }) },
        ]} />
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full min-w-0 flex-1 gap-0 pb-0 pt-4">
          <CardHeader className="px-4 pb-4">
            <CardTitle>{t("account:staff.payroll.payroll", { month: curLabel })}</CardTitle>
            <CardAction className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> {t("common:actions.export")}</Button>
              <Button type="button" disabled={busy || !s || s.pendingCount === 0} onClick={payAll}>{t("account:staff.payroll.payAllPending", { amount: formatCurrency(s?.pendingNet ?? 0) })}</Button>
            </CardAction>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("account:staff.payroll.staff")}</TableHead><TableHead className="text-right">{t("account:staff.payroll.base")}</TableHead><TableHead className="text-right">{t("account:staff.payroll.bonus")}</TableHead>
                  <TableHead className="text-right">{t("account:staff.payroll.deduction")}</TableHead><TableHead className="text-right">{t("account:staff.payroll.netPay")}</TableHead><TableHead>{t("account:staff.payroll.method")}</TableHead>
                  <TableHead>{t("common:fields.status")}</TableHead><TableHead className="pr-4 text-right">{t("account:staff.payroll.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={8} className="px-4 py-3"><Skeleton className="h-11" /></TableCell></TableRow>) :
                  pageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={8}>
                      <EmptyState icon={Users} title={t("account:staff.payroll.empty")} description={t("account:staff.payroll.emptyDesc")} className="p-4 md:p-6" />
                    </TableCell></TableRow>
                  ) : pageRows.map((r) => (
                    <TableRow key={r.staffId} data-state={selId === r.staffId ? "selected" : undefined}>
                      <TableCell className="pl-4"><Button type="button" variant="ghost" onClick={() => pick(r)} className="h-auto flex-col items-start gap-0 text-left"><span className="font-semibold">{r.name}</span><span className="text-xs text-muted-foreground">{r.role ?? "—"}</span></Button></TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.base)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.bonus ? formatCurrency(r.bonus) : "—"}{r.bonusNote && <div className="text-xs text-muted-foreground">{r.bonusNote}</div>}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.deduction ? formatCurrency(r.deduction) : "—"}{r.deductionNote && <div className="text-xs text-muted-foreground">{r.deductionNote}</div>}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{formatCurrency(r.net)}</TableCell>
                      <TableCell>{r.method ? methodLabel(r.method) : "—"}</TableCell>
                      <TableCell><StatusBadge status={r.status} label={statusLabel(r.status)} /></TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === "pending" && <Button type="button" size="sm" disabled={busy} onClick={() => setConfirmPay(r)}>{t("account:staff.payroll.pay", { amount: formatCurrency(r.net) })}</Button>}
                          {r.status === "paid" && (
                            <>
                              <Button type="button" variant="link" size="sm" onClick={() => pick(r)}>{t("account:staff.payroll.payslip")}</Button>
                              <WithTooltip content={t("account:staff.payroll.deleteRecord")}>
                                <span tabIndex={busy ? 0 : undefined} className="inline-flex">
                                  <Button type="button" variant="outline" size="icon" aria-label={t("account:staff.payroll.deleteRecordFor", { name: r.name })} disabled={busy} onClick={() => reverse(r)}><Trash2 className="size-4" /></Button>
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
                <TableFooter><TableRow className="font-bold"><TableCell className="px-4">{t("common:money.total")}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(tot.base)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(tot.add)}</TableCell>
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
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t("account:staff.payroll.payslip")}</h2><span className="text-xs text-muted-foreground">{curLabel}</span></div>
          {!sel ? <p className="py-8 text-center text-sm text-muted-foreground">{t("account:staff.payroll.pickPerson")}</p> : (
            <>
              <Card className="gap-1.5 bg-muted/50 p-3.5 text-sm shadow-none">
                <div className="font-semibold">{sel.name}</div>
                <div className="text-xs text-muted-foreground">{sel.role ?? "—"} · {t("account:staff.payroll.joined", { date: fmtD(sel.joined) })}</div>
                <InfoList className="mt-1 gap-1.5">
                  <InfoRow label={t("account:staff.payroll.baseSalary")} value={<span className="font-normal tabular-nums">{formatCurrency(sel.base)}</span>} />
                  <InfoRow label={t("account:staff.payroll.bonus")} value={<span className="font-normal tabular-nums">{formatCurrency(Number(bonus) || 0)}</span>} />
                  <InfoRow label={t("account:staff.payroll.deduction")} value={<span className="font-normal tabular-nums">{formatCurrency(Number(deduct) || 0)}</span>} />
                  <Separator />
                  <InfoRow label={<strong className="text-foreground">{t("account:staff.payroll.netPay")}</strong>} value={<span className="text-lg font-bold tabular-nums">{formatCurrency(previewNet)}</span>} />
                </InfoList>
              </Card>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label={t("account:staff.payroll.addBonus")} htmlFor="salary-bonus"><Input id="salary-bonus" type="number" min={0} step="any" disabled={locked} value={bonus} onChange={(e) => setBonus(e.target.value)} /></FormField>
                <FormField label={t("account:staff.payroll.deduct")} htmlFor="salary-deduct"><Input id="salary-deduct" type="number" min={0} step="any" disabled={locked} value={deduct} onChange={(e) => setDeduct(e.target.value)} /></FormField>
              </div>
              <FormField label={t("account:staff.payroll.paidVia")} htmlFor="salary-method"><Select disabled={locked} value={method} onValueChange={setMethod}><SelectTrigger id="salary-method" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>)}</SelectContent></Select></FormField>
              <div className="flex gap-2">
                {!locked && <Button type="button" disabled={busy} onClick={saveAdjust} className="flex-1">{t("account:staff.payroll.savePayslip")}</Button>}
                <Button type="button" variant="outline" onClick={printSlip} className="flex-1"><Printer className="size-4" aria-hidden /> {t("account:staff.payroll.printPayslip")}</Button>
              </div>
              <Separator />
              <div className="flex flex-col gap-1.5">
                <SectionTitle>{t("account:staff.payroll.history", { name: sel.name })}</SectionTitle>
                {!hist ? <Skeleton className="h-12" /> : hist.history.length === 0 ? <span className="text-sm text-muted-foreground">{t("account:staff.payroll.noRecords")}</span> : hist.history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-sm"><span>{mLabel(h.month, h.label)}</span><span className="flex items-center gap-2"><strong className="tabular-nums">{formatCurrency(h.net)}</strong>
                    <StatusBadge status={h.status} variant={h.status === "paid" ? "default" : "secondary"} label={statusLabel(h.status)} /></span></div>
                ))}
              </div>
              <span aria-live="polite" className="flex h-4 items-center gap-1 text-xs text-muted-foreground">
                {saveState === "saving" ? t("common:actions.saving") : saveState === "saved" ? <><Check className="size-3.5" aria-hidden /> {t("common:status.saved")}</> : !locked ? t("account:staff.payroll.autoSave") : null}
              </span>
              <span className="text-xs text-muted-foreground">{t("account:staff.payroll.expenseNote")}</span>
            </>
          )}
        </Card>
      </div>

      {ungenerated.length > 0 && (
        <SectionCard
          aria-label={t("account:staff.payroll.notGeneratedAria")}
          className="border-dashed"
          title={t("account:staff.payroll.notGeneratedTitle", { count: ungenerated.length })}
          description={t("account:staff.payroll.notGeneratedDesc", { month: curLabel })}
          actions={<Button type="button" disabled={busy} onClick={generate}>{t("account:staff.payroll.generate", { month: curLabel })}</Button>}
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
            <AlertDialogTitle>{t("account:staff.payroll.confirmTitle", { name: confirmPay?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("account:staff.payroll.confirmDesc", { amount: confirmPay ? formatCurrency(confirmPay.net) : "", month: curLabel })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmPay && payOne(confirmPay)}>{t("account:staff.payroll.pay", { amount: confirmPay ? formatCurrency(confirmPay.net) : "" })}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SectionCard aria-label={t("common:extra.history")} title={t("account:staff.payroll.payrollHistory")} contentClassName="px-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[560px]">
            <TableHeader><TableRow><TableHead className="pl-6">{t("account:staff.payroll.month")}</TableHead><TableHead>{t("account:staff.payroll.people")}</TableHead><TableHead className="text-right">{t("account:staff.payroll.netPayroll")}</TableHead>
              <TableHead className="text-right">{t("common:payment.paid")}</TableHead><TableHead className="text-right">{t("account:staff.payroll.pendingCol")}</TableHead><TableHead className="pr-6 text-right">{t("account:staff.payroll.open")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {hRows.map((h) => (
                <TableRow key={h.month}><TableCell className="pl-6 font-semibold">{mLabel(h.month, h.label)}</TableCell><TableCell className="tabular-nums">{h.people}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(h.net)}</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(h.paid)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(h.pending)}</TableCell>
                  <TableCell className="pr-6 text-right"><Button type="button" variant="link" size="sm" onClick={() => { setMonth(h.month); window.scrollTo({ top: 0, behavior: "smooth" }) }}>{t("common:actions.view")}</Button></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {(data?.history ?? []).length === 0 && <div className="px-6 pt-2 text-sm text-muted-foreground">{t("account:staff.payroll.noPayroll")}</div>}
        {(data?.history ?? []).length > HIST_SIZE && <div className="px-4 pt-4"><PaginationControl currentPage={histPage} totalPages={Math.ceil((data?.history.length ?? 0) / HIST_SIZE)} itemsPerPage={HIST_SIZE} totalItems={data?.history.length ?? 0} onPageChange={setHistPage} onItemsPerPageChange={() => {}} /></div>}
      </SectionCard>
    </div>
  )
}
