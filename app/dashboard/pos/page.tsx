"use client"

import { useState, useEffect, useMemo } from "react"
import { Search, ShoppingCart, LayoutGrid, RotateCcw, Percent } from "lucide-react"
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
import { toast } from "sonner"

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
    const { warehouses, defaultWarehouse } = useWarehouse()
    const { getAllCategoriesFlat } = useCategory()
    const { getCustomerById } = useCustomer()

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
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
    const [shipping] = useState(0)
    const [invoiceNo, setInvoiceNo] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

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
                        salePrice: p.sale_price,
                        stock: p.stock,
                        status: p.status || (p.stock > 0 ? "Selling" : "Out of Stock"),
                        published: p.published ?? true,
                        image: (() => {
                            if (p.images?.length > 0) {
                                const path = p.images.find((i: any) => i.is_primary)?.path || p.images[0].path
                                return path ? `/api/proxy/${path}` : ""
                            }
                            if (p.image) return p.image.startsWith("/api/proxy/") ? p.image : `/api/proxy/${p.image}`
                            return ""
                        })(),
                        sku: p.sku || "",
                        barcode: p.barcode || "",
                        variants: p.variants?.map((v: any) => ({
                            id: String(v.id),
                            name: v.name,
                            attributes: v.attributes || {},
                            price: v.price,
                            salePrice: v.sale_price,
                            stock: v.stock,
                            sku: v.sku || "",
                            barcode: v.barcode,
                            inventory: v.inventory?.map((i: any) => ({
                                inventoryId: i.id,
                                warehouseId: String(i.location_id),
                                quantity: i.quantity,
                            })) || [],
                        })) || [],
                        inventory: p.inventory?.map((i: any) => ({
                            inventoryId: i.id,
                            warehouseId: String(i.location_id ?? i.warehouse_id),
                            quantity: i.quantity,
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
            return product.variants.reduce((sum, v) => {
                const loc = v.inventory?.find(i => i.warehouseId === whId)
                return sum + (loc ? loc.quantity : 0)
            }, 0)
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
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase())
            const hasStock = selectedWarehouseId ? getAvailableStock(product) > 0 : true
            return matchesSearch && hasStock
        })
    }, [products, searchQuery, selectedWarehouseId, cart]) // eslint-disable-line

    const addToCart = (product: Product, variant?: Variant) => {
        if (product.variants && product.variants.length > 0 && !variant) {
            setSelectedProductForVariant(product); return
        }
        const availableStock = getAvailableStock(product, variant)
        const cartItemId = variant ? `${product.id}-${variant.id}` : product.id
        const existingInCart = cart.find(item => item.id === cartItemId)
        if (availableStock <= 0) { toast.error("Not enough stock!"); return }
        const price = variant ? (variant.salePrice || variant.price) : (product.salePrice || product.price)
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
    const handleSuccessClose = () => {
        setIsSuccessModalOpen(false); setCart([])
        setSelectedCustomerId(""); setSelectedCustomerName("Walk-in Customer")
        setDiscount(0); setInvoiceNo("")
    }

    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0)
    const tax = subtotal * 0.1
    const total = Math.max(0, subtotal + tax + shipping - discount)

    const handleCheckout = async (method: string) => {
        setIsSubmitting(true)
        try {
            const customer = selectedCustomerId ? getCustomerById(selectedCustomerId) : undefined
            const res = await sellsApi.create({
                customerId: customer ? Number(customer.id) : undefined,
                customerName: selectedCustomerName || "Walk-in Customer",
                customerEmail: customer?.email || undefined,
                customerPhone: customer?.phone || undefined,
                method,
                amount: total,
                discount: discount > 0 ? discount : undefined,
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
        <div className="flex h-[calc(100vh-6rem)] gap-4 overflow-hidden">
            {/* Categories */}
            <div className="w-24 flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden">
                <ScrollArea className="h-full w-full">
                    <div className="flex flex-col items-center py-4 space-y-2">
                        {categories.map(cat => (
                            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                                className={cn(
                                    "flex flex-col items-center justify-center w-20 min-h-16 rounded-xl transition-all p-2 gap-1 shrink-0",
                                    selectedCategory === cat.id
                                        ? "bg-emerald-600 text-white shadow-md scale-105"
                                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                )}
                            >
                                <LayoutGrid className="w-5 h-5" />
                                <span className="text-[10px] font-medium text-center leading-tight">{cat.name}</span>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Product Grid */}
            <div className="flex-1 flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4 border-b flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input placeholder="Search products..." className="pl-10 h-10 bg-gray-50 border-gray-200 focus:bg-white"
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
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
                <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full p-4 bg-gray-50/30">
                        {productsLoading ? (
                            <div className="flex items-center justify-center h-64 text-gray-400"><p>Loading products...</p></div>
                        ) : filteredProducts.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-4">
                                {filteredProducts.map(product => (
                                    <PosProductCard key={product.id} product={{ ...product, stock: getAvailableStock(product) }} onAddToCart={addToCart} />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                <Search className="w-12 h-12 mb-2 opacity-20" />
                                <p>No products in stock at this location</p>
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </div>

            {/* Cart */}
            <div className="w-[420px] flex flex-col bg-white rounded-xl border shadow-sm h-full overflow-hidden">
                <div className="p-4 border-b bg-gray-50/50">
                    <CustomerCombobox value={selectedCustomerId}
                        onValueChange={(id, name) => { setSelectedCustomerId(id); setSelectedCustomerName(name) }} />
                </div>
                <div className="flex-1 flex flex-col min-h-0 relative">
                    {cart.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 space-y-4">
                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                                <ShoppingCart className="w-10 h-10 opacity-20" />
                            </div>
                            <p className="text-sm font-medium">Your cart is empty</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-full p-3">
                            <div className="space-y-3 pb-4">
                                {cart.map(item => (
                                    <PosCartItem key={item.id} item={item} onVerifyQuantity={updateQuantity} onRemove={removeFromCart} />
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 border-t bg-gray-50/30">
                    <Button variant="outline" size="sm" className="h-9 gap-2 text-gray-600 border-dashed" onClick={() => setIsDiscountModalOpen(true)}>
                        <Percent className="w-3.5 h-3.5" />
                        Discount {discount > 0 && `($${discount.toFixed(2)})`}
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 gap-2 text-red-600 border-red-100 hover:bg-red-50" onClick={() => setIsResetDialogOpen(true)}>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Cart
                    </Button>
                </div>
                <div className="p-4 bg-gray-50 border-t space-y-3">
                    <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex justify-between"><span>Subtotal</span><span className="font-medium font-mono">${subtotal.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Tax (10%)</span><span className="font-medium font-mono">${tax.toFixed(2)}</span></div>
                        {discount > 0 && (
                            <div className="flex justify-between text-emerald-600">
                                <span>Discount</span><span className="font-medium font-mono">-${discount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="pt-2 border-t mt-2 flex justify-between items-end text-gray-900">
                            <span className="font-bold text-lg">Total</span>
                            <span className="font-bold text-3xl text-emerald-600">${total.toFixed(2)}</span>
                        </div>
                    </div>
                    <Button className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-[0.98] transition-all"
                        disabled={cart.length === 0 || isSubmitting} onClick={() => setIsCheckoutOpen(true)}>
                        {isSubmitting ? "Processing..." : "Pay Now"}
                    </Button>
                </div>
            </div>

            <CheckoutModal open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen} totalAmount={total} onConfirm={handleCheckout} />
            <DiscountModal open={isDiscountModalOpen} onOpenChange={setIsDiscountModalOpen} onApplyDiscount={handleApplyDiscount} currentSubtotal={subtotal} />

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
                                    className={cn("flex items-center justify-between border p-3 rounded-lg hover:bg-gray-50 cursor-pointer",
                                        variantStock === 0 && "opacity-50 pointer-events-none")}
                                    onClick={() => variantStock > 0 && addToCart(selectedProductForVariant, variant)}
                                >
                                    <div>
                                        <p className="font-medium">{variant.name}</p>
                                        <p className="text-sm text-gray-500">SKU: {variant.sku}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-emerald-600">${variant.salePrice || variant.price}</p>
                                        <Badge variant="outline" className={variantStock > 0 ? "text-emerald-600 border-emerald-200" : "text-red-600 border-red-200"}>
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
