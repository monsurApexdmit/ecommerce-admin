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
import { Trash2, CloudUpload, Copy, Check, Package, Plus, Minus } from "lucide-react"
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
import { useSaasAuth } from "@/contexts/saas-auth-context"

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
  offerPrice: "",
  offerType: "percentage",
  costPrice: "",
  profitMargin: "",
  marginType: "percentage",
  stock: "",
  reorderPoint: "",
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
  const { isPlanModule } = useSaasAuth()
  const [barcodeCopied, setBarcodeCopied] = useState(false)

  const randomAlphaNumeric = useCallback((len: number) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }, [])

  const generateSkuCode = useCallback(() => {
    return `SKU-${randomAlphaNumeric(8)}`
  }, [randomAlphaNumeric])

  const generateBarcodeCode = useCallback(() => {
    return `P${randomAlphaNumeric(8)}`
  }, [randomAlphaNumeric])

  const [formData, setFormData] = useState(emptyForm)
  const [isHotDeal, setIsHotDeal] = useState(false)
  const [isBestSeller, setIsBestSeller] = useState(false)
  const [isFeatured, setIsFeatured] = useState(false)
  const [dealLabel, setDealLabel] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<string[]>([]) // preview URLs (base64 for new, http for existing)
  const [imageFiles, setImageFiles] = useState<File[]>([]) // new files only
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]) // existing server URLs
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([])
  const [productAttributes, setProductAttributes] = useState<{ id: string; name: string; value: string | string[] }[]>([])
  const [generatedVariants, setGeneratedVariants] = useState<Variant[]>([])
  const [trackingType, setTrackingType] = useState<"none" | "serial" | "batch">("none")
  const [isBundle, setIsBundle] = useState(false)
  const [bundlePriceOverride, setBundlePriceOverride] = useState("")
  const [bundleItems, setBundleItems] = useState<{ productId: number; productName: string; productSku: string; variantId?: number; variantName?: string; quantity: number }[]>([])
  const [bundleSearch, setBundleSearch] = useState("")
  const [bundleSearchResults, setBundleSearchResults] = useState<any[]>([])
  const [bundleSearchLoading, setBundleSearchLoading] = useState(false)

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
          offerPrice: String(p.offerPrice || ""),
          offerType: p.offerType || "percentage",
          costPrice: String(p.costPrice || p.cost_price || ""),
          profitMargin: String(p.profitMargin || p.profit_margin || ""),
          marginType: p.marginType || p.margin_type || "percentage",
          stock: String(p.stock || ""),
          reorderPoint: String(p.reorderPoint ?? ""),
          sku: p.sku || "",
          barcode: p.barcode || "",
          vendorId: p.vendorId ? String(p.vendorId) : "",
          receiptNumber: p.receiptNumber || "",
          locationId: p.locationId ? String(p.locationId) : "",
        })

        setIsHotDeal(p.isHotDeal ?? p.is_hot_deal ?? false)
        setIsBestSeller(p.isBestSeller ?? p.is_best_seller ?? false)
        setIsFeatured(p.isFeatured ?? p.is_featured ?? false)
        setDealLabel(p.dealLabel ?? p.deal_label ?? "")
        setTrackingType(p.trackingType ?? "none")
        setIsBundle(p.isBundle ?? false)
        setBundlePriceOverride(p.bundlePriceOverride ? String(p.bundlePriceOverride) : "")
        setBundleItems((p.bundleItems ?? []).map((bi: any) => ({
          productId: bi.productId,
          productName: bi.productName || "",
          productSku: bi.productSku || "",
          variantId: bi.variantId,
          variantName: bi.variantName,
          quantity: bi.quantity || 1,
        })))

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
          offerPrice: v.offerPrice || undefined,
          offerType: v.offerType || undefined,
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
      // Auto-generate SKU and barcode for new product
      const newSku = generateSkuCode()
      const newBarcode = generateBarcodeCode()
      setFormData({ ...emptyForm, sku: newSku, barcode: newBarcode })
      setUploadedImages([])
      setImageFiles([])
      setExistingImageUrls([])
      setProductAttributes([])
      setSelectedAttributeIds([])
      setGeneratedVariants([])
      setBarcodeCopied(false)
      setIsHotDeal(false)
      setIsBestSeller(false)
      setIsFeatured(false)
      setDealLabel("")
      setTrackingType("none")
      setIsBundle(false)
      setBundlePriceOverride("")
      setBundleItems([])
      setBundleSearch("")
      setBundleSearchResults([])
    }
  }, [open, editingProduct, generateBarcodeCode, generateSkuCode])

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

  // Sync offer price/type changes to all existing variants
  useEffect(() => {
    const newOffer = formData.offerPrice ? Number(formData.offerPrice) : undefined
    const newOfferType = formData.offerPrice ? formData.offerType : undefined
    setGeneratedVariants(prev => {
      if (prev.length === 0) return prev
      return prev.map(v => ({ ...v, offerPrice: newOffer, offerType: newOfferType }))
    })
  }, [formData.offerPrice, formData.offerType])

  const set = useCallback((field: keyof typeof emptyForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const searchBundleProducts = useCallback(async (query: string) => {
    if (!query.trim()) { setBundleSearchResults([]); return }
    setBundleSearchLoading(true)
    try {
      const res = await productApi.getAll({ search: query, limit: 10 })
      setBundleSearchResults((res.data || []).filter((p: any) => !p.isBundle && !p.is_bundle))
    } catch { setBundleSearchResults([]) }
    finally { setBundleSearchLoading(false) }
  }, [])

  const addBundleItem = useCallback((product: any, variant?: any) => {
    const productId = product.id ? parseInt(product.id) : product.id
    const variantId = variant?.id ? parseInt(variant.id) : undefined
    const exists = bundleItems.some(bi => bi.productId === productId && bi.variantId === variantId)
    if (exists) return
    setBundleItems(prev => [...prev, {
      productId,
      productName: product.name,
      productSku: product.sku || "",
      variantId,
      variantName: variant?.name,
      quantity: 1,
    }])
    setBundleSearch("")
    setBundleSearchResults([])
  }, [bundleItems])

  const updateBundleItemQty = useCallback((index: number, qty: number) => {
    setBundleItems(prev => prev.map((bi, i) => i === index ? { ...bi, quantity: Math.max(1, qty) } : bi))
  }, [])

  const removeBundleItem = useCallback((index: number) => {
    setBundleItems(prev => prev.filter((_, i) => i !== index))
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
        offerPrice: formData.offerPrice ? Number.parseFloat(formData.offerPrice) : undefined,
        offerType: formData.offerPrice ? formData.offerType : undefined,
        costPrice: formData.costPrice ? Number.parseFloat(formData.costPrice) : undefined,
        profitMargin: formData.profitMargin ? Number.parseFloat(formData.profitMargin) : undefined,
        marginType: formData.marginType || "percentage",
        stock: finalStock,
        reorderPoint: formData.reorderPoint ? Number.parseInt(formData.reorderPoint) : 0,
        trackingType,
        status: finalStock > 0 ? "Selling" : "Out of Stock",
        published: true,
        isHotDeal,
        isBestSeller,
        isFeatured,
        dealLabel: dealLabel || undefined,
        image: uploadedImages[0] || "",
        images: imageFiles,
        sku: formData.sku,
        barcode: formData.barcode,
        vendorId: formData.vendorId || undefined,
        receiptNumber: formData.receiptNumber || undefined,
        attributes: productAttributes,
        variants: generatedVariants,
        inventory: [{ warehouseId: formData.locationId || String(warehouses[0]?.id || ""), quantity: finalStock }],
        isBundle,
        bundlePriceOverride: bundlePriceOverride ? Number(bundlePriceOverride) : undefined,
        bundleItems: isBundle ? bundleItems : [],
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
        offerPrice: formData.offerPrice && Number.parseFloat(formData.offerPrice) > 0 ? Number.parseFloat(formData.offerPrice) : null,
        offerType: formData.offerPrice && Number.parseFloat(formData.offerPrice) > 0 ? formData.offerType : null,
        costPrice: formData.costPrice ? Number.parseFloat(formData.costPrice) : undefined,
        profitMargin: formData.profitMargin ? Number.parseFloat(formData.profitMargin) : undefined,
        marginType: formData.marginType || "percentage",
        stock: finalStock,
        reorderPoint: formData.reorderPoint ? Number.parseInt(formData.reorderPoint) : 0,
        trackingType,
        status: finalStock > 0 ? "Selling" : "Out of Stock",
        isHotDeal,
        isBestSeller,
        isFeatured,
        dealLabel: dealLabel || undefined,
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
        isBundle,
        bundlePriceOverride: bundlePriceOverride ? Number(bundlePriceOverride) : undefined,
        bundleItems: isBundle ? bundleItems : [],
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
        offerPrice: formData.offerPrice ? Number(formData.offerPrice) : undefined,
        offerType: formData.offerPrice ? formData.offerType : undefined,
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
              <div className="flex items-center justify-between">
                <Label htmlFor="sku">
                  Product SKU
                  <Badge className="ml-2 bg-emerald-600">Auto-Generated</Badge>
                </Label>
              </div>
              <div className="flex gap-2">
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="Product SKU"
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newSku = generateSkuCode()
                    set("sku", newSku)
                  }}
                  className="whitespace-nowrap"
                >
                  Regenerate
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="barcode">
                  Product Barcode
                  <Badge className="ml-2 bg-emerald-600">Auto-Generated</Badge>
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

            {isPlanModule("Vendors") && (
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
            )}

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
              <Label>Offer / Discount</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => set("offerType", "percentage")}
                  className={`px-3 py-2 rounded border text-sm transition-colors ${
                    formData.offerType === "percentage"
                      ? "bg-orange-100 border-orange-500 text-orange-900"
                      : "bg-gray-100 border-gray-300 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  % Off
                </button>
                <button
                  type="button"
                  onClick={() => set("offerType", "flat")}
                  className={`px-3 py-2 rounded border text-sm transition-colors ${
                    formData.offerType === "flat"
                      ? "bg-orange-100 border-orange-500 text-orange-900"
                      : "bg-gray-100 border-gray-300 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  $ Flat
                </button>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    {formData.offerType === "percentage" ? "%" : "$"}
                  </span>
                  <Input
                    type="number"
                    value={formData.offerPrice}
                    onChange={(e) => set("offerPrice", e.target.value)}
                    placeholder="0 = no offer"
                    className="pl-7"
                    min={0}
                  />
                </div>
              </div>
              {formData.offerPrice && formData.salePrice && (
                <p className="text-xs text-orange-600 mt-1">
                  Offer price:{" "}
                  <strong>
                    $
                    {formData.offerType === "percentage"
                      ? (Number(formData.salePrice) * (1 - Number(formData.offerPrice) / 100)).toFixed(2)
                      : (Number(formData.salePrice) - Number(formData.offerPrice)).toFixed(2)}
                  </strong>{" "}
                  ({formData.offerPrice}{formData.offerType === "percentage" ? "%" : "$"} off ${formData.salePrice})
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

            <div className="space-y-2">
              <Label htmlFor="reorderPoint">Reorder Point</Label>
              <Input
                id="reorderPoint"
                type="number"
                min="0"
                value={formData.reorderPoint}
                onChange={(e) => set("reorderPoint", e.target.value)}
                placeholder="0 (disabled)"
              />
              <p className="text-xs text-gray-500">Get a low stock alert when stock falls to or below this number. Set 0 to disable.</p>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Inventory Tracking Type</Label>
              <div className="flex gap-2">
                {(["none", "serial", "batch"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTrackingType(type)}
                    className={`flex-1 px-3 py-2 rounded border text-sm transition-colors capitalize ${
                      trackingType === type
                        ? "bg-blue-100 border-blue-500 text-blue-900 font-medium"
                        : "bg-gray-50 border-gray-300 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {type === "none" ? "None (default)" : type === "serial" ? "Serial Number" : "Batch / Lot"}
                  </button>
                ))}
              </div>
              {trackingType === "serial" && (
                <p className="text-xs text-blue-600">Each unit gets a unique serial number. Stock = count of available serials. Manage serials from the Serial/Batch page.</p>
              )}
              {trackingType === "batch" && (
                <p className="text-xs text-blue-600">Units grouped in batches/lots with expiry dates. Stock = sum of remaining batch quantities. Uses FEFO (First Expired First Out) on sell.</p>
              )}
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
                      <th className="p-2 text-left">Offer (type + value)</th>
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
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => updateVariant(variant.id, 'offerType', 'percentage')}
                                className={`px-1.5 py-1 rounded text-xs border ${(variant.offerType ?? 'percentage') === 'percentage' ? 'bg-orange-100 border-orange-400 text-orange-800' : 'bg-gray-100 border-gray-300 text-gray-600'}`}
                              >%</button>
                              <button
                                type="button"
                                onClick={() => updateVariant(variant.id, 'offerType', 'flat')}
                                className={`px-1.5 py-1 rounded text-xs border ${variant.offerType === 'flat' ? 'bg-orange-100 border-orange-400 text-orange-800' : 'bg-gray-100 border-gray-300 text-gray-600'}`}
                              >$</button>
                              <Input type="number" className="h-7 w-16 text-xs" placeholder="0" value={variant.offerPrice || ''} onChange={(e) => updateVariant(variant.id, 'offerPrice', Number(e.target.value) || undefined)} />
                            </div>
                            {variant.offerPrice ? (
                              <span className="text-xs text-orange-600">
                                =${(variant.offerType ?? 'percentage') === 'percentage'
                                  ? (variant.salePrice * (1 - variant.offerPrice / 100)).toFixed(2)
                                  : (variant.salePrice - variant.offerPrice).toFixed(2)}
                              </span>
                            ) : null}
                          </div>
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

          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-medium">Deal & Promotion Tags</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="hotDeal" className="font-medium">Hot Deal</Label>
                  <p className="text-xs text-muted-foreground">Show in hot deals section</p>
                </div>
                <Switch id="hotDeal" checked={isHotDeal} onCheckedChange={setIsHotDeal} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="bestSeller" className="font-medium">Best Seller</Label>
                  <p className="text-xs text-muted-foreground">Mark as best seller</p>
                </div>
                <Switch id="bestSeller" checked={isBestSeller} onCheckedChange={setIsBestSeller} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="featured" className="font-medium">Featured</Label>
                  <p className="text-xs text-muted-foreground">Show in featured section</p>
                </div>
                <Switch id="featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dealLabel">Deal Label <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="dealLabel"
                value={dealLabel}
                onChange={(e) => setDealLabel(e.target.value)}
                placeholder="e.g. Flash Sale, Limited Offer, 40% Off"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">Overrides auto badge on the storefront. Leave blank to use tag name.</p>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium flex items-center gap-2"><Package className="w-5 h-5 text-emerald-600" /> Bundle / Kit</h3>
                <p className="text-xs text-gray-500 mt-0.5">Group multiple products into one bundle. Stock = minimum available across child products.</p>
              </div>
              <Switch id="isBundle" checked={isBundle} onCheckedChange={setIsBundle} />
            </div>

            {isBundle && (
              <div className="space-y-4 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                <div className="space-y-2">
                  <Label htmlFor="bundlePriceOverride">Bundle Price Override <span className="text-gray-400 font-normal">(optional — leave blank to use product price)</span></Label>
                  <div className="relative w-48">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <Input
                      id="bundlePriceOverride"
                      type="number"
                      min="0"
                      value={bundlePriceOverride}
                      onChange={(e) => setBundlePriceOverride(e.target.value)}
                      placeholder="Use product price"
                      className="pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Add Child Products</Label>
                  <div className="relative">
                    <Input
                      value={bundleSearch}
                      onChange={(e) => {
                        setBundleSearch(e.target.value)
                        searchBundleProducts(e.target.value)
                      }}
                      placeholder="Search products to add..."
                      className="bg-white"
                    />
                    {bundleSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-white border rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {bundleSearchLoading && <div className="p-2 text-sm text-gray-400">Searching...</div>}
                        {bundleSearchResults.map((p: any) => (
                          <div key={p.id} className="border-b last:border-0">
                            <button
                              type="button"
                              onClick={() => addBundleItem(p)}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50 flex items-center justify-between"
                            >
                              <span>{p.name} <span className="text-gray-400 text-xs">({p.sku})</span></span>
                              <span className="text-xs text-gray-500">Stock: {p.stock}</span>
                            </button>
                            {p.variants?.length > 0 && p.variants.map((v: any) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => addBundleItem(p, v)}
                                className="w-full px-6 py-1.5 text-left text-xs hover:bg-emerald-50 text-gray-600 flex items-center justify-between border-t border-gray-100"
                              >
                                <span>└ {v.name}</span>
                                <span className="text-gray-400">Stock: {v.stock}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {bundleItems.length > 0 && (
                  <div className="rounded-md border bg-white overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="p-2 text-left">Product</th>
                          <th className="p-2 text-left">Variant</th>
                          <th className="p-2 text-center w-28">Qty in Bundle</th>
                          <th className="p-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {bundleItems.map((bi, index) => (
                          <tr key={index} className="border-b last:border-0">
                            <td className="p-2">
                              <div className="font-medium">{bi.productName}</div>
                              <div className="text-xs text-gray-400">{bi.productSku}</div>
                            </td>
                            <td className="p-2 text-gray-500 text-xs">{bi.variantName || "—"}</td>
                            <td className="p-2">
                              <div className="flex items-center gap-1 justify-center">
                                <button type="button" onClick={() => updateBundleItemQty(index, bi.quantity - 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100"><Minus className="w-3 h-3" /></button>
                                <Input
                                  type="number"
                                  min="1"
                                  value={bi.quantity}
                                  onChange={(e) => updateBundleItemQty(index, parseInt(e.target.value) || 1)}
                                  className="h-7 w-12 text-center text-sm p-1"
                                />
                                <button type="button" onClick={() => updateBundleItemQty(index, bi.quantity + 1)} className="w-6 h-6 rounded border flex items-center justify-center hover:bg-gray-100"><Plus className="w-3 h-3" /></button>
                              </div>
                            </td>
                            <td className="p-2">
                              <button type="button" onClick={() => removeBundleItem(index)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {bundleItems.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-2">No child products added yet. Search above to add products.</p>
                )}
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
