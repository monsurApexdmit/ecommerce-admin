"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import {
  Banknote, CheckCircle2, Clock, Download, MapPin, MoreHorizontal, Package, Plus, Printer, Search, Truck, X, XCircle,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { COURIERS, CreateShipmentModal, courierStyle } from "@/components/shipments/create-shipment-modal"
import { shipmentsApi, type ShipmentResponse, type ShipmentStatus } from "@/lib/shipmentsApi"
import { printShippingLabel, printShippingLabels } from "@/lib/shipping-label"
import { ShipmentDetailDialog, type StatusPayload } from "@/components/shipments/shipment-detail-dialog"
import { codView, nextStep, validNextStatuses, type CodKind } from "@/components/shipments/shipment-utils"
import { ORDERS_NS, type OrdersKey } from "@/components/sales/i18n"
import { COURIER_NS } from "@/components/couriers/i18n"
import { CopyButton, CourierStatusBadge, useCourierStatusLabel } from "@/components/couriers/courier-ui"
import { COURIER_STATUSES, courierApi, courierError } from "@/lib/courierApi"
import { localeTag } from "@/lib/i18n"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/common/PageHeader"
import { Toolbar } from "@/components/common/Toolbar"
import { BulkBar } from "@/components/common/BulkBar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { EmptyState } from "@/components/common/EmptyState"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WithTooltip } from "@/components/common/WithTooltip"

type Tab = "all" | "pending" | "picked_up" | "in_transit" | "delivered" | "failed"

/** Tab → API status filter (comma-separated groups are supported by the backend). */
const TAB_STATUS: Record<Tab, string | undefined> = {
  all: undefined,
  pending: "pending",
  picked_up: "picked_up",
  in_transit: "in_transit,out_for_delivery",
  delivered: "delivered",
  failed: "failed,returned",
}

/** Shipment status → display label key (codes stay as data). */
const STATUS_KEY: Record<ShipmentStatus, OrdersKey> = {
  pending: "orders:shipments.status.pending",
  picked_up: "orders:shipments.status.picked_up",
  in_transit: "orders:shipments.status.in_transit",
  out_for_delivery: "orders:shipments.status.out_for_delivery",
  delivered: "orders:shipments.status.delivered",
  failed: "orders:shipments.status.failed",
  returned: "orders:shipments.status.returned",
  cancelled: "orders:shipments.status.cancelled",
}

/** Label keys of the one-click next step button. */
const NEXT_STEP_KEY: Partial<Record<ShipmentStatus, OrdersKey>> = {
  picked_up: "orders:shipments.nextStep.picked_up",
  in_transit: "orders:shipments.nextStep.in_transit",
  out_for_delivery: "orders:shipments.nextStep.out_for_delivery",
  delivered: "orders:shipments.nextStep.delivered",
}

/** COD state → label key ("none" shows a dash). */
const COD_KEY: Partial<Record<CodKind, OrdersKey>> = {
  prepaid: "orders:shipments.cod.prepaid",
  to_collect: "orders:shipments.cod.to_collect",
  collected: "orders:shipments.cod.collected",
  delivered_unpaid: "orders:shipments.cod.delivered_unpaid",
  returning: "orders:shipments.cod.returning",
}

/** How many of the 4 progress segments are filled: Booked, Picked up, In transit, Delivered */
const STEP: Record<ShipmentStatus, number> = {
  pending: 1, picked_up: 2, in_transit: 3, out_for_delivery: 3, delivered: 4, failed: 3, returned: 3, cancelled: 1,
}


interface Stats {
  total: number
  pending: number
  pickedUp: number
  inTransit: number
  outForDelivery: number
  delivered: number
  failed: number
  returned: number
  readyToShip: number
  codWithCouriers: number
}

export default function ShipmentsPage() {
  const { t, i18n } = useTranslation(ORDERS_NS)
  const { t: tc } = useTranslation(COURIER_NS)
  const courierStatusLabel = useCourierStatusLabel()
  const tag = localeTag(i18n.language)
  const statusLabel = (st: ShipmentStatus) => (STATUS_KEY[st] ? t(STATUS_KEY[st]) : st)
  const codLabel = (kind: CodKind, fallback: string) => (COD_KEY[kind] ? t(COD_KEY[kind]) : fallback)
  const shortDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(tag, { month: "short", day: "numeric" }) : "—")
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [shipments, setShipments] = useState<ShipmentResponse[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [courierFilter, setCourierFilter] = useState("all")
  const [courierStatusFilter, setCourierStatusFilter] = useState("all")
  const [days, setDays] = useState("any")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [createOpen, setCreateOpen] = useState(false)
  const [preselectOrder, setPreselectOrder] = useState<number | null>(null)
  const [viewing, setViewing] = useState<ShipmentResponse | null>(null)
  const [saving, setSaving] = useState(false)

  const blocked = useModuleGuard("Shipments")

  // ?new=1&order=ID (from the Orders page)
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      const o = Number(searchParams.get("order"))
      setPreselectOrder(o > 0 ? o : null)
      setCreateOpen(true)
    }
  }, [searchParams])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: perPage }
      if (search) params.search = search
      const status = TAB_STATUS[tab]
      if (status) params.status = status
      if (courierFilter !== "all") params.carrier = courierFilter
      if (courierStatusFilter !== "all") params.courierStatus = courierStatusFilter
      if (days !== "any") params.days = Number(days)
      const [list, st] = await Promise.all([shipmentsApi.getAll(params), shipmentsApi.getStats()])
      setShipments(list.data ?? [])
      setSelected(new Set())
      setTotal(list.pagination?.total ?? list.data?.length ?? 0)
      const d = st.data
      setStats({
        total: Number(d?.total ?? 0),
        pending: Number(d?.pending ?? 0),
        pickedUp: Number(d?.pickedUp ?? 0),
        inTransit: Number(d?.inTransit ?? 0),
        outForDelivery: Number(d?.outForDelivery ?? 0),
        delivered: Number(d?.delivered ?? 0),
        failed: Number(d?.failed ?? 0),
        returned: Number(d?.returned ?? 0),
        readyToShip: Number(d?.readyToShip ?? 0),
        codWithCouriers: Number(d?.codWithCouriers ?? 0),
      })
    } catch {
      setShipments([])
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, tab, courierFilter, courierStatusFilter, days])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (blocked) return blocked

  const hasFilters = !!(search || courierFilter !== "all" || courierStatusFilter !== "all" || tab !== "all" || days !== "any")
  const resetFilters = () => { setSearch(""); setCourierFilter("all"); setCourierStatusFilter("all"); setDays("any"); setTab("all"); setPage(1) }
  const changeTab = (t: string) => { setTab(t as Tab); setPage(1) }

  const openView = async (s: ShipmentResponse) => {
    setViewing(s)
    try {
      const res = await shipmentsApi.getById(s.id)
      setViewing((res.data ?? res) as ShipmentResponse)
    } catch { /* keep list row */ }
  }

  const printLabel = (s: ShipmentResponse) => {
    const cod = codView(s)
    printShippingLabel(s, { cod: cod.kind === "to_collect" ? cod.amount : 0, formatCurrency })
  }

  const printSelected = () => {
    const rows = shipments.filter((x) => selected.has(x.id))
    printShippingLabels(rows.map((x) => {
      const cod = codView(x)
      return { shipment: x, opts: { cod: cod.kind === "to_collect" ? cod.amount : 0, formatCurrency } }
    }))
  }

  /** Applies a status change; returns true on success. */
  const doStatus = async (s: ShipmentResponse, p: StatusPayload): Promise<boolean> => {
    if (!validNextStatuses(s.status).includes(p.status)) {
      toast({ variant: "destructive", title: t("orders:shipments.toast.notAllowed"), description: t("orders:shipments.toast.cannotMove", { from: statusLabel(s.status), to: statusLabel(p.status) }) })
      return false
    }
    if (p.status === "failed" && !p.description?.trim()) {
      toast({ variant: "destructive", title: t("orders:shipments.toast.noteRequired"), description: t("orders:shipments.toast.explainFailed") })
      return false
    }
    if ((p.status === "failed" || p.status === "returned") &&
      !window.confirm(t("orders:shipments.toast.confirmMark", { id: s.trackingNumber || `#${s.id}`, status: statusLabel(p.status) }))) return false
    setSaving(true)
    try {
      const res = await shipmentsApi.updateStatus(s.id, p)
      const next = (res.data ?? res) as ShipmentResponse
      if (viewing?.id === next.id) setViewing(await shipmentsApi.getById(next.id).then((r) => (r.data ?? r) as ShipmentResponse).catch(() => next))
      toast({ title: t("orders:shipments.toast.updated"), description: statusLabel(next.status) })
      fetchAll()
      return true
    } catch (err: any) {
      toast({ variant: "destructive", title: t("orders:toast.couldNotUpdate"), description: err?.response?.data?.message || t("orders:toast.tryAgain") })
      return false
    } finally {
      setSaving(false)
    }
  }

  /** Pull the latest status from the courier now */
  const syncCourier = async (s: ShipmentResponse) => {
    setSaving(true)
    try {
      const next = (await courierApi.sync(s.id)) as unknown as ShipmentResponse
      if (viewing?.id === s.id) setViewing(await shipmentsApi.getById(s.id).then((r) => (r.data ?? r) as ShipmentResponse).catch(() => next))
      toast({ title: tc("courier:panel.toast.synced"), description: courierStatusLabel(next.courierBooking?.status) })
      fetchAll()
    } catch (err) {
      toast({ variant: "destructive", title: tc("courier:panel.toast.syncFailed"), description: courierError(err, t("orders:toast.tryAgain")) })
    } finally {
      setSaving(false)
    }
  }

  /** Detail dialog: the courier panel changed the shipment (sync / cancel) */
  const courierChanged = async (id: number) => {
    const fresh = await shipmentsApi.getById(id).then((r) => (r.data ?? r) as ShipmentResponse).catch(() => null)
    if (fresh) setViewing((v) => (v?.id === id ? fresh : v))
    fetchAll()
  }

  const recordCod = async (s: ShipmentResponse) => {
    setSaving(true)
    try {
      const res = await shipmentsApi.recordCodPayment(s.id)
      const next = (res.data ?? res) as ShipmentResponse
      if (viewing?.id === next.id) setViewing(next)
      toast({ title: t("orders:shipments.toast.codRecorded"), description: formatCurrency(codView(s).amount) })
      fetchAll()
    } catch (err: any) {
      toast({ variant: "destructive", title: t("orders:shipments.toast.couldNotRecord"), description: err?.response?.data?.message || t("orders:toast.tryAgain") })
    } finally {
      setSaving(false)
    }
  }

  const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const exportCod = async () => {
    setExporting(true)
    try {
      const params: Record<string, string | number> = { cod: 1, per_page: 2000 }
      if (days !== "any") params.days = Number(days)
      if (courierFilter !== "all") params.carrier = courierFilter
      const res = await shipmentsApi.getAll(params)
      const rows = (res.data ?? []).filter((x) => codView(x).amount > 0)
      if (rows.length === 0) { toast({ title: t("orders:toast.nothingToExport"), description: t("orders:shipments.toast.noCod") }); return }
      const head = [
        t("orders:shipments.csv.invoice"), t("orders:shipments.csv.customer"), t("orders:shipments.csv.courier"), t("orders:shipments.csv.tracking"),
        t("orders:shipments.csv.codAmount"), t("orders:shipments.csv.collectedState"), t("orders:shipments.csv.deliveryCharge"),
        t("orders:shipments.csv.codFee"), t("orders:shipments.csv.net"),
      ]
      const lines = rows.map((x) => {
        const c = codView(x)
        const fee = Number(x.shippingCost) || 0
        const codFee = Math.round(c.amount * 1) / 100
        return [x.sell?.invoiceNo ?? x.sellId, x.sell?.customerName ?? "", x.carrier ?? "", x.trackingNumber ?? "", c.amount, codLabel(c.kind, c.label), fee, codFee.toFixed(2), (c.amount - fee - codFee).toFixed(2)]
      })
      const csv = [head, ...lines].map((r) => r.map(csvCell).join(",")).join("\n")
      const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `cod-report-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ variant: "destructive", title: t("orders:toast.exportFailed"), description: t("orders:toast.tryAgain") })
    } finally {
      setExporting(false)
    }
  }

  const allSelected = shipments.length > 0 && shipments.every((x) => selected.has(x.id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(shipments.map((x) => x.id)))
  const toggleOne = (id: number) =>
    setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const inTransitTotal = stats ? stats.pickedUp + stats.inTransit + stats.outForDelivery : 0

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      {/* Header */}
      <PageHeader
        title={t("orders:shipments.title")}
        description={t("orders:shipments.description")}
        actions={<>
          <Button asChild variant="outline">
            <Link href="/dashboard/orders">{t("orders:shipments.allOrders")}</Link>
          </Button>
          <Button type="button" variant="outline" onClick={exportCod} disabled={exporting}>
            <Download className="size-4" aria-hidden /> {exporting ? t("orders:list.exporting") : t("orders:shipments.exportCod")}
          </Button>
          <Button type="button" onClick={() => { setPreselectOrder(null); setCreateOpen(true) }}>
            <Plus className="size-4" aria-hidden /> {t("orders:shipments.createShipment")}
          </Button>
        </>}
      />

      {stats && stats.readyToShip > 0 && (
        <Button type="button" variant="outline" onClick={() => { setPreselectOrder(null); setCreateOpen(true) }}
          className="h-auto w-full justify-start gap-3 py-3 text-left whitespace-normal">
          <Package className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 font-semibold">{t("orders:shipments.readyBanner", { count: stats.readyToShip })}</span>
          <span className="font-bold">{t("orders:shipments.createShipmentArrow")}</span>
        </Button>
      )}

      {/* KPIs */}
      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[118px]" />)}
        </div>
      ) : (
        <div className="[&>div]:xl:grid-cols-6">
          <StatsCards stats={[
            { label: t("orders:shipments.kpi.readyToShip"), value: stats.readyToShip, icon: <Package className="size-4" />, color: "blue", hint: t("orders:shipments.kpi.withoutShipment"),
              onClick: () => { setPreselectOrder(null); setCreateOpen(true) } },
            { label: t("orders:shipments.kpi.pendingPickup"), value: stats.pending, icon: <Clock className="size-4" />, color: "yellow", hint: t("orders:shipments.kpi.waitingRider"),
              active: tab === "pending", onClick: () => changeTab("pending") },
            { label: t("orders:shipments.kpi.inTransit"), value: inTransitTotal, icon: <Truck className="size-4" />, color: "purple", hint: t("orders:shipments.kpi.withCouriers"),
              active: tab === "in_transit", onClick: () => changeTab("in_transit") },
            { label: t("orders:shipments.status.delivered"), value: stats.delivered, icon: <CheckCircle2 className="size-4" />, color: "green",
              hint: stats.total ? t("orders:shipments.kpi.pctOfAll", { pct: Math.round((stats.delivered / stats.total) * 100) }) : t("orders:shipments.kpi.noDeliveries"),
              active: tab === "delivered", onClick: () => changeTab("delivered") },
            { label: t("orders:shipments.kpi.failedReturned"), value: stats.failed + stats.returned, icon: <XCircle className="size-4" />, color: "red",
              hint: stats.failed + stats.returned > 0 ? t("orders:shipments.kpi.needsFollowUp") : "—",
              active: tab === "failed", onClick: () => changeTab("failed") },
            { label: t("orders:shipments.kpi.codWithCouriers"), value: formatCurrency(stats.codWithCouriers), icon: <Banknote className="size-4" />, color: "yellow", hint: t("orders:shipments.kpi.notCollected") },
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
              { value: "all", label: t("common:status.all"), count: stats?.total },
              { value: "pending", label: t("orders:shipments.status.pending"), count: stats?.pending },
              { value: "picked_up", label: t("orders:shipments.status.picked_up"), count: stats?.pickedUp },
              { value: "in_transit", label: t("orders:shipments.status.in_transit"), count: stats ? stats.inTransit + stats.outForDelivery : undefined },
              { value: "delivered", label: t("orders:shipments.status.delivered"), count: stats?.delivered },
              { value: "failed", label: t("orders:shipments.kpi.failedReturned"), count: stats ? stats.failed + stats.returned : undefined },
            ]}
          />
        </div>

        <Toolbar className="p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="shipment-search" className="sr-only">{t("orders:shipments.searchLabel")}</Label>
            <Input
              id="shipment-search"
              type="search"
              placeholder={t("orders:shipments.searchPlaceholder")}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <Select value={courierFilter} onValueChange={(v) => { setCourierFilter(v); setPage(1) }}>
            <SelectTrigger aria-label={t("orders:shipments.courier")} className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("orders:shipments.courierAll")}</SelectItem>
              {COURIERS.filter((c) => c.name !== "Other").map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={courierStatusFilter} onValueChange={(v) => { setCourierStatusFilter(v); setPage(1) }}>
            <SelectTrigger aria-label={tc("courier:filters.status")} className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tc("courier:filters.statusAll")}</SelectItem>
              {COURIER_STATUSES.map((cs) => <SelectItem key={cs} value={cs}>{courierStatusLabel(cs)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={(v) => { setDays(v); setPage(1) }}>
            <SelectTrigger aria-label={t("common:fields.date")} className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("orders:shipments.dateAny")}</SelectItem>
              <SelectItem value="7">{t("common:time.last7Days")}</SelectItem>
              <SelectItem value="30">{t("common:time.last30Days")}</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <X className="size-4" aria-hidden /> {t("common:actions.clear")}
            </Button>
          )}
        </Toolbar>

        <BulkBar count={selected.size} label={t("common:table.selected", { count: selected.size })} onClear={() => setSelected(new Set())} className="mx-4 mb-3">
          <Button type="button" size="sm" onClick={printSelected}>
            <Printer className="size-4" aria-hidden /> {t("orders:shipments.printLabels")}
          </Button>
        </BulkBar>

        {loading ? (
          <div className="space-y-2 p-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : shipments.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={hasFilters ? t("orders:shipments.noMatch") : t("orders:shipments.noneYet")}
            description={hasFilters
              ? t("orders:shipments.tryDifferent")
              : t("orders:shipments.waiting", { count: stats?.readyToShip ?? 0 })}
            action={!hasFilters ? (
              <Button type="button" onClick={() => { setPreselectOrder(null); setCreateOpen(true) }}>
                {t("orders:shipments.createFirst")}
              </Button>
            ) : undefined}
          />
        ) : (
          <>
            <div>
              <Table className="min-w-[1180px]">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="w-10 pl-4">
                      <Checkbox aria-label={t("orders:shipments.selectAll")} checked={allSelected} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead scope="col">{t("orders:shipments.col.trackingOrder")}</TableHead>
                    <TableHead scope="col">{t("common:fields.customer")}</TableHead>
                    <TableHead scope="col">{t("orders:shipments.courier")}</TableHead>
                    <TableHead scope="col" className="min-w-[220px]">{t("orders:shipments.col.progress")}</TableHead>
                    <TableHead scope="col" className="text-right">{t("orders:shipments.col.cod")}</TableHead>
                    <TableHead scope="col">{t("orders:shipments.col.dates")}</TableHead>
                    <TableHead scope="col" className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((s) => {
                    const c = courierStyle(s.carrier)
                    const cod = codView(s)
                    const nxt = nextStep(s.status)
                    const step = STEP[s.status] ?? 1
                    const fail = s.status === "failed" || s.status === "returned" || s.status === "cancelled"
                    const note = s.trackingHistory?.[0]?.description
                    return (
                      <TableRow key={s.id} data-state={selected.has(s.id) ? "selected" : undefined}>
                        <TableCell className="pl-4">
                          <Checkbox aria-label={t("orders:shipments.selectRow", { id: s.trackingNumber || s.id })} checked={selected.has(s.id)} onCheckedChange={() => toggleOne(s.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center font-bold">
                            {s.trackingNumber || t("orders:shipments.noTracking")}
                            {s.courierBooking && s.trackingNumber && <CopyButton value={s.trackingNumber} label={tc("courier:panel.copyTracking")} />}
                          </div>
                          <Link href="/dashboard/orders" className="text-xs text-primary hover:underline">#{s.sell?.invoiceNo ?? s.sellId}</Link>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold">{s.sell?.customerName ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{[s.sell?.area, s.sell?.customerPhone].filter(Boolean).join(" · ") || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-2">
                            <UserAvatar shape="square" className="size-7" name={c.name} fallback={c.ini} />
                            <span>
                              <span className="block font-semibold">{c.name}</span>
                              {s.courierBooking ? (
                                <span className="flex flex-wrap items-center gap-1">
                                  <CourierStatusBadge courier={s.courierBooking} />
                                  {s.courierBooking.syncError && (
                                    <WithTooltip content={s.courierBooking.syncError}>
                                      <Badge variant="destructive" tabIndex={0}>{tc("courier:panel.syncErrorShort")}</Badge>
                                    </WithTooltip>
                                  )}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">{[s.shippingMethod || t("orders:shipments.standard"), s.rider].filter(Boolean).join(" · ")}</span>
                              )}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="mb-1.5 flex items-center gap-2">
                            <StatusBadge status={s.status} label={statusLabel(s.status)} />
                            {note && <span className="max-w-[160px] truncate text-xs text-muted-foreground" title={note}>{note}</span>}
                          </div>
                          <div className="grid grid-cols-4 gap-1" role="img" aria-label={t("orders:shipments.progressLabel", { status: statusLabel(s.status) })}>
                            {["Booked", "Picked up", "In transit", "Delivered"].map((label, i) => (
                              <span key={label} className={cn("h-1.5 rounded-full",
                                i < step ? (fail && i === step - 1 ? "bg-destructive" : "bg-primary") : "bg-muted")} />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold tabular-nums">{cod.amount > 0 ? formatCurrency(cod.amount) : "—"}</div>
                          {cod.kind === "delivered_unpaid" ? (
                            <Button type="button" variant="link" size="sm" disabled={saving} onClick={() => recordCod(s)} className="h-auto px-0">{codLabel(cod.kind, cod.label)}</Button>
                          ) : (
                            <div className={cn("text-xs", cod.cls)}>{codLabel(cod.kind, cod.label)}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{t("orders:shipments.created", { date: shortDate(s.createdAt) })}</div>
                          <div className="text-muted-foreground">
                            {s.status === "delivered" ? t("orders:shipments.deliveredOn", { date: shortDate(s.deliveredAt) }) : s.estimatedDelivery ? t("orders:shipments.eta", { date: shortDate(s.estimatedDelivery) }) : t("orders:shipments.noEta")}
                          </div>
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {nxt && !s.courierBooking && (
                              <Button type="button" size="sm" disabled={saving} onClick={() => doStatus(s, { status: nxt })}>
                                {NEXT_STEP_KEY[nxt] ? t(NEXT_STEP_KEY[nxt]) : statusLabel(nxt)}
                              </Button>
                            )}
                            <WithTooltip content={t("orders:shipments.track")}><Button type="button" variant="outline" size="icon" aria-label={t("orders:shipments.track")} onClick={() => openView(s)}><MapPin className="size-4" /></Button></WithTooltip>
                            <WithTooltip content={t("orders:shipments.printLabel")}><Button type="button" variant="outline" size="icon" aria-label={t("orders:shipments.printLabel")} onClick={() => printLabel(s)}><Printer className="size-4" /></Button></WithTooltip>
                            <DropdownMenu>
                              <WithTooltip content={t("common:actions.moreActions")}><DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="icon" aria-label={t("common:actions.moreActions")}><MoreHorizontal className="size-4" /></Button>
                              </DropdownMenuTrigger></WithTooltip>
                              <DropdownMenuContent align="end">
                                {s.courierBooking?.canSync && !s.courierBooking.isFinal && (
                                  <DropdownMenuItem disabled={saving} onClick={() => syncCourier(s)}>{tc("courier:actions.refreshStatus")}</DropdownMenuItem>
                                )}
                                {s.courierBooking?.canCancel && (
                                  <DropdownMenuItem onClick={() => openView(s)}>{tc("courier:panel.cancelAtCourier")}</DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => openView(s)}>{t("orders:shipments.updateStatus")}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openView(s)}>{t("orders:shipments.viewHistory")}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
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

      <ShipmentDetailDialog
        shipment={viewing}
        formatCurrency={formatCurrency}
        busy={saving}
        onClose={() => setViewing(null)}
        onPrint={printLabel}
        onUpdateStatus={doStatus}
        onRecordCod={recordCod}
        onCourierChanged={courierChanged}
      />

      <CreateShipmentModal open={createOpen} onOpenChange={setCreateOpen} preselectOrderId={preselectOrder} onCreated={fetchAll} />
    </div>
  )
}
