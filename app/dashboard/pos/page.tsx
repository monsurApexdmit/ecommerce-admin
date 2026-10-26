"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import Link from "next/link"
import { Barcode, Building2, Circle, LayoutGrid, Grid2X2, List, Maximize2, Package, PanelLeft, Search, ShoppingCart, Tag } from "lucide-react"
import { toast } from "sonner"
import { PosProductCard, cardPrice, variantUnitPrice, productUnitPrice, stockPill, type PosTint } from "@/components/pos/pos-product-card"
import { PosCartItem } from "@/components/pos/pos-cart-item"
import { PosPayment, NEEDS_TXN, POS_METHODS, type PosPaymentMethod } from "@/components/pos/pos-payment"
import { PosCustomerPicker } from "@/components/pos/pos-customer-picker"
import { PosCashDrawer } from "@/components/pos/pos-cash-drawer"
import { PosReceipt, type ReceiptData } from "@/components/pos/pos-receipt"
import { BarcodeScanner } from "@/components/pos/barcode-scanner"
import { ThemeAccentControls } from "@/components/theme-accent-controls"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useSidebar } from "@/components/ui/sidebar"
import { type Product, type Variant } from "@/contexts/product-context"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useCategory } from "@/contexts/category-context"
import { useCustomer } from "@/contexts/customer-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { sellsApi } from "@/lib/sellsApi"
import { productApi } from "@/lib/productApi"
import { couponApi, type CouponResponse } from "@/lib/couponApi"
import { apiError, posApi, REGISTERS, type HeldSale, type RegisterSession } from "@/lib/posApi"
import { settingsApi, getPaymentMethods, sellMethodForSlug } from "@/lib/settingsApi"
import inventoryApi from "@/lib/inventoryApi"
import { locationApi, type LocationResponse } from "@/lib/locationApi"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ButtonGroup } from "@/components/ui/button-group"
import { Card } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/common/EmptyState"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SectionTitle } from "@/components/common/SectionTitle"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Kbd } from "@/components/ui/kbd"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface CartItem {
    id: string
    productId: number
    variantId?: number
    inventoryId?: number
    name: string
    price: number
    image: string
    quantity: number
    variantName?: string
    /** Price at quantity 1; wholesale replaces it from `wholesaleMin` units */
    basePrice?: number
    wholesalePrice?: number
    wholesaleMin?: number
    wholesale?: boolean
}

/** Unit price for a cart line: wholesale once the quantity reaches the product's minimum */
const priceForQty = (item: { basePrice?: number; wholesalePrice?: number; wholesaleMin?: number; price: number }, qty: number) => {
    const base = item.basePrice ?? item.price
    const w = item.wholesalePrice ?? 0
    const on = w > 0 && (item.wholesaleMin ?? 0) > 0 && qty >= (item.wholesaleMin ?? 0) && w < base
    return { price: on ? w : base, wholesale: on }
}

type Tender = "exact" | "custom" | number
type SortKey = "best" | "stock" | "name" | "price_asc" | "price_desc"
const SORTS: [SortKey, string][] = [
    ["best", "Best selling"], ["stock", "Most stock"], ["name", "Name"], ["price_asc", "Price: low to high"], ["price_desc", "Price: high to low"],
]

const r2 = (v: number) => Math.round(v * 100) / 100

export default function PosPage() {
    const { warehouses, defaultWarehouse } = useWarehouse()
    const { getAllCategoriesFlat } = useCategory()
    const { getCustomerById } = useCustomer()
    const { taxRate, formatCurrency, formatTaxLabel } = useCompanySettings()
    const { toggleSidebar } = useSidebar()

    // catalogue + search
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCategory, setSelectedCategory] = useState("all")
    const [products, setProducts] = useState<Product[]>([])
    const [productsLoading, setProductsLoading] = useState(false)
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")
    const [viewMode, setViewMode] = useState<"large" | "compact" | "list">("large")
    const [hideOut, setHideOut] = useState(false)
    const [sort, setSort] = useState<SortKey>("best")
    const [reorderById, setReorderById] = useState<Record<string, number>>({})
    const [bestSellers, setBestSellers] = useState<Record<string, number>>({})
    const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    // sale
    const [cart, setCart] = useState<CartItem[]>([])
    const [selectedCustomerId, setSelectedCustomerId] = useState("")
    const [selectedCustomerName, setSelectedCustomerName] = useState("Walk-in Customer")
    const [discType, setDiscType] = useState<"flat" | "percent">("flat")
    const [discValue, setDiscValue] = useState("")
    const [discOpen, setDiscOpen] = useState(false)
    const [couponOpen, setCouponOpen] = useState(false)
    const [couponInput, setCouponInput] = useState("")
    const [coupon, setCoupon] = useState<CouponResponse | null>(null)
    const [couponMsg, setCouponMsg] = useState("")
    const [couponChoices, setCouponChoices] = useState<CouponResponse[]>([])
    const [payMethod, setPayMethod] = useState<PosPaymentMethod>("Cash")
    const [posMethods, setPosMethods] = useState<PosPaymentMethod[]>(POS_METHODS)
    const [defaultMethod, setDefaultMethod] = useState<PosPaymentMethod>("Cash")
    const [tender, setTender] = useState<Tender>("exact")
    const [tenderInput, setTenderInput] = useState("")
    const [txnId, setTxnId] = useState("")
    const [error, setError] = useState("")
    const [isResetOpen, setIsResetOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [receipt, setReceipt] = useState<ReceiptData | null>(null)
    const [storeName, setStoreName] = useState("")

    // register shift + held sales
    const [register, setRegister] = useState(REGISTERS[0])
    const [session, setSession] = useState<RegisterSession | null>(null)
    const [history, setHistory] = useState<RegisterSession[]>([])
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [drawerError, setDrawerError] = useState("")
    const [held, setHeld] = useState<HeldSale[]>([])
    const [heldOpen, setHeldOpen] = useState(false)
    // Per-location choices for the "Selling from" menu: products in stock + whether the location sells in POS
    const [stockByLoc, setStockByLoc] = useState<Record<number, number>>({})
    const [locMeta, setLocMeta] = useState<Record<number, LocationResponse>>({})

    useEffect(() => {
        if (selectedWarehouseId) return
        if (defaultWarehouse) {
            setSelectedWarehouseId(String(defaultWarehouse.id))
        } else if (warehouses.length > 0) {
            setSelectedWarehouseId(String(warehouses[0].id))
        }
    }, [defaultWarehouse, warehouses]) // eslint-disable-line

    const loadProducts = useCallback(() => {
        if (!selectedWarehouseId) return
        setProductsLoading(true)
        const params: Record<string, any> = {
            limit: 200,
            pos: 1,
            location_id: Number(selectedWarehouseId),
        }
        productApi.getAll(params)
            .then(res => {
                const raw = res.data ?? []
                setReorderById(Object.fromEntries(raw.map((p: any) => [String(p.id), Number(p.reorderPoint ?? p.reorder_point ?? 0)])))
                setProducts(raw.map((p: any) => {
                    const categoryObj = typeof p.category === "object" && p.category !== null ? p.category : null
                    return {
                        id: String(p.id),
                        name: p.name,
                        description: p.description || "",
                        category: categoryObj ? categoryObj.category_name : (p.category as string || ""),
                        categoryId: categoryObj ? String(categoryObj.id) : p.category_id ? String(p.category_id) : undefined,
                        price: p.price,
                        salePrice: p.sale_price ?? p.salePrice ?? p.price,
                        // an expired offer prices at normal (backend flags offerActive)
                        offerPrice: p.offerActive === false ? undefined : (p.offerPrice ?? p.offer_price ?? undefined),
                        offerType: p.offerType ?? p.offer_type ?? undefined,
                        wholesalePrice: p.wholesalePrice ?? p.wholesale_price ?? undefined,
                        minWholesaleQty: p.minWholesaleQty ?? p.min_wholesale_qty ?? undefined,
                        stock: p.stock,
                        status: p.status || (p.stock > 0 ? "Selling" : "Out of Stock"),
                        published: p.published ?? true,
                        image: (() => {
                            try {
                                if (p.images?.length > 0) {
                                    const primaryImage = p.images.find((i: any) => i.isPrimary === true || i.is_primary === true)
                                    const path = primaryImage?.path || p.images[0]?.path
                                    if (path) {
                                        if (path.startsWith("/api/proxy/") || path.startsWith("http")) return path
                                        // Storage paths come as "products/..." - use /api/proxy/uploads/ for file serving
                                        return `/api/proxy/uploads/${path}`
                                    }
                                }
                                if (p.image && p.image.trim()) {
                                    if (p.image.startsWith("/api/proxy/") || p.image.startsWith("http")) return p.image
                                    // Storage paths come as "products/..." - use /api/proxy/uploads/ for file serving
                                    return `/api/proxy/uploads/${p.image}`
                                }
                            } catch (e) {
                                console.error("Error processing image for POS product", p.id, e)
                            }
                            return "/placeholder.svg"
                        })(),
                        sku: p.sku || "",
                        barcode: p.barcode || "",
                        variants: p.variants?.map((v: any) => ({
                            id: String(v.id),
                            name: v.name,
                            attributes: v.attributes || {},
                            price: v.price,
                            salePrice: v.salePrice ?? v.sale_price ?? v.price,
                            offerPrice: v.offerActive === false ? undefined : (v.offerPrice ?? v.offer_price ?? undefined),
                            offerType: v.offerType ?? v.offer_type ?? undefined,
                            stock: v.stock,
                            sku: v.sku || "",
                            barcode: v.barcode,
                            inventory: v.inventory?.map((i: any) => ({
                                inventoryId: i.id,
                                warehouseId: String(i.locationId ?? i.location_id),
                                quantity: i.quantity,
                            })) || [],
                        })) || [],
                    } as Product
                }))
            })
            .catch(err => console.error("Failed to fetch POS products:", err))
            .finally(() => setProductsLoading(false))
    }, [selectedWarehouseId])

    useEffect(() => { loadProducts() }, [loadProducts])

    const refreshShift = useCallback(async () => {
        try {
            const res = await posApi.getShift(register)
            setSession(res.session)
            setHistory(res.history)
        } catch { /* shift endpoints unavailable: leave the drawer closed */ }
    }, [register])
    const refreshHeld = useCallback(() => { posApi.getHeld().then(setHeld).catch(() => {}) }, [])

    useEffect(() => { refreshShift() }, [refreshShift])
    useEffect(() => { refreshHeld() }, [refreshHeld])

    const loadLocationStock = useCallback(() => {
        inventoryApi.getOverview({ per_page: 1000 }).then((ov) => {
            const counts: Record<number, number> = {}
            ov.locations.forEach((l) => { counts[l.id] = 0 })
            ov.items.forEach((row) => row.locations.forEach((l) => { if (l.quantity > 0) counts[l.locationId] = (counts[l.locationId] ?? 0) + 1 }))
            setStockByLoc(counts)
        }).catch(() => {})
    }, [])
    useEffect(() => { loadLocationStock() }, [loadLocationStock])
    useEffect(() => {
        locationApi.getAll().then((r) => setLocMeta(Object.fromEntries((r.data ?? []).map((l) => [l.id, l])))).catch(() => {})
    }, [])
    useEffect(() => {
        getPaymentMethods().then((pm) => {
            const list = pm.posMethods.map((s) => sellMethodForSlug(s)).filter((m): m is PosPaymentMethod => !!m && (POS_METHODS as string[]).includes(m))
            if (list.length === 0) return
            const def = (pm.posDefault ? sellMethodForSlug(pm.posDefault) : undefined) as PosPaymentMethod | undefined
            const first = def && list.includes(def) ? def : list[0]
            setPosMethods(list); setDefaultMethod(first); setPayMethod(first)
        }).catch(() => {})
    }, [])
    useEffect(() => { posApi.getBestSellers(0).then(setBestSellers).catch(() => {}) }, [])
    useEffect(() => {
        settingsApi.getAll().then((res) => setStoreName(res.data?.general?.storeName ?? "")).catch(() => {})
        couponApi.getAll().then((res) => setCouponChoices((res.data ?? []).filter((c) => (c.phase ? c.phase === "active" : c.status) && c.type !== "free_shipping" && c.channelPos !== false).slice(0, 8))).catch(() => {})
    }, [])

    const locName = (id: string = selectedWarehouseId) => warehouses.find((w) => String(w.id) === id)?.name ?? "this location"
    const lowAt = (product: Product) => (reorderById[product.id] > 0 ? reorderById[product.id] : 5)

    const getStock = (product: Product, variant?: Variant, whId: string = selectedWarehouseId): number => {
        if (variant) {
            const loc = variant.inventory?.find(i => i.warehouseId === whId)
            return loc ? loc.quantity : 0
        }
        if (product.variants && product.variants.length > 0) {
            // For products with variants, sum up inventory across all variants at this warehouse
            const totalAtWarehouse = product.variants.reduce((sum, v) => {
                const loc = v.inventory?.find(i => i.warehouseId === whId)
                return sum + (loc ? loc.quantity : 0)
            }, 0)
            return totalAtWarehouse
        }
        const loc = product.inventory?.find(i => i.warehouseId === whId)
        return loc ? loc.quantity : 0
    }

    const getReservedQty = (productId: string, variantId?: string): number => {
        return cart
            .filter(item => String(item.productId) === productId && String(item.variantId ?? "") === String(variantId ?? ""))
            .reduce((sum, item) => sum + item.quantity, 0)
    }

    const getAvailableStock = (product: Product, variant?: Variant): number => {
        const baseStock = getStock(product, variant)
        const reserved = getReservedQty(product.id, variant?.id)
        return Math.max(0, baseStock - reserved)
    }

    // ---- categories (roots with their sub-categories underneath)
    const categories = useMemo(() => {
        const active = getAllCategoriesFlat().filter((c) => c.status)
        const roots = active.filter((c) => !c.parent_id || !active.some((x) => x.id === c.parent_id))
        const ordered: { id: string; name: string; sub: boolean }[] = []
        roots.forEach((r) => {
            ordered.push({ id: r.id, name: r.category_name, sub: false })
            active.filter((c) => c.parent_id === r.id).forEach((c) => ordered.push({ id: c.id, name: c.category_name, sub: true }))
        })
        return ordered
    }, [getAllCategoriesFlat])

    const descend = useCallback((id: string) => {
        const active = getAllCategoriesFlat().filter((c) => c.status)
        return [id, ...active.filter((c) => c.parent_id === id).map((c) => c.id)]
    }, [getAllCategoriesFlat])

    const TINTS: PosTint[] = [
        { bg: "var(--dash-accent-soft)", fg: "var(--dash-accent-fg)" },
        { bg: "var(--dash-warn-soft)", fg: "var(--dash-warn-fg)" },
        { bg: "var(--dash-danger-soft)", fg: "var(--dash-danger-fg)" },
        { bg: "var(--dash-success-soft)", fg: "var(--dash-success-fg)" },
    ]
    const NEUTRAL: PosTint = { bg: "var(--dash-neutral-soft)", fg: "var(--dash-neutral-fg)" }
    const categoryTint = (categoryId?: string): PosTint => {
        const idx = categories.findIndex((c) => c.id === String(categoryId))
        return idx >= 0 ? TINTS[idx % TINTS.length] : NEUTRAL
    }
    const categoryName = (id?: string) => categories.find((c) => c.id === String(id))?.name

    const catIds = selectedCategory === "all" ? null : descend(selectedCategory)
    const inCategory = (p: Product) => !catIds || (p.categoryId ? catIds.includes(p.categoryId) : false)

    const matchingProducts = useMemo(() => {
        const q = searchQuery.toLowerCase()
        return products.filter((p) =>
            (!q || p.name.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)),
        )
    }, [products, searchQuery])

    const filteredProducts = useMemo(() => {
        const list = matchingProducts.filter((p) => inCategory(p) && (!hideOut || getAvailableStock(p) > 0))
        const unit = (p: Product) => cardPrice(p).price
        list.sort((a, b) => {
            if (sort === "name") return a.name.localeCompare(b.name)
            if (sort === "stock") return getAvailableStock(b) - getAvailableStock(a) || a.name.localeCompare(b.name)
            if (sort === "price_asc") return unit(a) - unit(b)
            if (sort === "price_desc") return unit(b) - unit(a)
            return (bestSellers[b.id] ?? 0) - (bestSellers[a.id] ?? 0) || a.name.localeCompare(b.name)
        })
        return list
    }, [matchingProducts, hideOut, sort, bestSellers, selectedCategory, selectedWarehouseId, cart]) // eslint-disable-line

    const inStockHere = products.filter((p) => getAvailableStock(p) > 0)
    const availableCount = matchingProducts.filter((p) => inCategory(p) && getAvailableStock(p) > 0).length

    const addToCart = (product: Product, variant?: Variant) => {
        if (product.variants && product.variants.length > 0 && !variant) {
            setSelectedProductForVariant(product); return
        }
        const availableStock = getAvailableStock(product, variant)
        const cartItemId = variant ? `${product.id}-${variant.id}` : product.id
        const existingInCart = cart.find(item => item.id === cartItemId)
        if (availableStock <= 0) { toast.error(`Only ${getStock(product, variant)} ${product.name} in stock at ${locName()}`); return }
        const getDisplayPrice = (p: typeof product, v?: typeof variant) => {
            if ((p as any).isBundle && (p as any).bundlePriceOverride) {
                return (p as any).bundlePriceOverride
            }
            if (v) {
                const base = v.salePrice || v.price
                const offerPrice = v.offerPrice ?? p.offerPrice
                const offerType = v.offerType ?? p.offerType ?? "percentage"
                if (offerPrice) return offerType === "percentage" ? base * (1 - offerPrice / 100) : base - offerPrice
                return base
            }
            const base = p.salePrice || p.price
            if (p.offerPrice) return p.offerType === "percentage" ? base * (1 - p.offerPrice / 100) : base - p.offerPrice
            return base
        }
        const price = getDisplayPrice(product, variant ?? undefined)
        const selectedInventory = variant
            ? variant.inventory?.find(i => i.warehouseId === selectedWarehouseId)
            : product.inventory?.find(i => i.warehouseId === selectedWarehouseId)
        setCart(prev => {
            if (existingInCart)
                return prev.map(item => item.id === cartItemId ? { ...item, quantity: item.quantity + 1, ...priceForQty(item, item.quantity + 1) } : item)
            const wholesalePrice = variant ? undefined : Number((product as any).wholesalePrice) || undefined
            const wholesaleMin = variant ? undefined : Number((product as any).minWholesaleQty) || undefined
            return [...prev, {
                basePrice: price, wholesalePrice, wholesaleMin,
                ...priceForQty({ price, basePrice: price, wholesalePrice, wholesaleMin }, 1),
                id: cartItemId, productId: Number(product.id),
                variantId: variant ? Number(variant.id) : undefined,
                inventoryId: selectedInventory?.inventoryId,
                name: product.name, image: product.image || "/placeholder.svg",
                quantity: 1, variantName: variant?.name,
            }]
        })
        if (variant) setSelectedProductForVariant(null)
    }

    const updateQuantity = (id: string, delta: number) => {
        if (delta > 0) {
            const cartItem = cart.find(item => item.id === id)
            if (!cartItem) return
            const product = products.find(p => Number(p.id) === cartItem.productId)
            if (!product) return
            const variant = cartItem.variantId
                ? product.variants?.find(v => Number(v.id) === cartItem.variantId)
                : undefined
            const maxStock = getStock(product, variant)
            if (cartItem.quantity >= maxStock) {
                toast.error(`Only ${maxStock} ${product.name} in stock at ${locName()}`)
                return
            }
        }
        setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta), ...priceForQty(item, Math.max(1, item.quantity + delta)) } : item))
    }
    const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id))

    // switching location: cut the cart down to what the new location holds
    const fitCartToWarehouse = (items: CartItem[], id: string) => {
        let changed = false
        const next: CartItem[] = []
        for (const item of items) {
            const product = products.find((p) => Number(p.id) === item.productId)
            if (!product) { next.push(item); continue }
            const variant = item.variantId ? product.variants?.find((v) => Number(v.id) === item.variantId) : undefined
            const avail = getStock(product, variant, id)
            if (avail <= 0) { changed = true; continue }
            if (item.quantity > avail) { changed = true; next.push({ ...item, quantity: avail }) } else next.push(item)
        }
        return { next, changed }
    }
    const changeWarehouse = (id: string) => {
        if (id === selectedWarehouseId) return
        const { next, changed } = fitCartToWarehouse(cart, id)
        setSelectedWarehouseId(id)
        if (changed) { setCart(next); toast.info(`Cart adjusted to stock available at ${locName(id)}`) }
    }

    // ---- totals
    const subtotal = r2(cart.reduce((a, i) => a + i.price * i.quantity, 0))
    const itemCount = cart.reduce((n, i) => n + i.quantity, 0)

    let manualDiscount = 0
    let discountError = ""
    if (discValue.trim() !== "") {
        const v = Number(discValue.replace(/,/g, ""))
        if (Number.isNaN(v) || v < 0) discountError = "Discount must be a number, 0 or more."
        else if (discType === "percent" && v > 100) discountError = "Percent discount cannot exceed 100%."
        else if (discType === "flat" && v > subtotal && subtotal > 0) discountError = "Discount cannot be more than the subtotal."
        else manualDiscount = discType === "percent" ? r2((subtotal * v) / 100) : v
    }
    manualDiscount = Math.min(Math.max(manualDiscount, 0), subtotal)

    // coupon amount follows the cart, so it stays right as items change
    const categoryOf = (productId: number) => {
        const c = products.find((p) => Number(p.id) === productId)?.categoryId
        return c ? Number(c) : undefined
    }
    const cartScope = () => cart.map((i) => ({ productId: i.productId, categoryId: categoryOf(i.productId), subtotal: r2(i.price * i.quantity) }))
    const eligibleOf = (c: CouponResponse, line: { productId: number; categoryId?: number }) => {
        const prodIds = c.productIds ?? (c.applicableToProducts ? c.applicableToProducts.split(",").map(Number) : [])
        const catIds = c.categoryIds ?? (c.applicableToCategories ? c.applicableToCategories.split(",").map(Number) : [])
        if (!prodIds.length && !catIds.length) return true
        return prodIds.includes(line.productId) || (line.categoryId !== undefined && catIds.includes(line.categoryId))
    }
    let couponDiscount = 0
    let couponProblem = ""
    if (coupon) {
        const scoped = cartScope().filter((l) => eligibleOf(coupon, l))
        const eligibleSubtotal = r2(scoped.reduce((a, l) => a + l.subtotal, 0))
        if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) {
            couponProblem = `Minimum order ${formatCurrency(coupon.minOrderAmount)} required.`
        } else if (eligibleSubtotal <= 0) {
            couponProblem = "No items in the cart are eligible for this coupon."
        } else {
            let amt = coupon.type === "percentage" ? r2((eligibleSubtotal * coupon.discount) / 100) : Math.min(coupon.discount, eligibleSubtotal)
            if (coupon.type === "percentage" && coupon.maxDiscount && coupon.maxDiscount > 0) amt = Math.min(amt, coupon.maxDiscount)
            couponDiscount = Math.min(Math.max(amt, 0), Math.max(0, subtotal - manualDiscount))
        }
    }
    const totalDiscount = r2(manualDiscount + couponDiscount)
    const taxable = Math.max(0, subtotal - totalDiscount)
    const tax = r2((taxable * taxRate) / 100)
    const total = r2(taxable + tax)

    const received =
        payMethod === "COD" ? 0
        : payMethod === "Cash" ? (tender === "exact" ? total : tender === "custom" ? (Number.isNaN(Number(tenderInput)) ? 0 : Number(tenderInput)) : tender)
        : total
    const shortBy = r2(total - received)
    const isShort = shortBy > 0.005

    const applyCoupon = async (codeIn?: string) => {
        const code = (codeIn ?? couponInput).trim()
        if (!code) { toast.error("Enter a coupon code"); return }
        try {
            const res = await couponApi.validate(code, subtotal, { channel: "pos", items: cartScope().map(({ productId, categoryId }) => ({ productId, categoryId })), customerId: selectedCustomerId ? Number(selectedCustomerId) : undefined })
            setCoupon(res.data)
            setCouponInput(res.data.code)
            setCouponMsg("")
            setError("")
            toast.success("Coupon applied")
        } catch (e) {
            setCoupon(null)
            setCouponMsg(apiError(e, "Coupon is not valid."))
            toast.error(apiError(e, "Coupon is not valid."))
        }
    }
    const removeCoupon = () => { setCoupon(null); setCouponInput(""); setCouponMsg("") }

    const resetSale = () => {
        setCart([]); setSelectedCustomerId(""); setSelectedCustomerName("Walk-in Customer")
        setDiscType("flat"); setDiscValue(""); setDiscOpen(false)
        removeCoupon(); setCouponOpen(false)
        setPayMethod(defaultMethod); setTender("exact"); setTenderInput(""); setTxnId(""); setError("")
    }

    const handleResetCart = () => { resetSale(); setIsResetOpen(false) }

    // ---- hold / resume
    const holdCurrent = async (): Promise<boolean> => {
        if (cart.length === 0) return false
        try {
            await posApi.holdSale({
                customerId: selectedCustomerId ? Number(selectedCustomerId) : null,
                itemCount, total,
                payload: {
                    cart, customerId: selectedCustomerId, customerName: selectedCustomerName,
                    discType, discValue, couponCode: coupon?.code ?? "", warehouseId: selectedWarehouseId,
                },
            })
            return true
        } catch (e) {
            toast.error(apiError(e, "Could not hold the sale"))
            return false
        }
    }

    const hold = async () => {
        if (await holdCurrent()) {
            toast.success("Sale held")
            resetSale()
            refreshHeld()
        }
    }

    const resumeHeld = async (h: HeldSale) => {
        // park what is on screen first, so nothing is lost
        if (cart.length > 0 && !(await holdCurrent())) return
        const p = h.payload as any
        const whId = p.warehouseId ? String(p.warehouseId) : selectedWarehouseId
        const fit = fitCartToWarehouse(p.cart ?? [], whId)
        setCart(fit.next)
        if (p.warehouseId) setSelectedWarehouseId(whId)
        if (fit.changed) toast.info(`Cart adjusted to stock available at ${locName(whId)}`)
        setSelectedCustomerId(p.customerId ?? "")
        setSelectedCustomerName(p.customerName ?? "Walk-in Customer")
        setDiscType(p.discType ?? "flat")
        setDiscValue(p.discValue ?? "")
        removeCoupon()
        if (p.couponCode) applyCoupon(p.couponCode)
        setError("")
        try { await posApi.dropHeld(h.id) } catch { /* keep going: it stays in the list */ }
        setHeldOpen(false)
        refreshHeld()
    }

    const dropHeld = async (h: HeldSale) => {
        if (!window.confirm(`Discard ${h.label}?`)) return
        try { await posApi.dropHeld(h.id); refreshHeld() } catch (e) { toast.error(apiError(e, "Could not discard")) }
    }

    // ---- charge
    const handleCheckout = async () => {
        if (isSubmitting) return
        if (!session) { setDrawerError("Open a shift before taking a sale."); setDrawerOpen(true); setError("Open a shift before taking a sale."); return }
        if (cart.length === 0) { setError("Add at least one item."); return }
        if (discountError) { setError(discountError); return }
        if (coupon && couponProblem) { setError(couponProblem); return }
        if (payMethod === "Cash" && tender === "custom" && Number.isNaN(Number(tenderInput))) { setError("Enter a valid amount received."); return }
        if (payMethod === "COD" && !selectedCustomerId) { setError("Cash on delivery needs a customer. Pick or add one."); return }
        if (isShort && payMethod !== "COD" && !selectedCustomerId) { setError("Walk-in sale must be paid in full. Pick a customer to allow a due balance."); return }

        setIsSubmitting(true)
        setError("")
        try {
            const customer = selectedCustomerId ? getCustomerById(selectedCustomerId) : undefined
            const paid = payMethod === "COD" ? 0 : Math.min(received, total)
            const txn = NEEDS_TXN.includes(payMethod) ? txnId.trim() : ""
            const res = await sellsApi.create({
                customerId: customer ? Number(customer.id) : undefined,
                customerName: selectedCustomerName || "Walk-in Customer",
                customerEmail: customer?.email || undefined,
                customerPhone: customer?.phone || undefined,
                shippingFullName: customer?.name || undefined,
                shippingPhone: customer?.phone || undefined,
                shippingEmail: customer?.email || undefined,
                shippingAddressLine1: customer?.address || undefined,
                shippingCity: customer?.city || undefined,
                shippingState: customer?.state || undefined,
                shippingPostalCode: customer?.zipCode || undefined,
                shippingCountry: customer?.country || undefined,
                method: payMethod,
                source: "pos",
                locationId: selectedWarehouseId ? Number(selectedWarehouseId) : undefined,
                registerSessionId: session.id,
                amount: total,
                paidAmount: paid,
                paymentTransactionId: txn || undefined,
                taxRate: tax > 0 ? taxRate : undefined,
                taxAmount: tax > 0 ? tax : undefined,
                discount: totalDiscount > 0 ? totalDiscount : undefined,
                manualDiscount: manualDiscount > 0 ? manualDiscount : undefined,
                ...(couponDiscount > 0 && coupon ? { couponId: coupon.id, couponCode: coupon.code } : {}),
                // Taken at the counter = done; cash on delivery waits for delivery
                status: payMethod === "COD" ? "Pending" : "Delivered",
                items: cart.map((item) => ({
                    productId: item.productId,
                    variantId: item.variantId,
                    variant_id: item.variantId,
                    inventoryId: item.inventoryId,
                    inventory_id: item.inventoryId,
                    productName: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    unitPrice: item.price,
                    unit_price: item.price,
                })),
            })
            const whName = warehouses.find((w) => String(w.id) === selectedWarehouseId)?.name ?? ""
            setReceipt({
                sale: res.data, received: payMethod === "Cash" ? received : total, location: whName,
                businessName: storeName, taxLabel: formatTaxLabel(), customerPhone: customer?.phone || undefined,
            })
            resetSale()
            // cash on hand and stock both changed
            refreshShift()
            loadProducts()
            loadLocationStock()
        } catch (err) {
            const msg = apiError(err, "Order failed. Please try again.")
            setError(msg)
            toast.error(msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    const chargeRef = useRef(handleCheckout)
    chargeRef.current = handleCheckout

    // Keyboard: F2 focuses the scan/search field, F8 charges the sale
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "F2") { e.preventDefault(); searchRef.current?.focus() }
            if (e.key === "F8") { e.preventDefault(); chargeRef.current() }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return
        const v = searchQuery.trim().toLowerCase()
        if (!v) return
        const exact = products.find((p) => (p.sku ?? "").toLowerCase() === v || (p.barcode ?? "").toLowerCase() === v)
        const hit = exact ?? (filteredProducts.length === 1 ? filteredProducts[0] : undefined)
        if (!hit) { toast.error(`No single product matches "${searchQuery}"`); return }
        addProduct(hit)
        setSearchQuery("")
    }

    const toggleFullscreen = () => {
        if (document.fullscreenElement) document.exitFullscreen()
        else document.documentElement.requestFullscreen?.()
    }

    const selectedWarehouse = warehouses.find((w) => String(w.id) === selectedWarehouseId)
    const posOnly = warehouses.filter((w) => locMeta[w.id]?.sellsInPos !== false)
    const posLocations = posOnly.length > 0 ? posOnly : warehouses
    const catTitle = selectedCategory === "all" ? "All items" : categoryName(selectedCategory) ?? "All items"
    const cartQty = (id: string) => cart.filter((i) => String(i.productId) === id).reduce((n, i) => n + i.quantity, 0)
    const addProduct = (product: Product) => {
        if (product.variants && product.variants.length > 0) setSelectedProductForVariant(product)
        else addToCart(product)
    }
    const otherWarehouse = warehouses.find((w) => String(w.id) !== selectedWarehouseId)

    const blocked = useModuleGuard("POS")
    if (blocked) return blocked

    const cycleSort = () => setSort(SORTS[(SORTS.findIndex(([k]) => k === sort) + 1) % SORTS.length][0])
    const sortLabel = SORTS.find(([k]) => k === sort)?.[1] ?? "Best selling"
    const sectionError = error || discountError
    const canCharge = cart.length > 0 && !isSubmitting

    return (
        <div data-pos-page="" className="flex h-full min-w-0 flex-col overflow-hidden">
            {/* Top bar */}
            <header className="app-header flex flex-wrap items-center gap-3 px-5 py-3">
                <WithTooltip content="Toggle sidebar (Ctrl+B)">
                    <Button type="button" variant="outline" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
                        <PanelLeft className="size-5" strokeWidth={1.8} aria-hidden />
                    </Button>
                </WithTooltip>
                <InputGroup className="min-w-[260px] flex-1">
                    <InputGroupAddon><Barcode aria-hidden /></InputGroupAddon>
                    <InputGroupInput
                        ref={searchRef}
                        type="search"
                        aria-label="Scan barcode or search products"
                        placeholder="Scan barcode or search name / SKU…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={onSearchKey}
                    />
                    <InputGroupAddon align="inline-end"><Kbd>F2</Kbd></InputGroupAddon>
                </InputGroup>

                {/* Barcode scanner - hidden but active for keyboard input */}
                <div className="hidden">
                    <BarcodeScanner
                        products={products}
                        selectedWarehouseId={selectedWarehouseId}
                        getAvailableStock={getAvailableStock}
                        onProductScanned={addToCart}
                    />
                </div>

                <Select value={selectedWarehouseId} onValueChange={changeWarehouse}>
                    <SelectTrigger aria-label="Warehouse" className="h-auto min-w-[240px] text-left data-[size=default]:h-auto">
                        <Building2 className="size-[18px] text-muted-foreground" aria-hidden />
                        <span className="flex flex-1 flex-col leading-tight">
                            <span className="text-xs text-muted-foreground">Selling from</span>
                            <span className="text-sm font-semibold">{selectedWarehouse?.name ?? "Select warehouse"}</span>
                        </span>
                    </SelectTrigger>
                    <SelectContent align="start" className="min-w-[300px]">
                        {posLocations.map((wh) => {
                            const n = stockByLoc[wh.id]
                            const meta = locMeta[wh.id]
                            const sub = [meta?.district, wh.address].filter(Boolean).join(" · ") || "—"
                            return (
                                <SelectItem key={wh.id} value={String(wh.id)} className="pr-2 [&>span:first-child]:hidden">
                                    <span className="flex w-[260px] items-center justify-between gap-3">
                                        <span className="flex min-w-0 flex-col leading-tight">
                                            <span className="text-sm font-semibold">{wh.name}</span>
                                            <span className="truncate text-xs text-muted-foreground">{sub}</span>
                                        </span>
                                        {n !== undefined && (
                                            <Badge variant={n > 0 ? "secondary" : "destructive"} className="tabular-nums">
                                                {n > 0 ? `${n} in stock` : "No stock"}
                                            </Badge>
                                        )}
                                    </span>
                                </SelectItem>
                            )
                        })}
                    </SelectContent>
                </Select>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        aria-label="Cash drawer"
                        onClick={() => { setDrawerError(""); setDrawerOpen(true) }}
                    >
                        <Circle className={cn("size-2", session ? "fill-primary text-primary" : "fill-destructive text-destructive")} aria-hidden />
                        {session ? `${session.register} · Cash ${formatCurrency(session.summary?.expected ?? session.expectedCash ?? 0)}` : "Shift closed · Open shift"}
                    </Button>

                    <Popover open={heldOpen} onOpenChange={setHeldOpen}>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="outline" aria-expanded={heldOpen}>
                                Held sales
                                <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1 tabular-nums">{held.length}</Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[340px] p-2">
                            {held.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No held sales. Use Hold to park the current cart.</p>}
                            {held.map((h) => (
                                <Item key={h.id} size="sm" className="flex-nowrap gap-2 px-2 py-2 hover:bg-accent/50">
                                    <ItemContent className="min-w-0 gap-0">
                                        <ItemTitle>{h.label}</ItemTitle>
                                        <ItemDescription className="truncate text-xs">
                                            {h.itemCount} items · {formatCurrency(h.total)} · {(h.payload as any)?.customerName || "Walk-in"}
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions className="gap-2">
                                        <Button type="button" size="sm" onClick={() => resumeHeld(h)}>Resume</Button>
                                        <WithTooltip content="Discard held sale"><Button type="button" variant="ghost" size="icon-sm" aria-label="Discard held sale" onClick={() => dropHeld(h)}>×</Button></WithTooltip>
                                    </ItemActions>
                                </Item>
                            ))}
                        </PopoverContent>
                    </Popover>

                    <Button asChild variant="outline"><Link href="/dashboard/returns/customer">Return / exchange</Link></Button>
                    <WithTooltip content="Full screen"><Button type="button" variant="outline" size="icon" aria-label="Full screen" onClick={toggleFullscreen}>
                        <Maximize2 className="size-[18px]" aria-hidden />
                    </Button></WithTooltip>
                    <ThemeAccentControls />
                </div>
            </header>

            <div className="app-canvas flex min-h-0 flex-1 flex-wrap items-stretch gap-4 overflow-y-auto p-4 lg:flex-nowrap lg:overflow-hidden">
                {/* Categories */}
                <Card role="complementary" aria-label="Categories" className="w-full shrink-0 gap-1 self-start p-2.5 pt-3.5 lg:max-h-full lg:w-[220px] lg:overflow-y-auto">
                    <SectionTitle as="h2" className="px-2.5 pb-2">Categories</SectionTitle>
                    {[{ id: "all", name: "All items", sub: false }, ...categories].map((cat) => {
                        const sel = selectedCategory === cat.id
                        const ids = cat.id === "all" ? null : descend(cat.id)
                        const n = products.filter((p) => (!ids || (p.categoryId ? ids.includes(p.categoryId) : false)) && getAvailableStock(p) > 0).length
                        const tint = cat.id === "all" ? NEUTRAL : categoryTint(cat.id)
                        return (
                            <Button
                                key={cat.id}
                                type="button"
                                variant={sel ? "default" : "ghost"}
                                aria-pressed={sel}
                                onClick={() => setSelectedCategory(cat.id)}
                                className="h-auto min-h-11 w-full justify-start gap-2.5 px-2.5 text-left"
                            >
                                <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg" style={{ background: tint.bg, color: tint.fg }}>
                                    {cat.id === "all" ? <LayoutGrid className="size-4" aria-hidden /> : <Tag className="size-4" aria-hidden />}
                                </span>
                                <span className="flex-1 truncate text-sm font-semibold">{cat.sub ? "– " : ""}{cat.name}</span>
                                <Badge variant={n > 0 || sel ? "secondary" : "destructive"} className="min-w-6 rounded-full px-1.5 tabular-nums">{n}</Badge>
                            </Button>
                        )
                    })}
                    <Separator className="mx-1 my-2.5 data-[orientation=horizontal]:w-auto" />
                    <SectionTitle as="h2" className="px-2.5 pb-1.5">Filters</SectionTitle>
                    <Label htmlFor="pos-hide-out" className="min-h-11 justify-between px-2.5">
                        <span>Hide out of stock</span>
                        <Switch id="pos-hide-out" checked={hideOut} onCheckedChange={(v) => setHideOut(v === true)} />
                    </Label>
                    <Button asChild variant="link" className="min-h-10 justify-start px-2.5">
                        <Link href="/dashboard/categories">Manage categories →</Link>
                    </Button>
                </Card>

                {/* Products */}
                <Card role="region" aria-label="Products" className="min-h-[420px] min-w-0 flex-1 gap-0 py-0 lg:min-h-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] py-4">
                        <div>
                            <h1 className="text-xl font-semibold">{catTitle}</h1>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                                <strong className="text-foreground">{availableCount}</strong> products available{selectedWarehouse ? ` at ${selectedWarehouse.name}` : ""}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" onClick={cycleSort}>Sort: {sortLabel} ▾</Button>
                            <ButtonGroup role="radiogroup" aria-label="View">
                                {([
                                    ["large", "Large grid", LayoutGrid],
                                    ["compact", "Compact grid", Grid2X2],
                                    ["list", "List", List],
                                ] as const).map(([mode, label, Icon]) => (
                                    <WithTooltip key={mode} content={label}>
                                        <Button
                                            type="button"
                                            variant={viewMode === mode ? "secondary" : "outline"}
                                            size="icon"
                                            role="radio"
                                            aria-checked={viewMode === mode}
                                            aria-label={label}
                                            onClick={() => setViewMode(mode)}
                                        >
                                            <Icon className="size-4" aria-hidden />
                                        </Button>
                                    </WithTooltip>
                                ))}
                            </ButtonGroup>
                        </div>
                    </div>
                    <Separator />

                    <div className="min-h-0 flex-1 overflow-auto px-[18px] py-4">
                        {productsLoading && products.length === 0 ? (
                            <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground"><Spinner />Loading products…</div>
                        ) : inStockHere.length === 0 ? (
                            <EmptyState
                                icon={Package}
                                className="min-h-[320px]"
                                title={products.length ? `No stock at ${selectedWarehouse?.name ?? "this location"}` : "No products yet"}
                                description={products.length
                                    ? "None of your products have stock at this location. Switch location, or move stock here with a transfer before selling."
                                    : "Add products to your catalogue and receive stock before selling."}
                                action={<div className="flex flex-wrap justify-center gap-2">
                                    {otherWarehouse ? (
                                        <Button type="button" onClick={() => changeWarehouse(String(otherWarehouse.id))}>
                                            Switch to {otherWarehouse.name}
                                        </Button>
                                    ) : (
                                        <Button asChild><Link href="/dashboard/products">Open catalogue</Link></Button>
                                    )}
                                    <Button asChild variant="outline"><Link href="/dashboard/inventory/transfer">Transfer stock here</Link></Button>
                                    <Button asChild variant="outline"><Link href="/dashboard/vendors/purchase-orders">Receive stock</Link></Button>
                                </div>}
                            />
                        ) : filteredProducts.length === 0 ? (
                            <EmptyState
                                icon={Search}
                                className="min-h-[260px]"
                                title="No products match"
                                description={searchQuery ? `Nothing matches "${searchQuery}" in ${catTitle}.` : "Nothing to show for the current filters."}
                            />
                        ) : viewMode === "list" ? (
                            <Table className="min-w-[560px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead scope="col">Product</TableHead>
                                        <TableHead scope="col">Category</TableHead>
                                        <TableHead scope="col">Stock</TableHead>
                                        <TableHead scope="col" className="text-right">Price</TableHead>
                                        <TableHead scope="col"><span className="sr-only">Action</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredProducts.map((product) => {
                                        const avail = getAvailableStock(product)
                                        const pill = stockPill(avail, lowAt(product))
                                        const tint = categoryTint(product.categoryId)
                                        const qty = cartQty(product.id)
                                        const cp = cardPrice(product)
                                        return (
                                            <TableRow key={product.id} className={avail <= 0 ? "opacity-50" : ""}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ background: tint.bg, color: tint.fg }}>
                                                            <Package className="size-[18px]" aria-hidden />
                                                        </span>
                                                        <span className="flex flex-col">
                                                            <span className="font-semibold">{product.name}</span>
                                                            <span className="text-xs text-muted-foreground">{product.sku || "—"}{product.variants?.length ? ` · ${product.variants.length} variants` : ""}</span>
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">{product.category || categoryName(product.categoryId) || "—"}</TableCell>
                                                <TableCell><Badge variant={pill.variant}>{pill.text}</Badge></TableCell>
                                                <TableCell className="text-right font-bold tabular-nums">{cp.from ? "From " : ""}{formatCurrency(cp.price)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button type="button" variant={qty > 0 ? "secondary" : "outline"} size="sm" disabled={avail <= 0} onClick={() => addProduct(product)} aria-label={`Add ${product.name}`}>
                                                        {qty > 0 ? `Add (${qty})` : "Add"}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className={cn("grid gap-3", viewMode === "large" ? "grid-cols-[repeat(auto-fill,minmax(170px,1fr))]" : "grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2")}>
                                {filteredProducts.map((product) => (
                                    <PosProductCard
                                        key={product.id}
                                        product={product}
                                        available={getAvailableStock(product)}
                                        lowAt={lowAt(product)}
                                        inCartQty={cartQty(product.id)}
                                        tint={categoryTint(product.categoryId)}
                                        compact={viewMode === "compact"}
                                        onAddToCart={addProduct}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Cart */}
                <Card role="complementary" aria-label="Current sale" className="w-full shrink-0 gap-0 overflow-hidden py-0 lg:w-[380px] xl:w-[400px]">
                    <div className="flex flex-col gap-2.5 px-4 py-3.5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Current sale</h2>
                            <span className="text-xs text-muted-foreground">Draft · {itemCount} item{itemCount === 1 ? "" : "s"}</span>
                        </div>
                        <PosCustomerPicker
                            value={selectedCustomerId}
                            onChange={(id, name) => { setSelectedCustomerId(id); setSelectedCustomerName(name); setError("") }}
                        />
                    </div>
                    <Separator />

                    <div className="flex min-h-[160px] flex-1 flex-col overflow-y-auto px-4 py-1">
                        {cart.length === 0 ? (
                            <EmptyState icon={ShoppingCart} title="Cart is empty" description="Scan a barcode or tap a product to start a sale" className="py-10 md:py-10" />
                        ) : (
                            cart.map((item) => (
                                <PosCartItem key={item.id} item={item} onVerifyQuantity={updateQuantity} onRemove={removeFromCart} />
                            ))
                        )}
                    </div>

                    <Separator />
                    <div className="grid grid-cols-3 gap-2 px-4 py-3">
                        <Button type="button" variant={manualDiscount > 0 ? "secondary" : "outline"} onClick={() => setDiscOpen((v) => !v)} aria-pressed={manualDiscount > 0}
                            className="min-w-0 truncate">
                            % Discount
                        </Button>
                        <Button type="button" variant={coupon ? "secondary" : "outline"} onClick={() => setCouponOpen((v) => !v)} aria-pressed={!!coupon}
                            className="min-w-0 truncate">
                            {coupon ? coupon.code : "Coupon"}
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => (cart.length ? setIsResetOpen(true) : resetSale())}
                            className="min-w-0">
                            Reset
                        </Button>
                    </div>

                    {discOpen && <Separator />}
                    {discOpen && (
                        <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2 px-4 py-3">
                            {([["flat", "Flat"], ["percent", "Percent %"]] as const).map(([id, label]) => (
                                <Button key={id} type="button" variant={discType === id ? "default" : "outline"} aria-pressed={discType === id} onClick={() => { setDiscType(id); setError("") }}>
                                    {label}
                                </Button>
                            ))}
                            <Input type="text" inputMode="decimal" aria-label="Discount value" value={discValue}
                                onChange={(e) => { setDiscValue(e.target.value); setError("") }}
                                placeholder={discType === "percent" ? "Percent, e.g. 10" : "Amount, e.g. 100"} />
                        </div>
                    )}

                    {couponOpen && <Separator />}
                    {couponOpen && (
                        <div className="flex flex-col gap-2 px-4 py-3">
                            <div className="flex gap-2">
                                <Input type="text" aria-label="Coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") applyCoupon() }}
                                    placeholder="Coupon code"
                                    className="min-w-0 flex-1" />
                                <Button type="button" onClick={() => applyCoupon()}>Apply</Button>
                                {coupon && <Button type="button" variant="outline" onClick={removeCoupon}>Remove</Button>}
                            </div>
                            <span className={cn("text-xs", coupon && !couponProblem ? "text-foreground" : couponMsg || couponProblem ? "text-destructive" : "text-muted-foreground")}>
                                {coupon ? (couponProblem || `${coupon.campaignName || coupon.code} applied: −${formatCurrency(couponDiscount)}`) : couponMsg || "Enter a code and press Apply."}
                            </span>
                            {couponChoices.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {couponChoices.map((c) => (
                                        <WithTooltip key={c.id} content={`${c.campaignName}${c.minOrderAmount > 0 ? ` · min ${formatCurrency(c.minOrderAmount)}` : ""}`}>
                                            <Button type="button" variant="outline" size="sm" onClick={() => applyCoupon(c.code)}>
                                                {c.code} · {c.type === "percentage" ? `${c.discount}%` : formatCurrency(c.discount)}
                                            </Button>
                                        </WithTooltip>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <Separator />
                    <div className="flex flex-col gap-3 bg-muted/50 px-4 pb-4 pt-3.5">
                        <InfoList className="gap-1.5 tabular-nums">
                            <InfoRow label="Subtotal" value={formatCurrency(subtotal)} />
                            <InfoRow label={`Discount${manualDiscount > 0 && discType === "percent" ? ` (${discValue}%)` : ""}`} value={`${manualDiscount > 0 ? "−" : ""}${formatCurrency(manualDiscount)}`} />
                            {coupon && (
                                <InfoRow label={`Coupon ${coupon.code}`} value={`−${formatCurrency(couponDiscount)}`} />
                            )}
                            <InfoRow label={formatTaxLabel()} value={formatCurrency(tax)} />
                            <Separator />
                            <InfoRow label={<span className="font-bold text-foreground">Total</span>} value={<span className="text-3xl font-bold tracking-tight">{formatCurrency(total)}</span>} className="items-baseline" />
                        </InfoList>

                        <PosPayment
                            total={total}
                            method={payMethod}
                            methods={posMethods}
                            onMethodChange={(m) => { setPayMethod(m); setError("") }}
                            tender={tender}
                            onTenderChange={setTender}
                            tenderInput={tenderInput}
                            onTenderInput={setTenderInput}
                            received={received}
                            hasCustomer={!!selectedCustomerId}
                            txnId={txnId}
                            onTxnChange={setTxnId}
                        />

                        {sectionError && <Alert variant="destructive" role="alert"><AlertDescription>{sectionError}</AlertDescription></Alert>}

                        <div className="flex gap-2">
                            <Button type="button" variant="outline" size="lg" onClick={hold} disabled={cart.length === 0}>
                                Hold
                            </Button>
                            <Button
                                type="button"
                                size="lg"
                                disabled={!canCharge}
                                onClick={handleCheckout}
                                className="flex-1"
                            >
                                {isSubmitting ? "Processing…" : `Charge ${formatCurrency(total)}`}
                                {!isSubmitting && <Kbd>F8</Kbd>}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            <PosCashDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                register={register}
                onRegisterChange={setRegister}
                locationId={selectedWarehouseId ? Number(selectedWarehouseId) : undefined}
                session={session}
                history={history}
                onChanged={refreshShift}
                initialError={drawerError}
            />

            <PosReceipt receipt={receipt} onClose={() => setReceipt(null)} />

            <AlertDialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clear the current sale?</AlertDialogTitle>
                        <AlertDialogDescription>All items, the discount and the coupon will be removed.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetCart} className={buttonVariants({ variant: "destructive" })}>Clear sale</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Variant picker */}
            <Dialog open={!!selectedProductForVariant} onOpenChange={(open) => !open && setSelectedProductForVariant(null)}>
                <DialogContent className="gap-3 sm:max-w-md">
                    <DialogTitle>Choose variant · {selectedProductForVariant?.name}</DialogTitle>
                    <DialogDescription className="sr-only">Pick which variant to add to the sale</DialogDescription>
                    <div className="flex flex-col gap-2">
                        {selectedProductForVariant?.variants?.map((variant) => {
                            const left = getAvailableStock(selectedProductForVariant, variant)
                            const out = left <= 0
                            const inCart = cart.find((c) => c.id === `${selectedProductForVariant.id}-${variant.id}`)
                            return (
                                <Button
                                    key={variant.id}
                                    type="button"
                                    variant={inCart ? "secondary" : "outline"}
                                    disabled={out}
                                    onClick={() => addToCart(selectedProductForVariant, variant)}
                                    className="h-auto justify-between gap-3 whitespace-normal p-3 text-left"
                                >
                                    <span className="flex flex-col">
                                        <span className="text-sm font-semibold">{variant.name}</span>
                                        <span className="text-xs text-muted-foreground">{[variant.sku, inCart ? `${inCart.quantity} in cart` : ""].filter(Boolean).join(" · ") || "No SKU"}</span>
                                    </span>
                                    <span className="flex flex-col items-end">
                                        <span className="text-sm font-bold tabular-nums">{formatCurrency(variantUnitPrice(selectedProductForVariant, variant))}</span>
                                        <span className={cn("text-xs font-semibold", out ? "text-destructive" : "text-muted-foreground")}>{out ? "Out of stock" : `${left} available`}</span>
                                    </span>
                                </Button>
                            )
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
