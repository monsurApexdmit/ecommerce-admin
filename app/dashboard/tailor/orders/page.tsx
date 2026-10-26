"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Banknote, Clock, Download, Eye, FileText, Package, Printer, Scissors, Search, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { PageHeader } from "@/components/common/PageHeader"
import { FilterBar } from "@/components/common/Toolbar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { OrderDetailDialog } from "@/components/tailor/OrderDetailDialog"
import {
  PayBadge, StageBadge, StageBar, UrgentBadge, apiError, fmtDate, whenText,
} from "@/components/tailor/order-ui"
import {
  TAILOR_STAGE_LABEL, tailorApi, tailorOrdersApi,
  type TailorBoardResponse, type TailorBoardRow, type TailorDorji,
} from "@/lib/tailorApi"
import { printInvoice, printJobCard } from "@/lib/tailorOrderPrint"
import { exportToCSV } from "@/lib/export-import-utils"
import { saasCompanyApi } from "@/lib/saasCompanyApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

type Tab = "open" | "new" | "cutting" | "stitching" | "trial" | "ready" | "delivered" | "cancelled"

const TABS: [Tab, string][] = [
  ["open", "In progress"], ["new", "Received"], ["cutting", "Cutting"], ["stitching", "Stitching"],
  ["trial", "Trial"], ["ready", "Ready"], ["delivered", "Delivered"], ["cancelled", "Cancelled"],
]
const DELIVERY_OPTS = [["all", "Delivery: Any date"], ["overdue", "Overdue"], ["today", "Due today"], ["week", "Next 7 days"]] as const
const PAY_OPTS = [["all", "Payment: All"], ["unpaid", "Unpaid"], ["partial", "Partial"], ["paid", "Paid"]] as const

export default function TailorOrdersPage() {
  const { formatCurrency } = useCompanySettings()
  const { canWrite } = useSaasAuth()
  const blocked = useModuleGuard("TailorOrders")
  const writable = canWrite("TailorOrders")

  const [data, setData] = useState<TailorBoardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("open")
  const [search, setSearch] = useState("")
  const [searchD, setSearchD] = useState("")
  const [dorjiF, setDorjiF] = useState("all")
  const [deliveryF, setDeliveryF] = useState<string>("all")
  const [payF, setPayF] = useState<string>("all")
  const [fromD, setFromD] = useState("")
  const [toD, setToD] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [dorjis, setDorjis] = useState<TailorDorji[]>([])

  const [viewId, setViewId] = useState<number | null>(null)
  const [focusPay, setFocusPay] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [businessName, setBusinessName] = useState("")
  const [confirmRow, setConfirmRow] = useState<TailorBoardRow | null>(null)

  useEffect(() => { const t = setTimeout(() => { setSearchD(search.trim()); setPage(1) }, 250); return () => clearTimeout(t) }, [search])

  // deep links: ?status=ready and ?view=<id> (the old order-detail route redirects here)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const s = q.get("status") as Tab | null
    if (s && TABS.some(([v]) => v === s)) setTab(s)
    const v = Number(q.get("view"))
    if (v > 0) setViewId(v)
    saasCompanyApi.getProfile().then((r) => setBusinessName(r.data?.name ?? "")).catch(() => {})
    tailorApi.getDorjis().then((r) => setDorjis(r.data?.data ?? [])).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await tailorOrdersApi.board({
        status: tab, page, limit: perPage,
        search: searchD || undefined,
        dorji_id: dorjiF !== "all" ? dorjiF : undefined,
        delivery: deliveryF !== "all" ? deliveryF : undefined,
        payment_status: payF !== "all" ? payF : undefined,
        delivery_from: fromD || undefined, delivery_to: toD || undefined,
      })
      setData(res)
    } catch {
      toast.error("Failed to load tailor orders")
    } finally {
      setLoading(false)
    }
  }, [tab, page, perPage, searchD, dorjiF, deliveryF, payF, fromD, toD])
  useEffect(() => { load() }, [load])

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }

  const rows = data?.orders ?? []
  const total = data?.pagination.total ?? 0
  const stats = data?.stats
  const counts = data?.statusCounts
  const hasFilter = !!(searchD || dorjiF !== "all" || deliveryF !== "all" || payF !== "all" || fromD || toD)

  const move = async (r: TailorBoardRow) => {
    if (!r.nextStage) return
    setBusyId(r.id)
    try {
      await tailorOrdersApi.transition(r.id, r.nextStage)
      toast.success(r.nextStage === "delivered" ? `${r.orderNumber} delivered` : `${r.orderNumber} moved to ${TAILOR_STAGE_LABEL[r.nextStage].toLowerCase()}`)
      setConfirmRow(null)
      await load()
    } catch (e) {
      toast.error(apiError(e, "Failed to update status"))
    } finally {
      setBusyId(null)
    }
  }

  const onMove = (r: TailorBoardRow) => {
    if (r.nextStage === "delivered" && r.dueAmount > 0) setConfirmRow(r)
    else move(r)
  }

  const printCard = async (r: TailorBoardRow) => {
    try {
      const d = await tailorOrdersApi.detail(r.id)
      if (!printJobCard(d)) toast.error("Allow pop-ups to print.")
    } catch {
      toast.error("Failed to load order")
    }
  }

  const printInv = async (r: TailorBoardRow) => {
    try {
      const d = await tailorOrdersApi.detail(r.id)
      if (!printInvoice(d, businessName, formatCurrency)) toast.error("Allow pop-ups to print.")
    } catch {
      toast.error("Failed to load order")
    }
  }

  const openView = (id: number, pay = false) => { setFocusPay(pay); setViewId(id) }

  const handleExport = async () => {
    try {
      const all: TailorBoardRow[] = []
      for (let p = 1; p <= 50; p++) {
        const res = await tailorOrdersApi.board({
          status: tab, page: p, limit: 100, search: searchD || undefined, dorji_id: dorjiF !== "all" ? dorjiF : undefined,
          delivery: deliveryF !== "all" ? deliveryF : undefined, payment_status: payF !== "all" ? payF : undefined,
          delivery_from: fromD || undefined, delivery_to: toD || undefined,
        })
        all.push(...res.orders)
        if (p >= res.pagination.lastPage) break
      }
      if (all.length === 0) { toast.error("Nothing to export"); return }
      exportToCSV(all.map((o) => ({
        order: o.orderNumber, order_date: o.orderDate ?? "", customer: o.customer?.name ?? "", phone: o.customer?.phone ?? "", items: o.itemsSummary,
        status: TAILOR_STAGE_LABEL[o.stage], payment: o.paymentStatus, dorji: o.dorjiNames.join(", "), delivery: o.deliveryDate ?? "",
        total: o.totalAmount, paid: o.paidAmount, due: o.dueAmount, notes: o.notes ?? "",
      })), "tailor-orders", ["order", "order_date", "customer", "phone", "items", "status", "payment", "dorji", "delivery", "total", "paid", "due", "notes"])
    } catch {
      toast.error("Export failed")
    }
  }

  if (blocked) return blocked

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title="Tailor orders"
        description="Every stitching job from measurement to delivery."
        actions={<>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export</Button>
          {writable && <Button asChild><Link href="/dashboard/tailor/orders/new">+ New tailor order</Link></Button>}
        </>}
      />

      {loading && !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[118px]" />)}</div>
      ) : stats ? (
        <StatsCards stats={[
          { label: "Open orders", value: stats.openOrders, icon: <Package className="size-4" />, color: "blue", hint: `${stats.readyForPickup} ready for pickup` },
          { label: "Due in 7 days", value: stats.dueIn7Days, icon: <Clock className="size-4" />, color: "yellow", hint: "Delivery this week",
            onClick: () => { setTab("open"); setDeliveryF("week"); setPage(1) }, active: deliveryF === "week" },
          { label: "Overdue", value: stats.overdue, icon: <TriangleAlert className="size-4" />, color: "red", hint: stats.overdue ? "Needs attention" : "On schedule",
            onClick: () => { setTab("open"); setDeliveryF("overdue"); setPage(1) }, active: deliveryF === "overdue" },
          { label: "Balance to collect", value: formatCurrency(stats.balanceToCollect), icon: <Banknote className="size-4" />, color: "green", hint: `${stats.balanceOrders} order${stats.balanceOrders === 1 ? "" : "s"}` },
        ]} />
      ) : null}

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }}
            tabs={TABS.map(([v, label]) => ({ value: v, label, count: counts?.[v] }))} />
        </div>
        <FilterBar className="gap-2.5 p-4">
          <InputGroup className="min-w-[240px] flex-1">
            <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
            <InputGroupInput type="search" aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, customer or phone…" />
          </InputGroup>
          <Select value={dorjiF} onValueChange={(v) => resetPage(setDorjiF)(v)}>
            <SelectTrigger aria-label="Dorji" className="min-w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Dorji: All</SelectItem><SelectItem value="none">Unassigned</SelectItem>
              {dorjis.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={deliveryF} onValueChange={(v) => resetPage(setDeliveryF)(v)}>
            <SelectTrigger aria-label="Delivery" className="min-w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>{DELIVERY_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={payF} onValueChange={(v) => resetPage(setPayF)(v)}>
            <SelectTrigger aria-label="Payment" className="min-w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>{PAY_OPTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <FormField orientation="horizontal" className="w-auto gap-2" label="Delivery from" htmlFor="tailor-orders-from">
            <Input id="tailor-orders-from" type="date" aria-label="Delivery from" className="w-auto" value={fromD} onChange={(e) => resetPage(setFromD)(e.target.value)} />
          </FormField>
          <FormField orientation="horizontal" className="w-auto gap-2" label="to" htmlFor="tailor-orders-to">
            <Input id="tailor-orders-to" type="date" aria-label="Delivery to" className="w-auto" value={toD} onChange={(e) => resetPage(setToD)(e.target.value)} />
          </FormField>
        </FilterBar>

        <div className="overflow-x-auto">
          <Table className="min-w-[1040px]">
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead><TableHead>Customer</TableHead>
                <TableHead>Items</TableHead><TableHead>Progress</TableHead>
                <TableHead>Dorji</TableHead><TableHead>Delivery</TableHead>
                <TableHead className="text-right">Total / due</TableHead><TableHead className="text-right">Next step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10" /></TableCell></TableRow>) :
                rows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="whitespace-normal">
                    <EmptyState icon={Scissors} title="No orders found" className="p-4 md:p-6"
                      description={hasFilter || tab !== "open" ? "No orders match these filters." : "No tailor orders yet. Create the first one with “+ New tailor order”."} />
                  </TableCell></TableRow>
                ) : rows.map((r) => {
                  const when = whenText(r.daysLeft, r.stage)
                  const open = r.stage !== "delivered" && r.stage !== "cancelled"
                  const busy = busyId === r.id
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Button type="button" variant="link" onClick={() => openView(r.id)} className="h-auto p-0">{r.orderNumber}</Button>
                          {r.isUrgent && <UrgentBadge />}
                        </div>
                        <div className="text-xs text-muted-foreground">{fmtDate(r.orderDate)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{r.customer?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.customer?.phone}</div>
                      </TableCell>
                      <TableCell><div className="max-w-[200px] truncate" title={r.itemsSummary}>{r.itemsSummary || "—"}</div></TableCell>
                      <TableCell>
                        <StageBadge stage={r.stage} />
                        <StageBar stageIndex={r.stageIndex} stage={r.stage} />
                        {r.progress.total > 0 && <div className="mt-1 text-[11px] text-muted-foreground">{r.progress.done}/{r.progress.total} done by dorji</div>}
                      </TableCell>
                      <TableCell>
                        {r.dorjiNames.length > 0 ? <Badge variant="secondary">{r.dorjiNames.join(", ")}</Badge>
                          : open ? <Link href="/dashboard/tailor/assignments" className="text-xs font-medium text-primary underline-offset-4 hover:underline">+ Assign</Link> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold">{fmtDate(r.deliveryDate)}</div>
                        <div className={cn("text-xs font-semibold", when.cls)}>{when.text}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="font-bold">{formatCurrency(r.totalAmount)}</div>
                        <div className={cn("text-xs font-semibold", r.stage === "cancelled" ? "text-muted-foreground" : r.dueAmount > 0 ? "text-destructive" : "text-dash-success-fg")}>
                          {r.stage === "cancelled" ? "Cancelled" : r.dueAmount > 0 ? `Due ${formatCurrency(r.dueAmount)}` : "Paid in full"}
                        </div>
                        <PayBadge status={r.paymentStatus} className="mt-0.5" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {writable && open && r.nextStage && (
                            <Button type="button" disabled={busy} onClick={() => onMove(r)}
                              variant={r.stage === "ready" ? "default" : "secondary"} className="mr-1">
                              {r.stage === "ready" ? `Deliver${r.dueAmount > 0 ? ` & collect ${formatCurrency(r.dueAmount)}` : ""}` : `→ ${TAILOR_STAGE_LABEL[r.nextStage]}`}
                            </Button>
                          )}
                          {writable && r.dueAmount > 0 && <WithTooltip content="Record payment"><Button type="button" variant="outline" size="icon" aria-label="Record payment" onClick={() => openView(r.id, true)}><Banknote className="size-4" /></Button></WithTooltip>}
                          <WithTooltip content="View order"><Button type="button" variant="outline" size="icon" aria-label="View order" onClick={() => openView(r.id)}><Eye className="size-4" /></Button></WithTooltip>
                          <WithTooltip content="Print invoice"><Button type="button" variant="outline" size="icon" aria-label="Print invoice" onClick={() => printInv(r)}><FileText className="size-4" /></Button></WithTooltip>
                          <WithTooltip content="Print job card"><Button type="button" variant="outline" size="icon" aria-label="Print job card" onClick={() => printCard(r)}><Printer className="size-4" /></Button></WithTooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </div>

        {!loading && total > 0 && (
          <>
          <Separator />
          <div className="p-4 pt-3">
            <PaginationControl currentPage={page} totalPages={Math.max(1, data?.pagination.lastPage ?? 1)} itemsPerPage={perPage} totalItems={total}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
          </div>
          </>
        )}
        <Separator />
        <div className="px-4 py-2.5 text-xs text-muted-foreground">Showing {total} order{total === 1 ? "" : "s"}</div>
      </Card>

      <OrderDetailDialog orderId={viewId} focusPay={focusPay} canWrite={writable}
        onClose={() => { setViewId(null); setFocusPay(false) }} onChanged={load} />

      <Dialog open={!!confirmRow} onOpenChange={(o) => !o && setConfirmRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deliver {confirmRow?.orderNumber}</DialogTitle>
            <DialogDescription>Collect {formatCurrency(confirmRow?.dueAmount ?? 0)} in cash and mark this order as delivered?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmRow(null)} disabled={busyId != null}>Cancel</Button>
            <Button type="button" onClick={() => confirmRow && move(confirmRow)} disabled={busyId != null}>Collect &amp; deliver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
