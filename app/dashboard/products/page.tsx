"use client"

import type React from "react"
import { useState, useMemo, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Edit2, Trash2, Eye, FilePen, Loader2, MessageSquare } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { exportToCSV, parseCSV } from "@/lib/export-import-utils"
import { usePagination } from "@/hooks/use-pagination"
import { StatusBadge } from "@/components/ui/status-badge"
import { useProduct, type Product } from "@/contexts/product-context"
import { useVendor } from "@/contexts/vendor-context"
import { useCategory } from "@/contexts/category-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useWarehouse } from "@/contexts/warehouse-context"
import { ProductFormDialog } from "./ProductFormDialog"
import { UpgradeRequiredModal } from "@/components/UpgradeRequiredModal"
import { ListPage, type Column, type FilterOption, type SortOption, type BulkAction, type Action } from "@/components/ListPage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCompanySettings } from "@/contexts/company-settings-context"
import saasCompanyApi, { type PlanLimits } from "@/lib/saasCompanyApi"

export default function ProductsPage() {
  const router = useRouter()
  const { products, addProduct, updateProduct, deleteProduct, isLoading } = useProduct()
  const { vendors } = useVendor()
  const { warehouses } = useWarehouse()
  const { categories, getAllCategoriesFlat } = useCategory()
  const { company, canRead, canWrite, canDelete } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedVendor, setSelectedVendor] = useState<string>("all")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [sortOption, setSortOption] = useState<string>("default")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false)
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)

  const allCategories = useMemo(() => getAllCategoriesFlat(), [categories])

  useEffect(() => {
    saasCompanyApi.getPlanLimits().then(setPlanLimits).catch(() => {})
  }, [])

  const blocked = useModuleGuard('Products')
  if (blocked) return blocked

  const matchesSelectedWarehouse = (product: Product, warehouseId: string) => {
    if (warehouseId === "all") return true

    if (product.locationId && String(product.locationId) === warehouseId) {
      return true
    }

    const selectedWh = warehouses.find(w => String(w.id) === warehouseId)
    if (selectedWh && product.locationName === selectedWh.name) {
      return true
    }

    if (product.inventory && product.inventory.length > 0) {
      return product.inventory.some(inv => String(inv.warehouseId) === warehouseId)
    }

    return false
  }

  // Define sort options with custom sort functions
  const sortOptions: SortOption[] = [
    { value: "default", label: "Default" },
    { value: "low-to-high", label: "Low to High", sortFn: (a: Product, b: Product) => a.salePrice - b.salePrice },
    { value: "high-to-low", label: "High to Low", sortFn: (a: Product, b: Product) => b.salePrice - a.salePrice },
    { value: "published", label: "Published", sortFn: (a: Product, b: Product) => (b.published ? 1 : 0) - (a.published ? 1 : 0) },
    { value: "unpublished", label: "Unpublished", sortFn: (a: Product, b: Product) => (a.published ? 1 : 0) - (b.published ? 1 : 0) },
    { value: "selling", label: "Status - Selling", sortFn: (a: Product, b: Product) => (a.status === "Selling" ? -1 : 0) - (b.status === "Selling" ? -1 : 0) },
    { value: "out-of-stock", label: "Status - Out of Stock", sortFn: (a: Product, b: Product) => (a.status === "Out of Stock" ? -1 : 0) - (b.status === "Out of Stock" ? -1 : 0) },
    { value: "date-added-asc", label: "Date Added (Asc)", sortFn: (a: Product, b: Product) => new Date(a.createdAt || "").getTime() - new Date(b.createdAt || "").getTime() },
    { value: "date-added-desc", label: "Date Added (Desc)", sortFn: (a: Product, b: Product) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime() },
    { value: "date-updated-asc", label: "Date Updated (Asc)", sortFn: (a: Product, b: Product) => new Date(a.updatedAt || "").getTime() - new Date(b.updatedAt || "").getTime() },
    { value: "date-updated-desc", label: "Date Updated (Desc)", sortFn: (a: Product, b: Product) => new Date(b.updatedAt || "").getTime() - new Date(a.updatedAt || "").getTime() },
  ]

  // Apply filtering and sorting manually
  const filteredAndSortedProducts = useMemo(() => {
    let result = products
      .filter((product) => {
        const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory
        const matchesVendor = selectedVendor === "all" || (product.vendorId && String(product.vendorId) === selectedVendor)
        const matchesWarehouse = matchesSelectedWarehouse(product, selectedWarehouse)

        return matchesCategory && matchesVendor && matchesWarehouse
      })

    // Apply sorting
    if (sortOption && sortOption !== "default") {
      const sortFn = sortOptions.find(s => s.value === sortOption)?.sortFn
      if (sortFn) {
        result.sort(sortFn)
      }
    }

    return result
  }, [products, selectedCategory, selectedVendor, selectedWarehouse, sortOption, warehouses])

  const {
    currentItems: currentProducts,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredAndSortedProducts, 10)

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setIsAddDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    await deleteProduct(id)
    setSelectedProducts(prev => prev.filter(sid => sid !== id))
  }

  const closeDialog = () => {
    setIsAddDialogOpen(false)
    setEditingProduct(null)
    setViewingProduct(null)
  }

  const handleExport = (data: Product[]) => {
    const exportData = data.map(product => ({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      sale_price: product.salePrice,
      stock: product.stock,
      status: product.status,
      published: product.published ? "Yes" : "No",
      sku: product.sku || "",
      barcode: product.barcode || "",
      description: product.description || "",
    }))
    const headers = ["ID", "Name", "Category", "Price", "Sale Price", "Stock", "Status", "Published", "SKU", "Barcode", "Description"]
    exportToCSV(exportData, "products", headers)
  }

  const handleImport = (callback: (data: any[]) => void) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".csv"
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const importedData = parseCSV(text)
        const newProducts = importedData.map(item => ({
          name: item.name,
          category: item.category,
          price: Number(item.price),
          salePrice: Number(item.sale_price),
          stock: Number(item.stock),
          status: (item.status || "Selling") as "Selling" | "Out of Stock" | "Discontinued",
          published: item.published === "Yes",
          image: "",
          sku: item.sku || "",
          barcode: item.barcode || "",
          description: item.description || "",
          vendorId: item.vendor_id || undefined,
        }))
        Promise.all(newProducts.map(product => addProduct(product)))
      }
      reader.readAsText(file)
    }
    input.click()
  }

  // Define columns for the ListPage
  const columns: Column[] = [
    {
      key: "name",
      label: "Product",
      width: "min-w-[180px] max-w-[220px]",
      render: (value, item: Product) => (
        <div className="flex items-center gap-2">
          <img
            src={item.image || "/placeholder.svg"}
            alt={item.name}
            className="w-9 h-9 rounded object-cover flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }}
          />
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate text-sm">{item.name}</p>
            <p className="text-xs text-gray-400 truncate">{item.category}</p>
          </div>
        </div>
      ),
    },
    {
      key: "price",
      label: "Price",
      width: "min-w-[90px]",
      render: (value) => <span className="text-sm text-gray-600">{formatCurrency(value || 0)}</span>,
    },
    {
      key: "salePrice",
      label: "Pricing",
      width: "min-w-[130px]",
      render: (value, item: Product) => {
        const offerFinal = item.offerPrice
          ? (item.offerType === "percentage" ? item.salePrice * (1 - item.offerPrice / 100) : item.salePrice - item.offerPrice)
          : null
        return (
          <div className="flex flex-col gap-0">
            {offerFinal ? (
              <>
                <span className="font-bold text-orange-600 text-sm">{formatCurrency(offerFinal)}</span>
                <span className="text-xs text-gray-400 line-through">{formatCurrency(item.salePrice)}</span>
                <span className="text-[10px] text-orange-500">{item.offerType === "percentage" ? `${item.offerPrice}% off` : `${formatCurrency(item.offerPrice!)} off`}</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-emerald-600 text-sm">{formatCurrency(item.salePrice || item.price)}</span>
                {item.price > item.salePrice && <span className="text-xs text-gray-400 line-through">{formatCurrency(item.price)}</span>}
              </>
            )}
          </div>
        )
      },
    },
    {
      key: "stock",
      label: "Stock",
      width: "min-w-[80px]",
      render: (value) => value < 5 ? (
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-orange-600">{value}</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500 text-white w-fit uppercase">Low</span>
        </div>
      ) : <span className="text-sm text-gray-600">{value}</span>,
    },
    {
      key: "vendorId",
      label: "Supplier",
      width: "min-w-[110px]",
      render: (value, item) => {
        const name = (item as any).vendorName || vendors.find(v => v.id === value)?.name
        return value && name ? (
          <Link href={`/dashboard/vendors/${value}`} className="text-emerald-600 hover:underline text-xs truncate block max-w-[100px]">
            {name}
          </Link>
        ) : value && !name ? (
          <span className="text-gray-500 text-xs truncate block max-w-[100px]">{name || "—"}</span>
        ) : <span className="text-gray-400 text-xs">—</span>
      },
    },
    {
      key: "locationName",
      label: "Location",
      width: "min-w-[100px]",
      render: (value, item: Product) =>
        <span className="text-xs text-gray-600">{value || (item.locationId ? warehouses.find(w => String(w.id) === item.locationId)?.name : null) || "—"}</span>,
    },
    {
      key: "status",
      label: "Status",
      width: "min-w-[100px]",
      render: (value) => <StatusBadge status={value} />,
    },
  ]

  // Define filters
  const filters: FilterOption[] = [
    {
      id: "category",
      label: "Category",
      value: selectedCategory,
      onChange: (v) => setSelectedCategory(v),
      options: allCategories.map(cat => ({
        value: String(cat.id),
        label: cat.parent_id !== null ? `  └─ ${cat.category_name}` : cat.category_name,
      })),
    },
    {
      id: "vendor",
      label: "Supplier",
      value: selectedVendor,
      onChange: (v) => setSelectedVendor(v),
      options: vendors.map(v => ({
        value: String(v.id),
        label: v.name,
      })),
    },
    {
      id: "warehouse",
      label: "Warehouse",
      value: selectedWarehouse,
      onChange: (v) => setSelectedWarehouse(v),
      predicate: (item, value) => matchesSelectedWarehouse(item as Product, value),
      options: warehouses.map(w => ({
        value: String(w.id),
        label: w.name,
      })),
    },
  ]

  // Define bulk actions
  const bulkActions: BulkAction[] = [
    ...(canWrite('Products') ? [
      {
        id: "publish",
        label: "Publish",
        onExecute: async (ids: string[]) => {
          await Promise.all(ids.map(id => {
            const product = products.find(p => p.id === id)
            return product ? updateProduct({ ...product, published: true }) : Promise.resolve()
          }))
        },
        confirmMessage: "Publish selected products?",
      },
      {
        id: "unpublish",
        label: "Unpublish",
        onExecute: async (ids: string[]) => {
          await Promise.all(ids.map(id => {
            const product = products.find(p => p.id === id)
            return product ? updateProduct({ ...product, published: false }) : Promise.resolve()
          }))
        },
        confirmMessage: "Unpublish selected products?",
      },
    ] : []),
    ...(canDelete('Products') ? [{
      id: "delete",
      label: "Delete",
      onExecute: async (ids: string[]) => {
        await Promise.all(ids.map(id => deleteProduct(id)))
      },
      confirmMessage: "Delete selected products? This action cannot be undone.",
    }] : []),
  ]

  // Define actions
  const actions: Action[] = [
    {
      id: "view",
      label: "View",
      icon: <Eye className="w-4 h-4" />,
      onClick: (item) => setViewingProduct(item),
      className: "text-gray-500 hover:text-gray-700 hover:bg-transparent",
    },
    {
      id: "reviews",
      label: "Reviews",
      icon: <MessageSquare className="w-4 h-4" />,
      onClick: (item) => {
        router.push(`/dashboard/products/${item.id}/reviews`)
      },
      className: "text-gray-500 hover:text-gray-700 hover:bg-transparent",
    },
    ...(canWrite('Products') ? [{
      id: "edit",
      label: "Edit",
      icon: <Edit2 className="w-4 h-4" />,
      onClick: (item: any) => handleEdit(item),
      className: "text-gray-500 hover:text-gray-700 hover:bg-transparent",
    }] : []),
    ...(canDelete('Products') ? [{
      id: "delete",
      label: "Delete",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: (item: any) => handleDelete(item.id),
      className: "text-gray-500 hover:text-red-600 hover:bg-transparent",
    }] : []),
  ]

  return (
    <>
      <ListPage
        title="Products"
        description={planLimits ? `${planLimits.currentProducts} / ${planLimits.maxProducts} products used` : undefined}
        data={filteredAndSortedProducts}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Search by name or category..."
        searchFields={["name", "category"]}
        filters={filters}
        sortOptions={sortOptions}
        sortValue={sortOption}
        onSortChange={setSortOption}
        onSearch={setSearchQuery}
        onFilterChange={() => setCurrentPage(1)}
        actions={actions}
        onAddClick={canWrite('Products') ? () => {
          const atLimit = planLimits ? !planLimits.canAddProduct : (company?.maxProducts ? products.length >= company.maxProducts : false)
          if (atLimit) {
            setIsUpgradeModalOpen(true)
          } else {
            setIsAddDialogOpen(true)
          }
        } : undefined}
        addButtonLabel="Add Product"
        bulkActions={bulkActions}
        enableCheckboxes={true}
        onExport={handleExport}
        onImport={handleImport}
        exportFileName="products"
        pageSize={itemsPerPage}
        currentPage={currentPage}
        totalItems={filteredAndSortedProducts.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={handleItemsPerPageChange}
        emptyMessage="No products found"
      />

      {/* Add / Edit Product Dialog */}
      <ProductFormDialog
        open={isAddDialogOpen}
        editingProduct={editingProduct}
        onClose={closeDialog}
      />

      {/* View Product Details Dialog */}
      <Dialog open={!!viewingProduct} onOpenChange={() => setViewingProduct(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" showCloseButton={false}>
          <DialogTitle className="sr-only">Product Details</DialogTitle>
          {viewingProduct && (() => {
            const offerFinal = viewingProduct.offerPrice
              ? (viewingProduct.offerType === "percentage"
                  ? viewingProduct.salePrice * (1 - viewingProduct.offerPrice / 100)
                  : viewingProduct.salePrice - viewingProduct.offerPrice)
              : null
            return (
              <>
                {/* Hero header */}
                <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white">
                  <button
                    onClick={closeDialog}
                    className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                    aria-label="Close"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </button>
                  <div className="flex items-start gap-5">
                    <div className="relative shrink-0">
                      <img
                        src={viewingProduct.image || "/placeholder.svg"}
                        alt={viewingProduct.name}
                        className="w-24 h-24 rounded-xl object-cover border-2 border-white/20 shadow-lg"
                      />
                      {viewingProduct.isHotDeal && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">HOT</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{viewingProduct.category || "—"}</p>
                      <h3 className="text-2xl font-bold text-white mb-2 leading-tight">{viewingProduct.name}</h3>
                      {viewingProduct.description && <p className="text-sm text-slate-300 line-clamp-2">{viewingProduct.description}</p>}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${viewingProduct.status === "Selling" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : viewingProduct.status === "Out of Stock" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-gray-500/20 text-gray-300 border border-gray-500/30"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${viewingProduct.status === "Selling" ? "bg-emerald-400" : viewingProduct.status === "Out of Stock" ? "bg-red-400" : "bg-gray-400"}`} />
                          {viewingProduct.status}
                        </span>
                        <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full ${viewingProduct.published ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-gray-500/20 text-gray-300 border border-gray-500/30"}`}>
                          {viewingProduct.published ? "Published" : "Draft"}
                        </span>
                        {viewingProduct.isBestSeller && <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">Best Seller</span>}
                        {viewingProduct.isFeatured && <span className="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Featured</span>}
                      </div>
                    </div>
                    {/* Price block */}
                    <div className="shrink-0 text-right">
                      {offerFinal ? (
                        <>
                          <p className="text-2xl font-black text-orange-400">{formatCurrency(offerFinal)}</p>
                          <p className="text-sm text-slate-400 line-through">{formatCurrency(viewingProduct.salePrice)}</p>
                          <span className="inline-block mt-1 bg-orange-500/20 text-orange-300 border border-orange-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                            {viewingProduct.offerType === "percentage" ? `${viewingProduct.offerPrice}% OFF` : `${formatCurrency(viewingProduct.offerPrice!)} OFF`}
                          </span>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-black text-emerald-400">{formatCurrency(viewingProduct.salePrice)}</p>
                          {viewingProduct.price > viewingProduct.salePrice && <p className="text-sm text-slate-400 line-through">{formatCurrency(viewingProduct.price)}</p>}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1">
                  {/* Info grid */}
                  <div className="p-6 grid grid-cols-3 gap-4">
                    {[
                      { label: "Category", value: viewingProduct.category || allCategories.find(c => c.id === viewingProduct.categoryId)?.category_name || "—" },
                      { label: "Supplier", value: viewingProduct.vendorName || vendors.find(v => v.id === viewingProduct.vendorId)?.name || "—" },
                      { label: "Location", value: viewingProduct.locationName || warehouses.find(w => String(w.id) === viewingProduct.locationId)?.name || "—" },
                      { label: "Stock", value: `${viewingProduct.stock} units`, highlight: viewingProduct.stock < 5 ? "red" : viewingProduct.stock < 20 ? "amber" : "green" },
                      { label: "SKU", value: viewingProduct.sku || "—", mono: true },
                      { label: "Barcode", value: viewingProduct.barcode || "—", mono: true },
                      { label: "List Price", value: formatCurrency(viewingProduct.price) },
                      { label: "Sale Price", value: formatCurrency(viewingProduct.salePrice), highlight: "green" },
                      ...(viewingProduct.offerPrice ? [{ label: "Offer Price", value: formatCurrency(offerFinal!), sub: viewingProduct.offerType === "percentage" ? `${viewingProduct.offerPrice}% off` : `${formatCurrency(viewingProduct.offerPrice!)} off`, highlight: "orange" as const }] : []),
                      ...(viewingProduct.receiptNumber ? [{ label: "Receipt No.", value: viewingProduct.receiptNumber, mono: true }] : []),
                    ].map(({ label, value, highlight, mono, sub }) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-3.5 border border-gray-100">
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{label}</p>
                        <p className={`font-bold text-sm ${mono ? "font-mono" : ""} ${highlight === "green" ? "text-emerald-600" : highlight === "red" ? "text-red-600" : highlight === "amber" ? "text-amber-600" : highlight === "orange" ? "text-orange-600" : "text-gray-900"}`}>
                          {value}
                        </p>
                        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
                      </div>
                    ))}
                  </div>

                  {/* Variants */}
                  {viewingProduct.variants && viewingProduct.variants.length > 0 && (
                    <div className="px-6 pb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Variants</h4>
                        <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{viewingProduct.variants.length}</span>
                      </div>
                      <div className="rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
                        <table className="w-full text-sm min-w-[520px]">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[22%]">Variant</th>
                              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[28%]">SKU</th>
                              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-[14%]">Price</th>
                              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-[14%]">Sale</th>
                              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-[14%]">Offer</th>
                              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-[8%]">Stock</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {viewingProduct.variants.map((variant, idx) => {
                              const vOffer = variant.offerPrice ?? viewingProduct.offerPrice
                              const vOfferType = variant.offerType ?? viewingProduct.offerType ?? "percentage"
                              const vBase = variant.salePrice || variant.price
                              const vFinal = vOffer ? (vOfferType === "percentage" ? vBase * (1 - vOffer / 100) : vBase - vOffer) : null
                              return (
                                <tr key={variant.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                  <td className="px-3 py-2.5 font-semibold text-gray-800 text-xs">{variant.name}</td>
                                  <td className="px-3 py-2.5 font-mono text-[11px] text-gray-400 truncate max-w-0">{variant.sku || "—"}</td>
                                  <td className="px-3 py-2.5 text-right text-xs text-gray-500">{formatCurrency(variant.price)}</td>
                                  <td className="px-3 py-2.5 text-right text-xs font-semibold text-emerald-600">{formatCurrency(variant.salePrice || variant.price)}</td>
                                  <td className="px-3 py-2.5 text-right">
                                    {vFinal ? (
                                      <div>
                                        <span className="font-bold text-orange-600 text-xs">{formatCurrency(vFinal)}</span>
                                        <span className="block text-[10px] text-gray-400 leading-tight">{vOfferType === "percentage" ? `${vOffer}% off` : `${formatCurrency(vOffer!)} off`}</span>
                                      </div>
                                    ) : <span className="text-gray-300 text-xs">—</span>}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {variant.stock > 0
                                      ? <span className="inline-flex items-center justify-center gap-1 w-full">
                                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                          <span className="text-xs font-bold text-emerald-700">{variant.stock}</span>
                                        </span>
                                      : <span className="inline-flex items-center justify-center gap-1 w-full">
                                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                          <span className="text-xs font-bold text-red-600">0</span>
                                        </span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setViewingProduct(null)}>Close</Button>
                  {canWrite('Products') && (
                    <Button
                      onClick={() => { if (viewingProduct) { setViewingProduct(null); handleEdit(viewingProduct) } }}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Product
                    </Button>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Upgrade Required Modal */}
      <UpgradeRequiredModal
        open={isUpgradeModalOpen}
        onOpenChange={setIsUpgradeModalOpen}
        title="Product Limit Reached"
        description={`Your current plan allows up to ${company?.maxProducts} products. Please upgrade to add more.`}
        limitType="products"
        currentLimit={company?.maxProducts}
      />
    </>
  )
}
