"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, MoreHorizontal, Pencil, Plus, Ruler, Search, Upload, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusTabs } from "@/components/ui/status-tabs"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { unitApi, type UnitResponse } from "@/lib/unitApi"
import { exportToCSV, parseCSV } from "@/lib/export-import-utils"
import { usePagination } from "@/hooks/use-pagination"
import { useToast } from "@/hooks/use-toast"
import { useModuleGuard } from "@/hooks/use-module-guard"

const iconBtn =
  "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const fieldLabel = "flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold"
const fieldInput =
  "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal text-dash-ink outline-none placeholder:text-dash-muted focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const barBtn = "h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10"
type UnitType = "Count" | "Weight" | "Volume" | "Length"
const TYPES: UnitType[] = ["Count", "Weight", "Volume", "Length"]
const TYPE_STYLE: Record<string, string> = {
  Count: "bg-dash-accent-soft text-dash-accent-fg",
  Weight: "bg-dash-warn-soft text-dash-warn-fg",
  Volume: "bg-dash-success-soft text-dash-success-fg",
  Length: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
}
const emptyForm = { unitName: "", symbol: "", status: true, type: "Count" as UnitType, convQty: "", convUnit: "" }

export default function UnitsPage() {
  const { toast } = useToast()
  const [units, setUnits] = useState<UnitResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("all")
  const [typeFilter, setTypeFilter] = useState<"All" | UnitType>("All")
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<UnitResponse | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTargets, setDeleteTargets] = useState<UnitResponse[]>([])
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(() => {
    unitApi.getAll({ limit: 200 })
      .then((r) => setUnits(r.data))
      .catch(() => toast({ variant: "destructive", title: "Could not load units" }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])

  const term = search.trim().toLowerCase()
  const filtered = useMemo(
    () => units.filter((u) =>
      (tab === "all" || (tab === "active" ? u.status : !u.status)) &&
      (typeFilter === "All" || (u.type ?? "Count") === typeFilter) &&
      (!term || u.unitName.toLowerCase().includes(term) || (u.symbol ?? "").toLowerCase().includes(term))),
    [units, tab, term, typeFilter],
  )
  const { currentItems, currentPage, totalPages, itemsPerPage, setCurrentPage, handleItemsPerPageChange } = usePagination(filtered, 10)

  const blocked = useModuleGuard("Units")
  if (blocked) return blocked

  const allChecked = filtered.length > 0 && filtered.every((u) => checked.has(u.id))
  const selected = units.filter((u) => checked.has(u.id))
  const toggleOne = (id: number) => setChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setChecked((p) => { const n = new Set(p); filtered.forEach((u) => (allChecked ? n.delete(u.id) : n.add(u.id))); return n })

  const openForm = (u?: UnitResponse | null) => {
    setEditing(u ?? null)
    setForm(u ? {
      unitName: u.unitName, symbol: u.symbol ?? "", status: u.status, type: (u.type as UnitType) ?? "Count",
      convQty: u.conversionQty ? String(u.conversionQty) : "", convUnit: u.conversionUnitId ? String(u.conversionUnitId) : "",
    } : emptyForm)
    setFormOpen(true)
  }

  const save = async () => {
    if (!form.unitName.trim() || !form.symbol.trim()) {
      toast({ variant: "destructive", title: "Missing details", description: "Unit name and symbol are required" })
      return
    }
    if (form.convUnit && !(Number(form.convQty) > 0)) {
      toast({ variant: "destructive", title: "Conversion needs a quantity", description: "Enter how many of the other unit make 1" })
      return
    }
    const nm = form.unitName.trim().toLowerCase()
    const sym = form.symbol.trim().toLowerCase()
    const others = units.filter((x) => x.id !== editing?.id)
    if (others.some((x) => x.unitName.trim().toLowerCase() === nm)) {
      toast({ variant: "destructive", title: "Name already used", description: `A unit named "${form.unitName.trim()}" already exists` })
      return
    }
    if (others.some((x) => (x.symbol ?? "").trim().toLowerCase() === sym)) {
      toast({ variant: "destructive", title: "Symbol already used", description: `"${form.symbol.trim()}" belongs to another unit` })
      return
    }
    setSaving(true)
    try {
      const payload = {
        unitName: form.unitName.trim(), symbol: form.symbol.trim(), status: form.status, type: form.type,
        conversionQty: form.convUnit ? Number(form.convQty) : null,
        conversionUnitId: form.convUnit ? Number(form.convUnit) : null,
      }
      if (editing) await unitApi.update(editing.id, payload)
      else await unitApi.create(payload)
      toast({ title: editing ? "Unit updated" : "Unit added", description: payload.unitName })
      setFormOpen(false)
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not save", description: err?.response?.data?.message || "Please try again" })
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (list: UnitResponse[], status: boolean) => {
    const res = await Promise.allSettled(list.filter((u) => u.status !== status).map((u) => unitApi.update(u.id, { status })))
    const failed = res.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: "Some updates failed", description: `${failed} units could not be updated` })
    load()
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const errors: string[] = []
    let ok = 0
    for (const u of deleteTargets) {
      try { await unitApi.delete(u.id); ok++ } catch (e: any) { errors.push(`${u.unitName}: ${e?.response?.data?.message || "failed"}`) }
    }
    setDeleting(false)
    setDeleteTargets([])
    setChecked(new Set())
    if (errors.length) toast({ variant: "destructive", title: `${ok} deleted, ${errors.length} failed`, description: errors.join(", ") })
    else toast({ title: "Deleted", description: `${ok} unit${ok === 1 ? "" : "s"} removed` })
    load()
  }

  const doExport = (list: UnitResponse[] = filtered) => {
    const byId = new Map(units.map((x) => [x.id, x]))
    exportToCSV(
      list.map((u) => {
        const t = u.conversionUnitId ? byId.get(u.conversionUnitId) : undefined
        return {
          name: u.unitName, symbol: u.symbol ?? "", type: u.type ?? "Count",
          conversion_qty: t ? u.conversionQty ?? "" : "", conversion_unit: t ? t.symbol || t.unitName : "",
          active: u.status ? "Yes" : "No",
        }
      }),
      "units", ["name", "symbol", "type", "conversion_qty", "conversion_unit", "active"],
    )
  }
  const doImport = () => {
    const el = document.createElement("input")
    el.type = "file"
    el.accept = ".csv"
    el.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const rows = parseCSV(ev.target?.result as string)
        let created = 0
        const made: { id: number; r: any; type: UnitType }[] = []
        for (const r of rows) {
          if (!r.name?.trim() || !r.symbol?.trim()) continue
          const type = TYPES.find((x) => x.toLowerCase() === (r.type ?? "").toLowerCase()) ?? "Count"
          const act = String(r.active ?? "").trim().toLowerCase()
          const status = !["no", "false", "0", "inactive"].includes(act)
          try {
            const res = await unitApi.create({ unitName: r.name.trim(), symbol: r.symbol.trim(), type, status })
            created++
            made.push({ id: res.data.id, r, type })
          } catch { /* skip duplicates / invalid rows */ }
        }
        // Second pass so conversion targets can be units created in the same file.
        let convFailed = 0
        const withConv = made.filter((m) => m.r.conversion_unit?.trim() && Number(m.r.conversion_qty) > 0)
        if (withConv.length) {
          const all = (await unitApi.getAll({ limit: 200 }).catch(() => ({ data: [] as UnitResponse[] }))).data
          for (const m of withConv) {
            const key = m.r.conversion_unit.trim().toLowerCase()
            const target = all.find((x) => (x.symbol ?? "").toLowerCase() === key || x.unitName.toLowerCase() === key)
            if (!target || target.id === m.id || (target.type ?? "Count") !== m.type) { convFailed++; continue }
            try { await unitApi.update(m.id, { conversionQty: Number(m.r.conversion_qty), conversionUnitId: target.id }) } catch { convFailed++ }
          }
        }
        toast({
          title: `Imported ${created} unit${created === 1 ? "" : "s"}`,
          description: convFailed ? `${convFailed} conversion${convFailed === 1 ? "" : "s"} skipped (unknown or different-type target)` : undefined,
        })
        load()
      }
      reader.readAsText(file)
    }
    el.click()
  }

  const activeCount = units.filter((u) => u.status).length

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Units</h1>
          <p className="mt-1 text-sm text-dash-muted">How products are counted, weighed or measured.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={doImport} className={outlineBtn}><Upload className="size-4" aria-hidden /> Import</button>
          <button type="button" onClick={() => doExport()} className={outlineBtn}><Download className="size-4" aria-hidden /> Export</button>
          <button type="button" onClick={() => openForm(null)}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">
            <Plus className="size-4" aria-hidden /> Add unit
          </button>
        </div>
      </div>

      <section className="rounded-[14px] border border-dash-border bg-dash-card">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(v) => { setTab(v); setChecked(new Set()) }} tabs={[
            { value: "all", label: "All", count: units.length },
            { value: "active", label: "Active", count: activeCount },
            { value: "inactive", label: "Inactive", count: units.length - activeCount },
          ]} />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden />
            <span className="sr-only">Search units</span>
            <input type="search" placeholder="Search units…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-1.5">
            {(["All", ...TYPES] as const).map((t) => (
              <button key={t} type="button" aria-pressed={typeFilter === t} onClick={() => { setTypeFilter(t); setChecked(new Set()) }}
                className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold ${typeFilter === t ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card text-dash-muted hover:bg-dash-neutral-soft"}`}>
                {t}
              </button>
            ))}
          </div>
          {(search || typeFilter !== "All") && (
            <button type="button" onClick={() => { setSearch(""); setTypeFilter("All") }} className="inline-flex h-11 items-center gap-1 px-2 text-[13px] font-semibold text-dash-muted hover:text-dash-ink">
              <X className="size-4" aria-hidden /> Clear
            </button>
          )}
        </div>

        {checked.size > 0 && (
          <div className="mx-4 mb-3 flex flex-wrap items-center gap-2.5 rounded-[10px] bg-dash-ink px-3.5 py-2.5 text-dash-bg">
            <span className="text-sm font-semibold">{checked.size} selected</span>
            <button type="button" onClick={() => setActive(selected, true)} className={barBtn}>Mark active</button>
            <button type="button" onClick={() => setActive(selected, false)} className={barBtn}>Mark inactive</button>
            <button type="button" onClick={() => doExport(selected)} className={barBtn}>Export selected</button>
            <button type="button" onClick={() => setDeleteTargets(selected)} className="h-9 rounded-lg border border-red-400/50 px-3 text-[13px] font-semibold text-red-300 hover:bg-white/10">Delete</button>
            <button type="button" onClick={() => setChecked(new Set())} className="ml-auto h-9 px-3 text-[13px] font-semibold opacity-80 hover:opacity-100">Clear</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                <th scope="col" className="w-5 py-3 pl-4 pr-2"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all units in this list" /></th>
                <th scope="col" className="px-2 py-3 font-semibold">Unit</th>
                <th scope="col" className="px-2 py-3 font-semibold">Type</th>
                <th scope="col" className="px-2 py-3 font-semibold">Conversion</th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">Used by</th>
                <th scope="col" className="px-2 py-3 font-semibold">Active</th>
                <th scope="col" className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>)
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <Ruler className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                    <p className="font-semibold">{units.length === 0 ? "No units yet" : "No units found"}</p>
                    <p className="text-sm text-dash-muted">{units.length === 0 ? "Add a unit such as pcs or kg to use it on products." : "Try a different search or tab."}</p>
                  </td>
                </tr>
              ) : (
                currentItems.map((u) => {
                  const ck = checked.has(u.id)
                  return (
                    <tr key={u.id} className={ck ? "bg-dash-bg" : ""}>
                      <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                        <Checkbox checked={ck} onCheckedChange={() => toggleOne(u.id)} aria-label={`Select ${u.unitName}`} />
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <button type="button" onClick={() => openForm(u)} className="flex items-center gap-2.5 text-left">
                          <span className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-dash-accent-soft px-2 text-xs font-bold text-dash-accent-fg">{u.symbol || "—"}</span>
                          <span className="font-semibold">{u.unitName}</span>
                        </button>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <span className={`rounded-full px-2.5 py-[3px] text-xs font-bold ${TYPE_STYLE[u.type ?? "Count"]}`}>{u.type ?? "Count"}</span>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-dash-muted">{u.conversion || "—"}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">
                        {(u.usedBy ?? u.productsCount) ? `${u.usedBy ?? u.productsCount} product${(u.usedBy ?? u.productsCount) === 1 ? "" : "s"}` : "—"}
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <Switch checked={u.status} aria-label={`Active: ${u.unitName}`} onCheckedChange={(v) => setActive([u], v)}
                          className="data-[state=checked]:bg-dash-accent data-[state=unchecked]:bg-dash-neutral" />
                      </td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" aria-label={`Edit ${u.unitName}`} onClick={() => openForm(u)} className={iconBtn}><Pencil className="size-4" /></button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label={`More actions for ${u.unitName}`} className={iconBtn}><MoreHorizontal className="size-4" /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openForm(u)}>Edit unit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setActive([u], !u.status)}>{u.status ? "Mark inactive" : "Mark active"}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-dash-danger focus:text-dash-danger" onClick={() => setDeleteTargets([u])}>Delete unit</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-4 pt-2">
          <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage} onItemsPerPageChange={handleItemsPerPageChange} totalItems={filtered.length} />
        </div>
      </section>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[480px] flex-col gap-0 overflow-hidden rounded-[18px] border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[480px]">
          <DialogHeader className="border-b border-dash-border px-6 py-[18px] text-left">
            <DialogTitle className="font-dash-display text-[22px] font-bold">{editing ? `Edit ${editing.unitName}` : "New unit"}</DialogTitle>
            <DialogDescription className="text-[13px] text-dash-muted">How you count, weigh or measure products.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-2.5">
              <label className={fieldLabel}>Unit name *
                <input className={fieldInput} placeholder="e.g. Kilogram" value={form.unitName} autoFocus
                  onChange={(e) => setForm({ ...form, unitName: e.target.value })} />
              </label>
              <label className={fieldLabel}>Symbol *
                <input className={fieldInput} placeholder="e.g. kg" value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") save() }} />
              </label>
            </div>
            <label className={fieldLabel}>Type
              <select className={fieldInput} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as UnitType, convUnit: "", convQty: "" })}>
                {TYPES.map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
              Conversion (optional, same type only)
              <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-sm font-normal">
                <span className="text-dash-muted">1 {form.symbol || "unit"} =</span>
                <input type="number" min={0} step="any" className={fieldInput} placeholder="e.g. 1000" value={form.convQty}
                  onChange={(e) => setForm({ ...form, convQty: e.target.value })} />
                <select className={fieldInput} value={form.convUnit} onChange={(e) => setForm({ ...form, convUnit: e.target.value })}>
                  <option value="">No conversion</option>
                  {units.filter((x) => x.id !== editing?.id && (x.type ?? "Count") === form.type).map((x) => <option key={x.id} value={x.id}>{x.unitName} ({x.symbol})</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-dash-border px-3.5 py-3">
              <span className="flex flex-col">
                <span id="unit-active-label" className="text-sm font-semibold">Active</span>
                <span className="text-xs text-dash-muted">Available when creating products</span>
              </span>
              <Switch checked={form.status} onCheckedChange={(v) => setForm({ ...form, status: v })} aria-labelledby="unit-active-label"
                className="data-[state=checked]:bg-dash-accent data-[state=unchecked]:bg-dash-neutral" />
            </div>
          </div>
          <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 border-t border-dash-border px-6 py-4">
            <button type="button" onClick={() => setFormOpen(false)} className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-[18px] text-sm font-semibold hover:bg-dash-neutral-soft">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="h-11 rounded-[10px] bg-dash-accent px-[22px] text-sm font-bold text-white disabled:opacity-40">
              {saving ? "Saving…" : editing ? "Save changes" : "Add unit"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && setDeleteTargets([])}>
        <AlertDialogContent className="font-dash-body text-dash-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTargets.length === 1 ? deleteTargets[0].unitName : `${deleteTargets.length} units`}?</AlertDialogTitle>
            <AlertDialogDescription>A unit used by products, or set as another unit’s conversion target, can’t be deleted — change those first. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-dash-danger text-white hover:bg-dash-danger-fg">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
