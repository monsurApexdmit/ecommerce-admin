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
const PRODUCTS = [
    { id: "1", name: "Fresh Mustard Oil", price: 99.91, stock: 45, image: "/oil.png", category: "Oil" },
    { id: "2", name: "Himalaya Powder", price: 160.00, stock: 20, image: "/powder.jpg", category: "Skin Care" },
    { id: "3", name: "Green Leaf Lettuce", price: 112.72, stock: 15, image: "/fresh-lettuce.png", category: "Vegetable" },
    { id: "4", name: "Rainbow Chard", price: 7.07, stock: 0, image: "/chard.jpg", category: "Vegetable" },
    { id: "5", name: "Clementine", price: 48.12, stock: 100, image: "/single-clementine.png", category: "Fruits" },
    { id: "6", name: "Kale Sprouts", price: 90.00, stock: 50, image: "/vibrant-kale.png", category: "Vegetable" },
    { id: "7", name: "Rainbow Peppers", price: 90.85, stock: 30, image: "/colorful-peppers.png", category: "Vegetable" },
    { id: "8", name: "Blueberry", price: 211.96, stock: 12, image: "/ripe-blueberries.png", category: "Fruits" },
    { id: "9", name: "Fresh Organic Apple", price: 15.00, stock: 50, image: "/placeholder.svg", category: "Fruits" },
    { id: "10", name: "Organic Banana", price: 5.00, stock: 100, image: "/placeholder.svg", category: "Fruits" },
    { id: "11", name: "Fresh Tomato", price: 8.50, stock: 40, image: "/placeholder.svg", category: "Vegetable" },
    { id: "12", name: "Cauliflower", price: 12.00, stock: 25, image: "/placeholder.svg", category: "Vegetable" },
    { id: "13", name: "Organic Carrot", price: 6.00, stock: 60, image: "/placeholder.svg", category: "Vegetable" },
    { id: "14", name: "Fresh Broccoli", price: 10.00, stock: 35, image: "/placeholder.svg", category: "Vegetable" },
    { id: "15", name: "Red Onion", price: 7.00, stock: 80, image: "/placeholder.svg", category: "Vegetable" },
    { id: "16", name: "Organic Potato", price: 4.50, stock: 120, image: "/placeholder.svg", category: "Vegetable" },
    { id: "17", name: "Coconut Oil", price: 120.00, stock: 15, image: "/placeholder.svg", category: "Oil" },
    { id: "18", name: "Olive Oil", price: 250.00, stock: 10, image: "/placeholder.svg", category: "Oil" },
    { id: "19", name: "Aloe Vera Gel", price: 180.00, stock: 20, image: "/placeholder.svg", category: "Skin Care" },
    { id: "20", name: "Face Wash", price: 150.00, stock: 25, image: "/placeholder.svg", category: "Skin Care" },
    { id: "21", name: "Body Lotion", price: 220.00, stock: 18, image: "/placeholder.svg", category: "Skin Care" },
    { id: "22", name: "Sunflower Oil", price: 110.00, stock: 30, image: "/placeholder.svg", category: "Oil" },
    { id: "23", name: "Fresh Orange", price: 25.00, stock: 45, image: "/placeholder.svg", category: "Fruits" },
    { id: "24", name: "Grapes", price: 60.00, stock: 20, image: "/placeholder.svg", category: "Fruits" },
]

const CATEGORIES = [
    { id: "All", name: "All Items", icon: LayoutGrid },
    { id: "Vegetable", name: "Vegetables", icon: LayoutGrid },
    { id: "Fruits", name: "Fruits", icon: LayoutGrid },
    { id: "Oil", name: "Oil & Spice", icon: LayoutGrid },
    { id: "Skin Care", name: "Skin Care", icon: LayoutGrid },
]

interface CartItem {
    id: string
    name: string
    price: number
    image: string
    quantity: number
}

export default function PosPage() {
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedCategory, setSelectedCategory] = useState("All")
    const [cart, setCart] = useState<CartItem[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState("")
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)

    // New State
    const [discount, setDiscount] = useState(0)
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
    const [shipping, setShipping] = useState(0)

    // Filter Products
    const filteredProducts = PRODUCTS.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesCategory = selectedCategory === "All" || product.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    // Cart Logic
    const addToCart = (product: typeof PRODUCTS[0]) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id)
            if (existing) {
                return prev.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                )
            }
            return [...prev, { ...product, quantity: 1 }]
        })
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
        </div>
    )
}
