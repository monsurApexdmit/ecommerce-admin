"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle, Download, MoreHorizontal, Phone, Plus, RotateCcw, Search, Upload, Users, X, Banknote, Clock, Pencil, Trash2,
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
import { localeTag } from "@/lib/i18n"
import { useTranslation } from "react-i18next"

type Tab = "all" | "inactive" | "loyal" | "risk" | "due" | "never" | "dup"
type Stats = Awaited<ReturnType<typeof customerApi.getStats>>

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

// Group codes are data; built-in ones get a translated label, owner-made codes show as-is
const GROUP_STYLE: Record<string, { label: "customers:shared.groups.retail" | "customers:shared.groups.wholesale" | "customers:shared.groups.vip"; variant: BadgeVariant }> = {
  retail: { label: "customers:shared.groups.retail", variant: "outline" },
  wholesale: { label: "customers:shared.groups.wholesale", variant: "secondary" },
  vip: { label: "customers:shared.groups.vip", variant: "default" },
}

const groupOf = (c: CustomerResponse) => c.customerGroup ?? c.customerType ?? "retail"
const hasSms = (c: CustomerResponse) =>
  c.smsOptIn !== false && c.status !== "inactive" && (c.phone ?? "").replace(/\D/g, "").length >= 7

const daysSince = (iso?: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null)

const SEGMENT_KEYS = {
  noOrders: "customers:customers.segment.noOrders",
  atRisk: "customers:customers.segment.atRisk",
  loyal: "customers:customers.segment.loyal",
  active: "customers:customers.segment.active",
} as const

function segmentOf(c: CustomerResponse): { text: (typeof SEGMENT_KEYS)[keyof typeof SEGMENT_KEYS]; variant: BadgeVariant } {
  const orders = c.totalOrders ?? 0
  const days = daysSince(c.lastOrderAt)
  if (orders === 0) return { text: SEGMENT_KEYS.noOrders, variant: "outline" }
  if (days !== null && days > 30) return { text: SEGMENT_KEYS.atRisk, variant: "destructive" }
  if (orders >= 5) return { text: SEGMENT_KEYS.loyal, variant: "default" }
  return { text: SEGMENT_KEYS.active, variant: "secondary" }
}

// Order statuses on the recent-orders list are codes; map the common ones, fall back to the raw value
const ORDER_STATUS_KEYS = {
  pending: "common:orderStatus.pending",
  processing: "common:orderStatus.processing",
  confirmed: "common:orderStatus.confirmed",
  shipped: "common:orderStatus.shipped",
  delivered: "common:orderStatus.delivered",
  completed: "common:orderStatus.completed",
  cancelled: "common:orderStatus.cancelled",
  canceled: "common:orderStatus.cancelled",
  returned: "common:orderStatus.returned",
  refunded: "common:orderStatus.refunded",
  onhold: "common:orderStatus.onHold",
} as const
const orderStatusKey = (s: string) =>
  (ORDER_STATUS_KEYS as Record<string, (typeof ORDER_STATUS_KEYS)[keyof typeof ORDER_STATUS_KEYS] | undefined>)[s.toLowerCase().replace(/[\s_-]+/g, "")]

export default function CustomersPage() {
  const { t, i18n } = useTranslation(["customers", "common"])
  const locale = localeTag(i18n.language)
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
  // null = the default "Review & merge duplicates" title; a number = merging that many selected customers
  const [mergeCount, setMergeCount] = useState<number | null>(null)
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
    if (failed) toast({ variant: "destructive", title: t("customers:customers.toast.someUpdatesFailed"), description: t("customers:customers.toast.updateFailedDesc", { failed, total: targets.length }) })
    else toast({ title: status === "active" ? t("customers:customers.toast.markedActive") : t("customers:customers.toast.markedInactive"), description: t("customers:customers.toast.updated", { count: targets.length }) })
    setChecked(new Set())
    refresh()
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const results = await Promise.allSettled(deleteTargets.map((c) => deleteCustomer(String(c.id))))
    const failed = results.filter((r) => r.status === "rejected").length
    const firstErr = results.find((r): r is PromiseRejectedResult => r.status === "rejected")
    const reason = firstErr ? (firstErr.reason?.message || "") : ""
    if (failed) toast({ variant: "destructive", title: t("customers:customers.toast.someDeletesFailed"), description: deleteTargets.length === 1 && reason ? reason
      : reason ? t("customers:customers.toast.deleteFailedDescReason", { failed, total: deleteTargets.length, reason })
      : t("customers:customers.toast.deleteFailedDesc", { failed, total: deleteTargets.length }) })
    else toast({ title: t("common:status.deleted"), description: t("customers:customers.toast.deletedDesc", { count: deleteTargets.length }) })
    setDeleting(false)
    setDeleteTargets([])
    setChecked(new Set())
    refresh()
  }

  // CSV headers stay in English: the Import dialog reads these same column names back (see handleImport / parseCSVRows)
  const EXPORT_HEADERS = ["ID", "Name", "Type", "Company", "Phone", "Email", "Group", "Status", "Address", "City/District", "Area", "Postcode", "Country", "Credit limit", "Store credit", "Tags", "Orders", "Spent", "Due", "Last order", "Since"]

  const exportRows = (rows: CustomerResponse[]) => {
    if (!rows.length) { toast({ variant: "destructive", title: t("common:extra.nothingToExport") }); return }
    const fmt = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "")
    downloadCSV("customers.csv", toCSV(EXPORT_HEADERS, rows.map((c) => [
      c.id, c.name, c.type ?? "individual", c.businessName ?? "", c.phone ?? "", c.email ?? "", groupOf(c), c.status ?? "active",
      c.address ?? "", c.district ?? c.city ?? "", c.area ?? c.state ?? "", c.zipCode ?? "", c.country ?? "",
      Number(c.creditLimit) || 0, Number(c.storeCredit) || 0, (c.tags ?? []).join("; "),
      c.totalOrders ?? 0, Number(c.totalSpent) || 0, Number(c.dueAmount) || 0, fmt(c.lastOrderAt), fmt(c.createdAt),
    ])))
    toast({ title: t("customers:customers.toast.exported"), description: t("customers:customers.toast.exportedDesc", { count: rows.length }) })
  }

  /** Exports the selected rows, or every row matching the current filters across all pages */
  const handleExport = async (onlySelected = false) => {
    if (onlySelected && selected.length) return exportRows(selected)
    try {
      exportRows(await customerApi.getAllFiltered(filterParams()))
    } catch {
      toast({ variant: "destructive", title: t("customers:customers.toast.exportFailed"), description: t("customers:customers.toast.exportFailedDesc") })
    }
  }

  const copyNumbers = async (numbers: string[]) => {
    if (!numbers.length) { toast({ variant: "destructive", title: t("customers:customers.toast.noNumbers"), description: t("customers:customers.toast.noNumbersDesc") }); return }
    const text = numbers.join(", ")
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: t("common:actions.copied"), description: t("customers:customers.toast.copiedNumbers", { count: numbers.length }) })
    } catch {
      toast({ variant: "destructive", title: t("customers:customers.toast.copyFailed"), description: t("customers:customers.toast.clipboardUnavailable") })
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
      toast({ variant: "destructive", title: t("customers:customers.toast.numbersFailed") })
    }
  }
  const copySmsSelected = () => copyNumbers(selected.filter(hasSms).map((c) => c.phone))

  const applyTag = async () => {
    const tag = tagDraft.trim()
    if (!tag) return
    try {
      const r = await customerApi.bulkTag(selected.map((c) => c.id), tag)
      toast({ title: t("customers:customers.toast.tagAdded"), description: t("customers:customers.toast.tagAddedDesc", { tag, count: r.updated }) })
      setTagOpen(false); setTagDraft(""); setChecked(new Set()); refresh()
    } catch (e: any) {
      toast({ variant: "destructive", title: t("customers:customers.toast.tagFailed"), description: e?.response?.data?.message || t("common:extra.tryAgain") })
    }
  }

  const openDuplicates = async () => {
    setMergeCount(null)
    setMergeOpen(true); setMergeLoading(true)
    try { setMergeGroups(await customerApi.getDuplicates()) } catch { setMergeGroups([]) } finally { setMergeLoading(false) }
  }
  const openMergeSelected = () => {
    if (selected.length < 2) { toast({ variant: "destructive", title: t("customers:customers.toast.mergeMin") }); return }
    setMergeCount(selected.length)
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
        toast({ title: t("customers:import.result", { imported: res.imported, skipped: res.skipped + preSkipped }), description: res.skippedRows?.[0] ? t("customers:import.example", { row: res.skippedRows[0].row, reason: res.skippedRows[0].reason }) : undefined })
        setImportOpen(false)
        refresh()
      } catch (err: any) {
        toast({ variant: "destructive", title: t("customers:import.failed"), description: err?.response?.data?.message || t("customers:import.failedDesc") })
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
        title={t("customers:customers.title")}
        description={t("customers:customers.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" aria-hidden /> {t("common:actions.import")}
          </Button>
          {mayExport && <Button type="button" variant="outline" onClick={() => handleExport()}>
            <Download className="size-4" aria-hidden /> {t("common:actions.export")}
          </Button>}
          <WithTooltip content={t("customers:customers.copySmsTooltip")}>
            <Button type="button" variant="outline" onClick={copySmsAll}>
              {t("customers:customers.copySms")}
            </Button>
          </WithTooltip>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="size-4" aria-hidden /> {t("customers:customers.addCustomer")}
          </Button>
        </>}
      />

      {/* Duplicate banner */}
      {stats && stats.duplicates > 0 && !hideDupBanner && (
        <Alert>
          <Users aria-hidden />
          <AlertTitle>{t("customers:customers.dup.title", { count: stats.duplicates })}</AlertTitle>
          <AlertDescription>
            <p>{t("customers:customers.dup.body")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={openDuplicates}>
                {t("customers:customers.dup.review")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setHideDupBanner(true)}>{t("customers:customers.dup.dismiss")}</Button>
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
          { label: t("customers:customers.kpi.total"), value: stats.total, icon: <Users className="size-4" />, color: "blue", hint: t("customers:customers.kpi.totalHint", { added: stats.addedThisMonth, inactive: stats.inactive }) },
          { label: t("customers:customers.kpi.repeat"), value: `${stats.repeatRatePct}%`, icon: <RotateCcw className="size-4" />, color: "green",
            hint: t("customers:customers.kpi.repeatHint", { repeat: stats.repeatBuyers, withOrders: stats.withOrders }) },
          { label: t("customers:customers.kpi.owe"), value: formatCurrency(stats.totalDue), icon: <Clock className="size-4" />, color: "red",
            hint: t("customers:customers.kpi.oweHint", { count: stats.owing }), onClick: () => changeTab("due"), active: tab === "due" },
          { label: t("customers:customers.kpi.avgLtv"), value: formatCurrency(stats.avgLifetimeValue), icon: <Banknote className="size-4" />, color: "yellow", hint: t("customers:customers.kpi.avgLtvHint") },
          { label: t("customers:customers.kpi.atRisk"), value: stats.atRisk, icon: <AlertTriangle className="size-4" />, color: "yellow", hint: t("customers:customers.kpi.atRiskHint"),
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
                { value: "all", label: t("common:status.all"), count: stats?.total },
                { value: "inactive", label: t("customers:customers.tabs.inactive"), count: stats?.inactive },
                { value: "loyal", label: t("customers:customers.tabs.loyal"), count: stats?.loyal },
                { value: "risk", label: t("customers:customers.tabs.risk"), count: stats?.atRisk },
                { value: "due", label: t("customers:customers.tabs.due"), count: stats?.owing },
                { value: "never", label: t("customers:customers.tabs.never"), count: stats?.never },
                { value: "dup", label: t("customers:customers.tabs.dup"), count: stats?.duplicates },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <div className="relative min-w-[240px] flex-1">
              <Label htmlFor="customer-search" className="sr-only">{t("customers:customers.searchLabel")}</Label>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="customer-search" type="search" placeholder={t("customers:customers.searchPlaceholder")} value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-8" />
            </div>
            <Select value={groupFilter} onValueChange={(v) => { setGroupFilter(v); setPage(1) }}>
              <SelectTrigger aria-label={t("customers:customers.filter.group")} className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("customers:customers.filter.groupAll")}</SelectItem>
                <SelectItem value="retail">{t("customers:shared.groups.retail")}</SelectItem>
                <SelectItem value="wholesale">{t("customers:shared.groups.wholesale")}</SelectItem>
                <SelectItem value="vip">{t("customers:shared.groups.vip")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
              <SelectTrigger aria-label={t("customers:customers.filter.type")} className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("customers:customers.filter.typeAll")}</SelectItem>
                <SelectItem value="individual">{t("customers:shared.types.individual")}</SelectItem>
                <SelectItem value="business">{t("customers:shared.types.business")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1) }}>
              <SelectTrigger aria-label={t("customers:customers.filter.sort")} className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">{t("customers:customers.filter.sortRecent")}</SelectItem>
                <SelectItem value="name">{t("customers:customers.filter.sortName")}</SelectItem>
                <SelectItem value="spent">{t("customers:customers.filter.sortSpent")}</SelectItem>
                <SelectItem value="orders">{t("customers:customers.filter.sortOrders")}</SelectItem>
                <SelectItem value="due">{t("customers:customers.filter.sortDue")}</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button type="button" variant="ghost" onClick={resetFilters}>
                <X className="size-4" aria-hidden /> {t("common:actions.clear")}
              </Button>
            )}
          </div>

          <BulkBar count={checked.size} label={t("common:table.selected", { count: checked.size })} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setActive(selected, "active")}>{t("customers:customers.bulk.markActive")}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setActive(selected, "inactive")}>{t("customers:customers.bulk.markInactive")}</Button>
              <Button type="button" variant="outline" size="sm" onClick={openMergeSelected}>{t("customers:customers.bulk.merge")}</Button>
              <Button type="button" variant="outline" size="sm" onClick={copySmsSelected}>{t("customers:customers.copySms")}</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setTagOpen(true)}>{t("customers:customers.bulk.addTag")}</Button>
              {mayExport && <Button type="button" variant="outline" size="sm" onClick={() => handleExport(true)}>{t("customers:customers.exportSelected")}</Button>}
              <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTargets(selected)}>{t("common:actions.delete")}</Button>
          </BulkBar>

          <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="w-5"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label={t("common:actions.selectAll")} /></TableHead>
                  <TableHead scope="col">{t("common:fields.customer")}</TableHead>
                  <TableHead scope="col">{t("customers:customers.cols.contact")}</TableHead>
                  <TableHead scope="col">{t("customers:customers.cols.group")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("customers:customers.cols.orders")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("customers:customers.cols.spent")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("common:money.due")}</TableHead>
                  <TableHead scope="col">{t("customers:customers.cols.lastOrder")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("common:fields.actions")}</TableHead>
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
                        title={t("customers:customers.empty.title")}
                        description={hasFilters ? t("customers:shared.tryClearing") : t("customers:customers.empty.first")}
                        className="p-4 md:p-6"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((c) => {
                    const grp = GROUP_STYLE[groupOf(c)]
                    const seg = segmentOf(c)
                    const due = Number(c.dueAmount) || 0
                    const ck = checked.has(c.id)
                    const sinceDate = new Date(c.createdAt).toLocaleDateString(locale, { month: "short", year: "numeric" })
                    return (
                      <TableRow key={c.id} data-state={ck || c.id === openId ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox checked={ck} onCheckedChange={() => toggleOne(c.id)} aria-label={t("common:extra.selectRow", { name: c.name })} />
                        </TableCell>
                        <TableCell>
                          <Button type="button" variant="ghost" onClick={() => setOpenId(c.id)} className="h-auto justify-start gap-2.5 text-left">
                            <UserAvatar name={c.name} className="size-9 shrink-0" />
                            <span className="flex flex-col">
                              <span className="flex items-center gap-1.5 font-semibold">
                                {c.name}
                                {c.status === "inactive" && <Badge variant="outline">{t("common:status.inactive")}</Badge>}
                                {c.duplicatePhone && <Badge variant="secondary">{t("customers:customers.row.duplicate")}</Badge>}
                              </span>
                              <span className="text-xs text-muted-foreground">{c.type === "business"
                                ? t("customers:customers.row.businessSince", { business: c.businessName || t("customers:shared.types.business"), date: sinceDate })
                                : t("customers:customers.row.since", { date: sinceDate })}</span>
                            </span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div>{c.phone || "—"}</div>
                          <div className="text-xs text-muted-foreground">{c.email || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={grp?.variant ?? "outline"}>{grp ? t(grp.label) : groupOf(c)}</Badge>
                          {c.type === "business" && <Badge variant="outline" className="ml-1">{t("customers:shared.types.business")}</Badge>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c.totalOrders ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(Number(c.totalSpent) || 0)}</TableCell>
                        <TableCell className={cn("text-right tabular-nums", due > 0 && "text-destructive")}>
                          {due > 0 ? formatCurrency(due) : "—"}
                        </TableCell>
                        <TableCell>
                          <div>{c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString(locale, { month: "short", day: "numeric" }) : "—"}</div>
                          <Badge variant={seg.variant} className="mt-0.5">{t(seg.text)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {c.phone ? (
                              <WithTooltip content={t("customers:customers.row.call", { name: c.name })}><Button asChild variant="outline" size="icon"><a href={`tel:${c.phone}`} aria-label={t("customers:customers.row.call", { name: c.name })}><Phone className="size-4" /></a></Button></WithTooltip>
                            ) : (
                              <Button type="button" variant="outline" size="icon" disabled aria-hidden tabIndex={-1}><Phone className="size-4" /></Button>
                            )}
                            <WithTooltip content={t("customers:customers.row.newSale", { name: c.name })}><Button asChild variant="outline" size="icon"><Link href={`/dashboard/sales?new=1&customer=${c.id}`} aria-label={t("customers:customers.row.newSale", { name: c.name })}><Plus className="size-4" /></Link></Button></WithTooltip>
                            <DropdownMenu>
                              <WithTooltip content={t("customers:customers.row.more", { name: c.name })}><DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="icon" aria-label={t("customers:customers.row.more", { name: c.name })}><MoreHorizontal className="size-4" /></Button>
                              </DropdownMenuTrigger></WithTooltip>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openForm(c)}>{t("customers:customers.row.edit")}</DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href={`/dashboard/orders?customer=${encodeURIComponent(c.name)}`}>{t("customers:customers.row.viewOrders")}</Link></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setActive([c], c.status === "active" ? "inactive" : "active")}>
                                  {c.status === "active" ? t("customers:customers.bulk.markInactive") : t("customers:customers.bulk.markActive")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargets([c])}>{t("customers:customers.row.delete")}</DropdownMenuItem>
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
        <aside aria-label={t("customers:detail.aria")} className="min-w-0 flex-[1_1_320px] lg:sticky lg:top-0 lg:max-w-[400px]">
          <Card className="gap-0 py-0">
          {!open ? (
            <EmptyState title={loading ? t("common:status.loading") : t("customers:detail.select")} className="p-6 md:p-6" />
          ) : (() => {
            const v: CustomerResponse = detail && detail.id === open.id ? { ...open, ...detail } : open
            const due = Number(v.dueAmount) || 0
            const grp = GROUP_STYLE[groupOf(v)]
            const grpLabel = grp ? t(grp.label) : groupOf(v)
            const sinceDate = new Date(v.createdAt).toLocaleDateString(locale, { month: "short", year: "numeric" })
            const addr = [v.address, v.area || v.state, v.district || v.city, v.zipCode, v.country].filter(Boolean).join(", ")
            const limit = Number(v.creditLimit) || 0
            const used = Number(v.creditUsed ?? due) || 0
            const pct = Math.round(v.creditUsedPercent ?? (limit > 0 ? (used / limit) * 100 : 0))
            const recent = v.recentOrders ?? []
            // [stable key, translated label, value]
            const rows: [string, string, string][] = [
              ["phone", t("common:fields.phone"), v.phone || "—"],
              ["email", t("common:fields.email"), v.email || "—"],
              ...(v.type === "business" ? [["business", t("customers:detail.business"), v.businessName || "—"], ["licence", t("customers:detail.licence"), v.licenceBin || "—"]] as [string, string, string][] : []),
              ["birthday", t("customers:detail.birthday"), v.birthday ? new Date(v.birthday).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) : "—"],
              ["sms", t("customers:detail.sms"), v.smsOptIn === false ? t("customers:detail.optedOut") : t("customers:detail.optedIn")],
              ["address", t("common:fields.address"), addr || "—"],
              ["storeCredit", t("customers:detail.storeCredit"), formatCurrency(Number(v.storeCredit) || 0)],
            ]
            const spentText = formatCurrency(Number(v.totalSpent) || 0).replace(/\.00$/, "")
            const dueText = formatCurrency(due).replace(/\.00$/, "")
            // Narrow panel: amounts shrink and truncate instead of spilling over the tile edge (full value in title)
            const miniTile = "min-w-0 gap-1 p-2.5 [&_.text-2xl]:truncate [&_.text-2xl]:text-base"
            return (
              <>
                <div className="flex flex-col gap-3.5 p-[18px]">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={v.name} className="size-[52px] shrink-0" />
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 truncate text-lg font-semibold">
                        {v.name}
                        {v.status === "inactive" && <Badge variant="outline">{t("common:status.inactive")}</Badge>}
                      </h2>
                      <span className="text-sm text-muted-foreground">
                        {v.type === "business"
                          ? t("customers:detail.subtitleBusiness", { group: grpLabel, date: sinceDate })
                          : t("customers:detail.subtitle", { group: grpLabel, date: sinceDate })}
                      </span>
                    </div>
                  </div>
                  {/* Orders is a short count; give the money tiles the room */}
                  <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_minmax(0,1.2fr)] gap-2">
                    <StatTile label={t("customers:detail.orders")} value={v.totalOrders ?? 0} className={miniTile} />
                    <StatTile label={t("customers:detail.spent")} value={spentText} title={spentText} className={miniTile} />
                    <StatTile label={t("common:money.due")} value={dueText} title={dueText} className={cn(miniTile, due > 0 && "border-destructive/50 text-destructive")} />
                  </div>
                  {limit > 0 && (
                    <div>
                      <div className="mb-1 flex justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-muted-foreground">{t("customers:detail.creditLimit", { amount: formatCurrency(limit) })}</span>
                        <span className={cn("shrink-0 font-semibold", pct >= 80 && "text-destructive")}>{t("customers:detail.creditUsed", { pct })}</span>
                      </div>
                      <Progress
                        value={Math.min(pct, 100)}
                        aria-label={t("customers:detail.creditUsedLabel")}
                        className={cn(pct >= 80 && "[&>[data-slot=progress-indicator]]:bg-destructive")}
                      />
                    </div>
                  )}
                  {/* Main actions get half the panel each; housekeeping actions sit below with Delete as an icon */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild className="w-full min-w-0">
                      <Link href={`/dashboard/sales?new=1&customer=${v.id}`}>
                        <Plus className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{t("customers:detail.newSale")}</span>
                      </Link>
                    </Button>
                    <WithTooltip content={due <= 0 ? t("customers:detail.nothingDue") : undefined}>
                      <span tabIndex={due <= 0 ? 0 : undefined} className="grid min-w-0">
                        <Button type="button" variant="outline" className="w-full min-w-0" disabled={due <= 0} onClick={() => setPayOpen((o) => !o)} aria-expanded={payOpen}>
                          <span className="truncate">{t("customers:detail.getPayment")}</span>
                        </Button>
                      </span>
                    </WithTooltip>
                  </div>
                  {payOpen && due > 0 && (
                    <GetPaymentForm customerId={v.id} due={due} onCancel={() => setPayOpen(false)} onPaid={() => { setPayOpen(false); refresh() }} />
                  )}
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
                    <Button type="button" variant="outline" className="w-full min-w-0" onClick={() => openForm(v)}>
                      <Pencil className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">{t("common:actions.edit")}</span>
                    </Button>
                    <Button type="button" variant="outline" className="w-full min-w-0" onClick={() => setActive([v], v.status === "inactive" ? "active" : "inactive")}>
                      <span className="truncate">{v.status === "inactive" ? t("customers:customers.bulk.markActive") : t("customers:customers.bulk.markInactive")}</span>
                    </Button>
                    <WithTooltip content={t("common:actions.delete")}>
                      <Button type="button" variant="outline" size="icon" aria-label={`${t("common:actions.delete")} ${v.name}`} onClick={() => setDeleteTargets([v])} className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white">
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </WithTooltip>
                  </div>
                </div>

                <Separator />
                <div className="p-[18px]">
                  <SectionTitle className="mb-2.5">{t("customers:detail.contact")}</SectionTitle>
                  <InfoList className="gap-3">
                    {rows.map(([k, label, val]) => <InfoRow key={k} label={label} value={val} />)}
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
                  <SectionTitle className="mb-2.5">{t("customers:detail.recentOrders")}</SectionTitle>
                  {detailLoading && !detail ? (
                    <Skeleton className="h-12" />
                  ) : recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("customers:detail.noOrders")}</p>
                  ) : (
                    <ItemGroup>
                      {recent.slice(0, 5).map((o, i) => (
                        <div key={o.id} role="listitem">
                          {i > 0 && <ItemSeparator />}
                          <Item size="sm" className="px-0">
                            <ItemContent>
                              <ItemTitle>#{o.invoiceNo}</ItemTitle>
                              <ItemDescription>{new Date(o.date).toLocaleDateString(locale, { month: "short", day: "numeric" })}</ItemDescription>
                            </ItemContent>
                            <ItemActions className="flex-col items-end gap-1">
                              <span className="text-sm font-semibold tabular-nums">{formatCurrency(Number(o.amount))}</span>
                              <StatusBadge status={o.status} label={(() => { const k = orderStatusKey(o.status); return k ? t(k) : o.status })()} />
                            </ItemActions>
                          </Item>
                        </div>
                      ))}
                    </ItemGroup>
                  )}
                  {recent.length > 0 && (
                    <Button asChild variant="link" className="mt-2 h-auto p-0">
                      <Link href={`/dashboard/orders?customer=${encodeURIComponent(v.name)}`}>{t("customers:detail.viewAllOrders")}</Link>
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

      <MergeDialog open={mergeOpen} onOpenChange={setMergeOpen} groups={mergeGroups} loading={mergeLoading}
        title={mergeCount === null ? undefined : t("customers:merge.titleSelected", { count: mergeCount })}
        onMerged={() => { setChecked(new Set()); refresh() }} />

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("customers:customers.tag.title")}</DialogTitle>
            <DialogDescription>{t("customers:customers.tag.description", { count: selected.length })}</DialogDescription>
          </DialogHeader>
          <Input autoFocus aria-label={t("customers:customers.tag.label")} value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder={t("customers:customers.tag.placeholder")}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyTag() } }} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTagOpen(false)}>{t("common:actions.cancel")}</Button>
            <Button type="button" onClick={applyTag} disabled={!tagDraft.trim()}>{t("customers:customers.tag.title")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("customers:import.title")}</DialogTitle>
            <DialogDescription>{t("customers:import.description")}</DialogDescription>
          </DialogHeader>
          <Input ref={fileRef} type="file" accept=".csv" aria-label={t("customers:import.file")} onChange={handleImport} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>{t("common:actions.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && setDeleteTargets([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:confirm.deleteTitle", { name: deleteTargets.length === 1 ? deleteTargets[0].name : t("customers:customers.delete.many", { count: deleteTargets.length }) })}</AlertDialogTitle>
            <AlertDialogDescription>{t("customers:customers.delete.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? t("customers:customers.delete.deleting") : t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
