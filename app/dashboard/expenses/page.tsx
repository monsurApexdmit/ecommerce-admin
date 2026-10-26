"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Banknote, CalendarClock, Download, Pencil, Plus, Repeat, Search, TrendingUp, Trash2, Wallet } from "lucide-react"
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

type Tab = "all" | "rec" | "salary" | "manual"
type Period = "month" | "last" | "d30" | "year" | "all" | "custom"

const METHODS = ["Cash", "bKash", "Bank", "Card", "Other"]
const EVERY = ["Week", "Month", "Quarter", "Year"]
const PERIODS: [Period, string][] = [["month", "This month"], ["last", "Last month"], ["d30", "Last 30 days"], ["year", "This year"], ["all", "All time"], ["custom", "Custom range"]]
const PALETTE = ["#2449E8", "#0F766E", "#F59E0B", "#5B21B6", "#B42318", "#7C8AA8"]

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const filterSelCls = "h-11 rounded-[10px] border border-dash-border bg-dash-card px-2.5 text-[13px] font-semibold outline-none"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"

const pad = (n: number) => String(n).padStart(2, "0")
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmtD = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

const REC_LABEL: Record<string, string> = { Week: "Weekly", Month: "Monthly", Quarter: "Quarterly", Year: "Yearly" }
const normEvery = (f?: string | null) => {
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

function windowFor(p: Period, from: string, to: string): { from?: string; to?: string; label: string } {
  const now = new Date()
  if (p === "month") return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now), label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }) }
  if (p === "last") { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); return { from: ymd(s), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)), label: s.toLocaleDateString("en-US", { month: "long", year: "numeric" }) } }
  if (p === "d30") return { from: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: ymd(now), label: "last 30 days" }
  if (p === "year") return { from: `${now.getFullYear()}-01-01`, to: ymd(now), label: String(now.getFullYear()) }
  if (p === "custom") return { from: from || undefined, to: to || undefined, label: "custom range" }
  return { label: "all time" }
}

interface FormState {
  amount: string; title: string; categoryId: string; method: string; date: string; paidTo: string
  vendorId: string; locationId: string; ref: string; note: string; recurring: boolean; every: string; nextDue: string; recEnd: string
}
const blankForm = (): FormState => ({
  amount: "", title: "", categoryId: "", method: "Cash", date: ymd(new Date()), paidTo: "", vendorId: "", locationId: "", ref: "", note: "",
  recurring: false, every: "Month", nextDue: "", recEnd: "",
})

export default function ExpensesPage() {
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
  const [period, setPeriod] = useState<Period>("month")
  const [cFrom, setCFrom] = useState("")
  const [cTo, setCTo] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [form, setForm] = useState<FormState>(blankForm())
  const [editing, setEditing] = useState<ExpenseResponse | null>(null)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 250); return () => clearTimeout(t) }, [q])

  const win = windowFor(period, cFrom, cTo)

  const loadCommon = useCallback(() => {
    expenseCategoryApi.getOverview({ include_inactive: true }).then((r) => { setAllCats(r.data); setCats(r.data.filter((c) => c.status !== false)) }).catch(() => {})
    vendorApi.getOverview({ limit: 500, sort: "name" }).then((r) => setVendors(r.data)).catch(() => {})
    expenseApi.getTemplates().then(setTemplates).catch(() => {})
  }, [])
  useEffect(() => { loadCommon() }, [loadCommon])

  const load = useCallback(async () => {
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
      toast.error("Failed to load expenses")
    } finally {
      setLoading(false)
    }
  }, [page, perPage, tab, qD, fCat, fMethod, fLoc, fVendor, win.from, win.to]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const set = (k: keyof FormState, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const startEdit = (e: ExpenseResponse | null) => {
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
      recurring: !!t.isRecurring, every: normEvery(t.recurringFrequency), nextDue: t.isRecurring ? addPeriod(ymd(new Date()), normEvery(t.recurringFrequency)) : "",
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
      if (!all.length) { toast.error("Nothing to export"); return }
      const head = ["No", "Date", "Title", "Category", "Paid to", "Supplier", "Paid from", "Location", "Reference", "Recurring", "Repeats until", "Source", "Amount", "Note"]
      const lines = [head].concat(all.map((e) => [
        `EXP-${e.id}`, (e.expenseDate || "").slice(0, 10), e.title, e.categoryName ?? "", e.paidTo ?? "", e.vendorName ?? "", e.paymentMethod ?? "", e.locationName ?? "",
        e.referenceNo ?? "", e.isRecurring ? REC_LABEL[normEvery(e.recurringFrequency)] : "", e.isRecurring ? (e.recurringEndDate ?? "").slice(0, 10) : "", e.source ?? "manual", String(e.amount), e.notes ?? "",
      ]))
      const blob = new Blob(["\ufeff" + lines.map((r) => r.map(csvEsc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob); a.download = `expenses-${ymd(new Date())}.csv`; a.click(); URL.revokeObjectURL(a.href)
      toast.success(`Exported ${all.length} expense${all.length === 1 ? "" : "s"}`)
    } catch {
      toast.error("Could not export expenses")
    } finally {
      setExporting(false)
    }
  }

  const save = async () => {
    const amount = Number(form.amount)
    if (!(amount > 0)) { setErr("Enter an amount above zero."); return }
    if (!form.title.trim()) { setErr("Say what the money was for."); return }
    if (!form.categoryId) { setErr("Pick a category."); return }
    if (!form.date) { setErr("Choose the date."); return }
    if (form.recurring && !form.nextDue) { setErr("Choose when the next bill is due."); return }
    if (form.recurring && form.nextDue < form.date) { setErr("Next due date must be on or after the expense date."); return }
    if (form.recurring && form.recEnd && form.recEnd < form.date) { setErr("The repeat end date must be on or after the expense date."); return }
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
      toast.success(editing ? "Expense updated" : "Expense saved")
      startEdit(null)
      load(); loadCommon()
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not save the expense.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (e: ExpenseResponse) => {
    if (!window.confirm(`Delete "${e.title}"?`)) return
    try {
      await expenseApi.delete(e.id)
      toast.success("Expense deleted")
      if (editing?.id === e.id) startEdit(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Could not delete")
    }
  }

  const trendMax = Math.max(1, ...trend.map((t) => t.amount))
  const rowSum = rows.reduce((a, r) => a + r.amount, 0)
  const hasFilter = !!(qD || fCat !== "all" || fMethod !== "all" || fLoc !== "all" || fVendor !== "all" || tab !== "all")
  const amtVal = Number(form.amount) || 0
  const catColor = useMemo(() => Object.fromEntries(cats.map((c, i) => [c.id, c.color || PALETTE[i % PALETTE.length]])), [cats])

  if (blocked) return blocked

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Expenses</h1>
          <p className="mt-1 text-sm text-dash-muted">Track every taka going out — rent, bills, salaries — and see what is left as profit.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} disabled={exporting} className={cn(outlineBtn, "disabled:opacity-50")}><Download className="size-4" aria-hidden /> {exporting ? "Exporting…" : "Export"}</button>
          <button type="button" onClick={() => startEdit(null)} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white"><Plus className="size-4" aria-hidden /> New expense</button>
        </div>
      </div>

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[110px] rounded-[14px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: "Spent this month", value: formatCurrency(stats.spentThisMonth), icon: <Wallet className="size-4" />, color: "yellow",
            hint: stats.deltaPct === null ? "No spending last month" : `${stats.deltaPct >= 0 ? "+" : "−"}${Math.abs(Math.round(stats.deltaPct))}% vs last month` },
          { label: "This year", value: formatCurrency(stats.yearTotal), icon: <Banknote className="size-4" />, color: "blue", hint: `${stats.yearCount} expenses` },
          { label: "Recurring / month", value: formatCurrency(stats.recurringMonthly), icon: <Repeat className="size-4" />, color: "purple",
            hint: stats.recurringCount ? `${stats.recurringCount} repeating bill${stats.recurringCount === 1 ? "" : "s"}` : "No recurring bills" },
          { label: "Bills due this week", value: stats.billsDueThisWeek.length, icon: <CalendarClock className="size-4" />, color: stats.billsDueThisWeek.length ? "red" : "green",
            hint: stats.billsDueThisWeek.length ? stats.billsDueThisWeek.slice(0, 2).map((b) => `${b.title} ${fmtD(b.nextDueDate).replace(/, \d{4}$/, "")}`).join(" · ") : "Nothing due" },
          { label: "Profit after expenses", value: `${stats.profitAfterExpenses < 0 ? "−" : ""}${formatCurrency(Math.abs(stats.profitAfterExpenses))}`, icon: <TrendingUp className="size-4" />, color: stats.profitAfterExpenses < 0 ? "red" : "green",
            hint: `Revenue ${formatCurrency(stats.monthRevenue)} this month` },
        ]} />
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-[14px] border border-dash-border bg-dash-card p-5">
              <h2 className="font-dash-display text-base font-bold">Where the money went · {win.label}</h2>
              {byCat.length === 0 ? <p className="py-6 text-sm text-dash-muted">No expenses in this period.</p> : (
                <div className="mt-3 flex flex-col gap-3">
                  {byCat.slice(0, 6).map((b, i) => (
                    <div key={`${b.categoryId}-${b.name}`} className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[13px]"><span className="font-semibold">{b.name}</span><span className="tabular-nums text-dash-muted">{formatCurrency(b.amount)} · {Math.round(b.pct)}%</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-dash-neutral-soft"><div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.round(b.pct))}%`, background: b.color || PALETTE[i % PALETTE.length] }} /></div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="rounded-[14px] border border-dash-border bg-dash-card p-5">
              <h2 className="font-dash-display text-base font-bold">Last 6 months</h2>
              <div className="mt-4 flex h-[150px] items-end gap-2">
                {trend.map((t) => (
                  <div key={t.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] font-semibold tabular-nums text-dash-muted">{t.amount ? formatCurrency(t.amount).replace(/\.00$/, "") : ""}</span>
                    <div className="w-full rounded-t-md bg-dash-accent" style={{ height: `${Math.max(2, Math.round((t.amount / trendMax) * 110))}px` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-2">{trend.map((t) => <span key={t.month} className="min-w-0 flex-1 text-center text-[11px] text-dash-muted">{t.label}</span>)}</div>
            </section>
          </div>

          <section className="rounded-[14px] border border-dash-border bg-dash-card">
            <div className="px-4">
              <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }} tabs={[
                { value: "all", label: "All", count: counts.all }, { value: "rec", label: "Recurring", count: counts.rec },
                { value: "salary", label: "Salaries", count: counts.salary }, { value: "manual", label: "Manual", count: counts.manual },
              ]} />
            </div>
            <div className="flex flex-wrap items-center gap-2.5 p-4">
              <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
                <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search expenses</span>
                <input type="search" placeholder="Search title, note, category, paid to or reference…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
              </label>
              <select aria-label="Category" className={filterSelCls} value={fCat} onChange={(e) => { setFCat(e.target.value); setPage(1) }}><option value="all">Category: All</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <select aria-label="Paid from" className={filterSelCls} value={fMethod} onChange={(e) => { setFMethod(e.target.value); setPage(1) }}><option value="all">Paid from: All</option>{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
              <select aria-label="Location" className={filterSelCls} value={fLoc} onChange={(e) => { setFLoc(e.target.value); setPage(1) }}><option value="all">Location: All</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
              <select aria-label="Supplier" className={filterSelCls} value={fVendor} onChange={(e) => { setFVendor(e.target.value); setPage(1) }}><option value="all">Supplier: All</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
              <select aria-label="Period" className={filterSelCls} value={period} onChange={(e) => { setPeriod(e.target.value as Period); setPage(1) }}>{PERIODS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
              {period === "custom" && (
                <>
                  <input type="date" aria-label="From" className={filterSelCls} value={cFrom} onChange={(e) => { setCFrom(e.target.value); setPage(1) }} />
                  <input type="date" aria-label="To" className={filterSelCls} value={cTo} onChange={(e) => { setCTo(e.target.value); setPage(1) }} />
                </>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                    <th className="py-3 pl-4 pr-2 font-semibold">Expense</th><th className="px-2 py-3 font-semibold">Category</th><th className="px-2 py-3 font-semibold">Date</th>
                    <th className="px-2 py-3 font-semibold">Paid from</th><th className="px-2 py-3 text-right font-semibold">Amount</th><th className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? [1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-11 rounded" /></td></tr>) :
                    rows.length === 0 ? (
                      <tr><td colSpan={6} className="py-14 text-center">
                        <Wallet className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                        <p className="font-semibold">No expenses found</p>
                        <p className="text-sm text-dash-muted">{hasFilter ? "Try clearing the filters." : "Record the first expense with the form."}</p>
                      </td></tr>
                    ) : rows.map((r) => (
                      <tr key={r.id} className={editing?.id === r.id ? "bg-dash-accent-soft/40" : ""}>
                        <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                          <div className="font-semibold">{r.title}{r.isRecurring && <span className="ml-2 rounded-full bg-dash-accent-soft px-2 py-px text-[11px] font-bold text-dash-accent-fg">↻ {String(r.recurringFrequency ?? "")}{r.recurringEndDate ? ` until ${fmtD(r.recurringEndDate)}` : ""}</span>}</div>
                          <div className="text-xs text-dash-muted">{[r.vendorName ?? r.paidTo, r.referenceNo && `#${r.referenceNo}`].filter(Boolean).join(" · ") || "—"}</div>
                          {r.notes && <div className="max-w-[260px] truncate text-xs text-dash-muted">{r.notes}</div>}
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-dash-neutral-soft px-2.5 py-[3px] text-xs font-semibold">
                            <span className="size-2 rounded-full" style={{ background: r.categoryColor || catColor[r.expenseCategoryId] || PALETTE[0] }} />{r.categoryName ?? "—"}
                          </span>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3 text-dash-muted">{fmtD(r.expenseDate)}</td>
                        <td className="border-b border-dash-border-soft px-2 py-3">{r.paymentMethod || "—"}</td>
                        <td className="border-b border-dash-border-soft px-2 py-3 text-right font-bold tabular-nums">{formatCurrency(r.amount)}</td>
                        <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                          <div className="flex justify-end gap-1">
                            {r.locked || r.source === "salary" ? <span className="text-xs text-dash-muted">Paid via Salary</span> : (
                              <>
                                <button type="button" aria-label={`Edit ${r.title}`} className={iconBtn} onClick={() => startEdit(r)}><Pencil className="size-4" /></button>
                                <button type="button" aria-label={`Delete ${r.title}`} className={iconBtn} onClick={() => remove(r)}><Trash2 className="size-4" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pt-3.5 text-[13px] text-dash-muted tabular-nums">{total} expenses · {formatCurrency(rowSum)}{total > rows.length ? " on this page" : ""}</div>
            {!loading && total > 0 && (
              <div className="p-4 pt-3">
                <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
                  onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
              </div>
            )}
          </section>
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-5 xl:w-[380px]">
          <h2 className="font-dash-display text-lg font-bold">{editing ? "Edit expense" : "New expense"}</h2>
          {err && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
          {!editing && templates.length > 0 && (
            <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Repeat a recent expense
              <div role="group" aria-label="Templates" className="flex flex-wrap gap-1.5">
                {templates.map((t, i) => (
                  <button key={i} type="button" onClick={() => applyTemplate(t)} className="h-8 rounded-full border border-dash-border bg-dash-card px-3 text-xs font-semibold hover:bg-dash-neutral-soft">{t.title}</button>
                ))}
              </div>
            </div>
          )}
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Amount *
            <input type="number" min={0} step="any" className={input} value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" /></label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">What for *
            <input className={input} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Shop rent" /></label>
          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Category *
            <div role="group" aria-label="Category" className="flex flex-wrap gap-1.5">
              {(editing && !cats.some((c) => c.id === editing.expenseCategoryId) ? [...cats, ...allCats.filter((c) => c.id === editing.expenseCategoryId)] : cats).map((c) => (
                <button key={c.id} type="button" aria-pressed={form.categoryId === String(c.id)} onClick={() => set("categoryId", String(c.id))}
                  className={cn("h-9 rounded-full border px-3 text-[13px] font-semibold", form.categoryId === String(c.id) ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{c.name}{c.status === false ? " (inactive)" : ""}</button>
              ))}
              <Link href="/dashboard/expenses/categories" className="inline-flex h-9 items-center px-2 text-[13px] font-semibold text-dash-accent hover:underline">+ New</Link>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Paid from *
            <div role="radiogroup" aria-label="Paid from" className="flex flex-wrap gap-1.5">
              {METHODS.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={form.method === m} onClick={() => set("method", m)}
                  className={cn("h-9 rounded-[10px] border-2 px-3 text-[13px] font-semibold", form.method === m ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{m}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Date *<input type="date" className={input} value={form.date} onChange={(e) => set("date", e.target.value)} /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Paid to<input className={input} value={form.paidTo} onChange={(e) => set("paidTo", e.target.value)} placeholder="Vendor or person" /></label>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Supplier (optional)
            <select className={input} value={form.vendorId} onChange={(e) => pickVendor(e.target.value)}><option value="">None</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Location
              <select className={input} value={form.locationId} onChange={(e) => set("locationId", e.target.value)}><option value="">All / none</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Reference / bill no.<input className={input} value={form.ref} onChange={(e) => set("ref", e.target.value)} placeholder="Optional" /></label>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Note
            <textarea rows={2} className={cn(input, "h-auto py-2.5")} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="Optional" /></label>
          <button type="button" role="switch" aria-checked={form.recurring} onClick={toggleRecurring}
            className="flex items-center justify-between gap-3 rounded-xl border border-dash-border px-3.5 py-3 text-left">
            <span className="flex flex-col"><span className="text-sm font-semibold">Repeats every month</span><span className="text-xs text-dash-muted">Marks it as a repeating bill</span></span>
            <span className={cn("flex h-5 w-9 items-center rounded-full p-0.5", form.recurring ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}><span className="size-4 rounded-full bg-white" /></span>
          </button>
          {form.recurring && (
            <div className="grid gap-2.5 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Every<select className={input} value={form.every} onChange={(e) => changeEvery(e.target.value)}>{EVERY.map((x) => <option key={x}>{x}</option>)}</select></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Next due<input type="date" className={input} value={form.nextDue} onChange={(e) => set("nextDue", e.target.value)} /></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Stop repeating after<input type="date" className={input} value={form.recEnd} onChange={(e) => set("recEnd", e.target.value)} /></label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => startEdit(null)} className={outlineBtn}>Clear</button>
            <button type="button" disabled={saving} onClick={save} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
              {saving ? "Saving…" : `${editing ? "Save changes" : "Save expense"}${amtVal > 0 ? ` · ${formatCurrency(amtVal)}` : ""}`}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
