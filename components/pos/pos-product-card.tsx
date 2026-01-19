"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { Product } from "@/contexts/product-context"

interface PosProductCardProps {
    product: Product
    onAddToCart: (product: Product) => void
}

export function PosProductCard({ product, onAddToCart }: PosProductCardProps) {
    const isOutOfStock = product.stock <= 0

    return (
        <Card
            className={`overflow-hidden cursor-pointer group hover:shadow-md hover:ring-1 hover:ring-emerald-500 transition-all h-full flex flex-col ${isOutOfStock ? 'opacity-75' : ''}`}
            onClick={() => !isOutOfStock && onAddToCart(product)}
        >
            <div className="relative h-[100px] w-full bg-gray-100 overflow-hidden">
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
            <div className="p-2.5 flex flex-col flex-1 gap-1.5">
                <h3 className="font-medium text-gray-700 text-xs leading-snug line-clamp-2 min-h-[2.5em]" title={product.name}>
                    {product.name}
                </h3>
                <div className="mt-auto pt-1 flex items-center justify-between">
                    <p className="font-bold text-emerald-600 text-sm">
                        ${product.salePrice.toFixed(2)}
                    </p>
                    <div className="h-6 w-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-3.5 h-3.5" />
                    </div>
                </div>
            </div>
        </Card>
    )
}
