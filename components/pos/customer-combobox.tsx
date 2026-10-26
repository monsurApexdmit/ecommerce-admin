"use client"

import * as React from "react"
import { Check, ChevronsUpDown, UserPlus } from "lucide-react"
import { cn } from "@/lib/utils"
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
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Select customer"
                    className="flex min-h-[52px] w-full min-w-0 items-center gap-2.5 rounded-xl border border-dash-border bg-dash-card px-3 py-1.5 text-left font-dash-body text-dash-ink hover:bg-dash-neutral-soft"
                >
                    <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-dash-accent-soft text-xs font-bold text-dash-accent-fg">
                        {selectedLabel.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{selectedLabel}</span>
                        <span className="text-xs text-dash-muted">Search by name or phone</span>
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 text-dash-muted" aria-hidden />
                </button>
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
                                        {c.phone && <span className="text-xs text-gray-400">{c.phone}</span>}
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
