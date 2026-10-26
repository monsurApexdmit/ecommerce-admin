"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  AlertTriangle, Banknote, Download, Eye, LayoutGrid, List, MessageSquare, MoreHorizontal, Package, PackageX, Pencil, Percent, Plus,
  Printer, Search, Trash2, Upload, X, Boxes,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
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

const iconBtn =
  "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const filterSelect = "h-11 rounded-[10px] border-dash-border bg-dash-card text-[13px] font-semibold"
const ghostBtn =
  "inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const barBtn = "inline-flex h-9 items-center rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10"

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
    <div className="py-14 text-center">
      <Boxes className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
      <p className="font-semibold">No products found</p>
      <p className="mb-3 text-sm text-dash-muted">{hasFilters ? "Nothing matches these filters." : "Add your first product to get started."}</p>
      <div className="flex justify-center gap-2">
        {hasFilters && <button type="button" onClick={resetFilters} className={ghostBtn}>Clear filters</button>}
        {canWrite("Products") && (
          <button type="button" onClick={handleAdd} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">
            <Plus className="size-4" aria-hidden /> Add product
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-dash-muted">
            Everything you sell — prices, margins and stock at a glance.
            {planLimits && <span className="ml-1 tabular-nums">({planLimits.currentProducts} / {planLimits.maxProducts} used on your plan)</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/products/print-barcode" className={ghostBtn}>
            <Printer className="size-4" aria-hidden /> Print barcodes
          </Link>
          {canWrite("Products") && (
            <button type="button" onClick={() => setImportOpen(true)} className={ghostBtn}>
              <Upload className="size-4" aria-hidden /> Import
            </button>
          )}
          {mayExport && <button type="button" onClick={handleExport} disabled={exporting} className={cn(ghostBtn, "disabled:opacity-50")}>
            <Download className="size-4" aria-hidden /> {exporting ? "Exporting…" : "Export"}
          </button>}
          {canWrite("Products") && (
            <button type="button" onClick={handleAdd}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">
              <Plus className="size-4" aria-hidden /> Add product
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {isLoading && items.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[118px] rounded-[14px]" />)}
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

      <section className="min-w-0 rounded-[14px] border border-dash-border bg-dash-card">
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

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden />
            <span className="sr-only">Search products</span>
            <input type="search" placeholder="Search name, SKU, barcode, supplier or variant SKU…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
            <SelectTrigger aria-label="Category" className={cn(filterSelect, "w-[160px]")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Category: All</SelectItem>
              <SelectItem value="none">No category</SelectItem>
              {allCategories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.parent_id !== null ? `└ ${c.category_name}` : c.category_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vendor} onValueChange={(v) => { setVendor(v); setPage(1) }}>
            <SelectTrigger aria-label="Supplier" className={cn(filterSelect, "w-[160px]")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Supplier: All</SelectItem>
              <SelectItem value="none">Supplier: None</SelectItem>
              {vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={brand} onValueChange={(v) => { setBrand(v); setPage(1) }}>
            <SelectTrigger aria-label="Brand" className={cn(filterSelect, "w-[160px]")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Brand: All</SelectItem>
              <SelectItem value="none">No brand</SelectItem>
              {brandOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={warehouse} onValueChange={(v) => { setWarehouse(v); setPage(1) }}>
            <SelectTrigger aria-label="Warehouse" className={cn(filterSelect, "w-[170px]")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Warehouse: All</SelectItem>
              {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1) }}>
            <SelectTrigger aria-label="Sort" className={cn(filterSelect, "w-[170px]")}><SelectValue /></SelectTrigger>
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
            <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center gap-1 px-2 text-[13px] font-semibold text-dash-muted hover:text-dash-ink">
              <X className="size-4" aria-hidden /> Clear
            </button>
          )}
          <div role="radiogroup" aria-label="View" className="ml-auto flex gap-0.5 rounded-[10px] bg-dash-neutral-soft p-[3px]">
            {([["table", "Table view", List], ["grid", "Grid view", LayoutGrid]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" role="radio" aria-checked={view === id} aria-label={label} title={label} onClick={() => setView(id)}
                className={cn("flex h-[34px] w-[38px] items-center justify-center rounded-lg", view === id ? "bg-dash-card text-dash-accent shadow-sm" : "text-dash-muted hover:text-dash-ink")}>
                <Icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>

        {checked.size > 0 && (
          <div className="mx-4 mb-3 flex flex-wrap items-center gap-2.5 rounded-[10px] bg-dash-ink px-3.5 py-2.5 text-dash-bg">
            <span className="text-sm font-semibold">{checked.size} selected</span>
            {canWrite("Products") && (
              <>
                <button type="button" onClick={() => setPublished(selected, true)} className={barBtn}>Show online</button>
                <button type="button" onClick={() => setPublished(selected, false)} className={barBtn}>Hide online</button>
              </>
            )}
            {canWrite("Products") && <button type="button" onClick={() => setPriceOpen(true)} className={barBtn}>Update price</button>}
            {canWrite("Products") && <button type="button" onClick={() => openAdjust(selected)} className={barBtn}>Adjust stock</button>}
            <button type="button" onClick={() => printBarcodes(selected)} className={barBtn}>Print barcodes</button>
            {mayExport && <button type="button" onClick={handleExport} className={barBtn}>Export selected</button>}
            {canDelete("Products") && (
              <button type="button" onClick={() => setDeleteTargets(selected)}
                className="inline-flex h-9 items-center rounded-lg border border-red-400/50 px-3 text-[13px] font-semibold text-red-300 hover:bg-white/10">Delete</button>
            )}
            <button type="button" onClick={() => setChecked(new Set())} className="ml-auto h-9 px-3 text-[13px] font-semibold opacity-80 hover:opacity-100">Clear</button>
          </div>
        )}

        {view === "grid" ? (
          <div className="grid gap-3 p-4 pt-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {isLoading && items.length === 0 ? (
              [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-56 rounded-[14px]" />)
            ) : rows.length === 0 ? (
              <div className="col-span-full">{emptyState}</div>
            ) : rows.map((p) => {
              const st = stockState(p, warehouse)
              const gStock = stockAt(p, warehouse)
              const gMargin = marginOf(p)
              const offer = offerFinalOf(p)
              const ck = checked.has(p.id)
              return (
                <article key={p.id} className={cn("flex flex-col gap-2.5 rounded-[14px] border bg-dash-card p-3", ck ? "border-dash-accent" : "border-dash-border")}>
                  <div className="flex items-start justify-between gap-2">
                    <Checkbox checked={ck} onCheckedChange={() => toggleOne(p.id)} aria-label={`Select ${p.name}`} />
                    <button type="button" role="switch" aria-checked={p.published} aria-label={`Show ${p.name} online`} disabled={!canWrite("Products")}
                      onClick={() => setPublished([p], !p.published)}
                      className={cn("flex h-5 w-9 items-center rounded-full p-0.5 disabled:opacity-50", p.published ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}>
                      <span className="size-4 rounded-full bg-white" />
                    </button>
                  </div>
                  <button type="button" onClick={() => setViewing(p)} className="flex flex-col gap-2 text-left">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.image || "/placeholder.svg"} alt="" className="aspect-[4/3] w-full rounded-[10px] bg-dash-bg object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="truncate">{p.name}</span>
                      {p.isBundle && <span className="rounded bg-dash-accent-soft px-1.5 py-px text-[10px] font-bold text-dash-accent-fg">Bundle</span>}
                    </span>
                    <span className="text-xs text-dash-muted">{p.sku || "No SKU"} · {p.category || "—"}{p.brandName ? ` · ${p.brandName}` : ""}</span>
                  </button>
                  <div className="mt-auto flex items-end justify-between">
                    <span className="font-bold tabular-nums">{money(offer ?? p.salePrice)}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                      st === "out" ? "bg-dash-danger-soft text-dash-danger-fg" : st === "low" ? "bg-dash-warn-soft text-dash-warn-fg" : "bg-dash-success-soft text-dash-success-fg")}>
                      {st === "out" ? "Out of stock" : `${gStock}${p.unitName ? ` ${p.unitName}` : ""}${st === "low" ? " · Low" : " in stock"}`}
                    </span>
                  </div>
                  {seeCost && gMargin !== null && <div className="text-xs text-dash-muted tabular-nums">Margin {gMargin}%</div>}
                  <div className="flex gap-2">
                    {canWrite("Products") && (
                      <button type="button" onClick={() => openForm(p)} className="h-9 flex-1 rounded-lg border border-dash-border text-[13px] font-semibold hover:bg-dash-neutral-soft">Edit</button>
                    )}
                    {canDelete("Products") && (
                      <button type="button" aria-label={`Delete ${p.name}`} onClick={() => setDeleteTargets([p])}
                        className="flex size-9 items-center justify-center rounded-lg border border-dash-border text-dash-danger hover:bg-dash-neutral-soft"><Trash2 className="size-4" /></button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                <th scope="col" className="w-5 py-3 pl-4 pr-2"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all on this page" /></th>
                <th scope="col" className="px-2 py-3 font-semibold">Product</th>
                <th scope="col" className="px-2 py-3 font-semibold">Category</th>
                {seeCost && <th scope="col" className="px-2 py-3 text-right font-semibold">Cost</th>}
                <th scope="col" className="px-2 py-3 text-right font-semibold">Price</th>
                {seeCost && <th scope="col" className="px-2 py-3 font-semibold">Margin</th>}
                <th scope="col" className="px-2 py-3 font-semibold">Stock</th>
                <th scope="col" className="px-2 py-3 font-semibold">Online</th>
                <th scope="col" className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && items.length === 0 ? (
                [1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={9} className="px-4 py-3"><Skeleton className="h-12 rounded" /></td></tr>)
              ) : rows.length === 0 ? (
                <tr><td colSpan={9}>{emptyState}</td>
                </tr>
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
                    <tr key={p.id} className={ck ? "bg-dash-bg" : ""}>
                      <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                        <Checkbox checked={ck} onCheckedChange={() => toggleOne(p.id)} aria-label={`Select ${p.name}`} />
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <button type="button" onClick={() => setViewing(p)} className="flex items-center gap-2.5 text-left">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.image || "/placeholder.svg"} alt="" className="size-10 shrink-0 rounded-[10px] bg-dash-bg object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
                          <span className="flex min-w-0 flex-col">
                            <span className="flex items-center gap-1.5 font-semibold">
                              <span className="max-w-[220px] truncate">{p.name}</span>
                              {p.isBestSeller && <span className="rounded bg-dash-warn-soft px-1.5 py-px text-[10px] font-bold text-dash-warn-fg">Best seller</span>}
                              {p.isHotDeal && <span className="rounded bg-dash-danger-soft px-1.5 py-px text-[10px] font-bold text-dash-danger-fg">Hot deal</span>}
                              {p.tag && <span className="rounded bg-dash-neutral-soft px-1.5 py-px text-[10px] font-bold text-dash-neutral-fg">{p.tag}</span>}
                              {p.isBundle && <span className="rounded bg-dash-accent-soft px-1.5 py-px text-[10px] font-bold text-dash-accent-fg">Bundle</span>}
                            </span>
                            <span className="text-xs text-dash-muted">
                              {p.sku || "No SKU"}{p.variants && p.variants.length > 0 ? ` · ${p.variants.length} variant${p.variants.length === 1 ? "" : "s"}` : ""}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div>{p.category || "—"}</div>
                        {p.brandName && <div className="text-xs text-dash-muted">{p.brandName}</div>}
                        {sup && <div className="text-xs text-dash-muted">{sup}</div>}
                      </td>
                      {seeCost && <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums text-dash-muted">
                        {p.costPrice ? money(p.costPrice) : "—"}
                      </td>}
                      <td className="border-b border-dash-border-soft px-2 py-3 text-right font-bold tabular-nums">
                        {money(offer ?? p.salePrice)}
                        {offer !== null && (
                          <div className="text-xs font-normal text-dash-muted">
                            <span className="line-through">{money(p.salePrice)}</span>{" "}
                            <span className="font-semibold text-dash-warn-fg">
                              {p.offerType === "percentage" ? `${p.offerPrice}% off` : `${money(p.offerPrice!)} off`}
                            </span>
                          </div>
                        )}
                      </td>
                      {seeCost && <td className="border-b border-dash-border-soft px-2 py-3">
                        {margin === null ? <span className="text-dash-muted/60">—</span> : (
                          <span className={cn("rounded-md px-2 py-[3px] text-xs font-bold tabular-nums",
                            margin >= 35 ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-warn-soft text-dash-warn-fg")}>
                            {margin}%
                          </span>
                        )}
                      </td>}
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <span className={cn("font-bold", st === "out" ? "text-dash-danger" : st === "low" ? "text-dash-warn-fg" : "")}>
                            {st === "out" ? "Out of stock" : `${rowStock}${unit}`}
                          </span>
                          {st === "low" && <span className="text-[11px] font-bold uppercase text-dash-warn-fg">Low</span>}
                        </div>
                        {rop > 0 && <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-dash-neutral-soft" aria-hidden>
                          <div className={cn("h-full rounded-full", st === "out" ? "bg-dash-danger" : st === "low" ? "bg-dash-warn" : "bg-dash-success")}
                            style={{ width: `${Math.min(100, Math.round((Math.max(0, rowStock) / (rop * 4)) * 100))}%` }} />
                        </div>}
                        <div className="mt-1 text-xs text-dash-muted tabular-nums">{rop > 0 ? `Reorder at ${rop}${unit}` : "No reorder alert"}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <button type="button" role="switch" aria-checked={p.published} aria-label={`Show ${p.name} online`}
                          disabled={!canWrite("Products")}
                          onClick={() => setPublished([p], !p.published)}
                          className={cn("flex h-6 w-11 items-center rounded-full p-0.5 transition-colors disabled:opacity-50",
                            p.published ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}>
                          <span className="size-5 rounded-full bg-white shadow" />
                        </button>
                      </td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" aria-label={`View ${p.name}`} onClick={() => setViewing(p)} className={iconBtn}><Eye className="size-4" /></button>
                          {canWrite("Products") && (
                            <button type="button" aria-label={`Edit ${p.name}`} onClick={() => openForm(p)} className={iconBtn}><Pencil className="size-4" /></button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label={`More actions for ${p.name}`} className={iconBtn}><MoreHorizontal className="size-4" /></button>
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
                                  <DropdownMenuItem className="text-dash-danger focus:text-dash-danger" onClick={() => setDeleteTargets([p])}>
                                    <Trash2 className="size-4" /> Delete product
                                  </DropdownMenuItem>
                                </>
                              )}
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
        )}

        {!(isLoading && items.length === 0) && filtered.length > 0 && (
          <div className="border-t border-dash-border-soft p-4 pt-3">
            <p className="mb-2 text-xs text-dash-muted tabular-nums">
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
        )}
      </section>

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
                <button key={id} type="button" role="radio" aria-checked={priceMode === id} onClick={() => setPriceMode(id)}
                  className={cn("h-10 rounded-[10px] border-2 text-[13px] font-semibold", priceMode === id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{label}</button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Percentage
              <input type="number" min={0} step="any" value={priceValue} onChange={(e) => setPriceValue(e.target.value)} placeholder="e.g. 10"
                className="h-[42px] rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent" />
            </label>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setPriceOpen(false)} className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft">Cancel</button>
            <button type="button" disabled={priceBusy} onClick={applyBulkPrice} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">{priceBusy ? "Updating…" : "Apply"}</button>
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
                    <img src={viewing.image || "/placeholder.svg"} alt="" className="size-20 shrink-0 rounded-xl bg-dash-bg object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
                    <div className="min-w-0 text-left">
                      <DialogTitle className="font-dash-display text-xl font-bold">{viewing.name}</DialogTitle>
                      <DialogDescription className="line-clamp-2">{viewing.description || "No description."}</DialogDescription>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className={cn("rounded-md px-2 py-[3px] text-xs font-bold",
                          st === "ok" ? "bg-dash-success-soft text-dash-success-fg" : st === "low" ? "bg-dash-warn-soft text-dash-warn-fg" : "bg-dash-danger-soft text-dash-danger-fg")}>
                          {st === "ok" ? "In stock" : st === "low" ? "Low stock" : "Out of stock"}
                        </span>
                        <span className="rounded-md bg-dash-neutral-soft px-2 py-[3px] text-xs font-bold text-dash-neutral-fg">
                          {viewing.published ? "Online" : "Hidden online"}
                        </span>
                        {viewing.isBestSeller && <span className="rounded-md bg-dash-warn-soft px-2 py-[3px] text-xs font-bold text-dash-warn-fg">Best seller</span>}
                        {viewing.isHotDeal && <span className="rounded-md bg-dash-danger-soft px-2 py-[3px] text-xs font-bold text-dash-danger-fg">Hot deal</span>}
                        {viewing.tag && <span className="rounded-md bg-dash-neutral-soft px-2 py-[3px] text-xs font-bold text-dash-neutral-fg">{viewing.tag}</span>}
                        {viewing.isFeatured && <span className="rounded-md bg-dash-accent-soft px-2 py-[3px] text-xs font-bold text-dash-accent-fg">Featured</span>}
                      </div>
                    </div>
                  </div>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {info.map(([k, v]) => (
                    <div key={k} className="rounded-[10px] bg-dash-bg p-3">
                      <div className="text-xs text-dash-muted">{k}</div>
                      <div className="truncate text-sm font-bold tabular-nums">{v}</div>
                    </div>
                  ))}
                </div>
                {(viewing.gallery?.length ?? 0) > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {viewing.gallery!.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt="" className="size-16 shrink-0 rounded-[10px] bg-dash-bg object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
                    ))}
                  </div>
                )}
                {viewing.isBundle && (viewing.bundleItems?.length ?? 0) > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-dash-muted">Bundle contents</h3>
                    <div className="flex flex-col rounded-[10px] border border-dash-border">
                      {viewing.bundleItems!.map((bi, i) => (
                        <div key={bi.id ?? i} className="flex items-center justify-between gap-3 border-b border-dash-border-soft px-3 py-2 text-sm last:border-0">
                          <span className="font-semibold">{bi.productName}{bi.variantName ? ` · ${bi.variantName}` : ""}</span>
                          <span className="text-dash-muted tabular-nums">× {bi.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {viewing.variants && viewing.variants.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-dash-muted">Variants ({viewing.variants.length})</h3>
                    <div className="overflow-x-auto rounded-[10px] border border-dash-border">
                      <table className="w-full min-w-[460px] border-collapse text-sm">
                        <thead>
                          <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                            <th scope="col" className="px-3 py-2 font-semibold">Variant</th>
                            <th scope="col" className="px-3 py-2 font-semibold">SKU</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">Price</th>
                            <th scope="col" className="px-3 py-2 text-right font-semibold">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewing.variants.map((v) => (
                            <tr key={v.id}>
                              <td className="border-t border-dash-border-soft px-3 py-2 font-semibold">{v.name}</td>
                              <td className="border-t border-dash-border-soft px-3 py-2 text-dash-muted">{v.sku || "—"}</td>
                              <td className="border-t border-dash-border-soft px-3 py-2 text-right tabular-nums">{money(v.salePrice || v.price)}</td>
                              <td className={cn("border-t border-dash-border-soft px-3 py-2 text-right font-bold tabular-nums", v.stock <= 0 && "text-dash-danger")}>{v.stock}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <button type="button" onClick={() => setViewing(null)}
                    className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft">Close</button>
                  <button type="button" onClick={() => printBarcodes([viewing])}
                    className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft">
                    <Printer className="size-4" aria-hidden /> Print barcode
                  </button>
                  {canWrite("Products") && (
                    <button type="button" onClick={() => { const p = viewing; setViewing(null); openForm(p) }}
                      className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">
                      <Pencil className="size-4" aria-hidden /> Edit product
                    </button>
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
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} disabled={importBusy}
            className="block w-full rounded-[10px] border border-dashed border-dash-border bg-dash-bg p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-dash-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
          {importBusy && <p className="text-sm text-dash-muted">Importing…</p>}
          {importResult && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Imported {importResult.imported}, skipped {importResult.skipped.length}</p>
              {(importResult.warnings?.length ?? 0) > 0 && (
                <ul className="max-h-32 overflow-y-auto rounded-[10px] border border-dash-border bg-dash-warn-soft text-xs text-dash-warn-fg">
                  {importResult.warnings!.map((w, i) => <li key={i} className="px-3 py-1.5">Row {w.row}: {w.message}</li>)}
                </ul>
              )}
              {importResult.skipped.length > 0 && (
                <ul className="max-h-48 overflow-y-auto rounded-[10px] border border-dash-border text-sm">
                  {importResult.skipped.map((r, i) => (
                    <li key={i} className="border-b border-dash-border-soft px-3 py-2 last:border-0">
                      <span className="font-semibold">Row {r.row}{r.name ? ` · ${r.name}` : ""}</span>
                      <span className="block text-xs text-dash-muted">{r.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <DialogFooter>
            <button type="button" onClick={() => setImportOpen(false)}
              className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft">Close</button>
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
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Location
              <Select value={adjustLoc} onValueChange={setAdjustLoc}>
                <SelectTrigger aria-label="Location" className={cn(filterSelect, "w-full")}><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Quantity change
              <input type="number" step={1} value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} placeholder="e.g. 5 to add, -3 to remove"
                className="h-[42px] rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent" />
            </label>
            {adjustTargets.length === 1 && adjustTargets[0].variants && adjustTargets[0].variants.length > 0 && (
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Variant
                <Select value={adjustVariant} onValueChange={setAdjustVariant}>
                  <SelectTrigger aria-label="Variant" className={cn(filterSelect, "w-full")}><SelectValue /></SelectTrigger>
                  <SelectContent>{adjustTargets[0].variants.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            )}
            {adjustTargets.length === 1 && adjustLoc && !adjustTargets[0].variants?.length && (
              <p className="text-xs text-dash-muted tabular-nums">
                Now {qtyAt(adjustTargets[0], adjustLoc)}
                {Number.isInteger(Number(adjustQty)) && adjustQty !== "" ? ` → ${qtyAt(adjustTargets[0], adjustLoc) + Number(adjustQty)}` : ""}
              </p>
            )}
            {adjustTargets.length > 1 && <p className="text-xs text-dash-muted">Bundles are skipped, and products with variants must be adjusted one at a time.</p>}
          </div>
          <DialogFooter>
            <button type="button" disabled={adjustBusy} onClick={() => setAdjustTargets([])} className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft">Cancel</button>
            <button type="button" disabled={adjustBusy} onClick={applyAdjust} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">{adjustBusy ? "Saving…" : "Apply"}</button>
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
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmDelete() }} disabled={deleting} className="bg-red-600 hover:bg-red-700">
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
