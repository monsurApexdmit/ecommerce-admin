"use client"

import * as React from "react"
import { Check, ChevronsUpDown, UserPlus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useCustomer } from "@/contexts/customer-context"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WALK_IN_NAME } from "@/components/pos/pos-customer-picker"

// value is customer id string, or "" for walk-in
interface CustomerComboboxProps {
    value: string
    onValueChange: (value: string, name: string) => void
}

export function CustomerCombobox({ value, onValueChange }: CustomerComboboxProps) {
    const { t } = useTranslation(["pos"])
    const [open, setOpen] = React.useState(false)
    const { customers } = useCustomer()

    const selectedLabel = value === ""
        ? t("pos:walkIn")
        : customers.find(c => c.id === value)?.name ?? t("pos:walkIn")

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label={t("pos:customer.select")}
                    className="h-auto w-full min-w-0 justify-start gap-2.5 py-1.5 text-left"
                >
                    <UserAvatar name={selectedLabel} className="size-[34px]" />
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{selectedLabel}</span>
                        <span className="truncate text-xs text-muted-foreground">{t("pos:customer.searchHint")}</span>
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={t("pos:customer.comboSearch")} />
                    <CommandList>
                        <CommandEmpty>{t("pos:customer.comboEmpty")}</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="walk-in"
                                keywords={[t("pos:walkIn")]}
                                onSelect={() => {
                                    onValueChange("", WALK_IN_NAME)
                                    setOpen(false)
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", value === "" ? "opacity-100" : "opacity-0")} />
                                {t("pos:walkIn")}
                            </CommandItem>
                            {customers.map(c => (
                                <CommandItem
                                    key={c.id}
                                    value={c.name}
                                    onSelect={() => {
                                        onValueChange(c.id === value ? "" : c.id, c.name)
                                        setOpen(false)
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                                    <div className="flex flex-col">
                                        <span className="font-medium">{c.name}</span>
                                        {c.phone && <span className="text-xs text-muted-foreground">{c.phone}</span>}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                            <CommandItem onSelect={() => setOpen(false)}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                {t("pos:customer.walkInNone")}
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
