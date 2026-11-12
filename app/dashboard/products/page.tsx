"use client"

import { Fragment, useState, useMemo, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Trans, useTranslation } from "react-i18next"
import Link from "next/link"
import {
  AlertTriangle, Banknote, Download, Eye, LayoutGrid, List, MessageSquare, MoreHorizontal, Package, PackageX, Pencil, Percent, Plus,
  Printer, Search, Trash2, Upload, X, Boxes,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionTitle } from "@/components/common/SectionTitle"
import { Toolbar } from "@/components/common/Toolbar"
import { BulkBar } from "@/components/common/BulkBar"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { StatusBadge } from "@/components/common/StatusBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { StatTile } from "@/components/common/StatTile"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { useToast } from "@/hooks/use-toast"
import { exportToCSV } from "@/lib/export-import-utils"
import { parseCsvRows } from "@/components/products/csv"
import { useProduct, convertToProduct, type Product } from "@/contexts/product-context"
import { useVendor } from "@/contexts/vendor-context"
import { useCategory } from "@/contexts/category-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { ProductFormDialog } from "./ProductFormDialog"
import { UpgradeRequiredModal } from "@/components/UpgradeRequiredModal"
import saasCompanyApi, { type PlanLimits } from "@/lib/saasCompanyApi"
import { cn } from "@/lib/utils"
import { localeTag } from "@/lib/i18n"
import productApi, { type ProductImportResult } from "@/lib/productApi"

type Tab = "all" | "ok" | "low" | "out" | "hidden"
type StockState = "ok" | "low" | "out"


// Reorder point 0 (or unset) means the low-stock alert is off.
const reorderOf = (p: Product) => (p.reorderPoint && p.reorderPoint > 0 ? p.reorderPoint : 0)
// The backend evaluates stock / state for the selected warehouse (bundles from child stock), so list rows already carry them.
const stockAt = (p: Product, _wh?: string): number => p.stock
const stockState = (p: Product, _wh?: string): StockState =>
  p.stockState ?? (p.stock <= 0 ? "out" : reorderOf(p) > 0 && p.stock <= reorderOf(p) ? "low" : "ok")
const qtyAt = (p: Product, loc: string): number =>
  p.stockByLocation?.find((l) => l.locationId === loc)?.quantity ?? p.inventory?.find((i) => String(i.warehouseId) === loc)?.quantity ?? 0
const offerFinalOf = (p: Product) =>
  p.offerPrice ? (p.offerType === "percentage" ? p.salePrice * (1 - p.offerPrice / 100) : p.salePrice - p.offerPrice) : null
const marginOf = (p: Product) => {
  const cost = Number(p.costPrice) || 0
  const sell = Number(p.salePrice) || 0
  if (cost <= 0 || sell <= 0) return null
  return Math.round(((sell - cost) / sell) * 100)
}

type Skipped = ProductImportResult["skipped"]

export default function ProductsPage() {
  const { products: allProducts, updateProduct, deleteProduct, refreshProducts } = useProduct()
  const router = useRouter()
  const { vendors } = useVendor()
  const { warehouses } = useWarehouse()
  const { categories, getAllCategoriesFlat } = useCategory()
  const { company, canWrite, canDelete, canDo } = useSaasAuth()
  const seeCost = canDo("cost")
  const mayExport = canDo("export")
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const { t, i18n } = useTranslation(["products", "common"])

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const urlQ = useSearchParams().get("q")
  useEffect(() => { if (urlQ) { setSearch(urlQ); setPage(1) } }, [urlQ]) // eslint-disable-line react-hooks/exhaustive-deps
  const [category, setCategory] = useState("all")
  const [vendor, setVendor] = useState("all")
  const [brand, setBrand] = useState("all")
  // Deep link from the Brands page: /dashboard/products?brand=<id|none>
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("brand")
    if (b) setBrand(b)
  }, [])
  const [warehouse, setWarehouse] = useState("all")
  const [sort, setSort] = useState("recent")
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [tabCounts, setTabCounts] = useState({ all: 0, ok: 0, low: 0, out: 0, hidden: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [perPage, setPerPage] = useState(10)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [viewing, setViewing] = useState<Product | null>(null)
  const [deleteTargets, setDeleteTargets] = useState<Product[]>([])
  const [deleting, setDeleting] = useState(false)
  const [view, setView] = useState<"table" | "grid">("table")
  const [priceOpen, setPriceOpen] = useState(false)
  const [priceMode, setPriceMode] = useState<"up" | "down">("up")
  const [priceValue, setPriceValue] = useState("")
  const [priceBusy, setPriceBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: Skipped; warnings?: { row: number; message: string }[] } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [adjustTargets, setAdjustTargets] = useState<Product[]>([])
  const [adjustQty, setAdjustQty] = useState("")
  const [adjustLoc, setAdjustLoc] = useState("")
  const [adjustVariant, setAdjustVariant] = useState("")
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const allCategories = useMemo(() => getAllCategoriesFlat(), [categories]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    saasCompanyApi.getPlanLimits().then(setPlanLimits).catch(() => {})
  }, [])

  const blocked = useModuleGuard("Products")

  const supplierName = (p: Product) => p.vendorName || vendors.find((v) => String(v.id) === String(p.vendorId))?.name

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const listParams = (extra?: Record<string, any>) => ({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(category !== "all" ? { categoryId: category } : {}),
    ...(vendor !== "all" ? { supplierId: vendor } : {}),
    ...(brand !== "all" ? { brandId: brand } : {}),
    ...(warehouse !== "all" ? { locationId: warehouse } : {}),
    tab,
    sort,
    ...extra,
  })

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    productApi.getAll(listParams({ page, limit: perPage }))
      .then((res) => {
        if (cancelled) return
        setItems((res.data ?? []).map(convertToProduct))
        setTotal(res.pagination?.total ?? 0)
        if (res.tabCounts) setTabCounts({ all: res.tabCounts.all, ok: res.tabCounts.ok, low: res.tabCounts.low, out: res.tabCounts.out, hidden: res.tabCounts.hidden })
      })
      .catch((e) => { if (!cancelled && e?.response?.status !== 403) toast({ variant: "destructive", title: t("products:list.loadFailed"), description: e?.response?.data?.message || e?.message }) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [debouncedSearch, category, vendor, brand, warehouse, tab, sort, page, perPage, reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Form saves / external refreshes update the shared context; re-pull this page's list when that happens.
  const firstSync = useRef(true)
  useEffect(() => {
    if (firstSync.current) { firstSync.current = false; return }
    setReloadKey((k) => k + 1)
  }, [allProducts])

  const reload = async () => { await refreshProducts() }

  const brandOptions = useMemo(() => {
    const m = new Map<string, string>()
    allProducts.forEach((p) => { if (p.brandId) m.set(p.brandId, p.brandName || t("products:list.brandFallback", { id: p.brandId })) })
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [allProducts, t])

  const counts = tabCounts

  const kpi = useMemo(() => {
    const qty = (p: Product) => (warehouse === "all" ? p.stock : qtyAt(p, warehouse))
    const value = allProducts.reduce((a, p) => a + (Number(p.costPrice) || 0) * Math.max(0, qty(p)), 0)
    const margins = allProducts.map(marginOf).filter((m): m is number => m !== null)
    const avg = margins.length ? Math.round(margins.reduce((a, b) => a + b, 0) / margins.length) : null
    const variants = allProducts.reduce((a, p) => a + (p.variants?.length ?? 0), 0)
    return { value, avg, variants }
  }, [allProducts, warehouse])

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.min(page, totalPages)
  const rows = items
  const filtered = { length: total }

  if (blocked) return blocked

  const hasFilters = !!(search || category !== "all" || vendor !== "all" || brand !== "all" || warehouse !== "all" || tab !== "all")
  const changeTab = (next: string) => { setTab(next as Tab); setPage(1); setChecked(new Set()) }
  const resetFilters = () => {
    setSearch(""); setCategory("all"); setVendor("all"); setBrand("all"); setWarehouse("all"); setTab("all"); setPage(1); setChecked(new Set())
  }

  const allChecked = rows.length > 0 && rows.every((p) => checked.has(p.id))
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map((p) => p.id)))
  const toggleOne = (id: string) =>
    setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selected = items.filter((p) => checked.has(p.id))

  const openForm = (p?: Product | null) => { setEditing(p ?? null); setFormOpen(true) }
  const closeForm = () => { setFormOpen(false); setEditing(null) }

  const handleAdd = () => {
    const atLimit = planLimits ? !planLimits.canAddProduct : company?.maxProducts ? allProducts.length >= company.maxProducts : false
    if (atLimit) setUpgradeOpen(true)
    else openForm(null)
  }

  const setPublished = async (targets: Product[], published: boolean) => {
    const results = await Promise.allSettled(targets.map((p) => updateProduct({ ...p, published })))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: t("products:list.bulk.someFailed"), description: t("products:list.bulk.failedOf", { failed, total: targets.length }) })
    else toast({ title: published ? t("products:list.bulk.shownOnline") : t("products:shared.hiddenOnline"), description: t("products:list.bulk.updated", { count: targets.length }) })
    setChecked(new Set())
    setReloadKey((k) => k + 1)
  }

  const applyBulkPrice = async () => {
    const v = Number(priceValue)
    const percent = priceMode === "down" ? -v : v
    if (!Number.isFinite(v) || !(v > 0) || percent <= -100) {
      toast({ variant: "destructive", title: t("products:price.invalidTitle"), description: t("products:price.invalidDesc") })
      return
    }
    setPriceBusy(true)
    try {
      const r = await productApi.bulkPrice(selected.map((p) => Number(p.id)), percent)
      await reload()
      const repriced = t("common:count.products", { count: r.count })
      toast({
        title: t("products:price.doneTitle"),
        description: r.variantsUpdated
          ? t("products:price.doneDescVariants", { products: repriced, variants: t("products:shared.variantCount", { count: r.variantsUpdated }) })
          : t("products:price.doneDesc", { products: repriced }),
      })
      setPriceOpen(false)
      setPriceValue("")
      setChecked(new Set())
    } catch (e: any) {
      toast({ variant: "destructive", title: t("products:price.failed"), description: e?.response?.data?.message || e?.message || t("common:actions.retry") })
    } finally {
      setPriceBusy(false)
    }
  }

  const openAdjust = (targets: Product[]) => {
    const def = warehouses.find((w) => w.isDefault) ?? warehouses[0]
    setAdjustLoc(warehouse !== "all" ? warehouse : def ? String(def.id) : "")
    setAdjustQty("")
    setAdjustVariant(targets.length === 1 && targets[0].variants?.length ? targets[0].variants[0].id : "")
    setAdjustTargets(targets)
  }

  const applyAdjust = async () => {
    const delta = Number(adjustQty)
    if (!Number.isInteger(delta) || delta === 0) {
      toast({ variant: "destructive", title: t("products:adjust.qtyInvalidTitle"), description: t("products:adjust.qtyInvalidDesc") })
      return
    }
    if (!adjustLoc) { toast({ variant: "destructive", title: t("products:adjust.pickLocation") }); return }
    const single = adjustTargets.length === 1 ? adjustTargets[0] : null
    if (single && delta < 0 && !single.variants?.length && qtyAt(single, adjustLoc) + delta < 0) {
      toast({ variant: "destructive", title: t("products:adjust.notEnoughTitle"), description: t("products:adjust.notEnoughDesc", { name: single.name }) })
      return
    }
    setAdjustBusy(true)
    try {
      const r = await productApi.adjustStock({
        reason: adjustTargets.length > 1 ? "Bulk adjust" : "Quick adjust",
        items: adjustTargets.map((p) => ({
          productId: Number(p.id),
          ...(single && adjustVariant ? { variantId: Number(adjustVariant) } : {}),
          locationId: Number(adjustLoc),
          delta,
        })),
      })
      await reload()
      if (r.failed.length) {
        const nameOf = (i: number) => adjustTargets[i]?.name ?? `#${r.failed[i]?.productId}`
        toast({ variant: "destructive", title: t("products:adjust.partial", { adjusted: r.adjusted, failed: r.failed.length }), description: r.failed.slice(0, 3).map((f) => `${nameOf(f.index)}: ${f.reason}`).join(" · ") })
      } else {
        toast({ title: t("products:adjust.doneTitle"), description: t("products:adjust.doneDesc", { products: t("common:count.products", { count: r.adjusted }), delta: `${delta > 0 ? "+" : ""}${delta}` }) })
        setAdjustTargets([])
        setChecked(new Set())
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: t("products:adjust.failed"), description: e?.response?.data?.message || e?.message || t("common:actions.retry") })
    } finally {
      setAdjustBusy(false)
    }
  }

  const printBarcodes = (targets: Product[]) => {
    router.push(`/dashboard/products/print-barcode?ids=${targets.map((p) => p.id).join(",")}`)
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const results = await Promise.allSettled(deleteTargets.map((p) => deleteProduct(p.id)))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: t("products:remove.someFailed"), description: t("products:remove.failedOf", { failed, total: deleteTargets.length }) })
    else toast({ title: t("common:status.deleted"), description: t("products:remove.removed", { count: deleteTargets.length }) })
    setDeleting(false)
    setDeleteTargets([])
    setChecked(new Set())
    setReloadKey((k) => k + 1)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      // Selected rows, else every filtered row across all pages (fresh from the server).
      let source = selected
      if (!source.length) {
        source = []
        for (let pg = 1; pg <= 50; pg++) {
          const res = await productApi.getAll(listParams({ page: pg, limit: 1000 }))
          source.push(...(res.data ?? []).map(convertToProduct))
          if (!res.pagination?.has_next) break
        }
      }
      exportToCSV(
        source.map((p) => ({
          name: p.name, sku: p.sku || "", barcode: p.barcode || "", category: p.category || "", brand: p.brandName || "",
          supplier: supplierName(p) || "", unit: p.unitName || "", cost: seeCost ? (p.costPrice ?? "") : "", price: p.salePrice,
          offer: p.offerPrice ? `${p.offerPrice}${p.offerType === "percentage" ? "%" : ""}` : "",
          stock: String(p.stock), reorder: String(reorderOf(p)), status: p.status, published: p.published ? "Yes" : "No",
          description: p.description || "",
        })),
        "products",
        // CSV headers stay English: Import reads them back as column keys.
        ["Name", "SKU", "Barcode", "Category", "Brand", "Supplier", "Unit", "Cost", "Price", "Offer", "Stock", "Reorder", "Status", "Published", "Description"],
      )
    } catch (e: any) {
      toast({ variant: "destructive", title: t("products:exportFailed"), description: e?.message || t("common:actions.retry") })
    } finally {
      setExporting(false)
    }
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const data = parseCsvRows(ev.target?.result as string)
      if (!data.length) { toast({ variant: "destructive", title: t("products:import.noRowsTitle"), description: t("products:import.noRowsDesc") }); return }
      setImportBusy(true)
      try {
        const result = await productApi.importRows(data)
        setImportResult({ ...result, skipped: result.skipped.map((r) => ({ ...r, name: r.name ?? data[r.row - 1]?.name })) })
        await reload()
        toast({ title: t("products:import.result", { imported: result.imported, skipped: result.skipped.length }) })
      } catch (err: any) {
        toast({ variant: "destructive", title: t("products:import.failed"), description: err?.response?.data?.message || err?.message || t("common:actions.retry") })
      } finally {
        setImportBusy(false)
      }
    }
    reader.readAsText(file)
  }

  const money = (n: number) => formatCurrency(n || 0)

  const emptyState = (
    <EmptyState
      icon={Boxes}
      title={t("products:list.empty.title")}
      description={hasFilters ? t("products:list.empty.filtered") : t("products:list.empty.first")}
      action={(hasFilters || canWrite("Products")) ? (
        <div className="flex justify-center gap-2">
          {hasFilters && <Button type="button" variant="outline" onClick={resetFilters}>{t("common:actions.clearFilters")}</Button>}
          {canWrite("Products") && (
            <Button type="button" onClick={handleAdd}>
              <Plus className="size-4" aria-hidden /> {t("products:shared.addProduct")}
            </Button>
          )}
        </div>
      ) : undefined}
    />
  )
  const stockStatus = (st: StockState) => (st === "out" ? "out of stock" : st === "low" ? "low stock" : "in stock")

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      {/* Header */}
      <PageHeader
        title={t("products:list.title")}
        description={<>
          {t("products:list.description")}
          {planLimits && <span className="ml-1 tabular-nums">{t("products:list.planUsage", { used: planLimits.currentProducts, max: planLimits.maxProducts })}</span>}
        </>}
        actions={<>
          <Button asChild variant="outline">
            <Link href="/dashboard/products/print-barcode">
              <Printer className="size-4" aria-hidden /> {t("products:shared.printBarcodes")}
            </Link>
          </Button>
          {canWrite("Products") && (
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" aria-hidden /> {t("common:actions.import")}
            </Button>
          )}
          {mayExport && <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="size-4" aria-hidden /> {exporting ? t("products:list.exporting") : t("common:actions.export")}
          </Button>}
          {canWrite("Products") && (
            <Button type="button" onClick={handleAdd}>
              <Plus className="size-4" aria-hidden /> {t("products:shared.addProduct")}
            </Button>
          )}
        </>}
      />

      {/* KPIs */}
      {isLoading && items.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[118px] rounded-xl" />)}
        </div>
      ) : (
        <StatsCards stats={[
          { label: t("products:list.title"), value: counts.all, icon: <Package className="size-4" />, color: "blue",
            hint: `${t("products:shared.variantCount", { count: kpi.variants })} · ${t("products:list.kpi.categoryCount", { count: allCategories.length })}` },
          { label: t("products:list.kpi.inventoryValue"), value: money(kpi.value), icon: <Banknote className="size-4" />, color: "green", hint: warehouse === "all" ? t("products:list.kpi.atCostAll") : t("products:list.kpi.atCostIn", { warehouse: warehouses.find((w) => String(w.id) === warehouse)?.name ?? t("products:list.kpi.warehouseFallback") }) },
          { label: t("products:shared.lowStock"), value: counts.low, icon: <AlertTriangle className="size-4" />, color: "yellow", hint: t("products:list.kpi.lowStockHint"),
            onClick: () => changeTab("low"), active: tab === "low" },
          { label: t("products:shared.outOfStock"), value: counts.out, icon: <PackageX className="size-4" />, color: "red", hint: t("products:list.kpi.outOfStockHint"),
            onClick: () => changeTab("out"), active: tab === "out" },
          { label: t("products:list.kpi.avgMargin"), value: kpi.avg === null ? "—" : `${kpi.avg}%`, icon: <Percent className="size-4" />, color: "purple", hint: t("products:list.kpi.avgMarginHint") },
        ]} />
      )}

      <Card className="min-w-0 gap-0 py-0">
        <div className="px-4">
          <StatusTabs
            value={tab}
            onChange={changeTab}
            tabs={[
              { value: "all", label: t("common:status.all"), count: counts.all },
              { value: "ok", label: t("products:shared.inStock"), count: counts.ok },
              { value: "low", label: t("products:shared.lowStock"), count: counts.low },
              { value: "out", label: t("products:shared.outOfStock"), count: counts.out },
              { value: "hidden", label: t("products:shared.hiddenOnline"), count: counts.hidden },
            ]}
          />
        </div>

        <Toolbar className="p-4" actions={
          <div role="radiogroup" aria-label={t("products:list.view.label")} className="flex gap-1">
            {([["table", t("products:list.view.table"), List], ["grid", t("products:list.view.grid"), LayoutGrid]] as const).map(([id, label, Icon]) => (
              <WithTooltip key={id} content={label}>
                <Button type="button" size="icon" variant={view === id ? "default" : "outline"} role="radio" aria-checked={view === id} aria-label={label} onClick={() => setView(id)}>
                  <Icon className="size-4" aria-hidden />
                </Button>
              </WithTooltip>
            ))}
          </div>
        }>
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="product-search" className="sr-only">{t("products:shared.searchProducts")}</Label>
            <Input id="product-search" type="search" placeholder={t("products:list.filters.searchPlaceholder")} value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-8" />
          </div>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
            <SelectTrigger aria-label={t("common:fields.category")} className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("products:list.filters.categoryAll")}</SelectItem>
              <SelectItem value="none">{t("products:shared.noCategory")}</SelectItem>
              {allCategories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.parent_id !== null ? `└ ${c.category_name}` : c.category_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vendor} onValueChange={(v) => { setVendor(v); setPage(1) }}>
            <SelectTrigger aria-label={t("products:shared.supplier")} className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("products:list.filters.supplierAll")}</SelectItem>
              <SelectItem value="none">{t("products:list.filters.supplierNone")}</SelectItem>
              {vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={(v) => { setBrand(v); setPage(1) }}>
            <SelectTrigger aria-label={t("products:shared.brand")} className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("products:list.filters.brandAll")}</SelectItem>
              <SelectItem value="none">{t("products:shared.noBrand")}</SelectItem>
              {brandOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={warehouse} onValueChange={(v) => { setWarehouse(v); setPage(1) }}>
            <SelectTrigger aria-label={t("common:fields.warehouse")} className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("products:list.filters.warehouseAll")}</SelectItem>
              {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1) }}>
            <SelectTrigger aria-label={t("products:list.filters.sort")} className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">{t("products:list.filters.sortRecent")}</SelectItem>
              <SelectItem value="name">{t("products:list.filters.sortName")}</SelectItem>
              <SelectItem value="price-asc">{t("products:list.filters.sortPriceAsc")}</SelectItem>
              <SelectItem value="price-desc">{t("products:list.filters.sortPriceDesc")}</SelectItem>
              <SelectItem value="stock-asc">{t("products:list.filters.sortStockAsc")}</SelectItem>
              <SelectItem value="stock-desc">{t("products:list.filters.sortStockDesc")}</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <X className="size-4" aria-hidden /> {t("common:actions.clear")}
            </Button>
          )}
        </Toolbar>

        <BulkBar count={checked.size} label={t("common:table.selected", { count: checked.size })} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
            {canWrite("Products") && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => setPublished(selected, true)}>{t("products:list.bulk.showOnline")}</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPublished(selected, false)}>{t("products:list.bulk.hideOnline")}</Button>
              </>
            )}
            {canWrite("Products") && <Button type="button" variant="outline" size="sm" onClick={() => setPriceOpen(true)}>{t("products:list.bulk.updatePrice")}</Button>}
            {canWrite("Products") && <Button type="button" variant="outline" size="sm" onClick={() => openAdjust(selected)}>{t("products:shared.adjustStock")}</Button>}
            <Button type="button" variant="outline" size="sm" onClick={() => printBarcodes(selected)}>{t("products:shared.printBarcodes")}</Button>
            {mayExport && <Button type="button" variant="outline" size="sm" onClick={handleExport}>{t("products:list.bulk.exportSelected")}</Button>}
            {canDelete("Products") && (
              <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTargets(selected)}>{t("common:actions.delete")}</Button>
            )}
        </BulkBar>

        {view === "grid" ? (
          <div className="grid gap-3 p-4 pt-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isLoading && items.length === 0 ? (
              [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)
            ) : rows.length === 0 ? (
              <div className="col-span-full">{emptyState}</div>
            ) : rows.map((p) => {
              const st = stockState(p, warehouse)
              const gStock = stockAt(p, warehouse)
              const gMargin = marginOf(p)
              const offer = offerFinalOf(p)
              const ck = checked.has(p.id)
              return (
                <Card key={p.id} className={cn("gap-2.5 p-3", ck && "border-primary")}>
                  <div className="flex items-start justify-between gap-2">
                    <Checkbox checked={ck} onCheckedChange={() => toggleOne(p.id)} aria-label={t("products:list.row.select", { name: p.name })} />
                    <Switch checked={p.published} aria-label={t("products:list.row.showOnline", { name: p.name })} disabled={!canWrite("Products")}
                      onCheckedChange={() => setPublished([p], !p.published)} />
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setViewing(p)} className="h-auto flex-col items-stretch gap-2 whitespace-normal p-0 text-left font-normal">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image || "/placeholder.svg"} alt="" className="aspect-[4/3] w-full rounded-md bg-muted object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="truncate">{p.name}</span>
                      {p.isBundle && <Badge variant="secondary">{t("products:shared.bundle")}</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">{p.sku || t("products:list.row.noSku")} · {p.category || "—"}{p.brandName ? ` · ${p.brandName}` : ""}</span>
                  </Button>
                  <div className="mt-auto flex items-end justify-between">
                    <span className="font-bold tabular-nums">{money(offer ?? p.salePrice)}</span>
                    <StatusBadge status={stockStatus(st)} className="tabular-nums"
                      label={st === "out" ? t("products:shared.outOfStock") : t(st === "low" ? "products:list.row.qtyLow" : "products:list.row.qtyInStock", { qty: `${gStock}${p.unitName ? ` ${p.unitName}` : ""}` })} />
                  </div>
                  {seeCost && gMargin !== null && <div className="text-xs text-muted-foreground tabular-nums">{t("products:list.row.marginValue", { value: gMargin })}</div>}
                  <div className="flex gap-2">
                    {canWrite("Products") && (
                      <Button type="button" variant="outline" onClick={() => openForm(p)} className="flex-1">{t("common:actions.edit")}</Button>
                    )}
                    {canDelete("Products") && (
                      <WithTooltip content={t("products:list.row.deleteName", { name: p.name })}><Button type="button" variant="outline" size="icon" aria-label={t("products:list.row.deleteName", { name: p.name })} onClick={() => setDeleteTargets([p])}><Trash2 className="size-4" /></Button></WithTooltip>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
        <div>
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-5 pl-4"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label={t("products:list.table.selectAllPage")} /></TableHead>
                <TableHead scope="col">{t("common:fields.product")}</TableHead>
                <TableHead scope="col">{t("common:fields.category")}</TableHead>
                {seeCost && <TableHead scope="col" className="text-right">{t("common:money.cost")}</TableHead>}
                <TableHead scope="col" className="text-right">{t("common:money.price")}</TableHead>
                {seeCost && <TableHead scope="col">{t("products:shared.margin")}</TableHead>}
                <TableHead scope="col">{t("common:fields.stock")}</TableHead>
                <TableHead scope="col">{t("products:list.table.online")}</TableHead>
                <TableHead scope="col" className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && items.length === 0 ? (
                [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={9} className="px-4"><Skeleton className="h-12 rounded" /></TableCell></TableRow>)
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={9}>{emptyState}</TableCell>
                </TableRow>
              ) : (
                rows.map((p) => {
                  const st = stockState(p, warehouse)
                  const rowStock = stockAt(p, warehouse)
                  const ck = checked.has(p.id)
                  const margin = marginOf(p)
                  const offer = offerFinalOf(p)
                  const rop = reorderOf(p)
                  const unit = p.unitName ? ` ${p.unitName}` : ""
                  const sup = supplierName(p)
                  return (
                    <TableRow key={p.id} data-state={ck ? "selected" : undefined}>
                      <TableCell className="pl-4">
                        <Checkbox checked={ck} onCheckedChange={() => toggleOne(p.id)} aria-label={t("products:list.row.select", { name: p.name })} />
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" onClick={() => setViewing(p)} className="h-auto justify-start gap-2.5 p-0 text-left font-normal">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <UserAvatar shape="square" src={p.image || "/placeholder.svg"} alt="" name={p.name} className="size-10" />
                          <span className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-1.5 font-semibold">
                              <span className="max-w-[220px] truncate">{p.name}</span>
                              {p.isBestSeller && <Badge variant="secondary">{t("products:shared.bestSeller")}</Badge>}
                              {p.isHotDeal && <Badge variant="destructive">{t("products:shared.hotDeal")}</Badge>}
                              {p.tag && <Badge variant="outline">{p.tag}</Badge>}
                              {p.isBundle && <Badge variant="secondary">{t("products:shared.bundle")}</Badge>}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {p.sku || t("products:list.row.noSku")}{p.variants && p.variants.length > 0 ? ` · ${t("products:shared.variantCount", { count: p.variants.length })}` : ""}
                            </span>
                          </span>
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div>{p.category || "—"}</div>
                        {p.brandName && <div className="text-xs text-muted-foreground">{p.brandName}</div>}
                        {sup && <div className="text-xs text-muted-foreground">{sup}</div>}
                      </TableCell>
                      {seeCost && <TableCell className="text-right tabular-nums text-muted-foreground">
                        {p.costPrice ? money(p.costPrice) : "—"}
                      </TableCell>}
                      <TableCell className="text-right font-bold tabular-nums">
                        {money(offer ?? p.salePrice)}
                        {offer !== null && (
                          <div className="text-xs font-normal text-muted-foreground">
                            <span className="line-through">{money(p.salePrice)}</span>{" "}
                            <span className="font-semibold text-foreground">
                              {t("products:list.row.off", { value: p.offerType === "percentage" ? `${p.offerPrice}%` : money(p.offerPrice!) })}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      {seeCost && <TableCell>
                        {margin === null ? <span className="text-muted-foreground/60">—</span> : (
                          <Badge variant={margin >= 35 ? "secondary" : "outline"} className="tabular-nums">
                            {margin}%
                          </Badge>
                        )}
                      </TableCell>}
                      <TableCell>
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <span className={cn("font-bold", st === "out" && "text-destructive")}>
                            {st === "out" ? t("products:shared.outOfStock") : `${rowStock}${unit}`}
                          </span>
                          {st === "low" && <StatusBadge status="low stock" label={t("products:list.row.low")} />}
                        </div>
                        {rop > 0 && <Progress aria-hidden className="mt-1 h-1.5 w-24"
                          value={Math.min(100, Math.round((Math.max(0, rowStock) / (rop * 4)) * 100))} />}
                        <div className="mt-1 text-xs text-muted-foreground tabular-nums">{rop > 0 ? t("products:list.row.reorderAt", { qty: `${rop}${unit}` }) : t("products:list.row.noReorder")}</div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={p.published} aria-label={t("products:list.row.showOnline", { name: p.name })}
                          disabled={!canWrite("Products")}
                          onCheckedChange={() => setPublished([p], !p.published)} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          <WithTooltip content={t("products:list.row.viewName", { name: p.name })}><Button type="button" variant="outline" size="icon" aria-label={t("products:list.row.viewName", { name: p.name })} onClick={() => setViewing(p)}><Eye className="size-4" /></Button></WithTooltip>
                          {canWrite("Products") && (
                            <WithTooltip content={t("products:list.row.editName", { name: p.name })}><Button type="button" variant="outline" size="icon" aria-label={t("products:list.row.editName", { name: p.name })} onClick={() => openForm(p)}><Pencil className="size-4" /></Button></WithTooltip>
                          )}
                          <DropdownMenu>
                            <WithTooltip content={t("products:list.row.moreFor", { name: p.name })}><DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="icon" aria-label={t("products:list.row.moreFor", { name: p.name })}><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger></WithTooltip>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewing(p)}>{t("products:list.row.viewDetails")}</DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/products/${p.id}/reviews`}><MessageSquare className="size-4" /> {t("products:list.row.reviews")}</Link>
                              </DropdownMenuItem>
                              {canWrite("Products") && (
                                <DropdownMenuItem onClick={() => openAdjust([p])}><Package className="size-4" /> {t("products:shared.adjustStock")}</DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => printBarcodes([p])}><Printer className="size-4" /> {t("products:shared.printBarcode")}</DropdownMenuItem>
                              {canDelete("Products") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargets([p])}>
                                    <Trash2 className="size-4" /> {t("products:shared.deleteProduct")}
                                  </DropdownMenuItem>
                                </>
                              )}
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
        </div>
        )}

        {!(isLoading && items.length === 0) && filtered.length > 0 && (
          <>
          <Separator />
          <div className="p-4 pt-3">
            <p className="mb-2 text-xs text-muted-foreground tabular-nums">
              {t("products:list.footer", { shown: rows.length, total: filtered.length, value: money(kpi.value) })}
            </p>
            <PaginationControl
              currentPage={safePage}
              totalPages={totalPages}
              itemsPerPage={perPage}
              totalItems={filtered.length}
              onPageChange={(n) => { setPage(n); setChecked(new Set()) }}
              onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
            />
          </div>
          </>
        )}
      </Card>

      <ProductFormDialog open={formOpen} editingProduct={editing} onClose={closeForm} />

      {/* Bulk price update */}
      <Dialog open={priceOpen} onOpenChange={(o) => !o && setPriceOpen(false)}>
        <DialogContent className="border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-dash-display text-xl font-bold">{t("products:price.title")}</DialogTitle>
            <DialogDescription>{t("products:price.description", { count: selected.length })}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div role="radiogroup" aria-label={t("products:price.changeType")} className="grid grid-cols-2 gap-2">
              {([["up", t("products:price.increase")], ["down", t("products:price.decrease")]] as const).map(([id, label]) => (
                <Button key={id} type="button" variant={priceMode === id ? "default" : "outline"} role="radio" aria-checked={priceMode === id} onClick={() => setPriceMode(id)}>{label}</Button>
              ))}
            </div>
            <FormField label={t("products:price.percentage")} htmlFor="bulk-price-pct">
              <Input id="bulk-price-pct" type="number" min={0} step="any" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} placeholder={t("products:price.placeholder")} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPriceOpen(false)}>{t("common:actions.cancel")}</Button>
            <Button type="button" disabled={priceBusy} onClick={applyBulkPrice}>{priceBusy ? t("products:price.updating") : t("common:actions.apply")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View details */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-2xl">
          {viewing && (() => {
            const offer = offerFinalOf(viewing)
            const st = stockState(viewing, warehouse)
            const vStock = stockAt(viewing, warehouse)
            const whLabel = warehouse === "all" ? t("products:details.allLocations") : warehouses.find((w) => String(w.id) === warehouse)?.name
            const m = marginOf(viewing)
            const sell = offer ?? viewing.salePrice
            const cost = Number(viewing.costPrice) || 0
            const sections: { title: string; rows: [string, string | null][] }[] = [
              {
                title: t("products:details.sectionDetails"),
                rows: [
                  [t("common:fields.category"), viewing.category || null],
                  [t("products:shared.brand"), viewing.brandName || null],
                  [t("products:shared.supplier"), supplierName(viewing) || null],
                  [t("products:shared.unit"), viewing.unitName || null],
                  [t("common:fields.location"), viewing.locationName || warehouses.find((w) => String(w.id) === viewing.locationId)?.name || null],
                ],
              },
              {
                title: t("products:details.sectionCodes"),
                rows: [
                  [t("common:fields.sku"), viewing.sku || null],
                  [t("common:fields.barcode"), viewing.barcode || null],
                  [t("products:shared.barcodeType"), viewing.barcodeType || null],
                  [t("products:details.tracking"), viewing.trackingType === "serial" ? t("products:details.trackingSerial") : viewing.trackingType === "batch" ? t("products:details.trackingBatch") : t("products:shared.quantityOnly")],
                  [t("products:details.reorderAlert"), reorderOf(viewing) > 0 ? t("products:details.reorderAt", { qty: reorderOf(viewing) }) : t("products:details.off")],
                ],
              },
            ]
            const extras: [string, string][] = [
              ...(offer !== null ? [[t("products:details.regularSalePrice"), money(viewing.salePrice)] as [string, string]] : []),
              ...(viewing.offerEndsAt ? [[t("products:shared.offerEnds"), new Date(viewing.offerEndsAt).toLocaleDateString(localeTag(i18n.language))] as [string, string]] : []),
              ...(viewing.wholesalePrice ? [[t("products:details.wholesale"), viewing.minWholesaleQty ? t("products:details.wholesaleMin", { price: money(viewing.wholesalePrice), qty: viewing.minWholesaleQty }) : money(viewing.wholesalePrice)] as [string, string]] : []),
              ...(viewing.isBundle && viewing.bundlePriceOverride ? [[t("products:details.bundlePrice"), money(viewing.bundlePriceOverride)] as [string, string]] : []),
              ...(viewing.receiptNumber ? [[t("products:shared.receiptNo"), viewing.receiptNumber] as [string, string]] : []),
            ]
            if (extras.length > 0) sections.push({ title: t("products:details.sectionPricing"), rows: extras })
            const tile = "gap-1 p-3.5 shadow-none"
            const tileValue = "block truncate text-lg"
            return (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-4">
                    <UserAvatar shape="square" src={viewing.image && viewing.image !== "/placeholder.svg" ? viewing.image : null} alt="" name={viewing.name}
                      fallback={<Package className="size-7 text-muted-foreground" aria-hidden />} className="size-20 shrink-0" />
                    <div className="min-w-0 text-left">
                      <DialogTitle className="font-dash-display text-xl font-bold">{viewing.name}</DialogTitle>
                      <DialogDescription className={viewing.description ? "line-clamp-2" : "sr-only"}>{viewing.description || t("products:details.productDetails")}</DialogDescription>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusBadge status={stockStatus(st)} label={st === "ok" ? t("products:shared.inStock") : st === "low" ? t("products:shared.lowStock") : t("products:shared.outOfStock")} />
                        <Badge variant="outline">{viewing.published ? t("products:shared.online") : t("products:shared.hiddenOnline")}</Badge>
                        {viewing.isBestSeller && <Badge variant="secondary">{t("products:shared.bestSeller")}</Badge>}
                        {viewing.isHotDeal && <Badge variant="destructive">{t("products:shared.hotDeal")}</Badge>}
                        {viewing.tag && <Badge variant="outline">{viewing.tag}</Badge>}
                        {viewing.isFeatured && <Badge>{t("products:shared.featured")}</Badge>}
                      </div>
                    </div>
                  </div>
                </DialogHeader>
                <div className={cn("grid grid-cols-2 gap-3", seeCost && "sm:grid-cols-4")}>
                  <StatTile className={tile} label={offer !== null ? t("products:details.offerPrice") : t("products:shared.sellingPrice")} icon={<Banknote aria-hidden />}
                    value={<span className={tileValue}>{money(sell)}</span>}
                    hint={viewing.price > sell
                      ? <Trans t={t} i18nKey="products:details.listPrice" values={{ price: money(viewing.price) }} components={{ s: <s className="tabular-nums" /> }} />
                      : t("products:details.sameAsList")} />
                  <StatTile label={t("products:shared.inStock")} icon={<Boxes aria-hidden />}
                    className={cn(tile, st === "out" && "border-dash-danger-soft bg-dash-danger-soft", st === "low" && "border-dash-warn-soft bg-dash-warn-soft")}
                    value={<span className={tileValue}>{vStock}{viewing.unitName ? ` ${viewing.unitName}` : ""}</span>}
                    hint={<span className="block truncate capitalize">{whLabel}</span>} />
                  {seeCost && (
                    <StatTile className={tile} label={t("common:money.cost")} icon={<Package aria-hidden />}
                      value={<span className={tileValue}>{cost > 0 ? money(cost) : t("products:shared.notSet")}</span>}
                      hint={t("products:details.perUnit")} />
                  )}
                  {seeCost && (
                    <StatTile className={tile} label={t("products:shared.margin")} icon={<Percent aria-hidden />}
                      value={<span className={tileValue}>{m === null ? "—" : `${m}%`}</span>}
                      hint={m === null ? t("products:details.addCostHint") : t("products:details.perUnitAmount", { amount: money(viewing.salePrice - cost) })} />
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {sections.map((s) => (
                    <div key={s.title} className="min-w-0">
                      <SectionTitle className="mb-2">{s.title}</SectionTitle>
                      <Card className="gap-0 py-0 shadow-none">
                        <InfoList className="gap-0 divide-y divide-dash-border-soft">
                          {s.rows.map(([k, v]) => (
                            <InfoRow key={k} className="px-3.5 py-2.5" label={k}
                              value={v ? <span className="break-all tabular-nums">{v}</span> : <span className="font-normal text-muted-foreground">{t("products:shared.notSet")}</span>} />
                          ))}
                        </InfoList>
                      </Card>
                    </div>
                  ))}
                </div>
                {(viewing.gallery?.length ?? 0) > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {viewing.gallery!.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt="" className="size-16 shrink-0 rounded-md bg-muted object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
                    ))}
                  </div>
                )}
                {viewing.isBundle && (viewing.bundleItems?.length ?? 0) > 0 && (
                  <div>
                    <SectionTitle className="mb-2">{t("products:details.bundleContents")}</SectionTitle>
                    <Card className="gap-0 py-0">
                      <ItemGroup>
                        {viewing.bundleItems!.map((bi, i) => (
                          <Fragment key={bi.id ?? i}>
                            {i > 0 && <ItemSeparator />}
                            <Item role="listitem" size="sm" className="justify-between">
                              <ItemTitle>{bi.productName}{bi.variantName ? ` · ${bi.variantName}` : ""}</ItemTitle>
                              <span className="text-muted-foreground tabular-nums">× {bi.quantity}</span>
                            </Item>
                          </Fragment>
                        ))}
                      </ItemGroup>
                    </Card>
                  </div>
                )}
                {viewing.variants && viewing.variants.length > 0 && (
                  <div>
                    <SectionTitle className="mb-2">{t("products:details.variantsCount", { n: viewing.variants.length })}</SectionTitle>
                    <Card className="gap-0 overflow-x-auto py-0">
                      <Table className="min-w-[460px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead scope="col">{t("common:fields.variant")}</TableHead>
                            <TableHead scope="col">{t("common:fields.sku")}</TableHead>
                            <TableHead scope="col" className="text-right">{t("common:money.price")}</TableHead>
                            <TableHead scope="col" className="text-right">{t("common:fields.stock")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {viewing.variants.map((v) => (
                            <TableRow key={v.id}>
                              <TableCell className="font-semibold">{v.name}</TableCell>
                              <TableCell className="text-muted-foreground">{v.sku || "—"}</TableCell>
                              <TableCell className="text-right tabular-nums">{money(v.salePrice || v.price)}</TableCell>
                              <TableCell className={cn("text-right font-bold tabular-nums", v.stock <= 0 && "text-destructive")}>{v.stock}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Card>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setViewing(null)}>{t("common:actions.close")}</Button>
                  <Button type="button" variant="outline" onClick={() => printBarcodes([viewing])}>
                    <Printer className="size-4" aria-hidden /> {t("products:shared.printBarcode")}
                  </Button>
                  {canWrite("Products") && (
                    <Button type="button" onClick={() => { const p = viewing; setViewing(null); openForm(p) }}>
                      <Pencil className="size-4" aria-hidden /> {t("products:shared.editProduct")}
                    </Button>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setImportResult(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-dash-display text-xl font-bold">{t("products:import.title")}</DialogTitle>
            <DialogDescription>{t("products:import.description")}</DialogDescription>
          </DialogHeader>
          <Input ref={fileRef} type="file" accept=".csv" onChange={handleImport} disabled={importBusy} aria-label={t("products:import.csvFile")} className="w-full" />
          {importBusy && <p className="text-sm text-muted-foreground">{t("products:import.importing")}</p>}
          {importResult && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">{t("products:import.result", { imported: importResult.imported, skipped: importResult.skipped.length })}</p>
              {(importResult.warnings?.length ?? 0) > 0 && (
                <Alert>
                  <AlertTriangle />
                  <AlertDescription>
                    <ul className="max-h-32 w-full space-y-1 overflow-y-auto text-xs">
                      {importResult.warnings!.map((w, i) => <li key={i}>{t("products:import.rowMessage", { row: w.row, message: w.message })}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {importResult.skipped.length > 0 && (
                <Card className="max-h-48 gap-0 overflow-y-auto py-0">
                  <ItemGroup>
                    {importResult.skipped.map((r, i) => (
                      <Fragment key={i}>
                        {i > 0 && <ItemSeparator />}
                        <Item role="listitem" size="sm">
                          <ItemContent className="gap-0.5">
                            <ItemTitle>{t("products:import.row", { row: r.row })}{r.name ? ` · ${r.name}` : ""}</ItemTitle>
                            <ItemDescription className="text-xs">{r.reason}</ItemDescription>
                          </ItemContent>
                        </Item>
                      </Fragment>
                    ))}
                  </ItemGroup>
                </Card>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>{t("common:actions.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust stock */}
      <Dialog open={adjustTargets.length > 0} onOpenChange={(o) => !o && !adjustBusy && setAdjustTargets([])}>
        <DialogContent className="border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-dash-display text-xl font-bold">{t("products:shared.adjustStock")}</DialogTitle>
            <DialogDescription>
              {t("products:adjust.description", { target: adjustTargets.length === 1 ? adjustTargets[0].name : t("products:adjust.selected", { count: adjustTargets.length }) })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <FormField label={t("common:fields.location")} htmlFor="adjust-loc">
              <Select value={adjustLoc} onValueChange={setAdjustLoc}>
                <SelectTrigger id="adjust-loc" aria-label={t("common:fields.location")} className="w-full"><SelectValue placeholder={t("products:adjust.selectLocation")} /></SelectTrigger>
                <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label={t("products:adjust.qtyChange")} htmlFor="adjust-qty">
              <Input id="adjust-qty" type="number" step={1} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} placeholder={t("products:adjust.qtyPlaceholder")} />
            </FormField>
            {adjustTargets.length === 1 && adjustTargets[0].variants && adjustTargets[0].variants.length > 0 && (
              <FormField label={t("common:fields.variant")} htmlFor="adjust-variant">
                <Select value={adjustVariant} onValueChange={setAdjustVariant}>
                  <SelectTrigger id="adjust-variant" aria-label={t("common:fields.variant")} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{adjustTargets[0].variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
            )}
            {adjustTargets.length === 1 && adjustLoc && !adjustTargets[0].variants?.length && (
              <p className="text-xs text-muted-foreground tabular-nums">
                {Number.isInteger(Number(adjustQty)) && adjustQty !== ""
                  ? t("products:adjust.nowTo", { qty: qtyAt(adjustTargets[0], adjustLoc), next: qtyAt(adjustTargets[0], adjustLoc) + Number(adjustQty) })
                  : t("products:adjust.now", { qty: qtyAt(adjustTargets[0], adjustLoc) })}
              </p>
            )}
            {adjustTargets.length > 1 && <p className="text-xs text-muted-foreground">{t("products:adjust.bulkNote")}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={adjustBusy} onClick={() => setAdjustTargets([])}>{t("common:actions.cancel")}</Button>
            <Button type="button" disabled={adjustBusy} onClick={applyAdjust}>{adjustBusy ? t("common:actions.saving") : t("common:actions.apply")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && !deleting && setDeleteTargets([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:confirm.deleteTitle", { name: deleteTargets.length === 1 ? deleteTargets[0].name : t("common:count.products", { count: deleteTargets.length }) })}</AlertDialogTitle>
            <AlertDialogDescription>{t("products:remove.description", { count: deleteTargets.length })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete() }} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? t("products:remove.deleting") : t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeRequiredModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title={t("products:list.upgrade.title")}
        description={t("products:list.upgrade.description", { max: company?.maxProducts })}
        limitType="products"
        currentLimit={company?.maxProducts}
      />
    </div>
  )
}
