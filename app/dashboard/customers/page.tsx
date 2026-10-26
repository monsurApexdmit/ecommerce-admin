"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle, Download, MoreHorizontal, Phone, Plus, RotateCcw, Search, Upload, Users, X, Banknote, Clock,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog"
import { customerApi, type CustomerResponse, type DuplicateGroup, type CustomerListParams } from "@/lib/customerApi"
import { MergeDialog } from "@/components/customers/merge-dialog"
import { GetPaymentForm } from "@/components/customers/get-payment-form"
import { parseCSVRows, toCSV, downloadCSV } from "@/components/customers/csv"
import { useCustomer } from "@/contexts/customer-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Tab = "all" | "inactive" | "loyal" | "risk" | "due" | "never" | "dup"
type Stats = Awaited<ReturnType<typeof customerApi.getStats>>

const GROUP_STYLE: Record<string, { label: string; cls: string }> = {
  retail: { label: "Retail", cls: "bg-dash-neutral-soft text-dash-neutral-fg" },
  wholesale: { label: "Wholesale", cls: "bg-dash-accent-soft text-dash-accent-fg" },
  vip: { label: "VIP", cls: "bg-dash-warn-soft text-dash-warn-fg" },
}

const groupOf = (c: CustomerResponse) => c.customerGroup ?? c.customerType ?? "retail"
const hasSms = (c: CustomerResponse) =>
  c.smsOptIn !== false && c.status !== "inactive" && (c.phone ?? "").replace(/\D/g, "").length >= 7

const AVATAR = [
  "bg-dash-accent-soft text-dash-accent-fg",
  "bg-dash-success-soft text-dash-success-fg",
  "bg-dash-warn-soft text-dash-warn-fg",
  "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
]

const STATUS_CHIP: Record<string, string> = {
  Pending: "text-dash-warn-fg",
  Processing: "text-dash-accent-fg",
  Delivered: "text-dash-success-fg",
}

const iconBtn =
  "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const filterSelect = "h-11 rounded-[10px] border-dash-border bg-dash-card text-[13px] font-semibold"

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase() || "?"
const daysSince = (iso?: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null)

function segmentOf(c: CustomerResponse): { text: string; cls: string } {
  const orders = c.totalOrders ?? 0
  const days = daysSince(c.lastOrderAt)
  if (orders === 0) return { text: "No orders yet", cls: "text-dash-muted" }
  if (days !== null && days > 30) return { text: "At risk · 30+ days", cls: "text-dash-warn-fg" }
  if (orders >= 5) return { text: "Loyal", cls: "text-dash-success-fg" }
  return { text: "Active", cls: "text-dash-accent-fg" }
}

export default function CustomersPage() {
  const { formatCurrency } = useCompanySettings()
  const { deleteCustomer, refreshCustomers } = useCustomer()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [customers, setCustomers] = useState<CustomerResponse[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [groupFilter, setGroupFilter] = useState("all")
  const [sort, setSort] = useState("recent")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [hideDupBanner, setHideDupBanner] = useState(false)

  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [openId, setOpenId] = useState<number | null>(null)
  const [detail, setDetail] = useState<CustomerResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeGroups, setMergeGroups] = useState<DuplicateGroup[]>([])
  const [mergeLoading, setMergeLoading] = useState(false)
  const [mergeTitle, setMergeTitle] = useState("Review & merge duplicates")
  const [tagOpen, setTagOpen] = useState(false)
  const [tagDraft, setTagDraft] = useState("")

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerResponse | null>(null)
  const [deleteTargets, setDeleteTargets] = useState<CustomerResponse[]>([])
  const [deleting, setDeleting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const blocked = useModuleGuard("Customers")

  const { canDo } = useSaasAuth()

  const mayExport = canDo("export")

  useEffect(() => {
    const q = searchParams.get("customer") ?? searchParams.get("q") ?? searchParams.get("search")
    if (q) { setSearch(q); setPage(1) }
  }, [searchParams])

  const filterParams = useCallback((): CustomerListParams => ({
    sort,
    ...(search ? { search } : {}),
    ...(tab === "inactive" ? { status: "inactive" } : tab !== "all" ? { segment: tab } : {}),
    ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    ...(groupFilter !== "all" ? { group: groupFilter } : {}),
  }), [sort, search, tab, typeFilter, groupFilter])

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await customerApi.getAll({ page, limit: perPage, ...filterParams() })
      setCustomers(res.data ?? [])
      setTotal(res.total ?? 0)
    } catch {
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }, [page, perPage, filterParams])

  const fetchStats = useCallback(() => {
    customerApi.getStats().then(setStats).catch(() => {})
  }, [])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])
  useEffect(() => { fetchStats() }, [fetchStats])

  // Keep a customer open in the side panel; default to the first row
  useEffect(() => {
    if (customers.length === 0) { setOpenId(null); return }
    if (!customers.some((c) => c.id === openId)) setOpenId(customers[0].id)
  }, [customers, openId])

  const open = customers.find((c) => c.id === openId) ?? null

  useEffect(() => {
    setPayOpen(false)
    if (!open) { setDetail(null); return }
    let cancelled = false
    setDetailLoading(true)
    customerApi
      .getById(open.id)
      .then((r) => { if (!cancelled) setDetail(r.data) })
      .catch(() => { if (!cancelled) setDetail(null) })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [open?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (blocked) return blocked

  const refresh = () => {
    fetchCustomers(); fetchStats(); refreshCustomers()
    if (openId) customerApi.getById(openId).then((r) => setDetail(r.data)).catch(() => {})
  }
  const hasFilters = !!(search || typeFilter !== "all" || groupFilter !== "all" || tab !== "all")
  const changeTab = (t: string) => { setTab(t as Tab); setPage(1); setChecked(new Set()) }
  const resetFilters = () => { setSearch(""); setTypeFilter("all"); setGroupFilter("all"); setTab("all"); setPage(1); setChecked(new Set()) }

  const allChecked = customers.length > 0 && customers.every((c) => checked.has(c.id))
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(customers.map((c) => c.id)))
  const toggleOne = (id: number) =>
    setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selected = customers.filter((c) => checked.has(c.id))

  const setActive = async (targets: CustomerResponse[], status: "active" | "inactive") => {
    const results = await Promise.allSettled(targets.map((c) => customerApi.setStatus(c.id, status)))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: "Some updates failed", description: `${failed} of ${targets.length} could not be changed` })
    else toast({ title: status === "active" ? "Marked active" : "Marked inactive", description: `${targets.length} customer${targets.length === 1 ? "" : "s"} updated` })
    setChecked(new Set())
    refresh()
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const results = await Promise.allSettled(deleteTargets.map((c) => deleteCustomer(String(c.id))))
    const failed = results.filter((r) => r.status === "rejected").length
    const firstErr = results.find((r): r is PromiseRejectedResult => r.status === "rejected")
    const reason = firstErr ? (firstErr.reason?.message || "") : ""
    if (failed) toast({ variant: "destructive", title: "Some deletions failed", description: deleteTargets.length === 1 && reason ? reason : `${failed} of ${deleteTargets.length} could not be deleted${reason ? `: ${reason}` : ""}` })
    else toast({ title: "Deleted", description: `${deleteTargets.length} customer${deleteTargets.length === 1 ? "" : "s"} removed` })
    setDeleting(false)
    setDeleteTargets([])
    setChecked(new Set())
    refresh()
  }

  const EXPORT_HEADERS = ["ID", "Name", "Type", "Company", "Phone", "Email", "Group", "Status", "Address", "City/District", "Area", "Postcode", "Country", "Credit limit", "Store credit", "Tags", "Orders", "Spent", "Due", "Last order", "Since"]

  const exportRows = (rows: CustomerResponse[]) => {
    if (!rows.length) { toast({ variant: "destructive", title: "Nothing to export" }); return }
    const fmt = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "")
    downloadCSV("customers.csv", toCSV(EXPORT_HEADERS, rows.map((c) => [
      c.id, c.name, c.type ?? "individual", c.businessName ?? "", c.phone ?? "", c.email ?? "", groupOf(c), c.status ?? "active",
      c.address ?? "", c.district ?? c.city ?? "", c.area ?? c.state ?? "", c.zipCode ?? "", c.country ?? "",
      Number(c.creditLimit) || 0, Number(c.storeCredit) || 0, (c.tags ?? []).join("; "),
      c.totalOrders ?? 0, Number(c.totalSpent) || 0, Number(c.dueAmount) || 0, fmt(c.lastOrderAt), fmt(c.createdAt),
    ])))
    toast({ title: "Exported", description: `${rows.length} customer${rows.length === 1 ? "" : "s"}` })
  }

  /** Exports the selected rows, or every row matching the current filters across all pages */
  const handleExport = async (onlySelected = false) => {
    if (onlySelected && selected.length) return exportRows(selected)
    try {
      exportRows(await customerApi.getAllFiltered(filterParams()))
    } catch {
      toast({ variant: "destructive", title: "Export failed", description: "Could not load the customers" })
    }
  }

  const copyNumbers = async (numbers: string[]) => {
    if (!numbers.length) { toast({ variant: "destructive", title: "No numbers to copy", description: "No matching customers agreed to SMS offers." }); return }
    const text = numbers.join(", ")
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: `${numbers.length} number${numbers.length === 1 ? "" : "s"} copied for your SMS tool` })
    } catch {
      toast({ variant: "destructive", title: "Could not copy", description: "Clipboard is not available in this browser" })
    }
  }

  const copySmsAll = async () => {
    try {
      const { numbers } = await customerApi.getSmsNumbers({
        ...(search ? { search } : {}),
        ...(groupFilter !== "all" ? { group: groupFilter } : {}),
        ...(typeFilter !== "all" ? { type: typeFilter } : {}),
        ...(tab === "inactive" ? { status: "inactive" } : tab !== "all" ? { segment: tab } : {}),
      })
      await copyNumbers(numbers)
    } catch {
      toast({ variant: "destructive", title: "Could not load numbers" })
    }
  }
  const copySmsSelected = () => copyNumbers(selected.filter(hasSms).map((c) => c.phone))

  const applyTag = async () => {
    const tag = tagDraft.trim()
    if (!tag) return
    try {
      const r = await customerApi.bulkTag(selected.map((c) => c.id), tag)
      toast({ title: "Tag added", description: `"${tag}" added to ${r.updated} customer${r.updated === 1 ? "" : "s"}` })
      setTagOpen(false); setTagDraft(""); setChecked(new Set()); refresh()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not add tag", description: e?.response?.data?.message || "Please try again" })
    }
  }

  const openDuplicates = async () => {
    setMergeTitle("Review & merge duplicates")
    setMergeOpen(true); setMergeLoading(true)
    try { setMergeGroups(await customerApi.getDuplicates()) } catch { setMergeGroups([]) } finally { setMergeLoading(false) }
  }
  const openMergeSelected = () => {
    if (selected.length < 2) { toast({ variant: "destructive", title: "Select at least two customers to merge" }); return }
    setMergeTitle(`Merge ${selected.length} selected customers`)
    setMergeGroups([{ key: "selected", reason: "phone", customers: selected }])
    setMergeLoading(false)
    setMergeOpen(true)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const rows = parseCSVRows(String(ev.target?.result ?? ""))
      const pick = (r: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (r[k]) return r[k]; return "" }
      const payload = rows.map((r) => ({
        name: pick(r, "name"), phone: pick(r, "phone"), email: pick(r, "email"),
        address: pick(r, "address"), city: pick(r, "city", "citydistrict", "district"), district: pick(r, "district", "citydistrict", "city"),
        area: pick(r, "area"), country: pick(r, "country"),
        type: /^(business|biz)$/i.test(pick(r, "type")) || pick(r, "company", "businessname") ? "business" : "individual",
        businessName: pick(r, "businessname", "company"), licenceBin: pick(r, "licencebin", "licence", "bin"),
        customerGroup: ["vip", "wholesale", "retail"].find((g) => g === pick(r, "customergroup", "group").toLowerCase()) ?? "retail",
        creditLimit: Number(pick(r, "creditlimit")) || 0, openingBalance: Number(pick(r, "openingbalance")) || 0,
        birthday: pick(r, "birthday"), tags: pick(r, "tags"), notes: pick(r, "notes"),
      }))
      // Pre-filter rows without name/phone; the backend also skips duplicate phones
      const valid = payload.filter((r) => r.name.trim() && r.phone.trim())
      const preSkipped = payload.length - valid.length
      try {
        const res = await customerApi.importRows(valid)
        toast({ title: `Imported ${res.imported}, skipped ${res.skipped + preSkipped}`, description: res.skippedRows?.[0] ? `e.g. row ${res.skippedRows[0].row}: ${res.skippedRows[0].reason}` : undefined })
        setImportOpen(false)
        refresh()
      } catch (err: any) {
        toast({ variant: "destructive", title: "Import failed", description: err?.response?.data?.message || "Please check the file and try again" })
      }
    }
    reader.readAsText(file)
  }

  const openForm = (c?: CustomerResponse | null) => { setEditing(c ?? null); setFormOpen(true) }
  // `?add=1` (e.g. from Tailor > Measurements) opens the full customer form straight away.
  useEffect(() => { if (searchParams.get("add") === "1") openForm(null) }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-dash-muted">Who buys from you, how often, and who still owes you money.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setImportOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
            <Upload className="size-4" aria-hidden /> Import
          </button>
          {mayExport && <button type="button" onClick={() => handleExport()}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
            <Download className="size-4" aria-hidden /> Export
          </button>}
          <button type="button" onClick={copySmsAll} title="Copies the phone numbers of customers who agreed to SMS offers"
            className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
            Copy SMS numbers
          </button>
          <button type="button" onClick={() => openForm(null)}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">
            <Plus className="size-4" aria-hidden /> Add customer
          </button>
        </div>
      </div>

      {/* Duplicate banner */}
      {stats && stats.duplicates > 0 && !hideDupBanner && (
        <div className="flex flex-wrap items-center gap-3.5 rounded-xl bg-dash-warn-soft px-[18px] py-3.5 text-dash-warn-fg">
          <Users className="size-[22px] shrink-0" aria-hidden />
          <span className="min-w-[260px] flex-1 text-sm">
            <strong>{stats.duplicates} customers share a phone number.</strong> Merge them so order history and dues stay in one place.
          </span>
          <button type="button" onClick={openDuplicates} className="h-10 rounded-[10px] bg-dash-warn-fg px-3.5 text-[13px] font-semibold text-dash-warn-soft">
            Review &amp; merge
          </button>
          <button type="button" onClick={() => setHideDupBanner(true)} className="h-10 px-3 text-[13px] font-semibold">Dismiss</button>
        </div>
      )}

      {/* KPIs */}
      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[118px] rounded-[14px]" />)}
        </div>
      ) : (
        <StatsCards stats={[
          { label: "Total customers", value: stats.total, icon: <Users className="size-4" />, color: "blue", hint: `${stats.addedThisMonth} added this month · ${stats.inactive} inactive` },
          { label: "Repeat buyers", value: `${stats.repeatRatePct}%`, icon: <RotateCcw className="size-4" />, color: "green",
            hint: `${stats.repeatBuyers} of ${stats.withOrders} bought 2+ times` },
          { label: "Customers owe you", value: formatCurrency(stats.totalDue), icon: <Clock className="size-4" />, color: "red",
            hint: `${stats.owing} customer${stats.owing === 1 ? "" : "s"} with dues`, onClick: () => changeTab("due"), active: tab === "due" },
          { label: "Avg lifetime value", value: formatCurrency(stats.avgLifetimeValue), icon: <Banknote className="size-4" />, color: "yellow", hint: "Customers with orders" },
          { label: "At risk", value: stats.atRisk, icon: <AlertTriangle className="size-4" />, color: "yellow", hint: "No order in 30+ days",
            onClick: () => changeTab("risk"), active: tab === "risk" },
        ]} />
      )}

      <div className="flex flex-wrap items-start gap-4">
        {/* List */}
        <section className="min-w-0 flex-[999_1_640px] rounded-[14px] border border-dash-border bg-dash-card">
          <div className="px-4">
            <StatusTabs
              value={tab}
              onChange={changeTab}
              tabs={[
                { value: "all", label: "All", count: stats?.total },
                { value: "inactive", label: "Inactive", count: stats?.inactive },
                { value: "loyal", label: "Loyal", count: stats?.loyal },
                { value: "risk", label: "At risk", count: stats?.atRisk },
                { value: "due", label: "Owe money", count: stats?.owing },
                { value: "never", label: "No orders", count: stats?.never },
                { value: "dup", label: "Duplicates", count: stats?.duplicates },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
              <Search className="size-[18px]" aria-hidden />
              <span className="sr-only">Search customers</span>
              <input type="search" placeholder="Search name, phone or email…" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
            </label>
            <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setPage(1) }}>
              <SelectTrigger aria-label="Customer group" className={cn(filterSelect, "w-[140px]")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Group: All</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger aria-label="Customer type" className={cn(filterSelect, "w-[140px]")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Type: All</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1) }}>
              <SelectTrigger aria-label="Sort" className={cn(filterSelect, "w-[170px]")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Sort: Recent</SelectItem>
                <SelectItem value="name">Sort: Name</SelectItem>
                <SelectItem value="spent">Sort: Most spent</SelectItem>
                <SelectItem value="orders">Sort: Most orders</SelectItem>
                <SelectItem value="due">Sort: Highest due</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center gap-1 px-2 text-[13px] font-semibold text-dash-muted hover:text-dash-ink">
                <X className="size-4" aria-hidden /> Clear
              </button>
            )}
          </div>

          {checked.size > 0 && (
            <div className="mx-4 mb-3 flex flex-wrap items-center gap-2.5 rounded-[10px] bg-dash-ink px-3.5 py-2.5 text-dash-bg">
              <span className="text-sm font-semibold">{checked.size} selected</span>
              <button type="button" onClick={() => setActive(selected, "active")}
                className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Mark active</button>
              <button type="button" onClick={() => setActive(selected, "inactive")}
                className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Mark inactive</button>
              <button type="button" onClick={openMergeSelected} className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Merge</button>
              <button type="button" onClick={copySmsSelected} className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Copy SMS numbers</button>
              <button type="button" onClick={() => setTagOpen(true)} className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Add tag</button>
              {mayExport && <button type="button" onClick={() => handleExport(true)}
                className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Export selected</button>}
              <button type="button" onClick={() => setDeleteTargets(selected)}
                className="h-9 rounded-lg border border-red-400/50 px-3 text-[13px] font-semibold text-red-300 hover:bg-white/10">Delete</button>
              <button type="button" onClick={() => setChecked(new Set())} className="ml-auto h-9 px-3 text-[13px] font-semibold opacity-80 hover:opacity-100">Clear</button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                  <th scope="col" className="w-5 py-3 pl-4 pr-2"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" /></th>
                  <th scope="col" className="px-2 py-3 font-semibold">Customer</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Contact</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Group</th>
                  <th scope="col" className="px-2 py-3 text-right font-semibold">Orders</th>
                  <th scope="col" className="px-2 py-3 text-right font-semibold">Spent</th>
                  <th scope="col" className="px-2 py-3 text-right font-semibold">Due</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Last order</th>
                  <th scope="col" className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={9} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>)
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-14 text-center">
                      <Users className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                      <p className="font-semibold">No customers found</p>
                      <p className="text-sm text-dash-muted">{hasFilters ? "Try clearing the filters." : "Add your first customer to get started."}</p>
                    </td>
                  </tr>
                ) : (
                  customers.map((c, i) => {
                    const grp = GROUP_STYLE[groupOf(c)] ?? GROUP_STYLE.retail
                    const seg = segmentOf(c)
                    const due = Number(c.dueAmount) || 0
                    const ck = checked.has(c.id)
                    return (
                      <tr key={c.id} className={c.id === openId ? "bg-dash-accent-soft/40" : ck ? "bg-dash-bg" : ""}>
                        <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                          <Checkbox checked={ck} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.name}`} />
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <button type="button" onClick={() => setOpenId(c.id)} className="flex items-center gap-2.5 text-left">
                            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold", AVATAR[i % 4])}>{initials(c.name)}</span>
                            <span className="flex flex-col">
                              <span className="flex items-center gap-1.5 font-semibold">
                                {c.name}
                                {c.status === "inactive" && <span className="rounded bg-dash-neutral-soft px-1.5 py-px text-[10px] font-bold text-dash-neutral-fg">Inactive</span>}
                                {c.duplicatePhone && <span className="rounded bg-dash-warn-soft px-1.5 py-px text-[10px] font-bold text-dash-warn-fg">Duplicate?</span>}
                              </span>
                              <span className="text-xs text-dash-muted">{c.type === "business" ? `${c.businessName || "Business"} · ` : ""}Since {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                            </span>
                          </button>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <div>{c.phone || "—"}</div>
                          <div className="text-xs text-dash-muted">{c.email || "—"}</div>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <span className={cn("rounded-md px-2 py-[3px] text-xs font-bold", grp.cls)}>{grp.label}</span>
                          {c.type === "business" && <span className="ml-1 rounded-md bg-dash-neutral-soft px-2 py-[3px] text-xs font-bold text-dash-neutral-fg">Business</span>}
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">{c.totalOrders ?? 0}</td>
                        <td className="border-b border-dash-border-soft px-2 py-3 text-right font-bold tabular-nums">{formatCurrency(Number(c.totalSpent) || 0)}</td>
                        <td className={cn("border-b border-dash-border-soft px-2 py-3 text-right font-bold tabular-nums", due > 0 ? "text-dash-danger" : "text-dash-muted/60")}>
                          {due > 0 ? formatCurrency(due) : "—"}
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <div>{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</div>
                          <div className={cn("text-xs font-semibold", seg.cls)}>{seg.text}</div>
                        </td>
                        <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                          <div className="flex justify-end gap-1">
                            {c.phone ? (
                              <a href={`tel:${c.phone}`} aria-label={`Call ${c.name}`} className={iconBtn}><Phone className="size-4" /></a>
                            ) : (
                              <span aria-hidden className={cn(iconBtn, "opacity-40")}><Phone className="size-4" /></span>
                            )}
                            <Link href={`/dashboard/sales?new=1&customer=${c.id}`} aria-label={`New sale for ${c.name}`} className={iconBtn}><Plus className="size-4" /></Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" aria-label={`More actions for ${c.name}`} className={iconBtn}><MoreHorizontal className="size-4" /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openForm(c)}>Edit customer</DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/dashboard/orders?customer=${encodeURIComponent(c.name)}`}>View orders</Link></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setActive([c], c.status === "active" ? "inactive" : "active")}>
                                  {c.status === "active" ? "Mark inactive" : "Mark active"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-dash-danger focus:text-dash-danger" onClick={() => setDeleteTargets([c])}>Delete customer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loading && customers.length > 0 && (
            <div className="border-t border-dash-border-soft p-4 pt-3">
              <PaginationControl
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(total / perPage))}
                itemsPerPage={perPage}
                totalItems={total}
                onPageChange={setPage}
                onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
              />
            </div>
          )}
        </section>

        {/* Detail panel */}
        <aside aria-label="Customer details" className="min-w-0 flex-[1_1_320px] rounded-[14px] border border-dash-border bg-dash-card lg:sticky lg:top-0 lg:max-w-[400px]">
          {!open ? (
            <p className="p-6 text-center text-sm text-dash-muted">{loading ? "Loading…" : "Select a customer to see their profile."}</p>
          ) : (() => {
            const v: CustomerResponse = detail && detail.id === open.id ? { ...open, ...detail } : open
            const due = Number(v.dueAmount) || 0
            const grp = GROUP_STYLE[groupOf(v)] ?? GROUP_STYLE.retail
            const addr = [v.address, v.area || v.state, v.district || v.city, v.zipCode, v.country].filter(Boolean).join(", ")
            const idx = customers.findIndex((c) => c.id === v.id)
            const limit = Number(v.creditLimit) || 0
            const used = Number(v.creditUsed ?? due) || 0
            const pct = Math.round(v.creditUsedPercent ?? (limit > 0 ? (used / limit) * 100 : 0))
            const recent = v.recentOrders ?? []
            const rows: [string, string][] = [
              ["Phone", v.phone || "—"],
              ["Email", v.email || "—"],
              ...(v.type === "business" ? [["Business", v.businessName || "—"], ["Licence / BIN", v.licenceBin || "—"]] as [string, string][] : []),
              ["Birthday", v.birthday ? new Date(v.birthday).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"],
              ["SMS offers", v.smsOptIn === false ? "Opted out" : "Opted in"],
              ["Address", addr || "—"],
              ["Store credit", formatCurrency(Number(v.storeCredit) || 0)],
            ]
            return (
              <>
                <div className="flex flex-col gap-3.5 p-[18px]">
                  <div className="flex items-center gap-3">
                    <span className={cn("flex size-[52px] shrink-0 items-center justify-center rounded-full text-base font-bold", AVATAR[Math.max(0, idx) % 4])}>{initials(v.name)}</span>
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 truncate font-dash-display text-lg font-bold">
                        {v.name}
                        {v.status === "inactive" && <span className="rounded bg-dash-neutral-soft px-1.5 py-px text-[10px] font-bold text-dash-neutral-fg">Inactive</span>}
                      </h2>
                      <span className="text-[13px] text-dash-muted">
                        {grp.label}{v.type === "business" ? " · Business" : ""} · since {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-[10px] bg-dash-bg p-2.5"><div className="text-xs text-dash-muted">Orders</div><div className="text-lg font-bold tabular-nums">{v.totalOrders ?? 0}</div></div>
                    <div className="rounded-[10px] bg-dash-bg p-2.5"><div className="text-xs text-dash-muted">Spent</div><div className="text-lg font-bold tabular-nums">{formatCurrency(Number(v.totalSpent) || 0).replace(/\.00$/, "")}</div></div>
                    <div className={cn("rounded-[10px] p-2.5", due > 0 ? "bg-dash-danger-soft text-dash-danger-fg" : "bg-dash-bg")}>
                      <div className={cn("text-xs", due > 0 ? "" : "text-dash-muted")}>Due</div>
                      <div className="text-lg font-bold tabular-nums">{formatCurrency(due).replace(/\.00$/, "")}</div>
                    </div>
                  </div>
                  {limit > 0 && (
                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-dash-muted">Credit limit {formatCurrency(limit)}</span>
                        <span className={cn("font-semibold", pct >= 100 ? "text-dash-danger" : pct >= 80 ? "text-dash-warn-fg" : "")}>Credit used ({pct}%)</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-dash-neutral-soft" role="progressbar" aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Credit used">
                        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-dash-danger" : pct >= 80 ? "bg-amber-500" : "bg-dash-accent")} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <Link href={`/dashboard/sales?new=1&customer=${v.id}`}
                      className="flex h-11 items-center justify-center rounded-[10px] bg-dash-accent text-[13px] font-semibold text-white">New sale</Link>
                    <button type="button" disabled={due <= 0} onClick={() => setPayOpen((o) => !o)} aria-expanded={payOpen}
                      title={due <= 0 ? "Nothing due" : undefined}
                      className="h-11 rounded-[10px] border border-dash-border bg-dash-card text-[13px] font-semibold hover:bg-dash-neutral-soft disabled:opacity-40">Get payment</button>
                    <button type="button" onClick={() => openForm(v)}
                      className="h-11 rounded-[10px] border border-dash-border bg-dash-card text-[13px] font-semibold hover:bg-dash-neutral-soft">Edit</button>
                  </div>
                  {payOpen && due > 0 && (
                    <GetPaymentForm customerId={v.id} due={due} onCancel={() => setPayOpen(false)} onPaid={() => { setPayOpen(false); refresh() }} />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setActive([v], v.status === "inactive" ? "active" : "inactive")}
                      className="h-10 rounded-[10px] border border-dash-border bg-dash-card text-[13px] font-semibold hover:bg-dash-neutral-soft">
                      {v.status === "inactive" ? "Mark active" : "Mark inactive"}
                    </button>
                    <button type="button" onClick={() => setDeleteTargets([v])}
                      className="h-10 rounded-[10px] border border-dash-border bg-dash-card text-[13px] font-semibold text-dash-danger hover:bg-dash-neutral-soft">Delete</button>
                  </div>
                </div>

                <div className="border-t border-dash-border-soft p-[18px]">
                  <h3 className="mb-2.5 text-xs font-bold uppercase tracking-[0.06em] text-dash-muted">Contact</h3>
                  {rows.map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-3 py-1.5 text-sm">
                      <span className="text-dash-muted">{k}</span>
                      <span className="text-right font-semibold">{val}</span>
                    </div>
                  ))}
                  {(v.tags?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 py-1.5">
                      {v.tags!.map((t) => <span key={t} className="rounded-md bg-dash-accent-soft px-2 py-0.5 text-xs font-semibold text-dash-accent-fg">{t}</span>)}
                    </div>
                  )}
                  {v.notes && <p className="mt-2 rounded-[10px] bg-dash-bg p-2.5 text-[13px] text-dash-muted">{v.notes}</p>}
                </div>

                <div className="border-t border-dash-border-soft p-[18px]">
                  <h3 className="mb-2.5 text-xs font-bold uppercase tracking-[0.06em] text-dash-muted">Recent orders</h3>
                  {detailLoading && !detail ? (
                    <Skeleton className="h-12 rounded" />
                  ) : recent.length === 0 ? (
                    <p className="text-sm text-dash-muted">No orders yet.</p>
                  ) : (
                    recent.slice(0, 5).map((o) => (
                      <div key={o.id} className="flex items-center justify-between gap-3 border-b border-dash-border-soft py-2.5 last:border-b-0">
                        <span className="flex flex-col">
                          <span className="text-sm font-semibold">#{o.invoiceNo}</span>
                          <span className="text-xs text-dash-muted">{new Date(o.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        </span>
                        <span className="flex flex-col items-end">
                          <span className="text-sm font-bold tabular-nums">{formatCurrency(Number(o.amount))}</span>
                          <span className={cn("text-xs font-semibold", STATUS_CHIP[o.status])}>{o.status}</span>
                        </span>
                      </div>
                    ))
                  )}
                  {recent.length > 0 && (
                    <Link href={`/dashboard/orders?customer=${encodeURIComponent(v.name)}`} className="mt-2 inline-block text-[13px] font-semibold text-dash-accent hover:underline">
                      View all orders →
                    </Link>
                  )}
                </div>
              </>
            )
          })()}
        </aside>
      </div>

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
        onSaved={refresh}
        onOpenExisting={(phone) => { setSearch(phone); setTab("all"); setPage(1) }}
      />

      <MergeDialog open={mergeOpen} onOpenChange={setMergeOpen} groups={mergeGroups} loading={mergeLoading} title={mergeTitle}
        onMerged={() => { setChecked(new Set()); refresh() }} />

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-dash-display text-xl font-bold">Add tag</DialogTitle>
            <DialogDescription>Adds a tag to {selected.length} selected customer{selected.length === 1 ? "" : "s"}.</DialogDescription>
          </DialogHeader>
          <input autoFocus value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="e.g. Eid campaign"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyTag() } }}
            className="h-11 w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent" />
          <DialogFooter>
            <button type="button" onClick={() => setTagOpen(false)} className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft">Cancel</button>
            <button type="button" onClick={applyTag} disabled={!tagDraft.trim()} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">Add tag</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-dash-display text-xl font-bold">Import customers</DialogTitle>
            <DialogDescription>Upload a CSV with columns: name, phone (required), email, type (individual or business), business name, group (retail, wholesale or VIP), credit limit, opening balance, birthday, tags, address, district, area, country. Rows without a name or phone, and duplicate phone numbers, are skipped.</DialogDescription>
          </DialogHeader>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleImport}
            className="block w-full rounded-[10px] border border-dashed border-dash-border bg-dash-bg p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-dash-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
          <DialogFooter>
            <button type="button" onClick={() => setImportOpen(false)}
              className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft">Close</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && setDeleteTargets([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTargets.length === 1 ? deleteTargets[0].name : `${deleteTargets.length} customers`}?</AlertDialogTitle>
            <AlertDialogDescription>Their past orders stay in your records. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
