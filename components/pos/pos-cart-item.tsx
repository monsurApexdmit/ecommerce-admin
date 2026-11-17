"use client"

import { useState, type FormEvent } from "react"
import { Package, Pencil, RotateCcw, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { CURRENCY_SYMBOLS, useCompanySettings } from "@/contexts/company-settings-context"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
    /** Price before any edit (quantity 1, no wholesale) */
    basePrice?: number
    customPrice?: boolean
}

interface PosCartItemProps {
    item: CartItem
    onVerifyQuantity: (id: string, delta: number) => void
    onRemove: (id: string) => void
    /** New unit price, or null to go back to the list price */
    onPriceChange?: (id: string, price: number | null) => void
}

const PRICE_RE = /^\d*(\.\d{0,2})?$/

/** Small popover to set the line's unit price; the cart row keeps its layout. */
function PriceEditor({ item, onPriceChange }: { item: CartItem; onPriceChange: (id: string, price: number | null) => void }) {
    const { t } = useTranslation(["pos", "common"])
    const { formatCurrency, currency } = useCompanySettings()
    const symbol = CURRENCY_SYMBOLS[currency] ?? currency
    const [open, setOpen] = useState(false)
    const [draft, setDraft] = useState("")

    const listPrice = item.basePrice ?? item.price
    const value = draft.trim() === "" || draft === "." ? NaN : Number(draft)
    const valid = Number.isFinite(value) && value >= 0
    const diff = valid ? value - listPrice : 0

    const onOpenChange = (next: boolean) => {
        if (next) setDraft(String(item.price))
        setOpen(next)
    }
    const apply = (e?: FormEvent) => {
        e?.preventDefault()
        if (!valid) return
        if (Math.abs(value - item.price) > 0.004) onPriceChange(item.id, value)
        setOpen(false)
    }
    const reset = () => {
        onPriceChange(item.id, null)
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <WithTooltip content={item.customPrice ? t("pos:cartItem.editedTip", { price: formatCurrency(listPrice) }) : t("pos:cartItem.changePriceTip")}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        aria-label={t("pos:cartItem.editPrice", { name: item.name, price: formatCurrency(item.price) })}
                        className={cn(
                            "-mx-1 inline-flex w-fit max-w-full items-center gap-1 rounded px-1 text-left text-xs tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                            item.customPrice ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground hover:text-foreground",
                        )}
                    >
                        <span className="truncate">{t("pos:cartItem.priceEach", { price: formatCurrency(item.price) })}</span>
                        <Pencil className="size-3 shrink-0 opacity-60" aria-hidden />
                    </button>
                </PopoverTrigger>
            </WithTooltip>
            <PopoverContent align="start" sideOffset={6} className="w-72 p-0">
                <form onSubmit={apply}>
                    <div className="space-y-3 p-4">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">{t("pos:cartItem.sellingPrice")}</p>
                            <p className="truncate text-xs text-muted-foreground" title={item.name}>
                                {item.name}{item.variantName ? ` · ${item.variantName}` : ""}
                            </p>
                        </div>

                        <InputGroup className="h-11">
                            <InputGroupAddon>
                                <InputGroupText className="text-base font-semibold">{symbol}</InputGroupText>
                            </InputGroupAddon>
                            <InputGroupInput
                                autoFocus
                                inputMode="decimal"
                                autoComplete="off"
                                value={draft}
                                onChange={(e) => { if (PRICE_RE.test(e.target.value)) setDraft(e.target.value) }}
                                onFocus={(e) => e.currentTarget.select()}
                                aria-label={t("pos:cartItem.unitPrice", { name: item.name })}
                                aria-invalid={!valid}
                                className="text-lg font-bold tabular-nums"
                            />
                            <InputGroupAddon align="inline-end">
                                <InputGroupText className="text-xs">{t("pos:cartItem.each")}</InputGroupText>
                            </InputGroupAddon>
                        </InputGroup>

                        <dl className="space-y-1 rounded-md bg-muted/60 px-3 py-2 text-xs">
                            <div className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">{t("pos:cartItem.listPrice")}</dt>
                                <dd className="tabular-nums">{formatCurrency(listPrice)}</dd>
                            </div>
                            {valid && Math.abs(diff) > 0.004 && (
                                <div className="flex justify-between gap-2">
                                    <dt className="text-muted-foreground">{diff < 0 ? t("pos:cartItem.belowList") : t("pos:cartItem.aboveList")}</dt>
                                    <dd className={cn("tabular-nums font-medium", diff < 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400")}>
                                        {diff < 0 ? "−" : "+"}{formatCurrency(Math.abs(diff))}
                                    </dd>
                                </div>
                            )}
                            <div className="flex justify-between gap-2 border-t pt-1">
                                <dt className="text-muted-foreground">{t("pos:cartItem.lineTotal", { qty: item.quantity })}</dt>
                                <dd className="font-semibold tabular-nums">{valid ? formatCurrency(value * item.quantity) : "—"}</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="flex items-center gap-2 border-t px-4 py-3">
                        {item.customPrice && (
                            <Button type="button" variant="ghost" size="sm" onClick={reset} className="-ml-2 gap-1.5">
                                <RotateCcw className="size-3.5" aria-hidden /> {t("common:actions.reset")}
                            </Button>
                        )}
                        <div className="ml-auto flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>{t("common:actions.cancel")}</Button>
                            <Button type="submit" size="sm" disabled={!valid}>{t("common:actions.apply")}</Button>
                        </div>
                    </div>
                </form>
            </PopoverContent>
        </Popover>
    )
}

export function PosCartItem({ item, onVerifyQuantity, onRemove, onPriceChange }: PosCartItemProps) {
    const { t } = useTranslation(["pos"])
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
                {onPriceChange ? (
                    <PriceEditor item={item} onPriceChange={onPriceChange} />
                ) : (
                    <span className="text-xs text-muted-foreground tabular-nums">{t("pos:cartItem.priceEach", { price: formatCurrency(item.price) })}</span>
                )}
                {(item.wholesale || item.customPrice) && (
                    <span className={cn("text-[11px] leading-none", item.customPrice ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                        {item.customPrice ? t("pos:cartItem.editedPrice") : t("pos:cartItem.wholesale")}
                    </span>
                )}
            </div>

            <ButtonGroup aria-label={t("pos:cartItem.quantityOf", { name: item.name })}>
                <WithTooltip content={t("pos:cartItem.decrease", { name: item.name })}><Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("pos:cartItem.decrease", { name: item.name })}
                    onClick={() => onVerifyQuantity(item.id, -1)}
                >
                    −
                </Button></WithTooltip>
                <ButtonGroupText className="min-w-9 justify-center px-2 font-bold tabular-nums">{item.quantity}</ButtonGroupText>
                <WithTooltip content={t("pos:cartItem.increase", { name: item.name })}><Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={t("pos:cartItem.increase", { name: item.name })}
                    onClick={() => onVerifyQuantity(item.id, 1)}
                >
                    +
                </Button></WithTooltip>
            </ButtonGroup>

            <span className="w-[78px] text-right text-sm font-bold tabular-nums">
                {formatCurrency(item.price * item.quantity)}
            </span>

            <WithTooltip content={t("pos:cartItem.remove", { name: item.name })}><Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("pos:cartItem.remove", { name: item.name })}
                onClick={() => onRemove(item.id)}
                className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            >
                <Trash2 className="size-4" />
            </Button></WithTooltip>
        </div>
    )
}
