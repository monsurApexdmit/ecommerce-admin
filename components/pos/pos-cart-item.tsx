"use client"

import { Minus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

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
    return (
        <div className="flex items-center gap-3 p-3 bg-white border rounded-lg group hover:border-emerald-200 transition-colors">
            <div className="w-16 h-16 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                <img
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    className="w-full h-full object-cover"
                />
            </div>

            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 truncate" title={item.name}>
                    {item.name}
                </h4>
                {item.variantName && (
                    <p className="text-xs text-gray-500 truncate">{item.variantName}</p>
                )}
                <p className="text-sm font-semibold text-emerald-600">
                    ${item.price.toFixed(2)}
                </p>
            </div>

            <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-2">
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6 rounded-full"
                        onClick={(e) => {
                            e.stopPropagation()
                            onVerifyQuantity(item.id, -1)
                        }}
                    >
                        <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-4 text-center text-sm font-medium">{item.quantity}</span>
                    <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6 rounded-full"
                        onClick={(e) => {
                            e.stopPropagation()
                            onVerifyQuantity(item.id, 1)
                        }}
                    >
                        <Plus className="h-3 w-3" />
                    </Button>
                </div>
                <button
                    onClick={() => onRemove(item.id)}
                    className="text-red-500 hover:text-red-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}
