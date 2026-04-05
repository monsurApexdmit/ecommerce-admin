"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { productApi, type ProductResponse } from "@/lib/productApi"

export interface Product {
    id: string
    name: string
    description: string
    category: string        // display name
    categoryId?: string     // backend id
    price: number
    salePrice: number
    stock: number
    status: "Selling" | "Out of Stock" | "Discontinued"
    published: boolean
    image: string
    images?: File[]         // for upload
    delete_images?: boolean
    keep_images?: string[]  // existing paths to keep on update
    sku: string
    barcode: string
    createdAt?: string
    updatedAt?: string
    vendorId?: string
    locationId?: string     // backend location/warehouse id
    locationName?: string   // display name
    receiptNumber?: string
    attributes?: {
        id: string
        name: string
        value: string | string[]
    }[]
    variants?: Variant[]
    inventory?: {
        inventoryId?: number
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
    barcode?: string
    inventory?: {
        inventoryId?: number
        warehouseId: string
        quantity: number
    }[]
}

interface ProductContextType {
    products: Product[]
    isLoading: boolean
    error: string | null
    addProduct: (product: Omit<Product, 'id'>) => Promise<void>
    updateProduct: (product: Product) => Promise<void>
    deleteProduct: (id: string) => Promise<void>
    getProductsByVendor: (vendorId: string) => Product[]
    deductStock: (cartItems: { productId: string; variantId?: string; quantity: number }[], warehouseId: string) => void
    refreshProducts: () => Promise<void>
}

const ProductContext = createContext<ProductContextType | undefined>(undefined)

function convertToProduct(p: ProductResponse): Product {
    const categoryObj = typeof p.category === "object" && p.category !== null ? p.category : null
    // DTO returns camelCase IDs
    const categoryId = categoryObj ? String(categoryObj.id) : ((p as any).categoryId ? String((p as any).categoryId) : undefined)
    const vendorId = (p as any).vendorId ? String((p as any).vendorId) : (p.vendor_id ? String(p.vendor_id) : undefined)
    const locationId = (p as any).locationId ? String((p as any).locationId) : (p.location_id ? String(p.location_id) : undefined)
    return {
        id: String(p.id),
        name: p.name,
        description: p.description || "",
        category: categoryObj ? categoryObj.category_name : (p.category as string || ""),
        categoryId,
        price: p.price,
        salePrice: p.salePrice ?? p.sale_price,
        stock: p.stock,
        status: (p.status as Product["status"]) || (p.stock > 0 ? "Selling" : "Out of Stock"),
        published: p.published ?? true,
        image: (() => {
            try {
                // Try images array first (from backend relationship)
                if (Array.isArray(p.images) && p.images.length > 0) {
                    const primaryImage = p.images.find((i: any) => i.isPrimary === true || i.is_primary === true)
                    const imagePath = primaryImage?.path || p.images[0]?.path
                    if (imagePath && typeof imagePath === 'string' && imagePath.trim()) {
                        if (imagePath.startsWith("/api/proxy/") || imagePath.startsWith("http")) return imagePath
                        return `/api/proxy/uploads/${imagePath}`
                    }
                }
                // Fallback to image field
                if (p.image && typeof p.image === 'string' && p.image.trim()) {
                    if (p.image.startsWith("/api/proxy/") || p.image.startsWith("http")) return p.image
                    return `/api/proxy/uploads/${p.image}`
                }
            } catch (e) {
                console.error("Error processing image for product", p.id, "error:", e, "p.images:", p.images, "p.image:", p.image)
            }
            return "/placeholder.svg"
        })(),
        sku: p.sku || "",
        barcode: p.barcode || "",
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        vendorId,
        locationId,
        locationName: p.location?.name,
        receiptNumber: (p as any).receiptNumber || p.receipt_number || undefined,
        attributes: p.attributes?.map(a => ({
            id: String(a.id),
            name: a.name,
            value: [] as string[], // selected values are reconstructed from variants in the edit dialog
        })) || [],
        variants: p.variants?.map(v => ({
            id: String(v.id),
            name: v.name,
            attributes: (() => {
                const raw = (v as any).attributes
                if (!raw) return {}
                if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return {} } }
                return raw
            })(),
            price: v.price,
            salePrice: (v as any).salePrice ?? v.sale_price,
            stock: v.stock,
            sku: v.sku || "",
            barcode: v.barcode,
        })) || [],
        inventory: p.inventory?.map(i => ({
            warehouseId: String(i.warehouse_id),
            quantity: i.quantity,
        })) || [],
    }
}

export function ProductProvider({ children }: { children: React.ReactNode }) {
    const [products, setProducts] = useState<Product[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refreshProducts = async () => {
        try {
            setIsLoading(true)
            setError(null)
            const res = await productApi.getAll({ limit: 200 })
            setProducts((res.data ?? []).map(convertToProduct))
        } catch (err: any) {
            console.error("Failed to fetch products:", err)
            setError(err.response?.data?.error || "Failed to fetch products")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        refreshProducts()
    }, [])

    const addProduct = async (product: Omit<Product, 'id'>) => {
        if (!product.categoryId || !product.locationId) {
            throw new Error("Category and location are required")
        }
        try {
            await productApi.create({
                name: product.name,
                description: product.description,
                category_id: parseInt(product.categoryId),
                location_id: parseInt(product.locationId),
                price: product.price,
                sale_price: product.salePrice,
                stock: product.stock,
                published: product.published,
                sku: product.sku,
                barcode: product.barcode,
                vendor_id: product.vendorId ? parseInt(product.vendorId) : undefined,
                receipt_number: product.receiptNumber,
                attributes: product.attributes,
                variants: product.variants?.map(v => ({
                    name: v.name,
                    sku: v.sku,
                    barcode: v.barcode,
                    price: v.price,
                    sale_price: v.salePrice,
                    stock: v.stock,
                    attributes: v.attributes,
                })),
                images: product.images,
            })
            await refreshProducts()
        } catch (err: any) {
            console.error("Failed to create product:", err)
            throw new Error(err.response?.data?.message || err.response?.data?.error || err.message || "Failed to create product")
        }
    }

    const updateProduct = async (product: Product) => {
        try {
            await productApi.update(parseInt(product.id), {
                name: product.name,
                description: product.description,
                category_id: product.categoryId ? parseInt(product.categoryId) : undefined,
                location_id: product.locationId ? parseInt(product.locationId) : undefined,
                price: product.price,
                sale_price: product.salePrice,
                stock: product.stock,
                published: product.published,
                sku: product.sku,
                barcode: product.barcode,
                vendor_id: product.vendorId ? parseInt(product.vendorId) : undefined,
                receipt_number: product.receiptNumber,
                attributes: product.attributes,
                variants: product.variants?.map(v => {
                    const numericId = parseInt(v.id)
                    return {
                        ...(isNaN(numericId) ? {} : { id: numericId }),
                        name: v.name,
                        sku: v.sku,
                        barcode: v.barcode,
                        price: v.price,
                        sale_price: v.salePrice,
                        stock: v.stock,
                        attributes: v.attributes,
                    }
                }),
                images: product.images,
                delete_images: product.delete_images,
                keep_images: product.keep_images,
            })
            await refreshProducts()
        } catch (err: any) {
            console.error("Failed to update product:", err)
            throw new Error(err.response?.data?.message || err.response?.data?.error || err.message || "Failed to update product")
        }
    }

    const deleteProduct = async (id: string) => {
        try {
            await productApi.delete(parseInt(id))
            setProducts(prev => prev.filter(p => p.id !== id))
        } catch (err: any) {
            console.error("Failed to delete product:", err)
            throw new Error(err.response?.data?.error || "Failed to delete product")
        }
    }

    const getProductsByVendor = (vendorId: string) => {
        return products.filter(p => p.vendorId === vendorId)
    }

    const deductStock = (cartItems: { productId: string; variantId?: string; quantity: number }[], warehouseId: string) => {
        setProducts(prevProducts =>
            prevProducts.map(product => {
                const cartItem = cartItems.find(item => item.productId === product.id)
                if (!cartItem) return product

                if (cartItem.variantId && product.variants) {
                    const updatedVariants = product.variants.map(variant => {
                        if (variant.id !== cartItem.variantId) return variant
                        const inventory = variant.inventory || []
                        const whIndex = inventory.findIndex(i => i.warehouseId === warehouseId)
                        let newInventory = [...inventory]
                        if (whIndex > -1) {
                            newInventory[whIndex] = {
                                ...newInventory[whIndex],
                                quantity: Math.max(0, newInventory[whIndex].quantity - cartItem.quantity),
                            }
                        }
                        const totalStock = newInventory.reduce((acc, curr) => acc + curr.quantity, 0)
                        return { ...variant, inventory: newInventory, stock: totalStock }
                    })
                    const productTotalStock = updatedVariants.reduce((acc, v) => acc + v.stock, 0)
                    return { ...product, variants: updatedVariants, stock: productTotalStock }
                } else {
                    const inventory = product.inventory || []
                    const whIndex = inventory.findIndex(i => i.warehouseId === warehouseId)
                    let newInventory = [...inventory]
                    if (whIndex > -1) {
                        newInventory[whIndex] = {
                            ...newInventory[whIndex],
                            quantity: Math.max(0, newInventory[whIndex].quantity - cartItem.quantity),
                        }
                    }
                    const totalStock = newInventory.reduce((acc, curr) => acc + curr.quantity, 0)
                    return { ...product, inventory: newInventory, stock: totalStock }
                }
            })
        )
    }

    return (
        <ProductContext.Provider
            value={{
                products,
                isLoading,
                error,
                addProduct,
                updateProduct,
                deleteProduct,
                getProductsByVendor,
                deductStock,
                refreshProducts,
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
