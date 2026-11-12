"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { ArrowLeftRight, BarChart3, Banknote, Boxes, ClipboardList, Download, Eye, Pencil, Search, Upload, X, AlertTriangle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import inventoryApi, { type StockHealth, type StockOverview, type StockRow } from "@/lib/inventoryApi"
import adjustmentApi from "@/lib/adjustmentApi"
import { exportToCSV, parseCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/common/PageHeader"
import { Toolbar } from "@/components/common/Toolbar"
import { BulkBar } from "@/components/common/BulkBar"
import { FormField } from "@/components/common/FormField"
import { SectionTitle } from "@/components/common/SectionTitle"
import { StatusBadge } from "@/components/common/StatusBadge"
import { WithTooltip } from "@/components/common/WithTooltip"
import { EmptyState } from "@/components/common/EmptyState"

type Tab = "all" | "attention" | "ok" | "low" | "out" | "over"

const NS = ["inventory", "common"] as const
type K = ParseKeys<typeof NS>

const HEALTH: Record<StockHealth, { label: K; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ok: { label: "inventory:stock.health.ok", variant: "default" },
  low: { label: "inventory:stock.health.low", variant: "secondary" },
  out: { label: "common:extra.outOfStock", variant: "destructive" },
  over: { label: "inventory:stock.health.over", variant: "outline" },
}
// Reason values are saved on the adjustment as-is; only the shown label is translated
const QUICK_REASONS = ["Correction", "Damaged", "Lost", "Found", "Stock count"]
const REASON_KEY: Record<string, K> = {
  Correction: "inventory:stock.reason.correction",
  Damaged: "inventory:stock.reason.damaged",
  Lost: "inventory:stock.reason.lost",
  Found: "inventory:stock.reason.found",
  "Stock count": "inventory:stock.reason.stockCount",
}


export default function InventoryPage() {
  return <Suspense fallback={null}><InventoryInner /></Suspense>
}

function InventoryInner() {
  const { t } = useTranslation(NS)
  const searchParams = useSearchParams()
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const blocked = useModuleGuard("Inventory")

  const [data, setData] = useState<StockOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const stockParam = searchParams.get("stock")
  const [tab, setTab] = useState<Tab>((["attention", "ok", "low", "out", "over"] as const).find((v) => v === stockParam) ?? "all")
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [loc, setLoc] = useState("all")
  const [cat, setCat] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const [adj, setAdj] = useState<StockRow | null>(null)
  const [adjLoc, setAdjLoc] = useState("")
  const [adjQty, setAdjQty] = useState("")
  const [adjReason, setAdjReason] = useState(QUICK_REASONS[0])
  const [adjErr, setAdjErr] = useState("")
  const [adjBusy, setAdjBusy] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(id)
  }, [search])

  const load = useCallback(async () => {
    try {
      setData(await inventoryApi.getOverview({
        search: debounced || undefined,
        location_id: loc !== "all" ? Number(loc) : undefined,
        category_id: cat !== "all" ? Number(cat) : undefined,
      }))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [debounced, loc, cat])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const all = data?.items ?? []
    if (tab === "all") return all
    return all.filter((r) => (tab === "attention" ? r.health === "low" || r.health === "out" : r.health === tab))
  }, [data, tab])

  const pageRows = rows.slice((page - 1) * perPage, page * perPage)
  const locations = data?.locations ?? []
  const shownLocations = loc === "all" ? locations : locations.filter((l) => String(l.id) === loc)
  const key = (r: StockRow) => `${r.type}-${r.id}`
  const selectable = (r: StockRow) => r.type === "product" || !!r.productId
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(key(r)))
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map(key)))
  const toggleOne = (k: string) => setChecked((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })
  const selectedRows = rows.filter((r) => checked.has(key(r)))

  const changeTab = (v: string) => { setTab(v as Tab); setPage(1); setChecked(new Set()) }

  const openAdjust = (r: StockRow) => {
    const def = locations.find((l) => l.isDefault) ?? locations[0]
    setAdj(r)
    setAdjLoc(loc !== "all" ? loc : def ? String(def.id) : "")
    setAdjQty("")
    setAdjReason(QUICK_REASONS[0])
    setAdjErr("")
  }
  const onAdjLoc = (v: string) => {
    setAdjLoc(v)
    setAdjQty("")
    setAdjErr("")
  }
  const currentQty = adj?.locations.find((l) => String(l.locationId) === adjLoc)?.quantity ?? 0

  const applyAdjust = async () => {
    if (!adj) return
    const qty = Number(adjQty)
    if (!adjLoc) { setAdjErr(t("inventory:stock.validation.location")); return }
    if (adjQty.trim() === "" || !Number.isInteger(qty) || qty < 0) { setAdjErr(t("inventory:stock.validation.wholeNumber")); return }
    if (qty === currentQty) { setAdjErr(t("inventory:stock.validation.unchanged")); return }
    setAdjBusy(true); setAdjErr("")
    try {
      await adjustmentApi.create({
        productId: adj.productId,
        variantId: adj.type === "variant" ? adj.id : null,
        locationId: Number(adjLoc),
        type: "set",
        quantity: qty,
        reason: adjReason,
      })
      toast({ title: t("inventory:stock.toast.adjusted"), description: `${adj.name}${adj.variantName ? ` · ${adj.variantName}` : ""}: ${currentQty} → ${qty}` })
      setAdj(null)
      load()
    } catch (e: any) {
      setAdjErr(e?.response?.data?.message || t("inventory:stock.toast.adjustFailed"))
    } finally {
      setAdjBusy(false)
    }
  }

  const handleExport = () => {
    const flat = rows.flatMap((r) => (r.variants?.length ? r.variants : [r]))
    exportToCSV(
      flat.map((r) => ({
        name: r.name, variant: r.variantName ?? "", sku: r.sku, barcode: r.barcode ?? "", category: r.categoryName ?? "",
        ...Object.fromEntries(locations.map((l) => [l.name, r.locations.find((x) => x.locationId === l.id)?.quantity ?? 0])),
        onHand: r.onHand, reserved: r.reserved, available: r.available, reorderAt: r.reorderPoint, health: t(HEALTH[r.health].label), unitCost: r.cost, value: r.value,
      })),
      "stock-overview",
      ["name", "variant", "sku", "barcode", "category", ...locations.map((l) => l.name), "onHand", "reserved", "available", "reorderAt", "health", "unitCost", "value"],
    )
    toast({ title: t("inventory:stock.toast.exported", { count: flat.length }) })
  }

  const handleImport = () => {
    const el = document.createElement("input")
    el.type = "file"
    el.accept = ".csv"
    el.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const parsed = parseCSV(ev.target?.result as string)
        const bySku = new Map<string, StockRow>()
        ;(data?.items ?? []).forEach((r) => (r.variants?.length ? r.variants : [r]).forEach((x) => x.sku && bySku.set(x.sku.toLowerCase(), x)))
        let done = 0
        let skipped = 0
        let unchanged = 0
        for (const row of parsed) {
          const sku = (row.sku ?? "").trim().toLowerCase()
          const raw = row.total_stock ?? row["total stock"] ?? row["on hand"] ?? row.onhand ?? row.onHand ?? row.stock ?? row.quantity ?? row.qty ?? ""
          const qty = String(raw).trim() === "" ? NaN : Number(raw)
          const target = bySku.get(sku)
          const where = locations.find((l) => l.name.toLowerCase() === (row.location ?? row.warehouse ?? "").toLowerCase())
            ?? locations.find((l) => String(l.id) === loc)
            ?? locations.find((l) => l.isDefault)
            ?? locations[0]
          if (!target || !where || !Number.isInteger(qty) || qty < 0) { skipped++; continue }
          if ((target.locations.find((x) => x.locationId === where.id)?.quantity ?? 0) === qty) { unchanged++; continue }
          try {
            await adjustmentApi.create({
              productId: target.productId, variantId: target.type === "variant" ? target.id : null,
              locationId: where.id, type: "set", quantity: qty, reason: "Stock count",
            })
            done++
          } catch { skipped++ }
        }
        toast({ title: t("inventory:stock.toast.updated", { count: done }), description: [skipped ? t("inventory:stock.toast.skipped", { count: skipped }) : "", unchanged ? t("inventory:stock.toast.unchanged", { count: unchanged }) : "", !skipped && !unchanged ? t("inventory:stock.toast.csvHint") : ""].filter(Boolean).join(" · ") })
        load()
      }
      reader.readAsText(file)
    }
    el.click()
  }

  if (blocked) return blocked

  const s = data?.stats
  const reorderHref = `/dashboard/vendors/purchase-orders?new=1&items=${encodeURIComponent(
    selectedRows.map((r) => `${r.productId}:${Math.max(r.reorderPoint * 2 - r.onHand, 1)}`).join(","),
  )}`

  const renderRow = (r: StockRow, nested = false) => {
    const k = key(r)
    const h = HEALTH[r.health]
    const hasVariants = !nested && (r.variants?.length ?? 0) > 0
    const open = expanded.has(k)
    return (
      <TableRow key={k} data-state={checked.has(k) ? "selected" : undefined} className={cn(nested && "bg-muted/30")}>
        <TableCell className="pl-4">
          {!nested && selectable(r) && <Checkbox checked={checked.has(k)} onCheckedChange={() => toggleOne(k)} aria-label={t("common:extra.selectRow", { name: r.name })} />}
        </TableCell>
        <TableCell className={cn(nested && "pl-8")}>
          <div className="flex items-center gap-2">
            <span className="flex flex-col">
              <span className="font-semibold">
                {nested ? r.variantName : r.name}
                {hasVariants && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{t("inventory:stock.variants", { count: r.variants!.length })}</span>}
              </span>
              <span className="text-xs text-muted-foreground">{r.sku || "—"}</span>
            </span>
            {hasVariants && (
              <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setExpanded((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })}>
                {open ? t("inventory:stock.hide") : t("inventory:stock.show")}
              </Button>
            )}
          </div>
        </TableCell>
        {shownLocations.map((l) => (
          <TableCell key={l.id} className="text-right tabular-nums">
            {r.locations.find((x) => x.locationId === l.id)?.quantity ?? 0}
          </TableCell>
        ))}
        <TableCell className="text-right font-bold tabular-nums">{r.onHand}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">{r.reserved}</TableCell>
        <TableCell className="text-right font-semibold tabular-nums">{r.available}</TableCell>
        <TableCell>
          <StatusBadge status={r.health} label={t(h.label)} variant={h.variant} />
          <div className="mt-0.5 text-xs text-muted-foreground">{t("inventory:stock.reorderAt", { count: r.reorderPoint })}</div>
        </TableCell>
        <TableCell className="text-right tabular-nums">{formatCurrency(r.value)}</TableCell>
        <TableCell className="pr-4">
          <div className="flex justify-end gap-1">
            {!hasVariants && (
              <WithTooltip content={t("inventory:stock.adjustStock")}>
                <Button type="button" variant="outline" size="icon" aria-label={t("inventory:stock.adjustName", { name: r.name })} onClick={() => openAdjust(r)}><Pencil className="size-4" /></Button>
              </WithTooltip>
            )}
            <WithTooltip content={t("inventory:stock.transferStock")}>
              <Button asChild variant="outline" size="icon"><Link href="/dashboard/inventory/transfer" aria-label={t("inventory:stock.transfer")}><ArrowLeftRight className="size-4" /></Link></Button>
            </WithTooltip>
            <WithTooltip content={t("inventory:stock.history")}>
              <Button asChild variant="outline" size="icon"><Link href="/dashboard/inventory/adjustment" aria-label={t("inventory:stock.history")}><ClipboardList className="size-4" /></Link></Button>
            </WithTooltip>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("inventory:stock.title")}
        description={t("inventory:stock.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={handleImport}><Upload className="size-4" aria-hidden /> {t("inventory:stock.importCsv")}</Button>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> {t("inventory:stock.exportCsv")}</Button>
          <Button asChild variant="outline"><Link href="/dashboard/inventory/adjustment">{t("inventory:stock.adjustStock")}</Link></Button>
          <Button asChild><Link href="/dashboard/inventory/transfer">{t("inventory:stock.transferStock")}</Link></Button>
        </>}
      />

      {loading || !s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[118px]" />)}
        </div>
      ) : (
        <StatsCards stats={[
          { label: t("inventory:stock.kpi.skus"), value: s.skus, icon: <Boxes className="size-4" />, color: "blue", hint: t("inventory:stock.kpi.categories", { count: s.categories }) },
          { label: t("inventory:stock.kpi.units"), value: s.units, icon: <BarChart3 className="size-4" />, color: "purple", hint: t("inventory:stock.kpi.reserved", { count: s.reserved }) },
          { label: t("inventory:suppliers.profile.stockValue"), value: formatCurrency(s.stockValue), icon: <Banknote className="size-4" />, color: "green", hint: t("inventory:stock.kpi.atCost") },
          { label: t("common:status.published"), value: s.published, icon: <Eye className="size-4" />, color: "blue", hint: t("inventory:stock.kpi.unpublished", { count: s.unpublished }) },
          { label: t("common:extra.lowStock"), value: s.low, icon: <AlertTriangle className="size-4" />, color: "yellow", hint: t("inventory:stock.kpi.lowHint"), onClick: () => changeTab("low"), active: tab === "low" },
          { label: t("common:extra.outOfStock"), value: s.out, icon: <X className="size-4" />, color: "red", hint: t("inventory:stock.kpi.outHint"), onClick: () => changeTab("out"), active: tab === "out" },
        ]} />
      )}

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs
            value={tab}
            onChange={changeTab}
            tabs={[
              { value: "all", label: t("common:status.all"), count: data?.counts.all },
              { value: "attention", label: t("inventory:stock.tabs.attention"), count: data?.counts.attention },
              { value: "ok", label: t("inventory:stock.health.ok"), count: data?.counts.ok },
              { value: "low", label: t("inventory:stock.health.low"), count: data?.counts.low },
              { value: "out", label: t("common:extra.outOfStock"), count: data?.counts.out },
              { value: "over", label: t("inventory:stock.health.over"), count: data?.counts.over },
            ]}
          />
        </div>

        <Toolbar className="p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="stock-search" className="sr-only">{t("inventory:stock.searchLabel")}</Label>
            <Input id="stock-search" type="search" placeholder={t("inventory:stock.searchPlaceholder")} value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9" />
          </div>
          <Select value={loc} onValueChange={(v) => { setLoc(v); setPage(1) }}>
            <SelectTrigger aria-label={t("common:fields.warehouse")} className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inventory:stock.filter.warehouseAll")}</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={(v) => { setCat(v); setPage(1) }}>
            <SelectTrigger aria-label={t("common:fields.category")} className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("inventory:stock.filter.categoryAll")}</SelectItem>
              {(data?.categories ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Toolbar>

        <BulkBar count={selectedRows.length} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
          <Button asChild variant="outline" size="sm"><Link href="/dashboard/inventory/transfer">{t("inventory:stock.transfer")}</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/dashboard/inventory/adjustment">{t("inventory:stock.adjustShort")}</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href={reorderHref}>{t("inventory:stock.reorder")}</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/dashboard/products/print-barcode">{t("inventory:stock.printLabels")}</Link></Button>
        </BulkBar>

        {adj && (
          <Card className="mx-4 mb-3 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
            <div>
              <SectionTitle as="p">{t("inventory:stock.quick.title")}</SectionTitle>
              <div className="font-semibold">{adj.name}{adj.variantName ? ` · ${adj.variantName}` : ""}</div>
              <div className="text-xs text-muted-foreground">{t("inventory:stock.quick.current", { count: currentQty })}</div>
            </div>
            <FormField label={t("common:fields.location")} htmlFor="quick-adj-loc">
              <Select value={adjLoc || undefined} onValueChange={onAdjLoc}>
                <SelectTrigger id="quick-adj-loc" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t("inventory:stock.quick.newQty")} htmlFor="quick-adj-qty">
              <Input id="quick-adj-qty" type="number" min={0} step={1} inputMode="numeric" className="w-full" value={adjQty} placeholder={String(currentQty)}
                onChange={(e) => { setAdjQty(e.target.value); setAdjErr("") }} />
            </FormField>
            <FormField label={t("common:extra.reason")} htmlFor="quick-adj-reason">
              <Select value={adjReason} onValueChange={setAdjReason}>
                <SelectTrigger id="quick-adj-reason" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {QUICK_REASONS.map((r) => <SelectItem key={r} value={r}>{t(REASON_KEY[r])}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <div className="flex items-end gap-2">
              <Button type="button" disabled={adjBusy} onClick={applyAdjust}>{t("common:actions.apply")}</Button>
              <Button type="button" variant="outline" onClick={() => setAdj(null)}>{t("common:actions.cancel")}</Button>
            </div>
            {adjErr && <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2 lg:col-span-5">{adjErr}</p>}
          </Card>
        )}

        <div>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-5 pl-4"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label={t("common:actions.selectAll")} /></TableHead>
                <TableHead scope="col">{t("common:fields.product")}</TableHead>
                {shownLocations.map((l) => <TableHead key={l.id} scope="col" className="text-right">{l.name}</TableHead>)}
                <TableHead scope="col" className="text-right">{t("inventory:stock.col.onHand")}</TableHead>
                <TableHead scope="col" className="text-right">{t("inventory:stock.col.reserved")}</TableHead>
                <TableHead scope="col" className="text-right">{t("inventory:stock.col.available")}</TableHead>
                <TableHead scope="col">{t("inventory:stock.col.health")}</TableHead>
                <TableHead scope="col" className="text-right">{t("inventory:suppliers.detail.value")}</TableHead>
                <TableHead scope="col" className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={9 + shownLocations.length} className="px-4"><Skeleton className="h-10" /></TableCell></TableRow>)
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9 + shownLocations.length}>
                    <EmptyState
                      icon={Boxes}
                      title={t("inventory:stock.empty.title")}
                      description={search || tab !== "all" || loc !== "all" || cat !== "all" ? t("inventory:stock.empty.filtered") : t("inventory:stock.empty.first")}
                      className="p-4 md:p-6"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.flatMap((r) => [renderRow(r), ...(expanded.has(key(r)) ? (r.variants ?? []).map((v) => renderRow(v, true)) : [])])
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && rows.length > 0 && (
          <>
          <Separator />
          <div className="p-4 pt-3">
            <PaginationControl
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(rows.length / perPage))}
              itemsPerPage={perPage}
              totalItems={rows.length}
              onPageChange={setPage}
              onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
            />
          </div>
          </>
        )}
        <Separator />
        <div className="px-4 py-3 text-xs text-muted-foreground">
          {t("inventory:stock.footer", { shown: rows.length, total: data?.counts.all ?? 0, count: locations.length })} · {t("inventory:stock.reservedNote")}
        </div>
      </Card>
    </div>
  )
}
