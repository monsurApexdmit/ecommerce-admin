"use client"

import { useState } from "react"
import { Search, ShoppingCart, User, RotateCcw, LayoutGrid, Tag, Truck, Percent, Minus, Plus, Trash2 } from "lucide-react"
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Mock Data
import { useProduct, type Product, type Variant } from "@/contexts/product-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

const CATEGORIES = [
    { id: "All", name: "All Items", icon: LayoutGrid },
    { id: "Men", name: "Men", icon: LayoutGrid },
    { id: "Skin Care", name: "Skin Care", icon: LayoutGrid },
    { id: "Fresh Vegetable", name: "Vegetables", icon: LayoutGrid },
    { id: "Fresh Fruits", name: "Fruits", icon: LayoutGrid },
    { id: "Electronics", name: "Electronics", icon: LayoutGrid },
]

interface CartItem {
    id: string
    variantId?: string
    name: string
    price: number
    image: string
    quantity: number
    variantName?: string
}

export default function PosPage() {
    const { products } = useProduct()
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCategory, setSelectedCategory] = useState("All")
    const [cart, setCart] = useState<CartItem[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState("")
    const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null)
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)

    // New State
    const [discount, setDiscount] = useState(0)
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
    const [shipping, setShipping] = useState(0)

    // Filter Products
    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === "All" || product.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    // Cart Logic
    const addToCart = (product: Product, variant?: Variant) => {
        if (product.variants && product.variants.length > 0 && !variant) {
            setSelectedProductForVariant(product)
            return
        }

        const cartItemId = variant ? `${product.id}-${variant.id}` : product.id
        const price = variant ? variant.price : product.salePrice
        const name = variant ? `${product.name} (${variant.name})` : product.name

        setCart(prev => {
            const existing = prev.find(item => item.id === cartItemId)
            if (existing) {
                return prev.map(item =>
                    item.id === cartItemId ? { ...item, quantity: item.quantity + 1 } : item
                )
            }
            return [...prev, { 
                id: cartItemId,
                variantId: variant?.id,
                name: name,
                price: price,
                image: product.image || "/placeholder.svg", 
                quantity: 1,
                variantName: variant?.name
            }]
        })
        
        if (variant) {
            setSelectedProductForVariant(null)
        }
    }

    const updateQuantity = (id: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta)
                return { ...item, quantity: newQty }
            }
            return item
        }))
    }

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(item => item.id !== id))
    }

    const handleResetCart = () => {
        setCart([])
        setSelectedCustomer("")
        setDiscount(0)
        setShipping(0)
        setIsResetDialogOpen(false)
    }

    const handleApplyDiscount = (amount: number, type: 'fixed' | 'percentage') => {
        if (type === 'fixed') {
            setDiscount(amount)
        } else {
            setDiscount((subtotal * amount) / 100)
        }
    }

    const handleSuccessClose = () => {
        setIsSuccessModalOpen(false)
        setCart([])
        setSelectedCustomer("")
        setDiscount(0)
        setShipping(0)
    }

    // Calculations
    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0)
    const tax = subtotal * 0.1 // 10% tax example
    const total = Math.max(0, subtotal + tax + shipping - discount)

    const handleCheckout = (method: string) => {
        console.log("Order Placed:", { customer: selectedCustomer, cart, method, total })
        setIsSuccessModalOpen(true)
    }

    return (
        <div className="flex h-[calc(100vh-6rem)] gap-4 overflow-hidden">
            {/* COLUMN 1: Categories Sidebar */}
            <div className="w-24 flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden">
                <ScrollArea className="h-full w-full">
                    <div className="flex flex-col items-center py-4 space-y-2">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={cn(
                                    "flex flex-col items-center justify-center w-20 h-20 rounded-xl transition-all p-2 gap-1 shrink-0",
                                    selectedCategory === cat.id
                                        ? "bg-emerald-600 text-white shadow-md scale-105"
                                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                                )}
                            >
                                <cat.icon className="w-6 h-6" />
                                <span className="text-[10px] font-medium text-center leading-tight">{cat.name}</span>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* COLUMN 2: Product Grid */}
            <div className="flex-1 flex flex-col bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <Input
                            placeholder="Search products..."
                            className="pl-10 h-12 text-base bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full p-4 bg-gray-50/30">
                        {filteredProducts.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-4">
                                {filteredProducts.map(product => (
                                    <PosProductCard
                                        key={product.id}
                                        product={product}
                                        onAddToCart={addToCart}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                <Search className="w-12 h-12 mb-2 opacity-20" />
                                <p>No products found</p>
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </div>

            {/* COLUMN 3: Cart Sidebar */}
            <div className="w-[420px] flex flex-col bg-white rounded-xl border shadow-sm h-full overflow-hidden">
                {/* Customer Select */}
                <div className="p-4 border-b bg-gray-50/50">
                    <CustomerCombobox value={selectedCustomer} onValueChange={setSelectedCustomer} />
                </div>

                {/* Cart Items */}
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
                                    <PosCartItem
                                        key={item.id}
                                        item={item}
                                        onVerifyQuantity={updateQuantity}
                                        onRemove={removeFromCart}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                {/* Lower Actions (Discount/Reset) */}
                <div className="grid grid-cols-2 gap-2 p-3 border-t bg-gray-50/30">
                    <Button variant="outline" size="sm" className="h-9 gap-2 text-gray-600 border-dashed"
                        onClick={() => setIsDiscountModalOpen(true)}
                    >
                        <Percent className="w-3.5 h-3.5" />
                        Discount {discount > 0 && `($${discount.toFixed(2)})`}
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 gap-2 text-red-600 border-red-100 hover:bg-red-50 hover:border-red-200" onClick={() => setIsResetDialogOpen(true)}>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Cart
                    </Button>
                </div>

                {/* Summary Footer */}
                <div className="p-4 bg-gray-50 border-t space-y-3">
                    <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span className="font-medium font-mono">${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Tax (10%)</span>
                            <span className="font-medium font-mono">${tax.toFixed(2)}</span>
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between text-emerald-600">
                                <span>Discount</span>
                                <span className="font-medium font-mono">-${discount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="pt-2 border-t mt-2 flex justify-between items-end text-gray-900">
                            <span className="font-bold text-lg">Total</span>
                            <span className="font-bold text-3xl text-emerald-600">${total.toFixed(2)}</span>
                        </div>
                    </div>

                    <Button
                        className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-[0.98] transition-all"
                        disabled={cart.length === 0}
                        onClick={() => setIsCheckoutOpen(true)}
                    >
                        Pay Now
                    </Button>
                </div>
            </div>

            <CheckoutModal
                open={isCheckoutOpen}
                onOpenChange={setIsCheckoutOpen}
                totalAmount={total}
                onConfirm={handleCheckout}
            />

            <DiscountModal
                open={isDiscountModalOpen}
                onOpenChange={setIsDiscountModalOpen}
                onApplyDiscount={handleApplyDiscount}
                currentSubtotal={subtotal}
            />

            <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Cart?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove all items from your cart and clear selected customer. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetCart} className="bg-red-600 hover:bg-red-700">
                            Reset Cart
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <SuccessModal
                open={isSuccessModalOpen}
                onOpenChange={setIsSuccessModalOpen}
                onClose={handleSuccessClose}
                orderDetails={{
                    cart,
                    subtotal,
                    tax,
                    discount,
                    total,
                    customer: selectedCustomer
                }}
            />

            <Dialog open={!!selectedProductForVariant} onOpenChange={(open) => !open && setSelectedProductForVariant(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Variant</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {selectedProductForVariant?.variants?.map((variant) => (
                            <div key={variant.id} className="flex items-center justify-between border p-3 rounded-lg hover:bg-gray-50 cursor-pointer" 
                                 onClick={() => addToCart(selectedProductForVariant, variant)}>
                                <div>
                                    <p className="font-medium">{variant.name}</p>
                                    <p className="text-sm text-gray-500">SKU: {variant.sku}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-emerald-600">${variant.price}</p>
                                    <Badge variant="outline" className={variant.stock > 0 ? "text-emerald-600 border-emerald-200" : "text-red-600 border-red-200"}>
                                        {variant.stock > 0 ? `${variant.stock} in stock` : "Out of stock"}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
