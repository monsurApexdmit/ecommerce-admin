"use client"

import React, { createContext, useContext, useState } from "react"
import { generateId } from "@/lib/export-import-utils"

export interface Product {
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
    createdAt?: string
    updatedAt?: string
    vendorId?: string
    receiptNumber?: string
    attributes?: {
        id: string
        name: string
        value: string | string[]
    }[]
    variants?: Variant[]
    inventory?: {
        warehouseId: string
        quantity: number
    }[]
}

export interface Variant {
    id: string
    name: string
    attributes: { [key: string]: string }
    price: number
    salePrice: number
    stock: number
    sku: string
    inventory?: {
        warehouseId: string
        quantity: number
    }[]
}

interface ProductContextType {
    products: Product[]
    addProduct: (product: Product) => void
    updateProduct: (product: Product) => void
    deleteProduct: (id: string) => void
    getProductsByVendor: (vendorId: string) => Product[]
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

const initialProducts: Product[] = [
    {
        id: "1",
        name: "Premium T-Shirt",
        description: "High-quality cotton t-shirt with premium fabric",
        category: "Men",
        price: 450.0,
        salePrice: 450.0,
        stock: 30, // Sum of variant stocks
        status: "Selling",
        published: true,
        image: "/plain-white-tshirt.png",
        sku: "TSH-001",
        barcode: "1234567890123",
        createdAt: "2023-11-20T10:00:00Z",
        updatedAt: "2023-11-21T10:00:00Z",
        vendorId: "1",
        attributes: [
            { id: "81B6", name: "Size", value: ["Small", "Medium", "Large"] },
            { id: "81B2", name: "Color", value: ["Red", "Blue"] }
        ],
        variants: [
            { id: "v1", name: "Small / Red", attributes: { "Size": "Small", "Color": "Red" }, price: 450, salePrice: 450, stock: 5, sku: "TSH-001-S-RE" },
            { id: "v2", name: "Small / Blue", attributes: { "Size": "Small", "Color": "Blue" }, price: 450, salePrice: 450, stock: 5, sku: "TSH-001-S-BL" },
            { id: "v3", name: "Medium / Red", attributes: { "Size": "Medium", "Color": "Red" }, price: 460, salePrice: 460, stock: 5, sku: "TSH-001-M-RE" },
            { id: "v4", name: "Medium / Blue", attributes: { "Size": "Medium", "Color": "Blue" }, price: 460, salePrice: 460, stock: 5, sku: "TSH-001-M-BL" },
            { id: "v5", name: "Large / Red", attributes: { "Size": "Large", "Color": "Red" }, price: 470, salePrice: 470, stock: 5, sku: "TSH-001-L-RE" },
            { id: "v6", name: "Large / Blue", attributes: { "Size": "Large", "Color": "Blue" }, price: 470, salePrice: 470, stock: 5, sku: "TSH-001-L-BL" }
        ],
        inventory: [
            { warehouseId: "wh_main", quantity: 30 }
        ]
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
        vendorId: "2", // Best Electronics (Powder? Data mismatch, effectively random for now)
        inventory: [
            { warehouseId: "wh_main", quantity: 5471 }
        ]
    },
    // ... Adding a few more from the original list for completeness or relying on user adding them.
    // I will include the full list from the original file to ensure no data loss during migration.
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
        vendorId: "1",
        inventory: [
            { warehouseId: "wh_main", quantity: 463 }
        ]
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
        vendorId: "1",
        inventory: [
            { warehouseId: "wh_main", quantity: 472 }
        ]
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
        vendorId: "1",
        inventory: [
            { warehouseId: "wh_main", quantity: 443 }
        ]
    },
]

export function ProductProvider({ children }: { children: React.ReactNode }) {
    const [products, setProducts] = useState<Product[]>(initialProducts)

    const addProduct = (product: Product) => {
        setProducts((prev) => [...prev, product])
    }

    const updateProduct = (product: Product) => {
        setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)))
    }

    const deleteProduct = (id: string) => {
        setProducts((prev) => prev.filter((p) => p.id !== id))
    }

    const getProductsByVendor = (vendorId: string) => {
        return products.filter(p => p.vendorId === vendorId)
    }

    return (
        <ProductContext.Provider
            value={{
                products,
                addProduct,
                updateProduct,
                deleteProduct,
                getProductsByVendor,
            }}
        >
            {children}
        </ProductContext.Provider>
    )
}

export function useProduct() {
    const context = useContext(ProductContext)
    if (context === undefined) {
        throw new Error("useProduct must be used within a ProductProvider")
    }
    return context
}
