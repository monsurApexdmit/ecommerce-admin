"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
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
import { AD_SOURCE_FILTERS, AdSourceBadge, OrderFlagBadges, adSourceText, campaignHint, isAdSourceFilter } from "@/components/sales/ad-source"
import { ORDERS_NS, channelLabel, methodLabel, orderStatusLabel, payLabel, type OrdersKey } from "@/components/sales/i18n"
import { localeTag } from "@/lib/i18n"
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

const SOURCES: { value: Source; label: OrdersKey }[] = [
  { value: "all", label: "orders:filters.allSources" },
  { value: "pos", label: "orders:labels.pos" },
  { value: "online", label: "orders:labels.online" },
  { value: "sales", label: "orders:labels.manual" },
]

const PAYMENTS: { value: Pay; label: OrdersKey }[] = [
  { value: "all", label: "orders:filters.paymentAll" },
  { value: "paid", label: "common:payment.paid" },
  { value: "partial", label: "orders:labels.partial" },
  { value: "unpaid", label: "common:payment.unpaid" },
]

/** Payment method filter values (sent to the API); labels via `methodLabel`. */
const METHOD_FILTERS = ["Cash", "Card", "Online", "COD", "bKash", "Nagad", "Bank"]

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

/** Shipment status codes → label keys (unknown codes are humanized). */
const SHIPMENT_STATUS_KEY: Record<string, OrdersKey> = {
  pending: "orders:shipments.status.pending",
  picked_up: "orders:shipments.status.picked_up",
  in_transit: "orders:shipments.status.in_transit",
  out_for_delivery: "orders:shipments.status.out_for_delivery",
  delivered: "orders:shipments.status.delivered",
  failed: "orders:shipments.status.failed",
  returned: "orders:shipments.status.returned",
}

const SOURCE_CHIP: Record<string, { label: OrdersKey; variant: "default" | "secondary" | "outline" }> = {
  pos: { label: "orders:labels.pos", variant: "secondary" },
  storefront: { label: "orders:labels.onlineStore", variant: "default" },
  manual: { label: "orders:labels.manual", variant: "outline" },
}

function ageOf(iso: string): { days: number; hours: number } {
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86_400_000)
  if (days >= 1) return { days, hours: 0 }
  return { days: 0, hours: Math.floor(ms / 3_600_000) }
}

export default function OrdersPage() {
  const { t, i18n } = useTranslation(ORDERS_NS)
  const tag = localeTag(i18n.language)
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
  const [adSource, setAdSource] = useState("all")
  /** ?campaignLinkId= from the Ad order links page (orders of one link) */
  const [campaignLinkId, setCampaignLinkId] = useState<number | null>(null)
  const [adCounts, setAdCounts] = useState<Record<string, number>>({})
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

  // Deep links: ?status= (all 7), ?customer= / ?q= / ?search=, ?source=, ?pay=, ?method=
  useEffect(() => {
    const st = searchParams.get("status")?.toLowerCase()
    if (st) {
      const tv = st === "processing" ? "Confirmed" : TAB_VALUES.find((v) => v.toLowerCase() === st)
      if (tv) { setTab(tv); setPage(1) }
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
    const method = searchParams.get("method")
    if (method) {
      const m = METHOD_FILTERS.find((x) => x.toLowerCase() === method.toLowerCase())
      if (m) { setMethodFilter(m); setPage(1) }
    }
    if (searchParams.get("followUp")?.toLowerCase() === "due") { setDueOnly(true); setPage(1) }
    const ad = searchParams.get("adSource")?.toLowerCase()
    if (ad && isAdSourceFilter(ad)) { setAdSource(ad); setPage(1) }
    const linkId = Number(searchParams.get("campaignLinkId"))
    if (linkId > 0) { setCampaignLinkId(linkId); setPage(1) }
  }, [searchParams])

  const filterParams = useCallback(() => {
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (tab !== "all") params.status = tab.toLowerCase()
    if (source !== "all") params.source = source
    if (adSource !== "all") params.adSource = adSource
    if (campaignLinkId) params.campaignLinkId = String(campaignLinkId)
    if (payFilter !== "all") params.payment = payFilter
    if (methodFilter !== "all") params.method = methodFilter
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    if (dueOnly) params.followUp = "due"
    return params
  }, [search, tab, source, adSource, campaignLinkId, payFilter, methodFilter, startDate, endDate, dueOnly])

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
    setAdCounts(meta.adSourceCounts && typeof meta.adSourceCounts === "object" ? meta.adSourceCounts : {})
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
  const hasFilters = !!(search || source !== "all" || adSource !== "all" || campaignLinkId || payFilter !== "all" || methodFilter !== "all" || startDate || endDate || tab !== "all" || dueOnly)

  const resetFilters = () => {
    setSearch(""); setTab("all"); setSource("all"); setAdSource("all"); setCampaignLinkId(null); setPayFilter("all"); setMethodFilter("all"); setDueOnly(false)
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
    printSaleInvoice(await fullOrder(order), { formatCurrency, taxId: settings?.taxId }, i18n.language)
  const openDetail = async (order: SellResponse) => {
    setSelected(order)
    const full = await fullOrder(order)
    if (full !== order) setSelected(full)
  }

  const report = (results: PromiseSettledResult<unknown>[], okTitle: string) => {
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: t("orders:toast.someFailed"), description: t("orders:toast.failedOf", { failed, total: results.length }) })
    else toast({ title: okTitle, description: t("orders:list.updated", { count: results.length }) })
    setChecked(new Set())
    refresh()
  }

  const cancelOrders = async (targets: SellResponse[]) => {
    const eligible = targets.filter((o) => !["Cancelled", "Delivered", "Completed"].includes(orderStage(o)))
    if (eligible.length === 0) { toast({ variant: "destructive", title: t("orders:list.nothingToCancel"), description: t("orders:list.cannotCancel") }); return }
    if (!window.confirm(t("orders:list.cancelConfirm", { count: eligible.length }))) return
    report(await Promise.allSettled(eligible.map((o) => sellsApi.updateStatus(o.id, "Cancelled"))), t("common:orderStatus.cancelled"))
  }

  const confirmOrders = async (targets: SellResponse[]) => {
    const eligible = targets.filter((o) => orderStage(o) === "Pending")
    if (eligible.length === 0) { toast({ variant: "destructive", title: t("orders:list.nothingToConfirm"), description: t("orders:list.onlyPending") }); return }
    report(await Promise.allSettled(eligible.map((o) => sellsApi.updateStatus(o.id, "Processing"))), t("common:orderStatus.confirmed"))
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
      toast({ title: t("orders:toast.markedAs", { status: orderStatusLabel(t, to) }), description: `#${o.invoiceNo}` })
    } catch (err: any) {
      toast({ variant: "destructive", title: t("orders:toast.couldNotUpdate"), description: err?.response?.data?.message || t("orders:toast.tryAgain") })
    }
    refresh()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await sellsApi.delete(deleteTarget.id)
      toast({ title: t("orders:list.orderDeleted"), description: `#${deleteTarget.invoiceNo}` })
      setDeleteTarget(null)
      if (selected?.id === deleteTarget.id) setSelected(null)
      refresh()
    } catch (err: any) {
      toast({ variant: "destructive", title: t("orders:list.couldNotDelete"), description: err?.response?.data?.message || t("orders:toast.tryAgain") })
    } finally {
      setDeleting(false)
    }
  }

  /** CSV columns: row field → header key. exportToCSV maps each header to a field by lower-casing it, so rows are keyed by the translated header. */
  const EXPORT_COLUMNS: [keyof ReturnType<typeof toExportRow>, OrdersKey][] = [
    ["invoice", "orders:export.invoice"], ["date", "orders:export.date"], ["customer", "orders:export.customer"], ["phone", "orders:export.phone"],
    ["channel", "orders:export.channel"], ["ad_source", "orders:export.adSource"], ["campaign", "orders:export.campaign"], ["status", "orders:export.status"],
    ["payment", "orders:export.payment"], ["method", "orders:export.method"], ["items", "orders:export.items"], ["delivery_address", "orders:export.deliveryAddress"],
    ["subtotal", "orders:export.subtotal"], ["discount", "orders:export.discount"], ["tax", "orders:export.tax"], ["delivery", "orders:export.delivery"],
    ["total", "orders:export.total"], ["paid", "orders:export.paid"], ["due", "orders:export.due"],
  ]

  const toExportRow = (o: SellResponse) => {
    const total = num(o.amount), delivery = num(o.shippingCost), discount = num(o.discount)
    const lines = (o.items ?? []).reduce((n, it) => n + num(it.unit_price ?? it.unitPrice ?? it.price) * (it.quantity ?? 1), 0)
    const subtotal = o.items?.length ? lines : total - delivery + discount
    const tax = o.items?.length ? Math.max(0, Math.round((total - (subtotal - discount + delivery)) * 100) / 100) : 0
    const pay = salePayment(o)
    return {
      invoice: o.invoiceNo,
      date: new Date(o.orderTime).toLocaleString(tag),
      customer: o.customerName,
      phone: o.shippingPhone ?? "",
      channel: SOURCE_CHIP[o.source ?? "manual"] ? t(SOURCE_CHIP[o.source ?? "manual"].label) : o.source ?? "",
      ad_source: (o.adSource === "phone" || o.adSource === "other" ? "" : o.adSourceLabel) || adSourceText(t, o.adSource),
      campaign: o.campaignLink?.name || o.utmCampaign || "",
      status: orderStatusLabel(t, orderStage(o)),
      payment: o.status === "Cancelled" ? t("common:orderStatus.cancelled") : payLabel(t, pay.label === "Due" ? "Unpaid" : pay.label),
      method: methodLabel(t, o.method),
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
      if (rows.length === 0) { toast({ title: t("orders:toast.nothingToExport") }); return }
      const headers = EXPORT_COLUMNS.map(([, key]) => t(key))
      const csvKey = (h: string) => h.toLowerCase().replace(/ /g, "_")
      exportToCSV(
        rows.map((o) => { const r = toExportRow(o); return Object.fromEntries(EXPORT_COLUMNS.map(([field], i) => [csvKey(headers[i]), r[field]])) }),
        "orders", headers,
      )
    } catch (err: any) {
      toast({ variant: "destructive", title: t("orders:toast.exportFailed"), description: err?.response?.data?.message })
    } finally {
      setExporting(false)
    }
  }

  const printSelectedInvoices = async () => { for (const o of selectedOrders) await printInvoice(o) }
  const printSlips = async () => printPackingSlips(await Promise.all(selectedOrders.map(fullOrder)), i18n.language)

  const hasLiveShipment = (o: SellResponse) => !!o.shipments?.some(isLiveShipment)
  const canShipOrder = (o: SellResponse) =>
    o.source !== "pos" && ["Pending", "Confirmed", "Packed"].includes(orderStage(o)) && !hasLiveShipment(o)
  const firstShippable = selectedOrders.find(canShipOrder)

  const oldestAge = oldestPending ? ageOf(oldestPending) : null
  const oldestText = !oldestAge ? ""
    : oldestAge.days >= 1 ? t("orders:list.oldestDays", { count: oldestAge.days })
    : oldestAge.hours >= 1 ? t("orders:list.oldestHours", { count: oldestAge.hours }) : ""
  const ageText = (a: { days: number; hours: number }) =>
    a.days >= 1 ? t("orders:time.daysAgo", { count: a.days }) : a.hours >= 1 ? t("orders:time.hoursAgo", { count: a.hours }) : t("orders:time.justNow")
  const shipmentStatusText = (st?: string) => {
    const key = SHIPMENT_STATUS_KEY[String(st ?? "").toLowerCase()]
    return key ? t(key) : humanize(st)
  }
  const createShipment = (id: number) => router.push(`/dashboard/orders/shipments?new=1&order=${id}`)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <PageHeader
        title={t("orders:list.title")}
        description={t("orders:list.description")}
        actions={<>
          {mayExport && <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="size-4" aria-hidden /> {exporting ? t("orders:list.exporting") : t("common:actions.export")}
          </Button>}
          <Button asChild variant="outline">
            <Link href="/dashboard/orders/shipments">{t("orders:list.shipments")}</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/sales?new=1"><Plus className="size-4" aria-hidden /> {t("orders:list.createOrder")}</Link>
          </Button>
        </>}
      />

      {/* Needs-action banner */}
      {stats && stats.pending > 0 && (
        <Alert>
          <Clock aria-hidden />
          <AlertTitle>{t("orders:list.needAction", { count: stats.pending })}</AlertTitle>
          <AlertDescription>
            <p>{oldestText ? `${oldestText} ` : ""}{t("orders:list.confirmToStart")}</p>
            <Button type="button" size="sm" className="mt-2" onClick={() => changeTab("Pending")}>
              {t("orders:list.reviewPending")}
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
            { label: t("orders:list.kpi.totalOrders"), value: stats.total, icon: <ShoppingCart className="size-4" />, color: "blue", hint: t("orders:list.kpi.last30", { count: stats.last30 }),
              active: tab === "all", onClick: () => changeTab("all") },
            { label: t("orders:list.kpi.needsAction"), value: stats.pending, icon: <Clock className="size-4" />, color: "yellow", hint: t("orders:list.kpi.pendingConfirmation"),
              active: tab === "Pending", onClick: () => changeTab("Pending") },
            { label: t("common:orderStatus.processing"), value: stats.processing, icon: <Package className="size-4" />, color: "blue", hint: t("orders:list.kpi.confirmedOrPacked"),
              active: tab === "Confirmed", onClick: () => changeTab("Confirmed") },
            { label: t("common:orderStatus.shipped"), value: stats.shipped, icon: <Truck className="size-4" />, color: "purple", hint: t("orders:list.kpi.withCourier"),
              active: tab === "Shipped", onClick: () => changeTab("Shipped") },
            { label: t("common:orderStatus.delivered"), value: stats.delivered, icon: <CheckCircle2 className="size-4" />, color: "green", hint: t("common:orderStatus.completed"),
              active: tab === "Delivered", onClick: () => changeTab("Delivered") },
            { label: t("orders:list.kpi.revenue"), value: formatCurrency(stats.revenue), icon: <Banknote className="size-4" />, color: "green",
              hint: stats.unpaid
                ? t("orders:list.kpi.dueToCollectUnpaid", { amount: formatCurrency(stats.due), count: stats.unpaid })
                : t("orders:list.kpi.dueToCollect", { amount: formatCurrency(stats.due) }) },
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
              { value: "all", label: t("common:status.all"), count: tabCounts.all },
              ...TAB_VALUES.map((v) => ({ value: v, label: orderStatusLabel(t, v), count: tabCounts[v] })),
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="orders-search" className="sr-only">{t("orders:list.searchLabel")}</Label>
            <Input
              id="orders-search"
              type="search"
              placeholder={t("orders:filters.searchPlaceholder")}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-8"
            />
          </div>
          <SegmentedControl
            aria-label={t("orders:filters.source")}
            value={source}
            onValueChange={(v) => { setSource(v as Source); setPage(1) }}
            options={SOURCES.map((o) => ({ value: o.value, label: t(o.label) }))}
          />
          <Select value={adSource} onValueChange={(v) => { setAdSource(v); setPage(1) }}>
            <SelectTrigger aria-label={t("orders:filters.adSource")} className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AD_SOURCE_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {adSourceText(t, f.value)}{f.value !== "all" && adCounts[f.value] !== undefined ? ` (${num(adCounts[f.value])})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={payFilter} onValueChange={(v) => { setPayFilter(v as Pay); setPage(1) }}>
            <SelectTrigger aria-label={t("orders:filters.paymentStatus")} className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENTS.map((p) => <SelectItem key={p.value} value={p.value}>{t(p.label)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1) }}>
            <SelectTrigger aria-label={t("common:payment.method")} className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders:filters.methodAll")}</SelectItem>
              {METHOD_FILTERS.map((m) => <SelectItem key={m} value={m}>{methodLabel(t, m)}</SelectItem>)}
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
            <PhoneCall className="size-4" aria-hidden /> {t("orders:list.followUpDue")}
            {followUpDue !== null && (
              <Badge variant={dueOnly ? "secondary" : followUpDue > 0 ? "destructive" : "outline"} className="tabular-nums">{followUpDue}</Badge>
            )}
          </Button>
          {campaignLinkId && (
            <Badge variant="secondary" className="h-9 gap-1.5 pr-1 text-sm">
              {orders.find((o) => o.campaignLinkId === campaignLinkId)?.campaignLink?.name ?? t("orders:list.orderLink", { id: campaignLinkId })}
              <WithTooltip content={t("orders:list.showAllOrders")}>
                <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={t("orders:list.removeLinkFilter")}
                  onClick={() => { setCampaignLinkId(null); setPage(1); router.replace("/dashboard/orders") }}>
                  <X className="size-3.5" />
                </Button>
              </WithTooltip>
            </Badge>
          )}
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <X className="size-4" aria-hidden /> {t("common:actions.clear")}
            </Button>
          )}
        </div>

        {/* Bulk actions */}
        <BulkBar count={checked.size} label={t("common:table.selected", { count: checked.size })} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
            <Button type="button" variant="outline" size="sm" onClick={() => confirmOrders(selectedOrders)}>
              {t("common:actions.confirm")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={printSelectedInvoices}>
              {t("orders:list.bulk.printInvoices")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={printSlips}>
              {t("orders:list.bulk.printSlips")}
            </Button>
            <WithTooltip content={firstShippable ? t("orders:list.bulk.shipInvoice", { invoice: firstShippable.invoiceNo }) : t("orders:list.bulk.noneReady")}>
              <span tabIndex={firstShippable ? undefined : 0}>
                <Button type="button" variant="outline" size="sm" disabled={!firstShippable} onClick={() => firstShippable && createShipment(firstShippable.id)}>
                  {t("orders:list.createShipment")}
                </Button>
              </span>
            </WithTooltip>
            <Button type="button" variant="destructive" size="sm" onClick={() => cancelOrders(selectedOrders)}>
              {t("orders:list.bulk.cancelOrders")}
            </Button>
            {mayExport && <Button type="button" variant="outline" size="sm" onClick={handleExport}>
              {t("orders:list.bulk.exportSelected")}
            </Button>}
        </BulkBar>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-5 pl-4">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label={t("common:actions.selectAll")} />
                </TableHead>
                <TableHead scope="col">{t("orders:list.col.order")}</TableHead>
                <TableHead scope="col">{t("common:fields.customer")}</TableHead>
                <TableHead scope="col">{t("orders:list.col.source")}</TableHead>
                <TableHead scope="col">{t("orders:list.col.payment")}</TableHead>
                <TableHead scope="col" className="text-right">{t("common:money.amount")}</TableHead>
                <TableHead scope="col">{t("common:fields.status")}</TableHead>
                <TableHead scope="col">{t("orders:list.col.shipment")}</TableHead>
                <TableHead scope="col" className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
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
                      title={t("orders:list.empty")}
                      description={hasFilters ? t("orders:filters.tryClearing") : t("orders:list.emptyHint")}
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
                  const fu = followable || (Number(o.followUpCount) || 0) > 0 ? followUpSummary(t, i18n.language, o) : null
                  const ck = checked.has(o.id)
                  return (
                    <TableRow key={o.id} data-state={ck ? "selected" : undefined}>
                      <TableCell className="pl-4">
                        <Checkbox checked={ck} onCheckedChange={() => toggleOne(o.id)} aria-label={t("orders:list.selectRow", { invoice: o.invoiceNo })} />
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">#{o.invoiceNo}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(o.orderTime).toLocaleDateString(tag, { month: "short", day: "numeric" })},{" "}
                          {new Date(o.orderTime).toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" }).toLowerCase()} ·{" "}
                          <span className={cn("font-semibold", stale && "text-destructive")}>{ageText(age)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{o.customerName}</div>
                        <div className="text-xs text-muted-foreground">{qty > 0 ? t("common:count.items", { count: qty }) : "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant={src.variant}>{t(src.label)}</Badge>
                          <AdSourceBadge source={o.adSource} label={o.adSourceLabel} title={campaignHint(t, o) || undefined} />
                        </div>
                        <OrderFlagBadges order={o} className="mt-1" />
                      </TableCell>
                      <TableCell>
                        <div>{methodLabel(t, o.method)}</div>
                        <StatusBadge
                          className="mt-0.5"
                          status={o.status === "Cancelled" ? "Cancelled" : pay.label}
                          variant={o.status === "Cancelled" ? "outline" : SALE_PAY_VARIANT[pay.label]}
                          label={o.status === "Cancelled" ? t("common:orderStatus.cancelled") : payLabel(t, pay.label === "Due" ? "Unpaid" : pay.label)}
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(o.amount))}</TableCell>
                      <TableCell>
                        <Select value={stage} disabled={stage === "Cancelled"} onValueChange={(v) => moveTo(o, v as Tab)}>
                          <SelectTrigger
                            aria-label={t("orders:list.statusFor", { invoice: o.invoiceNo })}
                            size="sm"
                            className="w-auto"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TAB_VALUES.map((v) => (
                              <SelectItem key={v} value={v} disabled={v === "Completed" && stage !== "Completed"}>{orderStatusLabel(t, v)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {fu && (
                          <div className={cn("mt-1 text-xs", fu.overdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
                            {fu.overdue ? t("orders:list.overdue", { text: fu.text }) : fu.text}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {shipment ? (
                          <div>
                            <Link href="/dashboard/orders/shipments" className="font-medium text-primary underline-offset-4 hover:underline">
                              {shipment.trackingNumber || shipment.carrier || t("orders:list.courier")}
                              {shipmentStatusText(shipment.status) ? ` · ${shipmentStatusText(shipment.status)}` : ""}
                            </Link>
                            {canShip && <Button type="button" variant="link" size="sm" className="ml-2" onClick={() => createShipment(o.id)}>{t("orders:list.plusCreate")}</Button>}
                          </div>
                        ) : o.source === "pos" ? (
                          <span className="text-muted-foreground">{t("orders:list.pickedUpInStore")}</span>
                        ) : canShip ? (
                          <Button type="button" variant="link" size="sm" onClick={() => createShipment(o.id)}>{t("orders:list.plusCreate")}</Button>
                        ) : (
                          <span className="text-muted-foreground">{t("orders:list.noShipment")}</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          <WithTooltip content={t("orders:list.viewInvoice", { invoice: o.invoiceNo })}><Button type="button" variant="outline" size="icon" aria-label={t("orders:list.viewInvoice", { invoice: o.invoiceNo })} onClick={() => openDetail(o)}><Eye className="size-4" /></Button></WithTooltip>
                          {followable && (
                            <WithTooltip content={t("orders:list.followUp")}>
                              <Button type="button" variant="outline" size="icon" aria-label={t("orders:list.followUp")} onClick={() => setFollowUpTarget(o)}><Phone className="size-4" /></Button>
                            </WithTooltip>
                          )}
                          <WithTooltip content={t("orders:list.printInvoice", { invoice: o.invoiceNo })}><Button type="button" variant="outline" size="icon" aria-label={t("orders:list.printInvoice", { invoice: o.invoiceNo })} onClick={() => printInvoice(o)}><Printer className="size-4" /></Button></WithTooltip>
                          {!["Cancelled", "Delivered", "Completed"].includes(stage) && (
                            <WithTooltip content={t("orders:list.cancelOrder")}>
                              <Button type="button" variant="outline" size="icon" aria-label={t("orders:list.cancelInvoice", { invoice: o.invoiceNo })} className="text-destructive" onClick={() => cancelOrders([o])}><XCircle className="size-4" /></Button>
                            </WithTooltip>
                          )}
                          <DropdownMenu>
                            <WithTooltip content={t("orders:list.moreFor", { invoice: o.invoiceNo })}><DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="icon" aria-label={t("orders:list.moreFor", { invoice: o.invoiceNo })}><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger></WithTooltip>
                            <DropdownMenuContent align="end">
                              {canShip && <DropdownMenuItem onClick={() => createShipment(o.id)}>{t("orders:list.createShipment")}</DropdownMenuItem>}
                              <DropdownMenuItem onClick={async () => printPackingSlips([await fullOrder(o)], i18n.language)}>{t("orders:list.printSlip")}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(o)}>{t("orders:list.deleteOrder")}</DropdownMenuItem>
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
            <AlertDialogTitle>{t("orders:list.deleteTitle", { invoice: deleteTarget?.invoiceNo ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("orders:list.deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? t("orders:list.deleting") : t("orders:list.deleteOrder")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
