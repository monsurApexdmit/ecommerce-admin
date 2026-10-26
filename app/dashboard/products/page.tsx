"use client"

import { Fragment, useState, useMemo, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
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
      .catch((e) => { if (!cancelled && e?.response?.status !== 403) toast({ variant: "destructive", title: "Could not load products", description: e?.response?.data?.message || e?.message }) })
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
    allProducts.forEach((p) => { if (p.brandId) m.set(p.brandId, p.brandName || `Brand #${p.brandId}`) })
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [allProducts])

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
  const changeTab = (t: string) => { setTab(t as Tab); setPage(1); setChecked(new Set()) }
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
    if (failed) toast({ variant: "destructive", title: "Some updates failed", description: `${failed} of ${targets.length} could not be changed` })
    else toast({ title: published ? "Shown online" : "Hidden online", description: `${targets.length} product${targets.length === 1 ? "" : "s"} updated` })
    setChecked(new Set())
    setReloadKey((k) => k + 1)
  }

  const applyBulkPrice = async () => {
    const v = Number(priceValue)
    const percent = priceMode === "down" ? -v : v
    if (!Number.isFinite(v) || !(v > 0) || percent <= -100) {
      toast({ variant: "destructive", title: "Enter a valid percentage", description: "Must be above 0, and a decrease must be less than 100%." })
      return
    }
    setPriceBusy(true)
    try {
      const r = await productApi.bulkPrice(selected.map((p) => Number(p.id)), percent)
      await reload()
      toast({ title: "Prices updated", description: `${r.count} product${r.count === 1 ? "" : "s"} repriced${r.variantsUpdated ? ` and ${r.variantsUpdated} variant${r.variantsUpdated === 1 ? "" : "s"}` : ""}, wholesale included` })
      setPriceOpen(false)
      setPriceValue("")
      setChecked(new Set())
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not update prices", description: e?.response?.data?.message || e?.message || "Try again" })
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
      toast({ variant: "destructive", title: "Enter a quantity", description: "Use a whole number: positive to add, negative to remove." })
      return
    }
    if (!adjustLoc) { toast({ variant: "destructive", title: "Pick a location" }); return }
    const single = adjustTargets.length === 1 ? adjustTargets[0] : null
    if (single && delta < 0 && !single.variants?.length && qtyAt(single, adjustLoc) + delta < 0) {
      toast({ variant: "destructive", title: "Not enough stock", description: `${single.name} would go below zero at this location.` })
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
        toast({ variant: "destructive", title: `Adjusted ${r.adjusted}, ${r.failed.length} failed`, description: r.failed.slice(0, 3).map((f) => `${nameOf(f.index)}: ${f.reason}`).join(" · ") })
      } else {
        toast({ title: "Stock adjusted", description: `${r.adjusted} product${r.adjusted === 1 ? "" : "s"} ${delta > 0 ? "+" : ""}${delta}` })
        setAdjustTargets([])
        setChecked(new Set())
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not adjust stock", description: e?.response?.data?.message || e?.message || "Try again" })
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
    if (failed) toast({ variant: "destructive", title: "Some deletions failed", description: `${failed} of ${deleteTargets.length} could not be deleted` })
    else toast({ title: "Deleted", description: `${deleteTargets.length} product${deleteTargets.length === 1 ? "" : "s"} removed` })
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
        ["Name", "SKU", "Barcode", "Category", "Brand", "Supplier", "Unit", "Cost", "Price", "Offer", "Stock", "Reorder", "Status", "Published", "Description"],
      )
    } catch (e: any) {
      toast({ variant: "destructive", title: "Export failed", description: e?.message || "Try again" })
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
      if (!data.length) { toast({ variant: "destructive", title: "No rows found", description: "The file is empty or has no header row." }); return }
      setImportBusy(true)
      try {
        const result = await productApi.importRows(data)
        setImportResult({ ...result, skipped: result.skipped.map((r) => ({ ...r, name: r.name ?? data[r.row - 1]?.name })) })
        await reload()
        toast({ title: `Imported ${result.imported}, skipped ${result.skipped.length}` })
      } catch (err: any) {
        toast({ variant: "destructive", title: "Import failed", description: err?.response?.data?.message || err?.message || "Try again" })
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
      title="No products found"
      description={hasFilters ? "Nothing matches these filters." : "Add your first product to get started."}
      action={(hasFilters || canWrite("Products")) ? (
        <div className="flex justify-center gap-2">
          {hasFilters && <Button type="button" variant="outline" onClick={resetFilters}>Clear filters</Button>}
          {canWrite("Products") && (
            <Button type="button" onClick={handleAdd}>
              <Plus className="size-4" aria-hidden /> Add product
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
        title="Products"
        description={<>
          Everything you sell — prices, margins and stock at a glance.
          {planLimits && <span className="ml-1 tabular-nums">({planLimits.currentProducts} / {planLimits.maxProducts} used on your plan)</span>}
        </>}
        actions={<>
          <Button asChild variant="outline">
            <Link href="/dashboard/products/print-barcode">
              <Printer className="size-4" aria-hidden /> Print barcodes
            </Link>
          </Button>
          {canWrite("Products") && (
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" aria-hidden /> Import
            </Button>
          )}
          {mayExport && <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="size-4" aria-hidden /> {exporting ? "Exporting…" : "Export"}
          </Button>}
          {canWrite("Products") && (
            <Button type="button" onClick={handleAdd}>
              <Plus className="size-4" aria-hidden /> Add product
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
          { label: "Products", value: counts.all, icon: <Package className="size-4" />, color: "blue",
            hint: `${kpi.variants} variant${kpi.variants === 1 ? "" : "s"} · ${allCategories.length} categories` },
          { label: "Inventory value", value: money(kpi.value), icon: <Banknote className="size-4" />, color: "green", hint: warehouse === "all" ? "At cost, all warehouses" : `At cost, ${warehouses.find((w) => String(w.id) === warehouse)?.name ?? "warehouse"}` },
          { label: "Low stock", value: counts.low, icon: <AlertTriangle className="size-4" />, color: "yellow", hint: "At or below reorder point",
            onClick: () => changeTab("low"), active: tab === "low" },
          { label: "Out of stock", value: counts.out, icon: <PackageX className="size-4" />, color: "red", hint: "Losing sales now",
            onClick: () => changeTab("out"), active: tab === "out" },
          { label: "Avg margin", value: kpi.avg === null ? "—" : `${kpi.avg}%`, icon: <Percent className="size-4" />, color: "purple", hint: "Price vs cost" },
        ]} />
      )}

      <Card className="min-w-0 gap-0 py-0">
        <div className="px-4">
          <StatusTabs
            value={tab}
            onChange={changeTab}
            tabs={[
              { value: "all", label: "All", count: counts.all },
              { value: "ok", label: "In stock", count: counts.ok },
              { value: "low", label: "Low stock", count: counts.low },
              { value: "out", label: "Out of stock", count: counts.out },
              { value: "hidden", label: "Hidden online", count: counts.hidden },
            ]}
          />
        </div>

        <Toolbar className="p-4" actions={
          <div role="radiogroup" aria-label="View" className="flex gap-1">
            {([["table", "Table view", List], ["grid", "Grid view", LayoutGrid]] as const).map(([id, label, Icon]) => (
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
            <Label htmlFor="product-search" className="sr-only">Search products</Label>
            <Input id="product-search" type="search" placeholder="Search name, SKU, barcode, supplier or variant SKU…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-8" />
          </div>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
            <SelectTrigger aria-label="Category" className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Category: All</SelectItem>
              <SelectItem value="none">No category</SelectItem>
              {allCategories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.parent_id !== null ? `└ ${c.category_name}` : c.category_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vendor} onValueChange={(v) => { setVendor(v); setPage(1) }}>
            <SelectTrigger aria-label="Supplier" className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Supplier: All</SelectItem>
              <SelectItem value="none">Supplier: None</SelectItem>
              {vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={(v) => { setBrand(v); setPage(1) }}>
            <SelectTrigger aria-label="Brand" className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Brand: All</SelectItem>
              <SelectItem value="none">No brand</SelectItem>
              {brandOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={warehouse} onValueChange={(v) => { setWarehouse(v); setPage(1) }}>
            <SelectTrigger aria-label="Warehouse" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Warehouse: All</SelectItem>
              {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1) }}>
            <SelectTrigger aria-label="Sort" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Sort: Newest</SelectItem>
              <SelectItem value="name">Sort: Name</SelectItem>
              <SelectItem value="price-asc">Sort: Price, low to high</SelectItem>
              <SelectItem value="price-desc">Sort: Price, high to low</SelectItem>
              <SelectItem value="stock-asc">Sort: Stock, low to high</SelectItem>
              <SelectItem value="stock-desc">Sort: Stock, high to low</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <X className="size-4" aria-hidden /> Clear
            </Button>
          )}
        </Toolbar>

        <BulkBar count={checked.size} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
            {canWrite("Products") && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => setPublished(selected, true)}>Show online</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPublished(selected, false)}>Hide online</Button>
              </>
            )}
            {canWrite("Products") && <Button type="button" variant="outline" size="sm" onClick={() => setPriceOpen(true)}>Update price</Button>}
            {canWrite("Products") && <Button type="button" variant="outline" size="sm" onClick={() => openAdjust(selected)}>Adjust stock</Button>}
            <Button type="button" variant="outline" size="sm" onClick={() => printBarcodes(selected)}>Print barcodes</Button>
            {mayExport && <Button type="button" variant="outline" size="sm" onClick={handleExport}>Export selected</Button>}
            {canDelete("Products") && (
              <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTargets(selected)}>Delete</Button>
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
                    <Checkbox checked={ck} onCheckedChange={() => toggleOne(p.id)} aria-label={`Select ${p.name}`} />
                    <Switch checked={p.published} aria-label={`Show ${p.name} online`} disabled={!canWrite("Products")}
                      onCheckedChange={() => setPublished([p], !p.published)} />
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setViewing(p)} className="h-auto flex-col items-stretch gap-2 whitespace-normal p-0 text-left font-normal">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image || "/placeholder.svg"} alt="" className="aspect-[4/3] w-full rounded-md bg-muted object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="truncate">{p.name}</span>
                      {p.isBundle && <Badge variant="secondary">Bundle</Badge>}
                    </span>
                    <span className="text-xs text-muted-foreground">{p.sku || "No SKU"} · {p.category || "—"}{p.brandName ? ` · ${p.brandName}` : ""}</span>
                  </Button>
                  <div className="mt-auto flex items-end justify-between">
                    <span className="font-bold tabular-nums">{money(offer ?? p.salePrice)}</span>
                    <StatusBadge status={stockStatus(st)} className="tabular-nums"
                      label={st === "out" ? "Out of stock" : `${gStock}${p.unitName ? ` ${p.unitName}` : ""}${st === "low" ? " · Low" : " in stock"}`} />
                  </div>
                  {seeCost && gMargin !== null && <div className="text-xs text-muted-foreground tabular-nums">Margin {gMargin}%</div>}
                  <div className="flex gap-2">
                    {canWrite("Products") && (
                      <Button type="button" variant="outline" onClick={() => openForm(p)} className="flex-1">Edit</Button>
                    )}
                    {canDelete("Products") && (
                      <Button type="button" variant="outline" size="icon" aria-label={`Delete ${p.name}`} onClick={() => setDeleteTargets([p])}><Trash2 className="size-4" /></Button>
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
                <TableHead scope="col" className="w-5 pl-4"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all on this page" /></TableHead>
                <TableHead scope="col">Product</TableHead>
                <TableHead scope="col">Category</TableHead>
                {seeCost && <TableHead scope="col" className="text-right">Cost</TableHead>}
                <TableHead scope="col" className="text-right">Price</TableHead>
                {seeCost && <TableHead scope="col">Margin</TableHead>}
                <TableHead scope="col">Stock</TableHead>
                <TableHead scope="col">Online</TableHead>
                <TableHead scope="col" className="pr-4 text-right">Actions</TableHead>
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
                        <Checkbox checked={ck} onCheckedChange={() => toggleOne(p.id)} aria-label={`Select ${p.name}`} />
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" onClick={() => setViewing(p)} className="h-auto justify-start gap-2.5 p-0 text-left font-normal">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <UserAvatar shape="square" src={p.image || "/placeholder.svg"} alt="" name={p.name} className="size-10" />
                          <span className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-1.5 font-semibold">
                              <span className="max-w-[220px] truncate">{p.name}</span>
                              {p.isBestSeller && <Badge variant="secondary">Best seller</Badge>}
                              {p.isHotDeal && <Badge variant="destructive">Hot deal</Badge>}
                              {p.tag && <Badge variant="outline">{p.tag}</Badge>}
                              {p.isBundle && <Badge variant="secondary">Bundle</Badge>}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {p.sku || "No SKU"}{p.variants && p.variants.length > 0 ? ` · ${p.variants.length} variant${p.variants.length === 1 ? "" : "s"}` : ""}
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
                              {p.offerType === "percentage" ? `${p.offerPrice}% off` : `${money(p.offerPrice!)} off`}
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
                            {st === "out" ? "Out of stock" : `${rowStock}${unit}`}
                          </span>
                          {st === "low" && <StatusBadge status="low stock" label="Low" />}
                        </div>
                        {rop > 0 && <Progress aria-hidden className="mt-1 h-1.5 w-24"
                          value={Math.min(100, Math.round((Math.max(0, rowStock) / (rop * 4)) * 100))} />}
                        <div className="mt-1 text-xs text-muted-foreground tabular-nums">{rop > 0 ? `Reorder at ${rop}${unit}` : "No reorder alert"}</div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={p.published} aria-label={`Show ${p.name} online`}
                          disabled={!canWrite("Products")}
                          onCheckedChange={() => setPublished([p], !p.published)} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="outline" size="icon" aria-label={`View ${p.name}`} onClick={() => setViewing(p)}><Eye className="size-4" /></Button>
                          {canWrite("Products") && (
                            <Button type="button" variant="outline" size="icon" aria-label={`Edit ${p.name}`} onClick={() => openForm(p)}><Pencil className="size-4" /></Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="icon" aria-label={`More actions for ${p.name}`}><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setViewing(p)}>View details</DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/products/${p.id}/reviews`}><MessageSquare className="size-4" /> Reviews</Link>
                              </DropdownMenuItem>
                              {canWrite("Products") && (
                                <DropdownMenuItem onClick={() => openAdjust([p])}><Package className="size-4" /> Adjust stock</DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => printBarcodes([p])}><Printer className="size-4" /> Print barcode</DropdownMenuItem>
                              {canDelete("Products") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargets([p])}>
                                    <Trash2 className="size-4" /> Delete product
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
              Showing {rows.length} of {filtered.length} products · Inventory value {money(kpi.value)} at cost
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
            <DialogTitle className="font-dash-display text-xl font-bold">Update price</DialogTitle>
            <DialogDescription>Reprices {selected.length} selected product{selected.length === 1 ? "" : "s"}, including variants and wholesale prices.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div role="radiogroup" aria-label="Change type" className="grid grid-cols-2 gap-2">
              {([["up", "Increase %"], ["down", "Decrease %"]] as const).map(([id, label]) => (
                <Button key={id} type="button" variant={priceMode === id ? "default" : "outline"} role="radio" aria-checked={priceMode === id} onClick={() => setPriceMode(id)}>{label}</Button>
              ))}
            </div>
            <FormField label="Percentage" htmlFor="bulk-price-pct">
              <Input id="bulk-price-pct" type="number" min={0} step="any" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} placeholder="e.g. 10" />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPriceOpen(false)}>Cancel</Button>
            <Button type="button" disabled={priceBusy} onClick={applyBulkPrice}>{priceBusy ? "Updating…" : "Apply"}</Button>
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
            const whLabel = warehouse === "all" ? "all locations" : warehouses.find((w) => String(w.id) === warehouse)?.name
            const m = marginOf(viewing)
            const info: [string, string][] = [
              ["Category", viewing.category || "—"],
              ["Supplier", supplierName(viewing) || "—"],
              ["Location", viewing.locationName || warehouses.find((w) => String(w.id) === viewing.locationId)?.name || "—"],
              ["Brand", viewing.brandName || "—"],
              ["Unit", viewing.unitName || "—"],
              ["Stock", `${vStock}${viewing.unitName ? ` ${viewing.unitName}` : ""} · ${whLabel}`],
              ["Reorder at", reorderOf(viewing) > 0 ? String(reorderOf(viewing)) : "Alert off"],
              ["SKU", viewing.sku || "—"],
              ["Barcode", viewing.barcode || "—"],
              ["Barcode type", viewing.barcodeType || "—"],
              ["Tracking", viewing.trackingType === "serial" ? "Serial numbers" : viewing.trackingType === "batch" ? "Batches" : "Quantity only"],
              ...(seeCost ? [["Cost", viewing.costPrice ? money(viewing.costPrice) : "—"] as [string, string]] : []),
              ["List price", money(viewing.price)],
              ["Sale price", money(viewing.salePrice)],
              ...(seeCost ? [["Margin", m === null ? "—" : `${m}%`] as [string, string]] : []),
              ...(offer !== null ? [["Offer price", money(offer)] as [string, string]] : []),
              ...(viewing.offerEndsAt ? [["Offer ends", new Date(viewing.offerEndsAt).toLocaleDateString()] as [string, string]] : []),
              ...(viewing.wholesalePrice ? [["Wholesale", `${money(viewing.wholesalePrice)}${viewing.minWholesaleQty ? ` · min ${viewing.minWholesaleQty}` : ""}`] as [string, string]] : []),
              ...(viewing.isBundle && viewing.bundlePriceOverride ? [["Bundle price", money(viewing.bundlePriceOverride)] as [string, string]] : []),
              ...(viewing.receiptNumber ? [["Receipt / batch no.", viewing.receiptNumber] as [string, string]] : []),
            ]
            return (
              <>
                <DialogHeader>
                  <div className="flex items-start gap-3.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <UserAvatar shape="square" src={viewing.image || "/placeholder.svg"} alt="" name={viewing.name} className="size-20" />
                    <div className="min-w-0 text-left">
                      <DialogTitle className="font-dash-display text-xl font-bold">{viewing.name}</DialogTitle>
                      <DialogDescription className="line-clamp-2">{viewing.description || "No description."}</DialogDescription>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusBadge status={stockStatus(st)} label={st === "ok" ? "In stock" : st === "low" ? "Low stock" : "Out of stock"} />
                        <Badge variant="outline">{viewing.published ? "Online" : "Hidden online"}</Badge>
                        {viewing.isBestSeller && <Badge variant="secondary">Best seller</Badge>}
                        {viewing.isHotDeal && <Badge variant="destructive">Hot deal</Badge>}
                        {viewing.tag && <Badge variant="outline">{viewing.tag}</Badge>}
                        {viewing.isFeatured && <Badge>Featured</Badge>}
                      </div>
                    </div>
                  </div>
                </DialogHeader>
                <InfoList className="grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  {info.map(([k, v]) => (
                    <InfoRow key={k} layout="stacked" className="min-w-0" label={<span className="text-xs">{k}</span>}
                      value={<span className="block truncate tabular-nums">{v}</span>} />
                  ))}
                </InfoList>
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
                    <SectionTitle className="mb-2">Bundle contents</SectionTitle>
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
                    <SectionTitle className="mb-2">Variants ({viewing.variants.length})</SectionTitle>
                    <Card className="gap-0 overflow-x-auto py-0">
                      <Table className="min-w-[460px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead scope="col">Variant</TableHead>
                            <TableHead scope="col">SKU</TableHead>
                            <TableHead scope="col" className="text-right">Price</TableHead>
                            <TableHead scope="col" className="text-right">Stock</TableHead>
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
                  <Button type="button" variant="outline" onClick={() => setViewing(null)}>Close</Button>
                  <Button type="button" variant="outline" onClick={() => printBarcodes([viewing])}>
                    <Printer className="size-4" aria-hidden /> Print barcode
                  </Button>
                  {canWrite("Products") && (
                    <Button type="button" onClick={() => { const p = viewing; setViewing(null); openForm(p) }}>
                      <Pencil className="size-4" aria-hidden /> Edit product
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
            <DialogTitle className="font-dash-display text-xl font-bold">Import products</DialogTitle>
            <DialogDescription>
              Upload a CSV with a header row: name, sku, barcode, category, brand, supplier, unit, cost, price, stock, reorder, status, published (Yes/No), description.
              Category, brand, supplier and unit are matched by name. Opening stock goes to the default warehouse. Invalid rows are skipped and listed.
            </DialogDescription>
          </DialogHeader>
          <Input ref={fileRef} type="file" accept=".csv" onChange={handleImport} disabled={importBusy} aria-label="CSV file" className="w-full" />
          {importBusy && <p className="text-sm text-muted-foreground">Importing…</p>}
          {importResult && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Imported {importResult.imported}, skipped {importResult.skipped.length}</p>
              {(importResult.warnings?.length ?? 0) > 0 && (
                <Alert>
                  <AlertTriangle />
                  <AlertDescription>
                    <ul className="max-h-32 w-full space-y-1 overflow-y-auto text-xs">
                      {importResult.warnings!.map((w, i) => <li key={i}>Row {w.row}: {w.message}</li>)}
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
                            <ItemTitle>Row {r.row}{r.name ? ` · ${r.name}` : ""}</ItemTitle>
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
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust stock */}
      <Dialog open={adjustTargets.length > 0} onOpenChange={(o) => !o && !adjustBusy && setAdjustTargets([])}>
        <DialogContent className="border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-dash-display text-xl font-bold">Adjust stock</DialogTitle>
            <DialogDescription>
              {adjustTargets.length === 1 ? adjustTargets[0].name : `${adjustTargets.length} selected products`}: add or remove the same quantity at one location.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <FormField label="Location" htmlFor="adjust-loc">
              <Select value={adjustLoc} onValueChange={setAdjustLoc}>
                <SelectTrigger id="adjust-loc" aria-label="Location" className="w-full"><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </FormField>
            <FormField label="Quantity change" htmlFor="adjust-qty">
              <Input id="adjust-qty" type="number" step={1} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} placeholder="e.g. 5 to add, -3 to remove" />
            </FormField>
            {adjustTargets.length === 1 && adjustTargets[0].variants && adjustTargets[0].variants.length > 0 && (
              <FormField label="Variant" htmlFor="adjust-variant">
                <Select value={adjustVariant} onValueChange={setAdjustVariant}>
                  <SelectTrigger id="adjust-variant" aria-label="Variant" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{adjustTargets[0].variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
            )}
            {adjustTargets.length === 1 && adjustLoc && !adjustTargets[0].variants?.length && (
              <p className="text-xs text-muted-foreground tabular-nums">
                Now {qtyAt(adjustTargets[0], adjustLoc)}
                {Number.isInteger(Number(adjustQty)) && adjustQty !== "" ? ` → ${qtyAt(adjustTargets[0], adjustLoc) + Number(adjustQty)}` : ""}
              </p>
            )}
            {adjustTargets.length > 1 && <p className="text-xs text-muted-foreground">Bundles are skipped, and products with variants must be adjusted one at a time.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={adjustBusy} onClick={() => setAdjustTargets([])}>Cancel</Button>
            <Button type="button" disabled={adjustBusy} onClick={applyAdjust}>{adjustBusy ? "Saving…" : "Apply"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && !deleting && setDeleteTargets([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTargets.length === 1 ? deleteTargets[0].name : `${deleteTargets.length} products`}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the selected product{deleteTargets.length === 1 ? "" : "s"}. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete() }} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeRequiredModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title="Product Limit Reached"
        description={`Your current plan allows up to ${company?.maxProducts} products. Please upgrade to add more.`}
        limitType="products"
        currentLimit={company?.maxProducts}
      />
    </div>
  )
}
