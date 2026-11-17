"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Ban, Banknote, CalendarClock, Download, History, Pencil, Plus, Repeat, Search, TrendingUp, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import expenseApi, { type ExpenseLogStats, type ExpenseResponse, type ExpenseTemplate } from "@/lib/expenseApi"
import { expenseCategoryApi, type ExpenseCategoryResponse } from "@/lib/expenseCategoryApi"
import vendorApi, { type VendorOverviewRow } from "@/lib/vendorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { EmptyState } from "@/components/common/EmptyState"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WithTooltip } from "@/components/common/WithTooltip"
import { FinanceFilters, useFinanceFilters } from "@/components/finance/finance-filters"
import { formatDate, todayIn } from "@/lib/finance-format"
import { ExpenseVoidDialog } from "@/components/finance/expense-void-dialog"
import { ExpenseActivitySheet } from "@/components/finance/expense-activity-sheet"
import { useTranslation } from "react-i18next"

/** Generated from Salary / Tailor payments: read-only here. */
const isGenerated = (e: ExpenseResponse) => !!e.locked || e.source === "salary" || e.source === "dorji_payout"

type Tab = "all" | "rec" | "salary" | "manual"

// Values are stored on the expense as-is; only the label is translated (unknown stored values show raw)
const METHODS = ["Cash", "bKash", "Bank", "Card", "Other"]
const METHOD_KEYS = {
  Cash: "customers:shared.methods.cash",
  bKash: "customers:shared.methods.bkash",
  Bank: "customers:shared.methods.bank",
  Card: "customers:shared.methods.card",
  Other: "customers:shared.methods.other",
} as const
const EVERY = ["Week", "Month", "Quarter", "Year"] as const
type Every = (typeof EVERY)[number]
const EVERY_KEYS = {
  Week: "customers:expenses.every.week",
  Month: "customers:expenses.every.month",
  Quarter: "customers:expenses.every.quarter",
  Year: "customers:expenses.every.year",
} as const
const PALETTE = ["#2449E8", "#0F766E", "#F59E0B", "#5B21B6", "#B42318", "#7C8AA8"]

const NONE = "__none"

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtD = (d?: string | null) => (d ? formatDate(d.slice(0, 10)) : "—")

const REC_LABEL = {
  Week: "customers:expenses.recurrence.week",
  Month: "customers:expenses.recurrence.month",
  Quarter: "customers:expenses.recurrence.quarter",
  Year: "customers:expenses.recurrence.year",
} as const
const normEvery = (f?: string | null): Every => {
  const v = String(f ?? "Month").toLowerCase()
  return v.startsWith("week") ? "Week" : v.startsWith("quarter") ? "Quarter" : v.startsWith("year") || v.startsWith("annual") ? "Year" : "Month"
}
/** The date one period after `iso` (month ends are clamped, e.g. 31 Jan + 1 month = 28/29 Feb). */
function addPeriod(iso: string, every: string): string {
  const base = iso || ymd(new Date())
  const [y, m, d] = base.split("-").map(Number)
  const e = normEvery(every)
  if (e === "Week") return ymd(new Date(y, m - 1, d + 7))
  const months = e === "Quarter" ? 3 : e === "Year" ? 12 : 1
  const last = new Date(y, m - 1 + months + 1, 0).getDate()
  return ymd(new Date(y, m - 1 + months, Math.min(d, last)))
}
const csvEsc = (v: unknown) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }


interface FormState {
  amount: string; title: string; categoryId: string; method: string; date: string; paidTo: string
  vendorId: string; locationId: string; ref: string; note: string; recurring: boolean; every: string; nextDue: string; recEnd: string
}
const blankForm = (): FormState => ({
  amount: "", title: "", categoryId: "", method: "Cash", date: todayIn(), paidTo: "", vendorId: "", locationId: "", ref: "", note: "",
  recurring: false, every: "Month", nextDue: "", recEnd: "",
})

export default function ExpensesPage() {
  const { t } = useTranslation(["customers", "common"])
  const methodLabel = (m?: string | null) => { const k = m ? (METHOD_KEYS as Record<string, (typeof METHOD_KEYS)[keyof typeof METHOD_KEYS] | undefined>)[m] : undefined; return k ? t(k) : (m || "—") }
  const CLOSED_MSG = t("customers:expenses.closedMsg")
  const { formatCurrency } = useCompanySettings()
  const { warehouses } = useWarehouse()
  const blocked = useModuleGuard("Expenses")

  const [rows, setRows] = useState<ExpenseResponse[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<ExpenseLogStats | null>(null)
  const [counts, setCounts] = useState<Partial<Record<Tab, number>>>({})
  const [byCat, setByCat] = useState<{ categoryId: number | null; name: string; color?: string | null; amount: number; pct: number }[]>([])
  const [trend, setTrend] = useState<{ month: string; label: string; amount: number }[]>([])
  const [loading, setLoading] = useState(true)

  const [cats, setCats] = useState<ExpenseCategoryResponse[]>([])
  const [allCats, setAllCats] = useState<ExpenseCategoryResponse[]>([])
  const [exporting, setExporting] = useState(false)
  const [vendors, setVendors] = useState<VendorOverviewRow[]>([])
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([])

  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [fCat, setFCat] = useState("all")
  const [fMethod, setFMethod] = useState("all")
  const [fLoc, setFLoc] = useState("all")
  const [fVendor, setFVendor] = useState("all")
  // FND-2: the shared finance Period filter (URL + remembered across finance pages), worked out in the company time zone
  const filters = useFinanceFilters()
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [form, setForm] = useState<FormState>(blankForm())
  const [editing, setEditing] = useState<ExpenseResponse | null>(null)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)
  const [voiding, setVoiding] = useState<ExpenseResponse | null>(null)
  const [activity, setActivity] = useState<ExpenseResponse | null>(null)

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 250); return () => clearTimeout(t) }, [q])

  const win = { from: filters.from || undefined, to: filters.to || undefined, label: filters.applied.preset === "all_time" ? t("common:time.allTime") : filters.label }
  useEffect(() => { setPage(1) }, [filters.key])

  const loadCommon = useCallback(() => {
    expenseCategoryApi.getOverview({ include_inactive: true }).then((r) => { setAllCats(r.data); setCats(r.data.filter((c) => c.status !== false)) }).catch(() => {})
    vendorApi.getOverview({ limit: 500, sort: "name" }).then((r) => setVendors(r.data)).catch(() => {})
    expenseApi.getTemplates().then(setTemplates).catch(() => {})
  }, [])
  useEffect(() => { loadCommon() }, [loadCommon])

  const load = useCallback(async () => {
    if (!filters.ready) return
    setLoading(true)
    try {
      const params: Record<string, any> = { page, per_page: perPage, tab }
      if (qD) params.search = qD
      if (fCat !== "all") params.category_id = fCat
      if (fMethod !== "all") params.method = fMethod
      if (fLoc !== "all") params.location_id = fLoc
      if (fVendor !== "all") params.vendor_id = fVendor
      if (win.from) params.from = win.from
      if (win.to) params.to = win.to
      const res = await expenseApi.getLog(params)
      setRows(res.data); setTotal(res.total); setStats(res.stats); setCounts(res.counts); setByCat(res.byCategory); setTrend(res.trend)
    } catch {
      setRows([])
      toast.error(t("customers:expenses.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [page, perPage, tab, qD, fCat, fMethod, fLoc, fVendor, win.from, win.to, filters.ready]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const set = (k: keyof FormState, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const startEdit = (e: ExpenseResponse | null) => {
    if (e && (e.voided || e.periodClosed || e.editable === false)) {
      toast.error(e.voided ? t("customers:expenses.voidedNoEdit") : CLOSED_MSG)
      return
    }
    setEditing(e)
    setErr("")
    setForm(e ? {
      amount: String(e.amount), title: e.title, categoryId: String(e.expenseCategoryId), method: e.paymentMethod || "Cash",
      date: (e.expenseDate || "").slice(0, 10), paidTo: e.paidTo ?? "", vendorId: e.vendorId ? String(e.vendorId) : "",
      locationId: e.locationId ? String(e.locationId) : "", ref: e.referenceNo ?? "", note: e.notes ?? "", recurring: e.isRecurring,
      every: normEvery(e.recurringFrequency),
      nextDue: (e.nextDueDate ?? "").slice(0, 10), recEnd: (e.recurringEndDate ?? "").slice(0, 10),
    } : blankForm())
  }

  const applyTemplate = (t: ExpenseTemplate) => {
    setEditing(null)
    setForm({ ...blankForm(), title: t.title, categoryId: String(t.categoryId), amount: String(t.amount), method: t.paymentMethod || "Cash",
      paidTo: t.paidTo ?? "", vendorId: t.vendorId ? String(t.vendorId) : "", locationId: t.locationId ? String(t.locationId) : "",
      recurring: !!t.isRecurring, every: normEvery(t.recurringFrequency), nextDue: t.isRecurring ? addPeriod(todayIn(), normEvery(t.recurringFrequency)) : "",
      recEnd: t.isRecurring ? (t.recurringEndDate ?? "").slice(0, 10) : "" })
  }

  /** Picking a supplier fills "Paid to" unless the user typed their own name there. */
  const pickVendor = (id: string) => setForm((f) => {
    const prev = vendors.find((v) => String(v.id) === f.vendorId)?.name ?? ""
    const next = vendors.find((v) => String(v.id) === id)?.name ?? ""
    const paidTo = next && (!f.paidTo || f.paidTo === prev) ? next : !id && f.paidTo === prev ? "" : f.paidTo
    return { ...f, vendorId: id, paidTo }
  })
  const toggleRecurring = () => setForm((f) => ({ ...f, recurring: !f.recurring, nextDue: !f.recurring && !f.nextDue ? addPeriod(f.date, f.every) : f.nextDue }))
  const changeEvery = (v: string) => setForm((f) => ({ ...f, every: v, nextDue: addPeriod(f.date, v) }))

  const exportCsv = async () => {
    setExporting(true)
    try {
      const params: Record<string, any> = { page: 1, per_page: 100, tab }
      if (qD) params.search = qD
      if (fCat !== "all") params.category_id = fCat
      if (fMethod !== "all") params.method = fMethod
      if (fLoc !== "all") params.location_id = fLoc
      if (fVendor !== "all") params.vendor_id = fVendor
      if (win.from) params.from = win.from
      if (win.to) params.to = win.to
      const all: ExpenseResponse[] = []
      for (let p = 1; p <= 100; p++) {
        const res = await expenseApi.getLog({ ...params, page: p })
        all.push(...res.data)
        if (all.length >= res.total || res.data.length === 0) break
      }
      if (!all.length) { toast.error(t("common:extra.nothingToExport")); return }
      // Export only (nothing imports this file back), so headers follow the staff member's language
      const head = (["no", "date", "title", "category", "paidTo", "supplier", "paidFrom", "location", "reference", "recurring", "repeatsUntil", "source", "amount", "note"] as const)
        .map((k) => t(`customers:expenses.csv.${k}`))
      const lines = [head].concat(all.map((e) => [
        `EXP-${e.id}`, (e.expenseDate || "").slice(0, 10), e.title, e.categoryName ?? "", e.paidTo ?? "", e.vendorName ?? "", e.paymentMethod ?? "", e.locationName ?? "",
        e.referenceNo ?? "", e.isRecurring ? t(REC_LABEL[normEvery(e.recurringFrequency)]) : "", e.isRecurring ? (e.recurringEndDate ?? "").slice(0, 10) : "", e.source ?? "manual", String(e.amount), e.notes ?? "",
      ]))
      const blob = new Blob(["\ufeff" + lines.map((r) => r.map(csvEsc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob); a.download = `expenses-${ymd(new Date())}.csv`; a.click(); URL.revokeObjectURL(a.href)
      toast.success(t("customers:expenses.toast.exported", { count: all.length }))
    } catch {
      toast.error(t("customers:expenses.toast.exportFailed"))
    } finally {
      setExporting(false)
    }
  }

  const save = async () => {
    const amount = Number(form.amount)
    if (!(amount > 0)) { setErr(t("customers:expenses.errors.amount")); return }
    if (!form.title.trim()) { setErr(t("customers:expenses.errors.title")); return }
    if (!form.categoryId) { setErr(t("customers:expenses.errors.category")); return }
    if (!form.date) { setErr(t("customers:expenses.errors.date")); return }
    if (form.recurring && !form.nextDue) { setErr(t("customers:expenses.errors.nextDue")); return }
    if (form.recurring && form.nextDue < form.date) { setErr(t("customers:expenses.errors.nextDueBefore")); return }
    if (form.recurring && form.recEnd && form.recEnd < form.date) { setErr(t("customers:expenses.errors.endBefore")); return }
    setSaving(true); setErr("")
    try {
      const body = {
        expenseCategoryId: Number(form.categoryId), vendorId: form.vendorId ? Number(form.vendorId) : null, title: form.title.trim(), amount,
        expenseDate: form.date, paymentMethod: form.method, referenceNo: form.ref.trim(), notes: form.note.trim(), paidTo: form.paidTo.trim(),
        locationId: form.locationId ? Number(form.locationId) : null, isRecurring: form.recurring,
        recurringFrequency: form.recurring ? form.every : null, nextDueDate: form.recurring ? form.nextDue : null, recurringEndDate: form.recurring && form.recEnd ? form.recEnd : null,
      }
      if (editing) await expenseApi.update(editing.id, body)
      else await expenseApi.create(body)
      toast.success(editing ? t("customers:expenses.toast.updated") : t("customers:expenses.toast.saved"))
      startEdit(null)
      load(); loadCommon()
    } catch (e: any) {
      setErr(e?.response?.data?.message || t("customers:expenses.errors.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const afterVoid = () => {
    if (editing && voiding && editing.id === voiding.id) startEdit(null)
    load()
  }

  const trendMax = Math.max(1, ...trend.map((t) => t.amount))
  const rowSum = rows.reduce((a, r) => a + (r.voided ? 0 : r.amount), 0)
  const hasFilter = !!(qD || fCat !== "all" || fMethod !== "all" || fLoc !== "all" || fVendor !== "all" || tab !== "all")
  const amtVal = Number(form.amount) || 0
  const catColor = useMemo(() => Object.fromEntries(cats.map((c, i) => [c.id, c.color || PALETTE[i % PALETTE.length]])), [cats])

  if (blocked) return blocked

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title={t("customers:expenses.title")}
        description={t("customers:expenses.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={exportCsv} disabled={exporting}><Download className="size-4" aria-hidden /> {exporting ? t("customers:expenses.exporting") : t("common:actions.export")}</Button>
          <Button type="button" onClick={() => startEdit(null)}><Plus className="size-4" aria-hidden /> {t("customers:expenses.newExpense")}</Button>
        </>}
      />

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: t("customers:expenses.kpi.spentMonth"), value: formatCurrency(stats.spentThisMonth), icon: <Wallet className="size-4" />, color: "yellow",
            hint: stats.deltaPct === null ? t("customers:expenses.kpi.noSpendLast") : t("customers:expenses.kpi.vsLast", { delta: `${stats.deltaPct >= 0 ? "+" : "−"}${Math.abs(Math.round(stats.deltaPct))}%` }) },
          { label: t("customers:expenses.kpi.year"), value: formatCurrency(stats.yearTotal), icon: <Banknote className="size-4" />, color: "blue", hint: t("customers:expenses.kpi.yearHint", { count: stats.yearCount }) },
          { label: t("customers:expenses.kpi.recurring"), value: formatCurrency(stats.recurringMonthly), icon: <Repeat className="size-4" />, color: "purple",
            hint: stats.recurringCount ? t("customers:expenses.kpi.recurringHint", { count: stats.recurringCount }) : t("customers:expenses.kpi.noRecurring") },
          { label: t("customers:expenses.kpi.billsDue"), value: stats.billsDueThisWeek.length, icon: <CalendarClock className="size-4" />, color: stats.billsDueThisWeek.length ? "red" : "green",
            hint: stats.billsDueThisWeek.length ? stats.billsDueThisWeek.slice(0, 2).map((b) => `${b.title} ${formatDate(b.nextDueDate?.slice(0, 10), undefined, "day")}`).join(" · ") : t("customers:expenses.kpi.nothingDue") },
          { label: t("customers:expenses.kpi.profit"), value: `${stats.profitAfterExpenses < 0 ? "−" : ""}${formatCurrency(Math.abs(stats.profitAfterExpenses))}`, icon: <TrendingUp className="size-4" />, color: stats.profitAfterExpenses < 0 ? "red" : "green",
            hint: t("customers:expenses.kpi.profitHint", { amount: formatCurrency(stats.monthRevenue) }) },
        ]} />
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard title={t("customers:expenses.whereWent", { period: win.label })}>
              {byCat.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{t("customers:expenses.noneInPeriod")}</p> : (
                <div className="flex flex-col gap-3">
                  {byCat.slice(0, 6).map((b, i) => (
                    <div key={`${b.categoryId}-${b.name}`} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-sm"><span className="font-medium">{b.name}</span><span className="tabular-nums text-muted-foreground">{formatCurrency(b.amount)} · {Math.round(b.pct)}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.round(b.pct))}%`, background: b.color || PALETTE[i % PALETTE.length] }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
            <SectionCard title={t("customers:expenses.last6")}>
              <div className="flex h-[150px] items-end gap-2">
                {trend.map((t) => (
                  <div key={t.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] font-medium tabular-nums text-muted-foreground">{t.amount ? formatCurrency(t.amount).replace(/\.00$/, "") : ""}</span>
                    <div className="w-full rounded-t-md bg-primary" style={{ height: `${Math.max(2, Math.round((t.amount / trendMax) * 110))}px` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-2">{trend.map((t) => <span key={t.month} className="min-w-0 flex-1 text-center text-[11px] text-muted-foreground">{t.label}</span>)}</div>
            </SectionCard>
          </div>

          <Card className="gap-0 py-0">
            <div className="px-4">
              <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }} tabs={[
                { value: "all", label: t("common:status.all"), count: counts.all }, { value: "rec", label: t("customers:expenses.tabs.recurring"), count: counts.rec },
                { value: "salary", label: t("customers:expenses.tabs.salaries"), count: counts.salary }, { value: "manual", label: t("customers:expenses.tabs.manual"), count: counts.manual },
              ]} />
            </div>
            <div className="flex flex-wrap items-center gap-2.5 p-4">
              <div className="relative min-w-[220px] flex-1">
                <Label htmlFor="expense-search" className="sr-only">{t("customers:expenses.searchLabel")}</Label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="expense-search" type="search" placeholder={t("customers:expenses.searchPlaceholder")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                  className="pl-9" />
              </div>
              <Select value={fCat} onValueChange={(v) => { setFCat(v); setPage(1) }}>
                <SelectTrigger aria-label={t("common:fields.category")}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("customers:expenses.filter.categoryAll")}</SelectItem>{cats.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={fMethod} onValueChange={(v) => { setFMethod(v); setPage(1) }}>
                <SelectTrigger aria-label={t("customers:expenses.filter.paidFrom")}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("customers:expenses.filter.paidFromAll")}</SelectItem>{METHODS.map((m) => <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={fLoc} onValueChange={(v) => { setFLoc(v); setPage(1) }}>
                <SelectTrigger aria-label={t("common:fields.location")}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("customers:expenses.filter.locationAll")}</SelectItem>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={fVendor} onValueChange={(v) => { setFVendor(v); setPage(1) }}>
                <SelectTrigger aria-label={t("common:extra.supplier")}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("customers:expenses.filter.supplierAll")}</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
              <FinanceFilters filters={filters} channel={false} idPrefix="expenses" />
            </div>

            <div className="overflow-x-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">{t("customers:expenses.cols.expense")}</TableHead><TableHead>{t("common:fields.category")}</TableHead><TableHead>{t("common:fields.date")}</TableHead>
                    <TableHead>{t("customers:expenses.filter.paidFrom")}</TableHead><TableHead className="text-right">{t("common:money.amount")}</TableHead><TableHead className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={6} className="px-4"><Skeleton className="h-11 rounded" /></TableCell></TableRow>) :
                    rows.length === 0 ? (
                      <TableRow><TableCell colSpan={6}>
                        <EmptyState icon={Wallet} title={t("customers:expenses.empty.title")} description={hasFilter ? t("customers:shared.tryClearing") : t("customers:expenses.empty.first")} className="p-4 md:p-6" />
                      </TableCell></TableRow>
                    ) : rows.map((r) => (
                      <TableRow key={r.id} data-state={editing?.id === r.id ? "selected" : undefined} className={cn(r.voided && "text-muted-foreground")}>
                        <TableCell className="pl-4">
                          <div className={cn("font-medium", r.voided && "line-through decoration-muted-foreground/70")}>{r.title}{r.isRecurring && <Badge variant="secondary" className="ml-2">↻ {t(REC_LABEL[normEvery(r.recurringFrequency)])}{r.recurringEndDate ? ` ${t("customers:expenses.until", { date: fmtD(r.recurringEndDate) })}` : ""}</Badge>}</div>
                          <div className="text-xs text-muted-foreground">{[r.vendorName ?? r.paidTo, r.referenceNo && `#${r.referenceNo}`].filter(Boolean).join(" · ") || "—"}</div>
                          {r.notes && <div className="max-w-[260px] truncate text-xs text-muted-foreground">{r.notes}</div>}
                          {r.voided && (
                            <div className="mt-1 flex max-w-[320px] flex-wrap items-center gap-1.5 text-xs">
                              <Badge variant="destructive">{t("customers:expenses.voided")}</Badge>
                              <span className="text-muted-foreground">
                                {[r.voidedAt && fmtD(r.voidedAt), r.voidedByName && t("customers:expenses.by", { name: r.voidedByName })].filter(Boolean).join(" ")}{r.voidReason ? ` · ${r.voidReason}` : ""}
                              </span>
                            </div>
                          )}
                          {!r.voided && r.periodClosed && <Badge variant="outline" className="mt-1">{t("customers:expenses.closedMonth")}</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            <span className="size-2 rounded-full" style={{ background: r.categoryColor || catColor[r.expenseCategoryId] || PALETTE[0] }} />{r.categoryName ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{fmtD(r.expenseDate)}</TableCell>
                        <TableCell>{methodLabel(r.paymentMethod)}</TableCell>
                        <TableCell className={cn("text-right font-bold tabular-nums", r.voided && "font-normal line-through")}>{formatCurrency(r.amount)}</TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {isGenerated(r) ? (
                              <span className="text-xs text-muted-foreground">{r.source === "dorji_payout" ? t("customers:expenses.viaTailor") : t("customers:expenses.viaSalary")}</span>
                            ) : !r.voided && (
                              <>
                                {r.periodClosed || r.editable === false ? (
                                  <WithTooltip content={CLOSED_MSG}>
                                    <span tabIndex={0} className="inline-flex"><Button type="button" variant="outline" size="icon" aria-label={t("customers:expenses.editClosedAria", { title: r.title })} disabled><Pencil className="size-4" /></Button></span>
                                  </WithTooltip>
                                ) : (
                                  <WithTooltip content={t("customers:expenses.editAria", { title: r.title })}><Button type="button" variant="outline" size="icon" aria-label={t("customers:expenses.editAria", { title: r.title })} onClick={() => startEdit(r)}><Pencil className="size-4" /></Button></WithTooltip>
                                )}
                                <WithTooltip content={t("customers:expenses.voidAria", { title: r.title })}><Button type="button" variant="outline" size="icon" aria-label={t("customers:expenses.voidAria", { title: r.title })} onClick={() => setVoiding(r)}><Ban className="size-4" /></Button></WithTooltip>
                              </>
                            )}
                            <WithTooltip content={t("customers:expenses.activity")}><Button type="button" variant="ghost" size="icon" aria-label={t("customers:expenses.activityAria", { title: r.title })} onClick={() => setActivity(r)}><History className="size-4" /></Button></WithTooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 pt-3.5 pb-4 text-sm text-muted-foreground tabular-nums">{total > rows.length ? t("customers:expenses.footerPage", { count: total, amount: formatCurrency(rowSum) }) : t("customers:expenses.footer", { count: total, amount: formatCurrency(rowSum) })}</div>
            {!loading && total > 0 && (
              <div className="p-4 pt-0">
                <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
                  onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
              </div>
            )}
          </Card>
        </div>

        <aside className="w-full shrink-0 xl:w-[380px]">
         <SectionCard title={editing ? t("customers:expenses.form.edit") : t("customers:expenses.newExpense")} contentClassName="flex flex-col gap-3.5">
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
          {!editing && templates.length > 0 && (
            <FormField label={t("customers:expenses.form.repeatRecent")}>
              <div role="group" aria-label={t("customers:expenses.form.templates")} className="flex flex-wrap gap-1.5">
                {templates.map((t, i) => (
                  <Button key={i} type="button" variant="outline" size="sm" onClick={() => applyTemplate(t)}>{t.title}</Button>
                ))}
              </div>
            </FormField>
          )}
          <FormField label={t("common:money.amount")} required htmlFor="exp-amount">
            <Input id="exp-amount" type="number" min={0} step="any" className="tabular-nums" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" /></FormField>
          <FormField label={t("customers:expenses.form.whatFor")} required htmlFor="exp-title">
            <Input id="exp-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={t("customers:expenses.form.whatForPlaceholder")} /></FormField>
          <FormField label={t("common:fields.category")} required>
            <div role="group" aria-label={t("common:fields.category")} className="flex flex-wrap gap-1.5">
              {(editing && !cats.some((c) => c.id === editing.expenseCategoryId) ? [...cats, ...allCats.filter((c) => c.id === editing.expenseCategoryId)] : cats).map((c) => (
                <Button key={c.id} type="button" size="sm" variant={form.categoryId === String(c.id) ? "default" : "outline"} aria-pressed={form.categoryId === String(c.id)} onClick={() => set("categoryId", String(c.id))}>{c.status === false ? t("customers:expenses.form.inactiveName", { name: c.name }) : c.name}</Button>
              ))}
              <Button asChild variant="link" size="sm"><Link href="/dashboard/expenses/categories">{t("customers:expenses.form.newCategory")}</Link></Button>
            </div>
          </FormField>
          <FormField label={t("customers:expenses.filter.paidFrom")} required>
            <div role="radiogroup" aria-label={t("customers:expenses.filter.paidFrom")} className="flex flex-wrap gap-1.5">
              {METHODS.map((m) => (
                <Button key={m} type="button" size="sm" variant={form.method === m ? "default" : "outline"} role="radio" aria-checked={form.method === m} onClick={() => set("method", m)}>{methodLabel(m)}</Button>
              ))}
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-2.5">
            <FormField label={t("common:fields.date")} required htmlFor="exp-date"><Input id="exp-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></FormField>
            <FormField label={t("customers:expenses.form.paidTo")} htmlFor="exp-paid-to"><Input id="exp-paid-to" value={form.paidTo} onChange={(e) => set("paidTo", e.target.value)} placeholder={t("customers:expenses.form.paidToPlaceholder")} /></FormField>
          </div>
          <FormField label={t("customers:expenses.form.supplierOptional")} htmlFor="exp-vendor">
            <Select value={form.vendorId || NONE} onValueChange={(v) => pickVendor(v === NONE ? "" : v)}>
              <SelectTrigger id="exp-vendor" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={NONE}>{t("common:status.none")}</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
            </Select></FormField>
          <div className="grid grid-cols-2 gap-2.5">
            <FormField label={t("common:fields.location")} htmlFor="exp-location">
              <Select value={form.locationId || NONE} onValueChange={(v) => set("locationId", v === NONE ? "" : v)}>
                <SelectTrigger id="exp-location" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>{t("customers:expenses.form.allNone")}</SelectItem>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
              </Select></FormField>
            <FormField label={t("customers:expenses.form.ref")} htmlFor="exp-ref"><Input id="exp-ref" value={form.ref} onChange={(e) => set("ref", e.target.value)} placeholder={t("common:status.optional")} /></FormField>
          </div>
          <FormField label={t("common:fields.note")} htmlFor="exp-note">
            <Textarea id="exp-note" rows={2} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder={t("common:status.optional")} /></FormField>
          <FieldLabel htmlFor="exp-recurring">
            <Field orientation="horizontal">
              <FieldContent><FieldTitle>{t("customers:expenses.form.repeats")}</FieldTitle><FieldDescription>{t("customers:expenses.form.repeatsHint")}</FieldDescription></FieldContent>
              <Switch id="exp-recurring" checked={form.recurring} onCheckedChange={toggleRecurring} />
            </Field>
          </FieldLabel>
          {form.recurring && (
            <div className="grid gap-2.5 sm:grid-cols-3">
              <FormField label={t("customers:expenses.form.every")} htmlFor="exp-every">
                <Select value={form.every} onValueChange={(v) => changeEvery(v)}>
                  <SelectTrigger id="exp-every" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{EVERY.map((x) => <SelectItem key={x} value={x}>{t(EVERY_KEYS[x])}</SelectItem>)}</SelectContent>
                </Select></FormField>
              <FormField label={t("customers:expenses.form.nextDue")} htmlFor="exp-next-due"><Input id="exp-next-due" type="date" value={form.nextDue} onChange={(e) => set("nextDue", e.target.value)} /></FormField>
              <FormField label={t("customers:expenses.form.stopAfter")} htmlFor="exp-rec-end"><Input id="exp-rec-end" type="date" value={form.recEnd} onChange={(e) => set("recEnd", e.target.value)} /></FormField>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => startEdit(null)}>{t("common:actions.clear")}</Button>
            <Button type="button" disabled={saving} onClick={save}>
              {saving ? t("common:actions.saving") : (() => { const label = editing ? t("common:actions.saveChanges") : t("customers:expenses.form.save"); return amtVal > 0 ? t("customers:expenses.form.withAmount", { label, amount: formatCurrency(amtVal) }) : label })()}
            </Button>
          </div>
         </SectionCard>
        </aside>
      </div>
      <ExpenseVoidDialog expense={voiding} onClose={() => setVoiding(null)} onDone={afterVoid} />
      <ExpenseActivitySheet expense={activity} onClose={() => setActivity(null)} />
    </div>
  )
}
