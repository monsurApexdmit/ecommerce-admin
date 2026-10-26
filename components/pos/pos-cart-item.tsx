"use client"

import { Package, Trash2 } from "lucide-react"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WithTooltip } from "@/components/common/WithTooltip"

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
    const hasImage = !!item.image && item.image !== "/placeholder.svg"

    return (
        <div className="group flex items-center gap-2.5 border-b py-2.5 last:border-b-0">
            <UserAvatar
                src={hasImage ? item.image : null}
                alt=""
                shape="square"
                className="size-10"
                fallback={<Package className="size-[18px]" aria-hidden />}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold" title={item.name}>
                    {item.name}{item.variantName ? ` · ${item.variantName}` : ""}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(item.price)} each{item.wholesale ? " · Wholesale" : ""}</span>
            </div>

            <ButtonGroup aria-label={`Quantity of ${item.name}`}>
                <WithTooltip content={`Decrease ${item.name}`}><Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Decrease ${item.name}`}
                    onClick={() => onVerifyQuantity(item.id, -1)}
                >
                    −
                </Button></WithTooltip>
                <ButtonGroupText className="min-w-9 justify-center px-2 font-bold tabular-nums">{item.quantity}</ButtonGroupText>
                <WithTooltip content={`Increase ${item.name}`}><Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Increase ${item.name}`}
                    onClick={() => onVerifyQuantity(item.id, 1)}
                >
                    +
                </Button></WithTooltip>
            </ButtonGroup>

            <span className="w-[78px] text-right text-sm font-bold tabular-nums">
                {formatCurrency(item.price * item.quantity)}
            </span>

            <WithTooltip content={`Remove ${item.name}`}><Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.name}`}
                onClick={() => onRemove(item.id)}
                className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            >
                <Trash2 className="size-4" />
            </Button></WithTooltip>
        </div>
    )
}
