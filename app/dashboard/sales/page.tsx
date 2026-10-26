"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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

const CHANNEL_LABEL: Record<string, string> = { manual: "Sales", pos: "POS", storefront: "Online" }

/** The one-click next step for a sale, by its displayed stage (Pending, Processing, Packed, Shipped). */
type Step = { label: string; run: (id: number) => Promise<unknown> }
function nextStep(s: SellResponse): Step | null {
  switch (saleDisplayStatus(s)) {
    case "Pending": return { label: "Confirm (mark processing)", run: (id) => sellsApi.updateStatus(id, "Processing") }
    case "Processing": return { label: "Mark packed", run: (id) => sellsApi.updateFulfillment(id, "packed") }
    case "Packed": return { label: "Mark shipped", run: (id) => sellsApi.updateFulfillment(id, "shipped") }
    case "Shipped": return { label: "Mark delivered", run: (id) => sellsApi.updateStatus(id, "Delivered") }
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

const rangeLabel = (n: number) => `${n} sale${n === 1 ? "" : "s"}`

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

  const filterParams = useCallback(() => {
    const params: Record<string, string> = { source: channel }
    if (search) params.search = search
    if (tab === "unpaid") params.payment = "unpaid"
    else if (paymentFilter !== "all") params.payment = paymentFilter
    if (tab === "Pending" || tab === "Processing" || tab === "Delivered" || tab === "Cancelled") params.status = tab
    if (tab === "Packed") params.fulfillment = "packed"
    if (tab === "Shipped") params.fulfillment = "shipped"
    if (methodFilter !== "all") params.method = methodFilter
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    return params
  }, [search, tab, paymentFilter, methodFilter, channel, startDate, endDate])

  const fetchSales = useCallback(async () => {
    setLoading(true)
    try {
      const res = await sellsApi.getAll({ page, per_page: perPage, ...filterParams() })
      setSales(res.data ?? [])
      setTotal(res.total ?? res.data?.length ?? 0)
      setSummary(res.summary ?? null)
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
  const hasFilters = !!(search || paymentFilter !== "all" || methodFilter !== "all" || channel !== "all" || startDate || endDate || tab !== "all")

  const resetFilters = () => {
    setSearch(""); setTab("all"); setPaymentFilter("all"); setMethodFilter("all"); setChannel("all")
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
    printSaleInvoice(full, { formatCurrency, taxId: settings?.taxId })
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
      toast({ variant: "destructive", title: "Some updates failed", description: msg || `${failed.length} of ${results.length} could not be changed` })
    } else {
      toast({ title: okTitle, description: rangeLabel(results.length) + " updated" })
    }
  }

  const setStatus = async (targets: SellResponse[], status: SellResponse["status"]) => {
    if (targets.length === 0) { toast({ title: "Nothing to update", description: "None of the selected sales can move to that status." }); return }
    if (status === "Cancelled" && !window.confirm(`Cancel ${rangeLabel(targets.length)}? Stock goes back to inventory and any balance due is cleared.`)) return
    const results = await Promise.allSettled(targets.map((s) => sellsApi.updateStatus(s.id, status)))
    toastResult(results, `Marked ${status.toLowerCase()}`)
    setChecked(new Set())
    refresh()
  }

  const advance = async (s: SellResponse) => {
    const step = nextStep(s)
    if (!step) return
    const results = await Promise.allSettled([step.run(s.id)])
    toastResult(results, `#${s.invoiceNo}: ${step.label.toLowerCase()}`)
    refresh()
  }

  const sendToCourier = async (targets: SellResponse[]) => {
    const eligible = targets.filter((s) => ["Pending", "Processing", "Packed"].includes(saleDisplayStatus(s)))
    if (eligible.length === 0) { toast({ title: "Nothing to send", description: "Only pending, processing or packed sales can be sent to a courier." }); return }
    const results = await Promise.allSettled(eligible.map((s) => sellsApi.updateFulfillment(s.id, "shipped")))
    toastResult(results, "Sent to courier")
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
      date: new Date(s.orderTime).toLocaleString(),
      customer: s.customerName,
      phone: s.shippingPhone ?? "",
      channel: CHANNEL_LABEL[s.source ?? "manual"] ?? s.source ?? "",
      status: saleDisplayStatus(s),
      payment: paymentOf(s).label,
      method: s.method,
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

  const EXPORT_HEADERS = ["Invoice", "Date", "Customer", "Phone", "Channel", "Status", "Payment", "Method", "Items", "Delivery address", "Subtotal", "Discount", "Tax", "Delivery", "Total", "Paid", "Due"]

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
      if (source.length === 0) { toast({ title: "Nothing to export" }); return }
      exportToCSV(source.map(toExportRow), "sales", EXPORT_HEADERS)
    } catch (e) {
      toast({ variant: "destructive", title: "Export failed", description: errMsg(e) })
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
        title="Sales"
        description={<>
          Sales, POS and online orders with customer, payment and delivery details. Fulfilment and shipments live in{" "}
          <Link href="/dashboard/orders" className="font-medium text-primary underline-offset-4 hover:underline">Orders</Link>.
        </>}
        actions={<>
          <Button asChild variant="outline">
            <Link href="/dashboard/pos">Open POS</Link>
          </Button>
          <Button type="button" onClick={() => setNewOpen(true)}>
            <Plus className="size-4" aria-hidden /> New sale
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
          { label: "Total sales", value: stats.totalSells, icon: <Receipt className="size-4" />, color: "blue",
            hint: `${stats.cancelledOrders} cancelled` },
          { label: "Revenue", value: formatCurrency(stats.totalRevenue), icon: <Banknote className="size-4" />, color: "green",
            hint: stats.totalSells ? `Avg ${formatCurrency(stats.totalRevenue / stats.totalSells)} per sale` : undefined },
          { label: "Amount due", value: formatCurrency(stats.totalDue), icon: <Clock className="size-4" />, color: "red",
            hint: `${stats.unpaidCount} unpaid invoice${stats.unpaidCount === 1 ? "" : "s"}`,
            onClick: () => changeTab("unpaid"), active: tab === "unpaid" },
          { label: "To deliver", value: stats.pendingOrders + stats.processingOrders, icon: <Truck className="size-4" />, color: "yellow",
            hint: "Pending to shipped", onClick: () => changeTab("Pending"), active: tab === "Pending" },
          { label: "Delivered", value: stats.deliveredOrders, icon: <CheckCircle2 className="size-4" />, color: "purple", hint: "Delivered + completed",
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
              { value: "all", label: "All", count: stats?.totalSells },
              { value: "Pending", label: "Pending", count: stats?.pendingOrders },
              { value: "Processing", label: "Processing", count: stats?.processingOrders },
              { value: "Packed", label: "Packed", count: stats?.packedOrders },
              { value: "Shipped", label: "Shipped", count: stats?.shippedOrders },
              { value: "Delivered", label: "Delivered", count: stats?.deliveredOrders },
              { value: "Cancelled", label: "Cancelled", count: stats?.cancelledOrders },
              { value: "unpaid", label: "Unpaid", count: stats?.unpaidCount },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="sales-search" className="sr-only">Search sales</Label>
            <Input
              id="sales-search"
              type="search"
              placeholder="Search invoice, customer or phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-8"
            />
          </div>
          <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPage(1) }}>
            <SelectTrigger aria-label="Payment status" className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Payment: All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="due">Due</SelectItem>
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
          <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1) }}>
            <SelectTrigger aria-label="Channel" className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Channel: All</SelectItem>
              <SelectItem value="manual">Channel: Sales</SelectItem>
              <SelectItem value="pos">Channel: POS</SelectItem>
              <SelectItem value="storefront">Channel: Online</SelectItem>
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
              <X className="size-4" aria-hidden /> Clear
            </Button>
          )}
          {mayExport && <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="size-4" aria-hidden /> {exporting ? "Exporting…" : checked.size > 0 ? `Export ${checked.size}` : "Export"}
          </Button>}
        </div>

        {/* Bulk actions */}
        <BulkBar count={checked.size} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setStatus(selectedSales.filter((s) => s.status === "Pending"), "Processing")}>
              Mark processing
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setStatus(selectedSales.filter((s) => s.status !== "Delivered" && s.status !== "Cancelled"), "Delivered")}>
              Mark delivered
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={printSelected}>
              Print invoices
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => sendToCourier(selectedSales)}>
              Send to courier
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={unpaidSelected.length === 0}
              onClick={() => setPayTargets(unpaidSelected)}>
              Record payment
            </Button>
        </BulkBar>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-5 pl-4">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
                </TableHead>
                <TableHead scope="col">Invoice</TableHead>
                <TableHead scope="col">Customer</TableHead>
                <TableHead scope="col">Delivery</TableHead>
                <TableHead scope="col">Items</TableHead>
                <TableHead scope="col">Method</TableHead>
                <TableHead scope="col" className="text-right">Amount</TableHead>
                <TableHead scope="col">Payment</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="pr-4 text-right">Actions</TableHead>
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
                      title="No sales found"
                      description={hasFilters ? "Try clearing the filters." : "Create your first sale with New sale."}
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
                        <Checkbox checked={ck} onCheckedChange={() => toggleOne(s.id)} aria-label={`Select ${s.invoiceNo}`} />
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">#{s.invoiceNo}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.orderTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} ·{" "}
                          {new Date(s.orderTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{s.customerName}</div>
                        <div className="text-xs text-muted-foreground">{s.shippingPhone || "—"} · {CHANNEL_LABEL[s.source ?? "manual"] ?? s.source}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {place && <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                          <span>{place || "No delivery"}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{s.carrier || s.shippingMethodName || "Pickup"}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {qty > 0 ? `${qty} item${qty === 1 ? "" : "s"}` : "—"}
                      </TableCell>
                      <TableCell>{s.method}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(s.amount))}
                        {pay.due > 0 && <div className="text-xs font-medium text-destructive">Due {formatCurrency(pay.due)}</div>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={pay.label} variant={PAY_STYLE[pay.label]} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={saleDisplayStatus(s)} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="outline" size="icon" aria-label={`View ${s.invoiceNo}`} onClick={() => openDetail(s)}><Eye className="size-4" /></Button>
                          <Button type="button" variant="outline" size="icon" aria-label={`Print ${s.invoiceNo}`} onClick={() => printInvoice(s)}><Printer className="size-4" /></Button>
                          {step && (
                            <WithTooltip content={step.label}>
                              <Button type="button" variant="outline" size="icon" aria-label={`${step.label} ${s.invoiceNo}`}
                                onClick={() => advance(s)}><ChevronsRight className="size-4" /></Button>
                            </WithTooltip>
                          )}
                          {pay.due > 0 && s.status !== "Cancelled" && (
                            <WithTooltip content="Record payment">
                              <Button type="button" variant="outline" size="icon" aria-label={`Record payment for ${s.invoiceNo}`}
                                onClick={() => setPayTargets([s])}><Wallet className="size-4" /></Button>
                            </WithTooltip>
                          )}
                          {s.status !== "Delivered" && s.status !== "Cancelled" && (
                            <WithTooltip content="Cancel sale">
                              <Button type="button" variant="outline" size="icon" aria-label={`Cancel ${s.invoiceNo}`}
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
              <p className="mb-3 text-xs text-muted-foreground tabular-nums">{checked.size} selected · Total {formatCurrency(selectedTotal)}</p>
            ) : summary ? (
              <p className="mb-3 text-xs text-muted-foreground tabular-nums">{rangeLabel(summary.count)} · Total {formatCurrency(summary.total)}</p>
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
