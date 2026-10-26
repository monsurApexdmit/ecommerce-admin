"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Banknote, CheckCircle2, Clock, Download, Eye, MoreHorizontal, Package, Phone, PhoneCall, Plus, Printer, Search, ShoppingCart, Truck, X, XCircle,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { DateRangeFilter } from "@/components/ui/date-range-filter"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PageHeader } from "@/components/common/PageHeader"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { BulkBar } from "@/components/common/BulkBar"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusBadge } from "@/components/common/StatusBadge"
import { WithTooltip } from "@/components/common/WithTooltip"
import {
  SaleDetailDialog, SALE_PAY_VARIANT, salePayment,
} from "@/components/sales/sale-detail-dialog"
import { FollowUpDialog, canFollowUp, followUpSummary } from "@/components/sales/order-follow-up"
import { sellsApi, type SellResponse } from "@/lib/sellsApi"
import { fetchSection } from "@/lib/dashboard/api"
import { printSaleInvoice } from "@/lib/invoice-print"
import { printPackingSlips } from "@/lib/packing-slip-print"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Tab = "all" | "Pending" | "Confirmed" | "Packed" | "Shipped" | "Delivered" | "Completed" | "Cancelled"
type Source = "all" | "sales" | "pos" | "online"
type Pay = "all" | "paid" | "partial" | "unpaid"

const TAB_VALUES: Tab[] = ["Pending", "Confirmed", "Packed", "Shipped", "Delivered", "Completed", "Cancelled"]

interface Stats {
  total: number
  last30: number
  due: number
  unpaid: number
  revenue: number
  pending: number
  processing: number
  shipped: number
  delivered: number
}

const SOURCES: { value: Source; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "pos", label: "POS" },
  { value: "online", label: "Online" },
  { value: "sales", label: "Manual" },
]

const PAYMENTS: { value: Pay; label: string }[] = [
  { value: "all", label: "Payment: All" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
]

/** Derived order stage: no extra DB statuses, built from status + fulfillment + payment. */
function orderStage(o: SellResponse): Tab {
  if (o.status === "Cancelled") return "Cancelled"
  if (o.status === "Delivered") return salePayment(o).label === "Paid" ? "Completed" : "Delivered"
  if (o.fulfillmentStatus === "shipped") return "Shipped"
  if (o.fulfillmentStatus === "packed") return "Packed"
  return o.status === "Processing" ? "Confirmed" : "Pending"
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const LIVE_BLOCKERS = ["failed", "returned", "cancelled", "canceled"]
const isLiveShipment = (sh: { status?: string }) => !LIVE_BLOCKERS.includes(String(sh.status ?? "").toLowerCase())
const humanize = (v?: string) => {
  const t = String(v ?? "").replace(/[_-]+/g, " ").trim().toLowerCase()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ""
}

const SOURCE_CHIP: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  pos: { label: "POS", variant: "secondary" },
  storefront: { label: "Online store", variant: "default" },
  manual: { label: "Manual", variant: "outline" },
}

function ageOf(iso: string): { text: string; days: number } {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return { text: `${days}d ago`, days }
  const hrs = Math.floor(ms / 3_600_000)
  return { text: hrs >= 1 ? `${hrs}h ago` : "just now", days: 0 }
}

export default function OrdersPage() {
  const { formatCurrency, settings } = useCompanySettings()
  const { canRead, canDo } = useSaasAuth()
  const mayExport = canDo("export")
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [orders, setOrders] = useState<SellResponse[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [tabCounts, setTabCounts] = useState<Partial<Record<Tab | "all", number>>>({})
  const [followUpDue, setFollowUpDue] = useState<number | null>(null)
  const [dueOnly, setDueOnly] = useState(false)
  const [followUpTarget, setFollowUpTarget] = useState<SellResponse | null>(null)
  const [exporting, setExporting] = useState(false)
  const [oldestPending, setOldestPending] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [source, setSource] = useState<Source>("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [payFilter, setPayFilter] = useState<Pay>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [resetCount, setResetCount] = useState(0)

  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<SellResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SellResponse | null>(null)
  const [deleting, setDeleting] = useState(false)

  const latestFetch = useRef(0)
  const blocked = useModuleGuard("Orders")

  // Deep links: ?status= (all 7), ?customer= / ?q= / ?search=, ?source=, ?pay=
  useEffect(() => {
    const st = searchParams.get("status")?.toLowerCase()
    if (st) {
      const t = st === "processing" ? "Confirmed" : TAB_VALUES.find((v) => v.toLowerCase() === st)
      if (t) { setTab(t); setPage(1) }
    }
    const q = searchParams.get("customer") || searchParams.get("q") || searchParams.get("search")
    if (q) { setSearch(q); setPage(1) }
    const src = searchParams.get("source")?.toLowerCase()
    if (src) {
      const v = src === "manual" ? "sales" : src === "storefront" ? "online" : src
      if (["sales", "pos", "online"].includes(v)) { setSource(v as Source); setPage(1) }
    }
    const pay = searchParams.get("pay")?.toLowerCase()
    if (pay && ["paid", "partial", "unpaid"].includes(pay)) { setPayFilter(pay as Pay); setPage(1) }
    if (searchParams.get("followUp")?.toLowerCase() === "due") { setDueOnly(true); setPage(1) }
  }, [searchParams])

  const filterParams = useCallback(() => {
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (tab !== "all") params.status = tab.toLowerCase()
    if (source !== "all") params.source = source
    if (payFilter !== "all") params.payment = payFilter
    if (methodFilter !== "all") params.method = methodFilter
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    if (dueOnly) params.followUp = "due"
    return params
  }, [search, tab, source, payFilter, methodFilter, startDate, endDate, dueOnly])

  const fetchOrders = useCallback(async () => {
    const id = ++latestFetch.current
    setLoading(true)
    try {
      const res = await sellsApi.getAll({ page, per_page: perPage, ...filterParams() })
      if (id !== latestFetch.current) return
      setOrders(res.data ?? [])
      setTotal(res.total ?? res.data?.length ?? 0)
      if (res.meta) applyMeta(res.meta)
    } catch {
      if (id === latestFetch.current) setOrders([])
    } finally {
      if (id === latestFetch.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, filterParams])

  /** meta.tabCounts (respects filters except status) and meta.kpis (company-wide), per PHASE2_API_CONTRACT.md. */
  const applyMeta = (meta: Record<string, any>) => {
    const c = meta.tabCounts ?? {}
    const k = meta.kpis ?? {}
    const counts: Partial<Record<Tab, number>> = {}
    for (const t of TAB_VALUES) if (c[t.toLowerCase()] !== undefined) counts[t] = num(c[t.toLowerCase()])
    setTabCounts({ all: c.all !== undefined ? num(c.all) : undefined, ...counts })
    setFollowUpDue(c.followUpDue !== undefined ? num(c.followUpDue) : null)
    setStats({
      total: num(k.totalOrders), last30: num(k.last30Days), due: num(k.dueToCollect), unpaid: num(k.unpaidCount),
      revenue: num(k.revenue), pending: num(k.pending), processing: num(k.confirmedOrPacked),
      shipped: num(k.shipped), delivered: num(k.delivered),
    })
  }

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      // Fallback KPIs until the list response (meta.kpis) arrives
      const d = (await sellsApi.getStats()).data
      setStats((prev) => prev ?? {
        total: d.totalSells ?? 0, last30: 0, due: d.totalDue ?? 0, unpaid: d.unpaidCount ?? 0, revenue: d.totalRevenue ?? 0,
        pending: d.pendingOrders ?? 0, processing: (d.processingOrders ?? 0), shipped: d.shippedOrders ?? 0, delivered: d.deliveredOrders ?? 0,
      })
    } catch {
      /* ignore */
    } finally {
      setStatsLoading(false)
    }
    // Oldest pending order, for the "needs action" banner (needs Dashboard access; optional)
    if (canRead("Dashboard")) {
      const today = new Date().toISOString().slice(0, 10)
      fetchSection("alerts", { from: today, to: today })
        .then((a) => setOldestPending(a.pendingOrders.oldestOrderTime))
        .catch(() => setOldestPending(null))
    }
  }, [canRead])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { fetchStats() }, [fetchStats])

  if (blocked) return blocked

  const refresh = () => { fetchOrders(); fetchStats() }
  const hasFilters = !!(search || source !== "all" || payFilter !== "all" || methodFilter !== "all" || startDate || endDate || tab !== "all" || dueOnly)

  const resetFilters = () => {
    setSearch(""); setTab("all"); setSource("all"); setPayFilter("all"); setMethodFilter("all"); setDueOnly(false)
    setStartDate(""); setEndDate(""); setPage(1); setResetCount((n) => n + 1); setChecked(new Set())
  }
  const changeTab = (t: string) => { setTab(t as Tab); setPage(1); setChecked(new Set()) }

  const allChecked = orders.length > 0 && orders.every((o) => checked.has(o.id))
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(orders.map((o) => o.id)))
  const toggleOne = (id: number) =>
    setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectedOrders = orders.filter((o) => checked.has(o.id))

  const fullOrder = async (order: SellResponse): Promise<SellResponse> => {
    if (order.items?.length) return order
    try { return (await sellsApi.getById(order.id)).data } catch { return order }
  }
  const printInvoice = async (order: SellResponse) =>
    printSaleInvoice(await fullOrder(order), { formatCurrency, taxId: settings?.taxId })
  const openDetail = async (order: SellResponse) => {
    setSelected(order)
    const full = await fullOrder(order)
    if (full !== order) setSelected(full)
  }

  const report = (results: PromiseSettledResult<unknown>[], okTitle: string) => {
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: "Some updates failed", description: `${failed} of ${results.length} could not be changed` })
    else toast({ title: okTitle, description: `${results.length} order${results.length === 1 ? "" : "s"} updated` })
    setChecked(new Set())
    refresh()
  }

  const cancelOrders = async (targets: SellResponse[]) => {
    const eligible = targets.filter((o) => !["Cancelled", "Delivered", "Completed"].includes(orderStage(o)))
    if (eligible.length === 0) { toast({ variant: "destructive", title: "Nothing to cancel", description: "Delivered or cancelled orders can't be cancelled" }); return }
    if (!window.confirm(`Cancel ${eligible.length} order${eligible.length === 1 ? "" : "s"}? Stock goes back to inventory and any balance due is cleared.`)) return
    report(await Promise.allSettled(eligible.map((o) => sellsApi.updateStatus(o.id, "Cancelled"))), "Cancelled")
  }

  const confirmOrders = async (targets: SellResponse[]) => {
    const eligible = targets.filter((o) => orderStage(o) === "Pending")
    if (eligible.length === 0) { toast({ variant: "destructive", title: "Nothing to confirm", description: "Only pending orders can be confirmed" }); return }
    report(await Promise.allSettled(eligible.map((o) => sellsApi.updateStatus(o.id, "Processing"))), "Confirmed")
  }

  /** Row status select: maps each stage onto status + fulfillment calls. */
  const moveTo = async (o: SellResponse, to: Tab) => {
    const from = orderStage(o)
    if (to === from) return
    if (to === "Cancelled") { await cancelOrders([o]); return }
    try {
      if (to === "Pending") {
        if (from === "Packed" || from === "Shipped") await sellsApi.updateFulfillment(o.id, "unfulfilled")
        await sellsApi.updateStatus(o.id, "Pending")
      } else if (to === "Confirmed") {
        if (o.status === "Pending") await sellsApi.updateStatus(o.id, "Processing")
        else if (from === "Packed") await sellsApi.updateFulfillment(o.id, "unfulfilled")
      } else if (to === "Packed") {
        await sellsApi.updateFulfillment(o.id, "packed")
      } else if (to === "Shipped") {
        await sellsApi.updateFulfillment(o.id, "shipped")
      } else if (to === "Delivered") {
        await sellsApi.updateStatus(o.id, "Delivered")
      }
      toast({ title: `Marked ${to.toLowerCase()}`, description: `#${o.invoiceNo}` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not update", description: err?.response?.data?.message || "Please try again" })
    }
    refresh()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await sellsApi.delete(deleteTarget.id)
      toast({ title: "Order deleted", description: `#${deleteTarget.invoiceNo}` })
      setDeleteTarget(null)
      if (selected?.id === deleteTarget.id) setSelected(null)
      refresh()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not delete", description: err?.response?.data?.message || "Please try again" })
    } finally {
      setDeleting(false)
    }
  }

  const EXPORT_HEADERS = ["Invoice", "Date", "Customer", "Phone", "Channel", "Status", "Payment", "Method", "Items", "Delivery address", "Subtotal", "Discount", "Tax", "Delivery", "Total", "Paid", "Due"]

  const toExportRow = (o: SellResponse) => {
    const total = num(o.amount), delivery = num(o.shippingCost), discount = num(o.discount)
    const lines = (o.items ?? []).reduce((n, it) => n + num(it.unit_price ?? it.unitPrice ?? it.price) * (it.quantity ?? 1), 0)
    const subtotal = o.items?.length ? lines : total - delivery + discount
    const tax = o.items?.length ? Math.max(0, Math.round((total - (subtotal - discount + delivery)) * 100) / 100) : 0
    const pay = salePayment(o)
    return {
      invoice: o.invoiceNo,
      date: new Date(o.orderTime).toLocaleString(),
      customer: o.customerName,
      phone: o.shippingPhone ?? "",
      channel: SOURCE_CHIP[o.source ?? "manual"]?.label ?? o.source ?? "",
      status: orderStage(o),
      payment: o.status === "Cancelled" ? "Cancelled" : pay.label === "Due" ? "Unpaid" : pay.label,
      method: o.method,
      items: (o.items ?? []).reduce((n, it) => n + (it.quantity ?? 1), 0),
      delivery_address: [o.shippingAddressLine1, o.shippingAddressLine2, o.shippingCity, o.shippingState].filter(Boolean).join(", "),
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      tax: tax.toFixed(2),
      delivery: delivery.toFixed(2),
      total: total.toFixed(2),
      paid: num(o.paidAmount).toFixed(2),
      due: pay.due.toFixed(2),
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      let rows: SellResponse[] = selectedOrders
      if (rows.length === 0) {
        // Every row matching the current filters, not just this page
        for (let p = 1; p <= 500; p++) {
          const res = await sellsApi.getAll({ page: p, per_page: 100, ...filterParams() })
          rows.push(...(res.data ?? []))
          if (!res.data?.length || rows.length >= (res.total ?? 0)) break
        }
      }
      if (rows.length === 0) { toast({ title: "Nothing to export" }); return }
      exportToCSV(rows.map(toExportRow), "orders", EXPORT_HEADERS)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export failed", description: err?.response?.data?.message })
    } finally {
      setExporting(false)
    }
  }

  const printSelectedInvoices = async () => { for (const o of selectedOrders) await printInvoice(o) }
  const printSlips = async () => printPackingSlips(await Promise.all(selectedOrders.map(fullOrder)))

  const hasLiveShipment = (o: SellResponse) => !!o.shipments?.some(isLiveShipment)
  const canShipOrder = (o: SellResponse) =>
    o.source !== "pos" && ["Pending", "Confirmed", "Packed"].includes(orderStage(o)) && !hasLiveShipment(o)
  const firstShippable = selectedOrders.find(canShipOrder)

  const oldestAge = oldestPending ? ageOf(oldestPending) : null
  const createShipment = (id: number) => router.push(`/dashboard/orders/shipments?new=1&order=${id}`)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <PageHeader
        title="Orders"
        description="Every order from POS, your online store and manual sales, in one place."
        actions={<>
          {mayExport && <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="size-4" aria-hidden /> {exporting ? "Exporting…" : "Export"}
          </Button>}
          <Button asChild variant="outline">
            <Link href="/dashboard/orders/shipments">Shipments</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/sales?new=1"><Plus className="size-4" aria-hidden /> Create order</Link>
          </Button>
        </>}
      />

      {/* Needs-action banner */}
      {stats && stats.pending > 0 && (
        <Alert>
          <Clock aria-hidden />
          <AlertTitle>{stats.pending} order{stats.pending === 1 ? "" : "s"} need action.</AlertTitle>
          <AlertDescription>
            <p>{oldestAge ? `The oldest has been pending for ${oldestAge.days >= 1 ? `${oldestAge.days} days` : oldestAge.text.replace(" ago", "")}. ` : ""}Confirm them so fulfillment can start.</p>
            <Button type="button" size="sm" className="mt-2" onClick={() => changeTab("Pending")}>
              Review pending
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      {statsLoading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[118px]" />)}
        </div>
      ) : (
        <div className="[&>div]:xl:grid-cols-6">
          <StatsCards stats={[
            { label: "Total orders", value: stats.total, icon: <ShoppingCart className="size-4" />, color: "blue", hint: `${stats.last30} in last 30 days`,
              active: tab === "all", onClick: () => changeTab("all") },
            { label: "Needs action", value: stats.pending, icon: <Clock className="size-4" />, color: "yellow", hint: "Pending confirmation",
              active: tab === "Pending", onClick: () => changeTab("Pending") },
            { label: "Processing", value: stats.processing, icon: <Package className="size-4" />, color: "blue", hint: "Confirmed or packed",
              active: tab === "Confirmed", onClick: () => changeTab("Confirmed") },
            { label: "Shipped", value: stats.shipped, icon: <Truck className="size-4" />, color: "purple", hint: "With courier",
              active: tab === "Shipped", onClick: () => changeTab("Shipped") },
            { label: "Delivered", value: stats.delivered, icon: <CheckCircle2 className="size-4" />, color: "green", hint: "Completed",
              active: tab === "Delivered", onClick: () => changeTab("Delivered") },
            { label: "Revenue", value: formatCurrency(stats.revenue), icon: <Banknote className="size-4" />, color: "green",
              hint: `Due to collect ${formatCurrency(stats.due)}${stats.unpaid ? ` · ${stats.unpaid} unpaid` : ""}` },
          ]} />
        </div>
      )}

      {/* Table card */}
      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs
            value={tab}
            onChange={changeTab}
            tabs={[
              { value: "all", label: "All", count: tabCounts.all },
              ...TAB_VALUES.map((t) => ({ value: t, label: t, count: tabCounts[t] })),
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="orders-search" className="sr-only">Search orders</Label>
            <Input
              id="orders-search"
              type="search"
              placeholder="Search invoice, customer or phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-8"
            />
          </div>
          <SegmentedControl
            aria-label="Source"
            value={source}
            onValueChange={(v) => { setSource(v as Source); setPage(1) }}
            options={SOURCES}
          />
          <Select value={payFilter} onValueChange={(v) => { setPayFilter(v as Pay); setPage(1) }}>
            <SelectTrigger aria-label="Payment status" className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENTS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1) }}>
            <SelectTrigger aria-label="Payment method" className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Method: All</SelectItem>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="Card">Card</SelectItem>
              <SelectItem value="Online">Online</SelectItem>
              <SelectItem value="COD">COD</SelectItem>
              <SelectItem value="bKash">bKash</SelectItem>
              <SelectItem value="Nagad">Nagad</SelectItem>
              <SelectItem value="Bank">Bank</SelectItem>
            </SelectContent>
          </Select>
          <DateRangeFilter
            key={resetCount}
            start={startDate}
            end={endDate}
            onChange={(a, b) => { setStartDate(a); setEndDate(b); setPage(1) }}
            className="flex flex-wrap items-center gap-2"
          />
          <Button
            type="button"
            variant={dueOnly ? "default" : "outline"}
            aria-pressed={dueOnly}
            onClick={() => { setDueOnly((v) => !v); setPage(1); setChecked(new Set()) }}
          >
            <PhoneCall className="size-4" aria-hidden /> Follow-up due
            {followUpDue !== null && (
              <Badge variant={dueOnly ? "secondary" : followUpDue > 0 ? "destructive" : "outline"} className="tabular-nums">{followUpDue}</Badge>
            )}
          </Button>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <X className="size-4" aria-hidden /> Clear
            </Button>
          )}
        </div>

        {/* Bulk actions */}
        <BulkBar count={checked.size} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
            <Button type="button" variant="outline" size="sm" onClick={() => confirmOrders(selectedOrders)}>
              Confirm
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={printSelectedInvoices}>
              Print invoices
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={printSlips}>
              Print packing slips
            </Button>
            <WithTooltip content={firstShippable ? `Ship #${firstShippable.invoiceNo}` : "No selected order is ready to ship"}>
              <span tabIndex={firstShippable ? undefined : 0}>
                <Button type="button" variant="outline" size="sm" disabled={!firstShippable} onClick={() => firstShippable && createShipment(firstShippable.id)}>
                  Create shipment
                </Button>
              </span>
            </WithTooltip>
            <Button type="button" variant="destructive" size="sm" onClick={() => cancelOrders(selectedOrders)}>
              Cancel orders
            </Button>
            {mayExport && <Button type="button" variant="outline" size="sm" onClick={handleExport}>
              Export selected
            </Button>}
        </BulkBar>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-5 pl-4">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead scope="col">Order</TableHead>
                <TableHead scope="col">Customer</TableHead>
                <TableHead scope="col">Source</TableHead>
                <TableHead scope="col">Payment</TableHead>
                <TableHead scope="col" className="text-right">Amount</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Shipment</TableHead>
                <TableHead scope="col" className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}><TableCell colSpan={9} className="px-4"><Skeleton className="h-9" /></TableCell></TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="whitespace-normal">
                    <EmptyState
                      icon={ShoppingCart}
                      title="No orders found"
                      description={hasFilters ? "Try clearing the filters." : "Orders from POS, your store and manual sales appear here."}
                      className="p-4 md:p-6"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => {
                  const pay = salePayment(o)
                  const stage = orderStage(o)
                  const age = ageOf(o.orderTime)
                  const stale = o.status === "Pending" && age.days > 7
                  const qty = o.items?.reduce((n, it) => n + (it.quantity ?? 1), 0) ?? 0
                  const src = SOURCE_CHIP[o.source ?? "pos"] ?? SOURCE_CHIP.manual
                  const shipment = o.shipments?.find(isLiveShipment) ?? o.shipments?.[0]
                  const canShip = canShipOrder(o)
                  const followable = canFollowUp(o)
                  const fu = followable || (Number(o.followUpCount) || 0) > 0 ? followUpSummary(o) : null
                  const ck = checked.has(o.id)
                  return (
                    <TableRow key={o.id} data-state={ck ? "selected" : undefined}>
                      <TableCell className="pl-4">
                        <Checkbox checked={ck} onCheckedChange={() => toggleOne(o.id)} aria-label={`Select ${o.invoiceNo}`} />
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">#{o.invoiceNo}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(o.orderTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })},{" "}
                          {new Date(o.orderTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()} ·{" "}
                          <span className={cn("font-semibold", stale && "text-destructive")}>{age.text}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{o.customerName}</div>
                        <div className="text-xs text-muted-foreground">{qty > 0 ? `${qty} item${qty === 1 ? "" : "s"}` : "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={src.variant}>{src.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>{o.method}</div>
                        <StatusBadge
                          className="mt-0.5"
                          status={o.status === "Cancelled" ? "Cancelled" : pay.label}
                          variant={o.status === "Cancelled" ? "outline" : SALE_PAY_VARIANT[pay.label]}
                          label={o.status === "Cancelled" ? "Cancelled" : pay.label === "Due" ? "Unpaid" : pay.label}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(o.amount))}</TableCell>
                      <TableCell>
                        <Select value={stage} disabled={stage === "Cancelled"} onValueChange={(v) => moveTo(o, v as Tab)}>
                          <SelectTrigger
                            aria-label={`Status for ${o.invoiceNo}`}
                            size="sm"
                            className="w-auto"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAB_VALUES.map((t) => (
                              <SelectItem key={t} value={t} disabled={t === "Completed" && stage !== "Completed"}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fu && (
                          <div className={cn("mt-1 text-xs", fu.overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
                            {fu.text}{fu.overdue ? " (overdue)" : ""}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {shipment ? (
                          <div>
                            <Link href="/dashboard/orders/shipments" className="font-medium text-primary underline-offset-4 hover:underline">
                              {shipment.trackingNumber || shipment.carrier || "Courier"}
                              {humanize(shipment.status) ? ` · ${humanize(shipment.status)}` : ""}
                            </Link>
                            {canShip && <Button type="button" variant="link" size="sm" className="ml-2" onClick={() => createShipment(o.id)}>+ Create</Button>}
                          </div>
                        ) : o.source === "pos" ? (
                          <span className="text-muted-foreground">Picked up in store</span>
                        ) : canShip ? (
                          <Button type="button" variant="link" size="sm" onClick={() => createShipment(o.id)}>+ Create</Button>
                        ) : (
                          <span className="text-muted-foreground">No shipment</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          <WithTooltip content={`View ${o.invoiceNo}`}><Button type="button" variant="outline" size="icon" aria-label={`View ${o.invoiceNo}`} onClick={() => openDetail(o)}><Eye className="size-4" /></Button></WithTooltip>
                          {followable && (
                            <WithTooltip content="Follow up">
                              <Button type="button" variant="outline" size="icon" aria-label="Follow up" onClick={() => setFollowUpTarget(o)}><Phone className="size-4" /></Button>
                            </WithTooltip>
                          )}
                          <WithTooltip content={`Print ${o.invoiceNo}`}><Button type="button" variant="outline" size="icon" aria-label={`Print ${o.invoiceNo}`} onClick={() => printInvoice(o)}><Printer className="size-4" /></Button></WithTooltip>
                          {!["Cancelled", "Delivered", "Completed"].includes(stage) && (
                            <WithTooltip content="Cancel order">
                              <Button type="button" variant="outline" size="icon" aria-label={`Cancel ${o.invoiceNo}`} className="text-destructive" onClick={() => cancelOrders([o])}><XCircle className="size-4" /></Button>
                            </WithTooltip>
                          )}
                          <DropdownMenu>
                            <WithTooltip content={`More actions for ${o.invoiceNo}`}><DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="icon" aria-label={`More actions for ${o.invoiceNo}`}><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger></WithTooltip>
                            <DropdownMenuContent align="end">
                              {canShip && <DropdownMenuItem onClick={() => createShipment(o.id)}>Create shipment</DropdownMenuItem>}
                              <DropdownMenuItem onClick={async () => printPackingSlips([await fullOrder(o)])}>Print packing slip</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(o)}>Delete order</DropdownMenuItem>
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
        </div>

        {!loading && orders.length > 0 && (
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

      <SaleDetailDialog sale={selected} onClose={() => setSelected(null)} onPrint={printInvoice} onChanged={() => refresh()} onCreateShipment={(s) => createShipment(s.id)} />

      <FollowUpDialog order={followUpTarget} onClose={() => setFollowUpTarget(null)} onSaved={() => refresh()} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order #{deleteTarget?.invoiceNo}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the order permanently. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? "Deleting…" : "Delete order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
