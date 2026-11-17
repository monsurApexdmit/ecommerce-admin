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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { EmptyState } from "@/components/common/EmptyState"
import { Toolbar } from "@/components/common/Toolbar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { SwatchPicker } from "@/components/common/SwatchPicker"
import { useTranslation } from "react-i18next"

// Category types are stored as these English codes; only the label is translated (unknown stored values show raw)
const TYPES = ["Operating cost", "Cost of goods", "Owner drawing", "Tax / fees"]
const TYPE_KEYS = {
  "Operating cost": "customers:expenses.categories.types.operating",
  "Cost of goods": "customers:expenses.categories.types.cogs",
  "Owner drawing": "customers:expenses.categories.types.drawing",
  "Tax / fees": "customers:expenses.categories.types.tax",
} as const
const SWATCHES = ["#2449E8", "#0F766E", "#F59E0B", "#5B21B6", "#B42318", "#7C8AA8", "#DB2777", "#0E1525"]

const emptyForm = { name: "", description: "", color: SWATCHES[0], budget: "", type: TYPES[0] }

export default function ExpenseCategoriesPage() {
  const { t } = useTranslation(["customers", "common"])
  const typeLabel = (v?: string | null) => { const k = v ? (TYPE_KEYS as Record<string, (typeof TYPE_KEYS)[keyof typeof TYPE_KEYS] | undefined>)[v] : undefined; return k ? t(k) : (v ?? "") }
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
    if (!form.name.trim()) { setErr(t("customers:expenses.categories.errors.name")); return }
    const budget = form.budget.trim() === "" ? null : Number(form.budget)
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) { setErr(t("customers:expenses.categories.errors.budget")); return }
    setSaving(true); setErr("")
    try {
      const body = { name: form.name.trim(), description: form.description.trim(), color: form.color, monthlyBudget: budget, type: form.type }
      if (editing) await expenseCategoryApi.update(editing.id, body)
      else await expenseCategoryApi.create({ ...body, status: true })
      toast({ title: editing ? t("customers:expenses.categories.toast.updated") : t("customers:expenses.categories.toast.added"), description: body.name })
      startEdit(null)
      load()
    } catch (e: any) {
      setErr(e?.response?.data?.message || t("customers:expenses.categories.errors.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const flip = async (c: ExpenseCategoryResponse) => {
    try { await expenseCategoryApi.update(c.id, { status: c.status === false }); load() }
    catch (e: any) { toast({ variant: "destructive", title: t("customers:expenses.categories.toast.statusFailed"), description: e?.response?.data?.message }) }
  }

  const remove = async (c: ExpenseCategoryResponse) => {
    if (!window.confirm(t("common:confirm.deleteTitle", { name: c.name }))) return
    try {
      await expenseCategoryApi.delete(c.id)
      toast({ title: t("customers:expenses.categories.toast.deleted"), description: c.name })
      if (editing?.id === c.id) startEdit(null)
      load()
    } catch (e: any) {
      toast({ variant: "destructive", title: t("customers:expenses.categories.toast.deleteFailed"), description: e?.response?.data?.message || t("customers:expenses.categories.toast.inUse") })
    }
  }

  // Headers stay English: exportToCSV derives each row key from its header (lower-cased, spaces → "_")
  const handleExport = () => {
    exportToCSV(cats.map((c) => ({
      name: c.name, description: c.description ?? "", type: c.type ?? "", monthly_budget: String(c.monthlyBudget ?? 0), spent_this_month: String(c.spentThisMonth ?? 0),
      "expenses_(all_time)": String(c.allTimeCount ?? 0), "spent_(all_time)": String(c.allTimeSpent ?? 0), active: c.status === false ? "No" : "Yes",
    })), "expense-categories", ["Name", "Description", "Type", "Monthly budget", "Spent this month", "Expenses (all time)", "Spent (all time)", "Active"])
  }

  if (blocked) return blocked

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title={t("customers:expenses.categories.title")}
        description={t("customers:expenses.categories.description")}
        actions={<Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> {t("common:actions.export")}</Button>}
      />

      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: t("customers:expenses.categories.kpi.categories"), value: stats.activeCount, icon: <Tag className="size-4" />, color: "blue", hint: t("customers:expenses.categories.kpi.inactiveHint", { count: stats.inactiveCount }) },
          { label: t("customers:expenses.categories.kpi.spentMonth"), value: formatCurrency(stats.monthTotal), icon: <Tag className="size-4" />, color: "yellow", hint: t("customers:expenses.categories.kpi.monthHint", { count: stats.monthCount }) },
          { label: t("customers:expenses.categories.kpi.budget"), value: formatCurrency(stats.budgetTotal), icon: <Tag className="size-4" />, color: "purple",
            hint: stats.budgetTotal && stats.budgetUsedPct !== null ? t("customers:expenses.categories.kpi.budgetUsed", { pct: Math.round(stats.budgetUsedPct) }) : t("customers:expenses.categories.kpi.noBudgets") },
          { label: t("customers:expenses.categories.kpi.over"), value: stats.overBudgetCount, icon: <Tag className="size-4" />, color: stats.overBudgetCount ? "red" : "green", hint: stats.overBudgetCount ? t("customers:expenses.categories.kpi.attention") : t("customers:expenses.categories.kpi.within") },
        ]} />
      )}

      <Toolbar>
        <div className="min-w-[240px] flex-1">
          <Label htmlFor="category-search" className="sr-only">{t("customers:expenses.categories.searchLabel")}</Label>
          <Input id="category-search" type="search" placeholder={t("customers:expenses.categories.searchPlaceholder")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        </div>
        <Label className="flex items-center gap-2">
          <Checkbox checked={showInactive} onCheckedChange={(v) => { setShowInactive(v === true); setPage(1) }} />{t("customers:expenses.categories.showInactive", { count: inactiveCount })}
        </Label>
      </Toolbar>

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <section className="w-full min-w-0 flex-1">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[190px]" />)}</div>
          ) : pageItems.length === 0 ? (
            <EmptyState
              bordered
              icon={Tag}
              title={cats.length === 0 ? t("customers:expenses.categories.empty.none") : t("customers:expenses.categories.empty.noMatch")}
              description={cats.length === 0 ? t("customers:expenses.categories.empty.noneDesc") : t("customers:expenses.categories.empty.noMatchDesc")}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {pageItems.map((c) => {
                const spent = c.spentThisMonth ?? 0
                const budget = c.monthlyBudget ?? 0
                const pct = budget ? Math.round((spent / budget) * 100) : 0
                const barColor = !budget ? "var(--border)" : pct > 100 ? "#B42318" : pct >= 80 ? "#F59E0B" : "#0F766E"
                const on = c.status !== false
                const warn = budget && pct > 100 ? t("customers:expenses.categories.overBudgetBy", { amount: formatCurrency(spent - budget) }) : budget && pct >= 80 ? t("customers:expenses.categories.pctUsed", { pct }) : ""
                return (
                  <Card key={c.id} className={cn("gap-3 p-4", editing?.id === c.id && "border-primary", !on && "opacity-70")}>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 size-9 shrink-0 rounded-md" style={{ background: c.color || SWATCHES[0] }} aria-hidden />
                      <div className="min-w-0">
                        <div className="font-medium">{c.name}{!on && <Badge variant="secondary" className="ml-2">{t("common:status.inactive")}</Badge>}</div>
                        <div className="truncate text-xs text-muted-foreground">{c.description || "—"}</div>
                        <div className="text-xs text-muted-foreground">{typeLabel(c.type)}</div>
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-semibold tabular-nums">{formatCurrency(spent)}</span>
                      <span className="text-xs text-muted-foreground">{t("customers:expenses.categories.thisMonth", { count: c.countThisMonth ?? 0 })}</span>
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">{t("customers:expenses.categories.allTime", { amount: formatCurrency(c.allTimeSpent ?? 0), count: c.allTimeCount ?? 0 })}</div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{budget ? t("customers:expenses.categories.budgetAmt", { amount: formatCurrency(budget) }) : t("customers:expenses.categories.noBudget")}</span>
                        {budget > 0 && <strong className={cn("tabular-nums", spent > budget && "text-destructive")}>{spent > budget ? t("customers:expenses.categories.overBy", { amount: formatCurrency(spent - budget) }) : t("customers:expenses.categories.left", { amount: formatCurrency(budget - spent) })}</strong>}</div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${Math.min(100, budget ? pct : 0)}%`, background: barColor }} /></div>
                    </div>
                    {warn && <span className={cn("text-xs font-medium", pct > 100 ? "text-destructive" : "text-amber-600")}>{warn}</span>}
                    <div className="mt-auto flex items-center gap-1.5 pt-1">
                      <WithTooltip content={t("customers:expenses.categories.editAria", { name: c.name })}><Button type="button" variant="outline" size="icon" aria-label={t("customers:expenses.categories.editAria", { name: c.name })} onClick={() => startEdit(c)}><Pencil className="size-4" /></Button></WithTooltip>
                      <WithTooltip content={c.system ? t("customers:expenses.categories.payroll") : undefined}>
                        <span tabIndex={c.system ? 0 : undefined}>
                          <Button type="button" variant="outline" size="icon" aria-label={t("customers:expenses.categories.deleteAria", { name: c.name })} disabled={c.system} onClick={() => remove(c)}><Trash2 className="size-4" /></Button>
                        </span>
                      </WithTooltip>
                      <WithTooltip content={c.system ? t("customers:expenses.categories.payroll") : undefined}>
                        <span tabIndex={c.system ? 0 : undefined} className="ml-1 inline-flex">
                          <Switch checked={on} aria-label={t("customers:expenses.categories.activeAria", { name: c.name })} disabled={c.system} onCheckedChange={() => flip(c)} />
                        </span>
                      </WithTooltip>
                      <Button asChild variant="link" size="sm" className="ml-auto"><Link href="/dashboard/expenses">{t("customers:expenses.categories.viewExpenses")}</Link></Button>
                    </div>
                  </Card>
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

        <aside className="w-full shrink-0 xl:w-[360px]">
          <SectionCard title={editing ? t("customers:expenses.categories.editName", { name: editing.name }) : t("customers:expenses.categories.newCategory")} contentClassName="flex flex-col gap-3.5">
            {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
            <FormField label={t("common:fields.name")} required htmlFor="cat-name" description={editing?.system ? t("customers:expenses.categories.salariesNote") : undefined}>
              <Input id="cat-name" disabled={!!editing?.system} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("customers:expenses.categories.namePlaceholder")} /></FormField>
            <FormField label={t("common:fields.description")} htmlFor="cat-desc">
              <Textarea id="cat-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("customers:expenses.categories.descPlaceholder")} /></FormField>
            <FormField label={t("customers:expenses.categories.colour")}>
              <SwatchPicker size="sm" aria-label={t("customers:expenses.categories.colour")} options={SWATCHES.map((s) => ({ value: s, label: s, color: s }))} value={form.color} onValueChange={(s) => setForm({ ...form, color: s })} />
            </FormField>
            <FormField label={t("customers:expenses.categories.budgetOptional")} htmlFor="cat-budget" description={t("customers:expenses.categories.budgetHelp")}>
              <Input id="cat-budget" type="number" min={0} className="tabular-nums" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder={t("customers:expenses.categories.budgetPlaceholder")} />
            </FormField>
            <FormField label={t("common:fields.type")} htmlFor="cat-type">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger id="cat-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((ty) => <SelectItem key={ty} value={ty}>{typeLabel(ty)}</SelectItem>)}</SelectContent>
              </Select></FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => startEdit(null)}>{t("common:actions.clear")}</Button>
              <Button type="button" disabled={saving} onClick={save}>{saving ? t("common:actions.saving") : editing ? t("common:actions.saveChanges") : t("customers:expenses.categories.add")}</Button>
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  )
}
