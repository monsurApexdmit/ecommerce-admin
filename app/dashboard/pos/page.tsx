"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, ShoppingCart, RotateCcw, Percent, Ticket, LayoutGrid, Grid2X2, List } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PosProductCard } from "@/components/pos/pos-product-card"
import { PosCartItem } from "@/components/pos/pos-cart-item"
import { CheckoutModal } from "@/components/pos/checkout-modal"
import { DiscountModal } from "@/components/pos/discount-modal"
import { CustomerCombobox } from "@/components/pos/customer-combobox"
import { SuccessModal } from "@/components/pos/success-modal"
import { cn } from "@/lib/utils"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { type Product, type Variant } from "@/contexts/product-context"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useCategory } from "@/contexts/category-context"
import { useCustomer } from "@/contexts/customer-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { sellsApi } from "@/lib/sellsApi"
import { productApi } from "@/lib/productApi"
import { couponApi, CouponResponse } from "@/lib/couponApi"
import { BarcodeScanner } from "@/components/pos/barcode-scanner"
import { toast } from "sonner"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"

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
}

export default function PosPage() {
    const { canRead } = useSaasAuth()
    const { warehouses, defaultWarehouse } = useWarehouse()
    const { getAllCategoriesFlat } = useCategory()
    const { getCustomerById } = useCustomer()
    const { taxRate, formatCurrency, formatTaxLabel } = useCompanySettings()

    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCategory, setSelectedCategory] = useState("all")
    const [cart, setCart] = useState<CartItem[]>([])
    const [selectedCustomerId, setSelectedCustomerId] = useState("")
    const [selectedCustomerName, setSelectedCustomerName] = useState("Walk-in Customer")
    const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null)
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")

    const [products, setProducts] = useState<Product[]>([])
    const [productsLoading, setProductsLoading] = useState(false)

    const [discount, setDiscount] = useState(0)
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)
    const [isCouponModalOpen, setIsCouponModalOpen] = useState(false)
    const [appliedCoupon, setAppliedCoupon] = useState<CouponResponse | null>(null)
    const [couponDiscount, setCouponDiscount] = useState(0)
    const [availableCoupons, setAvailableCoupons] = useState<CouponResponse[]>([])
    const [couponsLoading, setCouponsLoading] = useState(false)
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
    const [shipping] = useState(0)
    const [invoiceNo, setInvoiceNo] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [viewMode, setViewMode] = useState<"2col" | "4col" | "list">("4col")

    useEffect(() => {
        if (selectedWarehouseId) return
        if (defaultWarehouse) {
            setSelectedWarehouseId(String(defaultWarehouse.id))
        } else if (warehouses.length > 0) {
            setSelectedWarehouseId(String(warehouses[0].id))
        }
    }, [defaultWarehouse, warehouses]) // eslint-disable-line

    useEffect(() => {
        if (!selectedWarehouseId) return
        setProductsLoading(true)
        const params: Record<string, any> = {
            limit: 200,
            location_id: Number(selectedWarehouseId),
        }
        if (selectedCategory !== "all") params.category_id = Number(selectedCategory)
        productApi.getAll(params)
            .then(res => {
                const raw = res.data ?? []
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
                        offerPrice: p.offerPrice ?? p.offer_price ?? undefined,
                        offerType: p.offerType ?? p.offer_type ?? undefined,
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
                            offerPrice: v.offerPrice ?? v.offer_price ?? undefined,
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
    }, [selectedWarehouseId, selectedCategory])

    const getStock = (product: Product, variant?: Variant): number => {
        const whId = selectedWarehouseId
        if (variant) {
            const loc = variant.inventory?.find(i => i.warehouseId === whId)
            return loc ? loc.quantity : variant.stock
        }
        if (product.variants && product.variants.length > 0) {
            // For products with variants, sum up inventory across all variants at this warehouse
            const totalAtWarehouse = product.variants.reduce((sum, v) => {
                const loc = v.inventory?.find(i => i.warehouseId === whId)
                return sum + (loc ? loc.quantity : 0)
            }, 0)
            // If warehouse-specific inventory is 0, fall back to total product stock
            return totalAtWarehouse > 0 ? totalAtWarehouse : product.stock
        }
        const loc = product.inventory?.find(i => i.warehouseId === whId)
        return loc ? loc.quantity : product.stock
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

    const categories = useMemo(() => [
        { id: "all", name: "All Items" },
        ...getAllCategoriesFlat().filter(c => c.status).map(c => ({ id: c.id, name: c.category_name }))
    ], [getAllCategoriesFlat])

    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const searchLower = searchQuery.toLowerCase()
            const matchesSearch =
                product.name.toLowerCase().includes(searchLower) ||
                (product.barcode && product.barcode.toLowerCase().includes(searchLower)) ||
                (product.sku && product.sku.toLowerCase().includes(searchLower))
            const hasStock = selectedWarehouseId ? getAvailableStock(product) > 0 : true
            return matchesSearch && hasStock
        })
    }, [products, searchQuery, selectedWarehouseId, cart]) // eslint-disable-line

    const blocked = useModuleGuard('POS')
  if (blocked) return blocked

    const addToCart = (product: Product, variant?: Variant) => {
        if (product.variants && product.variants.length > 0 && !variant) {
            setSelectedProductForVariant(product); return
        }
        const availableStock = getAvailableStock(product, variant)
        const cartItemId = variant ? `${product.id}-${variant.id}` : product.id
        const existingInCart = cart.find(item => item.id === cartItemId)
        if (availableStock <= 0) { toast.error("Not enough stock!"); return }
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
                return prev.map(item => item.id === cartItemId ? { ...item, quantity: item.quantity + 1 } : item)
            return [...prev, {
                id: cartItemId, productId: Number(product.id),
                variantId: variant ? Number(variant.id) : undefined,
                inventoryId: selectedInventory?.inventoryId,
                name: product.name, price, image: product.image || "/placeholder.svg",
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
                toast.error("Not enough stock!")
                return
            }
        }
        setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item))
    }
    const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id))

    const handleResetCart = () => {
        setCart([]); setSelectedCustomerId(""); setSelectedCustomerName("Walk-in Customer")
        setDiscount(0); setIsResetDialogOpen(false)
    }
    const handleApplyDiscount = (amount: number, type: 'fixed' | 'percentage') => {
        setDiscount(type === 'fixed' ? amount : (subtotal * amount) / 100)
    }

    const loadAvailableCoupons = async () => {
        setCouponsLoading(true)
        try {
            const res = await couponApi.getAll()
            setAvailableCoupons(res.data?.filter(c => c.status) || [])
        } catch (err) {
            toast.error("Failed to load coupons")
        } finally {
            setCouponsLoading(false)
        }
    }

    const handleApplyCoupon = (coupon: CouponResponse) => {
        const discountAmount = coupon.type === 'fixed'
            ? coupon.discount
            : (subtotal * coupon.discount) / 100
        setCouponDiscount(discountAmount)
        setAppliedCoupon(coupon)
        setIsCouponModalOpen(false)
        toast.success(`Coupon applied: ${coupon.code}`)
    }

    const handleRemoveCoupon = () => {
        setAppliedCoupon(null)
        setCouponDiscount(0)
        toast.success("Coupon removed")
    }

    const handleSuccessClose = () => {
        setIsSuccessModalOpen(false); setCart([])
        setSelectedCustomerId(""); setSelectedCustomerName("Walk-in Customer")
        setDiscount(0); setAppliedCoupon(null); setCouponDiscount(0); setInvoiceNo("")
    }

    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
    const tax = subtotal * (taxRate / 100)
    const totalDiscount = discount + couponDiscount
    const total = Math.max(0, subtotal + tax + shipping - totalDiscount)

    const handleCheckout = async (method: string) => {
        setIsSubmitting(true)
        try {
            const customer = selectedCustomerId ? getCustomerById(selectedCustomerId) : undefined
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
                method,
                amount: total,
                discount: discount > 0 ? discount : undefined,
                ...(couponDiscount > 0 && appliedCoupon ? {
                    couponId: appliedCoupon.id,
                    couponCode: appliedCoupon.code,
                } : {}),
                shippingCost: shipping > 0 ? shipping : undefined,
                status: 'Pending',
                items: cart.map(item => ({
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
            setInvoiceNo(res.data.invoiceNo || "")
            setIsCheckoutOpen(false)
            setIsSuccessModalOpen(true)
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Order failed. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div data-pos-page="" className="flex flex-col h-full gap-0 overflow-hidden">
            {/* Top Navigation Bar */}
            <div className="bg-card border-b border-border overflow-hidden">
                <div className="flex items-center gap-4 px-6 py-3">
                    <div className="relative flex-1 max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input placeholder="Search products, scan a barcode…" className="pl-10 h-10 bg-muted/50 border-border focus:bg-background"
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>

                    {/* Barcode Scanner - Hidden but active for keyboard input */}
                    <div className="hidden">
                        <BarcodeScanner
                            products={products}
                            selectedWarehouseId={selectedWarehouseId}
                            getAvailableStock={getAvailableStock}
                            onProductScanned={addToCart}
                        />
                    </div>

                    <div className="w-48">
                        <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                            <SelectTrigger className="h-10"><SelectValue placeholder="Select Warehouse" /></SelectTrigger>
                            <SelectContent>
                                {warehouses.map(wh => (
                                    <SelectItem key={wh.id} value={String(wh.id)}>{wh.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Main Content - Category Sidebar + Products + Cart */}
            <div className="flex gap-3 flex-1 overflow-hidden p-3 min-w-0">

                {/* Category Sidebar */}
                <div className="w-36 shrink-0 flex flex-col bg-card rounded-xl border border-border overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-border">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Categories</p>
                    </div>
                    <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex flex-col gap-0.5 p-2">
                            {categories.map(cat => {
                                const count = cat.id === "all"
                                    ? products.length
                                    : products.filter(p => p.categoryId === String(cat.id)).length
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                            selectedCategory === cat.id
                                                ? "bg-brand-soft text-brand-fg"
                                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                        )}
                                    >
                                        <span className="truncate text-left">{cat.name}</span>
                                        <span className={cn(
                                            "text-[11px] tabular-nums shrink-0",
                                            selectedCategory === cat.id ? "text-brand-fg/70" : "text-muted-foreground/60"
                                        )}>
                                            {count}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Product Grid */}
                <div className="flex-1 min-w-0 flex flex-col bg-card rounded-xl border border-border overflow-hidden">
                    {/* Grid header */}
                    <div className="flex items-end justify-between px-4 py-3 border-b border-border shrink-0">
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight text-foreground">Point of Sale</h1>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                <b className="text-money-fg font-semibold">{filteredProducts.length}</b> products available
                            </p>
                        </div>
                        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                            <button
                                onClick={() => setViewMode("2col")}
                                className={cn("p-1.5 rounded-md transition-all", viewMode === "2col" ? "bg-card shadow-sm text-brand-fg" : "text-muted-foreground hover:text-foreground")}
                                title="2 columns"
                            >
                                <Grid2X2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("4col")}
                                className={cn("p-1.5 rounded-md transition-all", viewMode === "4col" ? "bg-card shadow-sm text-brand-fg" : "text-muted-foreground hover:text-foreground")}
                                title="4 columns"
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={cn("p-1.5 rounded-md transition-all", viewMode === "list" ? "bg-card shadow-sm text-brand-fg" : "text-muted-foreground hover:text-foreground")}
                                title="List view"
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <ScrollArea className="h-full p-4 bg-muted/20">
                            {productsLoading ? (
                                <div className="flex items-center justify-center h-64 text-muted-foreground"><p>Loading products...</p></div>
                            ) : filteredProducts.length > 0 ? (
                                viewMode === "list" ? (
                                    <div className="flex flex-col gap-2 pb-4">
                                        {filteredProducts.map(product => {
                                            const stock = getAvailableStock(product)
                                            return (
                                                <button
                                                    key={product.id}
                                                    onClick={() => {
                                                        if (product.variants && product.variants.length > 0) {
                                                            setSelectedProductForVariant(product)
                                                        } else {
                                                            addToCart(product)
                                                        }
                                                    }}
                                                    disabled={stock === 0}
                                                    className={cn(
                                                        "flex items-center gap-3 w-full text-left p-3 rounded-lg border border-border bg-card hover:border-brand/40 hover:bg-accent transition-all",
                                                        stock === 0 && "opacity-50 cursor-not-allowed"
                                                    )}
                                                >
                                                    <img
                                                        src={product.image || "/placeholder.svg"}
                                                        alt={product.name}
                                                        className="w-12 h-12 rounded-lg object-cover shrink-0 bg-muted"
                                                        onError={e => { (e.target as HTMLImageElement).src = "/placeholder.svg" }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-foreground truncate text-sm">{product.name}</p>
                                                        <p className="text-xs text-muted-foreground">{product.category}</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="font-bold text-money-fg text-sm">{formatCurrency((() => { const b = product.salePrice || product.price; return product.offerPrice ? (product.offerType === "percentage" ? b * (1 - product.offerPrice / 100) : b - product.offerPrice) : b })())}</p>
                                                        <p className="text-xs text-muted-foreground">{stock} in stock</p>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className={cn("grid gap-3 pb-4", viewMode === "2col" ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4")}>
                                        {filteredProducts.map(product => (
                                            <PosProductCard
                                                key={product.id}
                                                product={{ ...product, stock: getAvailableStock(product) }}
                                                large={viewMode === "2col"}
                                                onAddToCart={(product) => {
                                                    if (product.variants && product.variants.length > 0) {
                                                        setSelectedProductForVariant(product)
                                                    } else {
                                                        addToCart(product)
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                                    <Search className="w-12 h-12 mb-2 opacity-20" />
                                    <p>No products in stock at this location</p>
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>

                {/* Cart — receipt-style */}
                <div className="w-80 xl:w-96 shrink-0 flex flex-col bg-card rounded-xl border border-border h-full overflow-hidden">
                <div className="p-4 border-b border-border">
                    <CustomerCombobox value={selectedCustomerId}
                        onValueChange={(id, name) => { setSelectedCustomerId(id); setSelectedCustomerName(name) }} />
                </div>
                <div className="flex-1 flex flex-col min-h-0 relative">
                    {cart.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground space-y-4 px-6 text-center">
                            <div className="w-20 h-20 rounded-2xl bg-brand-soft flex items-center justify-center">
                                <ShoppingCart className="w-9 h-9 text-brand-fg opacity-80" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-foreground">Cart is empty</p>
                                <p className="text-xs mt-1">Tap any product to start ringing up a sale.</p>
                            </div>
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
                            <div className="space-y-3 p-3 pr-4 pb-4">
                                {cart.map(item => (
                                    <PosCartItem key={item.id} item={item} onVerifyQuantity={updateQuantity} onRemove={removeFromCart} />
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-2 p-3 border-t border-border">
                    <Button variant="outline" size="sm" className="h-9 gap-2 text-muted-foreground" onClick={() => setIsDiscountModalOpen(true)}>
                        <Percent className="w-3.5 h-3.5" />
                        Discount {discount > 0 && `(${formatCurrency(discount)})`}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn("h-9 gap-2", appliedCoupon ? "text-money-fg border-money/40 hover:bg-money-soft" : "text-muted-foreground")}
                        onClick={() => {
                            if (appliedCoupon) {
                                handleRemoveCoupon()
                            } else {
                                loadAvailableCoupons()
                                setIsCouponModalOpen(true)
                            }
                        }}
                    >
                        <Ticket className="w-3.5 h-3.5" />
                        {appliedCoupon ? `${appliedCoupon.code}` : "Coupon"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 gap-2 text-destructive hover:bg-destructive/10" onClick={() => setIsResetDialogOpen(true)}>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset
                    </Button>
                </div>
                <div className="p-4 border-t border-border">
                    {/* Receipt */}
                    <div className="relative rounded-2xl border border-border bg-muted/40 p-4">
                        {/* punch-hole notches */}
                        <span className="absolute -left-[7px] top-[52px] size-3.5 rounded-full bg-card border border-border" aria-hidden />
                        <span className="absolute -right-[7px] top-[52px] size-3.5 rounded-full bg-card border border-border" aria-hidden />

                        <div className="space-y-1 text-sm text-muted-foreground">
                            <div className="flex justify-between py-0.5"><span>Subtotal</span><span className="font-medium font-mono text-foreground">{formatCurrency(subtotal)}</span></div>
                            <div className="flex justify-between py-0.5"><span>{formatTaxLabel()}</span><span className="font-medium font-mono text-foreground">{formatCurrency(tax)}</span></div>
                            {discount > 0 && (
                                <div className="flex justify-between py-0.5 text-money-fg">
                                    <span>Manual Discount</span><span className="font-medium font-mono">-{formatCurrency(discount)}</span>
                                </div>
                            )}
                            {couponDiscount > 0 && (
                                <div className="flex justify-between py-0.5 text-money-fg">
                                    <span>Coupon ({appliedCoupon?.code})</span><span className="font-medium font-mono">-{formatCurrency(couponDiscount)}</span>
                                </div>
                            )}
                        </div>

                        {/* tear line */}
                        <div className="my-3 border-t-[1.5px] border-dashed border-border" />

                        <div className="flex justify-between items-end">
                            <span className="font-semibold text-base text-foreground">Total</span>
                            <span className="font-bold text-3xl text-money-fg tracking-tight tabular-nums">{formatCurrency(total)}</span>
                        </div>
                    </div>

                    <Button
                        className="w-full h-14 mt-4 text-base font-bold text-money-foreground bg-money hover:brightness-110 shadow-lg shadow-money/20 active:scale-[0.98] transition-all"
                        disabled={cart.length === 0 || isSubmitting}
                        onClick={() => setIsCheckoutOpen(true)}
                    >
                        {isSubmitting ? "Processing..." : `Charge ${formatCurrency(total)}`}
                    </Button>
                </div>
            </div>
            </div>

            <CheckoutModal open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen} totalAmount={total} onConfirm={handleCheckout} />
            <DiscountModal open={isDiscountModalOpen} onOpenChange={setIsDiscountModalOpen} onApplyDiscount={handleApplyDiscount} currentSubtotal={subtotal} />

            {/* Coupon Modal */}
            <Dialog open={isCouponModalOpen} onOpenChange={setIsCouponModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Apply Coupon</DialogTitle>
                    </DialogHeader>
                    {couponsLoading ? (
                        <div className="flex justify-center py-6">
                            <p className="text-gray-500">Loading coupons...</p>
                        </div>
                    ) : availableCoupons.length === 0 ? (
                        <div className="py-6 text-center">
                            <p className="text-gray-500">No active coupons available</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {availableCoupons.map(coupon => (
                                <button
                                    key={coupon.id}
                                    onClick={() => handleApplyCoupon(coupon)}
                                    className="w-full p-3 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-gray-900">{coupon.code}</p>
                                            <p className="text-sm text-gray-600">{coupon.campaignName}</p>
                                        </div>
                                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                                            {coupon.type === 'percentage' ? `${coupon.discount}%` : formatCurrency(coupon.discount)}
                                        </Badge>
                                    </div>
                                    {coupon.minOrderAmount > 0 && (
                                        <p className="text-xs text-gray-500 mt-1">Min order: {formatCurrency(Number(coupon.minOrderAmount ?? 0))}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Cart?</AlertDialogTitle>
                        <AlertDialogDescription>This will remove all items and clear the selected customer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetCart} className="bg-red-600 hover:bg-red-700">Reset Cart</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <SuccessModal open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen} onClose={handleSuccessClose}
                formatCurrency={formatCurrency} taxLabel={formatTaxLabel()}
                orderDetails={{ cart, subtotal, tax, discount, total, customer: selectedCustomerName, invoiceNo }} />

            {/* Variant Modal */}
            <Dialog open={!!selectedProductForVariant} onOpenChange={(open) => !open && setSelectedProductForVariant(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Variant — {selectedProductForVariant?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        {selectedProductForVariant?.variants?.map(variant => {
                            const variantStock = getAvailableStock(selectedProductForVariant, variant)
                            return (
                                <div key={variant.id}
                                    className={cn("flex items-center justify-between border border-border p-3 rounded-lg hover:bg-accent cursor-pointer",
                                        variantStock === 0 && "opacity-50 pointer-events-none")}
                                    onClick={() => variantStock > 0 && addToCart(selectedProductForVariant, variant)}
                                >
                                    <div>
                                        <p className="font-medium">{variant.name}</p>
                                        <p className="text-sm text-muted-foreground">SKU: {variant.sku}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-money-fg">{formatCurrency((() => { const b = variant.salePrice || variant.price || 0; const op = variant.offerPrice ?? selectedProductForVariant?.offerPrice; const ot = variant.offerType ?? selectedProductForVariant?.offerType ?? "percentage"; return op ? (ot === "percentage" ? b * (1 - op / 100) : b - op) : b })())}</p>
                                        <Badge variant="outline" className={variantStock > 0 ? "text-money-fg border-money/30" : "text-destructive border-destructive/30"}>
                                            {variantStock > 0 ? `${variantStock} in stock` : "Out of stock"}
                                        </Badge>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
