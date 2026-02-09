"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

// Order Item Interface
export interface OrderItem {
  productId: number
  productName: string
  quantity: number
  price: number
}

// Order Interface
export interface Order {
  id?: number
  invoiceNo?: string
  orderTime?: string
  customerId?: number
  customerName: string
  shippingAddressId?: number
  method: "Cash" | "Card" | "Online"
  amount: number
  shippingCost?: number
  discount?: number
  status?: "Pending" | "Processing" | "Delivered"
  notes?: string
  items: OrderItem[]
}

// Context Type
interface OrderContextType {
  createOrder: (order: Order) => Promise<{ success: boolean; data?: any; error?: string }>
  cart: OrderItem[]
  addToCart: (item: OrderItem) => void
  removeFromCart: (productId: number) => void
  updateCartQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
  getCartTotal: () => number
  getCartItemCount: () => number
}

const OrderContext = createContext<OrderContextType | undefined>(undefined)

export function OrderProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<OrderItem[]>([])

  // Add item to cart
  const addToCart = (item: OrderItem) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((i) => i.productId === item.productId)
      if (existingItem) {
        // Update quantity if item exists
        return prevCart.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        )
      }
      // Add new item
      return [...prevCart, item]
    })
  }

  // Remove item from cart
  const removeFromCart = (productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId))
  }

  // Update cart item quantity
  const updateCartQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId)
      return
    }
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
      )
    )
  }

  // Clear entire cart
  const clearCart = () => {
    setCart([])
  }

  // Calculate cart total
  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  // Get cart item count
  const getCartItemCount = () => {
    return cart.reduce((count, item) => count + item.quantity, 0)
  }

  // Create order by calling the backend API
  const createOrder = async (order: Order): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      const response = await fetch("http://localhost:8004/sells/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(order),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || "Failed to create order",
        }
      }

      // Clear cart after successful order
      clearCart()

      return {
        success: true,
        data: data.data,
      }
    } catch (error) {
      console.error("Error creating order:", error)
      return {
        success: false,
        error: "Network error. Please check your connection.",
      }
    }
  }

  return (
    <OrderContext.Provider
      value={{
        createOrder,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        getCartTotal,
        getCartItemCount,
      }}
    >
      {children}
    </OrderContext.Provider>
  )
}

export function useOrder() {
  const context = useContext(OrderContext)
  if (context === undefined) {
    throw new Error("useOrder must be used within an OrderProvider")
  }
  return context
}
