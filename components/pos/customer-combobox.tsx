"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search, UserPlus } from "lucide-react"

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

const customers = [
    {
        value: "walk-in-customer",
        label: "Walk-in Customer",
    },
    {
        value: "john-doe",
        label: "John Doe",
    },
    {
        value: "jane-smith",
        label: "Jane Smith",
    },
    {
        value: "olivia-martin",
        label: "Olivia Martin",
    },
    {
        value: "jackson-lee",
        label: "Jackson Lee",
    },
]

interface CustomerComboboxProps {
    value: string
    onValueChange: (value: string) => void
}

export function CustomerCombobox({ value, onValueChange }: CustomerComboboxProps) {
    const [open, setOpen] = React.useState(false)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-12 bg-white border-gray-200"
                >
                    {value
                        ? customers.find((customer) => customer.value === value)?.label
                        : "Select Customer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search customer..." />
                    <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                            {customers.map((customer) => (
                                <CommandItem
                                    key={customer.value}
                                    value={customer.value}
                                    onSelect={(currentValue) => {
                                        onValueChange(currentValue === value ? "" : currentValue)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === customer.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {customer.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                        <CommandGroup>
                            <CommandItem onSelect={() => console.log('Create new customer')}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Create New Customer
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
