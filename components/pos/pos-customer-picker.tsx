"use client"

import { useMemo, useRef, useState } from "react"
import { ChevronsUpDown, UserPlus } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useCustomer } from "@/contexts/customer-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

function useLatest<T>(v: T) {
    const r = useRef(v)
    r.current = v
    return r
}

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "WC"

interface Props {
    /** Customer id, "" for walk-in */
    value: string
    onChange: (id: string, name: string) => void
}

/** Customer search popover with a quick "add customer" form, as in the design. */
export function PosCustomerPicker({ value, onChange }: Props) {
    const { customers, addCustomer, refreshCustomers } = useCustomer()
    const { formatCurrency } = useCompanySettings()
    const { toast } = useToast()
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState("")
    const [quick, setQuick] = useState(false)
    const [f, setF] = useState({ name: "", phone: "", email: "" })
    const [err, setErr] = useState("")
    const [saving, setSaving] = useState(false)
    const latest = useLatest(customers)

    const current = customers.find((c) => c.id === value)
    const name = current?.name ?? "Walk-in Customer"
    const sub = current
        ? [current.phone, (current.dueAmount ?? 0) > 0 ? `Due ${formatCurrency(current.dueAmount ?? 0)}` : ""].filter(Boolean).join(" · ") || "Customer"
        : "Search by name or phone"

    const list = useMemo(() => {
        const s = q.trim().toLowerCase()
        return customers
            .filter((c) => !s || c.name.toLowerCase().includes(s) || (c.phone ?? "").toLowerCase().includes(s))
            .slice(0, 50)
    }, [customers, q])

    const save = async () => {
        const n = f.name.trim(), p = f.phone.trim(), e = f.email.trim()
        if (!n) return setErr("Customer name is required.")
        if (!p) return setErr("Phone is required.")
        if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return setErr("Enter a valid email address.")
        if (customers.some((c) => (c.phone ?? "").replace(/\D/g, "") === p.replace(/\D/g, ""))) return setErr("A customer with this phone already exists.")
        setSaving(true)
        try {
            await addCustomer({
                name: n, phone: p, email: e || undefined, address: "", city: "", state: "", zipCode: "", country: "",
                customerType: "retail", status: "active", notes: "", storeCredit: 0,
            } as any)
            // the context refresh runs inside addCustomer; pick the new customer by phone
            const fresh = await refreshAndFind(p)
            if (fresh) onChange(fresh.id, fresh.name)
            toast({ title: "Customer added", description: n })
            setF({ name: "", phone: "", email: "" })
            setQuick(false)
            setErr("")
        } catch (er: any) {
            setErr(er?.message || "Could not add customer")
        } finally {
            setSaving(false)
        }
    }

    // customers state updates asynchronously; look the new one up on the next tick
    const refreshAndFind = async (phone: string) => {
        await refreshCustomers()
        await new Promise((r) => setTimeout(r, 50))
        return latest.current.find((c) => (c.phone ?? "").replace(/\D/g, "") === phone.replace(/\D/g, ""))
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-2">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            role="combobox"
                            aria-expanded={open}
                            aria-label="Select customer"
                            className="flex min-h-[52px] min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-dash-border bg-dash-card px-3 py-1.5 text-left hover:bg-dash-neutral-soft"
                        >
                            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-dash-accent-soft text-xs font-bold text-dash-accent-fg">
                                {initials(name)}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-semibold">{name}</span>
                                <span className="truncate text-xs text-dash-muted">{sub}</span>
                            </span>
                            <ChevronsUpDown className="size-4 shrink-0 text-dash-muted" aria-hidden />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[340px] p-2">
                        <input
                            type="search"
                            autoFocus
                            aria-label="Search customers"
                            placeholder="Search name or phone…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            className="mb-2 h-10 w-full rounded-lg border border-dash-border bg-dash-bg px-3 text-sm outline-none focus-visible:border-dash-accent"
                        />
                        <div role="listbox" className="max-h-[280px] overflow-y-auto">
                            <button
                                type="button"
                                role="option"
                                aria-selected={!value}
                                onClick={() => { onChange("", "Walk-in Customer"); setOpen(false) }}
                                className={cn("flex w-full flex-col rounded-lg px-2.5 py-2 text-left hover:bg-dash-neutral-soft", !value && "bg-dash-accent-soft")}
                            >
                                <span className="text-sm font-semibold">Walk-in Customer</span>
                                <span className="text-xs text-dash-muted">Must be paid in full</span>
                            </button>
                            {list.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    role="option"
                                    aria-selected={c.id === value}
                                    onClick={() => { onChange(c.id, c.name); setOpen(false); setQ("") }}
                                    className={cn("flex w-full flex-col rounded-lg px-2.5 py-2 text-left hover:bg-dash-neutral-soft", c.id === value && "bg-dash-accent-soft")}
                                >
                                    <span className="text-sm font-semibold">{c.name}</span>
                                    <span className="text-xs text-dash-muted">
                                        {[c.phone, (c.dueAmount ?? 0) > 0 ? `Due ${formatCurrency(c.dueAmount ?? 0)}` : ""].filter(Boolean).join(" · ") || "No phone"}
                                    </span>
                                </button>
                            ))}
                            {list.length === 0 && <p className="px-2.5 py-3 text-sm text-dash-muted">No customers match.</p>}
                        </div>
                    </PopoverContent>
                </Popover>
                <button
                    type="button"
                    aria-label="Add new customer"
                    aria-expanded={quick}
                    onClick={() => { setQuick((v) => !v); setErr("") }}
                    className="flex size-[52px] shrink-0 items-center justify-center rounded-xl border border-dash-border bg-dash-card hover:bg-dash-neutral-soft"
                >
                    <UserPlus className="size-[18px]" aria-hidden />
                </button>
            </div>

            {quick && (
                <div className="flex flex-col gap-2 rounded-xl border border-dash-border bg-dash-bg p-3">
                    <input aria-label="Customer name" placeholder="Customer name *" value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setErr("") }}
                        className="h-10 rounded-lg border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent" />
                    <input aria-label="Phone" placeholder="Phone *" value={f.phone} onChange={(e) => { setF({ ...f, phone: e.target.value }); setErr("") }}
                        className="h-10 rounded-lg border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent" />
                    <input aria-label="Email" type="email" placeholder="Email (optional)" value={f.email} onChange={(e) => { setF({ ...f, email: e.target.value }); setErr("") }}
                        className="h-10 rounded-lg border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent" />
                    {err && <span role="alert" className="text-xs font-semibold text-dash-danger-fg">{err}</span>}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setQuick(false)} className="h-9 rounded-lg border border-dash-border bg-dash-card px-3 text-[13px] font-semibold">Cancel</button>
                        <button type="button" onClick={save} disabled={saving} className="h-9 rounded-lg bg-dash-accent px-3 text-[13px] font-semibold text-white disabled:opacity-50">
                            {saving ? "Adding…" : "Add customer"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
