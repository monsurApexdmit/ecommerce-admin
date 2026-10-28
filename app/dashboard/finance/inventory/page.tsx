"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, Boxes, Coins, Download, Package, PackagePlus, PiggyBank, Search, Tag, X } from "lucide-react"
import { toast } from "sonner"
import financeApi, {
  financeError, type CogsResult, type InventoryLedgerParams, type InventoryLedgerResult, type InventoryMovement, type MissingSaleMovements,
  type OpeningStockPreview, type ProductWithoutCost, type Reconciliation, type Valuation, type ValuationParams, type ValuationRow,
} from "@/lib/financeApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { formatNumber, formatPct } from "@/lib/finance-format"
import { locationApi } from "@/lib/locationApi"
import { categoryApi } from "@/lib/categoryApi"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { StatTile } from "@/components/common/StatTile"
import { FilterBar } from "@/components/common/Toolbar"
import { EmptyState } from "@/components/common/EmptyState"
import { WithTooltip } from "@/components/common/WithTooltip"
import { CurrencyTag, MixBars, SignedMoney, TileSkeletons, csvMoney, downloadCsv, useFinanceFormat } from "@/components/finance/finance-ui"
import { AsOfNowLabel, FinanceFilters, useFinanceFilters } from "@/components/finance/finance-filters"
import { OpeningStockDialog } from "@/components/finance/inventory-opening-stock"
import { ReconciliationCard } from "@/components/finance/inventory-reconciliation"

const ALL = "all"
const MOVE_TYPES: [string, string][] = [
  ["opening", "Opening stock"], ["receive", "Received"], ["sell", "Sale"], ["return", "Return"], ["transfer", "Transfer"], ["adjustment", "Adjustment"], ["damage", "Damage"],
]
const pct = (v: number | null) => formatPct(v)

type InvTab = "valuation" | "ledger" | "cogs" | "costs" | "reconciliation"
const TAB_IDS: InvTab[] = ["valuation", "ledger", "cogs", "costs", "reconciliation"]
/** `?tab=` from links: opening → valuation + the move-in wizard; history → ledger. */
function tabFromQuery(t: string | null): { tab: InvTab; wizard: boolean } {
  if (t === "opening") return { tab: "valuation", wizard: true }
  if (t === "history") return { tab: "ledger", wizard: false }
  return { tab: TAB_IDS.includes(t as InvTab) ? (t as InvTab) : "valuation", wizard: false }
}
function writeTab(tab: string) {
  if (typeof window === "undefined") return
  const u = new URL(window.location.href)
  u.searchParams.set("tab", tab)
  window.history.replaceState(window.history.state, "", `${u.pathname}?${u.searchParams.toString()}`)
}

type Opt = { id: number; name: string }

async function fetchAll<T>(get: (page: number) => Promise<{ rows: T[]; meta: { lastPage: number } }>): Promise<T[]> {
  const rows: T[] = []
  for (let p = 1; p <= 100; p++) {
    const r = await get(p)
    rows.push(...r.rows)
    if (p >= r.meta.lastPage || r.rows.length === 0) break
  }
  return rows
}

export default function InventoryLedgerPage() {
  const blocked = useModuleGuard("Finance")
  const fmt = useFinanceFormat()
  const money = fmt.money
  const { canWrite } = useSaasAuth()
  const writable = canWrite("Finance")
  const sp = useSearchParams()

  const [initial] = useState(() => tabFromQuery(sp?.get("tab") ?? null))
  const [tab, setTabState] = useState<InvTab>(initial.tab)
  const setTab = (t: string) => { setTabState(t as InvTab); writeTab(t) }
  const [wizard, setWizard] = useState(initial.wizard)
  const closeWizard = () => { setWizard(false); if (sp?.get("tab") === "opening") writeTab(tab) }

  // ── Needs attention: opening stock + missing sale movements + reconciliation ──
  const [opening, setOpening] = useState<OpeningStockPreview | null>(null)
  const [missing, setMissing] = useState<MissingSaleMovements | null>(null)
  const [recon, setRecon] = useState<Reconciliation | null>(null)
  const [reconErr, setReconErr] = useState("")
  const [backfillAsk, setBackfillAsk] = useState(false)
  const [backfilling, setBackfilling] = useState(false)

  const loadAttention = useCallback(() => {
    financeApi.getOpeningStock({ page: 1, perPage: 1 }).then(setOpening).catch(() => {})
    financeApi.getMissingSaleMovements().then(setMissing).catch(() => {})
    setReconErr("")
    financeApi.getReconciliation().then(setRecon).catch((e) => setReconErr(financeError(e, "Could not load the stock reconciliation.")))
  }, [])
  useEffect(() => { loadAttention() }, [loadAttention])

  const runBackfill = async () => {
    setBackfilling(true)
    try {
      const r = await financeApi.backfillSaleMovements(false)
      toast.success(r.created ? `${r.message}: ${formatNumber(r.created)}` : "No missing sale movements")
      setBackfillAsk(false)
      refreshAll()
    } catch (e) {
      toast.error(financeError(e, "Could not create the missing sale movements"))
    } finally {
      setBackfilling(false)
    }
  }
  const [locations, setLocations] = useState<Opt[]>([])
  const [categories, setCategories] = useState<Opt[]>([])
  useEffect(() => {
    locationApi.getAll().then((r) => setLocations(r.data.map((l) => ({ id: l.id, name: l.name })))).catch(() => {})
    categoryApi.getSimple().then((r) => setCategories(r.data.map((c) => ({ id: c.id, name: c.categoryName })))).catch(() => {})
  }, [])

  // ── Valuation ──
  const [vLoc, setVLoc] = useState(ALL)
  const [vCat, setVCat] = useState(ALL)
  const [vQ, setVQ] = useState("")
  const [vQD, setVQD] = useState("")
  const [vSort, setVSort] = useState<NonNullable<ValuationParams["sort"]>>("cost_desc")
  const [vGroup, setVGroup] = useState<"location" | "category">("location")
  const [vPage, setVPage] = useState(1)
  const [vPer, setVPer] = useState(20)
  const [val, setVal] = useState<Valuation | null>(null)
  const [vLoading, setVLoading] = useState(true)
  const [vErr, setVErr] = useState("")

  useEffect(() => { const t = setTimeout(() => setVQD(vQ.trim()), 300); return () => clearTimeout(t) }, [vQ])
  useEffect(() => { setVPage(1) }, [vLoc, vCat, vQD, vSort])

  const vParams = useCallback((page: number, perPage: number): ValuationParams => ({
    locationId: vLoc !== ALL ? Number(vLoc) : undefined, categoryId: vCat !== ALL ? Number(vCat) : undefined, search: vQD || undefined, sort: vSort, page, perPage,
  }), [vLoc, vCat, vQD, vSort])

  const loadVal = useCallback(async () => {
    setVLoading(true); setVErr("")
    try { setVal(await financeApi.getValuation(vParams(vPage, vPer))) }
    catch (e) { setVErr(financeError(e, "Could not load stock valuation.")) }
    finally { setVLoading(false) }
  }, [vParams, vPage, vPer])
  useEffect(() => { loadVal() }, [loadVal])

  // ── Movement ledger (History) + COGS: shared finance filters (URL + remembered) ──
  const filters = useFinanceFilters()
  const [mType, setMType] = useState(ALL)
  const [mLoc, setMLoc] = useState(ALL)
  const [mDir, setMDir] = useState(ALL)
  const [mQ, setMQ] = useState("")
  const [mQD, setMQD] = useState("")
  const [product, setProduct] = useState<{ id: number; name: string } | null>(null)
  const [mPage, setMPage] = useState(1)
  const [mPer, setMPer] = useState(20)
  const [led, setLed] = useState<InventoryLedgerResult | null>(null)
  const [mLoading, setMLoading] = useState(true)
  const [mErr, setMErr] = useState("")
  const [cogs, setCogs] = useState<CogsResult | null>(null)

  useEffect(() => { const t = setTimeout(() => setMQD(mQ.trim()), 300); return () => clearTimeout(t) }, [mQ])
  useEffect(() => { setMPage(1) }, [filters.key, mType, mLoc, mDir, mQD, product])

  const periodParams = filters.periodParams
  const mParams = useCallback((page: number, perPage: number): InventoryLedgerParams => ({
    ...periodParams,
    type: mType !== ALL ? mType : undefined, locationId: mLoc !== ALL ? Number(mLoc) : undefined, direction: mDir !== ALL ? (mDir as "in" | "out") : undefined,
    productId: product?.id, search: mQD || undefined, page, perPage,
  }), [filters.key, mType, mLoc, mDir, product, mQD]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadLed = useCallback(async () => {
    if (!filters.ready || filters.incomplete) return
    setMLoading(true); setMErr("")
    try { setLed(await financeApi.getInventoryLedger(mParams(mPage, mPer))) }
    catch (e) { setMErr(financeError(e, "Could not load stock movements.")) }
    finally { setMLoading(false) }
  }, [mParams, mPage, mPer, filters.ready, filters.incomplete])
  useEffect(() => { if (tab === "ledger") loadLed() }, [loadLed, tab])

  const [cogsKey, setCogsKey] = useState(0)
  useEffect(() => {
    if (tab !== "cogs" || !filters.ready || filters.incomplete) return
    setCogs(null)
    financeApi.getCogs({ ...filters.params, locationId: mLoc !== ALL ? Number(mLoc) : undefined })
      .then(setCogs).catch((e) => toast.error(financeError(e, "Could not load cost of goods sold")))
  }, [tab, filters.key, filters.ready, filters.incomplete, mLoc, cogsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Products without cost (OV-1 "Set costs", ?tab=costs) ──
  const [cQ, setCQ] = useState("")
  const [cQD, setCQD] = useState("")
  const [cPage, setCPage] = useState(1)
  const [cPer, setCPer] = useState(20)
  const [costs, setCosts] = useState<{ rows: ProductWithoutCost[]; totals: { products: number; uncostedSales: number }; meta: { total: number; lastPage: number } } | null>(null)
  const [cErr, setCErr] = useState("")
  useEffect(() => { const t = setTimeout(() => setCQD(cQ.trim()), 300); return () => clearTimeout(t) }, [cQ])
  useEffect(() => { setCPage(1) }, [cQD])
  useEffect(() => {
    if (tab !== "costs") return
    setCErr("")
    financeApi.getProductsWithoutCost({ preset: "all_time", search: cQD || undefined, page: cPage, perPage: cPer })
      .then(setCosts).catch((e) => setCErr(financeError(e, "Could not load products without a cost.")))
  }, [tab, cQD, cPage, cPer])

  const refreshAll = () => { loadAttention(); loadVal(); if (tab === "ledger") loadLed(); if (tab === "cogs") setCogsKey((k) => k + 1) }

  const [exporting, setExporting] = useState(false)
  const exportCsv = async () => {
    setExporting(true)
    try {
      if (tab === "valuation") {
        const rows = await fetchAll<ValuationRow>((p) => financeApi.getValuation(vParams(p, 100)))
        if (!rows.length) { toast.error("Nothing to export."); return }
        downloadCsv("stock-valuation", [
          ["Product", (r) => r.name], ["SKU", (r) => r.sku], ["Category", (r) => r.categoryName], ["Units", (r) => r.units],
          ["Unit cost", (r) => csvMoney(r.unitCost)], ["Unit price", (r) => csvMoney(r.unitPrice)], ["Cost value", (r) => csvMoney(r.costValue)],
          ["Retail value", (r) => csvMoney(r.retailValue)], ["Potential profit", (r) => csvMoney(r.potentialProfit)],
        ], rows)
      } else if (tab === "ledger") {
        const rows = await fetchAll<InventoryMovement>((p) => financeApi.getInventoryLedger(mParams(p, 100)))
        if (!rows.length) { toast.error("Nothing to export."); return }
        downloadCsv("inventory-movements", [
          ["Date", (r) => r.date], ["Product", (r) => r.productName], ["Variant", (r) => r.variantName], ["SKU", (r) => r.sku], ["Location", (r) => r.locationName],
          ["Type", (r) => r.typeLabel], ["Qty in", (r) => r.qtyIn], ["Qty out", (r) => r.qtyOut], ["Unit cost", (r) => csvMoney(r.unitCost)], ["Value", (r) => csvMoney(r.value)],
          ["Reference", (r) => r.reference?.label], ["Reason", (r) => r.reason], ["Backfilled", (r) => (r.backfilled ? "Yes" : "")], ...(product ? [["Running qty", (r: InventoryMovement) => r.runningQty ?? ""] as [string, (r: InventoryMovement) => string | number]] : []),
        ], rows)
      } else if (tab === "costs") {
        const rows = await fetchAll<ProductWithoutCost>((p) => financeApi.getProductsWithoutCost({ preset: "all_time", search: cQD || undefined, page: p, perPage: 100 }))
        if (!rows.length) { toast.error("Nothing to export."); return }
        downloadCsv("products-without-cost", [
          ["Product", (r) => r.name], ["SKU", (r) => r.sku], ["Stock", (r) => r.stock], ["Units sold", (r) => r.unitsSold],
          ["Uncosted sales", (r) => csvMoney(r.uncostedSales)], ["Price", (r) => csvMoney(r.price)],
        ], rows)
      } else if (tab === "reconciliation") {
        if (!recon?.lines.length) { toast.error("Nothing to export."); return }
        downloadCsv("stock-reconciliation", [
          ["Product", (r) => r.name], ["Reason", (r) => r.label], ["Quantity", (r) => r.quantity], ["Value", (r) => csvMoney(r.value)], ["Explanation", (r) => r.explanation],
        ], recon.lines)
      } else if (cogs) {
        if (!cogs.byCategory.length) { toast.error("Nothing to export."); return }
        downloadCsv("cogs-by-category", [
          ["Category", (r) => r.name], ["Units", (r) => r.units], ["Revenue", (r) => csvMoney(r.revenue)], ["COGS", (r) => csvMoney(r.cogs)], ["Gross profit", (r) => csvMoney(r.grossProfit)],
        ], cogs.byCategory)
      }
    } catch (e) {
      toast.error(financeError(e, "Export failed"))
    } finally {
      setExporting(false)
    }
  }

  if (blocked) return blocked

  const t = val?.totals
  const groups = vGroup === "location" ? val?.byLocation ?? [] : val?.byCategory ?? []

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title="Inventory and ledger"
        description="What your stock is worth at cost and at selling price, every stock movement with its value, and the cost of goods sold."
        actions={<>
          <CurrencyTag code={recon?.context.currency?.code ?? cogs?.context.currency?.code ?? led?.context.currency?.code} />
          <Button asChild variant="outline"><Link href="/dashboard/inventory">Stock overview</Link></Button>
          <Button type="button" variant="outline" onClick={exportCsv} disabled={exporting}><Download className="size-4" aria-hidden /> {exporting ? "Exporting…" : "Export CSV"}</Button>
        </>}
      />

      {((opening && opening.totals.products > 0) || (missing && missing.lines > 0) || (recon && recon.difference !== 0)) && (
        <Alert className="border-amber-300 dark:border-amber-700">
          <AlertTriangle className="text-amber-600" aria-hidden />
          <AlertTitle className="flex flex-wrap items-center gap-2">Needs attention <AsOfNowLabel /></AlertTitle>
          <AlertDescription>
            <ul className="flex w-full flex-col gap-2">
              {opening && opening.totals.products > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Opening stock for {formatNumber(opening.totals.products)} product{opening.totals.products === 1 ? " hasn't" : "s hasn't"} been moved in yet
                    {opening.totals.value ? ` (${money(opening.totals.value)} at cost` : ""}{opening.totals.value && opening.totals.needsCost ? `, ${formatNumber(opening.totals.needsCost)} need a cost)` : opening.totals.value ? ")" : ""}.
                  </span>
                  {writable && <Button type="button" size="sm" onClick={() => setWizard(true)}><PackagePlus className="size-4" aria-hidden /> Move in opening stock</Button>}
                </li>
              )}
              {missing && missing.lines > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span>{formatNumber(missing.lines)} sale line{missing.lines === 1 ? "" : "s"} on {formatNumber(missing.sales)} order{missing.sales === 1 ? "" : "s"} ({money(missing.value)} at cost) {missing.lines === 1 ? "has" : "have"} no stock movement, so History doesn&apos;t show them.</span>
                  {writable && <Button type="button" size="sm" variant="outline" onClick={() => setBackfillAsk(true)}>Create missing sale movements</Button>}
                </li>
              )}
              {recon && recon.difference !== 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span>{recon.text || `Stock value and movements are off by ${money(Math.abs(recon.difference))}.`}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setTab("reconciliation")}>Show the math</Button>
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList aria-label="View" className="h-auto flex-wrap">
          <TabsTrigger value="valuation">Stock valuation</TabsTrigger>
          <TabsTrigger value="ledger">History</TabsTrigger>
          <TabsTrigger value="cogs">Cost of goods sold</TabsTrigger>
          <TabsTrigger value="costs">Products without cost</TabsTrigger>
          <TabsTrigger value="reconciliation">Stock vs movements</TabsTrigger>
        </TabsList>

        {/* ── Valuation ── */}
        <TabsContent value="valuation" className="flex flex-col gap-5">
          <FilterBar>
            <Select value={vLoc} onValueChange={setVLoc}>
              <SelectTrigger aria-label="Location" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>All locations</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={vCat} onValueChange={setVCat}>
              <SelectTrigger aria-label="Category" className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>All categories</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">Stock on hand today</span>
          </FilterBar>
          {vErr && <Alert variant="destructive"><AlertDescription>{vErr}</AlertDescription></Alert>}

          <section aria-label="Valuation totals" className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", vLoading && val && "opacity-60")}>
            {!t ? <TileSkeletons /> : <>
              <StatTile label="Value at cost" icon={<Coins />} value={money(t.costValue)} hint="What the stock cost you" />
              <StatTile label="Value at selling price" icon={<Tag />} value={money(t.retailValue)} hint="If everything sells at today's price" />
              <StatTile label="Potential profit" icon={<PiggyBank />} value={<SignedMoney value={t.potentialProfit} format={money} positiveTone />} hint={`Margin ${pct(t.marginPct)}`} />
              <StatTile label="Units in stock" icon={<Boxes />} value={formatNumber(t.units)} hint={`${formatNumber(t.productCount)} products`} />
            </>}
          </section>

          <SectionCard
            title={vGroup === "location" ? "By location" : "By category"}
            actions={<SegmentedControl aria-label="Group by" value={vGroup} onValueChange={(v) => setVGroup(v as typeof vGroup)} options={[{ value: "location", label: "Location" }, { value: "category", label: "Category" }]} />}
            contentClassName="grid gap-6 lg:grid-cols-[1fr_1.4fr]"
          >
            {!val ? <Skeleton className="h-40 lg:col-span-2" /> : groups.length === 0 ? <p className="text-sm text-muted-foreground lg:col-span-2">No stock on hand.</p> : <>
              <MixBars items={groups.map((g) => ({ label: g.name, value: g.costValue }))} format={money} />
              <div className="overflow-x-auto">
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{vGroup === "location" ? "Location" : "Category"}</TableHead><TableHead className="text-right">Units</TableHead>
                      <TableHead className="text-right">At cost</TableHead><TableHead className="text-right">At price</TableHead><TableHead className="text-right">Potential profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((g) => (
                      <TableRow key={`${g.id ?? "none"}-${g.name}`}>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(g.units)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(g.costValue)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(g.retailValue)}</TableCell>
                        <TableCell className="text-right"><SignedMoney value={g.potentialProfit} format={money} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  {t && (
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-bold">Total</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{formatNumber(t.units)}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{money(t.costValue)}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{money(t.retailValue)}</TableCell>
                        <TableCell className="text-right font-bold"><SignedMoney value={t.potentialProfit} format={money} /></TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </>}
          </SectionCard>

          <SectionCard title="Products" contentClassName="flex flex-col gap-4 px-2">
            <FilterBar className="px-2">
              <InputGroup className="w-full sm:w-64">
                <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
                <InputGroupInput aria-label="Search products" placeholder="Product or SKU…" value={vQ} onChange={(e) => setVQ(e.target.value)} />
              </InputGroup>
              <Select value={vSort} onValueChange={(v) => setVSort(v as typeof vSort)}>
                <SelectTrigger aria-label="Sort" className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cost_desc">Highest cost value</SelectItem>
                  <SelectItem value="retail_desc">Highest retail value</SelectItem>
                  <SelectItem value="qty_desc">Most units</SelectItem>
                  <SelectItem value="name_asc">Name A–Z</SelectItem>
                </SelectContent>
              </Select>
            </FilterBar>
            {!val ? <div className="flex flex-col gap-2 px-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}</div> : val.rows.length === 0 ? (
              <EmptyState icon={Package} title="No products in stock" description="Nothing matches these filters." />
            ) : (
              <div className={cn("overflow-x-auto", vLoading && "opacity-60")}>
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Unit cost</TableHead>
                      <TableHead className="text-right">Unit price</TableHead><TableHead className="text-right">At cost</TableHead><TableHead className="text-right">At price</TableHead><TableHead className="text-right">Potential profit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {val.rows.map((r) => (
                      <TableRow key={r.productId}>
                        <TableCell>
                          <WithTooltip content="Show this product's movements">
                            <Button type="button" variant="link" className="h-auto p-0 font-medium" onClick={() => { setProduct({ id: r.productId, name: r.name }); setTab("ledger") }}>{r.name}</Button>
                          </WithTooltip>
                          {r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.categoryName ?? "Uncategorised"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.units)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", !r.unitCost && "text-amber-600")}>{r.unitCost ? money(r.unitCost) : "No cost"}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.unitPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.costValue)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.retailValue)}</TableCell>
                        <TableCell className="text-right"><SignedMoney value={r.potentialProfit} format={money} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {val && val.meta.total > 0 && (
              <PaginationControl currentPage={vPage} totalPages={Math.max(1, val.meta.lastPage)} itemsPerPage={vPer} totalItems={val.meta.total}
                onPageChange={setVPage} onItemsPerPageChange={(n) => { setVPer(n); setVPage(1) }} />
            )}
          </SectionCard>
        </TabsContent>

        {/* ── Movement ledger ── */}
        <TabsContent value="ledger" className="flex flex-col gap-5">
          <FilterBar>
            <InputGroup className="w-full sm:w-60">
              <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
              <InputGroupInput aria-label="Search movements" placeholder="Product, SKU, reference…" value={mQ} onChange={(e) => setMQ(e.target.value)} />
            </InputGroup>
            <FinanceFilters filters={filters} channel={false} idPrefix="inventory-history" />
            <Select value={mType} onValueChange={setMType}>
              <SelectTrigger aria-label="Movement type" className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>All movements</SelectItem>{MOVE_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={mDir} onValueChange={setMDir}>
              <SelectTrigger aria-label="Direction" className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>In and out</SelectItem><SelectItem value="in">Stock in</SelectItem><SelectItem value="out">Stock out</SelectItem></SelectContent>
            </Select>
            <Select value={mLoc} onValueChange={setMLoc}>
              <SelectTrigger aria-label="Location" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>All locations</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            {product && (
              <Badge variant="secondary" className="h-8 gap-1.5 pl-3 pr-1 text-sm">
                {product.name}{led?.product ? ` · ${formatNumber(led.product.currentQty)} in stock` : ""}
                <WithTooltip content="Clear product filter">
                  <Button type="button" variant="ghost" size="icon" className="size-6" aria-label="Clear product filter" onClick={() => setProduct(null)}><X className="size-3.5" aria-hidden /></Button>
                </WithTooltip>
              </Badge>
            )}
          </FilterBar>
          {mErr && <Alert variant="destructive"><AlertDescription>{mErr}</AlertDescription></Alert>}

          <section aria-label="Movement totals" className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", mLoading && led && "opacity-60")}>
            {!led ? <TileSkeletons /> : <>
              <StatTile label="Units in" value={formatNumber(led.totals.qtyIn)} hint={`${money(led.totals.valueIn)} at cost`} />
              <StatTile label="Units out" value={formatNumber(led.totals.qtyOut)} hint={`${money(led.totals.valueOut)} at cost`} />
              <StatTile label="Net units" value={formatNumber(led.totals.qtyIn - led.totals.qtyOut)} hint={`${money(led.totals.valueIn - led.totals.valueOut)} net value`} />
              <StatTile label="Movements" value={formatNumber(led.totals.count)} hint={filters.label} />
            </>}
          </section>

          <SectionCard contentClassName="flex flex-col gap-4 px-2">
            {mLoading && !led ? <div className="flex flex-col gap-2 px-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-11" />)}</div> : !led || led.rows.length === 0 ? (
              <EmptyState icon={Boxes} title="No stock movements" description="Nothing moved for these filters." />
            ) : (
              <div className={cn("overflow-x-auto", mLoading && "opacity-60")}>
                <Table className="min-w-[960px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Location</TableHead><TableHead>Type</TableHead>
                      <TableHead className="text-right">In</TableHead><TableHead className="text-right">Out</TableHead>
                      <TableHead className="text-right">Unit cost</TableHead><TableHead className="text-right">Value</TableHead><TableHead>Reference</TableHead>
                      {product && <TableHead className="text-right">Stock after</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {led.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{fmt.dateTime(r.date)}</TableCell>
                        <TableCell className="max-w-[240px]">
                          {r.productId && !product ? (
                            <Button type="button" variant="link" className="h-auto max-w-full justify-start truncate p-0 font-medium" onClick={() => setProduct({ id: r.productId!, name: r.productName })}>{r.productName}</Button>
                          ) : <div className="truncate font-medium">{r.productName}</div>}
                          <div className="truncate text-xs text-muted-foreground">{[r.variantName, r.sku].filter(Boolean).join(" · ") || " "}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.locationName ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant={r.isOpening ? "default" : r.qtyIn > 0 ? "secondary" : "outline"}>{r.isOpening ? "Opening stock" : r.typeLabel}</Badge>
                            {r.backfilled && (
                              <WithTooltip content="Created afterwards from the sale line, so History matches the cost of goods sold">
                                <Badge variant="outline" tabIndex={0}>Backfilled</Badge>
                              </WithTooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">{r.qtyIn ? `+${r.qtyIn}` : ""}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">{r.qtyOut ? `−${r.qtyOut}` : ""}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{money(r.unitCost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.value)}</TableCell>
                        <TableCell className="max-w-[200px]">
                          {r.reference ? ((r.reference.href || r.orderHref) ? <Link href={(r.reference.href || r.orderHref)!} className="font-medium text-primary hover:underline">{r.reference.label}</Link> : <span>{r.reference.label}</span>) : "—"}
                          {(r.orderHref || r.ledgerHref) && (
                            <div className="flex gap-2 text-xs">
                              {r.orderHref && <Link href={r.orderHref} className="text-primary hover:underline">Order</Link>}
                              {r.ledgerHref && <Link href={r.ledgerHref} className="text-primary hover:underline">Ledger</Link>}
                            </div>
                          )}
                          {r.reason && <div className="truncate text-xs text-muted-foreground">{r.reason}</div>}
                        </TableCell>
                        {product && <TableCell className="text-right font-medium tabular-nums">{r.runningQty ?? "—"}</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {led && led.meta.total > 0 && (
              <PaginationControl currentPage={mPage} totalPages={Math.max(1, led.meta.lastPage)} itemsPerPage={mPer} totalItems={led.meta.total}
                onPageChange={setMPage} onItemsPerPageChange={(n) => { setMPer(n); setMPage(1) }} />
            )}
          </SectionCard>
        </TabsContent>

        {/* ── COGS ── */}
        <TabsContent value="cogs" className="flex flex-col gap-5">
          <FilterBar>
            <FinanceFilters filters={filters} idPrefix="inventory-cogs" />
            <Select value={mLoc} onValueChange={setMLoc}>
              <SelectTrigger aria-label="Location" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>All locations</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {cogs?.period?.from ? `${fmt.date(cogs.period.from)} – ${fmt.date(cogs.period.to)}` : filters.label}
              {cogs && cogs.context.channel !== "all" ? ` · ${cogs.context.channelLabel}` : ""}
            </span>
          </FilterBar>
          <section aria-label="COGS totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {!cogs ? <TileSkeletons /> : <>
              <StatTile label="Revenue" value={money(cogs.totals.revenue)} hint={`${formatNumber(cogs.totals.orders)} orders`} />
              <StatTile label="Cost of goods sold" value={money(cogs.totals.cogs)} hint={`${formatNumber(cogs.totals.units)} units sold`} />
              <StatTile label="Gross profit" value={<SignedMoney value={cogs.totals.grossProfit} format={money} positiveTone />} hint={`Margin ${pct(cogs.totals.marginPct)}`} />
              <StatTile label="COGS share of revenue" value={cogs.totals.revenue ? pct((cogs.totals.cogs / cogs.totals.revenue) * 100) : "—"} />
            </>}
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            {([["By category", cogs?.byCategory, "Category"], ["Top products", cogs?.topProducts, "Product"]] as const).map(([title, lines, col]) => (
              <SectionCard key={title} title={title} contentClassName="px-2">
                {!lines ? <Skeleton className="mx-2 h-40" /> : lines.length === 0 ? <p className="px-2 text-sm text-muted-foreground">No sales in this period.</p> : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[480px]">
                      <TableHeader>
                        <TableRow><TableHead>{col}</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">COGS</TableHead><TableHead className="text-right">Gross profit</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {lines.map((l) => (
                          <TableRow key={`${l.id ?? "none"}-${l.name}`}>
                            <TableCell className="font-medium">{l.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatNumber(l.units)}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(l.revenue)}</TableCell>
                            <TableCell className="text-right tabular-nums">{money(l.cogs)}</TableCell>
                            <TableCell className="text-right"><SignedMoney value={l.grossProfit} format={money} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </SectionCard>
            ))}
          </div>
        </TabsContent>

        {/* ── Products without cost ── */}
        <TabsContent value="costs" className="flex flex-col gap-5">
          <SectionCard title="Products without cost" contentClassName="flex flex-col gap-4 px-2"
            description="Products with stock or sales but no cost price. Their sales show as uncosted on the Overview and their stock has no value until a cost is set."
            actions={<AsOfNowLabel />}>
            <FilterBar className="px-2">
              <InputGroup className="w-full sm:w-64">
                <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
                <InputGroupInput aria-label="Search products without cost" placeholder="Product or SKU…" value={cQ} onChange={(e) => setCQ(e.target.value)} />
              </InputGroup>
              {costs && <span className="text-sm text-muted-foreground">{formatNumber(costs.totals.products)} products · {money(costs.totals.uncostedSales)} uncosted sales (all time)</span>}
              {writable && opening && opening.totals.products > 0 && (
                <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setWizard(true)}>Set costs and move in opening stock</Button>
              )}
            </FilterBar>
            {cErr && <Alert variant="destructive"><AlertDescription>{cErr}</AlertDescription></Alert>}
            {!costs ? <div className="flex flex-col gap-2 px-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div> : costs.rows.length === 0 ? (
              <EmptyState icon={Tag} title="Every product has a cost" description={cQD ? "Nothing matches this search." : "Profit is worked out for all sales."} />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Units sold</TableHead>
                      <TableHead className="text-right">Uncosted sales</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.rows.map((r) => (
                      <TableRow key={r.productId}>
                        <TableCell><div className="font-medium">{r.name}</div>{r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.stock)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.unitsSold)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.uncostedSales)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{money(r.price)}</TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline"><Link href={r.editHref ?? `/dashboard/products/${r.productId}`}>Set cost</Link></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {costs && costs.meta.total > 0 && (
              <PaginationControl currentPage={cPage} totalPages={Math.max(1, costs.meta.lastPage)} itemsPerPage={cPer} totalItems={costs.meta.total}
                onPageChange={setCPage} onItemsPerPageChange={(n) => { setCPer(n); setCPage(1) }} />
            )}
          </SectionCard>
        </TabsContent>

        {/* ── Stock vs movements (INV-3) ── */}
        <TabsContent value="reconciliation" className="flex flex-col gap-5">
          <ReconciliationCard data={recon} error={reconErr} writable={writable} onMoveIn={() => setWizard(true)} onBackfill={() => setBackfillAsk(true)} />
        </TabsContent>
      </Tabs>

      <OpeningStockDialog open={wizard} onClose={closeWizard} onDone={refreshAll} writable={writable} />

      <AlertDialog open={backfillAsk} onOpenChange={(o) => !o && !backfilling && setBackfillAsk(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create missing sale movements?</AlertDialogTitle>
            <AlertDialogDescription>
              {missing ? `${formatNumber(missing.lines)} sale line${missing.lines === 1 ? "" : "s"} (${money(missing.value)} at cost) get a stock movement dated at the order time. ` : ""}
              Stock on hand doesn&apos;t change — the sales already took it out. Running it again is safe: lines that have a movement are skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={backfilling}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runBackfill() }} disabled={backfilling}>{backfilling ? "Creating…" : "Create movements"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
