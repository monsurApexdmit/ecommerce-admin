"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle, Download, MoreHorizontal, Phone, Plus, RotateCcw, Search, Upload, Users, X, Banknote, Clock,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ItemGroup, Item, ItemContent, ItemTitle, ItemDescription, ItemActions, ItemSeparator } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { BulkBar } from "@/components/common/BulkBar"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusBadge } from "@/components/common/StatusBadge"
import { StatTile } from "@/components/common/StatTile"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SectionTitle } from "@/components/common/SectionTitle"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WithTooltip } from "@/components/common/WithTooltip"
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

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

const GROUP_STYLE: Record<string, { label: string; variant: BadgeVariant }> = {
  retail: { label: "Retail", variant: "outline" },
  wholesale: { label: "Wholesale", variant: "secondary" },
  vip: { label: "VIP", variant: "default" },
}

const groupOf = (c: CustomerResponse) => c.customerGroup ?? c.customerType ?? "retail"
const hasSms = (c: CustomerResponse) =>
  c.smsOptIn !== false && c.status !== "inactive" && (c.phone ?? "").replace(/\D/g, "").length >= 7

const daysSince = (iso?: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null)

function segmentOf(c: CustomerResponse): { text: string; variant: BadgeVariant } {
  const orders = c.totalOrders ?? 0
  const days = daysSince(c.lastOrderAt)
  if (orders === 0) return { text: "No orders yet", variant: "outline" }
  if (days !== null && days > 30) return { text: "At risk · 30+ days", variant: "destructive" }
  if (orders >= 5) return { text: "Loyal", variant: "default" }
  return { text: "Active", variant: "secondary" }
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
    <div className="flex flex-col gap-5">
      {/* Header */}
      <PageHeader
        title="Customers"
        description="Who buys from you, how often, and who still owes you money."
        actions={<>
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" aria-hidden /> Import
          </Button>
          {mayExport && <Button type="button" variant="outline" onClick={() => handleExport()}>
            <Download className="size-4" aria-hidden /> Export
          </Button>}
          <WithTooltip content="Copies the phone numbers of customers who agreed to SMS offers">
            <Button type="button" variant="outline" onClick={copySmsAll}>
              Copy SMS numbers
            </Button>
          </WithTooltip>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="size-4" aria-hidden /> Add customer
          </Button>
        </>}
      />

      {/* Duplicate banner */}
      {stats && stats.duplicates > 0 && !hideDupBanner && (
        <Alert>
          <Users aria-hidden />
          <AlertTitle>{stats.duplicates} customers share a phone number.</AlertTitle>
          <AlertDescription>
            <p>Merge them so order history and dues stay in one place.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={openDuplicates}>
                Review &amp; merge
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setHideDupBanner(true)}>Dismiss</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[118px]" />)}
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
        <Card className="min-w-0 flex-[999_1_640px] gap-0 py-0">
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
            <div className="relative min-w-[240px] flex-1">
              <Label htmlFor="customer-search" className="sr-only">Search customers</Label>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="customer-search" type="search" placeholder="Search name, phone or email…" value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-8" />
            </div>
            <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setPage(1) }}>
              <SelectTrigger aria-label="Customer group" className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Group: All</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
                <SelectItem value="vip">VIP</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger aria-label="Customer type" className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Type: All</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1) }}>
              <SelectTrigger aria-label="Sort" className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Sort: Recent</SelectItem>
                <SelectItem value="name">Sort: Name</SelectItem>
                <SelectItem value="spent">Sort: Most spent</SelectItem>
                <SelectItem value="orders">Sort: Most orders</SelectItem>
                <SelectItem value="due">Sort: Highest due</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                <X className="size-4" aria-hidden /> Clear
              </Button>
            )}
          </div>

          <BulkBar count={checked.size} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setActive(selected, "active")}>Mark active</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setActive(selected, "inactive")}>Mark inactive</Button>
              <Button type="button" variant="outline" size="sm" onClick={openMergeSelected}>Merge</Button>
              <Button type="button" variant="outline" size="sm" onClick={copySmsSelected}>Copy SMS numbers</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setTagOpen(true)}>Add tag</Button>
              {mayExport && <Button type="button" variant="outline" size="sm" onClick={() => handleExport(true)}>Export selected</Button>}
              <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTargets(selected)}>Delete</Button>
          </BulkBar>

          <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="w-5"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" /></TableHead>
                  <TableHead scope="col">Customer</TableHead>
                  <TableHead scope="col">Contact</TableHead>
                  <TableHead scope="col">Group</TableHead>
                  <TableHead scope="col" className="text-right">Orders</TableHead>
                  <TableHead scope="col" className="text-right">Spent</TableHead>
                  <TableHead scope="col" className="text-right">Due</TableHead>
                  <TableHead scope="col">Last order</TableHead>
                  <TableHead scope="col" className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-10" /></TableCell></TableRow>)
                ) : customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="whitespace-normal">
                      <EmptyState
                        icon={Users}
                        title="No customers found"
                        description={hasFilters ? "Try clearing the filters." : "Add your first customer to get started."}
                        className="p-4 md:p-6"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((c) => {
                    const grp = GROUP_STYLE[groupOf(c)] ?? GROUP_STYLE.retail
                    const seg = segmentOf(c)
                    const due = Number(c.dueAmount) || 0
                    const ck = checked.has(c.id)
                    return (
                      <TableRow key={c.id} data-state={ck || c.id === openId ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox checked={ck} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.name}`} />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" onClick={() => setOpenId(c.id)} className="h-auto justify-start gap-2.5 text-left">
                            <UserAvatar name={c.name} className="size-9 shrink-0" />
                            <span className="flex flex-col">
                              <span className="flex items-center gap-1.5 font-semibold">
                                {c.name}
                                {c.status === "inactive" && <Badge variant="outline">Inactive</Badge>}
                                {c.duplicatePhone && <Badge variant="secondary">Duplicate?</Badge>}
                              </span>
                              <span className="text-xs text-muted-foreground">{c.type === "business" ? `${c.businessName || "Business"} · ` : ""}Since {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                            </span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div>{c.phone || "—"}</div>
                          <div className="text-xs text-muted-foreground">{c.email || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={grp.variant}>{grp.label}</Badge>
                          {c.type === "business" && <Badge variant="outline" className="ml-1">Business</Badge>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.totalOrders ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(Number(c.totalSpent) || 0)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", due > 0 && "text-destructive")}>
                          {due > 0 ? formatCurrency(due) : "—"}
                        </TableCell>
                        <TableCell>
                          <div>{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}</div>
                          <Badge variant={seg.variant} className="mt-0.5">{seg.text}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {c.phone ? (
                              <Button asChild variant="outline" size="icon"><a href={`tel:${c.phone}`} aria-label={`Call ${c.name}`}><Phone className="size-4" /></a></Button>
                            ) : (
                              <Button type="button" variant="outline" size="icon" disabled aria-hidden tabIndex={-1}><Phone className="size-4" /></Button>
                            )}
                            <Button asChild variant="outline" size="icon"><Link href={`/dashboard/sales?new=1&customer=${c.id}`} aria-label={`New sale for ${c.name}`}><Plus className="size-4" /></Link></Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="icon" aria-label={`More actions for ${c.name}`}><MoreHorizontal className="size-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openForm(c)}>Edit customer</DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/dashboard/orders?customer=${encodeURIComponent(c.name)}`}>View orders</Link></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setActive([c], c.status === "active" ? "inactive" : "active")}>
                                  {c.status === "active" ? "Mark inactive" : "Mark active"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargets([c])}>Delete customer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
          </Table>

          {!loading && customers.length > 0 && (
            <>
            <Separator />
            <div className="p-4 pt-3">
              <PaginationControl
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(total / perPage))}
                itemsPerPage={perPage}
                totalItems={total}
                onPageChange={setPage}
                onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
              />
            </div>
            </>
          )}
        </Card>

        {/* Detail panel */}
        <aside aria-label="Customer details" className="min-w-0 flex-[1_1_320px] lg:sticky lg:top-0 lg:max-w-[400px]">
          <Card className="gap-0 py-0">
          {!open ? (
            <EmptyState title={loading ? "Loading…" : "Select a customer to see their profile."} className="p-6 md:p-6" />
          ) : (() => {
            const v: CustomerResponse = detail && detail.id === open.id ? { ...open, ...detail } : open
            const due = Number(v.dueAmount) || 0
            const grp = GROUP_STYLE[groupOf(v)] ?? GROUP_STYLE.retail
            const addr = [v.address, v.area || v.state, v.district || v.city, v.zipCode, v.country].filter(Boolean).join(", ")
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
            const miniTile = "gap-1 p-2.5 [&_.text-2xl]:text-lg"
            return (
              <>
                <div className="flex flex-col gap-3.5 p-[18px]">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={v.name} className="size-[52px] shrink-0" />
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 truncate text-lg font-semibold">
                        {v.name}
                        {v.status === "inactive" && <Badge variant="outline">Inactive</Badge>}
                      </h2>
                      <span className="text-sm text-muted-foreground">
                        {grp.label}{v.type === "business" ? " · Business" : ""} · since {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <StatTile label="Orders" value={v.totalOrders ?? 0} className={miniTile} />
                    <StatTile label="Spent" value={formatCurrency(Number(v.totalSpent) || 0).replace(/\.00$/, "")} className={miniTile} />
                    <StatTile label="Due" value={formatCurrency(due).replace(/\.00$/, "")} className={cn(miniTile, due > 0 && "border-destructive/50 text-destructive")} />
                  </div>
                  {limit > 0 && (
                    <div>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-muted-foreground">Credit limit {formatCurrency(limit)}</span>
                        <span className={cn("font-semibold", pct >= 80 && "text-destructive")}>Credit used ({pct}%)</span>
                      </div>
                      <Progress
                        value={Math.min(pct, 100)}
                        aria-label="Credit used"
                        className={cn(pct >= 80 && "[&>[data-slot=progress-indicator]]:bg-destructive")}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <Button asChild><Link href={`/dashboard/sales?new=1&customer=${v.id}`}>New sale</Link></Button>
                    <WithTooltip content={due <= 0 ? "Nothing due" : undefined}>
                      <span tabIndex={due <= 0 ? 0 : undefined} className="grid">
                        <Button type="button" variant="outline" disabled={due <= 0} onClick={() => setPayOpen((o) => !o)} aria-expanded={payOpen}>Get payment</Button>
                      </span>
                    </WithTooltip>
                    <Button type="button" variant="outline" onClick={() => openForm(v)}>Edit</Button>
                  </div>
                  {payOpen && due > 0 && (
                    <GetPaymentForm customerId={v.id} due={due} onCancel={() => setPayOpen(false)} onPaid={() => { setPayOpen(false); refresh() }} />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={() => setActive([v], v.status === "inactive" ? "active" : "inactive")}>
                      {v.status === "inactive" ? "Mark active" : "Mark inactive"}
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => setDeleteTargets([v])}>Delete</Button>
                  </div>
                </div>

                <Separator />
                <div className="p-[18px]">
                  <SectionTitle className="mb-2.5">Contact</SectionTitle>
                  <InfoList className="gap-3">
                    {rows.map(([k, val]) => <InfoRow key={k} label={k} value={val} />)}
                  </InfoList>
                  {(v.tags?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 py-1.5">
                      {v.tags!.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                    </div>
                  )}
                  {v.notes && <Card className="mt-2 p-2.5 text-sm text-muted-foreground shadow-none">{v.notes}</Card>}
                </div>

                <Separator />
                <div className="p-[18px]">
                  <SectionTitle className="mb-2.5">Recent orders</SectionTitle>
                  {detailLoading && !detail ? (
                    <Skeleton className="h-12" />
                  ) : recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No orders yet.</p>
                  ) : (
                    <ItemGroup>
                      {recent.slice(0, 5).map((o, i) => (
                        <div key={o.id} role="listitem">
                          {i > 0 && <ItemSeparator />}
                          <Item size="sm" className="px-0">
                            <ItemContent>
                              <ItemTitle>#{o.invoiceNo}</ItemTitle>
                              <ItemDescription>{new Date(o.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</ItemDescription>
                            </ItemContent>
                            <ItemActions className="flex-col items-end gap-1">
                              <span className="text-sm font-semibold tabular-nums">{formatCurrency(Number(o.amount))}</span>
                              <StatusBadge status={o.status} />
                            </ItemActions>
                          </Item>
                        </div>
                      ))}
                    </ItemGroup>
                  )}
                  {recent.length > 0 && (
                    <Button asChild variant="link" className="mt-2 h-auto p-0">
                      <Link href={`/dashboard/orders?customer=${encodeURIComponent(v.name)}`}>View all orders →</Link>
                    </Button>
                  )}
                </div>
              </>
            )
          })()}
          </Card>
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add tag</DialogTitle>
            <DialogDescription>Adds a tag to {selected.length} selected customer{selected.length === 1 ? "" : "s"}.</DialogDescription>
          </DialogHeader>
          <Input autoFocus aria-label="Tag" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="e.g. Eid campaign"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyTag() } }} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTagOpen(false)}>Cancel</Button>
            <Button type="button" onClick={applyTag} disabled={!tagDraft.trim()}>Add tag</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import customers</DialogTitle>
            <DialogDescription>Upload a CSV with columns: name, phone (required), email, type (individual or business), business name, group (retail, wholesale or VIP), credit limit, opening balance, birthday, tags, address, district, area, country. Rows without a name or phone, and duplicate phone numbers, are skipped.</DialogDescription>
          </DialogHeader>
          <Input ref={fileRef} type="file" accept=".csv" aria-label="CSV file" onChange={handleImport} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
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
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
