"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Trans, useTranslation } from "react-i18next"
import {
  Banknote, CheckCircle2, ChevronsRight, Clock, Download, Eye, MapPin, Plus, Printer, Receipt, Search, Truck, Wallet, X, XCircle,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { DateRangeFilter } from "@/components/ui/date-range-filter"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Card } from "@/components/ui/card"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/common/PageHeader"
import { BulkBar } from "@/components/common/BulkBar"
import { EmptyState } from "@/components/common/EmptyState"
import { StatusBadge } from "@/components/common/StatusBadge"
import { WithTooltip } from "@/components/common/WithTooltip"
import { saleDisplayStatus, SALE_PAY_VARIANT, SaleDetailDialog } from "@/components/sales/sale-detail-dialog"
import { RecordPaymentDialog, salePaymentDue } from "@/components/sales/record-payment-dialog"
import { NewSaleModal } from "@/components/sales/new-sale-modal"
import { AD_SOURCE_FILTERS, AdSourceBadge, OrderFlagBadges, adSourceText, campaignHint, isAdSourceFilter } from "@/components/sales/ad-source"
import { ORDERS_NS, methodLabel, orderStatusLabel, payLabel, type OrdersKey } from "@/components/sales/i18n"
import { localeTag } from "@/lib/i18n"
import { sellsApi, type SellResponse } from "@/lib/sellsApi"
import { printSaleInvoice } from "@/lib/invoice-print"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"

const PAY_STYLE = SALE_PAY_VARIANT

interface Stats {
  totalSells: number
  totalRevenue: number
  pendingOrders: number
  processingOrders: number
  deliveredOrders: number
  totalDue: number
  unpaidCount: number
  shippedOrders: number
  packedOrders: number
  cancelledOrders: number
}

type Tab = "all" | "Pending" | "Processing" | "Packed" | "Shipped" | "Delivered" | "Cancelled" | "unpaid"

const CHANNEL_LABEL: Record<string, OrdersKey> = { manual: "orders:labels.sales", pos: "orders:labels.pos", storefront: "orders:labels.online" }

/** Channel filter values (sent to the API as `source`). */
const CHANNEL_FILTERS = ["manual", "pos", "storefront"]

/** Payment method filter values (sent to the API); labels via `methodLabel`. */
const METHOD_FILTERS = ["Cash", "Card", "Online", "COD", "bKash", "Nagad", "Bank"]

/** The one-click next step for a sale, by its displayed stage (Pending, Processing, Packed, Shipped). `label` is a translation key. */
type Step = { label: OrdersKey; run: (id: number) => Promise<unknown> }
function nextStep(s: SellResponse): Step | null {
  switch (saleDisplayStatus(s)) {
    case "Pending": return { label: "orders:sales.step.confirm", run: (id) => sellsApi.updateStatus(id, "Processing") }
    case "Processing": return { label: "orders:sales.step.packed", run: (id) => sellsApi.updateFulfillment(id, "packed") }
    case "Packed": return { label: "orders:sales.step.shipped", run: (id) => sellsApi.updateFulfillment(id, "shipped") }
    case "Shipped": return { label: "orders:sales.step.delivered", run: (id) => sellsApi.updateStatus(id, "Delivered") }
    default: return null
  }
}

/** Money columns for export, derived from the sale (the API has no separate tax field). */
function moneyParts(s: SellResponse) {
  const total = Number(s.amount) || 0
  const delivery = Number(s.shippingCost) || 0
  const discount = Number(s.discount) || 0
  const lines = (s.items ?? []).reduce((n, it) => {
    const price = Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0)
    return n + price * (it.quantity ?? 1)
  }, 0)
  const subtotal = s.items?.length ? lines : total - delivery + discount
  const tax = s.taxAmount != null ? Number(s.taxAmount) : s.items?.length ? Math.max(0, Math.round((total - (subtotal - discount + delivery)) * 100) / 100) : 0
  return { subtotal, discount, tax, delivery, total }
}

function errMsg(e: unknown): string | undefined {
  return (e as any)?.response?.data?.message
}

function paymentOf(s: SellResponse): { label: keyof typeof PAY_STYLE; due: number } {
  const amount = Number(s.amount) || 0
  if (s.paymentStatus === "paid") return { label: "Paid", due: 0 }
  const due = Math.max(0, amount - (Number(s.paidAmount) || 0))
  return { label: s.paymentStatus === "partially_paid" ? "Partial" : "Due", due }
}

function shippingLines(s: SellResponse): string[] {
  return [
    s.shippingFullName || s.customerName || "",
    [s.shippingAddressLine1, s.shippingAddressLine2].filter(Boolean).join(", "),
    [s.shippingCity, s.shippingState, s.shippingPostalCode].filter(Boolean).join(", "),
    s.shippingCountry || "",
    s.shippingPhone || "",
  ].filter(Boolean)
}


export default function SalesPage() {
  const { t, i18n } = useTranslation(ORDERS_NS)
  const tag = localeTag(i18n.language)
  const { formatCurrency, settings } = useCompanySettings()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [sales, setSales] = useState<SellResponse[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [channel, setChannel] = useState("all")
  const [adSource, setAdSource] = useState("all")
  const [adCounts, setAdCounts] = useState<Record<string, number>>({})
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [resetCount, setResetCount] = useState(0)
  const [summary, setSummary] = useState<{ count: number; total: number } | null>(null)
  const [exporting, setExporting] = useState(false)

  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<SellResponse | null>(null)
  const [newOpen, setNewOpen] = useState(false)

  // Record payment dialog (one or many sales)
  const [payTargets, setPayTargets] = useState<SellResponse[]>([])

  const blocked = useModuleGuard("Orders")

  const { canDo } = useSaasAuth()

  const mayExport = canDo("export")

  useEffect(() => { if (searchParams.get("new") === "1") setNewOpen(true) }, [searchParams])
  useEffect(() => { const q = searchParams.get("q"); if (q) { setSearch(q); setPage(1) } }, [searchParams])
  useEffect(() => { const a = searchParams.get("adSource")?.toLowerCase(); if (a && isAdSourceFilter(a)) { setAdSource(a); setPage(1) } }, [searchParams])

  const filterParams = useCallback(() => {
    const params: Record<string, string> = { source: channel }
    if (search) params.search = search
    if (tab === "unpaid") params.payment = "unpaid"
    else if (paymentFilter !== "all") params.payment = paymentFilter
    if (tab === "Pending" || tab === "Processing" || tab === "Delivered" || tab === "Cancelled") params.status = tab
    if (tab === "Packed") params.fulfillment = "packed"
    if (tab === "Shipped") params.fulfillment = "shipped"
    if (methodFilter !== "all") params.method = methodFilter
    if (adSource !== "all") params.adSource = adSource
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    return params
  }, [search, tab, paymentFilter, methodFilter, channel, adSource, startDate, endDate])

  const fetchSales = useCallback(async () => {
    setLoading(true)
    try {
      const res = await sellsApi.getAll({ page, per_page: perPage, ...filterParams() })
      setSales(res.data ?? [])
      setTotal(res.total ?? res.data?.length ?? 0)
      setSummary(res.summary ?? null)
      const ac = res.meta?.adSourceCounts
      setAdCounts(ac && typeof ac === "object" ? ac : {})
    } catch {
      setSales([])
    } finally {
      setLoading(false)
    }
  }, [page, perPage, filterParams])

  const fetchStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await sellsApi.getStats({ source: channel })
      const d = res.data as Record<string, number>
      setStats({
        totalSells: d.totalSells ?? 0,
        totalRevenue: d.totalRevenue ?? 0,
        pendingOrders: d.pendingOrders ?? 0,
        processingOrders: d.processingOrders ?? 0,
        deliveredOrders: d.deliveredOrders ?? 0,
        totalDue: d.totalDue ?? 0,
        unpaidCount: d.unpaidCount ?? 0,
        shippedOrders: d.shippedOrders ?? 0,
        packedOrders: d.packedOrders ?? 0,
        cancelledOrders: d.cancelledOrders ?? 0,
      })
    } catch {
      /* ignore */
    } finally {
      setStatsLoading(false)
    }
  }, [channel])

  useEffect(() => { fetchSales() }, [fetchSales])
  useEffect(() => { fetchStats() }, [fetchStats])

  // "N" opens the new-sale form (unless typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === "n") { e.preventDefault(); setNewOpen(true) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (blocked) return blocked

  const refresh = () => { fetchSales(); fetchStats() }
  const hasFilters = !!(search || paymentFilter !== "all" || methodFilter !== "all" || channel !== "all" || adSource !== "all" || startDate || endDate || tab !== "all")

  const resetFilters = () => {
    setSearch(""); setTab("all"); setPaymentFilter("all"); setMethodFilter("all"); setChannel("all"); setAdSource("all")
    setStartDate(""); setEndDate(""); setPage(1); setResetCount((n) => n + 1); setChecked(new Set())
  }

  const changeTab = (t: string) => { setTab(t as Tab); setPage(1); setChecked(new Set()) }
  const changePage = (n: number) => { setPage(n); setChecked(new Set()) }

  const allChecked = sales.length > 0 && sales.every((s) => checked.has(s.id))
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(sales.map((s) => s.id)))
  const toggleOne = (id: number) =>
    setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selectedSales = sales.filter((s) => checked.has(s.id))

  const printInvoice = async (sale: SellResponse) => {
    let full = sale
    if (!sale.items?.length) {
      try { const res = await sellsApi.getById(sale.id); full = res.data } catch { /* use list row */ }
    }
    printSaleInvoice(full, { formatCurrency, taxId: settings?.taxId }, i18n.language)
  }

  const openDetail = async (sale: SellResponse) => {
    setSelected(sale)
    if (!sale.items?.length) {
      try { const res = await sellsApi.getById(sale.id); setSelected(res.data) } catch { /* keep list row */ }
    }
  }

  const toastResult = (results: PromiseSettledResult<unknown>[], okTitle: string) => {
    const failed = results.filter((r) => r.status === "rejected")
    if (failed.length) {
      const msg = errMsg((failed[0] as PromiseRejectedResult).reason)
      toast({ variant: "destructive", title: t("orders:toast.someFailed"), description: msg || t("orders:toast.failedOf", { failed: failed.length, total: results.length }) })
    } else {
      toast({ title: okTitle, description: t("orders:sales.updated", { count: results.length }) })
    }
  }

  const setStatus = async (targets: SellResponse[], status: SellResponse["status"]) => {
    if (targets.length === 0) { toast({ title: t("orders:sales.nothingToUpdate"), description: t("orders:sales.noneCanMove") }); return }
    if (status === "Cancelled" && !window.confirm(t("orders:sales.cancelConfirm", { count: targets.length }))) return
    const results = await Promise.allSettled(targets.map((s) => sellsApi.updateStatus(s.id, status)))
    toastResult(results, t("orders:toast.markedAs", { status: orderStatusLabel(t, status) }))
    setChecked(new Set())
    refresh()
  }

  const advance = async (s: SellResponse) => {
    const step = nextStep(s)
    if (!step) return
    const results = await Promise.allSettled([step.run(s.id)])
    toastResult(results, t("orders:sales.stepDone", { invoice: s.invoiceNo, step: t(step.label) }))
    refresh()
  }

  const sendToCourier = async (targets: SellResponse[]) => {
    const eligible = targets.filter((s) => ["Pending", "Processing", "Packed"].includes(saleDisplayStatus(s)))
    if (eligible.length === 0) { toast({ title: t("orders:sales.nothingToSend"), description: t("orders:sales.onlySendable") }); return }
    const results = await Promise.allSettled(eligible.map((s) => sellsApi.updateFulfillment(s.id, "shipped")))
    toastResult(results, t("orders:sales.sentToCourier"))
    setChecked(new Set())
    refresh()
  }

  const printSelected = async () => {
    for (const s of selectedSales) await printInvoice(s)
  }

  const toExportRow = (s: SellResponse) => {
    const m = moneyParts(s)
    const due = salePaymentDue(s)
    const qty = s.items?.reduce((n, it) => n + (it.quantity ?? 1), 0) ?? 0
    return {
      invoice: s.invoiceNo,
      date: new Date(s.orderTime).toLocaleString(tag),
      customer: s.customerName,
      phone: s.shippingPhone ?? "",
      channel: CHANNEL_LABEL[s.source ?? "manual"] ? t(CHANNEL_LABEL[s.source ?? "manual"]) : s.source ?? "",
      ad_source: (s.adSource === "phone" || s.adSource === "other" ? "" : s.adSourceLabel) || adSourceText(t, s.adSource),
      campaign: s.campaignLink?.name || s.utmCampaign || "",
      status: orderStatusLabel(t, saleDisplayStatus(s)),
      payment: payLabel(t, paymentOf(s).label),
      method: methodLabel(t, s.method),
      items: qty,
      delivery_address: shippingLines(s).slice(1, 4).join(", "),
      subtotal: m.subtotal.toFixed(2),
      discount: m.discount.toFixed(2),
      tax: m.tax.toFixed(2),
      delivery: m.delivery.toFixed(2),
      total: m.total.toFixed(2),
      paid: (Number(s.paidAmount) || 0).toFixed(2),
      due: due.toFixed(2),
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

  const handleExport = async () => {
    setExporting(true)
    try {
      let source: SellResponse[] = selectedSales
      if (source.length === 0) {
        // Every row matching the current filters, not just this page
        source = []
        for (let p = 1; p <= 500; p++) {
          const res = await sellsApi.getAll({ page: p, per_page: 100, ...filterParams() })
          source.push(...(res.data ?? []))
          if (!res.data?.length || source.length >= (res.total ?? 0)) break
        }
      }
      if (source.length === 0) { toast({ title: t("orders:toast.nothingToExport") }); return }
      const headers = EXPORT_COLUMNS.map(([, key]) => t(key))
      const csvKey = (h: string) => h.toLowerCase().replace(/ /g, "_")
      exportToCSV(
        source.map((s) => { const r = toExportRow(s); return Object.fromEntries(EXPORT_COLUMNS.map(([field], i) => [csvKey(headers[i]), r[field]])) }),
        "sales", headers,
      )
    } catch (e) {
      toast({ variant: "destructive", title: t("orders:toast.exportFailed"), description: errMsg(e) })
    } finally {
      setExporting(false)
    }
  }

  const unpaidSelected = selectedSales.filter((s) => salePaymentDue(s) > 0)
  const selectedTotal = selectedSales.reduce((n, s) => n + (s.status === "Cancelled" ? 0 : Number(s.amount) || 0), 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <PageHeader
        title={t("orders:sales.title")}
        description={
          <Trans
            t={t}
            i18nKey="orders:sales.description"
            components={{ link: <Link href="/dashboard/orders" className="font-medium text-primary underline-offset-4 hover:underline" /> }}
          />
        }
        actions={<>
          <Button asChild variant="outline">
            <Link href="/dashboard/pos">{t("orders:sales.openPos")}</Link>
          </Button>
          <Button type="button" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" aria-hidden /> {t("orders:sales.newSale")}
            <Kbd>N</Kbd>
          </Button>
        </>}
      />

      {/* KPIs */}
      {statsLoading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[118px]" />)}
        </div>
      ) : (
        <StatsCards stats={[
          { label: t("orders:sales.kpi.totalSales"), value: stats.totalSells, icon: <Receipt className="size-4" />, color: "blue",
            hint: t("orders:sales.kpi.cancelled", { count: stats.cancelledOrders }) },
          { label: t("orders:sales.kpi.revenue"), value: formatCurrency(stats.totalRevenue), icon: <Banknote className="size-4" />, color: "green",
            hint: stats.totalSells ? t("orders:sales.kpi.avgPerSale", { amount: formatCurrency(stats.totalRevenue / stats.totalSells) }) : undefined },
          { label: t("orders:sales.kpi.amountDue"), value: formatCurrency(stats.totalDue), icon: <Clock className="size-4" />, color: "red",
            hint: t("orders:sales.kpi.unpaidInvoices", { count: stats.unpaidCount }),
            onClick: () => changeTab("unpaid"), active: tab === "unpaid" },
          { label: t("orders:sales.kpi.toDeliver"), value: stats.pendingOrders + stats.processingOrders, icon: <Truck className="size-4" />, color: "yellow",
            hint: t("orders:sales.kpi.pendingToShipped"), onClick: () => changeTab("Pending"), active: tab === "Pending" },
          { label: t("common:orderStatus.delivered"), value: stats.deliveredOrders, icon: <CheckCircle2 className="size-4" />, color: "purple", hint: t("orders:sales.kpi.deliveredCompleted"),
            onClick: () => changeTab("Delivered"), active: tab === "Delivered" },
        ]} />
      )}

      {/* Table card */}
      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs
            value={tab}
            onChange={changeTab}
            tabs={[
              { value: "all", label: t("common:status.all"), count: stats?.totalSells },
              { value: "Pending", label: orderStatusLabel(t, "Pending"), count: stats?.pendingOrders },
              { value: "Processing", label: orderStatusLabel(t, "Processing"), count: stats?.processingOrders },
              { value: "Packed", label: orderStatusLabel(t, "Packed"), count: stats?.packedOrders },
              { value: "Shipped", label: orderStatusLabel(t, "Shipped"), count: stats?.shippedOrders },
              { value: "Delivered", label: orderStatusLabel(t, "Delivered"), count: stats?.deliveredOrders },
              { value: "Cancelled", label: orderStatusLabel(t, "Cancelled"), count: stats?.cancelledOrders },
              { value: "unpaid", label: t("common:payment.unpaid"), count: stats?.unpaidCount },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="sales-search" className="sr-only">{t("orders:sales.searchLabel")}</Label>
            <Input
              id="sales-search"
              type="search"
              placeholder={t("orders:filters.searchPlaceholder")}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-8"
            />
          </div>
          <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(1) }}>
            <SelectTrigger aria-label={t("orders:filters.paymentStatus")} className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders:filters.paymentAll")}</SelectItem>
              <SelectItem value="paid">{t("common:payment.paid")}</SelectItem>
              <SelectItem value="partial">{t("orders:labels.partial")}</SelectItem>
              <SelectItem value="due">{t("common:payment.due")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setPage(1) }}>
            <SelectTrigger aria-label={t("common:payment.method")} className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders:filters.methodAll")}</SelectItem>
              {METHOD_FILTERS.map((m) => <SelectItem key={m} value={m}>{methodLabel(t, m)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1) }}>
            <SelectTrigger aria-label={t("orders:filters.channel")} className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders:filters.channelAll")}</SelectItem>
              {CHANNEL_FILTERS.map((c) => <SelectItem key={c} value={c}>{t("orders:filters.channelOption", { name: t(CHANNEL_LABEL[c]) })}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={adSource} onValueChange={(v) => { setAdSource(v); setPage(1) }}>
            <SelectTrigger aria-label={t("orders:filters.adSource")} className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {AD_SOURCE_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {adSourceText(t, f.value)}{f.value !== "all" && adCounts[f.value] !== undefined ? ` (${Number(adCounts[f.value]) || 0})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangeFilter
            key={resetCount}
            start={startDate}
            end={endDate}
            onChange={(a, b) => { setStartDate(a); setEndDate(b); setPage(1) }}
            className="flex flex-wrap items-center gap-2"
          />
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <X className="size-4" aria-hidden /> {t("common:actions.clear")}
            </Button>
          )}
          {mayExport && <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="size-4" aria-hidden /> {exporting ? t("orders:list.exporting") : checked.size > 0 ? t("orders:sales.exportN", { count: checked.size }) : t("common:actions.export")}
          </Button>}
        </div>

        {/* Bulk actions */}
        <BulkBar count={checked.size} label={t("common:table.selected", { count: checked.size })} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setStatus(selectedSales.filter((s) => s.status === "Pending"), "Processing")}>
              {t("orders:sales.bulk.markProcessing")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setStatus(selectedSales.filter((s) => s.status !== "Delivered" && s.status !== "Cancelled"), "Delivered")}>
              {t("orders:sales.bulk.markDelivered")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={printSelected}>
              {t("orders:sales.bulk.printInvoices")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => sendToCourier(selectedSales)}>
              {t("orders:sales.bulk.sendToCourier")}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={unpaidSelected.length === 0}
              onClick={() => setPayTargets(unpaidSelected)}>
              {t("orders:sales.bulk.recordPayment")}
            </Button>
        </BulkBar>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-5 pl-4">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label={t("common:actions.selectAll")} />
                </TableHead>
                <TableHead scope="col">{t("orders:sales.col.invoice")}</TableHead>
                <TableHead scope="col">{t("common:fields.customer")}</TableHead>
                <TableHead scope="col">{t("orders:sales.col.delivery")}</TableHead>
                <TableHead scope="col">{t("orders:sales.col.items")}</TableHead>
                <TableHead scope="col">{t("orders:sales.col.method")}</TableHead>
                <TableHead scope="col" className="text-right">{t("common:money.amount")}</TableHead>
                <TableHead scope="col">{t("orders:sales.col.payment")}</TableHead>
                <TableHead scope="col">{t("common:fields.status")}</TableHead>
                <TableHead scope="col" className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}><TableCell colSpan={10} className="px-4"><Skeleton className="h-9" /></TableCell></TableRow>
                ))
              ) : sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="whitespace-normal">
                    <EmptyState
                      icon={Receipt}
                      title={t("orders:sales.empty")}
                      description={hasFilters ? t("orders:filters.tryClearing") : t("orders:sales.emptyHint")}
                      className="p-4 md:p-6"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                sales.map((s) => {
                  const pay = paymentOf(s)
                  const qty = s.items?.reduce((n, it) => n + (it.quantity ?? 1), 0) ?? 0
                  const place = [s.shippingState, s.shippingCity].filter(Boolean).join(", ")
                  const ck = checked.has(s.id)
                  const step = nextStep(s)
                  return (
                    <TableRow key={s.id} data-state={ck ? "selected" : undefined}>
                      <TableCell className="pl-4">
                        <Checkbox checked={ck} onCheckedChange={() => toggleOne(s.id)} aria-label={t("orders:list.selectRow", { invoice: s.invoiceNo })} />
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">#{s.invoiceNo}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.orderTime).toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                          {new Date(s.orderTime).toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" }).toLowerCase()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{s.customerName}</div>
                        <div className="text-xs text-muted-foreground">{s.shippingPhone || "—"} · {CHANNEL_LABEL[s.source ?? "manual"] ? t(CHANNEL_LABEL[s.source ?? "manual"]) : s.source}</div>
                        {(s.adSource || s.isQuickOrder || s.possibleDuplicate) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <AdSourceBadge source={s.adSource} label={s.adSourceLabel} title={campaignHint(t, s) || undefined} />
                            <OrderFlagBadges order={s} />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {place && <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                          <span>{place || t("orders:sales.noDelivery")}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{s.carrier || s.shippingMethodName || t("orders:sales.pickup")}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {qty > 0 ? t("common:count.items", { count: qty }) : "—"}
                      </TableCell>
                      <TableCell>{methodLabel(t, s.method)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(s.amount))}
                        {pay.due > 0 && <div className="text-xs font-medium text-destructive">{t("orders:sales.dueAmount", { amount: formatCurrency(pay.due) })}</div>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={pay.label} variant={PAY_STYLE[pay.label]} label={payLabel(t, pay.label)} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={saleDisplayStatus(s)} label={orderStatusLabel(t, saleDisplayStatus(s))} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          <WithTooltip content={t("orders:list.viewInvoice", { invoice: s.invoiceNo })}><Button type="button" variant="outline" size="icon" aria-label={t("orders:list.viewInvoice", { invoice: s.invoiceNo })} onClick={() => openDetail(s)}><Eye className="size-4" /></Button></WithTooltip>
                          <WithTooltip content={t("orders:list.printInvoice", { invoice: s.invoiceNo })}><Button type="button" variant="outline" size="icon" aria-label={t("orders:list.printInvoice", { invoice: s.invoiceNo })} onClick={() => printInvoice(s)}><Printer className="size-4" /></Button></WithTooltip>
                          {step && (
                            <WithTooltip content={t(step.label)}>
                              <Button type="button" variant="outline" size="icon" aria-label={t("orders:sales.stepFor", { step: t(step.label), invoice: s.invoiceNo })}
                                onClick={() => advance(s)}><ChevronsRight className="size-4" /></Button>
                            </WithTooltip>
                          )}
                          {pay.due > 0 && s.status !== "Cancelled" && (
                            <WithTooltip content={t("orders:sales.recordPayment")}>
                              <Button type="button" variant="outline" size="icon" aria-label={t("orders:sales.recordPaymentFor", { invoice: s.invoiceNo })}
                                onClick={() => setPayTargets([s])}><Wallet className="size-4" /></Button>
                            </WithTooltip>
                          )}
                          {s.status !== "Delivered" && s.status !== "Cancelled" && (
                            <WithTooltip content={t("orders:sales.cancelSale")}>
                              <Button type="button" variant="outline" size="icon" aria-label={t("orders:list.cancelInvoice", { invoice: s.invoiceNo })}
                                className="text-destructive" onClick={() => setStatus([s], "Cancelled")}><XCircle className="size-4" /></Button>
                            </WithTooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && sales.length > 0 && (
          <>
          <Separator />
          <div className="p-4 pt-3">
            {checked.size > 0 ? (
              <p className="mb-3 text-xs text-muted-foreground tabular-nums">{t("orders:sales.selectedTotal", { count: checked.size, amount: formatCurrency(selectedTotal) })}</p>
            ) : summary ? (
              <p className="mb-3 text-xs text-muted-foreground tabular-nums">{t("orders:sales.summaryTotal", { count: summary.count, amount: formatCurrency(summary.total) })}</p>
            ) : null}
            <PaginationControl
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(total / perPage))}
              itemsPerPage={perPage}
              totalItems={total}
              onPageChange={changePage}
              onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
            />
          </div>
          </>
        )}
      </Card>

      <SaleDetailDialog
        sale={selected}
        onClose={() => setSelected(null)}
        onPrint={printInvoice}
        onRecordPayment={(sale) => setPayTargets([sale])}
        onChanged={refresh}
      />

      <RecordPaymentDialog
        sales={payTargets}
        onClose={() => setPayTargets([])}
        onDone={() => { setChecked(new Set()); setSelected(null); refresh() }}
      />

      <NewSaleModal open={newOpen} onOpenChange={setNewOpen} onCreated={refresh} initialCustomerId={searchParams.get("customer") ?? undefined} />
    </div>
  )
}
