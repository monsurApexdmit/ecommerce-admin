"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Download, Pencil, Tag, Trash2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { expenseCategoryApi, type ExpenseCategoryResponse, type ExpenseCategoryStats } from "@/lib/expenseCategoryApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const TYPES = ["Operating cost", "Cost of goods", "Owner drawing", "Tax / fees"]
const SWATCHES = ["#2449E8", "#0F766E", "#F59E0B", "#5B21B6", "#B42318", "#7C8AA8", "#DB2777", "#0E1525"]

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"

const emptyForm = { name: "", description: "", color: SWATCHES[0], budget: "", type: TYPES[0] }

export default function ExpenseCategoriesPage() {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const blocked = useModuleGuard("Expenses")

  const [cats, setCats] = useState<ExpenseCategoryResponse[]>([])
  const [stats, setStats] = useState<ExpenseCategoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [showInactive, setShowInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(9)

  const [editing, setEditing] = useState<ExpenseCategoryResponse | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 250); return () => clearTimeout(t) }, [q])

  const load = useCallback(async () => {
    try {
      const res = await expenseCategoryApi.getOverview({ search: qD || undefined, include_inactive: true })
      setCats(res.data); setStats(res.stats)
    } catch {
      setCats([])
    } finally {
      setLoading(false)
    }
  }, [qD])
  useEffect(() => { load() }, [load])

  const visible = cats.filter((c) => showInactive || c.status !== false)
  const inactiveCount = cats.filter((c) => c.status === false).length
  const pageItems = visible.slice((page - 1) * perPage, page * perPage)

  const startEdit = (c: ExpenseCategoryResponse | null) => {
    setEditing(c)
    setForm(c ? { name: c.name, description: c.description ?? "", color: c.color || SWATCHES[0], budget: c.monthlyBudget ? String(c.monthlyBudget) : "", type: c.type || TYPES[0] } : emptyForm)
    setErr("")
  }

  const save = async () => {
    if (!form.name.trim()) { setErr("Give the category a name."); return }
    const budget = form.budget.trim() === "" ? null : Number(form.budget)
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) { setErr("Budget must be 0 or more."); return }
    setSaving(true); setErr("")
    try {
      const body = { name: form.name.trim(), description: form.description.trim(), color: form.color, monthlyBudget: budget, type: form.type }
      if (editing) await expenseCategoryApi.update(editing.id, body)
      else await expenseCategoryApi.create({ ...body, status: true })
      toast({ title: editing ? "Category updated" : "Category added", description: body.name })
      startEdit(null)
      load()
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not save the category.")
    } finally {
      setSaving(false)
    }
  }

  const flip = async (c: ExpenseCategoryResponse) => {
    try { await expenseCategoryApi.update(c.id, { status: c.status === false }); load() }
    catch (e: any) { toast({ variant: "destructive", title: "Could not change status", description: e?.response?.data?.message }) }
  }

  const remove = async (c: ExpenseCategoryResponse) => {
    if (!window.confirm(`Delete ${c.name}?`)) return
    try {
      await expenseCategoryApi.delete(c.id)
      toast({ title: "Category deleted", description: c.name })
      if (editing?.id === c.id) startEdit(null)
      load()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not delete", description: e?.response?.data?.message || "This category is in use" })
    }
  }

  const handleExport = () => {
    exportToCSV(cats.map((c) => ({
      name: c.name, description: c.description ?? "", type: c.type ?? "", monthly_budget: String(c.monthlyBudget ?? 0), spent_this_month: String(c.spentThisMonth ?? 0),
      "expenses_(all_time)": String(c.allTimeCount ?? 0), "spent_(all_time)": String(c.allTimeSpent ?? 0), active: c.status === false ? "No" : "Yes",
    })), "expense-categories", ["Name", "Description", "Type", "Monthly budget", "Spent this month", "Expenses (all time)", "Spent (all time)", "Active"])
  }

  if (blocked) return blocked

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Expense categories</h1>
          <p className="mt-1 text-sm text-dash-muted">Group spending and set monthly budgets so nothing creeps up unnoticed.</p>
        </div>
        <button type="button" onClick={handleExport} className={outlineBtn}><Download className="size-4" aria-hidden /> Export</button>
      </div>

      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px] rounded-[14px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: "Categories", value: stats.activeCount, icon: <Tag className="size-4" />, color: "blue", hint: `${stats.inactiveCount} inactive` },
          { label: "Spent this month", value: formatCurrency(stats.monthTotal), icon: <Tag className="size-4" />, color: "yellow", hint: `${stats.monthCount} expenses` },
          { label: "Monthly budget", value: formatCurrency(stats.budgetTotal), icon: <Tag className="size-4" />, color: "purple",
            hint: stats.budgetTotal && stats.budgetUsedPct !== null ? `${Math.round(stats.budgetUsedPct)}% used across all categories` : "No budgets set" },
          { label: "Over budget", value: stats.overBudgetCount, icon: <Tag className="size-4" />, color: stats.overBudgetCount ? "red" : "green", hint: stats.overBudgetCount ? "Needs attention" : "All within budget" },
        ]} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-dash-muted">
          <span className="sr-only">Search categories</span>
          <input type="search" placeholder="Search name, description or type…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
        </label>
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" checked={showInactive} onChange={(e) => { setShowInactive(e.target.checked); setPage(1) }} className="size-4" />Show inactive ({inactiveCount})
        </label>
      </div>

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <section className="w-full min-w-0 flex-1">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[190px] rounded-[14px]" />)}</div>
          ) : pageItems.length === 0 ? (
            <div className="rounded-[14px] border border-dash-border bg-dash-card py-14 text-center">
              <Tag className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
              <p className="font-semibold">{cats.length === 0 ? "No categories yet" : "No categories match"}</p>
              <p className="text-sm text-dash-muted">{cats.length === 0 ? "Add one with the form on the right." : "Try a different search."}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {pageItems.map((c) => {
                const spent = c.spentThisMonth ?? 0
                const budget = c.monthlyBudget ?? 0
                const pct = budget ? Math.round((spent / budget) * 100) : 0
                const barColor = !budget ? "var(--dash-border)" : pct > 100 ? "#B42318" : pct >= 80 ? "#F59E0B" : "#0F766E"
                const on = c.status !== false
                const warn = budget && pct > 100 ? `Over budget by ${formatCurrency(spent - budget)}` : budget && pct >= 80 ? `${pct}% of the budget used` : ""
                return (
                  <article key={c.id} className={cn("flex flex-col gap-3 rounded-[14px] border bg-dash-card p-4", editing?.id === c.id ? "border-dash-accent" : "border-dash-border", !on && "opacity-70")}>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 size-9 shrink-0 rounded-[10px]" style={{ background: c.color || SWATCHES[0] }} aria-hidden />
                      <div className="min-w-0">
                        <div className="font-semibold">{c.name}{!on && <span className="ml-2 rounded-full bg-dash-neutral-soft px-2 py-px text-[11px] font-bold text-dash-neutral-fg">Inactive</span>}</div>
                        <div className="truncate text-xs text-dash-muted">{c.description || "—"}</div>
                        <div className="text-xs text-dash-muted">{c.type}</div>
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="font-dash-display text-xl font-bold tabular-nums">{formatCurrency(spent)}</span>
                      <span className="text-xs text-dash-muted">{c.countThisMonth ?? 0} this month</span>
                    </div>
                    <div className="text-xs text-dash-muted tabular-nums">All time: {formatCurrency(c.allTimeSpent ?? 0)} · {c.allTimeCount ?? 0} expenses</div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs"><span className="text-dash-muted">{budget ? `Budget ${formatCurrency(budget)}` : "No budget"}</span>
                        {budget > 0 && <strong className={cn("tabular-nums", spent > budget && "text-dash-danger-fg")}>{spent > budget ? `Over by ${formatCurrency(spent - budget)}` : `${formatCurrency(budget - spent)} left`}</strong>}</div>
                      <div className="h-2 overflow-hidden rounded-full bg-dash-neutral-soft"><div className="h-full rounded-full" style={{ width: `${Math.min(100, budget ? pct : 0)}%`, background: barColor }} /></div>
                    </div>
                    {warn && <span className={cn("text-xs font-semibold", pct > 100 ? "text-dash-danger-fg" : "text-dash-warn-fg")}>{warn}</span>}
                    <div className="mt-auto flex items-center gap-1.5 pt-1">
                      <button type="button" aria-label={`Edit ${c.name}`} className={iconBtn} onClick={() => startEdit(c)}><Pencil className="size-4" /></button>
                      <button type="button" aria-label={`Delete ${c.name}`} disabled={c.system} title={c.system ? "Managed by payroll" : undefined} className={cn(iconBtn, c.system && "cursor-not-allowed opacity-40")} onClick={() => remove(c)}><Trash2 className="size-4" /></button>
                      <button type="button" role="switch" aria-checked={on} aria-label={`${c.name} active`} disabled={c.system} title={c.system ? "Managed by payroll" : undefined} onClick={() => flip(c)}
                        className={cn("ml-1 flex h-5 w-9 items-center rounded-full p-0.5", on ? "justify-end bg-dash-accent" : "justify-start bg-dash-border", c.system && "cursor-not-allowed opacity-40")}><span className="size-4 rounded-full bg-white" /></button>
                      <Link href="/dashboard/expenses" className="ml-auto text-[13px] font-semibold text-dash-accent hover:underline">View expenses</Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          {!loading && visible.length > 0 && (
            <div className="mt-4">
              <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(visible.length / perPage))} itemsPerPage={perPage} totalItems={visible.length}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            </div>
          )}
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-5 xl:w-[360px]">
          <h2 className="font-dash-display text-lg font-bold">{editing ? `Edit ${editing.name}` : "New category"}</h2>
          {err && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Name *
            <input className={input} disabled={!!editing?.system} title={editing?.system ? "The Salaries category is managed by payroll" : undefined} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Packaging" /></label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Description
            <textarea rows={2} className={cn(input, "h-auto py-2.5")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What goes here" /></label>
          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Colour
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((s) => (
                <button key={s} type="button" aria-label={s} aria-pressed={form.color === s} onClick={() => setForm({ ...form, color: s })}
                  className={cn("size-8 rounded-full border-2", form.color === s ? "border-dash-ink" : "border-transparent")} style={{ background: s }} />
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Monthly budget (optional)
            <input type="number" min={0} className={input} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="e.g. 5000" />
            <span className="text-xs font-normal text-dash-muted">We warn you at 80% and when you go over.</span></label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Type
            <select className={input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => startEdit(null)} className={outlineBtn}>Clear</button>
            <button type="button" disabled={saving} onClick={save} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">{saving ? "Saving…" : editing ? "Save changes" : "Add category"}</button>
          </div>
        </aside>
      </div>
    </div>
  )
}
