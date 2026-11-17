"use client"

import { cn } from "@/lib/utils"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
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
// Type codes stay as data; these are their display labels
const TYPE_LABEL = {
  Count: "catalog:units.types.count",
  Weight: "catalog:units.types.weight",
  Volume: "catalog:units.types.volume",
  Length: "catalog:units.types.length",
} as const satisfies Record<UnitType, string>
const emptyForm = { unitName: "", symbol: "", status: true, type: "Count" as UnitType, convQty: "", convUnit: "" }

export default function UnitsPage() {
  const { t } = useTranslation(["catalog", "common"])
  const { toast } = useToast()
  const typeLabel = (type?: string | null) => (type && type in TYPE_LABEL ? t(TYPE_LABEL[type as UnitType]) : type || t(TYPE_LABEL.Count))
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
      .catch(() => toast({ variant: "destructive", title: t("catalog:units.toast.loadFailed") }))
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
      toast({ variant: "destructive", title: t("catalog:units.toast.missing"), description: t("catalog:units.toast.missingDesc") })
      return
    }
    if (form.convUnit && !(Number(form.convQty) > 0)) {
      toast({ variant: "destructive", title: t("catalog:units.toast.convQty"), description: t("catalog:units.toast.convQtyDesc") })
      return
    }
    const nm = form.unitName.trim().toLowerCase()
    const sym = form.symbol.trim().toLowerCase()
    const others = units.filter((x) => x.id !== editing?.id)
    if (others.some((x) => x.unitName.trim().toLowerCase() === nm)) {
      toast({ variant: "destructive", title: t("catalog:shared.nameUsed"), description: t("catalog:units.toast.nameUsedDesc", { name: form.unitName.trim() }) })
      return
    }
    if (others.some((x) => (x.symbol ?? "").trim().toLowerCase() === sym)) {
      toast({ variant: "destructive", title: t("catalog:units.toast.symbolUsed"), description: t("catalog:units.toast.symbolUsedDesc", { symbol: form.symbol.trim() }) })
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
      toast({ title: editing ? t("catalog:units.toast.updated") : t("catalog:units.toast.added"), description: payload.unitName })
      setFormOpen(false)
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: t("catalog:shared.couldNotSave"), description: err?.response?.data?.message || t("common:extra.tryAgain") })
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (list: UnitResponse[], status: boolean) => {
    const res = await Promise.allSettled(list.filter((u) => u.status !== status).map((u) => unitApi.update(u.id, { status })))
    const failed = res.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: t("catalog:shared.someFailed"), description: t("catalog:units.toast.failedCount", { count: failed }) })
    load()
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const errors: string[] = []
    let ok = 0
    for (const u of deleteTargets) {
      try { await unitApi.delete(u.id); ok++ } catch (e: any) { errors.push(`${u.unitName}: ${e?.response?.data?.message || t("catalog:shared.failed")}`) }
    }
    setDeleting(false)
    setDeleteTargets([])
    setChecked(new Set())
    if (errors.length) toast({ variant: "destructive", title: t("catalog:shared.deletedFailed", { deleted: ok, failed: errors.length }), description: errors.join(", ") })
    else toast({ title: t("common:status.deleted"), description: t("catalog:units.toast.removedCount", { count: ok }) })
    load()
  }

  const doExport = (list: UnitResponse[] = filtered) => {
    const byId = new Map(units.map((x) => [x.id, x]))
    exportToCSV(
      list.map((u) => {
        const target = u.conversionUnitId ? byId.get(u.conversionUnitId) : undefined
        return {
          name: u.unitName, symbol: u.symbol ?? "", type: u.type ?? "Count",
          conversion_qty: target ? u.conversionQty ?? "" : "", conversion_unit: target ? target.symbol || target.unitName : "",
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
          title: t("catalog:units.toast.imported", { count: created }),
          description: convFailed ? t("catalog:units.toast.convSkipped", { count: convFailed }) : undefined,
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
        title={t("catalog:units.title")}
        description={t("catalog:units.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={doImport}><Upload className="size-4" aria-hidden /> {t("common:actions.import")}</Button>
          <Button type="button" variant="outline" onClick={() => doExport()}><Download className="size-4" aria-hidden /> {t("common:actions.export")}</Button>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="size-4" aria-hidden /> {t("catalog:units.add")}
          </Button>
        </>}
      />

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(v) => { setTab(v); setChecked(new Set()) }} tabs={[
            { value: "all", label: t("common:status.all"), count: units.length },
            { value: "active", label: t("common:status.active"), count: activeCount },
            { value: "inactive", label: t("common:status.inactive"), count: units.length - activeCount },
          ]} />
        </div>

        <Toolbar className="p-4">
          <div className="relative min-w-[240px] flex-1">
            <Label htmlFor="unit-search" className="sr-only">{t("catalog:units.searchLabel")}</Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="unit-search" type="search" placeholder={t("catalog:units.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9" />
          </div>
          <div role="group" aria-label={t("catalog:units.filterByType")} className="flex flex-wrap gap-1.5">
            {(["All", ...TYPES] as const).map((ty) => (
              <Button key={ty} type="button" size="sm" variant={typeFilter === ty ? "default" : "outline"} aria-pressed={typeFilter === ty}
                onClick={() => { setTypeFilter(ty); setChecked(new Set()) }}>
                {ty === "All" ? t("common:status.all") : t(TYPE_LABEL[ty])}
              </Button>
            ))}
          </div>
          {(search || typeFilter !== "All") && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(""); setTypeFilter("All") }}>
              <X className="size-4" aria-hidden /> {t("common:actions.clear")}
            </Button>
          )}
        </Toolbar>

        <BulkBar count={checked.size} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setActive(selected, true)}>{t("catalog:shared.markActive")}</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setActive(selected, false)}>{t("catalog:shared.markInactive")}</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => doExport(selected)}>{t("catalog:shared.exportSelected")}</Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTargets(selected)}>{t("common:actions.delete")}</Button>
        </BulkBar>

        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-5 pl-4"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label={t("catalog:units.selectAll")} /></TableHead>
              <TableHead scope="col">{t("common:extra.unit")}</TableHead>
              <TableHead scope="col">{t("common:fields.type")}</TableHead>
              <TableHead scope="col">{t("catalog:units.colConversion")}</TableHead>
              <TableHead scope="col" className="text-right">{t("catalog:units.colUsedBy")}</TableHead>
              <TableHead scope="col">{t("common:status.active")}</TableHead>
              <TableHead scope="col" className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={7} className="px-4"><Skeleton className="h-10 rounded" /></TableCell></TableRow>)
            ) : currentItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState icon={Ruler} className="p-4 md:p-6"
                    title={units.length === 0 ? t("catalog:units.emptyTitle") : t("catalog:units.notFoundTitle")}
                    description={units.length === 0 ? t("catalog:units.emptyDesc") : t("catalog:shared.noMatchHint")} />
                </TableCell>
              </TableRow>
            ) : (
              currentItems.map((u) => {
                const ck = checked.has(u.id)
                return (
                  <TableRow key={u.id} data-state={ck ? "selected" : undefined}>
                    <TableCell className="pl-4">
                      <Checkbox checked={ck} onCheckedChange={() => toggleOne(u.id)} aria-label={t("common:extra.selectRow", { name: u.unitName })} />
                    </TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" onClick={() => openForm(u)} className="h-auto justify-start gap-2.5 p-0 text-left hover:bg-transparent">
                        <Badge variant="secondary" className="min-w-9">{u.symbol || "—"}</Badge>
                        <span className="font-semibold">{u.unitName}</span>
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{typeLabel(u.type)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.conversion || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(u.usedBy ?? u.productsCount) ? t("common:count.products", { count: (u.usedBy ?? u.productsCount) as number }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.status} aria-label={t("catalog:shared.activeName", { name: u.unitName })} onCheckedChange={(v) => setActive([u], v)} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1">
                        <WithTooltip content={t("catalog:shared.editName", { name: u.unitName })}><Button type="button" variant="outline" size="icon" aria-label={t("catalog:shared.editName", { name: u.unitName })} onClick={() => openForm(u)}><Pencil className="size-4" /></Button></WithTooltip>
                        <DropdownMenu>
                          <WithTooltip content={t("catalog:shared.moreFor", { name: u.unitName })}><DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" aria-label={t("catalog:shared.moreFor", { name: u.unitName })}><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger></WithTooltip>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openForm(u)}>{t("catalog:units.edit")}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setActive([u], !u.status)}>{u.status ? t("catalog:shared.markInactive") : t("catalog:shared.markActive")}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargets([u])}>{t("catalog:units.delete")}</DropdownMenuItem>
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
            <DialogTitle className="font-dash-display text-[22px] font-bold">{editing ? t("catalog:shared.editName", { name: editing.unitName }) : t("catalog:units.form.newTitle")}</DialogTitle>
            <DialogDescription className="text-[13px] text-dash-muted">{t("catalog:units.form.desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-2 gap-2.5">
              <FormField label={t("catalog:units.form.name")} required htmlFor="unit-name" className="min-w-0">
                <Input id="unit-name" placeholder={t("catalog:units.form.namePlaceholder")} value={form.unitName} autoFocus
                  onChange={(e) => setForm({ ...form, unitName: e.target.value })} />
              </FormField>
              <FormField label={t("catalog:units.form.symbol")} required htmlFor="unit-symbol" className="min-w-0">
                <Input id="unit-symbol" placeholder={t("catalog:units.form.symbolPlaceholder")} value={form.symbol}
                  onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") save() }} />
              </FormField>
            </div>
            <FormField label={t("common:fields.type")} htmlFor="unit-type" className="min-w-0">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as UnitType, convUnit: "", convQty: "" })}>
                <SelectTrigger id="unit-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((x) => <SelectItem key={x} value={x}>{t(TYPE_LABEL[x])}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t("catalog:units.form.conversion")} htmlFor="unit-conv-qty">
              <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t("catalog:units.form.oneUnit", { symbol: form.symbol || t("catalog:units.form.unitFallback") })}</span>
                <Input id="unit-conv-qty" type="number" min={0} step="any" placeholder={t("catalog:units.form.convPlaceholder")} value={form.convQty}
                  onChange={(e) => setForm({ ...form, convQty: e.target.value })} />
                <Select value={form.convUnit || "__none"} onValueChange={(v) => setForm({ ...form, convUnit: v === "__none" ? "" : v })}>
                  <SelectTrigger aria-label={t("catalog:units.form.convUnit")} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t("catalog:units.form.noConversion")}</SelectItem>
                    {units.filter((x) => x.id !== editing?.id && (x.type ?? "Count") === form.type).map((x) => <SelectItem key={x.id} value={String(x.id)}>{x.unitName} ({x.symbol})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </FormField>
            <Item variant="outline" size="sm">
              <ItemContent>
                <ItemTitle id="unit-active-label">{t("common:status.active")}</ItemTitle>
                <ItemDescription>{t("catalog:shared.availableForProducts")}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch checked={form.status} onCheckedChange={(v) => setForm({ ...form, status: v })} aria-labelledby="unit-active-label" />
              </ItemActions>
            </Item>
          </div>
          <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 border-t border-dash-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t("common:actions.cancel")}</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? t("common:actions.saving") : editing ? t("common:actions.saveChanges") : t("catalog:units.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && setDeleteTargets([])}>
        <AlertDialogContent className="font-dash-body text-dash-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:confirm.deleteTitle", { name: deleteTargets.length === 1 ? deleteTargets[0].unitName : t("catalog:units.remove.many", { count: deleteTargets.length }) })}</AlertDialogTitle>
            <AlertDialogDescription>{t("catalog:units.remove.desc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? t("catalog:shared.deleting") : t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
