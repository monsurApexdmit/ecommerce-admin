"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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
import { NEXT_STEP_LABEL, STATUS_LABEL, codView, nextStep, shortDate, validNextStatuses } from "@/components/shipments/shipment-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
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

/** How many of the 4 progress segments are filled: Booked, Picked up, In transit, Delivered */
const STEP: Record<ShipmentStatus, number> = {
  pending: 1, picked_up: 2, in_transit: 3, out_for_delivery: 3, delivered: 4, failed: 3, returned: 3,
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
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      {/* Header */}
      <PageHeader
        title="Shipments"
        description="Track every parcel from booking to delivery, including cash on delivery."
        actions={<>
          <Button asChild variant="outline">
            <Link href="/dashboard/orders">All orders</Link>
          </Button>
          <Button type="button" variant="outline" onClick={exportCod} disabled={exporting}>
            <Download className="size-4" aria-hidden /> {exporting ? "Exporting…" : "Export COD report"}
          </Button>
          <Button type="button" onClick={() => { setPreselectOrder(null); setCreateOpen(true) }}>
            <Plus className="size-4" aria-hidden /> Create shipment
          </Button>
        </>}
      />

      {stats && stats.readyToShip > 0 && (
        <Button type="button" variant="outline" onClick={() => { setPreselectOrder(null); setCreateOpen(true) }}
          className="h-auto w-full justify-start gap-3 py-3 text-left whitespace-normal">
          <Package className="size-5 shrink-0" aria-hidden />
          <span className="flex-1 font-semibold">{stats.readyToShip} order{stats.readyToShip === 1 ? " is" : "s are"} ready to ship</span>
          <span className="font-bold">Create shipment →</span>
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
      <Card className="gap-0 py-0">
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

        <Toolbar className="p-4">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="shipment-search" className="sr-only">Search shipments</Label>
            <Input
              id="shipment-search"
              type="search"
              placeholder="Search tracking number, order, customer or phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
            />
          </div>
          <Select value={courierFilter} onValueChange={(v) => { setCourierFilter(v); setPage(1) }}>
            <SelectTrigger aria-label="Courier" className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Courier: All</SelectItem>
              {COURIERS.filter((c) => c.name !== "Other").map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={days} onValueChange={(v) => { setDays(v); setPage(1) }}>
            <SelectTrigger aria-label="Date" className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Date: Any</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={resetFilters}>
              <X className="size-4" aria-hidden /> Clear
            </Button>
          )}
        </Toolbar>

        <BulkBar count={selected.size} onClear={() => setSelected(new Set())} className="mx-4 mb-3">
          <Button type="button" size="sm" onClick={printSelected}>
            <Printer className="size-4" aria-hidden /> Print labels
          </Button>
        </BulkBar>

        {loading ? (
          <div className="space-y-2 p-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : shipments.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={hasFilters ? "No shipments match" : "No shipments yet"}
            description={hasFilters
              ? "Try a different search or clear the filters."
              : `You have ${stats?.readyToShip ?? 0} order${stats?.readyToShip === 1 ? "" : "s"} waiting for delivery. Create a shipment to record the courier and tracking number.`}
            action={!hasFilters ? (
              <Button type="button" onClick={() => { setPreselectOrder(null); setCreateOpen(true) }}>
                Create first shipment
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
                      <Checkbox aria-label="Select all shipments" checked={allSelected} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead scope="col">Tracking / order</TableHead>
                    <TableHead scope="col">Customer</TableHead>
                    <TableHead scope="col">Courier</TableHead>
                    <TableHead scope="col" className="min-w-[220px]">Progress</TableHead>
                    <TableHead scope="col" className="text-right">COD</TableHead>
                    <TableHead scope="col">Dates</TableHead>
                    <TableHead scope="col" className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map((s) => {
                    const c = courierStyle(s.carrier)
                    const cod = codView(s)
                    const nxt = nextStep(s.status)
                    const step = STEP[s.status] ?? 1
                    const fail = s.status === "failed" || s.status === "returned"
                    const note = s.trackingHistory?.[0]?.description
                    return (
                      <TableRow key={s.id} data-state={selected.has(s.id) ? "selected" : undefined}>
                        <TableCell className="pl-4">
                          <Checkbox aria-label={`Select ${s.trackingNumber || s.id}`} checked={selected.has(s.id)} onCheckedChange={() => toggleOne(s.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="font-bold">{s.trackingNumber || "No tracking yet"}</div>
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
                              <span className="text-xs text-muted-foreground">{[s.shippingMethod || "Standard", s.rider].filter(Boolean).join(" · ")}</span>
                            </span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="mb-1.5 flex items-center gap-2">
                            <StatusBadge status={s.status} label={STATUS_LABEL[s.status]} />
                            {note && <span className="max-w-[160px] truncate text-xs text-muted-foreground" title={note}>{note}</span>}
                          </div>
                          <div className="grid grid-cols-4 gap-1" role="img" aria-label={`Progress: ${STATUS_LABEL[s.status]}`}>
                            {["Booked", "Picked up", "In transit", "Delivered"].map((label, i) => (
                              <span key={label} className={cn("h-1.5 rounded-full",
                                i < step ? (fail && i === step - 1 ? "bg-destructive" : "bg-primary") : "bg-muted")} />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold tabular-nums">{cod.amount > 0 ? formatCurrency(cod.amount) : "—"}</div>
                          {cod.kind === "delivered_unpaid" ? (
                            <Button type="button" variant="link" size="sm" disabled={saving} onClick={() => recordCod(s)} className="h-auto px-0">{cod.label}</Button>
                          ) : (
                            <div className={cn("text-xs", cod.cls)}>{cod.label}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>Created {shortDate(s.createdAt)}</div>
                          <div className="text-muted-foreground">
                            {s.status === "delivered" ? `Delivered ${shortDate(s.deliveredAt)}` : s.estimatedDelivery ? `ETA ${shortDate(s.estimatedDelivery)}` : "No ETA"}
                          </div>
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex items-center justify-end gap-1">
                            {nxt && (
                              <Button type="button" size="sm" disabled={saving} onClick={() => doStatus(s, { status: nxt })}>
                                {NEXT_STEP_LABEL[nxt]}
                              </Button>
                            )}
                            <WithTooltip content="Track shipment"><Button type="button" variant="outline" size="icon" aria-label="Track shipment" onClick={() => openView(s)}><MapPin className="size-4" /></Button></WithTooltip>
                            <WithTooltip content="Print label"><Button type="button" variant="outline" size="icon" aria-label="Print label" onClick={() => printLabel(s)}><Printer className="size-4" /></Button></WithTooltip>
                            <DropdownMenu>
                              <WithTooltip content="More actions"><DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="icon" aria-label="More actions"><MoreHorizontal className="size-4" /></Button>
                              </DropdownMenuTrigger></WithTooltip>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openView(s)}>Update status</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openView(s)}>View tracking history</DropdownMenuItem>
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
      />

      <CreateShipmentModal open={createOpen} onOpenChange={setCreateOpen} preselectOrderId={preselectOrder} onCreated={fetchAll} />
    </div>
  )
}
