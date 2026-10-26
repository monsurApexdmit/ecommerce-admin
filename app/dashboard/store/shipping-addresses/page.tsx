"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import shippingAddressApi, { type AddressType, type ShippingAddressResponse } from "@/lib/shippingAddressApi"
import { customerApi, type CustomerResponse } from "@/lib/customerApi"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const TYPE_LABEL: Record<string, string> = { home: "Home", office: "Office", other: "Other" }

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft disabled:opacity-50"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft disabled:opacity-50"
const label = "flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold"

interface Form {
  customerId: string
  fullName: string
  phone: string
  email: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
  addressType: AddressType
}
const blank: Form = { customerId: "", fullName: "", phone: "", email: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "Bangladesh", isDefault: false, addressType: "home" }

const toForm = (a: ShippingAddressResponse): Form => ({
  customerId: a.customerId ? String(a.customerId) : "",
  fullName: a.fullName || "", phone: a.phone || "", email: a.email || "",
  addressLine1: a.addressLine1 || "", addressLine2: a.addressLine2 || "",
  city: a.city || "", state: a.state || "", postalCode: a.postalCode || "",
  country: a.country || "Bangladesh", isDefault: !!a.isDefault, addressType: (a.addressType as AddressType) || "home",
})

function validate(f: Form) {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!f.fullName.trim()) e.fullName = "Full name is required."
  const ph = f.phone.trim()
  const digits = ph.replace(/\D/g, "")
  if (!ph) e.phone = "Phone is required."
  else if (!/^\+?[0-9][0-9\s\-]{6,18}$/.test(ph) || digits.length < 7 || digits.length > 15) e.phone = "Enter a valid phone number (7-15 digits)."
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address."
  if (!f.addressLine1.trim()) e.addressLine1 = "Address line 1 is required."
  if (!f.city.trim()) e.city = "City is required."
  if (!f.state.trim()) e.state = "State/Division is required."
  const pc = f.postalCode.trim()
  if (!pc) e.postalCode = "Postal code is required."
  else if (!/^[A-Za-z0-9][A-Za-z0-9\- ]{2,9}$/.test(pc)) e.postalCode = "Enter a valid postal code (3-10 letters/digits)."
  return e
}

export default function ShippingAddressesPage() {
  const blocked = useModuleGuard("Shipping Addresses")
  const { toast } = useToast()

  const [rows, setRows] = useState<ShippingAddressResponse[]>([])
  const [customers, setCustomers] = useState<CustomerResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [typeF, setTypeF] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [sel, setSel] = useState<Record<number, boolean>>({})

  const [dlg, setDlg] = useState<{ id: number | null } | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const [errs, setErrs] = useState<Partial<Record<keyof Form, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteIds, setDeleteIds] = useState<number[] | null>(null)

  const load = useCallback(async () => {
    try {
      setRows(await shippingAddressApi.getAll())
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to load shipping addresses", description: e?.response?.data?.message })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
    customerApi.getAll({ limit: 200 }).then((r) => setCustomers(r.data)).catch(() => {})
  }, [load])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((a) => {
      const hit = !ql || [a.fullName, a.addressLine1, a.city, a.customerName].some((v) => String(v || "").toLowerCase().includes(ql)) || String(a.phone || "").includes(q.trim())
      return hit && (typeF === "all" || a.addressType === typeF)
    })
  }, [rows, q, typeF])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const cur = Math.min(page, totalPages)
  const pageRows = filtered.slice((cur - 1) * perPage, cur * perPage)
  const selIds = Object.keys(sel).map(Number).filter((id) => sel[id] && rows.some((r) => r.id === id))
  const allSel = pageRows.length > 0 && pageRows.every((a) => sel[a.id])

  if (blocked) return blocked

  const setF = (p: Partial<Form>) => {
    setForm((f) => ({ ...f, ...p }))
    setErrs((e) => ({ ...e, ...Object.fromEntries(Object.keys(p).map((k) => [k, ""])) }))
  }
  const openNew = () => { setDlg({ id: null }); setForm(blank); setErrs({}) }
  const openEdit = (a: ShippingAddressResponse) => { setDlg({ id: a.id }); setForm(toForm(a)); setErrs({}) }
  const closeDlg = () => { setDlg(null); setErrs({}) }

  const pickCustomer = (id: string) => {
    const c = customers.find((x) => String(x.id) === id)
    const p: Partial<Form> = { customerId: id }
    if (c) {
      if (!form.fullName.trim()) p.fullName = c.name || ""
      if (!form.phone.trim()) p.phone = c.phone || ""
      if (!form.email.trim()) p.email = c.email || ""
    }
    setF(p)
  }

  const save = async () => {
    const e = validate(form)
    if (Object.keys(e).length) {
      setErrs(e)
      toast({ variant: "destructive", title: "Please fix the highlighted fields" })
      return
    }
    const body = {
      customerId: form.customerId ? Number(form.customerId) : null,
      fullName: form.fullName.trim(), phone: form.phone.trim(), email: form.email.trim(),
      addressLine1: form.addressLine1.trim(), addressLine2: form.addressLine2.trim(),
      city: form.city.trim(), state: form.state.trim(), postalCode: form.postalCode.trim(),
      country: form.country.trim() || "Bangladesh", isDefault: form.isDefault, addressType: form.addressType,
    }
    setSaving(true)
    try {
      if (dlg?.id) await shippingAddressApi.update(dlg.id, body)
      else await shippingAddressApi.create(body)
      toast({ title: dlg?.id ? "Address updated" : "Address added" })
      closeDlg()
      await load()
    } catch (err: any) {
      const fe = err?.response?.data?.errors
      if (fe) {
        const next: Partial<Record<keyof Form, string>> = {}
        for (const [k, v] of Object.entries(fe)) next[k as keyof Form] = (v as string[])[0]
        setErrs(next)
      }
      toast({ variant: "destructive", title: "Could not save address", description: (fe && (Object.values(fe)[0] as string[])[0]) || err?.response?.data?.message })
    } finally {
      setSaving(false)
    }
  }

  const makeDefault = async (a: ShippingAddressResponse) => {
    try {
      await shippingAddressApi.setDefault(a.id)
      toast({ title: "Default address updated" })
      await load()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not set default", description: e?.response?.data?.message })
    }
  }

  const confirmDelete = async () => {
    const ids = deleteIds ?? []
    setDeleteIds(null)
    const results = await Promise.allSettled(ids.map((id) => shippingAddressApi.delete(id)))
    const failed = results.filter((r) => r.status === "rejected").length
    setSel({})
    if (failed) toast({ variant: "destructive", title: `${failed} address(es) could not be deleted` })
    else toast({ title: ids.length > 1 ? `${ids.length} addresses deleted` : "Address deleted" })
    await load()
  }

  const exportCsv = () => {
    if (!filtered.length) return toast({ variant: "destructive", title: "Nothing to export" })
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const head = ["Full name", "Customer", "Phone", "Email", "Address line 1", "Address line 2", "City", "State/Division", "Postal code", "Country", "Type", "Default"]
    const lines = [head.map(esc).join(",")].concat(
      filtered.map((a) => [a.fullName, a.customerName || "", a.phone, a.email || "", a.addressLine1, a.addressLine2 || "", a.city, a.state, a.postalCode, a.country, a.addressType, a.isDefault ? "Yes" : "No"].map(esc).join(",")),
    )
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "shipping-addresses.csv"
    link.click()
    URL.revokeObjectURL(url)
    toast({ title: `Exported ${filtered.length} address(es)` })
  }

  const err = (k: keyof Form) => (errs[k] ? <span role="alert" className="text-xs font-normal text-dash-danger-fg">{errs[k]}</span> : null)
  const field = (lbl: string, key: keyof Omit<Form, "isDefault" | "addressType" | "customerId">, placeholder = "") => (
    <label className={label}>
      {lbl}
      <input type="text" className={cn(input, errs[key] && "border-dash-danger-fg")} value={form[key]} placeholder={placeholder} onChange={(e) => setF({ [key]: e.target.value })} />
      {err(key)}
    </label>
  )

  const th = "px-2 py-3 font-semibold"
  const td = "border-b border-dash-border-soft px-2 py-3 align-top"

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Shipping Addresses</h1>
          <p className="mt-1 text-sm text-dash-muted">Manage customer shipping addresses for order fulfillment</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={outlineBtn} onClick={exportCsv}><Download className="size-4" />Export CSV</button>
          <button type="button" className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white" onClick={openNew}><Plus className="size-4" />Add Address</button>
        </div>
      </div>

      <section className="rounded-[14px] border border-dash-border bg-dash-card">
        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden />
            <span className="sr-only">Search</span>
            <input type="search" placeholder="Search by name, address, city, or phone..." value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          <select aria-label="Address type" className={cn(input, "h-11 w-[160px]")} value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(1) }}>
            <option value="all">All Types</option>
            <option value="home">Home</option>
            <option value="office">Office</option>
            <option value="other">Other</option>
          </select>
          {selIds.length > 0 && (
            <button type="button" className={cn(outlineBtn, "text-dash-danger-fg")} onClick={() => setDeleteIds(selIds)}><Trash2 className="size-4" />Delete ({selIds.length})</button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                <th scope="col" className="w-10 py-3 pl-4 pr-2">
                  <input type="checkbox" aria-label="Select all" checked={allSel}
                    onChange={() => setSel((s) => { const n = { ...s }; pageRows.forEach((a) => { if (allSel) delete n[a.id]; else n[a.id] = true }); return n })} />
                </th>
                <th scope="col" className={th}>Customer / Full Name</th>
                <th scope="col" className={th}>Address</th>
                <th scope="col" className={th}>Phone</th>
                <th scope="col" className={th}>Type</th>
                <th scope="col" className={th}>Status</th>
                <th scope="col" className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>)
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <MapPin className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                    <p className="font-semibold">No addresses found</p>
                    <p className="text-sm text-dash-muted">{q || typeF !== "all" ? "Try adjusting your search or filter" : "Get started by adding a new shipping address"}</p>
                  </td>
                </tr>
              ) : (
                pageRows.map((a) => (
                  <tr key={a.id}>
                    <td className="border-b border-dash-border-soft py-3 pl-4 pr-2 align-top">
                      <input type="checkbox" aria-label={`Select ${a.fullName}`} checked={!!sel[a.id]} onChange={() => setSel((s) => ({ ...s, [a.id]: !s[a.id] }))} />
                    </td>
                    <td className={td}>
                      <div className="font-semibold">{a.fullName}</div>
                      <div className="text-xs text-dash-muted">{a.customerName || ""}</div>
                    </td>
                    <td className={td}>
                      <div>{a.addressLine1}</div>
                      {a.addressLine2 && <div className="text-xs text-dash-muted">{a.addressLine2}</div>}
                      <div className="text-xs text-dash-muted">{[a.city, a.state].filter(Boolean).join(", ")} {a.postalCode || ""}</div>
                    </td>
                    <td className={td}>
                      <div>{a.phone}</div>
                      <div className="text-xs text-dash-muted">{a.email || ""}</div>
                    </td>
                    <td className={td}>
                      <span className="rounded-md bg-dash-neutral-soft px-2 py-[3px] text-xs font-semibold text-dash-neutral-fg">{TYPE_LABEL[a.addressType || "other"] || "Other"}</span>
                    </td>
                    <td className={td}>
                      <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", a.isDefault ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-neutral-soft text-dash-neutral-fg")}>{a.isDefault ? "Default" : "Standard"}</span>
                    </td>
                    <td className="border-b border-dash-border-soft py-3 pl-2 pr-4 align-top">
                      <div className="flex items-center justify-end gap-1">
                        {!a.isDefault && (
                          <button type="button" className="mr-1 text-[13px] font-semibold text-dash-accent hover:underline" onClick={() => makeDefault(a)}>Set as Default</button>
                        )}
                        <button type="button" aria-label={`Edit ${a.fullName}`} className={iconBtn} onClick={() => openEdit(a)}><Pencil className="size-4" /></button>
                        <button type="button" aria-label={`Delete ${a.fullName}`} className={iconBtn} onClick={() => setDeleteIds([a.id])}><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="border-t border-dash-border-soft p-4 pt-3">
            <PaginationControl currentPage={cur} totalPages={totalPages} itemsPerPage={perPage} totalItems={filtered.length}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
          </div>
        )}
      </section>

      <Dialog open={!!dlg} onOpenChange={(o) => !o && closeDlg()}>
        <DialogContent className={`${bricolage.variable} ${instrument.variable} font-dash-body max-h-[92vh] overflow-y-auto text-dash-ink sm:max-w-[680px]`}>
          <DialogHeader>
            <DialogTitle className="font-dash-display text-xl font-bold">{dlg?.id ? "Edit Shipping Address" : "Add Shipping Address"}</DialogTitle>
            <DialogDescription>{dlg?.id ? "Update the address details below" : "Enter the address details below"}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={cn(label, "sm:col-span-2")}>
              Customer
              <select className={cn(input, "px-2.5")} value={form.customerId} onChange={(e) => pickCustomer(e.target.value)}>
                <option value="">No linked customer (guest)</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
              </select>
            </label>
            {field("Full Name *", "fullName", "John Doe")}
            {field("Phone *", "phone", "+8801712345678")}
            <div className="sm:col-span-2">{field("Email", "email", "john@example.com")}</div>
            <div className="sm:col-span-2">{field("Address Line 1 *", "addressLine1", "123 Main Street")}</div>
            <div className="sm:col-span-2">{field("Address Line 2", "addressLine2", "Apartment, suite, etc. (optional)")}</div>
            {field("City *", "city", "Dhaka")}
            {field("State/Division *", "state", "Dhaka Division")}
            {field("Postal Code *", "postalCode", "1205")}
            {field("Country", "country")}
            <label className={label}>
              Address Type
              <select className={cn(input, "px-2.5")} value={form.addressType} onChange={(e) => setF({ addressType: e.target.value as AddressType })}>
                <option value="home">Home</option>
                <option value="office">Office</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-2.5 text-[13px] font-semibold">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setF({ isDefault: e.target.checked })} />
              Set as default address
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={outlineBtn} onClick={closeDlg}>Cancel</button>
            <button type="button" disabled={saving} onClick={save} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-50">
              {saving ? "Saving…" : dlg?.id ? "Update Address" : "Add Address"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteIds} onOpenChange={(o) => !o && setDeleteIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteIds && deleteIds.length > 1 ? `${deleteIds.length} addresses` : "this address"}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
