"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import type { Product } from "@/contexts/product-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export interface PosTint {
    bg: string
    fg: string
}

interface PosProductCardProps {
    product: Product
    /** Units still available to add (stock minus what is already in the cart) */
    available: number
    inCartQty: number
    tint: PosTint
    onAddToCart: (product: Product) => void
    compact?: boolean
    /** Low-stock threshold (product reorder point, 5 when unset) */
    lowAt?: number
}

const applyOffer = (base: number, offer?: number | null, type?: string | null) => {
    if (!offer) return base
    return Math.max(0, type === "percentage" ? base * (1 - offer / 100) : base - offer)
}

export function productUnitPrice(product: Product): number {
    return applyOffer(product.salePrice || product.price || 0, product.offerPrice, product.offerType)
}

/** Price of one variant (variant offer first, then the product's). */
export function variantUnitPrice(product: Product, v: NonNullable<Product["variants"]>[number]): number {
    const base = v.salePrice || v.price || product.salePrice || product.price || 0
    return applyOffer(base, v.offerPrice ?? product.offerPrice, v.offerType ?? product.offerType)
}

/** Lowest price shown on the card; reads "From ৳X" only when variant prices differ. */
export function cardPrice(product: Product): { price: number; from: boolean } {
    const vs = product.variants ?? []
    if (vs.length === 0) return { price: productUnitPrice(product), from: false }
    const prices = vs.map((v) => variantUnitPrice(product, v))
    const min = Math.min(...prices)
    // "From" only when variants are priced differently
    return { price: min, from: Math.max(...prices) - min > 0.005 }
}

export function stockPill(available: number, lowAt = 5): { text: string; short: string; variant: "destructive" | "secondary" | "outline"; tone: string } {
    if (available <= 0) return { text: "Out of stock", short: "Out", variant: "destructive", tone: "text-destructive" }
    if (available <= lowAt) return { text: `Only ${available} left`, short: `${available} left`, variant: "secondary", tone: "text-foreground" }
    return { text: `${available} in stock`, short: `${available} left`, variant: "outline", tone: "text-muted-foreground" }
}

export function PosProductCard({ product, available, inCartQty, tint, onAddToCart, compact, lowAt }: PosProductCardProps) {
    const { formatCurrency } = useCompanySettings()
    const [imgFailed, setImgFailed] = useState(false)
    const out = available <= 0
    const pill = stockPill(available, lowAt)
    const cp = cardPrice(product)
    const price = `${cp.from ? "From " : ""}${formatCurrency(cp.price)}`
    const original = product.salePrice || product.price || 0
    const offerNote = !(product.variants?.length) && cp.price < original - 0.005 ? `Offer · was ${formatCurrency(original)}` : ""
    const hasImage = !!product.image && product.image !== "/placeholder.svg" && !imgFailed

    return (
        <Button
            type="button"
            variant={inCartQty > 0 ? "secondary" : "outline"}
            onClick={() => !out && onAddToCart(product)}
            disabled={out}
            aria-label={`Add ${product.name}, ${price}`}
            className={cn(
                "relative h-auto w-full min-w-0 flex-col items-stretch overflow-hidden whitespace-normal text-left",
                compact ? "min-h-[88px] justify-between gap-1.5" : "justify-start gap-2.5",
            )}
        >
            {compact ? (
                <>
                    <span className="pr-6 text-sm font-semibold leading-snug">{product.name}</span>
                    <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                        <span className="whitespace-nowrap font-bold tabular-nums">{price}</span>
                        <span className={cn("whitespace-nowrap text-xs font-semibold", pill.tone)}>{pill.short}</span>
                    </span>
                </>
            ) : (
                <>
                    <span
                        className="flex h-24 items-center justify-center overflow-hidden rounded-[10px]"
                        style={{ background: tint.bg, color: tint.fg }}
                    >
                        {hasImage ? (
                            <img
                                src={product.image}
                                alt=""
                                className="h-full w-full object-contain p-2"
                                onError={() => setImgFailed(true)}
                            />
                        ) : (
                            <Package className="size-8" strokeWidth={1.6} aria-hidden />
                        )}
                    </span>
                    <span className="flex flex-col gap-0.5">
                        <span className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</span>
                        <span className="text-xs text-muted-foreground">{product.sku || "—"}</span>
                    </span>
                    <span className="mt-auto flex min-w-0 flex-col items-start gap-1.5">
                        <span className="flex min-w-0 max-w-full items-baseline gap-1 whitespace-nowrap">
                            {cp.from && <span className="text-xs font-medium text-muted-foreground">From</span>}
                            <span className="truncate text-lg font-bold tabular-nums">{formatCurrency(cp.price)}</span>
                        </span>
                        {offerNote && <span className="text-xs font-semibold text-muted-foreground">{offerNote}</span>}
                        <Badge variant={pill.variant} className="max-w-full">{pill.text}</Badge>
                    </span>
                </>
            )}
            {inCartQty > 0 && (
                <Badge className="absolute right-2 top-2 h-6 min-w-6 rounded-full px-1.5 tabular-nums">
                    ×{inCartQty}
                </Badge>
            )}
        </Button>
    )
}
