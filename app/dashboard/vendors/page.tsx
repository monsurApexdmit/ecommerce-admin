"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Banknote, ClipboardList, Clock, Download, Pencil, Plus, Search, Trash2, Truck, Upload, Wallet } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import vendorApi, {
  type VendorOverviewRow, type VendorOverviewStats, type VendorProfile, type CreateVendorData,
} from "@/lib/vendorApi"
import { exportToCSV, parseCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Tab = "all" | "Active" | "owe" | "Inactive" | "Blocked"
type Sort = "purchased" | "owed" | "name" | "recent"
type Panel = "profile" | "form"

const SORTS: { value: Sort; label: string }[] = [
  { value: "purchased", label: "Sort: Most purchased" },
  { value: "owed", label: "Sort: Most owed" },
  { value: "name", label: "Sort: Name A–Z" },
  { value: "recent", label: "Sort: Recently added" },
]

const TERMS = ["Pay on delivery", "Net 7 days", "Net 15 days", "Net 30 days", "Advance"]
const PAY_TO = ["Bank transfer", "bKash merchant", "Nagad", "Cash"]
const DISTRICTS = ["Dhaka", "Narayanganj", "Gazipur", "Chattogram"]
const COUNTRIES = ["Bangladesh", "India", "China", "Other"]
const PAY_METHODS = ["Cash", "Bank transfer", "bKash", "Nagad"]

const PO_STATUS: Record<string, string> = { draft: "Draft", sent: "Ordered", partial: "Partly received", received: "Received", cancelled: "Cancelled" }
const PAY_LABEL: Record<string, string> = { paid: "paid", partial: "partly paid", pending: "unpaid", unpaid: "unpaid" }

interface FormState {
  name: string; contactPerson: string; phone: string; email: string; address: string
  district: string; country: string; paymentTerms: string; leadTimeDays: string
  openingBalance: string; tin: string; payTo: string; accountNumber: string
  description: string; notes: string; status: string
}
const EMPTY_FORM: FormState = {
  name: "", contactPerson: "", phone: "", email: "", address: "", district: "", country: "",
  paymentTerms: "", leadTimeDays: "", openingBalance: "", tin: "", payTo: "", accountNumber: "",
  description: "", notes: "", status: "Active",
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"

const statusChip = (s: string) =>
  s === "Active" ? "bg-dash-success-soft text-dash-success-fg" : s === "Blocked" ? "bg-dash-danger-soft text-dash-danger-fg" : "bg-dash-neutral-soft text-dash-neutral-fg"

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-dash-muted">{hint}</span>}
    </label>
  )
}

export default function SuppliersPage() {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const blocked = useModuleGuard("Vendors")

  const [rows, setRows] = useState<VendorOverviewRow[]>([])
  const [stats, setStats] = useState<VendorOverviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<Sort>("purchased")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [profile, setProfile] = useState<VendorProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [panel, setPanel] = useState<Panel>("profile")

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("Cash")
  const [payNote, setPayNote] = useState("")
  const [payError, setPayError] = useState("")
  const [paying, setPaying] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<VendorOverviewRow | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await vendorApi.getOverview({ limit: 500, sort: "recent" })
      setRows(res.data)
      setStats(res.stats)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const loadProfile = useCallback(async (id: number) => {
    setProfileLoading(true)
    try {
      setProfile(await vendorApi.getProfile(id))
    } catch {
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const select = (id: number) => {
    setSelectedId(id)
    setPanel("profile")
    setPayOpen(false)
    loadProfile(id)
  }

  // First supplier opens in the panel by default; ?supplier=ID deep-links to one
  useEffect(() => {
    if (selectedId !== null || rows.length === 0) return
    const fromUrl = Number(searchParams.get("supplier"))
    const target = rows.find((r) => r.id === fromUrl) ?? rows[0]
    select(target.id)
  }, [rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async (id = selectedId) => {
    await load()
    if (id) await loadProfile(id)
  }

  const counts = {
    all: rows.length,
    Active: rows.filter((r) => r.status === "Active").length,
    owe: rows.filter((r) => r.owed > 0.005).length,
    Inactive: rows.filter((r) => r.status === "Inactive").length,
    Blocked: rows.filter((r) => r.status === "Blocked").length,
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows.filter((r) => {
      if (tab === "owe") { if (r.owed <= 0.005) return false }
      else if (tab !== "all" && r.status !== tab) return false
      if (!q) return true
      return [r.name, r.contactPerson, r.phone, r.email, r.description, r.tin].some((v) => (v ?? "").toLowerCase().includes(q))
    })
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name)
      if (sort === "owed") return b.owed - a.owed
      if (sort === "recent") return b.id - a.id
      return b.purchased - a.purchased || a.name.localeCompare(b.name)
    })
    return list
  }, [rows, tab, search, sort])

  const pageRows = visible.slice((page - 1) * perPage, page * perPage)

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setFormError(""); setPanel("form") }
  const openEdit = (r: VendorOverviewRow) => {
    setForm({
      name: r.name ?? "", contactPerson: r.contactPerson ?? "", phone: r.phone ?? "", email: r.email ?? "",
      address: r.address ?? "", district: r.district ?? "", country: r.country ?? "",
      paymentTerms: r.paymentTerms ?? "", leadTimeDays: r.leadTimeDays ? String(r.leadTimeDays) : "",
      openingBalance: r.openingBalance ? String(r.openingBalance) : "", tin: r.tin ?? "", payTo: r.payTo ?? "",
      accountNumber: r.accountNumber ?? "", description: r.description ?? "", notes: r.notes ?? "", status: r.status || "Active",
    })
    setEditingId(r.id); setFormError(""); setPanel("form")
  }
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (!form.name.trim()) { setFormError("Supplier name is required."); return }
    const dupe = rows.find((r) => r.id !== editingId && r.name.trim().toLowerCase() === form.name.trim().toLowerCase())
    if (dupe) { setFormError(`A supplier named "${dupe.name}" already exists.`); return }
    if (form.leadTimeDays !== "" && (!Number.isInteger(Number(form.leadTimeDays)) || Number(form.leadTimeDays) < 0)) { setFormError("Lead time must be a whole number of days, zero or more."); return }
    if (form.openingBalance !== "" && !(Number(form.openingBalance) >= 0)) { setFormError("Opening balance cannot be negative."); return }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) { setFormError("Enter a valid email address."); return }
    const body: CreateVendorData = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      district: form.district,
      country: form.country,
      paymentTerms: form.paymentTerms,
      leadTimeDays: form.leadTimeDays === "" ? undefined : Number(form.leadTimeDays),
      openingBalance: form.openingBalance === "" ? 0 : Number(form.openingBalance),
      tin: form.tin.trim(),
      payTo: form.payTo,
      accountNumber: form.accountNumber.trim(),
      description: form.description.trim(),
      notes: form.notes.trim(),
      status: form.status,
    }
    setSaving(true)
    setFormError("")
    try {
      if (editingId) {
        await vendorApi.update(editingId, body)
        toast({ title: "Supplier updated", description: body.name })
        await refresh(editingId)
        setPanel("profile")
      } else {
        const res = await vendorApi.create(body)
        toast({ title: "Supplier added", description: body.name })
        await load()
        select(res.data.id)
      }
    } catch (e: any) {
      setFormError(e?.response?.data?.message || "Could not save the supplier.")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (r: VendorOverviewRow) => {
    // Active -> Inactive; Inactive or Blocked -> Active
    const next = r.status === "Active" ? "Inactive" : "Active"
    try {
      await vendorApi.update(r.id, { status: next })
      await refresh(r.id === selectedId ? r.id : selectedId)
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not change status", description: e?.response?.data?.message })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await vendorApi.delete(deleteTarget.id)
      toast({ title: "Supplier deleted", description: deleteTarget.name })
      const wasSelected = deleteTarget.id === selectedId
      setDeleteTarget(null)
      if (wasSelected) { setSelectedId(null); setProfile(null) }
      await load()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not delete", description: e?.response?.data?.message })
      setDeleteTarget(null)
    }
  }

  const savePayment = async () => {
    if (!selectedId || !profile) return
    const amount = Number(payAmount)
    if (!(amount > 0)) { setPayError("Enter an amount above zero."); return }
    if (amount > profile.owed + 0.005) { setPayError(`You only owe ${formatCurrency(profile.owed)} to this supplier.`); return }
    setPaying(true); setPayError("")
    try {
      setProfile(await vendorApi.recordPayment(selectedId, { amount, method: payMethod, note: payNote.trim() || undefined }))
      await load()
      toast({ title: "Payment recorded", description: formatCurrency(amount) })
      setPayOpen(false); setPayAmount(""); setPayNote("")
    } catch (e: any) {
      setPayError(e?.response?.data?.message || "Could not record the payment.")
    } finally {
      setPaying(false)
    }
  }

  const CSV_COLS = ["name", "contactPerson", "phone", "email", "address", "district", "country", "paymentTerms", "leadTimeDays", "openingBalance", "tin", "payTo", "accountNumber", "description", "notes", "status", "purchased", "owed"]

  const handleExport = () => {
    const data = visible.map((r) => ({
      name: r.name, contactPerson: r.contactPerson ?? "", phone: r.phone ?? "", email: r.email ?? "",
      address: r.address ?? "", district: r.district ?? "", country: r.country ?? "", paymentTerms: r.paymentTerms ?? "",
      leadTimeDays: r.leadTimeDays ?? "", openingBalance: r.openingBalance ?? 0, tin: r.tin ?? "", payTo: r.payTo ?? "",
      accountNumber: r.accountNumber ?? "", description: r.description ?? "", notes: r.notes ?? "", status: r.status,
      purchased: r.purchased, owed: r.owed,
    }))
    exportToCSV(data, "suppliers", CSV_COLS)
    toast({ title: `Exported ${data.length} suppliers` })
  }

  const handleImport = () => {
    const el = document.createElement("input")
    el.type = "file"
    el.accept = ".csv"
    el.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const parsed = parseCSV(ev.target?.result as string)
          const seen = new Set(rows.map((r) => r.name.trim().toLowerCase()))
          let created = 0, skipped = 0, failed = 0
          for (const row of parsed) {
            const name = row.name?.trim()
            if (!name) continue
            if (seen.has(name.toLowerCase())) { skipped++; continue }
            const lead = row.leadTimeDays?.trim()
            const open = row.openingBalance?.trim()
            if ((lead && !(Number(lead) >= 0)) || (open && !(Number(open) >= 0))) { failed++; continue }
            const st = ["Active", "Inactive", "Blocked"].find((x) => x.toLowerCase() === (row.status ?? "").trim().toLowerCase())
            try {
              await vendorApi.create({
                name, contactPerson: row.contactPerson, phone: row.phone, email: row.email, address: row.address,
                district: row.district, country: row.country, paymentTerms: row.paymentTerms,
                leadTimeDays: lead ? Math.round(Number(lead)) : undefined, openingBalance: open ? Number(open) : 0,
                tin: row.tin, payTo: row.payTo, accountNumber: row.accountNumber,
                description: row.description, notes: row.notes, status: st ?? "Active",
              })
              seen.add(name.toLowerCase())
              created++
            } catch { failed++ }
          }
          toast({
            title: `Imported ${created} supplier${created === 1 ? "" : "s"}`,
            description: [skipped && `${skipped} duplicate${skipped === 1 ? "" : "s"} skipped`, failed && `${failed} row${failed === 1 ? "" : "s"} rejected`].filter(Boolean).join(", ") || undefined,
          })
          load()
        } catch {
          toast({ variant: "destructive", title: "Could not read the CSV file" })
        }
      }
      reader.readAsText(file)
    }
    el.click()
  }

  if (blocked) return blocked

  const poHref = (id?: number) => `/dashboard/vendors/purchase-orders?new=1${id ? `&vendorId=${id}` : ""}`
  const owedSuppliers = stats?.owedSuppliers ?? 0
  const selectedRow = rows.find((r) => r.id === selectedId)
  const place = (r: { district?: string | null; country?: string | null }) => [r.district, r.country].filter(Boolean).join(", ")

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Suppliers</h1>
          <p className="mt-1 text-sm text-dash-muted">Who you buy from, what you owe them, and what is on order.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleImport} className={outlineBtn}><Upload className="size-4" aria-hidden /> Import</button>
          <button type="button" onClick={handleExport} className={outlineBtn}><Download className="size-4" aria-hidden /> Export</button>
          <Link href={poHref()} className={outlineBtn}>New purchase order</Link>
          <button type="button" onClick={openNew} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">
            <Plus className="size-4" aria-hidden /> Add supplier
          </button>
        </div>
      </div>

      {/* Owe banner */}
      {stats && stats.totalOwed > 0 && (
        <div className="flex flex-wrap items-center gap-3.5 rounded-xl bg-dash-danger-soft px-[18px] py-3.5 text-dash-danger-fg">
          <Clock className="size-[22px] shrink-0" aria-hidden />
          <span className="min-w-[260px] flex-1 text-sm">
            <strong>You owe {owedSuppliers === 1 ? (rows.find((r) => r.owed > 0.005)?.name ?? "1 supplier") : `${owedSuppliers} suppliers`} {formatCurrency(stats.totalOwed)}.</strong>
            {stats.oldestOverdue
              ? ` ${stats.oldestOverdue.poNumber} was expected on ${new Date(stats.oldestOverdue.expectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} and is still unpaid.`
              : " No purchase order is past its expected date."}
          </span>
          <Link href="/dashboard/vendors/purchase-orders" className="inline-flex h-10 items-center rounded-[10px] bg-dash-danger-fg px-3.5 text-[13px] font-semibold text-dash-danger-soft">
            Open purchase order
          </Link>
        </div>
      )}

      {/* KPIs */}
      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[118px] rounded-[14px]" />)}
        </div>
      ) : (
        <StatsCards stats={[
          { label: "Suppliers", value: stats.total, icon: <Truck className="size-4" />, color: "blue", hint: `${stats.active} active · ${stats.blocked} blocked` },
          { label: "You owe suppliers", value: formatCurrency(stats.totalOwed), icon: <Clock className="size-4" />, color: "red",
            hint: `${stats.owedSuppliers} supplier${stats.owedSuppliers === 1 ? "" : "s"} · ${stats.overdueSuppliers} overdue`,
            onClick: () => { setTab("owe"); setPage(1) }, active: tab === "owe" },
          { label: "Total purchased", value: formatCurrency(stats.totalPurchased), icon: <Banknote className="size-4" />, color: "green",
            hint: `${stats.poCount} purchase order${stats.poCount === 1 ? "" : "s"} · ${stats.openPos} open` },
          { label: "Paid to suppliers", value: formatCurrency(stats.totalPaid), icon: <Wallet className="size-4" />, color: "green",
            hint: `${stats.paymentCount} payment${stats.paymentCount === 1 ? "" : "s"}` },
          { label: "Open purchase orders", value: stats.openPos, icon: <ClipboardList className="size-4" />, color: "yellow",
            hint: `${stats.draftPos} draft · ${stats.orderedPos} ordered` },
          { label: "Avg lead time", value: stats.avgLeadDays ? `${Math.round(stats.avgLeadDays)} days` : "—", icon: <Truck className="size-4" />, color: "purple",
            hint: "Order to delivery" },
        ]} />
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        {/* List */}
        <section className="w-full min-w-0 flex-1 rounded-[14px] border border-dash-border bg-dash-card">
          <div className="px-4">
            <StatusTabs
              value={tab}
              onChange={(t) => { setTab(t as Tab); setPage(1) }}
              tabs={[
                { value: "all", label: "All", count: counts.all },
                { value: "Active", label: "Active", count: counts.Active },
                { value: "owe", label: "You owe", count: counts.owe },
                { value: "Inactive", label: "Inactive", count: counts.Inactive },
                { value: "Blocked", label: "Blocked", count: counts.Blocked },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
              <Search className="size-[18px]" aria-hidden />
              <span className="sr-only">Search suppliers</span>
              <input
                type="search"
                placeholder="Search supplier, contact, phone, TIN/BIN or description…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted"
              />
            </label>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger aria-label="Sort" className="h-11 w-[200px] rounded-[10px] border-dash-border bg-dash-card text-[13px] font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>{SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                  <th scope="col" className="py-3 pl-4 pr-2 font-semibold">Supplier</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Contact</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Supplies</th>
                  <th scope="col" className="px-2 py-3 text-right font-semibold">Purchased</th>
                  <th scope="col" className="px-2 py-3 text-right font-semibold">You owe</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Terms</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Active</th>
                  <th scope="col" className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>)
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-14 text-center">
                      <Truck className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                      <p className="font-semibold">No suppliers found</p>
                      <p className="text-sm text-dash-muted">{search || tab !== "all" ? "Try clearing the search or tab." : "Add your first supplier to start buying stock."}</p>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const sel = r.id === selectedId
                    return (
                      <tr key={r.id} className={sel ? "bg-dash-accent-soft/40" : ""}>
                        <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                          <button type="button" onClick={() => select(r.id)} className="flex items-center gap-2.5 text-left">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-dash-accent-soft text-xs font-bold text-dash-accent-fg">{initials(r.name)}</span>
                            <span className="flex flex-col">
                              <span className="font-semibold">
                                {r.name}
                                {r.status !== "Active" && <span className={cn("ml-1.5 rounded-full px-2 py-px text-[11px] font-bold", statusChip(r.status))}>{r.status}</span>}
                              </span>
                              <span className="text-xs text-dash-muted">{place(r) || "—"}</span>
                            </span>
                          </button>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <div>{r.contactPerson || "—"}</div>
                          <div className="text-xs text-dash-muted">{[r.phone, r.email].filter(Boolean).join(" · ") || "—"}</div>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <div className="max-w-[200px] truncate">{r.itemsSummary || "—"}</div>
                          <div className="text-xs text-dash-muted">Lead time {r.leadTimeDays ? `${r.leadTimeDays} days` : "—"}</div>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3 text-right font-semibold tabular-nums">
                          {formatCurrency(r.purchased)}
                          <div className="text-xs font-normal text-dash-muted">{r.poCount} PO{r.poCount === 1 ? "" : "s"}</div>
                        </td>
                        <td className={cn("border-b border-dash-border-soft px-2 py-3 text-right font-bold tabular-nums", r.owed > 0.005 ? "text-dash-danger-fg" : "text-dash-muted")}>
                          {formatCurrency(r.owed)}
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          {r.paymentTerms ? <span className="rounded-md bg-dash-neutral-soft px-2 py-[3px] text-xs font-semibold text-dash-neutral-fg">{r.paymentTerms}</span> : <span className="text-dash-muted">—</span>}
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <button
                            type="button" role="switch" aria-checked={r.status === "Active"} aria-label={`${r.name} active`}
                            onClick={() => toggleActive(r)}
                            className={cn("flex h-5 w-9 items-center rounded-full p-0.5 transition-colors disabled:opacity-40", r.status === "Active" ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}
                          >
                            <span className="size-4 rounded-full bg-white" />
                          </button>
                        </td>
                        <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={poHref(r.id)} className="mr-1 text-[13px] font-semibold text-dash-accent hover:underline">New PO</Link>
                            <button type="button" aria-label={`Record payment to ${r.name}`} className={iconBtn}
                              onClick={() => { select(r.id); setPayOpen(true) }}><Banknote className="size-4" /></button>
                            <button type="button" aria-label={`Edit ${r.name}`} className={iconBtn} onClick={() => openEdit(r)}><Pencil className="size-4" /></button>
                            <button type="button" aria-label={`Delete ${r.name}`} className={iconBtn} onClick={() => setDeleteTarget(r)}><Trash2 className="size-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && visible.length > 0 && (
            <div className="border-t border-dash-border-soft p-4 pt-3">
              <PaginationControl
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(visible.length / perPage))}
                itemsPerPage={perPage}
                totalItems={visible.length}
                onPageChange={setPage}
                onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
              />
            </div>
          )}
          <div className="border-t border-dash-border-soft px-4 py-3 text-xs text-dash-muted">Showing {visible.length} supplier{visible.length === 1 ? "" : "s"}</div>
        </section>

        {/* Side panel */}
        <aside aria-label="Supplier" className="w-full shrink-0 rounded-[14px] border border-dash-border bg-dash-card p-4 xl:w-[400px]">
          <div role="tablist" aria-label="Panel" className="mb-4 flex gap-1 rounded-xl bg-dash-neutral-soft p-1">
            {([["profile", "Supplier details"], ["form", editingId ? "Edit supplier" : "+ New supplier"]] as const).map(([id, label]) => (
              <button
                key={id} type="button" role="tab" aria-selected={panel === id}
                onClick={() => (id === "form" && panel !== "form" ? openNew() : setPanel("profile"))}
                className={cn("h-10 flex-1 rounded-[9px] text-[13px] font-semibold", panel === id ? "bg-dash-card shadow-sm" : "text-dash-muted hover:text-dash-ink")}
              >
                {label}
              </button>
            ))}
          </div>

          {panel === "profile" ? (
            profileLoading && !profile ? (
              <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
            ) : !profile || !selectedRow ? (
              <p className="py-10 text-center text-sm text-dash-muted">{rows.length ? "Pick a supplier to see their details." : "No suppliers yet. Add one with the New supplier tab."}</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-dash-accent-soft text-lg font-bold text-dash-accent-fg">{initials(profile.vendor.name)}</span>
                  <div className="min-w-0">
                    <h2 className="font-dash-display text-lg font-bold leading-tight">
                      {profile.vendor.name}{" "}
                      <span className={cn("rounded-full px-2 py-px align-middle text-[11px] font-bold", statusChip(profile.vendor.status))}>{profile.vendor.status}</span>
                    </h2>
                    <span className="text-[13px] text-dash-muted">{place(profile.vendor) || "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["Purchased", formatCurrency(profile.purchased), ""],
                    ["Open POs", String(profile.openPos), ""],
                    ["You owe", formatCurrency(profile.owed), profile.owed > 0.005 ? "bg-dash-danger-soft text-dash-danger-fg" : ""],
                    ["Total paid", formatCurrency(profile.totalPaid), ""],
                    ["Products", String(profile.productCount), ""],
                    ["Stock value", formatCurrency(profile.stockValue), ""],
                  ].map(([l, v, cls]) => (
                    <div key={l} className={cn("rounded-[10px] bg-dash-neutral-soft px-2.5 py-2", cls)}>
                      <div className="text-[11px] opacity-80">{l}</div>
                      <div className="text-[15px] font-bold tabular-nums">{v}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Link href={poHref(profile.vendor.id)} className="flex h-11 flex-1 items-center justify-center rounded-[10px] bg-dash-accent text-[13px] font-semibold text-white">New purchase order</Link>
                  <button type="button" onClick={() => { setPayOpen((v) => !v); setPayError("") }} className={cn(outlineBtn, "flex-1")}>Pay supplier</button>
                </div>

                {payOpen && (
                  <div className="flex flex-col gap-2.5 rounded-xl border border-dash-border bg-dash-bg p-3.5">
                    <div className="text-sm font-bold">Record payment to {profile.vendor.name}</div>
                    {payError && <p role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{payError}</p>}
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="Amount"><input type="number" min="0" step="any" className={input} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" /></Field>
                      <Field label="Method">
                        <select className={input} value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                          {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label="Note"><input type="text" className={input} value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Optional" /></Field>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setPayOpen(false)} className={outlineBtn}>Cancel</button>
                      <button type="button" disabled={paying} onClick={savePayment} className="h-11 rounded-[10px] bg-dash-accent px-4 text-[13px] font-semibold text-white disabled:opacity-40">{paying ? "Saving…" : "Save payment"}</button>
                    </div>
                  </div>
                )}

                <dl className="flex flex-col gap-2 border-t border-dash-border-soft pt-3 text-[13px]">
                  {([
                    ["Supplies", selectedRow.itemsSummary],
                    ["Contact", profile.vendor.contactPerson],
                    ["Phone", profile.vendor.phone],
                    ["Email", profile.vendor.email],
                    ["Address", [profile.vendor.address, place(profile.vendor)].filter(Boolean).join(", ")],
                    ["Payment terms", profile.vendor.paymentTerms || "Not set"],
                    ["Pay to", [profile.vendor.payTo, profile.vendor.accountNumber].filter(Boolean).join(" · ")],
                    ["TIN / BIN", profile.vendor.tin],
                    ["Opening balance", profile.vendor.openingBalance ? formatCurrency(profile.vendor.openingBalance) : ""],
                    ["Description", profile.vendor.description],
                    ["Supplier since", (profile.vendor.createdAt || profile.vendor.created_at) ? new Date((profile.vendor.createdAt || profile.vendor.created_at) as string).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""],
                  ] as [string, string | null | undefined][]).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="shrink-0 text-dash-muted">{k}</dt>
                      <dd className="text-right font-semibold">{v || "—"}</dd>
                    </div>
                  ))}
                </dl>

                <section className="border-t border-dash-border-soft pt-3">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Recent purchase orders</h3>
                  {profile.recentPurchaseOrders.length === 0 ? <p className="text-[13px] text-dash-muted">No purchase orders yet.</p> : (
                    <div className="flex flex-col">
                      {profile.recentPurchaseOrders.map((o) => (
                        <Link key={o.id} href="/dashboard/vendors/purchase-orders" className="flex items-start justify-between gap-3 border-b border-dash-border-soft py-2 last:border-0 hover:bg-dash-neutral-soft">
                          <span className="flex min-w-0 flex-col">
                            <span className="text-[13px] font-bold">{o.poNumber}</span>
                            <span className="truncate text-xs text-dash-muted">{o.itemsSummary || "—"}</span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end">
                            <span className="text-[13px] font-bold tabular-nums">{formatCurrency(o.total)}</span>
                            <span className={cn("text-xs font-semibold", o.isOverdue ? "text-dash-danger-fg" : o.paymentStatus === "paid" ? "text-dash-success-fg" : "text-dash-muted")}>
                              {PO_STATUS[o.status] ?? o.status} · {o.isOverdue ? "overdue" : PAY_LABEL[o.paymentStatus] ?? o.paymentStatus}
                            </span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>

                <section className="border-t border-dash-border-soft pt-3">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Products supplied</h3>
                  {profile.products.length === 0 ? <p className="text-[13px] text-dash-muted">No products ordered from this supplier yet.</p> : (
                    <div className="flex flex-col">
                      {profile.products.map((g) => (
                        <div key={g.productId} className="flex items-start justify-between gap-3 border-b border-dash-border-soft py-2 last:border-0">
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[13px] font-semibold">{g.name}</span>
                            <span className="text-xs text-dash-muted">Last cost {formatCurrency(g.lastCost)}</span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end">
                            <span className="text-[13px] font-semibold tabular-nums">{g.stock} in stock</span>
                            <span className="text-xs text-dash-muted tabular-nums">{formatCurrency(g.stockValue)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="border-t border-dash-border-soft pt-3">
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Payments made</h3>
                  {profile.payments.length === 0 ? <p className="text-[13px] text-dash-muted">No payments recorded yet.</p> : (
                    <div className="flex flex-col">
                      {profile.payments.map((y) => (
                        <div key={y.id} className="flex items-start justify-between gap-3 border-b border-dash-border-soft py-2 last:border-0">
                          <span className="flex flex-col">
                            <span className="text-[13px] font-semibold">{new Date(y.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            <span className="text-xs text-dash-muted">{[y.method, y.poNumber, y.note].filter(Boolean).join(" · ")}</span>
                          </span>
                          <span className="text-[13px] font-bold tabular-nums">{formatCurrency(y.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3.5">
              <div>
                <h2 className="font-dash-display text-lg font-bold">{editingId ? "Edit supplier" : "New supplier"}</h2>
                <p className="text-[13px] text-dash-muted">Only the name is required.</p>
                {formError && <p role="alert" className="mt-2 rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{formError}</p>}
              </div>
              <Field label="Supplier / company name *"><input className={input} value={form.name} onChange={set("name")} placeholder="e.g. Dhaka Textiles Ltd." /></Field>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Contact person"><input className={input} value={form.contactPerson} onChange={set("contactPerson")} placeholder="e.g. Md. Rafiq" /></Field>
                <Field label="Phone">
                  <span className="flex h-[42px] items-center overflow-hidden rounded-[10px] border border-dash-border bg-dash-card focus-within:border-dash-accent">
                    <span className="border-r border-dash-border px-2.5 text-sm text-dash-muted">+880</span>
                    <input type="tel" className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm font-normal outline-none" value={form.phone} onChange={set("phone")} placeholder="17XX-XXXXXX" />
                  </span>
                </Field>
              </div>
              <Field label="Email"><input type="email" className={input} value={form.email} onChange={set("email")} placeholder="supplier@example.com" /></Field>
              <Field label="Address"><input className={input} value={form.address} onChange={set("address")} placeholder="Street, area" /></Field>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="District">
                  <select className={input} value={form.district} onChange={set("district")}><option value="">—</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select>
                </Field>
                <Field label="Country">
                  <select className={input} value={form.country} onChange={set("country")}><option value="">—</option>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select>
                </Field>
              </div>
              <details className="rounded-xl border border-dash-border-soft">
                <summary className="cursor-pointer px-3.5 py-3 text-[13px] font-bold">Payment &amp; terms</summary>
                <div className="flex flex-col gap-3 px-3.5 pb-3.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Payment terms">
                      <select className={input} value={form.paymentTerms} onChange={set("paymentTerms")}><option value="">Not set</option>{TERMS.map((t) => <option key={t}>{t}</option>)}</select>
                    </Field>
                    <Field label="Lead time (days)"><input type="number" min="0" step="1" className={input} value={form.leadTimeDays} onChange={set("leadTimeDays")} placeholder="e.g. 5" /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="Opening balance (৳ you owe)"><input type="number" min="0" className={input} value={form.openingBalance} onChange={set("openingBalance")} placeholder="0.00" /></Field>
                    <Field label="TIN / BIN"><input className={input} value={form.tin} onChange={set("tin")} placeholder="Optional" /></Field>
                  </div>
                  <Field label="Pay to">
                    <select className={input} value={form.payTo} onChange={set("payTo")}><option value="">—</option>{PAY_TO.map((p) => <option key={p}>{p}</option>)}</select>
                  </Field>
                  <Field label="Account / wallet number"><input className={input} value={form.accountNumber} onChange={set("accountNumber")} placeholder="e.g. 01XXXXXXXXX" /></Field>
                </div>
              </details>
              <Field label="Description"><input className={input} value={form.description} onChange={set("description")} placeholder="What they supply, in a line" /></Field>
              <Field label="Notes">
                <textarea rows={2} className={cn(input, "h-auto py-2.5")} value={form.notes} onChange={set("notes")} placeholder="Minimum order, delivery days…" />
              </Field>
              <Field label="Status" hint="Only active suppliers can be picked on new purchase orders.">
                <select className={input} value={form.status} onChange={set("status")}><option>Active</option><option>Inactive</option><option>Blocked</option></select>
              </Field>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPanel("profile")} className={outlineBtn}>Cancel</button>
                <button type="button" disabled={saving} onClick={save} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add supplier"}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The supplier is removed from your list. Past purchase orders stay on record.
            </AlertDialogDescription>
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
