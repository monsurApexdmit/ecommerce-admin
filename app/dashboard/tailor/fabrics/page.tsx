"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Trans, useTranslation } from "react-i18next"
import { AlertTriangle, Layers, PackagePlus, Pencil, Plus, Scissors, Search, Trash2, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SwatchPicker } from "@/components/common/SwatchPicker"
import { FilterBar } from "@/components/common/Toolbar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { apiError } from "@/components/tailor/order-ui"
import { TAILOR_NS, colourLabel, fabricTypeLabel, patternLabel, type TailorKey } from "@/components/tailor/i18n"
import { tailorApi, type TailorFabricOverview, type TailorFabricRow } from "@/lib/tailorApi"
import vendorApi, { type VendorOverviewRow } from "@/lib/vendorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

type Tab = "all" | "ok" | "low" | "out" | "inactive"

const TYPES = ["Cotton", "Silk", "Linen", "Georgette", "Khadi", "Denim"]
const PATTERNS = ["Plain", "Striped", "Checked", "Printed", "Embroidered", "Textured"]
const COLOURS: [string, string][] = [["White", "#F4F1EA"], ["Beige", "#D9C7A4"], ["Maroon", "#7B1E2B"], ["Navy", "#1F2F5C"], ["Green", "#2F6B4F"], ["Black", "#1A1A1A"]]
const UNITS: [string, TailorKey][] = [["m", "tailor:fabrics.unitM"], ["goj", "tailor:fabrics.unitGoj"], ["gaj", "tailor:fabrics.unitGaj"]]


const fmt = (n: number) => String(Math.round(n * 100) / 100)
const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0 }

interface FormState {
  name: string; code: string; type: string; pattern: string; color: string; hex: string
  stock: string; rop: string; buy: string; sell: string; vendorId: string; unit: string; status: "active" | "inactive"
}
const blankForm = (): FormState => ({
  name: "", code: "", type: "Cotton", pattern: "Plain", color: "White", hex: "#F4F1EA",
  stock: "", rop: "", buy: "", sell: "", vendorId: "", unit: "m", status: "active",
})
const fromRow = (r: TailorFabricRow): FormState => ({
  name: r.name, code: r.code ?? "", type: r.fabricType || "Cotton", pattern: r.pattern || "Plain", color: r.color ?? "", hex: r.hexColor || "#E3E6EE",
  stock: String(r.stockQuantity ?? ""), rop: String(r.reorderLevel ?? ""), buy: String(r.purchasePrice ?? ""), sell: String(r.sellingPrice ?? ""),
  vendorId: r.vendorId ? String(r.vendorId) : "", unit: r.unit || "m", status: r.status,
})

const barColor: Record<string, string> = {
  out: "[&>[data-slot=progress-indicator]]:bg-destructive", low: "[&>[data-slot=progress-indicator]]:bg-amber-500",
  inactive: "[&>[data-slot=progress-indicator]]:bg-muted-foreground", ok: "[&>[data-slot=progress-indicator]]:bg-teal-700",
}

function csvCell(v: unknown) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export default function TailorFabricsPage() {
  const { formatCurrency } = useCompanySettings()
  const { t } = useTranslation(TAILOR_NS)
  const { canWrite, canDelete } = useSaasAuth()
  const blocked = useModuleGuard("TailorFabrics")
  const mayWrite = canWrite("TailorFabrics")
  const mayDelete = canDelete("TailorFabrics")

  const [ov, setOv] = useState<TailorFabricOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [vendors, setVendors] = useState<VendorOverviewRow[]>([])

  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [fType, setFType] = useState("all")
  const [fSup, setFSup] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [form, setForm] = useState<FormState>(blankForm())
  const [editing, setEditing] = useState<TailorFabricRow | null>(null)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  const [restocking, setRestocking] = useState<TailorFabricRow | null>(null)
  const [rQty, setRQty] = useState("")
  const [rSup, setRSup] = useState("")
  const [rErr, setRErr] = useState("")
  const [rSaving, setRSaving] = useState(false)

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 250); return () => clearTimeout(t) }, [q])

  useEffect(() => {
    vendorApi.getOverview({ limit: 500, sort: "name" }).then((r) => setVendors(r.data)).catch(() => {})
  }, [])

  const params = useCallback((p: number, pp: number) => {
    const o: Record<string, any> = { page: p, per_page: pp, tab }
    if (qD) o.search = qD
    if (fType !== "all") o.type = fType
    if (fSup !== "all") o.vendor_id = fSup
    return o
  }, [tab, qD, fType, fSup])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOv(await tailorApi.getFabricOverview(params(page, perPage)))
    } catch {
      toast.error(t("tailor:fabrics.failedLoad"))
    } finally {
      setLoading(false)
    }
  }, [params, page, perPage, t])
  useEffect(() => { load() }, [load])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setForm((f) => ({ ...f, [k]: v })); setErr("") }

  const startEdit = (r: TailorFabricRow | null) => {
    setEditing(r); setErr(""); setRestocking(null)
    setForm(r ? fromRow(r) : blankForm())
  }

  const startRestock = (r: TailorFabricRow) => {
    setRestocking(r); setRQty(""); setRSup(r.vendorId ? String(r.vendorId) : ""); setRErr("")
  }

  const save = async () => {
    const name = form.name.trim()
    if (!name) { setErr(t("tailor:fabrics.nameRequired")); return }
    for (const [k, label] of [["stock", "tailor:fabrics.openingStock"], ["rop", "tailor:fabrics.lowStockAlert"], ["buy", "tailor:fabrics.costPrice"], ["sell", "tailor:fabrics.sellPrice"]] as const) {
      if (form[k] !== "" && !(Number(form[k]) >= 0)) { setErr(t("tailor:fabrics.mustBeNumber", { field: t(label) })); return }
    }
    const buy = num(form.buy), sell = num(form.sell)
    if (sell > 0 && sell < buy) { setErr(t("tailor:fabrics.sellBelowCost")); return }
    setSaving(true); setErr("")
    try {
      const body = {
        name, code: form.code.trim() || undefined, fabricType: form.type, pattern: form.pattern, color: form.color.trim(), hexColor: form.hex,
        unit: form.unit as "m" | "goj" | "gaj", purchasePrice: buy, sellingPrice: sell, stockQuantity: num(form.stock), reorderLevel: num(form.rop),
        vendorId: (form.vendorId ? Number(form.vendorId) : null) as any, status: form.status,
      }
      if (editing) await tailorApi.updateFabric(editing.id, body)
      else await tailorApi.createFabric(body)
      toast.success(editing ? t("tailor:fabrics.updated") : t("tailor:fabrics.added"))
      startEdit(null)
      load()
    } catch (e: any) {
      setErr(apiError(e, t("tailor:fabrics.couldNotSave")))
    } finally {
      setSaving(false)
    }
  }

  const doRestock = async () => {
    if (!restocking) return
    const qty = num(rQty)
    if (qty <= 0) { setRErr(t("tailor:fabrics.enterQty")); return }
    setRSaving(true)
    try {
      await tailorApi.restockFabric(restocking.id, { quantity: qty, vendorId: rSup ? Number(rSup) : null })
      toast.success(t("tailor:fabrics.addedStock", { qty: fmt(qty), unit: restocking.unit, name: restocking.name }))
      setRestocking(null); setRQty(""); setRErr("")
      load()
    } catch (e: any) {
      setRErr(apiError(e, t("tailor:fabrics.couldNotAddStock")))
    } finally {
      setRSaving(false)
    }
  }

  const remove = async (r: TailorFabricRow) => {
    if (r.ordersCount > 0) { toast.error(t("tailor:fabrics.usedInOrders", { name: r.name, count: r.ordersCount })); return }
    if (!window.confirm(t("tailor:fabrics.deleteConfirm", { name: r.name }))) return
    try {
      await tailorApi.deleteFabric(r.id)
      toast.success(t("tailor:fabrics.deleted"))
      if (editing?.id === r.id) startEdit(null)
      if (restocking?.id === r.id) setRestocking(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("tailor:shared.couldNotDelete"))
    }
  }

  const exportCsv = async () => {
    try {
      const rows: TailorFabricRow[] = []
      for (let p = 1; p <= 50; p++) {
        const r = await tailorApi.getFabricOverview(params(p, 100))
        rows.push(...r.data)
        if (rows.length >= r.total || r.data.length === 0) break
      }
      if (!rows.length) { toast.error(t("common:extra.nothingToExport")); return }
      const head = [t("tailor:fabrics.csvName"), t("tailor:fabrics.csvCode"), t("tailor:fabrics.csvType"), t("tailor:fabrics.csvColour"), t("tailor:fabrics.csvPattern"), t("tailor:fabrics.csvStock"), t("tailor:fabrics.csvReorder"), t("tailor:fabrics.csvUnit"), t("tailor:fabrics.csvCost"), t("tailor:fabrics.csvSell"), t("tailor:fabrics.csvStatus"), t("tailor:fabrics.csvSupplier")]
      const lines = [head, ...rows.map((r) => [r.name, r.code ?? "", r.fabricType ?? "", r.color ?? "", r.pattern ?? "", r.stockQuantity, r.reorderLevel ?? 0, r.unit, r.purchasePrice, r.sellingPrice, r.status === "inactive" ? t("common:status.inactive") : t("common:status.active"), r.vendorName ?? ""])]
      const blob = new Blob([lines.map((l) => l.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob); a.download = "fabrics.csv"; a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      toast.error(t("tailor:shared.exportFailed"))
    }
  }

  const typeOptions = useMemo(() => Array.from(new Set([...TYPES, ...(ov?.types ?? []), ...(form.type ? [form.type] : [])])), [ov?.types, form.type])
  const patternOptions = useMemo(() => Array.from(new Set([...PATTERNS, ...(form.pattern ? [form.pattern] : [])])), [form.pattern])

  if (blocked) return blocked

  const st = ov?.stats
  const rows = ov?.data ?? []
  const total = ov?.total ?? 0
  const counts = ov?.counts
  const hasFilter = !!(qD || fType !== "all" || fSup !== "all" || tab !== "all")
  const buyN = num(form.buy), sellN = num(form.sell)
  const unitWord = st?.unit || t("tailor:fabrics.units")

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("tailor:fabrics.title")}
        description={t("tailor:fabrics.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={exportCsv}>{t("common:actions.export")}</Button>
          <Button asChild variant="outline"><Link href="/dashboard/vendors/purchase-orders"><Plus className="size-4" aria-hidden /> {t("tailor:shared.orderFabric")}</Link></Button>
        </>}
      />

      {!st ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : (
        <div className="[&>div]:lg:grid-cols-4">
          <StatsCards stats={[
            { label: t("tailor:fabrics.statFabrics"), value: st.fabricsCount, icon: <Layers className="size-4" />, color: "blue", hint: t("tailor:fabrics.statFabricsHint", { inactive: st.inactiveCount, count: st.typesCount }) },
            { label: t("tailor:fabrics.stockValue"), value: formatCurrency(st.stockValue), icon: <Wallet className="size-4" />, color: "green", hint: t("tailor:fabrics.atCost", { qty: fmt(st.totalStock), unit: unitWord }) },
            { label: t("tailor:fabrics.lowOut"), value: st.lowCount, icon: <AlertTriangle className="size-4" />, color: st.lowCount ? "yellow" : "green", hint: st.lowCount ? st.lowNames.join(", ") : t("tailor:fabrics.allHealthy") },
            { label: t("tailor:fabrics.usedThisMonth"), value: `${fmt(st.usedThisMonth)}${st.unit ? ` ${st.unit}` : ""}`, icon: <Scissors className="size-4" />, color: "purple", hint: st.topFabric ? t("tailor:fabrics.mostly", { name: st.topFabric }) : t("tailor:fabrics.noUsage") },
          ]} />
        </div>
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full min-w-0 flex-1 gap-0 py-0">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }} tabs={[
              { value: "all", label: t("common:status.all"), count: counts?.all }, { value: "ok", label: t("common:extra.inStock"), count: counts?.ok },
              { value: "low", label: t("tailor:fabrics.tabLow"), count: counts?.low }, { value: "out", label: t("common:extra.outOfStock"), count: counts?.out },
              { value: "inactive", label: t("common:status.inactive"), count: counts?.inactive },
            ]} />
          </div>
          <FilterBar className="gap-2.5 p-4">
            <InputGroup className="min-w-[220px] flex-1">
              <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
              <InputGroupInput type="search" aria-label={t("tailor:fabrics.searchAria")} placeholder={t("tailor:fabrics.searchPlaceholder")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
            </InputGroup>
            <Select value={fType} onValueChange={(v) => { setFType(v); setPage(1) }}>
              <SelectTrigger aria-label={t("common:fields.type")}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">{t("tailor:fabrics.typeAll")}</SelectItem>{(ov?.types ?? []).map((ty) => <SelectItem key={ty} value={ty}>{fabricTypeLabel(t, ty)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={fSup} onValueChange={(v) => { setFSup(v); setPage(1) }}>
              <SelectTrigger aria-label={t("common:extra.supplier")}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">{t("tailor:fabrics.supplierAll")}</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          </FilterBar>

          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tailor:shared.fabric")}</TableHead><TableHead>{t("common:fields.stock")}</TableHead>
                  <TableHead>{t("tailor:fabrics.colCostSell")}</TableHead><TableHead>{t("common:extra.margin")}</TableHead>
                  <TableHead>{t("common:extra.supplier")}</TableHead><TableHead className="text-right">{t("common:fields.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !ov ? [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-11" /></TableCell></TableRow>) :
                  rows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="whitespace-normal">
                      <EmptyState icon={Layers} title={t("tailor:fabrics.noFabricsFound")} className="p-4 md:p-6"
                        description={hasFilter ? t("tailor:fabrics.noMatch") : t("tailor:fabrics.noFabricsYet")} />
                    </TableCell></TableRow>
                  ) : rows.map((r) => {
                    const stock = r.stockQuantity, rop = r.reorderLevel ?? 0
                    const w = rop > 0 ? Math.min(100, Math.round((stock / (rop * 3)) * 100)) : stock > 0 ? 100 : 0
                    const sub = [r.fabricType ? fabricTypeLabel(t, r.fabricType) : "", r.color ? colourLabel(t, r.color) : ""].filter(Boolean).join(" · ") || "—"
                    const extra = (r.pattern && r.pattern !== "Plain" ? ` · ${patternLabel(t, r.pattern)}` : "") + (r.code ? ` · ${r.code}` : "") + (r.status === "inactive" ? ` · ${t("common:status.inactive")}` : "")
                    return (
                      <TableRow key={r.id} data-state={editing?.id === r.id || restocking?.id === r.id ? "selected" : undefined}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="size-8 shrink-0 rounded-md border" style={{ background: r.hexColor || "#E3E6EE" }} aria-hidden />
                            <span className="min-w-0"><span className="block font-medium">{r.name}</span><span className="block text-xs text-muted-foreground">{sub}{extra}</span></span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-baseline gap-2">
                            <strong className={cn("tabular-nums", r.stockState === "out" && "text-destructive")}>{r.stockState === "out" ? t("common:extra.outOfStock") : `${fmt(stock)} ${r.unit}`}</strong>
                            <span className="text-xs text-muted-foreground">{t("tailor:fabrics.min", { qty: fmt(rop), unit: r.unit })}</span>
                          </div>
                          <Progress value={w} aria-label={t("tailor:fabrics.stockLevel", { name: r.name })} className={cn("mt-1.5 h-1.5 w-28", barColor[r.stockState])} />
                        </TableCell>
                        <TableCell className="tabular-nums">{formatCurrency(r.purchasePrice)} / <strong>{r.sellingPrice ? formatCurrency(r.sellingPrice) : "—"}</strong></TableCell>
                        <TableCell>
                          <Badge variant="secondary">{r.marginPct != null ? `${r.marginPct}%` : "—"}</Badge>
                        </TableCell>
                        <TableCell>{r.vendorName ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {mayWrite && <WithTooltip content={t("tailor:fabrics.addStock")}><Button type="button" variant="outline" size="icon" aria-label={t("tailor:fabrics.addStockTo", { name: r.name })} onClick={() => startRestock(r)}><PackagePlus className="size-4" /></Button></WithTooltip>}
                            {mayWrite && <WithTooltip content={t("tailor:shared.editName", { name: r.name })}><Button type="button" variant="outline" size="icon" aria-label={t("tailor:shared.editName", { name: r.name })} onClick={() => startEdit(r)}><Pencil className="size-4" /></Button></WithTooltip>}
                            {mayDelete && <WithTooltip content={t("tailor:shared.deleteName", { name: r.name })}><Button type="button" variant="outline" size="icon" aria-label={t("tailor:shared.deleteName", { name: r.name })} onClick={() => remove(r)}><Trash2 className="size-4" /></Button></WithTooltip>}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </div>
          {total > 0 && (
            <div className="p-4 pt-3.5">
              <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            </div>
          )}
        </Card>

        <aside aria-label={t("tailor:fabrics.formAria")} className="flex w-full shrink-0 flex-col gap-3.5 xl:w-[380px]">
          {restocking && (
            <SectionCard title={t("tailor:fabrics.restockTitle", { name: restocking.name })} description={t("tailor:fabrics.currentStock", { qty: fmt(restocking.stockQuantity), unit: restocking.unit })} contentClassName="flex flex-col gap-3.5">
              <FormField label={t("tailor:fabrics.qtyToAdd", { unit: restocking.unit })} required htmlFor="restock-qty">
                <Input id="restock-qty" type="number" min={0} step="any" value={rQty} onChange={(e) => { setRQty(e.target.value); setRErr("") }} placeholder={t("tailor:fabrics.qtyPlaceholder")} autoFocus /></FormField>
              <FormField label={t("tailor:fabrics.supplierOptional")} htmlFor="restock-supplier">
                <Select value={rSup || "__none"} onValueChange={(v) => setRSup(v === "__none" ? "" : v)}>
                  <SelectTrigger id="restock-supplier" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">{t("common:status.none")}</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                </Select></FormField>
              {rErr && <Alert variant="destructive"><AlertDescription>{rErr}</AlertDescription></Alert>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setRestocking(null); setRErr("") }}>{t("common:actions.cancel")}</Button>
                <Button type="button" disabled={rSaving} onClick={doRestock}>{rSaving ? t("tailor:fabrics.adding") : t("tailor:fabrics.addStock")}</Button>
              </div>
            </SectionCard>
          )}

          <SectionCard title={editing ? t("tailor:fabrics.editFabric") : t("tailor:fabrics.addFabric")} contentClassName="flex flex-col gap-3.5">
            {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
            <FormField label={t("tailor:fabrics.fabricName")} required htmlFor="fabric-f1">
              <Input id="fabric-f1" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("tailor:fabrics.namePlaceholder")} /></FormField>
            <div className="grid grid-cols-2 gap-2.5">
              <FormField label={t("common:fields.type")} htmlFor="fabric-f2">
                <Select value={form.type} onValueChange={(v) => set("type", v)}>
                  <SelectTrigger id="fabric-f2" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{typeOptions.map((ty) => <SelectItem key={ty} value={ty}>{fabricTypeLabel(t, ty)}</SelectItem>)}</SelectContent>
                </Select></FormField>
              <FormField label={t("tailor:fabrics.pattern")} htmlFor="fabric-f3">
                <Select value={form.pattern} onValueChange={(v) => set("pattern", v)}>
                  <SelectTrigger id="fabric-f3" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{patternOptions.map((pt) => <SelectItem key={pt} value={pt}>{patternLabel(t, pt)}</SelectItem>)}</SelectContent>
                </Select></FormField>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <FormField label={t("tailor:fabrics.unitOfMeasure")} htmlFor="fabric-f4">
                <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                  <SelectTrigger id="fabric-f4" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map(([id, n]) => <SelectItem key={id} value={id}>{t(n)}</SelectItem>)}</SelectContent>
                </Select></FormField>
              <FormField label={t("common:fields.status")} htmlFor="fabric-f5">
                <Select value={form.status} onValueChange={(v) => set("status", v as "active" | "inactive")}>
                  <SelectTrigger id="fabric-f5" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">{t("common:status.active")}</SelectItem><SelectItem value="inactive">{t("common:status.inactive")}</SelectItem></SelectContent>
                </Select></FormField>
            </div>
            <FormField label={t("tailor:fabrics.colour")} htmlFor="fabric-colour-name">
              <div className="flex flex-wrap items-center gap-2">
                <SwatchPicker size="sm" aria-label={t("tailor:fabrics.colour")} value={COLOURS.some(([, c]) => c === form.hex) ? form.hex : undefined}
                  options={COLOURS.map(([label, c]) => ({ value: c, label: colourLabel(t, label), color: c }))}
                  onValueChange={(c) => { const label = COLOURS.find(([, h]) => h === c)?.[0] ?? ""; set("color", label); set("hex", c) }} />
                <Input id="fabric-colour-name" aria-label={t("tailor:fabrics.colourName")} className="w-32 flex-1" value={form.color} placeholder={t("tailor:fabrics.colourName")}
                  onChange={(e) => { const v = e.target.value; const m = COLOURS.find((c) => c[0].toLowerCase() === v.trim().toLowerCase()); setForm((f) => ({ ...f, color: m ? m[0] : v, hex: m ? m[1] : f.hex })); setErr("") }} />
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-2.5">
              <FormField label={t("tailor:fabrics.code")} htmlFor="fabric-f6">
                <Input id="fabric-f6" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder={t("tailor:fabrics.codePlaceholder")} /></FormField>
              <FormField label={t("tailor:fabrics.stockUnit", { unit: form.unit })} htmlFor="fabric-f7">
                <Input id="fabric-f7" type="number" min={0} step="any" value={form.stock} onChange={(e) => set("stock", e.target.value)} placeholder="0" /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <FormField label={t("tailor:fabrics.costPriceUnit", { unit: form.unit })} htmlFor="fabric-f8">
                <Input id="fabric-f8" type="number" min={0} step="any" value={form.buy} onChange={(e) => set("buy", e.target.value)} placeholder="0.00" /></FormField>
              <FormField label={t("tailor:fabrics.sellPriceUnit", { unit: form.unit })} htmlFor="fabric-f9">
                <Input id="fabric-f9" type="number" min={0} step="any" value={form.sell} onChange={(e) => set("sell", e.target.value)} placeholder="0.00" /></FormField>
            </div>
            <Card className="flex-row items-center justify-between gap-2 px-3 py-2 text-sm text-muted-foreground">
              <span><Trans t={t} i18nKey="tailor:fabrics.profitPer" values={{ unit: form.unit, amount: formatCurrency(sellN - buyN) }} components={{ b: <strong className="text-foreground" /> }} /></span>
              <span><Trans t={t} i18nKey="tailor:fabrics.marginIs" values={{ pct: sellN ? `${Math.round(((sellN - buyN) / sellN) * 100)}%` : "—" }} components={{ b: <strong className="text-foreground" /> }} /></span>
            </Card>
            <div className="grid grid-cols-2 gap-2.5">
              <FormField label={t("tailor:fabrics.lowAlertAt", { unit: form.unit })} htmlFor="fabric-f10">
                <Input id="fabric-f10" type="number" min={0} step="any" value={form.rop} onChange={(e) => set("rop", e.target.value)} placeholder={t("tailor:fabrics.ropPlaceholder")} /></FormField>
              <FormField label={t("common:extra.supplier")} htmlFor="fabric-f11">
                <Select value={form.vendorId || "__none"} onValueChange={(v) => set("vendorId", v === "__none" ? "" : v)}>
                  <SelectTrigger id="fabric-f11" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__none">{t("common:status.none")}</SelectItem>{vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                </Select></FormField>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => startEdit(null)}>{t("common:actions.clear")}</Button>
              {mayWrite && (
                <Button type="button" disabled={saving} onClick={save}>
                  {saving ? t("common:actions.saving") : editing ? t("common:actions.saveChanges") : t("tailor:fabrics.addFabric")}
                </Button>
              )}
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  )
}
