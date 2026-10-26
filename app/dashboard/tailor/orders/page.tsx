"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Banknote, Clock, Download, Eye, FileText, Package, Printer, Scissors, Search, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { OrderDetailDialog } from "@/components/tailor/OrderDetailDialog"
import {
  PayBadge, StageBadge, StageBar, UrgentBadge, apiError, fmtDate, tIconBtn, tInput, tOutlineBtn, tPrimaryBtn, whenText,
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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Tailor orders</h1>
          <p className="mt-1 text-sm text-dash-muted">Every stitching job from measurement to delivery.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleExport} className={tOutlineBtn}><Download className="size-4" aria-hidden /> Export</button>
          {writable && <Link href="/dashboard/tailor/orders/new" className={tPrimaryBtn}>+ New tailor order</Link>}
        </div>
      </div>

      {loading && !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[118px] rounded-[14px]" />)}</div>
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

      <section className="rounded-[14px] border border-dash-border bg-dash-card">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }}
            tabs={TABS.map(([v, label]) => ({ value: v, label, count: counts?.[v] }))} />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden />
            <span className="sr-only">Search</span>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, customer or phone…"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          <select aria-label="Dorji" className={cn(tInput, "w-auto min-w-[150px]")} value={dorjiF} onChange={(e) => resetPage(setDorjiF)(e.target.value)}>
            <option value="all">Dorji: All</option><option value="none">Unassigned</option>
            {dorjis.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select aria-label="Delivery" className={cn(tInput, "w-auto min-w-[160px]")} value={deliveryF} onChange={(e) => resetPage(setDeliveryF)(e.target.value)}>
            {DELIVERY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select aria-label="Payment" className={cn(tInput, "w-auto min-w-[140px]")} value={payF} onChange={(e) => resetPage(setPayF)(e.target.value)}>
            {PAY_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-dash-muted">Delivery from
            <input type="date" aria-label="Delivery from" className={cn(tInput, "w-auto")} value={fromD} onChange={(e) => resetPage(setFromD)(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-dash-muted">to
            <input type="date" aria-label="Delivery to" className={cn(tInput, "w-auto")} value={toD} onChange={(e) => resetPage(setToD)(e.target.value)} />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-sm">
            <thead>
              <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                <th className="py-3 pl-4 pr-2 font-semibold">Order</th><th className="px-2 py-3 font-semibold">Customer</th>
                <th className="px-2 py-3 font-semibold">Items</th><th className="px-2 py-3 font-semibold">Progress</th>
                <th className="px-2 py-3 font-semibold">Dorji</th><th className="px-2 py-3 font-semibold">Delivery</th>
                <th className="px-2 py-3 text-right font-semibold">Total / due</th><th className="py-3 pl-2 pr-4 text-right font-semibold">Next step</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>) :
                rows.length === 0 ? (
                  <tr><td colSpan={8} className="py-14 text-center">
                    <Scissors className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                    <p className="font-semibold">No orders found</p>
                    <p className="text-sm text-dash-muted">{hasFilter || tab !== "open" ? "No orders match these filters." : "No tailor orders yet. Create the first one with “+ New tailor order”."}</p>
                  </td></tr>
                ) : rows.map((r) => {
                  const when = whenText(r.daysLeft, r.stage)
                  const open = r.stage !== "delivered" && r.stage !== "cancelled"
                  const busy = busyId === r.id
                  return (
                    <tr key={r.id} className="hover:bg-dash-bg/60">
                      <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => openView(r.id)} className="font-bold hover:underline">{r.orderNumber}</button>
                          {r.isUrgent && <UrgentBadge />}
                        </div>
                        <div className="text-xs text-dash-muted">{fmtDate(r.orderDate)}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="font-semibold">{r.customer?.name ?? "—"}</div>
                        <div className="text-xs text-dash-muted">{r.customer?.phone}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3"><div className="max-w-[200px] truncate" title={r.itemsSummary}>{r.itemsSummary || "—"}</div></td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <StageBadge stage={r.stage} />
                        <StageBar stageIndex={r.stageIndex} stage={r.stage} />
                        {r.progress.total > 0 && <div className="mt-1 text-[11px] text-dash-muted">{r.progress.done}/{r.progress.total} done by dorji</div>}
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        {r.dorjiNames.length > 0 ? <span className="rounded-full bg-dash-neutral-soft px-2.5 py-[3px] text-xs font-semibold text-dash-neutral-fg">{r.dorjiNames.join(", ")}</span>
                          : open ? <Link href="/dashboard/tailor/assignments" className="text-xs font-semibold text-dash-accent hover:underline">+ Assign</Link> : <span className="text-dash-muted">—</span>}
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="font-semibold">{fmtDate(r.deliveryDate)}</div>
                        <div className={cn("text-xs font-semibold", when.cls)}>{when.text}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">
                        <div className="font-bold">{formatCurrency(r.totalAmount)}</div>
                        <div className={cn("text-xs font-semibold", r.stage === "cancelled" ? "text-dash-muted" : r.dueAmount > 0 ? "text-dash-danger" : "text-dash-success-fg")}>
                          {r.stage === "cancelled" ? "Cancelled" : r.dueAmount > 0 ? `Due ${formatCurrency(r.dueAmount)}` : "Paid in full"}
                        </div>
                        <PayBadge status={r.paymentStatus} className="mt-0.5 inline-block" />
                      </td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {writable && open && r.nextStage && (
                            <button type="button" disabled={busy} onClick={() => onMove(r)}
                              className={cn("mr-1 h-9 rounded-lg px-3 text-[13px] font-semibold disabled:opacity-40", r.stage === "ready" ? "bg-dash-ink text-dash-bg" : "bg-dash-accent-soft text-dash-accent-fg")}>
                              {r.stage === "ready" ? `Deliver${r.dueAmount > 0 ? ` & collect ${formatCurrency(r.dueAmount)}` : ""}` : `→ ${TAILOR_STAGE_LABEL[r.nextStage]}`}
                            </button>
                          )}
                          {writable && r.dueAmount > 0 && <button type="button" aria-label="Record payment" title="Record payment" className={tIconBtn} onClick={() => openView(r.id, true)}><Banknote className="size-4" /></button>}
                          <button type="button" aria-label="View order" title="View order" className={tIconBtn} onClick={() => openView(r.id)}><Eye className="size-4" /></button>
                          <button type="button" aria-label="Print invoice" title="Print invoice" className={tIconBtn} onClick={() => printInv(r)}><FileText className="size-4" /></button>
                          <button type="button" aria-label="Print job card" title="Print job card" className={tIconBtn} onClick={() => printCard(r)}><Printer className="size-4" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        {!loading && total > 0 && (
          <div className="border-t border-dash-border-soft p-4 pt-3">
            <PaginationControl currentPage={page} totalPages={Math.max(1, data?.pagination.lastPage ?? 1)} itemsPerPage={perPage} totalItems={total}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
          </div>
        )}
        <div className="border-t border-dash-border-soft px-4 py-2.5 text-xs text-dash-muted">Showing {total} order{total === 1 ? "" : "s"}</div>
      </section>

      <OrderDetailDialog orderId={viewId} focusPay={focusPay} canWrite={writable}
        onClose={() => { setViewId(null); setFocusPay(false) }} onChanged={load} />

      <Dialog open={!!confirmRow} onOpenChange={(o) => !o && setConfirmRow(null)}>
        <DialogContent className="gap-0 border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-md">
          <div className="border-b border-dash-border-soft px-6 py-4">
            <DialogTitle className="font-dash-display text-xl font-bold">Deliver {confirmRow?.orderNumber}</DialogTitle>
            <DialogDescription className="text-[13px]">Collect {formatCurrency(confirmRow?.dueAmount ?? 0)} in cash and mark this order as delivered?</DialogDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2 px-6 py-4">
            <button type="button" className={tOutlineBtn} onClick={() => setConfirmRow(null)} disabled={busyId != null}>Cancel</button>
            <button type="button" className={tPrimaryBtn} onClick={() => confirmRow && move(confirmRow)} disabled={busyId != null}>Collect &amp; deliver</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
