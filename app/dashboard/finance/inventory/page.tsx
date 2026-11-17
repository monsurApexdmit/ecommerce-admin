"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
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
import { AsOfNowLabel, FinanceFilters, channelLabel, useFinanceFilters } from "@/components/finance/finance-filters"
import { OpeningStockDialog } from "@/components/finance/inventory-opening-stock"
import { FIN_NS, MOVE_CODES, moveText } from "@/components/finance/i18n"
import { ReconciliationCard } from "@/components/finance/inventory-reconciliation"

const ALL = "all"
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
  const { t } = useTranslation(FIN_NS)
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
    financeApi.getReconciliation().then(setRecon).catch((e) => setReconErr(financeError(e, t("finance:inventory.reconFailed"))))
  }, [])
  useEffect(() => { loadAttention() }, [loadAttention])

  const runBackfill = async () => {
    setBackfilling(true)
    try {
      const r = await financeApi.backfillSaleMovements(false)
      toast.success(r.created ? t("finance:inventory.backfilled", { count: r.created, n: formatNumber(r.created) }) : t("finance:inventory.noMissing"))
      setBackfillAsk(false)
      refreshAll()
    } catch (e) {
      toast.error(financeError(e, t("finance:inventory.backfillFailed")))
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
    catch (e) { setVErr(financeError(e, t("finance:inventory.valuationFailed"))) }
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
    catch (e) { setMErr(financeError(e, t("finance:inventory.movementsFailed"))) }
    finally { setMLoading(false) }
  }, [mParams, mPage, mPer, filters.ready, filters.incomplete])
  useEffect(() => { if (tab === "ledger") loadLed() }, [loadLed, tab])

  const [cogsKey, setCogsKey] = useState(0)
  useEffect(() => {
    if (tab !== "cogs" || !filters.ready || filters.incomplete) return
    setCogs(null)
    financeApi.getCogs({ ...filters.params, locationId: mLoc !== ALL ? Number(mLoc) : undefined })
      .then(setCogs).catch((e) => toast.error(financeError(e, t("finance:inventory.cogsFailed"))))
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
      .then(setCosts).catch((e) => setCErr(financeError(e, t("finance:setCosts.loadFailed"))))
  }, [tab, cQD, cPage, cPer])

  const refreshAll = () => { loadAttention(); loadVal(); if (tab === "ledger") loadLed(); if (tab === "cogs") setCogsKey((k) => k + 1) }

  const [exporting, setExporting] = useState(false)
  const exportCsv = async () => {
    setExporting(true)
    try {
      if (tab === "valuation") {
        const rows = await fetchAll<ValuationRow>((p) => financeApi.getValuation(vParams(p, 100)))
        if (!rows.length) { toast.error(t("finance:actions.nothingToExport")); return }
        downloadCsv("stock-valuation", [
          [t("common:fields.product"), (r) => r.name], [t("common:fields.sku"), (r) => r.sku], [t("common:fields.category"), (r) => r.categoryName], [t("finance:col.units"), (r) => r.units],
          [t("finance:col.unitCost"), (r) => csvMoney(r.unitCost)], [t("finance:col.unitPrice"), (r) => csvMoney(r.unitPrice)], [t("finance:inventory.costValue"), (r) => csvMoney(r.costValue)],
          [t("finance:inventory.retailValue"), (r) => csvMoney(r.retailValue)], [t("finance:col.potentialProfit"), (r) => csvMoney(r.potentialProfit)],
        ], rows)
      } else if (tab === "ledger") {
        const rows = await fetchAll<InventoryMovement>((p) => financeApi.getInventoryLedger(mParams(p, 100)))
        if (!rows.length) { toast.error(t("finance:actions.nothingToExport")); return }
        downloadCsv("inventory-movements", [
          [t("common:fields.date"), (r) => r.date], [t("common:fields.product"), (r) => r.productName], [t("common:fields.variant"), (r) => r.variantName], [t("common:fields.sku"), (r) => r.sku], [t("common:fields.location"), (r) => r.locationName],
          [t("common:fields.type"), (r) => moveText(t, r.type, r.typeLabel)], [t("finance:inventory.qtyIn"), (r) => r.qtyIn], [t("finance:inventory.qtyOut"), (r) => r.qtyOut], [t("finance:col.unitCost"), (r) => csvMoney(r.unitCost)], [t("finance:col.value"), (r) => csvMoney(r.value)],
          [t("common:extra.reference"), (r) => r.reference?.label], [t("common:extra.reason"), (r) => r.reason], [t("finance:inventory.backfilledCol"), (r) => (r.backfilled ? t("common:actions.yes") : "")], ...(product ? [[t("finance:inventory.runningQty"), (r: InventoryMovement) => r.runningQty ?? ""] as [string, (r: InventoryMovement) => string | number]] : []),
        ], rows)
      } else if (tab === "costs") {
        const rows = await fetchAll<ProductWithoutCost>((p) => financeApi.getProductsWithoutCost({ preset: "all_time", search: cQD || undefined, page: p, perPage: 100 }))
        if (!rows.length) { toast.error(t("finance:actions.nothingToExport")); return }
        downloadCsv("products-without-cost", [
          [t("common:fields.product"), (r) => r.name], [t("common:fields.sku"), (r) => r.sku], [t("common:fields.stock"), (r) => r.stock], [t("finance:setCosts.unitsSold"), (r) => r.unitsSold],
          [t("finance:overview.uncosted"), (r) => csvMoney(r.uncostedSales)], [t("common:money.price"), (r) => csvMoney(r.price)],
        ], rows)
      } else if (tab === "reconciliation") {
        if (!recon?.lines.length) { toast.error(t("finance:actions.nothingToExport")); return }
        downloadCsv("stock-reconciliation", [
          [t("common:fields.product"), (r) => r.name], [t("common:extra.reason"), (r) => r.label], [t("common:fields.quantity"), (r) => r.quantity], [t("finance:col.value"), (r) => csvMoney(r.value)], [t("finance:inventory.explanation"), (r) => r.explanation],
        ], recon.lines)
      } else if (cogs) {
        if (!cogs.byCategory.length) { toast.error(t("finance:actions.nothingToExport")); return }
        downloadCsv("cogs-by-category", [
          [t("common:fields.category"), (r) => r.name], [t("finance:col.units"), (r) => r.units], [t("finance:col.revenue"), (r) => csvMoney(r.revenue)], [t("finance:col.cogs"), (r) => csvMoney(r.cogs)], [t("finance:col.grossProfit"), (r) => csvMoney(r.grossProfit)],
        ], cogs.byCategory)
      }
    } catch (e) {
      toast.error(financeError(e, t("finance:actions.exportFailed")))
    } finally {
      setExporting(false)
    }
  }

  if (blocked) return blocked

  const tot = val?.totals
  const groups = vGroup === "location" ? val?.byLocation ?? [] : val?.byCategory ?? []

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title={t("finance:inventory.title")}
        description={t("finance:inventory.description")}
        actions={<>
          <CurrencyTag code={recon?.context.currency?.code ?? cogs?.context.currency?.code ?? led?.context.currency?.code} />
          <Button asChild variant="outline"><Link href="/dashboard/inventory">{t("finance:inventory.stockOverview")}</Link></Button>
          <Button type="button" variant="outline" onClick={exportCsv} disabled={exporting}><Download className="size-4" aria-hidden /> {exporting ? t("finance:actions.exporting") : t("finance:actions.exportCsv")}</Button>
        </>}
      />

      {((opening && opening.totals.products > 0) || (missing && missing.lines > 0) || (recon && recon.difference !== 0)) && (
        <Alert className="border-amber-300 dark:border-amber-700">
          <AlertTriangle className="text-amber-600" aria-hidden />
          <AlertTitle className="flex flex-wrap items-center gap-2">{t("finance:inventory.needsAttention")} <AsOfNowLabel /></AlertTitle>
          <AlertDescription>
            <ul className="flex w-full flex-col gap-2">
              {opening && opening.totals.products > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {t("finance:inventory.openingPending", { count: opening.totals.products, n: formatNumber(opening.totals.products) })}
                    {opening.totals.value ? ` (${t("finance:inventory.atCost", { amount: money(opening.totals.value) })}${opening.totals.needsCost ? `, ${t("finance:inventory.needCost", { n: formatNumber(opening.totals.needsCost) })}` : ""})` : ""}.
                  </span>
                  {writable && <Button type="button" size="sm" onClick={() => setWizard(true)}><PackagePlus className="size-4" aria-hidden /> {t("finance:opening.title")}</Button>}
                </li>
              )}
              {missing && missing.lines > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span>{t("finance:inventory.missingLines", { count: missing.lines, n: formatNumber(missing.lines), orders: t("common:count.orders", { count: missing.sales }), amount: money(missing.value) })}</span>
                  {writable && <Button type="button" size="sm" variant="outline" onClick={() => setBackfillAsk(true)}>{t("finance:inventory.createMissing")}</Button>}
                </li>
              )}
              {recon && recon.difference !== 0 && (
                <li className="flex flex-wrap items-center justify-between gap-2">
                  <span>{recon.text || t("finance:inventory.offBy", { amount: money(Math.abs(recon.difference)) })}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => setTab("reconciliation")}>{t("finance:recon.showMath")}</Button>
                </li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList aria-label={t("finance:inventory.viewAria")} className="h-auto flex-wrap">
          <TabsTrigger value="valuation">{t("finance:inventory.tabValuation")}</TabsTrigger>
          <TabsTrigger value="ledger">{t("common:extra.history")}</TabsTrigger>
          <TabsTrigger value="cogs">{t("finance:kpi.cogs")}</TabsTrigger>
          <TabsTrigger value="costs">{t("finance:inventory.tabCosts")}</TabsTrigger>
          <TabsTrigger value="reconciliation">{t("finance:inventory.tabRecon")}</TabsTrigger>
        </TabsList>

        {/* ── Valuation ── */}
        <TabsContent value="valuation" className="flex flex-col gap-5">
          <FilterBar>
            <Select value={vLoc} onValueChange={setVLoc}>
              <SelectTrigger aria-label={t("common:fields.location")} className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>{t("finance:inventory.allLocations")}</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={vCat} onValueChange={setVCat}>
              <SelectTrigger aria-label={t("common:fields.category")} className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>{t("finance:inventory.allCategories")}</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{t("finance:inventory.onHandToday")}</span>
          </FilterBar>
          {vErr && <Alert variant="destructive"><AlertDescription>{vErr}</AlertDescription></Alert>}

          <section aria-label={t("finance:inventory.valuationAria")} className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", vLoading && val && "opacity-60")}>
            {!tot ? <TileSkeletons /> : <>
              <StatTile label={t("finance:inventory.valueAtCost")} icon={<Coins />} value={money(tot.costValue)} hint={t("finance:inventory.valueAtCostHint")} />
              <StatTile label={t("finance:inventory.valueAtPrice")} icon={<Tag />} value={money(tot.retailValue)} hint={t("finance:inventory.valueAtPriceHint")} />
              <StatTile label={t("finance:col.potentialProfit")} icon={<PiggyBank />} value={<SignedMoney value={tot.potentialProfit} format={money} positiveTone />} hint={t("finance:kpi.margin", { pct: pct(tot.marginPct) })} />
              <StatTile label={t("finance:inventory.unitsInStock")} icon={<Boxes />} value={formatNumber(tot.units)} hint={t("common:count.products", { count: tot.productCount })} />
            </>}
          </section>

          <SectionCard
            title={vGroup === "location" ? t("finance:inventory.byLocation") : t("finance:inventory.byCategory")}
            actions={<SegmentedControl aria-label={t("finance:inventory.groupBy")} value={vGroup} onValueChange={(v) => setVGroup(v as typeof vGroup)} options={[{ value: "location", label: t("common:fields.location") }, { value: "category", label: t("common:fields.category") }]} />}
            contentClassName="grid gap-6 lg:grid-cols-[1fr_1.4fr]"
          >
            {!val ? <Skeleton className="h-40 lg:col-span-2" /> : groups.length === 0 ? <p className="text-sm text-muted-foreground lg:col-span-2">{t("finance:inventory.noStock")}</p> : <>
              <MixBars items={groups.map((g) => ({ label: g.name, value: g.costValue }))} format={money} />
              <div className="overflow-x-auto">
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{vGroup === "location" ? t("common:fields.location") : t("common:fields.category")}</TableHead><TableHead className="text-right">{t("finance:col.units")}</TableHead>
                      <TableHead className="text-right">{t("finance:inventory.atCostCol")}</TableHead><TableHead className="text-right">{t("finance:inventory.atPriceCol")}</TableHead><TableHead className="text-right">{t("finance:col.potentialProfit")}</TableHead>
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
                  {tot && (
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-bold">{t("common:money.total")}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{formatNumber(tot.units)}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{money(tot.costValue)}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{money(tot.retailValue)}</TableCell>
                        <TableCell className="text-right font-bold"><SignedMoney value={tot.potentialProfit} format={money} /></TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </>}
          </SectionCard>

          <SectionCard title={t("common:fields.products")} contentClassName="flex flex-col gap-4 px-2">
            <FilterBar className="px-2">
              <InputGroup className="w-full sm:w-64">
                <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
                <InputGroupInput aria-label={t("finance:setCosts.search")} placeholder={t("finance:setCosts.searchPh")} value={vQ} onChange={(e) => setVQ(e.target.value)} />
              </InputGroup>
              <Select value={vSort} onValueChange={(v) => setVSort(v as typeof vSort)}>
                <SelectTrigger aria-label={t("finance:sort.label")} className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cost_desc">{t("finance:sort.costDesc")}</SelectItem>
                  <SelectItem value="retail_desc">{t("finance:sort.retailDesc")}</SelectItem>
                  <SelectItem value="qty_desc">{t("finance:sort.qtyDesc")}</SelectItem>
                  <SelectItem value="name_asc">{t("finance:sort.nameAsc")}</SelectItem>
                </SelectContent>
              </Select>
            </FilterBar>
            {!val ? <div className="flex flex-col gap-2 px-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}</div> : val.rows.length === 0 ? (
              <EmptyState icon={Package} title={t("finance:inventory.noProductsTitle")} description={t("finance:ui.noMatchFilters")} />
            ) : (
              <div className={cn("overflow-x-auto", vLoading && "opacity-60")}>
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common:fields.product")}</TableHead><TableHead>{t("common:fields.category")}</TableHead><TableHead className="text-right">{t("finance:col.units")}</TableHead><TableHead className="text-right">{t("finance:col.unitCost")}</TableHead>
                      <TableHead className="text-right">{t("finance:col.unitPrice")}</TableHead><TableHead className="text-right">{t("finance:inventory.atCostCol")}</TableHead><TableHead className="text-right">{t("finance:inventory.atPriceCol")}</TableHead><TableHead className="text-right">{t("finance:col.potentialProfit")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {val.rows.map((r) => (
                      <TableRow key={r.productId}>
                        <TableCell>
                          <WithTooltip content={t("finance:inventory.showMovements")}>
                            <Button type="button" variant="link" className="h-auto p-0 font-medium" onClick={() => { setProduct({ id: r.productId, name: r.name }); setTab("ledger") }}>{r.name}</Button>
                          </WithTooltip>
                          {r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.categoryName ?? t("finance:inventory.uncategorised")}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.units)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", !r.unitCost && "text-amber-600")}>{r.unitCost ? money(r.unitCost) : t("finance:inventory.noCost")}</TableCell>
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
              <InputGroupInput aria-label={t("finance:inventory.searchMovements")} placeholder={t("finance:inventory.searchMovementsPh")} value={mQ} onChange={(e) => setMQ(e.target.value)} />
            </InputGroup>
            <FinanceFilters filters={filters} channel={false} idPrefix="inventory-history" />
            <Select value={mType} onValueChange={setMType}>
              <SelectTrigger aria-label={t("finance:inventory.movementType")} className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>{t("finance:inventory.allMovements")}</SelectItem>{MOVE_CODES.map((v) => <SelectItem key={v} value={v}>{moveText(t, v)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={mDir} onValueChange={setMDir}>
              <SelectTrigger aria-label={t("finance:transactions.direction")} className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>{t("finance:transactions.inAndOut")}</SelectItem><SelectItem value="in">{t("finance:inventory.stockIn")}</SelectItem><SelectItem value="out">{t("finance:inventory.stockOut")}</SelectItem></SelectContent>
            </Select>
            <Select value={mLoc} onValueChange={setMLoc}>
              <SelectTrigger aria-label={t("common:fields.location")} className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>{t("finance:inventory.allLocations")}</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            {product && (
              <Badge variant="secondary" className="h-8 gap-1.5 pl-3 pr-1 text-sm">
                {product.name}{led?.product ? ` · ${t("finance:inventory.inStockQty", { n: formatNumber(led.product.currentQty) })}` : ""}
                <WithTooltip content={t("finance:inventory.clearProduct")}>
                  <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={t("finance:inventory.clearProduct")} onClick={() => setProduct(null)}><X className="size-3.5" aria-hidden /></Button>
                </WithTooltip>
              </Badge>
            )}
          </FilterBar>
          {mErr && <Alert variant="destructive"><AlertDescription>{mErr}</AlertDescription></Alert>}

          <section aria-label={t("finance:inventory.movementTotalsAria")} className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", mLoading && led && "opacity-60")}>
            {!led ? <TileSkeletons /> : <>
              <StatTile label={t("finance:inventory.unitsIn")} value={formatNumber(led.totals.qtyIn)} hint={t("finance:inventory.atCost", { amount: money(led.totals.valueIn) })} />
              <StatTile label={t("finance:inventory.unitsOut")} value={formatNumber(led.totals.qtyOut)} hint={t("finance:inventory.atCost", { amount: money(led.totals.valueOut) })} />
              <StatTile label={t("finance:inventory.netUnits")} value={formatNumber(led.totals.qtyIn - led.totals.qtyOut)} hint={t("finance:inventory.netValue", { amount: money(led.totals.valueIn - led.totals.valueOut) })} />
              <StatTile label={t("finance:inventory.movements")} value={formatNumber(led.totals.count)} hint={filters.label} />
            </>}
          </section>

          <SectionCard contentClassName="flex flex-col gap-4 px-2">
            {mLoading && !led ? <div className="flex flex-col gap-2 px-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-11" />)}</div> : !led || led.rows.length === 0 ? (
              <EmptyState icon={Boxes} title={t("finance:inventory.noMovementsTitle")} description={t("finance:inventory.noMovementsDesc")} />
            ) : (
              <div className={cn("overflow-x-auto", mLoading && "opacity-60")}>
                <Table className="min-w-[960px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common:fields.date")}</TableHead><TableHead>{t("common:fields.product")}</TableHead><TableHead>{t("common:fields.location")}</TableHead><TableHead>{t("common:fields.type")}</TableHead>
                      <TableHead className="text-right">{t("finance:col.in")}</TableHead><TableHead className="text-right">{t("finance:col.out")}</TableHead>
                      <TableHead className="text-right">{t("finance:col.unitCost")}</TableHead><TableHead className="text-right">{t("finance:col.value")}</TableHead><TableHead>{t("common:extra.reference")}</TableHead>
                      {product && <TableHead className="text-right">{t("finance:inventory.stockAfter")}</TableHead>}
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
                            <Badge variant={r.isOpening ? "default" : r.qtyIn > 0 ? "secondary" : "outline"}>{r.isOpening ? t("finance:moveType.opening") : moveText(t, r.type, r.typeLabel)}</Badge>
                            {r.backfilled && (
                              <WithTooltip content={t("finance:inventory.backfilledTip")}>
                                <Badge variant="outline" tabIndex={0}>{t("finance:inventory.backfilledCol")}</Badge>
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
                              {r.orderHref && <Link href={r.orderHref} className="text-primary hover:underline">{t("finance:col.order")}</Link>}
                              {r.ledgerHref && <Link href={r.ledgerHref} className="text-primary hover:underline">{t("finance:inventory.ledger")}</Link>}
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
              <SelectTrigger aria-label={t("common:fields.location")} className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>{t("finance:inventory.allLocations")}</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {cogs?.period?.from ? `${fmt.date(cogs.period.from)} – ${fmt.date(cogs.period.to)}` : filters.label}
              {cogs && cogs.context.channel !== "all" ? ` · ${channelLabel(t, cogs.context.channel, cogs.context.channelLabel)}` : ""}
            </span>
          </FilterBar>
          <section aria-label={t("finance:inventory.cogsAria")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {!cogs ? <TileSkeletons /> : <>
              <StatTile label={t("finance:kpi.revenue")} value={money(cogs.totals.revenue)} hint={t("common:count.orders", { count: cogs.totals.orders })} />
              <StatTile label={t("finance:kpi.cogs")} value={money(cogs.totals.cogs)} hint={t("finance:inventory.unitsSold", { count: cogs.totals.units, n: formatNumber(cogs.totals.units) })} />
              <StatTile label={t("finance:kpi.grossProfit")} value={<SignedMoney value={cogs.totals.grossProfit} format={money} positiveTone />} hint={t("finance:kpi.margin", { pct: pct(cogs.totals.marginPct) })} />
              <StatTile label={t("finance:inventory.cogsShare")} value={cogs.totals.revenue ? pct((cogs.totals.cogs / cogs.totals.revenue) * 100) : "—"} />
            </>}
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            {([["byCategory", t("finance:inventory.byCategory"), cogs?.byCategory, t("common:fields.category")], ["top", t("finance:inventory.topProducts"), cogs?.topProducts, t("common:fields.product")]] as const).map(([id, title, lines, col]) => (
              <SectionCard key={id} title={title} contentClassName="px-2">
                {!lines ? <Skeleton className="mx-2 h-40" /> : lines.length === 0 ? <p className="px-2 text-sm text-muted-foreground">{t("finance:inventory.noSales")}</p> : (
                  <div className="overflow-x-auto">
                    <Table className="min-w-[480px]">
                      <TableHeader>
                        <TableRow><TableHead>{col}</TableHead><TableHead className="text-right">{t("finance:col.units")}</TableHead><TableHead className="text-right">{t("finance:col.revenue")}</TableHead><TableHead className="text-right">{t("finance:col.cogs")}</TableHead><TableHead className="text-right">{t("finance:col.grossProfit")}</TableHead></TableRow>
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
          <SectionCard title={t("finance:inventory.tabCosts")} contentClassName="flex flex-col gap-4 px-2"
            description={t("finance:inventory.costsDesc")}
            actions={<AsOfNowLabel />}>
            <FilterBar className="px-2">
              <InputGroup className="w-full sm:w-64">
                <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
                <InputGroupInput aria-label={t("finance:inventory.searchCosts")} placeholder={t("finance:setCosts.searchPh")} value={cQ} onChange={(e) => setCQ(e.target.value)} />
              </InputGroup>
              {costs && <span className="text-sm text-muted-foreground">{t("finance:inventory.costsTotals", { count: costs.totals.products, n: formatNumber(costs.totals.products), amount: money(costs.totals.uncostedSales) })}</span>}
              {writable && opening && opening.totals.products > 0 && (
                <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => setWizard(true)}>{t("finance:inventory.setCostsMoveIn")}</Button>
              )}
            </FilterBar>
            {cErr && <Alert variant="destructive"><AlertDescription>{cErr}</AlertDescription></Alert>}
            {!costs ? <div className="flex flex-col gap-2 px-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div> : costs.rows.length === 0 ? (
              <EmptyState icon={Tag} title={t("finance:setCosts.allCostedTitle")} description={cQD ? t("finance:setCosts.noMatch") : t("finance:inventory.allCostedDesc")} />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common:fields.product")}</TableHead><TableHead className="text-right">{t("common:fields.stock")}</TableHead><TableHead className="text-right">{t("finance:setCosts.unitsSold")}</TableHead>
                      <TableHead className="text-right">{t("finance:overview.uncosted")}</TableHead><TableHead className="text-right">{t("common:money.price")}</TableHead><TableHead className="w-28"><span className="sr-only">{t("common:fields.actions")}</span></TableHead>
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
                          <Button asChild size="sm" variant="outline"><Link href={r.editHref ?? `/dashboard/products/${r.productId}`}>{t("finance:setCosts.setCost")}</Link></Button>
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
            <AlertDialogTitle>{t("finance:inventory.backfillQ")}</AlertDialogTitle>
            <AlertDialogDescription>
              {missing ? `${t("finance:inventory.backfillLines", { count: missing.lines, n: formatNumber(missing.lines), amount: money(missing.value) })} ` : ""}
              {t("finance:inventory.backfillDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={backfilling}>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); runBackfill() }} disabled={backfilling}>{backfilling ? t("finance:inventory.creating") : t("finance:inventory.createMovements")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
