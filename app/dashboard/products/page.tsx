"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Edit2, Trash2, Eye, FilePen, Loader2 } from "lucide-react"
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
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useWarehouse } from "@/contexts/warehouse-context"
import { ProductFormDialog } from "./ProductFormDialog"
import { UpgradeRequiredModal } from "@/components/UpgradeRequiredModal"
import { ListPage, type Column, type FilterOption, type SortOption, type BulkAction, type Action } from "@/components/ListPage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ProductsPage() {
  const { products, addProduct, updateProduct, deleteProduct, isLoading } = useProduct()
  const { vendors } = useVendor()
  const { warehouses } = useWarehouse()
  const { categories, getAllCategoriesFlat } = useCategory()
  const { company } = useSaasAuth()

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

  const allCategories = useMemo(() => getAllCategoriesFlat(), [categories])

  // Apply filtering and sorting manually
  const filteredAndSortedProducts = useMemo(() => {
    let result = products
      .filter((product) => {
        const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory
        const matchesVendor = selectedVendor === "all" || (product.vendorId && String(product.vendorId) === selectedVendor)

        // Warehouse matching
        let matchesWarehouse = false

        if (selectedWarehouse === "all") {
          // Show all products when "All Warehouses" is selected
          matchesWarehouse = true
        } else {
          // Try to match by location ID first
          if (product.locationId && String(product.locationId) === selectedWarehouse) {
            matchesWarehouse = true
          } else {
            // Try to match by location name
            const selectedWh = warehouses.find(w => String(w.id) === selectedWarehouse)
            if (selectedWh && product.locationName === selectedWh.name) {
              matchesWarehouse = true
            }
          }

          // Also check inventory array for warehouse match
          if (!matchesWarehouse && product.inventory && product.inventory.length > 0) {
            matchesWarehouse = product.inventory.some(inv => String(inv.warehouseId) === selectedWarehouse)
          }
        }

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
  }, [products, selectedCategory, selectedVendor, selectedWarehouse, sortOption])

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
      label: "Product Name",
      width: "min-w-[200px]",
      render: (value, item: Product) => (
        <div className="flex items-center gap-3">
          <img
            src={item.image || "/placeholder.svg"}
            alt={item.name}
            className="w-10 h-10 rounded object-cover flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }}
          />
          <span className="font-medium text-gray-900 truncate">{item.name}</span>
        </div>
      ),
    },
    { key: "receiptNumber", label: "Receipt No.", width: "min-w-[100px]", render: (v) => v || "-" },
    { key: "category", label: "Category", width: "min-w-[120px]" },
    {
      key: "price",
      label: "Price",
      width: "min-w-[90px]",
      render: (value) => `$${(value || 0).toFixed(2)}`,
    },
    {
      key: "salePrice",
      label: "Sale Price",
      width: "min-w-[100px]",
      render: (value, item: Product) => `$${(value || item.price || 0).toFixed(2)}`,
    },
    {
      key: "stock",
      label: "Stock",
      width: "min-w-[80px]",
      render: (value) => {
        if (value < 5) {
          return (
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-orange-600 text-base">{value}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500 text-white w-fit tracking-wide uppercase shadow-sm">Low Stock</span>
            </div>
          )
        }
        return <span className="text-sm text-gray-600">{value}</span>
      },
    },
    {
      key: "vendorId",
      label: "Vendor",
      width: "min-w-[120px]",
      render: (value, item: Product) =>
        value ? (
          <Link href={`/dashboard/vendors/${value}`} className="text-emerald-600 hover:underline truncate">
            {vendors.find(v => v.id === value)?.name || "Unknown"}
          </Link>
        ) : (
          <span className="text-gray-400">No Vendor</span>
        ),
    },
    {
      key: "locationName",
      label: "Location",
      width: "min-w-[120px]",
      render: (value, item: Product) =>
        value || (item.locationId ? warehouses.find(w => String(w.id) === item.locationId)?.name : null) || "-",
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
      label: "Vendor",
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
      options: warehouses.map(w => ({
        value: String(w.id),
        label: w.name,
      })),
    },
  ]

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

  // Define bulk actions
  const bulkActions: BulkAction[] = [
    {
      id: "publish",
      label: "Publish",
      onExecute: async (ids) => {
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
      onExecute: async (ids) => {
        await Promise.all(ids.map(id => {
          const product = products.find(p => p.id === id)
          return product ? updateProduct({ ...product, published: false }) : Promise.resolve()
        }))
      },
      confirmMessage: "Unpublish selected products?",
    },
    {
      id: "delete",
      label: "Delete",
      onExecute: async (ids) => {
        await Promise.all(ids.map(id => deleteProduct(id)))
      },
      confirmMessage: "Delete selected products? This action cannot be undone.",
    },
  ]

  // Define actions
  const actions: Action[] = [
    {
      id: "view",
      label: "View",
      icon: <Eye className="w-4 h-4" />,
      onClick: (item) => setViewingProduct(item),
    },
    {
      id: "edit",
      label: "Edit",
      icon: <Edit2 className="w-4 h-4" />,
      onClick: (item) => handleEdit(item),
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: (item) => handleDelete(item.id),
      variant: "destructive",
    },
  ]

  return (
    <>
      <ListPage
        title="Products"
        data={filteredAndSortedProducts}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Search by name or category..."
        searchFields={["name", "category"]}
        filters={filters}
        sortOptions={sortOptions}
        onSearch={setSearchQuery}
        onFilterChange={() => setCurrentPage(1)}
        actions={actions}
        onAddClick={() => {
          if (company?.maxProducts && products.length >= company.maxProducts) {
            setIsUpgradeModalOpen(true)
          } else {
            setIsAddDialogOpen(true)
          }
        }}
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
                  <p className="font-semibold text-gray-900">{viewingProduct.category || (viewingProduct.categoryId ? allCategories.find(c => c.id === viewingProduct.categoryId)?.category_name : null) || "-"}</p>
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
                  <p className="font-semibold text-gray-900">${(viewingProduct.price ?? 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Sale Price</p>
                  <p className="font-semibold text-emerald-600">${(viewingProduct.salePrice ?? 0).toFixed(2)}</p>
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
