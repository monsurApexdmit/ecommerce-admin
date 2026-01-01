"use client"

import type React from "react"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Search, Upload, Download, Edit2, Trash2, Eye, FilePen, Plus, CloudUpload } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { exportToCSV, parseCSV, generateId } from "@/lib/export-import-utils"

interface Product {
  id: string
  name: string
  description: string
  category: string
  price: number
  salePrice: number
  stock: number
  status: "Selling" | "Out of Stock" | "Discontinued"
  published: boolean
  image: string
  sku: string
  barcode: string
}

const initialProducts: Product[] = [
  {
    id: "1",
    name: "Premium T-Shirt",
    description: "High-quality cotton t-shirt with premium fabric",
    category: "Men",
    price: 450.0,
    salePrice: 450.0,
    stock: 4969,
    status: "Selling",
    published: true,
    image: "/plain-white-tshirt.png",
    sku: "TSH-001",
    barcode: "1234567890123",
  },
  {
    id: "2",
    name: "Himalaya Powder",
    description: "A luxurious powder for skin care",
    category: "Skin Care",
    price: 174.97,
    salePrice: 160.0,
    stock: 5471,
    status: "Selling",
    published: true,
    image: "/powder.jpg",
    sku: "SKC-002",
    barcode: "2345678901234",
  },
  {
    id: "3",
    name: "Green Leaf Lettuce",
    description: "Fresh and crisp lettuce",
    category: "Fresh Vegetable",
    price: 112.72,
    salePrice: 112.72,
    stock: 463,
    status: "Selling",
    published: true,
    image: "/fresh-lettuce.png",
    sku: "FVL-003",
    barcode: "3456789012345",
  },
  {
    id: "4",
    name: "Rainbow Chard",
    description: "Colorful and nutritious chard",
    category: "Fresh Vegetable",
    price: 7.07,
    salePrice: 7.07,
    stock: 472,
    status: "Selling",
    published: true,
    image: "/chard.jpg",
    sku: "FVL-004",
    barcode: "4567890123456",
  },
  {
    id: "5",
    name: "Clementine",
    description: "Juicy and sweet clementine",
    category: "Fresh Fruits",
    price: 48.12,
    salePrice: 48.12,
    stock: 443,
    status: "Selling",
    published: true,
    image: "/single-clementine.png",
    sku: "FFR-005",
    barcode: "5678901234567",
  },
  {
    id: "6",
    name: "Kale Sprouts",
    description: "Vibrant and healthy kale sprouts",
    category: "Fresh Vegetable",
    price: 106.06,
    salePrice: 90.0,
    stock: 297,
    status: "Selling",
    published: true,
    image: "/vibrant-kale.png",
    sku: "FVL-006",
    barcode: "6789012345678",
  },
  {
    id: "7",
    name: "Rainbow Peppers",
    description: "Colorful and flavorful peppers",
    category: "Fresh Vegetable",
    price: 90.85,
    salePrice: 90.85,
    stock: 412,
    status: "Selling",
    published: true,
    image: "/colorful-peppers.png",
    sku: "FVL-007",
    barcode: "7890123456789",
  },
  {
    id: "8",
    name: "Blueberry",
    description: "Ripe and delicious blueberry",
    category: "Fresh Fruits",
    price: 211.96,
    salePrice: 211.96,
    stock: 201,
    status: "Selling",
    published: true,
    image: "/ripe-blueberries.png",
    sku: "FFR-008",
    barcode: "8901234567890",
  },
  {
    id: "9",
    name: "Calabaza Squash",
    description: "Fresh and versatile calabaza squash",
    category: "Fresh Vegetable",
    price: 98.03,
    salePrice: 98.03,
    stock: 581,
    status: "Selling",
    published: true,
    image: "/squash.jpg",
    sku: "FVL-009",
    barcode: "9012345678901",
  },
  {
    id: "10",
    name: "Lettuce",
    description: "Fresh lettuce for salads",
    category: "Fresh Vegetable",
    price: 193.26,
    salePrice: 193.26,
    stock: 367,
    status: "Selling",
    published: true,
    image: "/fresh-lettuce.png",
    sku: "FVL-010",
    barcode: "0123456789012",
  },
  {
    id: "11",
    name: "Radicchio",
    description: "Nutritious and flavorful radicchio",
    category: "Fresh Vegetable",
    price: 58.66,
    salePrice: 45.0,
    stock: 78,
    status: "Selling",
    published: true,
    image: "/radicchio.jpg",
    sku: "FVL-011",
    barcode: "1234567890123",
  },
  {
    id: "12",
    name: "Parsley",
    description: "Fresh and aromatic parsley",
    category: "Fresh Vegetable",
    price: 134.63,
    salePrice: 134.63,
    stock: 172,
    status: "Selling",
    published: true,
    image: "/fresh-parsley.png",
    sku: "FVL-012",
    barcode: "2345678901234",
  },
  {
    id: "13",
    name: "Strawberrie",
    description: "Ripe and juicy strawberry",
    category: "Fresh Fruits",
    price: 156.95,
    salePrice: 140.0,
    stock: 421,
    status: "Selling",
    published: true,
    image: "/ripe-strawberry.png",
    sku: "FFR-013",
    barcode: "3456789012345",
  },
  {
    id: "14",
    name: "Cauliflower",
    description: "Versatile and healthy cauliflower",
    category: "Fresh Vegetable",
    price: 139.15,
    salePrice: 139.15,
    stock: 224,
    status: "Selling",
    published: true,
    image: "/single-cauliflower.png",
    sku: "FVL-014",
    barcode: "4567890123456",
  },
  {
    id: "15",
    name: "Organic Purple Cauliflower",
    description: "Organic and colorful purple cauliflower",
    category: "Fresh Vegetable",
    price: 19.57,
    salePrice: 19.57,
    stock: 29,
    status: "Selling",
    published: true,
    image: "/purple-cauliflower.jpg",
    sku: "FVL-015",
    barcode: "5678901234567",
  },
]

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedPrice, setSelectedPrice] = useState<string>("all")
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
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
  })
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState("")
  const [bulkStatus, setBulkStatus] = useState("")
  const [bulkCategory, setBulkCategory] = useState("")

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory
    const matchesPrice =
      selectedPrice === "all" ||
      (selectedPrice === "low" && product.price < 50) ||
      (selectedPrice === "medium" && product.price >= 50 && product.price < 150) ||
      (selectedPrice === "high" && product.price >= 150)

    return matchesSearch && matchesCategory && matchesPrice
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(filteredProducts.map((p) => p.id))
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
    setProducts(products.map((p) => (p.id === productId ? { ...p, published: !p.published } : p)))
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
    })
    setIsAddDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    setProducts(products.filter((p) => p.id !== id))
    setSelectedProducts(selectedProducts.filter((sid) => sid !== id))
  }

  const handleBulkDelete = () => {
    setProducts(products.filter((p) => !selectedProducts.includes(p.id)))
    setSelectedProducts([])
  }

  const handleAdd = () => {
    if (!formData.name || !formData.category || !formData.price || !formData.salePrice || !formData.stock) return

    const newProduct: Product = {
      id: String(products.length + 1),
      name: formData.name,
      description: formData.description,
      category: formData.category,
      price: Number.parseFloat(formData.price),
      salePrice: Number.parseFloat(formData.salePrice),
      stock: Number.parseInt(formData.stock),
      status: "Selling",
      published: true,
      image:
        uploadedImages[0] ||
        `/placeholder.svg?height=40&width=40&query=${formData.name.toLowerCase().replace(" ", "-")}`,
      sku: formData.sku,
      barcode: formData.barcode,
    }

    setProducts([...products, newProduct])
    setIsAddDialogOpen(false)
    setUploadedImages([])
    setFormData({ name: "", description: "", category: "", price: "", salePrice: "", stock: "", sku: "", barcode: "" })
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

    const updatedProducts = products.map((p) =>
      p.id === editingProduct.id
        ? {
            ...p,
            name: formData.name,
            description: formData.description,
            category: formData.category,
            price: Number.parseFloat(formData.price),
            salePrice: Number.parseFloat(formData.salePrice),
            stock: Number.parseInt(formData.stock),
            sku: formData.sku,
            barcode: formData.barcode,
            image: uploadedImages[0] || p.image,
          }
        : p,
    )

    setProducts(updatedProducts)
    setIsAddDialogOpen(false)
    setEditingProduct(null)
    setUploadedImages([])
    setFormData({ name: "", description: "", category: "", price: "", salePrice: "", stock: "", sku: "", barcode: "" })
  }

  const closeDialog = () => {
    setIsAddDialogOpen(false)
    setEditingProduct(null)
    setUploadedImages([])
    setFormData({ name: "", description: "", category: "", price: "", salePrice: "", stock: "", sku: "", barcode: "" })
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
        images: [],
      }))

      setProducts([...products, ...newProducts])
      setIsImportDialogOpen(false)
    }
    reader.readAsText(file)
  }

  const handleBulkAction = () => {
    if (!bulkAction || selectedProducts.length === 0) return

    if (bulkAction === "delete") {
      handleBulkDelete()
    } else if (bulkAction === "status" && bulkStatus) {
      setProducts(products.map((p) => (selectedProducts.includes(p.id) ? { ...p, status: bulkStatus as any } : p)))
      setSelectedProducts([])
    } else if (bulkAction === "category" && bulkCategory) {
      setProducts(products.map((p) => (selectedProducts.includes(p.id) ? { ...p, category: bulkCategory } : p)))
      setSelectedProducts([])
    } else if (bulkAction === "publish") {
      setProducts(products.map((p) => (selectedProducts.includes(p.id) ? { ...p, published: true } : p)))
      setSelectedProducts([])
    } else if (bulkAction === "unpublish") {
      setProducts(products.map((p) => (selectedProducts.includes(p.id) ? { ...p, published: false } : p)))
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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

          <Select value={selectedPrice} onValueChange={setSelectedPrice}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Price" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Prices</SelectItem>
              <SelectItem value="low">Under $50</SelectItem>
              <SelectItem value="medium">$50 - $150</SelectItem>
              <SelectItem value="high">Over $150</SelectItem>
            </SelectContent>
          </Select>

          <Button className="bg-emerald-600 hover:bg-emerald-700">Filter</Button>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("")
              setSelectedCategory("all")
              setSelectedPrice("all")
            }}
          >
            Reset
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  <Checkbox
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Product Name</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Category</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Price</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Sale Price</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Stock</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">View</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Published</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
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
                  <td className="py-3 px-4 text-sm text-gray-600">{product.category}</td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-900">${product.price.toFixed(2)}</td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-900">${product.salePrice.toFixed(2)}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{product.stock}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-emerald-100 text-emerald-700">
                      {product.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => setViewingProduct(product)} className="text-gray-400 hover:text-emerald-600">
                      <Eye className="w-5 h-5" />
                    </button>
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

      <Dialog open={isAddDialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "Update the product details below" : "Fill in the product details below"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Title/Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Product Title/Name"
              />
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

            <div className="space-y-2">
              <Label>Product Images</Label>
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                  isDragging ? "border-emerald-500 bg-emerald-50" : "border-gray-300 hover:border-emerald-500"
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
                  <p className="text-sm text-gray-400">(Only *.jpeg, *.webp and *.png images will be accepted)</p>
                </label>
              </div>

              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-4 gap-4 mt-4">
                  {uploadedImages.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={image || "/placeholder.svg"}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
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
              <Label htmlFor="defaultCategory">Default Category</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Default Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                  <SelectItem value="trending">Trending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
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
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">Product Details</DialogTitle>
          </DialogHeader>

          {viewingProduct && (
            <div className="space-y-6 py-4">
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
                      className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                        viewingProduct.published ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
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
                  <p className="text-sm text-gray-500 mb-1">Price</p>
                  <p className="font-semibold text-gray-900">${viewingProduct.price.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Sale Price</p>
                  <p className="font-semibold text-emerald-600">${viewingProduct.salePrice.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
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
