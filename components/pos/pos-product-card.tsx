"use client"

import { Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { Product } from "@/contexts/product-context"
import { useCompanySettings } from "@/contexts/company-settings-context"

interface PosProductCardProps {
    product: Product
    onAddToCart: (product: Product) => void
    large?: boolean
}

export function PosProductCard({ product, onAddToCart, large }: PosProductCardProps) {
    const { formatCurrency } = useCompanySettings()
    const isOutOfStock = product.stock <= 0

    return (
        <Card
            className={`overflow-hidden cursor-pointer group hover:shadow-md hover:ring-1 hover:ring-emerald-500 transition-all h-full flex flex-col ${isOutOfStock ? 'opacity-75' : ''}`}
            onClick={() => !isOutOfStock && onAddToCart(product)}
        >
            <div className={`relative w-full bg-gray-100 overflow-hidden ${large ? 'h-[160px]' : 'h-[100px]'}`}>
                <img
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${isOutOfStock ? 'grayscale' : ''}`}
                />
                {isOutOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                        <span className="bg-white/90 text-gray-800 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded shadow-sm">
                            Out of Stock
                        </span>
                    </div>
                )}
            </div>
            <div className={`flex flex-col flex-1 gap-1.5 ${large ? 'p-3' : 'p-2.5'}`}>
                <h3 className={`font-medium text-gray-700 leading-snug line-clamp-2 min-h-[2.5em] ${large ? 'text-sm' : 'text-xs'}`} title={product.name}>
                    {product.name}
                </h3>
                <div className="mt-auto pt-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <p className={`font-bold text-emerald-600 ${large ? 'text-base' : 'text-sm'}`}>
                            {formatCurrency(product.salePrice || product.price || 0)}
                        </p>
                        <div className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        Stock: <span className={product.stock > 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>
                            {product.stock}
                        </span>
                    </p>
                </div>
            </div>
        </Card>
    )
}
