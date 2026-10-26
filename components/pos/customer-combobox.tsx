"use client"

import * as React from "react"
import { Check, ChevronsUpDown, UserPlus } from "lucide-react"
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

// value is customer id string, or "" for walk-in
interface CustomerComboboxProps {
    value: string
    onValueChange: (value: string, name: string) => void
}

export function CustomerCombobox({ value, onValueChange }: CustomerComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const { customers } = useCustomer()

    const selectedLabel = value === ""
        ? "Walk-in Customer"
        : customers.find(c => c.id === value)?.name ?? "Walk-in Customer"

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Select customer"
                    className="h-auto w-full min-w-0 justify-start gap-2.5 py-1.5 text-left"
                >
                    <UserAvatar name={selectedLabel} className="size-[34px]" />
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{selectedLabel}</span>
                        <span className="text-xs text-muted-foreground">Search by name or phone</span>
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search customer..." />
                    <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="walk-in"
                                onSelect={() => {
                                    onValueChange("", "Walk-in Customer")
                                    setOpen(false)
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", value === "" ? "opacity-100" : "opacity-0")} />
                                Walk-in Customer
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
                                Walk-in (no customer)
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
