"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Trash2, CloudUpload, Copy, Check, Package, Plus, Minus, RefreshCw } from "lucide-react"
import { BARCODE_TYPES, barcodeMisfit, barcodeTypeLabel, generateBarcode, generateSku, isNumericBarcodeType, skuSuffix } from "@/components/products/form-barcode"
import { cn } from "@/lib/utils"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { generateId } from "@/lib/export-import-utils"
import { useProduct, type Product, type Variant } from "@/contexts/product-context"
import { productApi } from "@/lib/productApi"
import { useVendor } from "@/contexts/vendor-context"
import { useCategory } from "@/contexts/category-context"
import { unitApi, type UnitResponse } from "@/lib/unitApi"
import { brandApi, type BrandResponse } from "@/lib/brandApi"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useAttribute } from "@/contexts/attribute-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"

const NONE = "__none__"
const MAX_IMAGES = 6
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const card = "rounded-[14px] border border-dash-border bg-dash-card p-[18px]"
const labelCls = "flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold"
const inputCls =
  "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal text-dash-ink outline-none placeholder:text-dash-muted focus-visible:border-dash-accent disabled:cursor-not-allowed disabled:bg-dash-neutral-soft disabled:text-dash-muted"
const cellCls =
  "h-9 rounded-lg border border-dash-border bg-dash-card px-2 text-sm font-normal text-dash-ink outline-none focus-visible:border-dash-accent"
const selectCls = "!h-[42px] w-full rounded-[10px] border-dash-border bg-dash-card text-sm font-normal text-dash-ink"

const Section = ({ n, title, hint, children, action }: { n?: number; title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <section className={card}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-dash-display text-base font-bold">
          {n !== undefined && (
            <span className="grid size-6 place-items-center rounded-full bg-dash-accent-soft text-xs font-bold text-dash-accent-fg tabular-nums">{n}</span>
          )}
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-[13px] text-dash-muted">{hint}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
)

const ToggleRow = ({ id, title, sub, checked, onChange }: { id: string; title: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    type="button" role="switch" id={id} aria-checked={checked} onClick={() => onChange(!checked)}
    className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border border-dash-border bg-dash-card px-3 py-2 text-left hover:bg-dash-neutral-soft"
  >
    <span className="flex min-w-0 flex-col">
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-dash-muted">{sub}</span>
    </span>
    <span className={cn("flex h-[22px] w-10 flex-none items-center rounded-full p-[3px] transition-colors", checked ? "justify-end bg-dash-accent" : "justify-start bg-dash-neutral")}>
      <span className="size-4 rounded-full bg-white" />
    </span>
  </button>
)


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
  unitId: "",
  brandId: "",
  price: "",
  salePrice: "",
  offerPrice: "",
  offerType: "percentage",
  offerEndsAt: "",
  wholesalePrice: "",
  minWholesaleQty: "",
  costPrice: "",
  profitMargin: "",
  marginType: "percentage",
  stock: "",
  reorderPoint: "",
  sku: "",
  barcode: "",
  barcodeType: "C128",
  vendorId: "",
  receiptNumber: "",
  locationId: "",
  supplierPaymentStatus: "due",
  supplierPaidAmount: "",
  supplierPaymentMethod: "cash",
  supplierPaymentDate: new Date().toISOString().slice(0, 10),
}

export function ProductFormDialog({ open, editingProduct, onClose }: ProductFormDialogProps) {
  const { addProduct, updateProduct, products: allProducts } = useProduct()
  const { vendors, refreshVendors } = useVendor()
  const { warehouses, refreshLocations } = useWarehouse()
  const { categories, getAllCategoriesFlat, refreshCategories } = useCategory()
  const { attributes: globalAttributes, isLoading: attributesLoading } = useAttribute()
  const { toast } = useToast()
  const { formatCurrency } = useCompanySettings()
  const [barcodeCopied, setBarcodeCopied] = useState(false)
  const [units, setUnits] = useState<UnitResponse[]>([])
  const [brands, setBrands] = useState<BrandResponse[]>([])

  useEffect(() => {
    if (open) unitApi.simple().then(setUnits).catch(() => {})
    if (open) brandApi.simple().then(setBrands).catch(() => {})
  }, [open])

  const generateSkuCode = useCallback(() => generateSku(), [])
  const generateBarcodeCode = useCallback((type = "C128") => generateBarcode(type), [])
  const [barcodeTouched, setBarcodeTouched] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [tag, setTag] = useState("")
  const [availableInPos, setAvailableInPos] = useState(true)
  const [visibleOnline, setVisibleOnline] = useState(true)
  const [imageError, setImageError] = useState<string | null>(null)
  const currencySymbol = (formatCurrency(0).replace(/[\d.,\s]/g, "") || "$").slice(0, 3)
  const today = new Date().toISOString().slice(0, 10)

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
  const [bundleItems, setBundleItems] = useState<{ productId: number; productName: string; productSku: string; variantId?: number; variantName?: string; quantity: number; stock?: number }[]>([])
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
          unitId: p.unitId ? String(p.unitId) : "",
          brandId: p.brandId ? String(p.brandId) : "",
          price: String(p.price || ""),
          salePrice: String(p.salePrice || ""),
          offerPrice: String(p.offerPrice || ""),
          offerType: p.offerType || "percentage",
          offerEndsAt: p.offerEndsAt ? String(p.offerEndsAt).slice(0, 10) : "",
          wholesalePrice: p.wholesalePrice ? String(p.wholesalePrice) : "",
          minWholesaleQty: p.minWholesaleQty ? String(p.minWholesaleQty) : "",
          costPrice: String(p.costPrice || p.cost_price || ""),
          ...(() => {
            // Selling price is derived from cost + margin. Older products may have a price but no margin:
            // express it as a flat margin so the derived price matches what was saved.
            const cost = Number(p.costPrice || p.cost_price || 0)
            const sale = Number(p.salePrice || p.price || 0)
            const m = Number(p.profitMargin || p.profit_margin || 0)
            const mt = p.marginType || p.margin_type || "percentage"
            const derived = mt === "percentage" ? cost * (1 + m / 100) : cost + m
            if (sale > 0 && Math.abs(derived - sale) > 0.01) return { profitMargin: String(Math.round((sale - cost) * 100) / 100), marginType: "flat" }
            return { profitMargin: m ? String(m) : "", marginType: mt }
          })(),
          stock: String(p.stock || ""),
          reorderPoint: String(p.reorderPoint ?? ""),
          sku: p.sku || "",
          barcode: p.barcode || "",
          barcodeType: (p as any).barcodeType || "C128",
          vendorId: p.vendorId ? String(p.vendorId) : "",
          receiptNumber: p.receiptNumber || "",
          locationId: p.locationId ? String(p.locationId) : "",
          supplierPaymentStatus: "due",
          supplierPaidAmount: "",
          supplierPaymentMethod: "cash",
          supplierPaymentDate: new Date().toISOString().slice(0, 10),
        })

        setBarcodeTouched(true)
        setTag(p.tag ?? "")
        setAvailableInPos(p.availableInPos ?? p.available_in_pos ?? true)
        setVisibleOnline(p.visibleOnline ?? p.visible_online ?? p.published ?? true)
        setImageError(null)
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
      setFormData({ ...emptyForm, sku: newSku, barcode: newBarcode, supplierPaymentDate: new Date().toISOString().slice(0, 10) })
      setBarcodeTouched(false)
      setTag("")
      setAvailableInPos(true)
      setVisibleOnline(true)
      setImageError(null)
      setErrorMessage(null)
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
  }, [open, editingProduct, generateBarcodeCode, generateSkuCode, resetKey])

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

  // Sync offer price/type changes to all existing variants
  useEffect(() => {
    const newOffer = formData.offerPrice ? Number(formData.offerPrice) : undefined
    const newOfferType = formData.offerPrice ? formData.offerType : undefined
    setGeneratedVariants(prev => {
      if (prev.length === 0) return prev
      return prev.map(v => ({ ...v, offerPrice: newOffer, offerType: newOfferType }))
    })
  }, [formData.offerPrice, formData.offerType])

  // Changing the barcode type regenerates a valid code (correct check digit) unless the
  // user's own barcode already fits the new type.
  const changeBarcodeType = (type: string) => {
    setFormData(prev => {
      const fits = !barcodeMisfit(type, prev.barcode) && prev.barcode.trim() !== ""
      const keep = barcodeTouched && fits
      return { ...prev, barcodeType: type, barcode: keep ? prev.barcode : generateBarcode(type) }
    })
    if (!barcodeTouched || !formData.barcode.trim() || barcodeMisfit(type, formData.barcode)) setBarcodeTouched(false)
  }

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
    if (editingProduct && String(productId) === editingProduct.id) {
      toast({ variant: "destructive", title: "Not allowed", description: "A bundle cannot contain itself." })
      return
    }
    const exists = bundleItems.some(bi => bi.productId === productId && bi.variantId === variantId)
    if (exists) {
      toast({ variant: "destructive", title: "Already in bundle", description: "That item is already in this bundle — change its quantity instead." })
      return
    }
    setBundleItems(prev => [...prev, {
      productId,
      productName: product.name,
      productSku: product.sku || "",
      variantId,
      variantName: variant?.name,
      quantity: 1,
      stock: typeof (variant ?? product).stock === "number" ? (variant ?? product).stock : undefined,
    }])
    setBundleSearch("")
    setBundleSearchResults([])
  }, [bundleItems, editingProduct, toast])

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

  const submit = async (mode: "save" | "draft" | "another") => {
    const asDraft = mode === "draft"
    const missing: string[] = []
    if (!formData.name?.trim()) missing.push("Product name")
    if (!asDraft && !(basePrice > 0)) missing.push("Selling price above 0 (set a cost and margin, or a variant price)")
    if (!(formData.locationId || editingProduct?.locationId || warehouses[0]?.id)) missing.push("Warehouse")
    const fail = (title: string, msg: string) => {
      setErrorMessage(msg)
      toast({ variant: "destructive", title, description: msg })
    }
    if (missing.length) return fail("Missing required fields", `Please fill in: ${missing.join(", ")}`)

    if (skuError) return fail("Duplicate SKU", skuError)
    const vErr = Object.values(variantSkuErrors)[0]
    if (vErr) return fail("Duplicate variant SKU", vErr)
    if (barcodeError) return fail("Duplicate barcode", barcodeError)
    if (costNum < 0) return fail("Invalid cost", "Cost price cannot be negative.")
    if (Number(formData.profitMargin) < 0) return fail("Invalid margin", "Profit margin cannot be negative.")
    if (formData.offerType === "percentage" && offerNum > 100) return fail("Invalid offer", "A percentage offer cannot be more than 100%.")
    if (offerNum < 0) return fail("Invalid offer", "Offer cannot be negative.")
    const badVariant = generatedVariants.find(v => (v.offerType ?? "percentage") === "percentage" && (v.offerPrice || 0) > 100)
    if (badVariant) return fail("Invalid offer", `Variant "${badVariant.name}": a percentage offer cannot be more than 100%.`)
    if (!asDraft && isBundle) {
      if (bundleItems.length === 0) return fail("Bundle is empty", "Add at least one product to the bundle.")
      if (editingProduct && bundleItems.some(bi => String(bi.productId) === editingProduct.id))
        return fail("Invalid bundle", "A bundle cannot contain itself.")
    }

    let finalStock = Number.parseInt(formData.stock || "0") || 0
    if (generatedVariants.length > 0) finalStock = generatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
    const supplierTotalNow = costNum * finalStock
    if (!editingProduct && formData.vendorId && formData.supplierPaymentStatus === "partial") {
      const paid = Number(formData.supplierPaidAmount) || 0
      if (paid <= 0 || paid >= supplierTotalNow) return fail("Invalid supplier payment", "Partial payment must be more than 0 and less than the total supplier cost")
    }

    const isEdit = !!editingProduct
    const hasOffer = offerNum > 0
    const wh = formData.locationId || editingProduct?.locationId || String(warehouses[0]?.id || "")
    const variantsOut = generatedVariants.map(v => ({ ...v, price: v.salePrice }))
    const keepImages = uploadedImages.filter(u => existingImageUrls.includes(u)).map(u => u.replace(/^.*\/storage\//, ""))
    setIsSaving(true)
    setErrorMessage(null)
    try {
      const payload: any = {
        name: formData.name.trim(),
        description: formData.description,
        category: formData.category,
        categoryId: formData.categoryId,
        unitId: formData.unitId,
        brandId: formData.brandId,
        locationId: wh,
        price: basePrice,
        salePrice: basePrice,
        offerPrice: hasOffer ? offerNum : isEdit ? null : undefined,
        offerType: hasOffer ? formData.offerType : isEdit ? null : undefined,
        offerEndsAt: hasOffer && formData.offerEndsAt ? formData.offerEndsAt : isEdit ? null : undefined,
        wholesalePrice: formData.wholesalePrice ? Number.parseFloat(formData.wholesalePrice) : isEdit ? null : undefined,
        minWholesaleQty: formData.minWholesaleQty ? Math.floor(Number(formData.minWholesaleQty)) : isEdit ? null : undefined,
        costPrice: formData.costPrice ? Number.parseFloat(formData.costPrice) : undefined,
        profitMargin: formData.profitMargin ? Number.parseFloat(formData.profitMargin) : undefined,
        marginType: formData.marginType || "percentage",
        stock: finalStock,
        reorderPoint: formData.reorderPoint ? Number.parseInt(formData.reorderPoint) : 0,
        trackingType,
        status: finalStock > 0 ? "Selling" : "Out of Stock",
        published: !asDraft && visibleOnline,
        availableInPos,
        visibleOnline,
        tag: isEdit ? tag.trim() : (tag.trim() || undefined),
        isHotDeal,
        isBestSeller,
        isFeatured,
        dealLabel: dealLabel || undefined,
        sku: formData.sku,
        barcode: formData.barcode,
        barcodeType: formData.barcodeType,
        vendorId: formData.vendorId || undefined,
        receiptNumber: formData.receiptNumber || undefined,
        attributes: productAttributes,
        variants: variantsOut,
        inventory: [{ warehouseId: wh, quantity: finalStock }],
        isBundle,
        bundlePriceOverride: isBundle && bundlePriceOverride ? Number(bundlePriceOverride) : undefined,
        bundleItems: isBundle ? bundleItems : [],
      }
      if (isEdit) {
        await updateProduct({
          ...editingProduct!,
          ...payload,
          categoryId: formData.categoryId || undefined,
          unitId: formData.unitId || undefined,
          brandId: formData.brandId || undefined,
          image: uploadedImages[0] || editingProduct!.image,
          images: imageFiles.length > 0 ? imageFiles : undefined,
          delete_images: false,
          keep_images: keepImages,
        })
      } else {
        await addProduct({
          ...payload,
          image: uploadedImages[0] || "",
          images: imageFiles,
          ...(formData.vendorId && supplierTotalNow > 0 ? {
            supplierPaymentStatus: formData.supplierPaymentStatus as "due" | "partial" | "paid",
            supplierPaidAmount: formData.supplierPaymentStatus === "partial" ? Number(formData.supplierPaidAmount) || 0 : undefined,
            supplierPaymentMethod: formData.supplierPaymentMethod,
            supplierPaymentDate: formData.supplierPaymentDate,
          } : {}),
        })
      }
      if (mode === "another") {
        toast({ title: "Product added", description: `"${formData.name.trim()}" saved. Ready for the next one.` })
        setResetKey(k => k + 1)
      } else {
        if (asDraft) toast({ title: "Saved as draft", description: "The product is hidden until you publish it." })
        handleClose()
      }
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.error || (isEdit ? "Failed to update product" : "Failed to create product")
      console.error("Failed to save product:", msg, err)
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
    e.target.value = ""
  }
  const handleFiles = (files: File[]) => {
    const errors: string[] = []
    const typeOk = files.filter(f => {
      const ok = ["image/jpeg", "image/png", "image/webp"].includes(f.type)
      if (!ok) errors.push(`"${f.name}" is not a JPG, PNG or WEBP image.`)
      return ok
    })
    const sizeOk = typeOk.filter(f => {
      const ok = f.size <= MAX_IMAGE_BYTES
      if (!ok) errors.push(`"${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)} MB — images must be 5 MB or smaller.`)
      return ok
    })
    const room = Math.max(0, MAX_IMAGES - uploadedImages.length)
    const valid = sizeOk.slice(0, room)
    if (sizeOk.length > room) errors.push(`You can add up to ${MAX_IMAGES} images — ${sizeOk.length - room} not added.`)
    setImageError(errors.length ? errors.join(" ") : null)
    if (errors.length) toast({ variant: "destructive", title: "Some images were not added", description: errors[0] })
    if (!valid.length) return
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
    setImageError(null)
  }

  // Attribute & Variant logic
  const variantKey = (attrs: { [k: string]: string }, names: string[]) => names.map(n => `${n}=${attrs?.[n] ?? ""}`).join("|")

  // Adds only NEW combinations; variants already in the list (and any edits to them) are kept.
  const generateVariants = (attributesToUse?: typeof productAttributes | any, opts?: { silent?: boolean; fresh?: boolean }) => {
    const attrs = Array.isArray(attributesToUse) ? attributesToUse : productAttributes
    const activeAttributes = attrs.filter((attr: any) =>
      Array.isArray(attr.value) ? attr.value.length > 0 : attr.value !== ""
    )
    const existing = opts?.fresh ? [] : generatedVariants
    if (activeAttributes.length === 0) { setGeneratedVariants([]); return }
    const cartesian = (args: any[][]): any[][] =>
      args.reduce((acc: any[][], list: any[]) => acc.flatMap(a => list.map(v => [...a, v])), [[]])
    const valueArrays = activeAttributes.map((attr: any) => Array.isArray(attr.value) ? attr.value : [attr.value])
    const combinations = cartesian(valueArrays)
    const names: string[] = activeAttributes.map((a: any) => a.name)
    const existingKeys = new Set(existing.map(v => variantKey(v.attributes, names)))
    const fresh = combinations.filter((combo: string[]) => {
      const o: { [k: string]: string } = {}
      combo.forEach((val, i) => { o[names[i]] = val })
      return !existingKeys.has(variantKey(o, names))
    })
    const firstBatch = existing.length === 0
    const perVariant = firstBatch ? Math.floor((Number(formData.stock) || 0) / Math.max(1, combinations.length)) : 0
    const wh = formData.locationId || String(warehouses[0]?.id || "")
    const baseSku = formData.sku || "SKU"
    const usedSkus = new Set(existing.map(v => v.sku.toLowerCase()))
    const added: Variant[] = fresh.map((combo: string[]) => {
      const variantAttributes: { [key: string]: string } = {}
      combo.forEach((val, index) => { variantAttributes[names[index]] = val })
      let sku = `${baseSku}-${combo.map((p: string) => skuSuffix(p)).join("-")}`
      let n = 2
      while (usedSkus.has(sku.toLowerCase())) sku = `${baseSku}-${combo.map((p: string) => skuSuffix(p)).join("-")}-${n++}`
      usedSkus.add(sku.toLowerCase())
      return {
        id: generateId(),
        name: combo.join(" / "),
        attributes: variantAttributes,
        // Defaults come from the product; each can be edited afterwards.
        price: sellingPrice,
        salePrice: sellingPrice,
        offerPrice: formData.offerPrice ? Number(formData.offerPrice) : undefined,
        offerType: formData.offerPrice ? formData.offerType : undefined,
        stock: perVariant,
        sku,
        inventory: [{ warehouseId: wh, quantity: perVariant }],
      }
    })
    const keepers = existing.filter(v => {
      const k = variantKey(v.attributes, names)
      return combinations.some((combo: string[]) => {
        const o: { [k2: string]: string } = {}
        combo.forEach((val, i) => { o[names[i]] = val })
        return variantKey(o, names) === k
      })
    })
    setGeneratedVariants([...keepers, ...added])
    if (!opts?.silent) {
      toast({ title: added.length ? `${added.length} new variant${added.length === 1 ? "" : "s"} added` : "No new combinations", description: added.length ? "Existing variants were kept as they are." : "All combinations already exist." })
    }
  }

  const selectAllValues = (attrId: string, values: string[]) => handleAttributeValueChange(attrId, [...values])
  const clearValues = (attrId: string) => handleAttributeValueChange(attrId, [])

  const setTopStock = (value: string) => {
    setFormData(prev => ({ ...prev, stock: value }))
    setGeneratedVariants(prev => {
      if (prev.length === 0) return prev
      const total = Math.max(0, Math.floor(Number(value) || 0))
      const base = Math.floor(total / prev.length)
      const extra = total - base * prev.length
      return prev.map((v, i) => ({ ...v, stock: base + (i < extra ? 1 : 0) }))
    })
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
      generateVariants(newAttrs, { silent: true, fresh: true })
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
            generateVariants(newAttributes, { silent: true, fresh: true })
          } else {
            setGeneratedVariants(current => current.filter(v => !removed.includes(v.attributes[attr.name])))
          }
        }
      }
      return newAttributes
    })
  }

  const setVariantPrice = (id: string, value: number) => {
    setGeneratedVariants(prev => prev.map(v => v.id === id ? { ...v, price: value, salePrice: value } : v))
  }
  const updateVariant = (id: string, field: keyof Variant, value: any) => {
    setGeneratedVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))
  }
  const removeVariant = (id: string) => {
    setGeneratedVariants(prev => prev.filter(v => v.id !== id))
  }


  // ---- Derived pricing figures ----
  const costNum = Number(formData.costPrice) || 0
  const marginNum = Number(formData.profitMargin) || 0
  const calcPrice = formData.marginType === "percentage" ? costNum * (1 + marginNum / 100) : costNum + marginNum
  const bundleOverrideNum = Number(bundlePriceOverride) || 0
  // Selling price comes from cost + margin, unless a bundle price override is set.
  const sellingPrice = Math.round((isBundle && bundleOverrideNum > 0 ? bundleOverrideNum : calcPrice) * 100) / 100
  const salePriceNum = sellingPrice
  const offerNum = Number(formData.offerPrice) || 0
  const finalPrice = offerNum > 0
    ? Math.max(0, formData.offerType === "percentage" ? salePriceNum * (1 - offerNum / 100) : salePriceNum - offerNum)
    : salePriceNum
  const positiveVariantPrices = generatedVariants.map(v => v.salePrice).filter(x => x > 0)
  const basePrice = sellingPrice > 0 ? sellingPrice : (positiveVariantPrices.length ? Math.min(...positiveVariantPrices) : 0)
  const hasCost = costNum > 0 && finalPrice > 0
  const profitPerUnit = finalPrice - costNum
  const marginPct = hasCost ? (profitPerUnit / finalPrice) * 100 : null
  const markupPct = hasCost ? (profitPerUnit / costNum) * 100 : null
  const lossWarn = costNum > 0 && finalPrice > 0 && finalPrice < costNum
  const totalStockShown = generatedVariants.length > 0
    ? generatedVariants.reduce((s, v) => s + (v.stock || 0), 0)
    : Number.parseInt(formData.stock || "0") || 0
  const hasVariants = generatedVariants.length > 0
  const selectedWarehouseName = warehouses.find(w => String(w.id) === formData.locationId)?.name

  // ---- Duplicate SKU / barcode checks against loaded products ----
  const norm = (x?: string | null) => (x || "").trim().toLowerCase()
  const { takenSkus, takenBarcodes } = (() => {
    const skus = new Map<string, string>()
    const bcs = new Map<string, string>()
    allProducts.forEach(p => {
      if (editingProduct && p.id === editingProduct.id) return
      if (norm(p.sku)) skus.set(norm(p.sku), p.name)
      if (norm(p.barcode)) bcs.set(norm(p.barcode), p.name)
      ;(p.variants || []).forEach(v => {
        if (norm(v.sku)) skus.set(norm(v.sku), p.name)
        if (norm(v.barcode)) bcs.set(norm(v.barcode), p.name)
      })
    })
    return { takenSkus: skus, takenBarcodes: bcs }
  })()
  const skuError = (() => {
    const k = norm(formData.sku)
    if (!k) return null
    if (takenSkus.has(k)) return `SKU "${formData.sku.trim()}" is already used by "${takenSkus.get(k)}".`
    if (generatedVariants.some(v => norm(v.sku) === k)) return `SKU "${formData.sku.trim()}" is also used by one of the variants.`
    return null
  })()
  const variantSkuErrors: Record<string, string> = (() => {
    const out: Record<string, string> = {}
    const seen = new Map<string, string>()
    generatedVariants.forEach(v => {
      const k = norm(v.sku)
      if (!k) return
      if (takenSkus.has(k)) out[v.id] = `Variant SKU "${v.sku}" is already used by "${takenSkus.get(k)}".`
      else if (k === norm(formData.sku)) out[v.id] = `Variant SKU "${v.sku}" matches the product SKU.`
      else if (seen.has(k)) out[v.id] = `Variant SKU "${v.sku}" is used by more than one variant.`
      seen.set(k, v.id)
    })
    return out
  })()
  const barcodeError = (() => {
    const k = norm(formData.barcode)
    if (k && takenBarcodes.has(k)) return `Barcode "${formData.barcode.trim()}" is already used by "${takenBarcodes.get(k)}".`
    return null
  })()
  const barcodeMisfitHint = barcodeMisfit(formData.barcodeType, formData.barcode)

  // ---- Non-blocking warnings ----
  const warnings: string[] = []
  if (lossWarn) warnings.push(`Selling price ${formatCurrency(finalPrice)} is below cost ${formatCurrency(costNum)} — you would lose ${formatCurrency(costNum - finalPrice)} per unit.`)
  if (formData.offerEndsAt && offerNum > 0 && formData.offerEndsAt < today) warnings.push("The offer end date is in the past.")
  if (Number(formData.wholesalePrice) > 0 && Number(formData.wholesalePrice) > sellingPrice) warnings.push("Wholesale price is higher than the selling price.")
  if (barcodeMisfitHint) warnings.push(`Barcode does not fit ${barcodeTypeLabel(formData.barcodeType)} (${barcodeMisfitHint}) — will print as Code 128.`)

  // ---- Bundles ----
  const findChild = (bi: { productId: number; variantId?: number }) => {
    const prod = allProducts.find(p => p.id === String(bi.productId))
    const variant = bi.variantId !== undefined ? prod?.variants?.find(v => v.id === String(bi.variantId)) : undefined
    return { prod, variant }
  }
  const bundleRows = bundleItems.map(bi => {
    const { prod, variant } = findChild(bi)
    const stock = variant ? variant.stock : prod?.stock ?? (bi as any).stock
    const unit = variant ? (variant.salePrice || variant.price) : (prod?.salePrice ?? prod?.price)
    return {
      stock: typeof stock === "number" ? stock : null,
      available: typeof stock === "number" ? Math.floor(stock / Math.max(1, bi.quantity)) : null,
      lineTotal: typeof unit === "number" ? unit * bi.quantity : null,
    }
  })
  const bundlesAvailable = bundleRows.length > 0 && bundleRows.every(r => r.available !== null)
    ? Math.min(...bundleRows.map(r => r.available as number)) : null
  const bundleItemsTotal = bundleRows.reduce((s, r) => s + (r.lineTotal || 0), 0)

  const seg = (on: boolean, tone: "accent" | "warn" = "accent") =>
    cn(
      "h-10 flex-1 rounded-lg border px-3 text-sm font-semibold transition-colors",
      on
        ? tone === "warn"
          ? "border-dash-warn bg-dash-warn-soft text-dash-warn-fg"
          : "border-dash-accent bg-dash-accent-soft text-dash-accent-fg"
        : "border-dash-border bg-dash-card text-dash-muted hover:bg-dash-neutral-soft",
    )

  const money = (children: React.ReactNode, symbol: React.ReactNode) => (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dash-muted">{symbol}</span>
      {children}
    </span>
  )

  const showSupplierPayment = !editingProduct && formData.vendorId
  const supplierQty = totalStockShown
  const supplierTotal = costNum * supplierQty
  const supplierPaid = formData.supplierPaymentStatus === "paid" ? supplierTotal
    : formData.supplierPaymentStatus === "partial" ? Number(formData.supplierPaidAmount) || 0 : 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          bricolage.variable, instrument.variable,
          "flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[1180px] flex-col gap-0 overflow-hidden rounded-[18px] border-dash-border bg-dash-bg p-0 font-dash-body text-dash-ink sm:max-w-[1180px]",
        )}
      >
        <DialogHeader className="border-b border-dash-border bg-dash-card px-6 py-[18px] text-left">
          <DialogTitle className="font-dash-display text-[22px] font-bold">{editingProduct ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription className="text-[13px] text-dash-muted">
            {editingProduct ? "Update the product details below." : "Fill in the basics now. Everything except the name and price can be changed later."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* ------------ Main column ------------ */}
            <div className="flex min-w-0 flex-col gap-5">
              <Section n={1} title="Basic information" hint="What customers and staff see.">
                <div className="flex flex-col gap-3">
                  <label className={labelCls}>Product name *
                    <input id="name" className={inputCls} value={formData.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Cotton Panjabi – White" />
                  </label>
                  <label className={labelCls}>Description
                    <textarea id="description" rows={3} value={formData.description} onChange={(e) => set("description", e.target.value)}
                      placeholder="Fabric, fit, care instructions…"
                      className="resize-y rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm font-normal text-dash-ink outline-none placeholder:text-dash-muted focus-visible:border-dash-accent" />
                  </label>
                </div>
              </Section>

              <Section n={2} title="Images" hint={`First image is the cover. JPG, PNG or WEBP, up to ${MAX_IMAGES} images, 5 MB each (${uploadedImages.length}/${MAX_IMAGES}).`}>
                <div
                  onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
                  className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3"
                >
                  {uploadedImages.map((image, index) => (
                    <div key={index} className="group relative aspect-square overflow-hidden rounded-xl border border-dash-border bg-dash-neutral-soft">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image || "/placeholder.svg"} alt={`Product image ${index + 1}`} className="size-full object-cover" />
                      {index === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-dash-accent px-2 py-0.5 text-[11px] font-bold text-white">Cover</span>
                      )}
                      <button type="button" onClick={() => removeImage(index)} aria-label={`Remove image ${index + 1}`}
                        className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-dash-card/90 text-dash-danger shadow hover:bg-dash-danger-soft">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {uploadedImages.length < MAX_IMAGES && <>
                  <input type="file" id="file-upload" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileInput} className="sr-only" />
                  <label htmlFor="file-upload"
                    className={cn("flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-center text-[13px] font-semibold text-dash-muted transition-colors focus-within:border-dash-accent hover:border-dash-accent hover:text-dash-accent",
                      isDragging ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border")}>
                    <CloudUpload className="size-6" />
                    Add images
                    <span className="px-2 text-[11px] font-normal">or drag them here</span>
                  </label>
                  </>}
                </div>
                {imageError && <p role="alert" className="mt-3 rounded-[10px] border border-dash-danger bg-dash-danger-soft px-3 py-2 text-[13px] font-medium text-dash-danger-fg">{imageError}</p>}
              </Section>

              <Section n={3} title="Pricing" hint="Set cost and margin — we work out the selling price.">
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={labelCls}>Cost price
                      {money(<input id="costPrice" type="number" min={0} className={cn(inputCls, "pl-7")} value={formData.costPrice} onChange={(e) => set("costPrice", e.target.value)} placeholder="0" />, currencySymbol)}
                      <span className="text-xs font-normal text-dash-muted">What you pay the supplier</span>
                    </label>
                    <div className={labelCls}>
                      <span id="marginTypeLbl">Margin type</span>
                      <div role="radiogroup" aria-labelledby="marginTypeLbl" className="flex gap-2">
                        <button type="button" role="radio" aria-checked={formData.marginType === "percentage"} onClick={() => set("marginType", "percentage")} className={seg(formData.marginType === "percentage")}>% Percentage</button>
                        <button type="button" role="radio" aria-checked={formData.marginType === "flat"} onClick={() => set("marginType", "flat")} className={seg(formData.marginType === "flat")}>{currencySymbol} Flat</button>
                      </div>
                    </div>
                    <label className={labelCls}>Profit margin {formData.marginType === "percentage" ? "(%)" : `(${currencySymbol})`}
                      {money(<input id="profitMargin" type="number" min={0} className={cn(inputCls, "pl-7")} value={formData.profitMargin} onChange={(e) => set("profitMargin", e.target.value)} placeholder="0" />, formData.marginType === "percentage" ? "%" : currencySymbol)}
                    </label>
                    <div className={labelCls}>
                      <span>Selling price <span className="ml-1 rounded-full bg-dash-accent-soft px-2 py-0.5 text-[11px] font-bold text-dash-accent-fg">auto</span></span>
                      <span className="flex h-[42px] items-center justify-between rounded-[10px] bg-dash-accent-soft px-3 text-lg font-bold tabular-nums text-dash-accent-fg">
                        {formatCurrency(sellingPrice)}
                        <span className="text-xs font-semibold">
                          {isBundle && bundleOverrideNum > 0 ? "bundle price" : costNum > 0 || marginNum > 0
                            ? `${costNum} ${formData.marginType === "percentage" ? `+ ${marginNum}%` : `+ ${marginNum}`}`
                            : "cost + margin"}
                        </span>
                      </span>
                      <span className="text-xs font-normal text-dash-muted">
                        {hasVariants ? "Variants below start from this price and can be edited."
                          : "Worked out from cost + margin (no cost? use a flat margin as the price). This is the price customers see."}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                    {[
                      { k: "Profit per unit", v: hasCost ? formatCurrency(profitPerUnit) : "—", bad: hasCost && profitPerUnit < 0 },
                      { k: "Margin", v: marginPct === null ? "—" : `${marginPct.toFixed(1)}%`, bad: marginPct !== null && marginPct < 0 },
                      { k: "Markup", v: markupPct === null ? "—" : `${markupPct.toFixed(1)}%`, bad: markupPct !== null && markupPct < 0 },
                      { k: "Price after offer", v: salePriceNum > 0 ? formatCurrency(finalPrice) : "—", bad: false },
                    ].map(s => (
                      <div key={s.k} className="rounded-xl border border-dash-border-soft bg-dash-bg px-3 py-2.5">
                        <div className="text-xs text-dash-muted">{s.k}</div>
                        <div className={cn("font-dash-display text-lg font-bold tabular-nums", s.bad && "text-dash-danger")}>{s.v}</div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)]">
                    <div className={labelCls}>
                      <span id="offerTypeLbl">Offer / discount</span>
                      <div role="radiogroup" aria-labelledby="offerTypeLbl" className="flex gap-2">
                        <button type="button" role="radio" aria-checked={formData.offerType === "percentage"} onClick={() => set("offerType", "percentage")} className={cn(seg(formData.offerType === "percentage", "warn"), "flex-none")}>% Off</button>
                        <button type="button" role="radio" aria-checked={formData.offerType === "flat"} onClick={() => set("offerType", "flat")} className={cn(seg(formData.offerType === "flat", "warn"), "flex-none")}>{currencySymbol} Flat</button>
                      </div>
                    </div>
                    <label className={labelCls}>{formData.offerType === "percentage" ? "Discount (%)" : "Discount amount"}
                      {money(<input type="number" min={0} max={formData.offerType === "percentage" ? 100 : undefined} aria-invalid={formData.offerType === "percentage" && offerNum > 100} className={cn(inputCls, "pl-7", formData.offerType === "percentage" && offerNum > 100 && "border-dash-danger")} value={formData.offerPrice} onChange={(e) => set("offerPrice", e.target.value)} placeholder="0" />, formData.offerType === "percentage" ? "%" : currencySymbol)}
                      {formData.offerType === "percentage" && offerNum > 100
                        ? <span className="text-xs font-medium text-dash-danger">A percentage offer cannot be more than 100%.</span>
                        : <span className="text-xs font-normal text-dash-muted">0 = no offer</span>}
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label className={labelCls}>Offer ends
                      <input type="date" className={inputCls} value={formData.offerEndsAt} min={today} disabled={!Number(formData.offerPrice)}
                        onChange={(e) => set("offerEndsAt", e.target.value)} />
                      <span className="text-xs font-normal text-dash-muted">Blank = no end date</span>
                    </label>
                    <label className={labelCls}>Wholesale price
                      {money(<input type="number" min={0} className={cn(inputCls, "pl-7")} value={formData.wholesalePrice} onChange={(e) => set("wholesalePrice", e.target.value)} placeholder="0" />, currencySymbol)}
                    </label>
                    <label className={labelCls}>Min. wholesale qty
                      <input type="number" min={0} className={inputCls} value={formData.minWholesaleQty} onChange={(e) => set("minWholesaleQty", e.target.value)} placeholder="e.g. 12" />
                    </label>
                  </div>
                  {warnings.length > 0 && (
                    <div role="status" className="flex flex-col gap-1 rounded-[10px] border border-dash-warn bg-dash-warn-soft px-3 py-2 text-[13px] font-medium text-dash-warn-fg">
                      {warnings.map(w => <span key={w}>{w}</span>)}
                      <span className="text-xs font-normal">These are warnings only — you can still save.</span>
                    </div>
                  )}
                </div>
              </Section>

              <Section n={4} title="Inventory" hint="Opening stock and when to warn you.">
                <div className="flex flex-col gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={labelCls}>{editingProduct ? "Stock" : "Opening stock"}
                      <input id="stock" type="number" min={0} className={inputCls} value={formData.stock} onChange={(e) => setTopStock(e.target.value)} placeholder="0" />
                      {hasVariants && <span className="text-xs font-normal text-dash-muted">Changing this spreads the total evenly over the {generatedVariants.length} variants; you can still edit each one.</span>}
                    </label>
                    <div className={labelCls}>
                      <span id="whLbl">Warehouse</span>
                      <Select value={formData.locationId || String(warehouses[0]?.id || "")} onValueChange={(val) => set("locationId", val)}>
                        <SelectTrigger aria-labelledby="whLbl" className={selectCls}><SelectValue placeholder="Location" /></SelectTrigger>
                        <SelectContent>
                          {warehouses.map(w => (<SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <label className={labelCls}>Reorder point
                      <input id="reorderPoint" type="number" min={0} className={inputCls} value={formData.reorderPoint} onChange={(e) => set("reorderPoint", e.target.value)} placeholder="0 (off)" />
                      <span className="text-xs font-normal text-dash-muted">Low-stock alert at or below this. 0 = off</span>
                    </label>
                    <label className={labelCls}>Receipt / batch no.
                      <input id="receiptNumber" className={inputCls} value={formData.receiptNumber} onChange={(e) => set("receiptNumber", e.target.value)} placeholder="Optional" />
                    </label>
                  </div>
                  <div className={labelCls}>
                    <span id="trackLbl">Track by</span>
                    <div role="radiogroup" aria-labelledby="trackLbl" className="flex flex-wrap gap-2">
                      {(["none", "serial", "batch"] as const).map((type) => (
                        <button key={type} type="button" role="radio" aria-checked={trackingType === type} onClick={() => setTrackingType(type)} className={seg(trackingType === type)}>
                          {type === "none" ? "Quantity only" : type === "serial" ? "Serial" : "Batch"}
                        </button>
                      ))}
                    </div>
                    {trackingType === "none" && (
                      <span className="text-xs font-normal text-dash-muted">Just a stock count — no serial or batch numbers.</span>
                    )}
                    {trackingType === "serial" && (
                      <span className="text-xs font-normal text-dash-muted">Each unit gets a unique serial number. Stock = count of available serials. Manage serials from the Serial/Batch page.</span>
                    )}
                    {trackingType === "batch" && (
                      <span className="text-xs font-normal text-dash-muted">Units grouped in batches/lots with expiry dates. Stock = sum of remaining batch quantities. Uses FEFO (First Expired First Out) on sell.</span>
                    )}
                  </div>
                </div>
              </Section>

              <Section n={5} title="Variants" hint="Sell the same product in different colours or sizes." action={<a href="/dashboard/attributes" target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-dash-accent hover:underline">Manage attributes →</a>}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {attributesLoading ? (
                      <p className="text-sm text-dash-muted">Loading attributes…</p>
                    ) : globalAttributes.length === 0 ? (
                      <p className="text-sm text-dash-muted">No attributes found. Add attributes from the Attributes page first.</p>
                    ) : globalAttributes.map(attr => {
                      const on = selectedAttributeIds.includes(attr.id)
                      return (
                        <button key={attr.id} type="button" aria-pressed={on} onClick={() => handleAttributeSelect(attr.id, !on)}
                          className={cn("h-9 rounded-full border px-3.5 text-[13px] font-semibold",
                            on ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>
                          {on ? "✓ " : "+ "}{attr.displayName || attr.name}
                        </button>
                      )
                    })}
                  </div>

                  {productAttributes.map(attr => {
                    const globalAttr = globalAttributes.find(a => a.id === attr.id || a.name.toLowerCase() === attr.name.toLowerCase())
                    if (!globalAttr) {
                      return (
                        <div key={attr.id} className="flex flex-wrap items-center gap-3">
                          <span className="w-24 shrink-0 text-[13px] font-semibold">{attr.name}</span>
                          <div className="flex flex-wrap gap-2">
                            {(Array.isArray(attr.value) ? attr.value : [attr.value]).map(val => (
                              <span key={val} className="rounded-full bg-dash-accent-soft px-3 py-1 text-[13px] font-semibold text-dash-accent-fg">{val}</span>
                            ))}
                          </div>
                        </div>
                      )
                    }
                    return (
                      <div key={attr.id} className="flex flex-wrap items-center gap-3">
                        <span className="w-24 shrink-0 text-[13px] font-semibold">{globalAttr.displayName || globalAttr.name}</span>
                        {(globalAttr.option === "dropdown" || globalAttr.option === "radio") && globalAttr.values.length > 0 && (
                          <span className="flex shrink-0 gap-2 text-xs font-semibold text-dash-accent">
                            <button type="button" className="hover:underline" onClick={() => selectAllValues(attr.id, globalAttr.values)}>Select all</button>
                            <button type="button" className="text-dash-muted hover:underline" onClick={() => clearValues(attr.id)}>Clear</button>
                          </span>
                        )}
                        {globalAttr.option === "dropdown" || globalAttr.option === "radio" ? (
                          globalAttr.values.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {globalAttr.values.map(val => {
                                const isSelected = Array.isArray(attr.value) ? attr.value.includes(val) : attr.value === val
                                return (
                                  <button key={val} type="button" aria-pressed={isSelected}
                                    onClick={() => {
                                      let newValue: string[] = Array.isArray(attr.value) ? [...attr.value] : []
                                      newValue = newValue.includes(val) ? newValue.filter(v => v !== val) : [...newValue, val]
                                      handleAttributeValueChange(attr.id, newValue)
                                    }}
                                    className={cn("h-8 rounded-full border px-3 text-[13px] font-semibold",
                                      isSelected ? "border-dash-accent bg-dash-accent text-white" : "border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>
                                    {val}
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-xs italic text-dash-muted">No values defined for this attribute</p>
                          )
                        ) : (
                          <input className={cn(inputCls, "flex-1")} aria-label={globalAttr.displayName || globalAttr.name}
                            value={attr.value as string} onChange={(e) => handleAttributeValueChange(attr.id, e.target.value)}
                            placeholder={`Enter ${globalAttr.displayName || globalAttr.name}`} />
                        )}
                      </div>
                    )
                  })}

                  {productAttributes.some(a => Array.isArray(a.value) ? a.value.length > 0 : a.value !== "") && (
                    <button type="button" onClick={() => generateVariants()} className="h-11 w-full rounded-[10px] bg-dash-accent text-sm font-bold text-white">
                      {hasVariants ? "Generate new combinations" : "Generate variants"}
                    </button>
                  )}

                  {hasVariants && (
                    <>
                      <div className="overflow-x-auto rounded-xl border border-dash-border">
                        <table className="w-full text-sm">
                          <thead className="bg-dash-bg text-left text-xs font-bold uppercase tracking-[0.04em] text-dash-muted">
                            <tr>
                              <th className="p-2.5">Variant</th>
                              <th className="p-2.5">Price</th>
                              <th className="p-2.5">Offer (type + value)</th>
                              <th className="p-2.5">Stock</th>
                              <th className="p-2.5">SKU</th>
                              <th className="p-2.5"><span className="sr-only">Actions</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {generatedVariants.map(variant => (
                              <tr key={variant.id} className="border-t border-dash-border-soft">
                                <td className="p-2.5 font-semibold">{variant.name}</td>
                                <td className="p-2.5"><input type="number" aria-label={`${variant.name} price`} min={0} className={cn(cellCls, "w-24")} value={variant.salePrice || ""} onChange={(e) => setVariantPrice(variant.id, Number(e.target.value))} /></td>
                                <td className="p-2.5">
                                  <div className="flex flex-col gap-1">
                                    <div className="flex gap-1">
                                      <button type="button" aria-label="Percentage offer" aria-pressed={(variant.offerType ?? "percentage") === "percentage"} onClick={() => updateVariant(variant.id, "offerType", "percentage")}
                                        className={cn("h-9 rounded-md border px-2 text-xs font-bold", (variant.offerType ?? "percentage") === "percentage" ? "border-dash-warn bg-dash-warn-soft text-dash-warn-fg" : "border-dash-border text-dash-muted")}>%</button>
                                      <button type="button" aria-label="Flat offer" aria-pressed={variant.offerType === "flat"} onClick={() => updateVariant(variant.id, "offerType", "flat")}
                                        className={cn("h-9 rounded-md border px-2 text-xs font-bold", variant.offerType === "flat" ? "border-dash-warn bg-dash-warn-soft text-dash-warn-fg" : "border-dash-border text-dash-muted")}>$</button>
                                      <input type="number" min={0} aria-label={`${variant.name} offer value`} aria-invalid={(variant.offerType ?? "percentage") === "percentage" && (variant.offerPrice || 0) > 100} className={cn(cellCls, "w-16", (variant.offerType ?? "percentage") === "percentage" && (variant.offerPrice || 0) > 100 && "border-dash-danger")} placeholder="0" value={variant.offerPrice || ""} onChange={(e) => updateVariant(variant.id, "offerPrice", Number(e.target.value) || undefined)} />
                                    </div>
                                    {(variant.offerType ?? "percentage") === "percentage" && (variant.offerPrice || 0) > 100 ? (
                                      <span className="text-xs font-medium text-dash-danger">Max 100%</span>
                                    ) : variant.offerPrice ? (
                                      <span className="text-xs font-semibold tabular-nums text-dash-warn-fg">
                                        = {formatCurrency((variant.offerType ?? "percentage") === "percentage"
                                          ? variant.salePrice * (1 - variant.offerPrice / 100)
                                          : variant.salePrice - variant.offerPrice)}
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="p-2.5"><input type="number" aria-label={`${variant.name} stock`} className={cn(cellCls, "w-20")} value={variant.stock || ""} onChange={(e) => updateVariant(variant.id, "stock", Number(e.target.value))} /></td>
                                <td className="p-2.5"><input aria-label={`${variant.name} SKU`} aria-invalid={!!variantSkuErrors[variant.id]} title={variantSkuErrors[variant.id]} className={cn(cellCls, "w-36 font-mono", variantSkuErrors[variant.id] && "border-dash-danger")} value={variant.sku} onChange={(e) => updateVariant(variant.id, "sku", e.target.value)} />
                                  {variantSkuErrors[variant.id] && <span className="mt-1 block max-w-[220px] text-xs font-medium text-dash-danger">{variantSkuErrors[variant.id]}</span>}
                                </td>
                                <td className="p-2.5">
                                  <button type="button" aria-label={`Remove variant ${variant.name}`} onClick={() => removeVariant(variant.id)}
                                    className="grid size-9 place-items-center rounded-lg text-dash-danger hover:bg-dash-danger-soft">
                                    <Trash2 className="size-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-dash-muted tabular-nums">{generatedVariants.length} variants · each gets its own SKU and stock · price starts from the product price</span>
                        <button type="button" onClick={() => setGeneratedVariants([])} className="h-9 rounded-lg border border-dash-border px-3 text-[13px] font-semibold text-dash-danger hover:bg-dash-danger-soft">Remove all variants</button>
                      </div>
                    </>
                  )}
                </div>
              </Section>

              <Section n={6} title="Online store & promotions" hint="How this product appears on your website.">
                <div className="flex flex-col gap-4">
                  <div className="grid gap-2.5 md:grid-cols-3">
                    <ToggleRow id="hotDeal" title="Hot deal" sub="Show in Hot deals" checked={isHotDeal} onChange={setIsHotDeal} />
                    <ToggleRow id="bestSeller" title="Best seller" sub="Show Best seller badge" checked={isBestSeller} onChange={setIsBestSeller} />
                    <ToggleRow id="featured" title="Featured" sub="Show on home page" checked={isFeatured} onChange={setIsFeatured} />
                  </div>
                  <label className={labelCls}>Custom tag (optional)
                    <input id="tag" className={inputCls} value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. New arrival" maxLength={30} />
                    <span className="text-xs font-normal text-dash-muted">One short tag shown as a badge, in addition to Best seller / Hot deal.</span>
                  </label>
                  <label className={labelCls}>Badge text (optional)
                    <input id="dealLabel" className={inputCls} value={dealLabel} onChange={(e) => setDealLabel(e.target.value)} placeholder="e.g. Eid special, 40% off" maxLength={50} />
                    <span className="text-xs font-normal text-dash-muted">Replaces the automatic badge. Leave blank to use the tag name.</span>
                  </label>
                  <ToggleRow id="isBundle" title="Bundle / kit" sub="Sell several products together. Stock = lowest available item." checked={isBundle} onChange={setIsBundle} />

                  {isBundle && (
                    <div className="flex flex-col gap-4 rounded-xl border border-dash-border bg-dash-bg p-4">
                      <label className={cn(labelCls, "max-w-xs")}>Bundle price override
                        {money(<input id="bundlePriceOverride" type="number" min={0} className={cn(inputCls, "pl-7")} value={bundlePriceOverride} onChange={(e) => setBundlePriceOverride(e.target.value)} placeholder="Use items total" />, currencySymbol)}
                        <span className="text-xs font-normal text-dash-muted">Optional — leave blank to price the bundle from cost + margin</span>
                      </label>

                      <div className={labelCls}>
                        <label htmlFor="bundleSearch">Add child products</label>
                        <div className="relative">
                          <input id="bundleSearch" className={inputCls} value={bundleSearch} placeholder="Search products to add…"
                            onChange={(e) => { setBundleSearch(e.target.value); searchBundleProducts(e.target.value) }} />
                          {bundleSearchResults.length > 0 && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-[10px] border border-dash-border bg-dash-card shadow-lg">
                              {bundleSearchLoading && <div className="p-2 text-sm text-dash-muted">Searching…</div>}
                              {bundleSearchResults.map((p: any) => (
                                <div key={p.id} className="border-b border-dash-border-soft last:border-0">
                                  <button type="button" onClick={() => addBundleItem(p)}
                                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-normal hover:bg-dash-neutral-soft">
                                    <span>{p.name} <span className="text-xs text-dash-muted">({p.sku})</span></span>
                                    <span className="text-xs text-dash-muted tabular-nums">Stock: {p.stock}</span>
                                  </button>
                                  {p.variants?.length > 0 && p.variants.map((v: any) => (
                                    <button key={v.id} type="button" onClick={() => addBundleItem(p, v)}
                                      className="flex w-full items-center justify-between border-t border-dash-border-soft px-6 py-1.5 text-left text-xs font-normal text-dash-muted hover:bg-dash-neutral-soft">
                                      <span>└ {v.name}</span>
                                      <span className="tabular-nums">Stock: {v.stock}</span>
                                    </button>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {bundleItems.length > 0 ? (
                        <div className="overflow-hidden rounded-xl border border-dash-border bg-dash-card">
                          <table className="w-full text-sm">
                            <thead className="bg-dash-bg text-left text-xs font-bold uppercase tracking-[0.04em] text-dash-muted">
                              <tr>
                                <th className="p-2.5">Product</th>
                                <th className="p-2.5">Variant</th>
                                <th className="w-32 p-2.5 text-center">Qty in bundle</th>
                                <th className="w-24 p-2.5 text-right">Available</th>
                                <th className="w-10 p-2.5"><span className="sr-only">Remove</span></th>
                              </tr>
                            </thead>
                            <tbody>
                              {bundleItems.map((bi, index) => (
                                <tr key={index} className="border-t border-dash-border-soft">
                                  <td className="p-2.5">
                                    <div className="font-semibold">{bi.productName}</div>
                                    <div className="text-xs text-dash-muted">{bi.productSku}</div>
                                  </td>
                                  <td className="p-2.5 text-xs text-dash-muted">{bi.variantName || "—"}</td>
                                  <td className="p-2.5">
                                    <div className="flex items-center justify-center gap-1">
                                      <button type="button" aria-label="Decrease quantity" onClick={() => updateBundleItemQty(index, bi.quantity - 1)} className="grid size-8 place-items-center rounded-lg border border-dash-border hover:bg-dash-neutral-soft"><Minus className="size-3" /></button>
                                      <input type="number" min={1} aria-label={`${bi.productName} quantity`} value={bi.quantity} onChange={(e) => updateBundleItemQty(index, parseInt(e.target.value) || 1)} className={cn(cellCls, "w-14 text-center")} />
                                      <button type="button" aria-label="Increase quantity" onClick={() => updateBundleItemQty(index, bi.quantity + 1)} className="grid size-8 place-items-center rounded-lg border border-dash-border hover:bg-dash-neutral-soft"><Plus className="size-3" /></button>
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-right text-sm tabular-nums">
                                    {bundleRows[index]?.available === null || bundleRows[index]?.available === undefined
                                      ? <span className="text-dash-muted">—</span>
                                      : <span className={cn("font-semibold", bundleRows[index].available === 0 && "text-dash-danger")}>{bundleRows[index].available}</span>}
                                  </td>
                                  <td className="p-2.5">
                                    <button type="button" aria-label={`Remove ${bi.productName}`} onClick={() => removeBundleItem(index)} className="grid size-9 place-items-center rounded-lg text-dash-danger hover:bg-dash-danger-soft"><Trash2 className="size-4" /></button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-dash-border-soft bg-dash-bg px-3 py-2 text-xs text-dash-muted tabular-nums">
                            <span>Bundles available from current stock: <strong className="text-dash-ink">{bundlesAvailable === null ? "—" : bundlesAvailable}</strong></span>
                            <span>Items add up to <strong className="text-dash-ink">{formatCurrency(bundleItemsTotal)}</strong>{sellingPrice > 0 && bundleItemsTotal > 0 ? <> · bundle sells at <strong className="text-dash-ink">{formatCurrency(sellingPrice)}</strong></> : null}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="py-2 text-center text-sm text-dash-muted">No child products added yet. Search above to add products.</p>
                      )}
                    </div>
                  )}
                </div>
              </Section>
            </div>

            {/* ------------ Side column ------------ */}
            <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-0">
              <Section title="Status" hint="Where this product is sold.">
                <div className="flex flex-col gap-2.5">
                  <ToggleRow id="availableInPos" title="Available in POS" sub="Show at the point of sale" checked={availableInPos} onChange={setAvailableInPos} />
                  <ToggleRow id="visibleOnline" title="Visible online" sub="Show on your website" checked={visibleOnline} onChange={setVisibleOnline} />
                  <p className="text-xs text-dash-muted">Use “Save as draft” to keep it hidden everywhere until it is ready.</p>
                </div>
              </Section>

              <Section title="Organise">
                <div className="flex flex-col gap-3">
                  <div className={labelCls}>
                    <span className="flex items-center justify-between"><span id="catLbl">Category</span><a href="/dashboard/categories" target="_blank" rel="noreferrer" className="text-xs font-semibold text-dash-accent hover:underline">+ Category</a></span>
                    <Select value={formData.categoryId || NONE}
                      onValueChange={(value) => {
                        const cat = allCategories.find(c => c.id === value)
                        setFormData(prev => ({ ...prev, categoryId: value === NONE ? "" : value, category: value === NONE ? "" : cat?.category_name || "" }))
                      }}>
                      <SelectTrigger aria-labelledby="catLbl" className={selectCls}><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No category</SelectItem>
                        {allCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id} textValue={cat.category_name}>
                            {cat.parent_id !== null ? `  └─ ${cat.category_name}` : cat.category_name}
                            {!cat.status ? " (Inactive)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={labelCls}>
                    <span className="flex items-center justify-between"><span id="brandLbl">Brand</span><a href="/dashboard/brands" target="_blank" rel="noreferrer" className="text-xs font-semibold text-dash-accent hover:underline">+ Brand</a></span>
                    <Select value={formData.brandId || NONE} onValueChange={(value) => setFormData(prev => ({ ...prev, brandId: value === NONE ? "" : value }))}>
                      <SelectTrigger aria-labelledby="brandLbl" className={selectCls}><SelectValue placeholder="Select brand" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No brand</SelectItem>
                        {brands.filter(b => b.status !== false || String(b.id) === formData.brandId).map((b) => (<SelectItem key={b.id} value={String(b.id)} textValue={b.brandName}>{b.brandName}{b.status === false ? " (Inactive)" : ""}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={labelCls}>
                    <span className="flex items-center justify-between"><span id="unitLbl">Unit</span><a href="/dashboard/units" target="_blank" rel="noreferrer" className="text-xs font-semibold text-dash-accent hover:underline">+ Unit</a></span>
                    <Select value={formData.unitId} onValueChange={(value) => setFormData(prev => ({ ...prev, unitId: value }))}>
                      <SelectTrigger aria-labelledby="unitLbl" className={selectCls}><SelectValue placeholder="Select unit" /></SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)} textValue={u.unitName}>{u.unitName}{u.symbol ? ` (${u.symbol})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={labelCls}>
                    <span id="vendorLbl">Supplier</span>
                    <Select value={formData.vendorId || NONE} onValueChange={(value) => set("vendorId", value === NONE ? "" : value)}>
                      <SelectTrigger aria-labelledby="vendorLbl" className={selectCls}><SelectValue placeholder="Select supplier (optional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {vendors.map((vendor) => (<SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Section>

              {showSupplierPayment && (
                <Section title="Supplier payment" hint={`Cost price × stock = ${formatCurrency(supplierTotal)}`}>
                  {supplierTotal <= 0 ? (
                    <p className="text-[13px] text-dash-muted">Enter a cost price and stock to track what you owe this supplier.</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className={labelCls}>
                        <span id="spStatusLbl">Status</span>
                        <Select value={formData.supplierPaymentStatus} onValueChange={(v) => set("supplierPaymentStatus", v)}>
                          <SelectTrigger aria-labelledby="spStatusLbl" className={selectCls}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="due">Due (unpaid)</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.supplierPaymentStatus === "partial" && (
                        <label className={labelCls}>Paid amount
                          <input type="number" min={0} max={supplierTotal} step="0.01" className={inputCls} value={formData.supplierPaidAmount} onChange={(e) => set("supplierPaidAmount", e.target.value)} placeholder="0.00" />
                        </label>
                      )}
                      {formData.supplierPaymentStatus !== "due" && (
                        <>
                          <div className={labelCls}>
                            <span id="spMethodLbl">Method</span>
                            <Select value={formData.supplierPaymentMethod} onValueChange={(v) => set("supplierPaymentMethod", v)}>
                              <SelectTrigger aria-labelledby="spMethodLbl" className={selectCls}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="bank">Bank</SelectItem>
                                <SelectItem value="bkash">bKash</SelectItem>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <label className={labelCls}>Date
                            <input type="date" className={inputCls} value={formData.supplierPaymentDate} onChange={(e) => set("supplierPaymentDate", e.target.value)} />
                          </label>
                        </>
                      )}
                      <div className="flex justify-between rounded-xl bg-dash-bg px-3 py-2 text-[13px] tabular-nums">
                        <span>Paid: <strong className="text-dash-success-fg">{formatCurrency(supplierPaid)}</strong></span>
                        <span>Due: <strong className="text-dash-danger">{formatCurrency(Math.max(0, supplierTotal - supplierPaid))}</strong></span>
                      </div>
                    </div>
                  )}
                </Section>
              )}

              <Section title="Codes">
                <div className="flex flex-col gap-3">
                  <label className={labelCls}>SKU
                    <span className="flex gap-2">
                      <input id="sku" aria-invalid={!!skuError} className={cn(inputCls, "font-mono", skuError && "border-dash-danger")} value={formData.sku} onChange={(e) => set("sku", e.target.value)} placeholder="SKU" />
                      <button type="button" aria-label="Regenerate SKU" onClick={() => set("sku", generateSkuCode())}
                        className="grid size-[42px] flex-none place-items-center rounded-[10px] border border-dash-border hover:bg-dash-neutral-soft"><RefreshCw className="size-4" /></button>
                    </span>
                    {skuError && <span role="alert" className="text-xs font-medium text-dash-danger">{skuError}</span>}
                  </label>
                  <label className={labelCls}>Barcode
                    <span className="flex gap-2">
                      <input id="barcode" aria-invalid={!!barcodeError} className={cn(inputCls, "font-mono", barcodeError && "border-dash-danger")} value={formData.barcode} onChange={(e) => { setBarcodeTouched(true); set("barcode", e.target.value) }} placeholder="Barcode" />
                      <button type="button" aria-label="Regenerate barcode" onClick={() => { setBarcodeTouched(false); set("barcode", generateBarcodeCode(formData.barcodeType)) }}
                        className="grid size-[42px] flex-none place-items-center rounded-[10px] border border-dash-border hover:bg-dash-neutral-soft"><RefreshCw className="size-4" /></button>
                      {formData.barcode && (
                        <button type="button" aria-label="Copy barcode"
                          onClick={() => {
                            navigator.clipboard.writeText(formData.barcode)
                            setBarcodeCopied(true)
                            toast({ title: "Copied", description: "Barcode copied to clipboard" })
                            setTimeout(() => setBarcodeCopied(false), 2000)
                          }}
                          className="grid size-[42px] flex-none place-items-center rounded-[10px] border border-dash-border hover:bg-dash-neutral-soft">
                          {barcodeCopied ? <Check className="size-4 text-dash-success" /> : <Copy className="size-4" />}
                        </button>
                      )}
                    </span>
                    {barcodeError
                      ? <span role="alert" className="text-xs font-medium text-dash-danger">{barcodeError}</span>
                      : barcodeMisfitHint
                        ? <span className="text-xs font-medium text-dash-warn-fg">Does not fit {barcodeTypeLabel(formData.barcodeType).replace(/ \(.*\)/, "")} ({barcodeMisfitHint}) — will print as Code 128.</span>
                        : <span className="text-xs font-normal text-dash-muted">Auto-generated{isNumericBarcodeType(formData.barcodeType) ? " with a valid check digit" : ""}. Type or scan an existing barcode to use it instead.</span>}
                  </label>
                  <div className={labelCls}>
                    <span id="bcTypeLbl">Barcode type</span>
                    <Select value={formData.barcodeType} onValueChange={changeBarcodeType}>
                      <SelectTrigger aria-labelledby="bcTypeLbl" className={selectCls}><SelectValue placeholder="Select barcode type" /></SelectTrigger>
                      <SelectContent>
                        {BARCODE_TYPES.map(t => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </Section>

              <Section title="Preview in POS">
                <div className="flex items-center gap-3 rounded-xl border border-dash-border-soft bg-dash-bg p-3">
                  <span className="grid size-14 flex-none place-items-center overflow-hidden rounded-lg bg-dash-neutral-soft text-dash-muted">
                    {uploadedImages[0]
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={uploadedImages[0]} alt="" className="size-full object-cover" />
                      : <Package className="size-6" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold">{formData.name || "Product name"}</span>
                    <span className="text-xs text-dash-muted tabular-nums">{totalStockShown} in stock{selectedWarehouseName ? ` · ${selectedWarehouseName}` : ""}</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(finalPrice)}</span>
                </div>
              </Section>
            </aside>
          </div>
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 border-t border-dash-border bg-dash-card px-6 py-4 sm:flex-col">
          {errorMessage && (
            <p role="alert" className="rounded-[10px] border border-dash-danger bg-dash-danger-soft px-3 py-2 text-sm font-medium text-dash-danger-fg">{errorMessage}</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-dash-muted tabular-nums">
              Selling at <strong className="text-dash-ink">{formatCurrency(finalPrice)}</strong>
              {hasCost && <> · profit <strong className="text-dash-ink">{formatCurrency(profitPerUnit)}</strong> per unit</>}
              {hasVariants && <> · {generatedVariants.length} variants</>}
            </span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleClose}
                className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-[18px] text-sm font-semibold hover:bg-dash-neutral-soft">Cancel</button>
              <button type="button" onClick={() => submit("draft")} disabled={isSaving}
                className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-[18px] text-sm font-semibold hover:bg-dash-neutral-soft disabled:opacity-40">Save as draft</button>
              {!editingProduct && (
                <button type="button" onClick={() => submit("another")} disabled={isSaving}
                  className="h-11 rounded-[10px] border border-dash-accent bg-dash-accent-soft px-[18px] text-sm font-semibold text-dash-accent-fg disabled:opacity-40">Save &amp; add another</button>
              )}
              <button type="button" onClick={() => submit("save")} disabled={isSaving}
                className="h-11 rounded-[10px] bg-dash-accent px-[22px] text-sm font-bold text-white disabled:opacity-40">
                {isSaving ? "Saving…" : editingProduct ? "Save changes" : "Save product"}
              </button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
