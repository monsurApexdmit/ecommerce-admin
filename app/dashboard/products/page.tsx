"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Search, Upload, Download, Edit2, Trash2, Eye, FilePen, Plus, Barcode } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { exportToCSV, parseCSV } from "@/lib/export-import-utils"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusBadge } from "@/components/ui/status-badge"
import { useProduct, type Product } from "@/contexts/product-context"
import { useVendor } from "@/contexts/vendor-context"
import { useCategory } from "@/contexts/category-context"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useWarehouse } from "@/contexts/warehouse-context"
import { ProductFormDialog } from "./ProductFormDialog"

export default function ProductsPage() {
  const { products, addProduct, updateProduct, deleteProduct, isLoading } = useProduct()
  const { vendors } = useVendor()
  const { warehouses } = useWarehouse()
  const { categories, getAllCategoriesFlat } = useCategory()

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedVendor, setSelectedVendor] = useState<string>("all")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [sortOption, setSortOption] = useState<string>("default")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState("")
  const [bulkStatus, setBulkStatus] = useState("")
  const [bulkCategory, setBulkCategory] = useState("")

  const allCategories = useMemo(() => getAllCategoriesFlat(), [categories])

  const filteredProducts = useMemo(() => products
    .filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === "all" || product.category === selectedCategory
      const matchesVendor = selectedVendor === "all" || product.vendorId === selectedVendor
      const matchesWarehouse = selectedWarehouse === "all" || (
        product.inventory && product.inventory.some(i => i.warehouseId === selectedWarehouse && i.quantity > 0)
      )
      let matchesStatus = true
      if (sortOption === "published") matchesStatus = product.published === true
      else if (sortOption === "unpublished") matchesStatus = product.published === false
      else if (sortOption === "selling") matchesStatus = product.status === "Selling"
      else if (sortOption === "out-of-stock") matchesStatus = product.status === "Out of Stock"
      return matchesSearch && matchesCategory && matchesVendor && matchesWarehouse && matchesStatus
    })
    .sort((a, b) => {
      if (sortOption === "low-to-high") return a.salePrice - b.salePrice
      if (sortOption === "high-to-low") return b.salePrice - a.salePrice
      if (sortOption === "date-added-asc") return new Date(a.createdAt || "").getTime() - new Date(b.createdAt || "").getTime()
      if (sortOption === "date-added-desc") return new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime()
      if (sortOption === "date-updated-asc") return new Date(a.updatedAt || "").getTime() - new Date(b.updatedAt || "").getTime()
      if (sortOption === "date-updated-desc") return new Date(b.updatedAt || "").getTime() - new Date(a.updatedAt || "").getTime()
      return 0
    }), [products, searchQuery, selectedCategory, selectedVendor, selectedWarehouse, sortOption])

  const {
    currentItems: currentProducts,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredProducts, 10)

  const handleFilterChange = () => setCurrentPage(1)

  const handleSelectAll = (checked: boolean) => {
    setSelectedProducts(checked ? currentProducts.map(p => p.id) : [])
  }

  const handleSelectProduct = (productId: string, checked: boolean) => {
    setSelectedProducts(prev => checked ? [...prev, productId] : prev.filter(id => id !== productId))
  }

  const handleTogglePublished = async (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) await updateProduct({ ...product, published: !product.published })
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setIsAddDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    await deleteProduct(id)
    setSelectedProducts(prev => prev.filter(sid => sid !== id))
  }

  const handleBulkDelete = async () => {
    await Promise.all(selectedProducts.map(id => deleteProduct(id)))
    setSelectedProducts([])
  }

  const closeDialog = () => {
    setIsAddDialogOpen(false)
    setEditingProduct(null)
  }

  const handleExport = () => {
    const exportData = filteredProducts.map(product => ({
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

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
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
      setIsImportDialogOpen(false)
    }
    reader.readAsText(file)
  }

  const handleBulkAction = async () => {
    if (!bulkAction || selectedProducts.length === 0) return
    if (bulkAction === "delete") {
      await handleBulkDelete()
    } else if (bulkAction === "status" && bulkStatus) {
      await Promise.all(selectedProducts.map(id => {
        const product = products.find(p => p.id === id)
        return product ? updateProduct({ ...product, status: bulkStatus as any }) : Promise.resolve()
      }))
      setSelectedProducts([])
    } else if (bulkAction === "category" && bulkCategory) {
      await Promise.all(selectedProducts.map(id => {
        const product = products.find(p => p.id === id)
        return product ? updateProduct({ ...product, category: bulkCategory }) : Promise.resolve()
      }))
      setSelectedProducts([])
    } else if (bulkAction === "publish") {
      await Promise.all(selectedProducts.map(id => {
        const product = products.find(p => p.id === id)
        return product ? updateProduct({ ...product, published: true }) : Promise.resolve()
      }))
      setSelectedProducts([])
    } else if (bulkAction === "unpublish") {
      await Promise.all(selectedProducts.map(id => {
        const product = products.find(p => p.id === id)
        return product ? updateProduct({ ...product, published: false }) : Promise.resolve()
      }))
      setSelectedProducts([])
    }
    setIsBulkActionDialogOpen(false)
    setBulkAction("")
    setBulkStatus("")
    setBulkCategory("")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-gray-700 bg-transparent" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="text-gray-700 bg-transparent" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-orange-600 border-orange-200 bg-orange-50"
            onClick={() => setIsBulkActionDialogOpen(true)}
            disabled={selectedProducts.length === 0}
          >
            <FilePen className="w-4 h-4 mr-2" />
            Bulk Action
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 bg-red-50"
            onClick={handleBulkDelete}
            disabled={selectedProducts.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search Product"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); handleFilterChange() }}
              className="pl-10"
            />
          </div>

          <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); handleFilterChange() }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCategories.map(cat => (
                <SelectItem key={cat.id} value={cat.category_name} textValue={cat.category_name}>
                  {cat.parent_id !== null ? `  └─ ${cat.category_name}` : cat.category_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedVendor} onValueChange={(v) => { setSelectedVendor(v); handleFilterChange() }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vendor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map(vendor => (
                <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedWarehouse} onValueChange={(v) => { setSelectedWarehouse(v); handleFilterChange() }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map(w => (
                <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortOption} onValueChange={(v) => { setSortOption(v); handleFilterChange() }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="low-to-high">Low to High</SelectItem>
              <SelectItem value="high-to-low">High to Low</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="unpublished">Unpublished</SelectItem>
              <SelectItem value="selling">Status - Selling</SelectItem>
              <SelectItem value="out-of-stock">Status - Out of Stock</SelectItem>
              <SelectItem value="date-added-asc">Date Added (Asc)</SelectItem>
              <SelectItem value="date-added-desc">Date Added (Desc)</SelectItem>
              <SelectItem value="date-updated-asc">Date Updated (Asc)</SelectItem>
              <SelectItem value="date-updated-desc">Date Updated (Desc)</SelectItem>
            </SelectContent>
          </Select>

          <Button className="bg-emerald-600 hover:bg-emerald-700">Filter</Button>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery(""); setSelectedCategory("all"); setSelectedVendor("all")
              setSelectedWarehouse("all"); setSortOption("default"); handleFilterChange()
            }}
          >
            Reset
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <Checkbox
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Product Name</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Receipt No.</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Category</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Price</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Sale Price</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Stock</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Vendor</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Location</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">View</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Published</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 3 }).map((_, index) => (
                  <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-4"><Skeleton className="h-4 w-4 rounded" /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded object-cover" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="py-3 px-4 text-center"><Skeleton className="h-5 w-5 mx-auto" /></td>
                    <td className="py-3 px-4 text-center"><Skeleton className="h-6 w-11 rounded-full mx-auto" /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-4" />
                      </div>
                    </td>
                  </tr>
                ))
                : currentProducts.map(product => (
                  <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img src={product.image || "/placeholder.svg"} alt={product.name} className="w-10 h-10 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }} />
                        <span className="font-medium text-gray-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{product.receiptNumber || "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{product.category}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">${product.price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">${product.salePrice.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      {product.stock < 5 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-orange-600 text-base">{product.stock}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white w-fit tracking-wide uppercase shadow-sm">Low Stock</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600">{product.stock}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {product.vendorId ? (
                        <Link href={`/dashboard/vendors/${product.vendorId}`} className="text-emerald-600 hover:underline">
                          {vendors.find(v => v.id === product.vendorId)?.name || "Unknown"}
                        </Link>
                      ) : (
                        <span className="text-gray-400">No Vendor</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {product.locationName || (product.locationId ? warehouses.find(w => String(w.id) === product.locationId)?.name : null) || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button variant="ghost" size="icon" onClick={() => setViewingProduct(product)} className="text-gray-400 hover:text-emerald-600">
                        <Eye className="w-5 h-5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-blue-600" title="Print Label" asChild>
                        <Link href={`/dashboard/products/${product.id}/barcode`}>
                          <Barcode className="w-4 h-4" />
                        </Link>
                      </Button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Switch
                        checked={product.published}
                        onCheckedChange={() => handleTogglePublished(product.id)}
                        className="data-[state=checked]:bg-emerald-600"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(product)} className="text-gray-400 hover:text-emerald-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="text-gray-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No products found</p>
          </div>
        )}
      </Card>

      <PaginationControl
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={filteredProducts.length}
      />

      {/* Add / Edit Product Dialog — isolated component to prevent input lag */}
      <ProductFormDialog
        open={isAddDialogOpen}
        editingProduct={editingProduct}
        onClose={closeDialog}
      />

      {/* View Product Details */}
      <Dialog open={!!viewingProduct} onOpenChange={() => setViewingProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="text-2xl">Product Details</DialogTitle>
          </DialogHeader>
          {viewingProduct && (
            <div className="space-y-6 p-6 overflow-y-auto flex-1">
              <div className="flex items-start gap-6">
                <img
                  src={viewingProduct.image || "/placeholder.svg"}
                  alt={viewingProduct.name}
                  className="w-32 h-32 rounded-lg object-cover border"
                />
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{viewingProduct.name}</h3>
                    <p className="text-sm text-gray-600">{viewingProduct.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-emerald-100 text-emerald-700">
                      {viewingProduct.status}
                    </span>
                    <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${viewingProduct.published ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                      {viewingProduct.published ? "Published" : "Draft"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Category</p>
                  <p className="font-semibold text-gray-900">{viewingProduct.category || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Vendor</p>
                  <p className="font-semibold text-gray-900">
                    {viewingProduct.vendorId ? (vendors.find(v => v.id === viewingProduct.vendorId)?.name || viewingProduct.vendorId) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Location</p>
                  <p className="font-semibold text-gray-900">
                    {viewingProduct.locationName || (viewingProduct.locationId ? warehouses.find(w => String(w.id) === viewingProduct.locationId)?.name : null) || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Stock</p>
                  <p className="font-semibold text-gray-900">{viewingProduct.stock} units</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Price</p>
                  <p className="font-semibold text-gray-900">${viewingProduct.price.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Sale Price</p>
                  <p className="font-semibold text-emerald-600">${viewingProduct.salePrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">SKU</p>
                  <p className="font-semibold text-gray-900">{viewingProduct.sku || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Barcode</p>
                  <p className="font-semibold text-gray-900">{viewingProduct.barcode || "-"}</p>
                </div>
                {viewingProduct.receiptNumber && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Receipt Number</p>
                    <p className="font-semibold text-gray-900">{viewingProduct.receiptNumber}</p>
                  </div>
                )}
              </div>
              {viewingProduct.variants && viewingProduct.variants.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <h4 className="text-lg font-semibold mb-3">Variants</h4>
                  <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="p-2 text-left">Variant</th>
                          <th className="p-2 text-left">SKU</th>
                          <th className="p-2 text-left">Product Price</th>
                          <th className="p-2 text-left">Sale Price</th>
                          <th className="p-2 text-left">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingProduct.variants.map(variant => (
                          <tr key={variant.id} className="border-b last:border-0 hover:bg-gray-50 bg-white">
                            <td className="p-2 font-medium">{variant.name}</td>
                            <td className="p-2 text-gray-600">{variant.sku}</td>
                            <td className="p-2 font-medium">${variant.price}</td>
                            <td className="p-2 font-medium text-emerald-600">${variant.salePrice || variant.price}</td>
                            <td className="p-2">
                              {variant.stock > 0 ? (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">{variant.stock} in stock</Badge>
                              ) : (
                                <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Out of stock</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="p-6 border-t">
            <Button variant="outline" onClick={() => setViewingProduct(null)}>Close</Button>
            <Button
              onClick={() => { if (viewingProduct) { setViewingProduct(null); handleEdit(viewingProduct) } }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Products</DialogTitle>
            <DialogDescription>Upload a CSV file to import products</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>CSV File</Label>
              <Input type="file" accept=".csv" onChange={handleImport} />
              <p className="text-sm text-gray-500">
                Upload a CSV file with columns: Name, Category, Price, Sale Price, Stock, Status, Published, SKU, Barcode, Description
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Dialog */}
      <Dialog open={isBulkActionDialogOpen} onOpenChange={setIsBulkActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Actions</DialogTitle>
            <DialogDescription>Apply actions to {selectedProducts.length} selected product(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger><SelectValue placeholder="Select action" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">Change Status</SelectItem>
                  <SelectItem value="category">Change Category</SelectItem>
                  <SelectItem value="publish">Publish</SelectItem>
                  <SelectItem value="unpublish">Unpublish</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bulkAction === "status" && (
              <div className="space-y-2">
                <Label>New Status</Label>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Selling">Selling</SelectItem>
                    <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                    <SelectItem value="Discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {bulkAction === "category" && (
              <div className="space-y-2">
                <Label>New Category</Label>
                <Select value={bulkCategory} onValueChange={setBulkCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.category_name} textValue={cat.category_name}>
                        {cat.parent_id !== null ? `  └─ ${cat.category_name}` : cat.category_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkActionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkAction} className="bg-emerald-600 hover:bg-emerald-700" disabled={!bulkAction}>
              Apply Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
