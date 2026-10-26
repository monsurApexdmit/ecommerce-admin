"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  Banknote, CheckCircle2, Clock, Download, MapPin, MoreHorizontal, Package, Plus, Printer, Search, Truck, X, XCircle,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
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
import { NEXT_STEP_LABEL, STATUS_LABEL, STATUS_STYLE, codView, nextStep, shortDate, validNextStatuses } from "@/components/shipments/shipment-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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

/** How many of the 4 progress segments are filled: Booked, Picked up, In transit, Delivered */
const STEP: Record<ShipmentStatus, number> = {
  pending: 1, picked_up: 2, in_transit: 3, out_for_delivery: 3, delivered: 4, failed: 3, returned: 3,
}

const iconBtn =
  "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const filterSelect = "h-11 rounded-[10px] border-dash-border bg-dash-card text-[13px] font-semibold"

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
  }, [page, perPage, search, tab, courierFilter, days])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (blocked) return blocked

  const hasFilters = !!(search || courierFilter !== "all" || tab !== "all" || days !== "any")
  const resetFilters = () => { setSearch(""); setCourierFilter("all"); setDays("any"); setTab("all"); setPage(1) }
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
      toast({ variant: "destructive", title: "Not allowed", description: `Cannot move from ${STATUS_LABEL[s.status]} to ${STATUS_LABEL[p.status]}` })
      return false
    }
    if (p.status === "failed" && !p.description?.trim()) {
      toast({ variant: "destructive", title: "Note required", description: "Explain why the delivery failed" })
      return false
    }
    if ((p.status === "failed" || p.status === "returned") &&
      !window.confirm(`Mark shipment ${s.trackingNumber || `#${s.id}`} as ${STATUS_LABEL[p.status]}?`)) return false
    setSaving(true)
    try {
      const res = await shipmentsApi.updateStatus(s.id, p)
      const next = (res.data ?? res) as ShipmentResponse
      if (viewing?.id === next.id) setViewing(await shipmentsApi.getById(next.id).then((r) => (r.data ?? r) as ShipmentResponse).catch(() => next))
      toast({ title: "Shipment updated", description: STATUS_LABEL[next.status] })
      fetchAll()
      return true
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not update", description: err?.response?.data?.message || "Please try again" })
      return false
    } finally {
      setSaving(false)
    }
  }

  const recordCod = async (s: ShipmentResponse) => {
    setSaving(true)
    try {
      const res = await shipmentsApi.recordCodPayment(s.id)
      const next = (res.data ?? res) as ShipmentResponse
      if (viewing?.id === next.id) setViewing(next)
      toast({ title: "COD payment recorded", description: formatCurrency(codView(s).amount) })
      fetchAll()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not record payment", description: err?.response?.data?.message || "Please try again" })
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
      if (rows.length === 0) { toast({ title: "Nothing to export", description: "No COD shipments match" }); return }
      const head = ["Invoice", "Customer", "Courier", "Tracking", "COD amount", "Collected state", "Delivery charge", "COD fee (1%)", "Net"]
      const lines = rows.map((x) => {
        const c = codView(x)
        const fee = Number(x.shippingCost) || 0
        const codFee = Math.round(c.amount * 1) / 100
        return [x.sell?.invoiceNo ?? x.sellId, x.sell?.customerName ?? "", x.carrier ?? "", x.trackingNumber ?? "", c.amount, c.label, fee, codFee.toFixed(2), (c.amount - fee - codFee).toFixed(2)]
      })
      const csv = [head, ...lines].map((r) => r.map(csvCell).join(",")).join("\n")
      const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `cod-report-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ variant: "destructive", title: "Export failed", description: "Please try again" })
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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Shipments</h1>
          <p className="mt-1 text-sm text-dash-muted">Track every parcel from booking to delivery, including cash on delivery.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/orders"
            className="inline-flex h-11 items-center rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
            All orders
          </Link>
          <button type="button" onClick={exportCod} disabled={exporting}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft disabled:opacity-50">
            <Download className="size-4" aria-hidden /> {exporting ? "Exporting…" : "Export COD report"}
          </button>
          <button type="button" onClick={() => { setPreselectOrder(null); setCreateOpen(true) }}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">
            <Plus className="size-4" aria-hidden /> Create shipment
          </button>
        </div>
      </div>

      {stats && stats.readyToShip > 0 && (
        <button type="button" onClick={() => { setPreselectOrder(null); setCreateOpen(true) }}
          className="flex items-center gap-3 rounded-[14px] border border-dash-accent/30 bg-dash-accent-soft px-4 py-3 text-left text-sm text-dash-accent-fg hover:opacity-90">
          <Package className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 font-semibold">{stats.readyToShip} order{stats.readyToShip === 1 ? " is" : "s are"} ready to ship</span>
          <span className="font-bold">Create shipment →</span>
        </button>
      )}

      {/* KPIs */}
      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[118px] rounded-[14px]" />)}
        </div>
      ) : (
        <div className="[&>div]:xl:grid-cols-6">
          <StatsCards stats={[
            { label: "Ready to ship", value: stats.readyToShip, icon: <Package className="size-4" />, color: "blue", hint: "Orders without shipment",
              onClick: () => { setPreselectOrder(null); setCreateOpen(true) } },
            { label: "Pending pickup", value: stats.pending, icon: <Clock className="size-4" />, color: "yellow", hint: "Waiting for rider",
              active: tab === "pending", onClick: () => changeTab("pending") },
            { label: "In transit", value: inTransitTotal, icon: <Truck className="size-4" />, color: "purple", hint: "With couriers",
              active: tab === "in_transit", onClick: () => changeTab("in_transit") },
            { label: "Delivered", value: stats.delivered, icon: <CheckCircle2 className="size-4" />, color: "green",
              hint: stats.total ? `${Math.round((stats.delivered / stats.total) * 100)}% of all shipments` : "No deliveries yet",
              active: tab === "delivered", onClick: () => changeTab("delivered") },
            { label: "Failed / returned", value: stats.failed + stats.returned, icon: <XCircle className="size-4" />, color: "red",
              hint: stats.failed + stats.returned > 0 ? "Needs follow-up" : "—",
              active: tab === "failed", onClick: () => changeTab("failed") },
            { label: "COD with couriers", value: formatCurrency(stats.codWithCouriers), icon: <Banknote className="size-4" />, color: "yellow", hint: "Not yet collected" },
          ]} />
        </div>
      )}

      {/* Table card */}
      <section className="rounded-[14px] border border-dash-border bg-dash-card">
        <div className="px-4">
          <StatusTabs
            value={tab}
            onChange={changeTab}
            tabs={[
              { value: "all", label: "All", count: stats?.total },
              { value: "pending", label: "Pending pickup", count: stats?.pending },
              { value: "picked_up", label: "Picked up", count: stats?.pickedUp },
              { value: "in_transit", label: "In transit", count: stats ? stats.inTransit + stats.outForDelivery : undefined },
              { value: "delivered", label: "Delivered", count: stats?.delivered },
              { value: "failed", label: "Failed / returned", count: stats ? stats.failed + stats.returned : undefined },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden />
            <span className="sr-only">Search shipments</span>
            <input
              type="search"
              placeholder="Search tracking number, order, customer or phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted"
            />
          </label>
          <Select value={courierFilter} onValueChange={(v) => { setCourierFilter(v); setPage(1) }}>
            <SelectTrigger aria-label="Courier" className={cn(filterSelect, "w-[160px]")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Courier: All</SelectItem>
              {COURIERS.filter((c) => c.name !== "Other").map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={(v) => { setDays(v); setPage(1) }}>
            <SelectTrigger aria-label="Date" className={cn(filterSelect, "w-[160px]")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Date: Any</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center gap-1 px-2 text-[13px] font-semibold text-dash-muted hover:text-dash-ink">
              <X className="size-4" aria-hidden /> Clear
            </button>
          )}
        </div>

        {selected.size > 0 && (
          <div className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-[10px] bg-dash-accent-soft px-3.5 py-2 text-[13px] font-semibold text-dash-accent-fg">
            <span>{selected.size} selected</span>
            <button type="button" onClick={printSelected} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-dash-accent px-3 text-white">
              <Printer className="size-4" aria-hidden /> Print labels
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="h-9 px-2 hover:underline">Clear</button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2 p-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded" />)}</div>
        ) : shipments.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 px-6 py-14 text-center">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-dash-accent-soft text-dash-accent-fg">
              <Truck className="size-[30px]" aria-hidden />
            </span>
            <h2 className="mt-1 text-lg font-bold">{hasFilters ? "No shipments match" : "No shipments yet"}</h2>
            <p className="max-w-[420px] text-sm leading-relaxed text-dash-muted">
              {hasFilters
                ? "Try a different search or clear the filters."
                : `You have ${stats?.readyToShip ?? 0} order${stats?.readyToShip === 1 ? "" : "s"} waiting for delivery. Create a shipment to record the courier and tracking number.`}
            </p>
            {!hasFilters && (
              <button type="button" onClick={() => { setPreselectOrder(null); setCreateOpen(true) }}
                className="mt-1.5 h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white">
                Create first shipment
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                    <th scope="col" className="w-10 py-3 pl-4 pr-1">
                      <input type="checkbox" aria-label="Select all shipments" checked={allSelected} onChange={toggleAll} className="size-4 accent-[var(--dash-accent)]" />
                    </th>
                    <th scope="col" className="py-3 pl-2 pr-2 font-semibold">Tracking / order</th>
                    <th scope="col" className="px-2 py-3 font-semibold">Customer</th>
                    <th scope="col" className="px-2 py-3 font-semibold">Courier</th>
                    <th scope="col" className="min-w-[220px] px-2 py-3 font-semibold">Progress</th>
                    <th scope="col" className="px-2 py-3 text-right font-semibold">COD</th>
                    <th scope="col" className="px-2 py-3 font-semibold">Dates</th>
                    <th scope="col" className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((s) => {
                    const c = courierStyle(s.carrier)
                    const cod = codView(s)
                    const nxt = nextStep(s.status)
                    const step = STEP[s.status] ?? 1
                    const fail = s.status === "failed" || s.status === "returned"
                    const note = s.trackingHistory?.[0]?.description
                    return (
                      <tr key={s.id}>
                        <td className="border-b border-dash-border-soft py-3.5 pl-4 pr-1">
                          <input type="checkbox" aria-label={`Select ${s.trackingNumber || s.id}`} checked={selected.has(s.id)} onChange={() => toggleOne(s.id)} className="size-4 accent-[var(--dash-accent)]" />
                        </td>
                        <td className="border-b border-dash-border-soft py-3.5 pl-2 pr-2">
                          <div className="font-bold">{s.trackingNumber || "No tracking yet"}</div>
                          <Link href="/dashboard/orders" className="text-xs text-dash-accent hover:underline">#{s.sell?.invoiceNo ?? s.sellId}</Link>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3.5">
                          <div className="font-semibold">{s.sell?.customerName ?? "—"}</div>
                          <div className="text-xs text-dash-muted">{[s.sell?.area, s.sell?.customerPhone].filter(Boolean).join(" · ") || "—"}</div>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="flex size-7 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ background: c.color }}>{c.ini}</span>
                            <span>
                              <span className="block font-semibold">{c.name}</span>
                              <span className="text-xs text-dash-muted">{[s.shippingMethod || "Standard", s.rider].filter(Boolean).join(" · ")}</span>
                            </span>
                          </span>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3.5">
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_STYLE[s.status])}>{STATUS_LABEL[s.status]}</span>
                            {note && <span className="max-w-[160px] truncate text-xs text-dash-muted" title={note}>{note}</span>}
                          </div>
                          <div className="grid grid-cols-4 gap-1" role="img" aria-label={`Progress: ${STATUS_LABEL[s.status]}`}>
                            {["Booked", "Picked up", "In transit", "Delivered"].map((label, i) => (
                              <span key={label} title={label} className="h-1.5 rounded-full"
                                style={{
                                  background: i < step
                                    ? fail && i === step - 1 ? "var(--dash-danger)" : step === 4 ? "var(--dash-success)" : "var(--dash-accent)"
                                    : "var(--dash-border)",
                                }} />
                            ))}
                          </div>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3.5 text-right">
                          <div className="font-bold tabular-nums">{cod.amount > 0 ? formatCurrency(cod.amount) : "—"}</div>
                          {cod.kind === "delivered_unpaid" ? (
                            <button type="button" disabled={saving} onClick={() => recordCod(s)} className={cn("text-xs font-semibold underline-offset-2 hover:underline", cod.cls)}>{cod.label}</button>
                          ) : (
                            <div className={cn("text-xs", cod.cls)}>{cod.label}</div>
                          )}
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3.5 text-[13px]">
                          <div>Created {shortDate(s.createdAt)}</div>
                          <div className="text-dash-muted">
                            {s.status === "delivered" ? `Delivered ${shortDate(s.deliveredAt)}` : s.estimatedDelivery ? `ETA ${shortDate(s.estimatedDelivery)}` : "No ETA"}
                          </div>
                        </td>
                        <td className="border-b border-dash-border-soft py-3.5 pl-2 pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {nxt && (
                              <button type="button" disabled={saving} onClick={() => doStatus(s, { status: nxt })}
                                className="h-9 whitespace-nowrap rounded-lg bg-dash-accent px-2.5 text-xs font-semibold text-white disabled:opacity-50">
                                {NEXT_STEP_LABEL[nxt]}
                              </button>
                            )}
                            <button type="button" aria-label="Track shipment" className={iconBtn} onClick={() => openView(s)}><MapPin className="size-4" /></button>
                            <button type="button" aria-label="Print label" className={iconBtn} onClick={() => printLabel(s)}><Printer className="size-4" /></button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" aria-label="More actions" className={iconBtn}><MoreHorizontal className="size-4" /></button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openView(s)}>Update status</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openView(s)}>View tracking history</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
          </>
        )}
      </section>

      <ShipmentDetailDialog
        shipment={viewing}
        formatCurrency={formatCurrency}
        busy={saving}
        onClose={() => setViewing(null)}
        onPrint={printLabel}
        onUpdateStatus={doStatus}
        onRecordCod={recordCod}
      />

      <CreateShipmentModal open={createOpen} onOpenChange={setCreateOpen} preselectOrderId={preselectOrder} onCreated={fetchAll} />
    </div>
  )
}
