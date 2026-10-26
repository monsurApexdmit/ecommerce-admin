"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import type { Product } from "@/contexts/product-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { cn } from "@/lib/utils"

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

/** Lowest price shown on the card; products with variants read "From ৳X". */
export function cardPrice(product: Product): { price: number; from: boolean } {
    const vs = product.variants ?? []
    if (vs.length === 0) return { price: productUnitPrice(product), from: false }
    const prices = vs.map((v) => variantUnitPrice(product, v))
    return { price: Math.min(...prices), from: vs.length > 1 }
}

export function stockPill(available: number, lowAt = 5) {
    if (available <= 0) return { text: "Out of stock", short: "Out", cls: "bg-dash-danger-soft text-dash-danger-fg" }
    if (available <= lowAt) return { text: `Only ${available} left`, short: `${available} left`, cls: "bg-dash-warn-soft text-dash-warn-fg" }
    return { text: `${available} in stock`, short: `${available} left`, cls: "bg-dash-neutral-soft text-dash-neutral-fg" }
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
        <button
            type="button"
            onClick={() => !out && onAddToCart(product)}
            disabled={out}
            aria-label={`Add ${product.name}, ${price}`}
            className={cn(
                "relative flex flex-col text-left font-dash-body text-dash-ink transition-colors",
                compact ? "min-h-[88px] justify-between gap-1.5 rounded-xl px-3 py-2.5" : "gap-2.5 rounded-[14px] p-2.5",
                inCartQty > 0 ? "border-2 border-dash-accent" : "border border-dash-border hover:border-dash-accent/50",
                out ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            )}
            style={{ background: compact && !out ? tint.bg : "var(--dash-card)" }}
        >
            {compact ? (
                <>
                    <span className="pr-6 text-[13px] font-semibold leading-snug">{product.name}</span>
                    <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[15px] font-bold tabular-nums">{price}</span>
                        <span className={cn("text-[11px] font-semibold", pill.cls.split(" ")[1])}>{pill.short}</span>
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
                        <span className="text-xs text-dash-muted">{product.sku || "—"}</span>
                    </span>
                    <span className="flex items-center justify-between gap-1.5">
                        <span className="flex flex-col">
                            <span className="font-dash-display text-[17px] font-bold tabular-nums">{price}</span>
                            {offerNote && <span className="text-[11px] font-semibold text-dash-success-fg">{offerNote}</span>}
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", pill.cls)}>{pill.text}</span>
                    </span>
                </>
            )}
            {inCartQty > 0 && (
                <span className="absolute right-2 top-2 flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-dash-accent px-1.5 text-xs font-bold text-white">
                    ×{inCartQty}
                </span>
            )}
        </button>
    )
}
