"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Search, Upload, Download, Edit2, Trash2, Eye, FilePen, Plus, CloudUpload, QrCode } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { exportToCSV, parseCSV, generateId } from "@/lib/export-import-utils"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusBadge } from "@/components/ui/status-badge"
import { useProduct, type Product, type Variant } from "@/contexts/product-context"
import { useVendor } from "@/contexts/vendor-context"
import { useAttribute } from "@/contexts/attribute-context"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useWarehouse } from "@/contexts/warehouse-context"



export default function ProductsPage() {
  const { products, addProduct, updateProduct, deleteProduct } = useProduct()
  const { vendors } = useVendor()
  const { warehouses } = useWarehouse()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedVendor, setSelectedVendor] = useState<string>("all")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [sortOption, setSortOption] = useState<string>("default")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    price: "",
    salePrice: "",
    stock: "",
    sku: "",
    barcode: "",
    vendorId: "",
    receiptNumber: "",
    warehouseId: "wh_main"
  })
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const { attributes: globalAttributes } = useAttribute()
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([])
  const [productAttributes, setProductAttributes] = useState<{ id: string; name: string; value: string | string[] }[]>([])
  const [generatedVariants, setGeneratedVariants] = useState<Variant[]>([])

  // Real-time stock sync
  // Real-time stock sync
  useEffect(() => {
    if (generatedVariants.length > 0) {
      const totalStock = generatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
      setFormData(prev => ({ ...prev, stock: String(totalStock) }))
    }
  }, [generatedVariants])

  const [bulkAction, setBulkAction] = useState("")
  const [bulkStatus, setBulkStatus] = useState("")
  const [bulkCategory, setBulkCategory] = useState("")

  const filteredProducts = products
    .filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === "all" || product.category === selectedCategory
      const matchesVendor = selectedVendor === "all" || product.vendorId === selectedVendor
      const matchesWarehouse = selectedWarehouse === "all" || (
        product.inventory && product.inventory.some(i => i.warehouseId === selectedWarehouse && i.quantity > 0)
      ) || (!product.inventory && selectedWarehouse === "wh_main") // Fallback for pure main

      let matchesStatus = true
      // Handle status/published filters from sortOption
      if (sortOption === "published") {
        matchesStatus = product.published === true
      } else if (sortOption === "unpublished") {
        matchesStatus = product.published === false
      } else if (sortOption === "selling") {
        matchesStatus = product.status === "Selling"
      } else if (sortOption === "out-of-stock") {
        matchesStatus = product.status === "Out of Stock"
      }

      return matchesSearch && matchesCategory && matchesVendor && matchesWarehouse && matchesStatus
    })
    .sort((a, b) => {
      if (sortOption === "low-to-high") {
        return a.salePrice - b.salePrice
      } else if (sortOption === "high-to-low") {
        return b.salePrice - a.salePrice
      } else if (sortOption === "date-added-asc") {
        return new Date(a.createdAt || "").getTime() - new Date(b.createdAt || "").getTime()
      } else if (sortOption === "date-added-desc") {
        return new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime()
      } else if (sortOption === "date-updated-asc") {
        return new Date(a.updatedAt || "").getTime() - new Date(b.updatedAt || "").getTime()
      } else if (sortOption === "date-updated-desc") {
        return new Date(b.updatedAt || "").getTime() - new Date(a.updatedAt || "").getTime()
      }
      return 0
    })

  // Pagination
  const {
    currentItems: currentProducts,
    currentPage,
    totalPages,
    itemsPerPage,
    goToPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredProducts, 10)

  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 2000)
    return () => clearTimeout(timer)
  }, [])



  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(currentProducts.map((p) => p.id))
    } else {
      setSelectedProducts([])
    }
  }

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProducts([...selectedProducts, productId])
    } else {
      setSelectedProducts(selectedProducts.filter((id) => id !== productId))
    }
  }

  const handleTogglePublished = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    if (product) {
      updateProduct({ ...product, published: !product.published })
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setUploadedImages(product.image ? [product.image] : [])
    setFormData({
      name: product.name,
      description: product.description,
      category: product.category,
      price: String(product.price),
      salePrice: String(product.salePrice),
      stock: String(product.stock),
      sku: product.sku,
      barcode: product.barcode,
      vendorId: product.vendorId || "",
      receiptNumber: product.receiptNumber || "",
      warehouseId: product.inventory?.[0]?.warehouseId || "wh_main",
    })

    // Load attributes and variants
    if (product.attributes && product.attributes.length > 0) {
      // Map existing attributes to ensure we have the correct structure
      // We need to match them with global attributes to get generated variant logic working
      setProductAttributes(product.attributes)

      // Essential: Set selectedAttributeIds so checkboxes are checked
      setSelectedAttributeIds(product.attributes.map(a => a.id))
    } else {
      setProductAttributes([])
      setSelectedAttributeIds([])
    }

    if (product.variants && product.variants.length > 0) {
      setGeneratedVariants(product.variants)
    } else {
      setGeneratedVariants([])
    }

    setIsAddDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    deleteProduct(id)
    setSelectedProducts(selectedProducts.filter((sid) => sid !== id))
  }

  const handleBulkDelete = () => {
    selectedProducts.forEach(id => deleteProduct(id))
    setSelectedProducts([])
  }

  const handleAdd = () => {
    if (!formData.name || !formData.category || !formData.price || !formData.salePrice || !formData.stock) return

    // Calculate total stock from variants if they exist
    let finalStock = Number.parseInt(formData.stock)
    if (generatedVariants.length > 0) {
      finalStock = generatedVariants.reduce((sum, v) => sum + v.stock, 0)
    }

    const newProduct: Product = {
      id: String(Date.now()),
      name: formData.name,
      description: formData.description,
      category: formData.category,
      price: Number.parseFloat(formData.price),
      salePrice: Number.parseFloat(formData.salePrice),
      stock: finalStock,
      status: finalStock > 0 ? "Selling" : "Out of Stock",
      published: true,
      image:
        uploadedImages[0] ||
        `/placeholder.svg?height=40&width=40&query=${formData.name.toLowerCase().replace(" ", "-")}`,
      sku: formData.sku,
      barcode: formData.barcode,
      vendorId: formData.vendorId || undefined,
      receiptNumber: formData.receiptNumber || undefined,
      attributes: productAttributes,
      variants: generatedVariants,
      inventory: [
        { warehouseId: formData.warehouseId || "wh_main", quantity: finalStock }
      ]
    }

    addProduct(newProduct)
    closeDialog()
  }

  const handleUpdate = () => {
    if (
      !editingProduct ||
      !formData.name ||
      !formData.category ||
      !formData.price ||
      !formData.salePrice ||
      !formData.stock
    )
      return

    // Calculate total stock from variants if they exist
    let finalStock = Number.parseInt(formData.stock)
    if (generatedVariants.length > 0) {
      finalStock = generatedVariants.reduce((sum, v) => sum + v.stock, 0)
    }

    updateProduct({
      ...editingProduct,
      name: formData.name,
      description: formData.description,
      category: formData.category,
      price: Number.parseFloat(formData.price),
      salePrice: Number.parseFloat(formData.salePrice),
      stock: finalStock,
      status: finalStock > 0 ? "Selling" : "Out of Stock",
      sku: formData.sku,
      barcode: formData.barcode,
      image: uploadedImages[0] || editingProduct.image,
      vendorId: formData.vendorId || undefined,
      receiptNumber: formData.receiptNumber || undefined,
      attributes: productAttributes,
      variants: generatedVariants,
    })

    closeDialog()
  }

  const closeDialog = () => {
    setIsAddDialogOpen(false)
    setEditingProduct(null)
    setUploadedImages([])
    setFormData({ name: "", description: "", category: "", price: "", salePrice: "", stock: "", sku: "", barcode: "", vendorId: "", receiptNumber: "", warehouseId: "wh_main" })
    setProductAttributes([])
    setSelectedAttributeIds([])
    setGeneratedVariants([])
  }

  const categories = [
    { value: "Men", icon: "👔" },
    { value: "Skin Care", icon: "💆" },
    { value: "Fresh Vegetable", icon: "🥬" },
    { value: "Fresh Fruits", icon: "🍎" },
    { value: "Electronics", icon: "📱" },
    { value: "Accessories", icon: "⌚" },
  ]

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      handleFiles(files)
    }
  }

  const handleFiles = (files: File[]) => {
    const imageFiles = files.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type))

    imageFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          setUploadedImages((prev) => [...prev, e.target!.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleExport = () => {
    const exportData = filteredProducts.map((product) => ({
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

    const headers = [
      "ID",
      "Name",
      "Category",
      "Price",
      "Sale Price",
      "Stock",
      "Status",
      "Published",
      "SKU",
      "Barcode",
      "Description",
    ]
    exportToCSV(exportData, "products", headers)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const importedData = parseCSV(text)

      const newProducts = importedData.map((item) => ({
        id: item.id || generateId(),
        name: item.name,
        category: item.category,
        price: item.price,
        salePrice: item.sale_price,
        stock: Number(item.stock),
        status: item.status || "Selling",
        published: item.published === "Yes",
        image: "/placeholder.svg?height=50&width=50",
        sku: item.sku || "",
        barcode: item.barcode || "",
        description: item.description || "",
        vendorId: item.vendor_id || undefined,
      }))

      newProducts.forEach(product => addProduct(product))
      setIsImportDialogOpen(false)
    }
    reader.readAsText(file)
  }

  const handleBulkAction = () => {
    if (!bulkAction || selectedProducts.length === 0) return

    if (bulkAction === "delete") {
      handleBulkDelete()
    } else if (bulkAction === "status" && bulkStatus) {
      selectedProducts.forEach(id => {
        const product = products.find(p => p.id === id)
        if (product) updateProduct({ ...product, status: bulkStatus as any })
      })
      setSelectedProducts([])
    } else if (bulkAction === "category" && bulkCategory) {
      selectedProducts.forEach(id => {
        const product = products.find(p => p.id === id)
        if (product) updateProduct({ ...product, category: bulkCategory })
      })
      setSelectedProducts([])
    } else if (bulkAction === "publish") {
      selectedProducts.forEach(id => {
        const product = products.find(p => p.id === id)
        if (product) updateProduct({ ...product, published: true })
      })
      setSelectedProducts([])
    } else if (bulkAction === "unpublish") {
      selectedProducts.forEach(id => {
        const product = products.find(p => p.id === id)
        if (product) updateProduct({ ...product, published: false })
      })
      setSelectedProducts([])
    }

    setIsBulkActionDialogOpen(false)
    setBulkAction("")
    setBulkStatus("")
    setBulkCategory("")
  }

  // Attribute & Variant Logic
  const handleAttributeSelect = (attributeId: string, checked: boolean) => {
    if (checked) {
      setSelectedAttributeIds([...selectedAttributeIds, attributeId])
      const attr = globalAttributes.find((a) => a.id === attributeId)
      if (attr) {
        // ALWAYS initialize as array for variant generation purposes
        // Check if it already exists to avoid overwriting existing data if re-checked
        const existing = productAttributes.find(pa => pa.id === attributeId)
        if (!existing) {
          setProductAttributes([...productAttributes, { id: attr.id, name: attr.name, value: [] }])
        }
      }
    } else {
      const newSelectedIds = selectedAttributeIds.filter((id) => id !== attributeId)
      const newProductAttributes = productAttributes.filter((pa) => pa.id !== attributeId)

      setSelectedAttributeIds(newSelectedIds)
      setProductAttributes(newProductAttributes)

      // Regenerate variants based on REMAINING attributes instead of clearing
      // This allows fallback (e.g. Size removed -> show Color variants)
      generateVariants(newProductAttributes)
    }
  }

  const handleAttributeValueChange = (attributeId: string, value: string | string[]) => {
    setProductAttributes(prev => {
      const attr = prev.find(p => p.id === attributeId);
      const newAttributes = prev.map((pa) => (pa.id === attributeId ? { ...pa, value } : pa))

      // Check if we are removing a value (only for arrays)
      if (attr && Array.isArray(attr.value) && Array.isArray(value)) {
        const removed = attr.value.filter(v => !value.includes(v));

        if (removed.length > 0) {
          // If the resulting value array is EMPTY, regenerate (fallback to other attributes)
          // We check 'value' which is the NEW array.
          if (value.length === 0) {
            // We need to use newAttributes for generation, but wait, newAttributes state update won't be immediate in generateVariants call?
            // generateVariants uses 'productAttributes' state by default, but we can pass 'newAttributes' to it.
            // However, generateVariants filters out attributes with empty values. 
            // So if Size has empty values, it will simply be ignored, effectively falling back to Color.
            generateVariants(newAttributes)
          } else {
            // Otherwise, filter specific removed variants as before
            setGeneratedVariants(currentVariants =>
              currentVariants.filter(v => {
                const variantValue = v.attributes[attr.name];
                return !removed.includes(variantValue);
              })
            )
          }
        }
      }

      return newAttributes
    })
  }

  const generateVariants = (attributesToUse?: typeof productAttributes | any) => {
    // Note: When called from onClick, attributesToUse is an Event object, which is not an array.
    // Use passed attributes ONLY if it is an array, otherwise use current state.
    const attrs = Array.isArray(attributesToUse) ? attributesToUse : productAttributes

    // Filter out attributes with no values selected
    // Note: If an attribute has [] values, it is excluded here.
    // This effectively implements the "Fallback" logic.
    const activeAttributes = attrs.filter(attr =>
      Array.isArray(attr.value) ? attr.value.length > 0 : attr.value !== ""
    )

    if (activeAttributes.length === 0) {
      setGeneratedVariants([])
      return
    }

    // Helper to generate cartesian product
    const cartesian = (args: any[][]): any[][] => {
      const result: any[][] = [];
      const max = args.length - 1;
      function helper(arr: any[], i: number) {
        for (let j = 0, l = args[i].length; j < l; j++) {
          const a = arr.slice(0); // clone arr
          a.push(args[i][j]);
          if (i === max) result.push(a);
          else helper(a, i + 1);
        }
      }
      helper([], 0);
      return result;
    }

    // Prepare arrays of values
    const valueArrays = activeAttributes.map(attr =>
      Array.isArray(attr.value) ? attr.value : [attr.value]
    )

    const combinations = cartesian(valueArrays)

    const newVariants: Variant[] = combinations.map((combo) => {
      const variantAttributes: { [key: string]: string } = {}
      let variantNameParts: string[] = []

      combo.forEach((val: string, index: number) => {
        const attrName = activeAttributes[index].name
        variantAttributes[attrName] = val
        variantNameParts.push(val)
      })

      return {
        id: generateId(),
        name: variantNameParts.join(" / "),
        attributes: variantAttributes,
        price: Number(formData.price) || 0,
        salePrice: Number(formData.salePrice) || 0,
        stock: Math.floor(Number(formData.stock) / combinations.length) || 0,
        sku: `${formData.sku}-${variantNameParts.map(p => p.substring(0, 2).toUpperCase()).join("-")}`,
        inventory: [
          { warehouseId: formData.warehouseId || "wh_main", quantity: Math.floor(Number(formData.stock) / combinations.length) || 0 }
        ]
      }
    })

    setGeneratedVariants(newVariants)
  }

  const updateVariant = (id: string, field: keyof Variant, value: any) => {
    setGeneratedVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
  }

  const removeVariant = (id: string) => {
    setGeneratedVariants(prev => prev.filter(v => v.id !== id))
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
          <Button
            variant="outline"
            size="sm"
            className="text-gray-700 bg-transparent"
            onClick={() => setIsImportDialogOpen(true)}
          >
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
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleFilterChange()
              }}
              className="pl-10"
            />
          </div>

          <Select
            value={selectedCategory}
            onValueChange={(value) => {
              setSelectedCategory(value)
              handleFilterChange()
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  <div className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.value}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedVendor}
            onValueChange={(value) => {
              setSelectedVendor(value)
              handleFilterChange()
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Vendor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>



          <Select
            value={selectedWarehouse}
            onValueChange={(value) => {
              setSelectedWarehouse(value)
              handleFilterChange()
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortOption}
            onValueChange={(value) => {
              setSortOption(value)
              handleFilterChange()
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Low to High" />
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
              setSearchQuery("")
              setSelectedCategory("all")
              setSelectedVendor("all")
              setSelectedWarehouse("all")
              setSortOption("default")
              handleFilterChange()
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
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-4 rounded" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded object-cover" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Skeleton className="h-5 w-5 mx-auto" />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Skeleton className="h-6 w-11 rounded-full mx-auto" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-4" />
                      </div>
                    </td>
                  </tr>
                ))
                : currentProducts.map((product) => (
                  <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.image || "/placeholder.svg"}
                          alt={product.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                        <span className="font-medium text-gray-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{product.receiptNumber || "-"}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{product.category}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">${product.price.toFixed(2)}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">${product.salePrice.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      {product.stock < 5 ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-red-600">{product.stock}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 w-fit">
                            Low Stock
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600">{product.stock}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {product.vendorId ? (
                        <Link href={`/dashboard/vendors/${product.vendorId}`} className="text-emerald-600 hover:underline">
                          {vendors.find((v) => v.id === product.vendorId)?.name || "Unknown"}
                        </Link>
                      ) : (
                        <span className="text-gray-400">No Vendor</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                        {product.inventory && product.inventory.length > 0 ? (
                            warehouses.find(w => w.id === product.inventory?.[0]?.warehouseId)?.name || "Unknown"
                        ) : (
                            "Main Warehouse"
                        )}
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
                              <QrCode className="w-4 h-4" />
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

      <Dialog open={isAddDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-5xl p-0 gap-0 max-h-[90vh] flex flex-col bg-white">
          <DialogHeader className="p-6 border-b">
            <DialogTitle className="text-2xl">{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "Update the product details below" : "Fill in the product details below"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Title/Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Product Title/Name"
                />
              </div>

              <>
                <div className="space-y-2">
                  <Label htmlFor="sku">Product SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="Product SKU"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode">Product Barcode</Label>
                  <Input
                    id="barcode"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Product Barcode"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receiptNumber">Receipt Number</Label>
                  <Input
                    id="receiptNumber"
                    value={formData.receiptNumber}
                    onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                    placeholder="Receipt Number (Optional)"
                  />
                </div>
              </>

              <>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <span>{cat.icon}</span>
                            <span>{cat.value}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Select
                    value={formData.vendorId || undefined}
                    onValueChange={(value) => setFormData({ ...formData, vendorId: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Vendor (Optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultCategory">Default Category</Label>
                  <Select>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Default Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="featured">Featured</SelectItem>
                      <SelectItem value="trending">Trending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>

              <>
                <div className="space-y-2">
                  <Label htmlFor="price">Product Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0"
                      className="pl-7"
                      disabled={generatedVariants.length > 0}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="salePrice">Sale Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      id="salePrice"
                      type="number"
                      value={formData.salePrice}
                      onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                      placeholder="0"
                      className="pl-7"
                      disabled={generatedVariants.length > 0}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stock">Stock</Label>
                  <div className="flex gap-2">
                      <Input
                        id="stock"
                        type="number"
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                        placeholder="0"
                        className="flex-1"
                        disabled={generatedVariants.length > 0} 
                      />
                      {generatedVariants.length === 0 && (
                          // Keep hidden if variants exist? No, user wants it visible
                          // But if variants exist, stock input is disabled. 
                          // The warehouse selector should probably control where the variants are created?
                          // Yes, we updated generateVariants to use formData.warehouseId
                          <></>
                      )}
                         <div className="w-1/3">
                             <Select 
                                value={formData.warehouseId || "wh_main"} 
                                // Enable changing warehouse even if variants exist, to re-assign them? 
                                // Ideally changing this should update generated variants if we want to be fancy, 
                                // but for now let's just allow selection for new variants/product.
                                onValueChange={(val) => {
                                    setFormData({...formData, warehouseId: val})
                                    // Optional: update existing variants if they are just being created?
                                    // For simple 'add' flow, this is enough.
                                }}
                             >
                                <SelectTrigger>
                                    <SelectValue placeholder="Location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                         </div>
                  </div>
                  {generatedVariants.length > 0 && <p className="text-xs text-gray-500">Stock is calculated from variants</p>}
                </div>
              </>
            </div>

            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-medium">Attributes & Variants</h3>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-4">
                  {globalAttributes.map(attr => (
                    <div key={attr.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`attr-${attr.id}`}
                        checked={selectedAttributeIds.includes(attr.id)}
                        onCheckedChange={(checked) => handleAttributeSelect(attr.id, checked as boolean)}
                      />
                      <Label htmlFor={`attr-${attr.id}`}>{attr.displayName}</Label>
                    </div>
                  ))}
                </div>

                {productAttributes.map(attr => {
                  const globalAttr = globalAttributes.find(a => a.id === attr.id)
                  if (!globalAttr) return null

                  return (
                    <div key={attr.id} className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">{attr.name}</Label>
                      <div className="col-span-3">
                        {globalAttr.option === "dropdown" || globalAttr.option === "radio" ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              {globalAttr.values.map(val => {
                                const isSelected = Array.isArray(attr.value) ? attr.value.includes(val) : attr.value === val
                                return (
                                  <Badge
                                    key={val}
                                    variant={isSelected ? "default" : "outline"}
                                    className="cursor-pointer"
                                    onClick={() => {
                                      let newValue: string | string[] = attr.value;
                                      if (!Array.isArray(newValue)) {
                                        // If it was a string (shouldn't happen with new logic but safe to handle), convert to array
                                        newValue = newValue ? [newValue] : []
                                      }

                                      // It's an array now
                                      if ((newValue as string[]).includes(val)) {
                                        newValue = (newValue as string[]).filter(v => v !== val)
                                      } else {
                                        newValue = [...(newValue as string[]), val]
                                      }

                                      handleAttributeValueChange(attr.id, newValue)
                                    }}
                                  >
                                    {val}
                                  </Badge>
                                )
                              })}
                            </div>
                          </>
                        ) : (
                          <Input
                            value={attr.value as string}
                            onChange={(e) => handleAttributeValueChange(attr.id, e.target.value)}
                            placeholder={`Enter ${attr.name}`}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}

                {productAttributes.length > 0 && (
                  <Button type="button" onClick={generateVariants} variant="secondary" className="w-full">
                    Generate Variants
                  </Button>
                )}
              </div>

              {generatedVariants.length > 0 && (
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="p-2 text-left">Variant</th>
                        <th className="p-2 text-left">Price</th>
                        <th className="p-2 text-left">Sale Price</th>
                        <th className="p-2 text-left">Stock</th>
                        <th className="p-2 text-left">SKU</th>
                        <th className="p-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedVariants.map(variant => (
                        <tr key={variant.id} className="border-b last:border-0">
                          <td className="p-2 font-medium">{variant.name}</td>
                          <td className="p-2">
                            <Input
                              type="number"
                              className="h-8 w-24"
                              value={variant.price || ''}
                              onChange={(e) => updateVariant(variant.id, 'price', Number(e.target.value))}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              className="h-8 w-24"
                              value={variant.salePrice || ''}
                              onChange={(e) => updateVariant(variant.id, 'salePrice', Number(e.target.value))}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              className="h-8 w-24"
                              value={variant.stock || ''}
                              onChange={(e) => updateVariant(variant.id, 'stock', Number(e.target.value))}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              className="h-8 w-32"
                              value={variant.sku}
                              onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => removeVariant(variant.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Product Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product Description"
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="space-y-2 w-full">
              <Label>Product Images</Label>
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${isDragging ? "border-emerald-500 bg-emerald-50" : "border-gray-300 hover:border-emerald-500"
                  }`}
              >
                <input
                  type="file"
                  id="file-upload"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <CloudUpload className="w-12 h-12 mx-auto mb-4 text-emerald-600" />
                  <p className="text-gray-600 font-medium mb-1">Drag your images here</p>
                  <p className="text-sm text-gray-400">
                    (Only *.jpeg, *.webp and *.png images will be accepted)
                  </p>
                </label>
              </div>

              {uploadedImages.length > 0 && (
                <div className="flex flex-wrap gap-4 mt-4">
                  {uploadedImages.map((image, index) => (
                    <div key={index} className="relative">
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 z-10 hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <img
                        src={image || "/placeholder.svg"}
                        alt={`Upload ${index + 1}`}
                        className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                      />
                      {index === 0 && (
                        <button
                          type="button"
                          className="mt-2 w-24 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
                        >
                          Default Image
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="p-6 border-t">
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={editingProduct ? handleUpdate : handleAdd} className="bg-emerald-600 hover:bg-emerald-700">
              {editingProduct ? "Update" : "Add"} Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <span
                      className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${viewingProduct.published ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                        }`}
                    >
                      {viewingProduct.published ? "Published" : "Draft"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 border-t">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Category</p>
                  <p className="font-semibold text-gray-900">{viewingProduct.category}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">SKU</p>
                  <p className="font-semibold text-gray-900">{viewingProduct.sku}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Barcode</p>
                  <p className="font-semibold text-gray-900">{viewingProduct.barcode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Stock</p>
                  <p className="font-semibold text-gray-900">{viewingProduct.stock} units</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Locations</p>
                  <div className="text-sm text-gray-900">
                      {viewingProduct.inventory?.map((inv, i) => {
                          const wName = warehouses.find(w => w.id === inv.warehouseId)?.name || inv.warehouseId
                          return <div key={i}>{wName}: {inv.quantity}</div>
                      }) || "Main Warehouse: " + viewingProduct.stock}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Price</p>
                  <p className="font-semibold text-gray-900">${viewingProduct.price.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Sale Price</p>
                  <p className="font-semibold text-emerald-600">${viewingProduct.salePrice.toFixed(2)}</p>
                </div>
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
                        {viewingProduct.variants.map((variant) => (
                          <tr key={variant.id} className="border-b last:border-0 hover:bg-gray-50 bg-white">
                            <td className="p-2 font-medium">{variant.name}</td>
                            <td className="p-2 text-gray-600">{variant.sku}</td>
                            <td className="p-2 font-medium">
                              <span>${variant.price}</span>
                            </td>
                            <td className="p-2 font-medium text-emerald-600">
                              <span>${variant.salePrice || variant.price}</span>
                            </td>
                            <td className="p-2">
                              {variant.stock > 0 ? (
                                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">
                                  {variant.stock} in stock
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                                  Out of stock
                                </Badge>
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
            <Button variant="outline" onClick={() => setViewingProduct(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (viewingProduct) {
                  setViewingProduct(null)
                  handleEdit(viewingProduct)
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                Upload a CSV file with columns: Name, Category, Price, Sale Price, Stock, Status, Published, SKU,
                Barcode, Description
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span>{cat.value}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAction} className="bg-emerald-600 hover:bg-emerald-700" disabled={!bulkAction}>
              Apply Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
