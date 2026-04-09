"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
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
import { Trash2, CloudUpload, Copy, Check } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { generateId } from "@/lib/export-import-utils"
import { useProduct, type Product, type Variant } from "@/contexts/product-context"
import { productApi } from "@/lib/productApi"
import { useVendor } from "@/contexts/vendor-context"
import { useCategory } from "@/contexts/category-context"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useAttribute } from "@/contexts/attribute-context"
import { useToast } from "@/hooks/use-toast"

interface ProductFormDialogProps {
  open: boolean
  editingProduct: Product | null
  onClose: () => void
}

const emptyForm = {
  name: "",
  description: "",
  category: "",
  categoryId: "",
  price: "",
  salePrice: "",
  costPrice: "",
  profitMargin: "",
  marginType: "percentage",
  stock: "",
  sku: "",
  barcode: "",
  vendorId: "",
  receiptNumber: "",
  locationId: "",
}

export function ProductFormDialog({ open, editingProduct, onClose }: ProductFormDialogProps) {
  const { addProduct, updateProduct } = useProduct()
  const { vendors, refreshVendors } = useVendor()
  const { warehouses, refreshLocations } = useWarehouse()
  const { categories, getAllCategoriesFlat, refreshCategories } = useCategory()
  const { attributes: globalAttributes, isLoading: attributesLoading } = useAttribute()
  const { toast } = useToast()
  const [barcodeCopied, setBarcodeCopied] = useState(false)

  // Generate random barcode code (PROD-XXXXXXXX-XXXX format)
  const generateBarcodeCode = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const randomStr = (len: number) => {
      let result = ''
      for (let i = 0; i < len; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return result
    }
    return `PROD-${randomStr(8)}-${randomStr(4)}`
  }, [])

  const [formData, setFormData] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<string[]>([]) // preview URLs (base64 for new, http for existing)
  const [imageFiles, setImageFiles] = useState<File[]>([]) // new files only
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]) // existing server URLs
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([])
  const [productAttributes, setProductAttributes] = useState<{ id: string; name: string; value: string | string[] }[]>([])
  const [generatedVariants, setGeneratedVariants] = useState<Variant[]>([])

  const allCategories = getAllCategoriesFlat()

  // Populate form when opening for edit, or reset for add
  useEffect(() => {
    if (!open) return
    refreshCategories()
    refreshVendors()
    refreshLocations()

    if (editingProduct) {
      // Fetch fresh data from API
      productApi.getById(parseInt(editingProduct.id)).then(res => {
        const p = res.data as any
        const STORAGE = "http://localhost:8005/storage"

        setFormData({
          name: p.name || "",
          description: p.description || "",
          category: "",
          categoryId: p.categoryId ? String(p.categoryId) : "",
          price: String(p.price || ""),
          salePrice: String(p.salePrice || ""),
          costPrice: String(p.costPrice || p.cost_price || ""),
          profitMargin: String(p.profitMargin || p.profit_margin || ""),
          marginType: p.marginType || p.margin_type || "percentage",
          stock: String(p.stock || ""),
          sku: p.sku || "",
          barcode: p.barcode || "",
          vendorId: p.vendorId ? String(p.vendorId) : "",
          receiptNumber: p.receiptNumber || "",
          locationId: p.locationId ? String(p.locationId) : "",
        })

        // Images
        const imageUrls: string[] = []
        if (p.images?.length) {
          p.images.forEach((img: any) => imageUrls.push(`${STORAGE}/${img.path}`))
        } else if (p.image) {
          imageUrls.push(`${STORAGE}/${p.image}`)
        }
        setUploadedImages(imageUrls)
        setExistingImageUrls(imageUrls)
        setImageFiles([])

        // Variants
        const variants: Variant[] = (p.variants || []).map((v: any) => ({
          id: String(v.id),
          name: v.name || "",
          price: v.price || 0,
          salePrice: v.salePrice || 0,
          stock: v.stock || 0,
          sku: v.sku || "",
          barcode: v.barcode || "",
          attributes: (() => {
            const raw = v.attributes
            if (!raw) return {}
            if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return {} } }
            return raw
          })(),
        }))
        setGeneratedVariants(variants)

        // Reconstruct attributes from variant keys
        if (variants.length > 0) {
          const allKeys = Array.from(new Set(variants.flatMap((v: Variant) => Object.keys(v.attributes || {}))))
          const reconstructed = allKeys.map(key => {
            const values = Array.from(new Set(variants.map((v: Variant) => v.attributes?.[key]).filter(Boolean) as string[]))
            const globalAttr = globalAttributes.find(a => a.name.toLowerCase() === key.toLowerCase())
            return { id: globalAttr ? String(globalAttr.id) : key, name: key, value: values }
          })
          setProductAttributes(reconstructed)
          setSelectedAttributeIds(reconstructed.map(a => a.id))
        } else {
          setProductAttributes([])
          setSelectedAttributeIds([])
        }
      }).catch(console.error)
    } else {
      // Auto-generate barcode for new product
      const newBarcode = generateBarcodeCode()
      setFormData({ ...emptyForm, barcode: newBarcode })
      setUploadedImages([])
      setImageFiles([])
      setExistingImageUrls([])
      setProductAttributes([])
      setSelectedAttributeIds([])
      setGeneratedVariants([])
      setBarcodeCopied(false)
    }
  }, [open, editingProduct, generateBarcodeCode])

  // Auto-select first warehouse when no location selected
  useEffect(() => {
    if (warehouses.length > 0 && !formData.locationId) {
      const defaultWh = warehouses.find(w => w.isDefault) || warehouses[0]
      setFormData(prev => ({ ...prev, locationId: String(defaultWh.id) }))
    }
  }, [warehouses, formData.locationId])

  // Sync stock from variants
  useEffect(() => {
    if (generatedVariants.length > 0) {
      const totalStock = generatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
      setFormData(prev => ({ ...prev, stock: String(totalStock) }))
    }
  }, [generatedVariants])

  // Auto-calculate sale price from cost price and profit margin
  useEffect(() => {
    const cost = parseFloat(formData.costPrice)
    const margin = parseFloat(formData.profitMargin)
    if (!isNaN(cost) && !isNaN(margin) && cost >= 0 && margin >= 0) {
      let sale: number
      if (formData.marginType === 'percentage') {
        sale = cost + (cost * margin / 100)
      } else {
        sale = cost + margin
      }
      setFormData(prev => ({ ...prev, salePrice: sale.toFixed(2) }))
    }
  }, [formData.costPrice, formData.profitMargin, formData.marginType])

  const set = useCallback((field: keyof typeof emptyForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleClose = () => {
    setErrorMessage(null)
    onClose()
  }

  const handleAdd = async () => {
    if (!formData.name || !formData.category || !formData.price || !formData.salePrice || !formData.stock) return
    let finalStock = Number.parseInt(formData.stock)
    if (generatedVariants.length > 0) finalStock = generatedVariants.reduce((sum, v) => sum + v.stock, 0)
    setIsSaving(true)
    setErrorMessage(null)
    try {
      await addProduct({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        categoryId: formData.categoryId,
        locationId: formData.locationId || String(warehouses[0]?.id || ""),
        price: Number.parseFloat(formData.price),
        salePrice: Number.parseFloat(formData.salePrice),
        costPrice: formData.costPrice ? Number.parseFloat(formData.costPrice) : undefined,
        profitMargin: formData.profitMargin ? Number.parseFloat(formData.profitMargin) : undefined,
        marginType: formData.marginType || "percentage",
        stock: finalStock,
        status: finalStock > 0 ? "Selling" : "Out of Stock",
        published: true,
        image: uploadedImages[0] || "",
        images: imageFiles,
        sku: formData.sku,
        barcode: formData.barcode,
        vendorId: formData.vendorId || undefined,
        receiptNumber: formData.receiptNumber || undefined,
        attributes: productAttributes,
        variants: generatedVariants,
        inventory: [{ warehouseId: formData.locationId || String(warehouses[0]?.id || ""), quantity: finalStock }],
      })
      handleClose()
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.error || "Failed to create product"
      console.error("Failed to add product:", msg, err)
      setErrorMessage(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!editingProduct || !formData.name || !formData.price || !formData.salePrice) return
    let finalStock = Number.parseInt(formData.stock)
    if (generatedVariants.length > 0) finalStock = generatedVariants.reduce((sum, v) => sum + v.stock, 0)
    setIsSaving(true)
    const keepImages = uploadedImages
      .filter(u => existingImageUrls.includes(u))
      .map(u => u.replace('http://localhost:8005/storage/', ''))
    console.log('UPDATE images debug:', {
      existingImageUrls,
      uploadedImages,
      imageFiles: imageFiles.map(f => f.name),
      keepImages,
    })
    try {
      await updateProduct({
        ...editingProduct,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        categoryId: formData.categoryId || editingProduct.categoryId,
        locationId: formData.locationId || editingProduct.locationId || String(warehouses[0]?.id || ""),
        price: Number.parseFloat(formData.price),
        salePrice: Number.parseFloat(formData.salePrice),
        costPrice: formData.costPrice ? Number.parseFloat(formData.costPrice) : undefined,
        profitMargin: formData.profitMargin ? Number.parseFloat(formData.profitMargin) : undefined,
        marginType: formData.marginType || "percentage",
        stock: finalStock,
        status: finalStock > 0 ? "Selling" : "Out of Stock",
        sku: formData.sku,
        barcode: formData.barcode,
        image: uploadedImages[0] || editingProduct.image,
        images: imageFiles.length > 0 ? imageFiles : undefined,
        delete_images: false,
        keep_images: keepImages,
        vendorId: formData.vendorId || undefined,
        receiptNumber: formData.receiptNumber || undefined,
        attributes: productAttributes,
        variants: generatedVariants,
        inventory: [{ warehouseId: formData.locationId || editingProduct.locationId || String(warehouses[0]?.id || ""), quantity: finalStock }],
      })
      handleClose()
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.error || "Failed to update product"
      console.error("Failed to update product:", msg, err)
      setErrorMessage(msg)
    } finally {
      setIsSaving(false)
    }
  }

  // Image handlers
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files))
  }
  const handleFiles = (files: File[]) => {
    const valid = files.filter(f => ["image/jpeg", "image/png", "image/webp"].includes(f.type))
    setImageFiles(prev => [...prev, ...valid])
    valid.forEach(file => {
      const reader = new FileReader()
      reader.onload = e => { if (e.target?.result) setUploadedImages(prev => [...prev, e.target!.result as string]) }
      reader.readAsDataURL(file)
    })
  }
  const removeImage = (index: number) => {
    const url = uploadedImages[index]
    // If it's an existing server image, remove from existingImageUrls too
    if (existingImageUrls.includes(url)) {
      setExistingImageUrls(prev => prev.filter(u => u !== url))
    } else {
      // It's a new file — find its index among new files only
      const newFileIndex = uploadedImages.slice(0, index).filter(u => !existingImageUrls.includes(u)).length
      setImageFiles(prev => prev.filter((_, i) => i !== newFileIndex))
    }
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
  }

  // Attribute & Variant logic
  const generateVariants = (attributesToUse?: typeof productAttributes | any) => {
    const attrs = Array.isArray(attributesToUse) ? attributesToUse : productAttributes
    const activeAttributes = attrs.filter((attr: any) =>
      Array.isArray(attr.value) ? attr.value.length > 0 : attr.value !== ""
    )
    if (activeAttributes.length === 0) { setGeneratedVariants([]); return }
    const cartesian = (args: any[][]): any[][] => {
      const result: any[][] = []
      const max = args.length - 1
      function helper(arr: any[], i: number) {
        for (let j = 0; j < args[i].length; j++) {
          const a = [...arr, args[i][j]]
          if (i === max) result.push(a)
          else helper(a, i + 1)
        }
      }
      helper([], 0)
      return result
    }
    const valueArrays = activeAttributes.map((attr: any) => Array.isArray(attr.value) ? attr.value : [attr.value])
    const combinations = cartesian(valueArrays)
    const newVariants: Variant[] = combinations.map((combo: string[]) => {
      const variantAttributes: { [key: string]: string } = {}
      combo.forEach((val, index) => { variantAttributes[activeAttributes[index].name] = val })
      const parts = combo
      return {
        id: generateId(),
        name: parts.join(" / "),
        attributes: variantAttributes,
        price: Number(formData.price) || 0,
        salePrice: Number(formData.salePrice) || 0,
        stock: Math.floor(Number(formData.stock) / combinations.length) || 0,
        sku: `${formData.sku}-${parts.map((p: string) => p.substring(0, 2).toUpperCase()).join("-")}`,
        inventory: [{ warehouseId: formData.locationId || String(warehouses[0]?.id || ""), quantity: Math.floor(Number(formData.stock) / combinations.length) || 0 }],
      }
    })
    setGeneratedVariants(newVariants)
  }

  const handleAttributeSelect = (attributeId: string, checked: boolean) => {
    if (checked) {
      setSelectedAttributeIds(prev => [...prev, attributeId])
      const attr = globalAttributes.find(a => a.id === attributeId)
      if (attr && !productAttributes.find(pa => pa.id === attributeId)) {
        setProductAttributes(prev => [...prev, { id: attr.id, name: attr.name, value: [] }])
      }
    } else {
      const newSelected = selectedAttributeIds.filter(id => id !== attributeId)
      const newAttrs = productAttributes.filter(pa => pa.id !== attributeId)
      setSelectedAttributeIds(newSelected)
      setProductAttributes(newAttrs)
      generateVariants(newAttrs)
    }
  }

  const handleAttributeValueChange = (attributeId: string, value: string | string[]) => {
    setProductAttributes(prev => {
      const attr = prev.find(p => p.id === attributeId)
      const newAttributes = prev.map(pa => pa.id === attributeId ? { ...pa, value } : pa)
      if (attr && Array.isArray(attr.value) && Array.isArray(value)) {
        const removed = attr.value.filter(v => !(value as string[]).includes(v))
        if (removed.length > 0) {
          if (value.length === 0) {
            generateVariants(newAttributes)
          } else {
            setGeneratedVariants(current => current.filter(v => !removed.includes(v.attributes[attr.name])))
          }
        }
      }
      return newAttributes
    })
  }

  const updateVariant = (id: string, field: keyof Variant, value: any) => {
    setGeneratedVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
  }
  const removeVariant = (id: string) => {
    setGeneratedVariants(prev => prev.filter(v => v.id !== id))
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
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
                onChange={(e) => set("name", e.target.value)}
                placeholder="Product Title/Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">Product SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="Product SKU"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="barcode">
                  Product Barcode
                  {!editingProduct && <Badge className="ml-2 bg-emerald-600">Auto-Generated</Badge>}
                </Label>
                {formData.barcode && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(formData.barcode)
                      setBarcodeCopied(true)
                      toast({ title: 'Copied', description: 'Barcode copied to clipboard' })
                      setTimeout(() => setBarcodeCopied(false), 2000)
                    }}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
                  >
                    {barcodeCopied ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => set("barcode", e.target.value)}
                  placeholder="Product Barcode"
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newBarcode = generateBarcodeCode()
                    set("barcode", newBarcode)
                  }}
                  className="whitespace-nowrap"
                >
                  Regenerate
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receiptNumber">Receipt Number</Label>
              <Input
                id="receiptNumber"
                value={formData.receiptNumber}
                onChange={(e) => set("receiptNumber", e.target.value)}
                placeholder="Receipt Number (Optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) => {
                  const cat = allCategories.find(c => c.id === value)
                  setFormData(prev => ({ ...prev, categoryId: value, category: cat?.category_name || "" }))
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} textValue={cat.category_name}>
                      {cat.parent_id !== null ? `  └─ ${cat.category_name}` : cat.category_name}
                      {!cat.status ? " (Inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Select
                value={formData.vendorId || undefined}
                onValueChange={(value) => set("vendorId", value)}
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
              <Label htmlFor="price">Product Price</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="0"
                  className="pl-7"
                  disabled={generatedVariants.length > 0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="costPrice">Cost Price</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="costPrice"
                  type="number"
                  value={formData.costPrice}
                  onChange={(e) => set("costPrice", e.target.value)}
                  placeholder="0"
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Profit Margin Type</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => set("marginType", "percentage")}
                  className={`flex-1 px-3 py-2 rounded border transition-colors ${
                    formData.marginType === "percentage"
                      ? "bg-emerald-100 border-emerald-500 text-emerald-900"
                      : "bg-gray-100 border-gray-300 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  % Percentage
                </button>
                <button
                  type="button"
                  onClick={() => set("marginType", "flat")}
                  className={`flex-1 px-3 py-2 rounded border transition-colors ${
                    formData.marginType === "flat"
                      ? "bg-emerald-100 border-emerald-500 text-emerald-900"
                      : "bg-gray-100 border-gray-300 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  $ Flat
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profitMargin">
                Profit Margin {formData.marginType === "percentage" ? "(%)" : "($)"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {formData.marginType === "percentage" ? "%" : "$"}
                </span>
                <Input
                  id="profitMargin"
                  type="number"
                  value={formData.profitMargin}
                  onChange={(e) => set("profitMargin", e.target.value)}
                  placeholder="0"
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salePrice">Sale Price (Auto-calculated)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <Input
                  id="salePrice"
                  type="number"
                  value={formData.salePrice}
                  onChange={(e) => set("salePrice", e.target.value)}
                  placeholder="0"
                  className="pl-7"
                  disabled={generatedVariants.length > 0}
                />
              </div>
              {formData.costPrice && formData.profitMargin && (
                <p className="text-xs text-gray-600 mt-1">
                  {formData.costPrice} + {formData.profitMargin}{formData.marginType === "percentage" ? "%" : ""} = ${formData.salePrice}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <div className="flex gap-2">
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => set("stock", e.target.value)}
                  placeholder="0"
                  className="flex-1"
                  disabled={generatedVariants.length > 0}
                />
                <div className="w-1/3">
                  <Select
                    value={formData.locationId || String(warehouses[0]?.id || "")}
                    onValueChange={(val) => set("locationId", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Location" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => (
                        <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {generatedVariants.length > 0 && <p className="text-xs text-gray-500">Stock is calculated from variants</p>}
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-medium">Attributes & Variants</h3>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                {attributesLoading ? (
                  <p className="text-sm text-gray-400">Loading attributes...</p>
                ) : globalAttributes.length === 0 ? (
                  <p className="text-sm text-gray-400">No attributes found. Add attributes from the Attributes page first.</p>
                ) : globalAttributes.map(attr => (
                  <div key={attr.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`attr-${attr.id}`}
                      checked={selectedAttributeIds.includes(attr.id)}
                      onCheckedChange={(checked) => handleAttributeSelect(attr.id, checked as boolean)}
                    />
                    <Label htmlFor={`attr-${attr.id}`}>{attr.displayName || attr.name}</Label>
                  </div>
                ))}
              </div>

              {productAttributes.map(attr => {
                const globalAttr = globalAttributes.find(a => a.id === attr.id || a.name.toLowerCase() === attr.name.toLowerCase())
                if (!globalAttr) {
                  // Render a simple text display for attributes not in global list
                  return (
                    <div key={attr.id} className="flex items-center gap-4">
                      <Label className="w-24 shrink-0 text-sm font-medium text-gray-700">{attr.name}</Label>
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(attr.value) ? attr.value : [attr.value]).map(val => (
                          <Badge key={val} className="bg-emerald-600 text-white">{val}</Badge>
                        ))}
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={attr.id} className="flex items-center gap-4">
                    <Label className="w-24 shrink-0 text-sm font-medium text-gray-700">
                      {globalAttr.displayName || globalAttr.name}
                    </Label>
                    {globalAttr.option === "dropdown" || globalAttr.option === "radio" ? (
                      globalAttr.values.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {globalAttr.values.map(val => {
                            const isSelected = Array.isArray(attr.value) ? attr.value.includes(val) : attr.value === val
                            return (
                              <Badge
                                key={val}
                                variant={isSelected ? "default" : "outline"}
                                className={`cursor-pointer select-none ${isSelected ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "hover:bg-gray-100"}`}
                                onClick={() => {
                                  let newValue: string[] = Array.isArray(attr.value) ? [...attr.value] : []
                                  newValue = newValue.includes(val) ? newValue.filter(v => v !== val) : [...newValue, val]
                                  handleAttributeValueChange(attr.id, newValue)
                                }}
                              >
                                {val}
                              </Badge>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No values defined for this attribute</p>
                      )
                    ) : (
                      <Input
                        className="flex-1"
                        value={attr.value as string}
                        onChange={(e) => handleAttributeValueChange(attr.id, e.target.value)}
                        placeholder={`Enter ${globalAttr.displayName || globalAttr.name}`}
                      />
                    )}
                  </div>
                )
              })}

              {productAttributes.some(a => Array.isArray(a.value) ? a.value.length > 0 : a.value !== "") && (
                <Button type="button" onClick={generateVariants} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
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
                          <Input type="number" className="h-8 w-24" value={variant.price || ''} onChange={(e) => updateVariant(variant.id, 'price', Number(e.target.value))} />
                        </td>
                        <td className="p-2">
                          <Input type="number" className="h-8 w-24" value={variant.salePrice || ''} onChange={(e) => updateVariant(variant.id, 'salePrice', Number(e.target.value))} />
                        </td>
                        <td className="p-2">
                          <Input type="number" className="h-8 w-24" value={variant.stock || ''} onChange={(e) => updateVariant(variant.id, 'stock', Number(e.target.value))} />
                        </td>
                        <td className="p-2">
                          <Input className="h-8 w-32" value={variant.sku} onChange={(e) => updateVariant(variant.id, 'sku', e.target.value)} />
                        </td>
                        <td className="p-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeVariant(variant.id)}>
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
              onChange={(e) => set("description", e.target.value)}
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
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${isDragging ? "border-emerald-500 bg-emerald-50" : "border-gray-300 hover:border-emerald-500"}`}
            >
              <input type="file" id="file-upload" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileInput} className="hidden" />
              <label htmlFor="file-upload" className="cursor-pointer">
                <CloudUpload className="w-12 h-12 mx-auto mb-4 text-emerald-600" />
                <p className="text-gray-600 font-medium mb-1">Drag your images here</p>
                <p className="text-sm text-gray-400">(Only *.jpeg, *.webp and *.png images will be accepted)</p>
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
                    <img src={image || "/placeholder.svg"} alt={`Upload ${index + 1}`} className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200" />
                    {index === 0 && (
                      <button type="button" className="mt-2 w-24 px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors">
                        Default Image
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-6 border-t flex-col gap-2 items-stretch">
          {errorMessage && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{errorMessage}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={editingProduct ? handleUpdate : handleAdd} className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
              {isSaving ? "Saving..." : `${editingProduct ? "Update" : "Add"} Product`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
