"use client"

import { Minus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useCompanySettings } from "@/contexts/company-settings-context"

interface CartItem {
    id: string
    name: string
    price: number
    image: string
    quantity: number
    variantName?: string
}

interface PosCartItemProps {
    item: CartItem
    onVerifyQuantity: (id: string, delta: number) => void
    onRemove: (id: string) => void
}

export function PosCartItem({ item, onVerifyQuantity, onRemove }: PosCartItemProps) {
    const { formatCurrency } = useCompanySettings()

    return (
        <div className="flex gap-2.5 p-2.5 bg-white border rounded-lg group hover:border-emerald-200 transition-colors">
            {/* Image */}
            <div className="w-12 h-12 bg-gray-100 rounded-md overflow-hidden shrink-0 mt-0.5">
                <img
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    className="w-full h-full object-cover"
                />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                {/* Title row */}
                <div className="flex items-start justify-between gap-2">
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <h4 className="text-sm font-medium text-gray-900 truncate min-w-0 cursor-default leading-tight">
                                    {item.name}
                                </h4>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-xs break-words">
                                {item.name}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <button
                        onClick={() => onRemove(item.id)}
                        className="text-red-400 hover:text-red-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Variant */}
                {item.variantName && (
                    <p className="text-xs text-gray-400 truncate">{item.variantName}</p>
                )}

                {/* Price + Qty controls */}
                <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-emerald-600">
                        {formatCurrency(item.price)}
                    </p>
                    <div className="flex items-center gap-1">
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6 rounded-full shrink-0"
                            onClick={(e) => { e.stopPropagation(); onVerifyQuantity(item.id, -1) }}
                        >
                            <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-6 w-6 rounded-full shrink-0"
                            onClick={(e) => { e.stopPropagation(); onVerifyQuantity(item.id, 1) }}
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
