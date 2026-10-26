"use client"

import { cn } from "@/lib/utils"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, MoreHorizontal, Pencil, Plus, Ruler, Search, Upload, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { Toolbar } from "@/components/common/Toolbar"
import { BulkBar } from "@/components/common/BulkBar"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusTabs } from "@/components/ui/status-tabs"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { unitApi, type UnitResponse } from "@/lib/unitApi"
import { exportToCSV, parseCSV } from "@/lib/export-import-utils"
import { usePagination } from "@/hooks/use-pagination"
import { useToast } from "@/hooks/use-toast"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { WithTooltip } from "@/components/common/WithTooltip"

type UnitType = "Count" | "Weight" | "Volume" | "Length"
const TYPES: UnitType[] = ["Count", "Weight", "Volume", "Length"]
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
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title="Units"
        description="How products are counted, weighed or measured."
        actions={<>
          <Button type="button" variant="outline" onClick={doImport}><Upload className="size-4" aria-hidden /> Import</Button>
          <Button type="button" variant="outline" onClick={() => doExport()}><Download className="size-4" aria-hidden /> Export</Button>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="size-4" aria-hidden /> Add unit
          </Button>
        </>}
      />

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(v) => { setTab(v); setChecked(new Set()) }} tabs={[
            { value: "all", label: "All", count: units.length },
            { value: "active", label: "Active", count: activeCount },
            { value: "inactive", label: "Inactive", count: units.length - activeCount },
          ]} />
        </div>

        <Toolbar className="p-4">
          <div className="relative min-w-[240px] flex-1">
            <Label htmlFor="unit-search" className="sr-only">Search units</Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="unit-search" type="search" placeholder="Search units…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9" />
          </div>
          <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-1.5">
            {(["All", ...TYPES] as const).map((t) => (
              <Button key={t} type="button" size="sm" variant={typeFilter === t ? "default" : "outline"} aria-pressed={typeFilter === t}
                onClick={() => { setTypeFilter(t); setChecked(new Set()) }}>
                {t}
              </Button>
            ))}
          </div>
          {(search || typeFilter !== "All") && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(""); setTypeFilter("All") }}>
              <X className="size-4" aria-hidden /> Clear
            </Button>
          )}
        </Toolbar>

        <BulkBar count={checked.size} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setActive(selected, true)}>Mark active</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setActive(selected, false)}>Mark inactive</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => doExport(selected)}>Export selected</Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTargets(selected)}>Delete</Button>
        </BulkBar>

        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-5 pl-4"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all units in this list" /></TableHead>
              <TableHead scope="col">Unit</TableHead>
              <TableHead scope="col">Type</TableHead>
              <TableHead scope="col">Conversion</TableHead>
              <TableHead scope="col" className="text-right">Used by</TableHead>
              <TableHead scope="col">Active</TableHead>
              <TableHead scope="col" className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={7} className="px-4"><Skeleton className="h-10 rounded" /></TableCell></TableRow>)
            ) : currentItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState icon={Ruler} className="p-4 md:p-6"
                    title={units.length === 0 ? "No units yet" : "No units found"}
                    description={units.length === 0 ? "Add a unit such as pcs or kg to use it on products." : "Try a different search or tab."} />
                </TableCell>
              </TableRow>
            ) : (
              currentItems.map((u) => {
                const ck = checked.has(u.id)
                return (
                  <TableRow key={u.id} data-state={ck ? "selected" : undefined}>
                    <TableCell className="pl-4">
                      <Checkbox checked={ck} onCheckedChange={() => toggleOne(u.id)} aria-label={`Select ${u.unitName}`} />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" onClick={() => openForm(u)} className="h-auto justify-start gap-2.5 p-0 text-left hover:bg-transparent">
                        <Badge variant="secondary" className="min-w-9">{u.symbol || "—"}</Badge>
                        <span className="font-semibold">{u.unitName}</span>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{u.type ?? "Count"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.conversion || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(u.usedBy ?? u.productsCount) ? `${u.usedBy ?? u.productsCount} product${(u.usedBy ?? u.productsCount) === 1 ? "" : "s"}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.status} aria-label={`Active: ${u.unitName}`} onCheckedChange={(v) => setActive([u], v)} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1">
                        <WithTooltip content={`Edit ${u.unitName}`}><Button type="button" variant="outline" size="icon" aria-label={`Edit ${u.unitName}`} onClick={() => openForm(u)}><Pencil className="size-4" /></Button></WithTooltip>
                        <DropdownMenu>
                          <WithTooltip content={`More actions for ${u.unitName}`}><DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" aria-label={`More actions for ${u.unitName}`}><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger></WithTooltip>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openForm(u)}>Edit unit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setActive([u], !u.status)}>{u.status ? "Mark inactive" : "Mark active"}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargets([u])}>Delete unit</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        <div className="px-4 pb-4 pt-2">
          <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage} onItemsPerPageChange={handleItemsPerPageChange} totalItems={filtered.length} />
        </div>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[480px] flex-col gap-0 overflow-hidden rounded-[18px] border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[480px]">
          <DialogHeader className="border-b border-dash-border px-6 py-[18px] text-left">
            <DialogTitle className="font-dash-display text-[22px] font-bold">{editing ? `Edit ${editing.unitName}` : "New unit"}</DialogTitle>
            <DialogDescription className="text-[13px] text-dash-muted">How you count, weigh or measure products.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-2.5">
              <FormField label="Unit name" required htmlFor="unit-name" className="min-w-0">
                <Input id="unit-name" placeholder="e.g. Kilogram" value={form.unitName} autoFocus
                  onChange={(e) => setForm({ ...form, unitName: e.target.value })} />
              </FormField>
              <FormField label="Symbol" required htmlFor="unit-symbol" className="min-w-0">
                <Input id="unit-symbol" placeholder="e.g. kg" value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") save() }} />
              </FormField>
            </div>
            <FormField label="Type" htmlFor="unit-type" className="min-w-0">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as UnitType, convUnit: "", convQty: "" })}>
                <SelectTrigger id="unit-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Conversion (optional, same type only)" htmlFor="unit-conv-qty">
              <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-sm">
                <span className="text-muted-foreground">1 {form.symbol || "unit"} =</span>
                <Input id="unit-conv-qty" type="number" min={0} step="any" placeholder="e.g. 1000" value={form.convQty}
                  onChange={(e) => setForm({ ...form, convQty: e.target.value })} />
                <Select value={form.convUnit || "__none"} onValueChange={(v) => setForm({ ...form, convUnit: v === "__none" ? "" : v })}>
                  <SelectTrigger aria-label="Conversion unit" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">No conversion</SelectItem>
                    {units.filter((x) => x.id !== editing?.id && (x.type ?? "Count") === form.type).map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.unitName} ({x.symbol})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </FormField>
            <Item variant="outline" size="sm">
              <ItemContent>
                <ItemTitle id="unit-active-label">Active</ItemTitle>
                <ItemDescription>Available when creating products</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch checked={form.status} onCheckedChange={(v) => setForm({ ...form, status: v })} aria-labelledby="unit-active-label" />
              </ItemActions>
            </Item>
          </div>
          <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 border-t border-dash-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add unit"}
            </Button>
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
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
