"use client"

import { useState } from "react"
import { Package, Trash2 } from "lucide-react"
import { useCompanySettings } from "@/contexts/company-settings-context"

interface CartItem {
    id: string
    name: string
    price: number
    image: string
    quantity: number
    variantName?: string
    wholesale?: boolean
}

interface PosCartItemProps {
    item: CartItem
    onVerifyQuantity: (id: string, delta: number) => void
    onRemove: (id: string) => void
}

export function PosCartItem({ item, onVerifyQuantity, onRemove }: PosCartItemProps) {
    const { formatCurrency } = useCompanySettings()
    const [imgFailed, setImgFailed] = useState(false)
    const hasImage = !!item.image && item.image !== "/placeholder.svg" && !imgFailed

    return (
        <div className="group flex items-center gap-2.5 border-b border-dash-border-soft py-2.5 font-dash-body last:border-b-0">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-dash-neutral-soft text-dash-neutral-fg">
                {hasImage ? (
                    <img src={item.image} alt="" className="size-full object-cover" onError={() => setImgFailed(true)} />
                ) : (
                    <Package className="size-[18px]" aria-hidden />
                )}
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold text-dash-ink" title={item.name}>
                    {item.name}{item.variantName ? ` · ${item.variantName}` : ""}
                </span>
                <span className="text-xs text-dash-muted tabular-nums">{formatCurrency(item.price)} each{item.wholesale ? " · Wholesale" : ""}</span>
            </div>

            <div className="flex items-center rounded-[10px] border border-dash-border">
                <button
                    type="button"
                    aria-label={`Decrease ${item.name}`}
                    onClick={() => onVerifyQuantity(item.id, -1)}
                    className="h-9 w-[34px] text-lg text-dash-ink hover:bg-dash-neutral-soft"
                >
                    −
                </button>
                <span className="min-w-6 text-center text-sm font-bold tabular-nums text-dash-ink">{item.quantity}</span>
                <button
                    type="button"
                    aria-label={`Increase ${item.name}`}
                    onClick={() => onVerifyQuantity(item.id, 1)}
                    className="h-9 w-[34px] text-lg text-dash-ink hover:bg-dash-neutral-soft"
                >
                    +
                </button>
            </div>

            <span className="w-[78px] text-right text-sm font-bold tabular-nums text-dash-ink">
                {formatCurrency(item.price * item.quantity)}
            </span>

            <button
                type="button"
                aria-label={`Remove ${item.name}`}
                onClick={() => onRemove(item.id)}
                className="shrink-0 rounded-md p-1 text-dash-muted opacity-0 transition-opacity hover:text-dash-danger focus-visible:opacity-100 group-hover:opacity-100"
            >
                <Trash2 className="size-4" />
            </button>
        </div>
    )
}
