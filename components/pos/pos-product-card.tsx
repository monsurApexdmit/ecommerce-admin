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
            className={`overflow-hidden cursor-pointer group transition-all duration-200 h-full flex flex-col rounded-2xl border-border bg-card hover:-translate-y-1 hover:shadow-xl hover:border-brand/50 ${isOutOfStock ? 'opacity-75' : ''}`}
            onClick={() => !isOutOfStock && onAddToCart(product)}
        >
            <div
                className={`relative w-full overflow-hidden bg-gradient-to-b from-muted/80 to-card ${large ? 'h-[160px]' : 'h-[110px]'}`}
            >
                {/* Soft radial glow behind the product (mockup) */}
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-2/3 opacity-70"
                    style={{ background: "radial-gradient(120px 90px at 50% 38%, var(--brand-soft), transparent 70%)" }}
                    aria-hidden
                />
                <img
                    src={product.image || "/placeholder.svg"}
                    alt={product.name}
                    className={`relative w-full h-full object-contain p-3 drop-shadow-md transition-transform duration-300 group-hover:scale-110 ${isOutOfStock ? 'grayscale' : ''}`}
                />
                {/* Stock pill (mockup) */}
                {!isOutOfStock && (
                    <span className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm ${
                        product.stock <= 10
                            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                            : 'bg-money-soft text-money-fg'
                    }`}>
                        <span className={`size-1.5 rounded-full ${product.stock <= 10 ? 'bg-amber-500' : 'bg-money'}`} />
                        {product.stock <= 10 ? `Low · ${product.stock}` : 'In stock'}
                    </span>
                )}
                {/* Category tag (mockup) */}
                {product.category && (
                    <span className="absolute top-2 right-2 rounded-full bg-background/60 backdrop-blur-sm px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {product.category}
                    </span>
                )}
                {isOutOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                        <span className="bg-background/90 text-foreground text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded shadow-sm">
                            Out of Stock
                        </span>
                    </div>
                )}
            </div>
            <div className={`flex flex-col flex-1 gap-1.5 ${large ? 'p-3' : 'p-2.5'}`}>
                <h3 className={`font-medium text-foreground leading-snug line-clamp-2 ${large ? 'text-sm' : 'text-xs'}`} title={product.name}>
                    {product.name}
                </h3>
                {product.sku && (
                    <p className="text-[11px] text-muted-foreground -mt-0.5">SKU · {product.sku}</p>
                )}
                <div className="mt-auto pt-1.5">
                    <div className="flex items-center justify-between">
                        <p className={`font-bold text-money-fg ${large ? 'text-base' : 'text-sm'}`}>
                            {formatCurrency(product.salePrice || product.price || 0)}
                            <span className="text-[11px] font-normal text-muted-foreground"> /unit</span>
                        </p>
                        <div className="size-9 rounded-xl bg-brand text-brand-foreground flex items-center justify-center shadow-md shadow-brand/30 transition-transform group-hover:scale-110 active:scale-90">
                            <Plus className="size-[18px]" />
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    )
}
