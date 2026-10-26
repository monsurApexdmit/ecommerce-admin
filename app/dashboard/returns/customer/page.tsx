"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Banknote, Download, Eye, Package, Printer, RotateCcw, Search, Trash2, Clock, Tag } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import customerReturnsApi, { type CustomerReturnLogStats, type CustomerReturnRow, type ReturnableOrder } from "@/lib/customerReturnsApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

type Tab = "all" | "pending" | "completed" | "rejected" | "restocked" | "written_off"

const TABS: [Tab, string][] = [
  ["all", "All"], ["pending", "Pending"], ["completed", "Completed"], ["rejected", "Rejected"], ["restocked", "Restocked"], ["written_off", "Written off"],
]
const REASONS = ["Size mismatch", "Defective product", "Not as described", "Changed my mind", "Package damaged", "Wrong item received", "Late delivery", "Other"]
const METHODS: { id: "cash" | "original" | "credit" | "none"; label: string; sub: string }[] = [
  { id: "cash", label: "Cash refund", sub: "Paid back now" },
  { id: "original", label: "Original payment", sub: "Back to how they paid" },
  { id: "credit", label: "Store credit", sub: "Customer balance" },
  { id: "none", label: "No refund", sub: "Exchange / adjust only" },
]
const METHOD_LABEL: Record<string, string> = { cash: "Cash", original: "Original payment", credit: "Store credit", none: "No refund" }
const DATE_OPTS = [["all", "All time"], ["7", "Last 7 days"], ["30", "Last 30 days"]] as const
const POLICY_DAYS = 30
const DEFAULT_REASON = "Changed my mind"

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const primaryBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

function statusOf(r: CustomerReturnRow): { label: string; cls: string } {
  if (r.status === "pending") return { label: "Pending approval", cls: "bg-dash-warn-soft text-dash-warn-fg" }
  if (r.status === "rejected") return { label: "Rejected", cls: "bg-dash-danger-soft text-dash-danger-fg" }
  if (r.refundMethod === "cash" || r.refundMethod === "original") return { label: "Refunded", cls: "bg-dash-success-soft text-dash-success-fg" }
  if (r.refundMethod === "credit") return { label: "Credited", cls: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300" }
  return { label: "Completed", cls: "bg-dash-neutral-soft text-dash-neutral-fg" }
}

interface PickLine { sellItemId: number; productId: number; variantId: number | null; name: string; bought: number; returnable: number; price: number; on: boolean; qty: number; reason: string }

export default function CustomerReturnsPage() {
  const { formatCurrency } = useCompanySettings()
  const { warehouses } = useWarehouse()
  const blocked = useModuleGuard("Customer Returns")

  const [rows, setRows] = useState<CustomerReturnRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Partial<Record<Tab, number>>>({})
  const [stats, setStats] = useState<CustomerReturnLogStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [searchD, setSearchD] = useState("")
  const [reasonF, setReasonF] = useState("all")
  const [dateF, setDateF] = useState<"all" | "7" | "30">("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [detail, setDetail] = useState<CustomerReturnRow | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  // ---- new return form
  const [formOpen, setFormOpen] = useState(false)
  const [saleQ, setSaleQ] = useState("")
  const [recent, setRecent] = useState<ReturnableOrder[]>([])
  const [recentLoading, setRecentLoading] = useState(false)
  const [order, setOrder] = useState<ReturnableOrder | null>(null)
  const [lines, setLines] = useState<PickLine[]>([])
  const [method, setMethod] = useState<"cash" | "original" | "credit" | "none">("cash")
  const [restock, setRestock] = useState(true)
  const [printReceipt, setPrintReceipt] = useState(true)
  const [locId, setLocId] = useState("")
  const [note, setNote] = useState("")
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { const t = setTimeout(() => setSearchD(search.trim()), 250); return () => clearTimeout(t) }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, per_page: perPage }
      if (tab !== "all") params.status = tab
      if (searchD) params.search = searchD
      if (reasonF !== "all") params.reason = reasonF
      if (dateF !== "all") params.from = new Date(Date.now() - Number(dateF) * 864e5).toISOString().slice(0, 10)
      const res = await customerReturnsApi.getLog(params)
      setRows(res.data); setTotal(res.total); setCounts(res.counts); setStats(res.stats)
    } catch {
      setRows([])
      toast.error("Failed to load returns")
    } finally {
      setLoading(false)
    }
  }, [page, perPage, tab, searchD, reasonF, dateF])
  useEffect(() => { load() }, [load])

  // recent returnable orders for the form
  const loadRecent = useCallback(async (q: string) => {
    setRecentLoading(true)
    try { setRecent(await customerReturnsApi.getReturnableOrders(q)) } catch { setRecent([]) } finally { setRecentLoading(false) }
  }, [])
  useEffect(() => {
    if (!formOpen || order) return
    const t = setTimeout(() => loadRecent(saleQ.trim()), 250)
    return () => clearTimeout(t)
  }, [formOpen, order, saleQ, loadRecent])

  const openForm = () => {
    setSaleQ(""); setOrder(null); setLines([]); setMethod("cash"); setRestock(true); setPrintReceipt(true); setNote(""); setErr("")
    setLocId(warehouses[0] ? String(warehouses[0].id) : "")
    setFormOpen(true)
  }
  const pickOrder = (o: ReturnableOrder) => {
    setOrder(o)
    if (o.locationId) setLocId(String(o.locationId))
    setLines(o.items.filter((i) => i.returnable > 0).map((i) => ({
      sellItemId: i.sellItemId, productId: i.productId, variantId: i.variantId, name: i.name, bought: i.bought,
      returnable: i.returnable, price: i.price, on: false, qty: 1, reason: DEFAULT_REASON,
    })))
    setErr("")
  }
  const findOrder = () => {
    const q = saleQ.trim().toLowerCase()
    if (!q) return
    const exact = recent.filter((o) => o.invoiceNo.toLowerCase() === q)
    const hit = exact.length === 1 ? exact : recent.length === 1 ? recent : []
    if (hit.length === 1) pickOrder(hit[0])
    else setErr(recent.length === 0 ? "No matching order with returnable items." : "More than one order matches — pick one from the list.")
  }
  const patch = (idx: number, p: Partial<PickLine>) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...p } : l)))

  const picked = lines.filter((l) => l.on)
  const units = picked.reduce((a, l) => a + l.qty, 0)
  const subtotal = Math.round(picked.reduce((a, l) => a + l.qty * l.price, 0) * 100) / 100
  const refund = method === "none" ? 0 : subtotal

  const validate = (): string => {
    if (!order) return "Find an order first."
    if (picked.length === 0) return "Select at least one item to return."
    if (picked.some((l) => !l.reason)) return "Pick a reason for every item."
    if (method === "credit" && !order.customerId) return "Store credit needs a named customer. Use cash refund for walk-in sales."
    if (!locId && restock) return "Choose where the stock goes back to."
    return ""
  }

  const submit = async (mode: "complete" | "request") => {
    const v = validate()
    if (v) { setErr(v); return }
    setSaving(true); setErr("")
    try {
      const res = await customerReturnsApi.createReturn({
        orderId: order!.id,
        items: picked.map((l) => ({ sellItemId: l.sellItemId, productId: l.productId, variantId: l.variantId, quantity: l.qty, price: l.price, reason: l.reason })),
        refundMethod: method, restock, locationId: locId ? Number(locId) : undefined, note: note.trim() || undefined, mode,
      })
      toast.success(mode === "request" ? `${res.returnNumber} submitted for approval` : `${res.returnNumber} recorded`)
      setFormOpen(false)
      if (printReceipt && mode === "complete") printReturn(res)
      setPage(1)
      load()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Could not save the return.")
    } finally {
      setSaving(false)
    }
  }

  const approve = async (r: CustomerReturnRow) => {
    const how = r.refundMethod === "cash" ? "refund it in cash" : r.refundMethod === "original" ? "reverse the original payment" : r.refundMethod === "credit" ? "add store credit" : "reduce the invoice total"
    if (!window.confirm(`Approve ${r.returnNumber} for ${formatCurrency(r.amount)}? This will ${r.restocked ? "return the items to stock and " : "write the items off and "}${how}.`)) return
    setBusyId(r.id)
    try {
      await customerReturnsApi.approveReturn(r.id)
      toast.success(`${r.returnNumber} approved`)
      setDetail(null); load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Could not approve")
    } finally { setBusyId(null) }
  }
  const reject = async (r: CustomerReturnRow) => {
    const reason = window.prompt(`Why reject ${r.returnNumber}? (a reason is required)`)
    if (reason === null) return
    if (!reason.trim()) { toast.error("Enter a reason to reject this return"); return }
    setBusyId(r.id)
    try {
      await customerReturnsApi.rejectReturn(r.id, reason.trim())
      toast.success(`${r.returnNumber} rejected`)
      setDetail(null); load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Could not reject")
    } finally { setBusyId(null) }
  }

  const printReturn = (r: CustomerReturnRow) => {
    const w = window.open("", "_blank", "width=720,height=800")
    if (!w) { toast.error("Allow pop-ups to print"); return }
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))
    w.document.write(`<!doctype html><title>${esc(r.returnNumber)}</title><body style="font-family:sans-serif;padding:24px">
      <h2 style="margin:0">Return ${esc(r.returnNumber)}</h2>
      <p style="color:#5B6478">${fmt(r.createdAt)} · ${esc(r.customerName ?? "Walk-in")} · ${esc(r.invoiceNo ?? "No invoice")}</p>
      <table style="width:100%;border-collapse:collapse">${r.lines.map((l) => `<tr><td style="padding:6px 0">${esc(l.name)}<br><small>${esc(l.reason ?? "")}</small></td><td>${l.quantity} × ${formatCurrency(l.price)}</td><td style="text-align:right">${formatCurrency(l.total)}</td></tr>`).join("")}</table>
      <h3 style="text-align:right">Refund (${esc(METHOD_LABEL[r.refundMethod ?? ""] ?? "—")}): ${formatCurrency(r.amount)}</h3>
      <p>${r.restocked ? "Returned to stock" : "Written off (not restocked)"}</p>${r.note ? `<p>Note: ${esc(r.note)}</p>` : ""}</body>`)
    w.document.close(); w.focus(); w.print()
  }

  const handleExport = async () => {
    try {
      const params: Record<string, any> = { page: 1, per_page: 500 }
      if (tab !== "all") params.status = tab
      if (searchD) params.search = searchD
      if (reasonF !== "all") params.reason = reasonF
      if (dateF !== "all") params.from = new Date(Date.now() - Number(dateF) * 864e5).toISOString().slice(0, 10)
      const all: CustomerReturnRow[] = []
      for (let p = 1; p <= 40; p++) {
        const res = await customerReturnsApi.getLog({ ...params, page: p })
        all.push(...res.data)
        if (p >= res.lastPage) break
      }
      if (all.length === 0) { toast.error("Nothing to export"); return }
      exportToCSV(all.map((r) => ({
        return: r.returnNumber, date: r.createdAt, customer: r.customerName ?? "", invoice: r.invoiceNo ?? "", items: r.itemsSummary, reason: r.reason ?? "",
        status: statusOf(r).label, rejection_reason: r.rejectionReason ?? "", restocked: r.restocked ? "Yes" : "No",
        method: METHOD_LABEL[r.refundMethod ?? ""] ?? "", refunded_via: r.refundedVia ?? "", amount: r.amount, note: r.note ?? "",
      })), "customer-returns", ["return", "date", "customer", "invoice", "items", "reason", "status", "rejection_reason", "restocked", "method", "refunded_via", "amount", "note"])
    } catch {
      toast.error("Could not export returns")
    }
  }

  const cycleReason = () => {
    const opts = ["all", ...REASONS]
    setReasonF(opts[(opts.indexOf(reasonF) + 1) % opts.length]); setPage(1)
  }
  const cycleDate = () => {
    const ids = DATE_OPTS.map((d) => d[0])
    setDateF(ids[(ids.indexOf(dateF) + 1) % ids.length] as "all" | "7" | "30"); setPage(1)
  }
  const hasFilter = !!(searchD || reasonF !== "all" || dateF !== "all")

  if (blocked) return blocked

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Customer returns</h1>
          <p className="mt-1 text-sm text-dash-muted">Take items back, decide what returns to stock, and refund the right way.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => toast.message(`Returns accepted up to ${POLICY_DAYS} days after purchase; items return to stock unless damaged.`)} className={outlineBtn}>Return policy</button>
          <button type="button" onClick={handleExport} className={outlineBtn}><Download className="size-4" aria-hidden /> Export</button>
          <button type="button" onClick={openForm} className={primaryBtn}>New return</button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[118px] rounded-[14px]" />)}</div>
      ) : stats ? (
        <StatsCards stats={[
          { label: "Returns (30 days)", value: stats.returns30d, icon: <RotateCcw className="size-4" />, color: "blue", hint: stats.ordersPct30d ?? undefined },
          { label: "Pending approval", value: stats.pendingCount, icon: <Clock className="size-4" />, color: "yellow",
            hint: stats.pendingCount ? `${formatCurrency(stats.pendingAmount)} awaiting decision` : "Nothing waiting",
            onClick: () => { setTab("pending"); setPage(1) }, active: tab === "pending" },
          { label: "Restocked units", value: stats.restockedUnits, icon: <Package className="size-4" />, color: "purple", hint: "Back on the shelf" },
          { label: "Refunded (cash / original)", value: formatCurrency(stats.refundedAmount), icon: <Banknote className="size-4" />, color: "green", hint: `${stats.refundedCount} return(s)` },
          { label: "Top reason", value: stats.topReason ?? "—", icon: <Tag className="size-4" />, color: "blue", hint: stats.topReason ? `${stats.topReasonCount} return(s)` : "No returns yet" },
          { label: "Written off", value: formatCurrency(stats.writtenOffValue), icon: <Trash2 className="size-4" />, color: "red", hint: "At cost, not restocked" },
        ]} />
      ) : null}

      <section className="rounded-[14px] border border-dash-border bg-dash-card">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }}
            tabs={TABS.map(([v, label]) => ({ value: v, label, count: counts[v] }))} />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden />
            <span className="sr-only">Search returns</span>
            <input type="search" placeholder="Search return #, invoice or customer…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          <button type="button" onClick={cycleReason} className={outlineBtn}>{reasonF === "all" ? "Reason: All" : reasonF} ▾</button>
          <button type="button" onClick={cycleDate} className={outlineBtn}>{DATE_OPTS.find((d) => d[0] === dateF)?.[1]} ▾</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                <th className="py-3 pl-4 pr-2 font-semibold">Return</th><th className="px-2 py-3 font-semibold">Customer / invoice</th>
                <th className="px-2 py-3 font-semibold">Items &amp; reason</th><th className="px-2 py-3 font-semibold">Condition</th>
                <th className="px-2 py-3 text-right font-semibold">Refund</th><th className="px-2 py-3 font-semibold">Status</th>
                <th className="py-3 pl-2 pr-4 text-right font-semibold">Next step</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>) :
                rows.length === 0 ? (
                  <tr><td colSpan={7} className="py-14 text-center">
                    <RotateCcw className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                    <p className="font-semibold">No returns found</p>
                    <p className="text-sm text-dash-muted">{hasFilter || tab !== "all" ? "Try clearing the filters." : "Record a return with New return."}</p>
                  </td></tr>
                ) : rows.map((r) => {
                  const s = statusOf(r)
                  const pending = r.status === "pending"
                  const cond = pending ? (r.restocked ? "Restock on approval" : "Write off on approval") : r.restocked ? "Restocked" : "Written off"
                  return (
                    <tr key={r.id}>
                      <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                        <button type="button" onClick={() => setDetail(r)} className="font-bold hover:underline">{r.returnNumber}</button>
                        <div className="text-xs text-dash-muted">{fmt(r.createdAt)}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="font-semibold">{r.customerName || "Walk-in"}</div>
                        {r.invoiceNo ? <Link href="/dashboard/orders" className="text-xs font-semibold text-dash-accent hover:underline">{r.invoiceNo}</Link> : <span className="text-xs text-dash-muted">No invoice</span>}
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="max-w-[220px] truncate">{r.itemsSummary}</div>
                        <div className="text-xs text-dash-muted">{r.reason || "—"}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", r.restocked ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-danger-soft text-dash-danger-fg")}>{cond}</span>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">
                        <div className="font-bold">{formatCurrency(r.amount)}</div>
                        <div className="text-xs text-dash-muted">{METHOD_LABEL[r.refundMethod ?? ""] ?? "—"}{r.refundedVia ? ` · ${r.refundedVia}` : ""}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3"><span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", s.cls)}>{s.label}</span></td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {pending && <button type="button" disabled={busyId === r.id} onClick={() => approve(r)} className="mr-1 h-9 rounded-lg bg-dash-ink px-3 text-[13px] font-semibold text-dash-bg disabled:opacity-40">Approve</button>}
                          {pending && <button type="button" disabled={busyId === r.id} onClick={() => reject(r)} className="mr-1 text-[13px] font-semibold text-dash-danger-fg hover:underline">Reject</button>}
                          <button type="button" aria-label="View return" className={iconBtn} onClick={() => setDetail(r)}><Eye className="size-4" /></button>
                          <button type="button" aria-label="Print return" className={iconBtn} onClick={() => printReturn(r)}><Printer className="size-4" /></button>
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
            <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
          </div>
        )}
      </section>

      {/* ---------------- New return ---------------- */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[980px]">
          <div className="border-b border-dash-border-soft px-6 py-4">
            <DialogTitle className="font-dash-display text-xl font-bold">New customer return</DialogTitle>
            <DialogDescription className="text-[13px]">{order ? `${order.invoiceNo} · ${order.customerName}` : "Find the order the items came from."}</DialogDescription>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
            <div className="flex min-w-0 flex-col gap-5">
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">1 · Find the order</legend>
                {order ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-dash-border bg-dash-bg px-3.5 py-3">
                    <div>
                      <div className="text-sm font-bold">{order.invoiceNo} · {order.customerName}</div>
                      <div className="text-xs text-dash-muted">
                        {fmt(order.date)} · {formatCurrency(order.amount)} ·{" "}
                        <span className={order.ageDays > POLICY_DAYS ? "font-semibold text-dash-warn-fg" : "font-semibold text-dash-success-fg"}>
                          {order.ageDays <= 0 ? "Today" : `${order.ageDays} days ago`}{order.ageDays > POLICY_DAYS ? ` — outside ${POLICY_DAYS}-day policy` : ""}
                        </span>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setOrder(null); setLines([]) }} className="text-[13px] font-semibold text-dash-accent hover:underline">Change</button>
                  </div>
                ) : (
                  <>
                    <label className="flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
                      <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search orders</span>
                      <input type="search" value={saleQ} onChange={(e) => { setSaleQ(e.target.value); setErr("") }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); findOrder() } }} placeholder="Invoice number or customer name"
                        className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
                      <button type="button" onClick={findOrder} className="rounded-md bg-dash-ink px-3 py-1 text-xs font-semibold text-dash-bg">Find</button>
                    </label>
                    {err && !order && <p role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
                    <div className="text-xs font-semibold text-dash-muted">Recent orders</div>
                    {recentLoading ? <Skeleton className="h-16 rounded-xl" /> : recent.length === 0 ? (
                      <span className="text-[13px] text-dash-muted">No matching sales with returnable items.</span>
                    ) : (
                      <div className="flex flex-col overflow-hidden rounded-xl border border-dash-border">
                        {recent.map((o) => (
                          <button key={o.id} type="button" onClick={() => pickOrder(o)} className="flex items-center justify-between gap-3 border-b border-dash-border-soft px-3 py-2.5 text-left last:border-0 hover:bg-dash-neutral-soft">
                            <span className="flex flex-col"><span className="text-sm font-bold">{o.invoiceNo}</span><span className="text-xs text-dash-muted">{o.customerName} · {fmt(o.date)}</span></span>
                            <span className="text-sm font-semibold tabular-nums">{formatCurrency(o.amount)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </fieldset>

              {order && (
                <>
                  <fieldset className="flex flex-col gap-3">
                    <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">2 · What is coming back?</legend>
                    <div className="flex flex-col rounded-xl border border-dash-border">
                      {lines.map((l, i) => (
                        <div key={l.sellItemId} className="flex flex-col gap-2 border-b border-dash-border-soft px-3 py-3 last:border-0">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={l.on} onChange={() => patch(i, { on: !l.on })} aria-label={`Return ${l.name}`} className="size-4" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">{l.name}</div>
                              <div className="text-xs text-dash-muted">Bought {l.bought} × {formatCurrency(l.price)} · {l.returnable} can still be returned</div>
                            </div>
                            <div className="flex items-center">
                              <button type="button" aria-label="Decrease return quantity" onClick={() => patch(i, { qty: Math.max(1, l.qty - 1), on: true })} className="h-9 w-8 rounded-l-lg border border-dash-border">−</button>
                              <span className="flex h-9 w-10 items-center justify-center border-y border-dash-border text-sm tabular-nums">{l.qty}</span>
                              <button type="button" aria-label="Increase return quantity" onClick={() => patch(i, { qty: Math.min(l.returnable, l.qty + 1), on: true })} className="h-9 w-8 rounded-r-lg border border-dash-border">+</button>
                            </div>
                            <span className="w-24 text-right text-sm font-bold tabular-nums">{formatCurrency(l.qty * l.price)}</span>
                          </div>
                          {l.on && (
                            <div className="flex flex-wrap gap-1.5 pl-7">
                              {REASONS.map((r) => (
                                <button key={r} type="button" aria-pressed={l.reason === r} onClick={() => patch(i, { reason: r })}
                                  className={cn("h-8 rounded-full border px-3 text-xs font-semibold", l.reason === r ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{r}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-dash-muted">Items go back into stock unless you turn off “Return items to stock”.</span>
                  </fieldset>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Note
                    <textarea rows={2} className={cn(input, "h-auto py-2.5")} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional — what the customer said" />
                  </label>
                </>
              )}
            </div>

            <aside className="flex flex-col gap-3 rounded-xl border border-dash-border-soft bg-dash-bg p-4 lg:self-start">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">3 · Refund</span>
              <div role="radiogroup" aria-label="Refund method" className="grid grid-cols-2 gap-1.5">
                {METHODS.map((m) => (
                  <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => { setMethod(m.id); setErr("") }}
                    className={cn("flex flex-col rounded-[10px] border-2 px-2.5 py-2 text-left text-[13px] font-semibold", method === m.id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>
                    {m.label}<span className="text-[11px] font-normal opacity-80">{m.sub}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5 text-[13px]">
                <div className="flex justify-between"><span className="text-dash-muted">Items · {units} units</span><span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-dash-muted">Restocking fee</span><span className="font-semibold tabular-nums">{formatCurrency(0)}</span></div>
                <div className="flex items-baseline justify-between border-t border-dashed border-dash-border pt-2">
                  <span className="font-bold">{method === "credit" ? "Store credit" : method === "none" ? "No refund" : "Refund"}</span>
                  <span className="font-dash-display text-2xl font-bold tabular-nums">{formatCurrency(refund)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-[10px] bg-dash-card px-3 py-2.5 text-xs text-dash-muted">
                <span className="font-semibold text-dash-ink">What happens</span>
                <span>{picked.length ? (restock ? `↩ Back to stock: ${picked.map((l) => `${l.name} ×${l.qty}`).join(", ")}` : "↩ Nothing goes back to stock") : "↩ Select items to see the effect"}</span>
                <span>{picked.length && !restock ? `✕ Written off: ${picked.map((l) => `${l.name} ×${l.qty}`).join(", ")}` : ""}</span>
                <span>{method === "cash" ? `${formatCurrency(refund)} paid back in cash` : method === "original" ? `${formatCurrency(refund)} returned to the original payment${order?.paidVia ? ` (${order.paidVia})` : ""}, reversing it on the invoice` : method === "credit" ? `${formatCurrency(refund)} added to the customer's balance` : `No money moves — the invoice total drops by ${formatCurrency(subtotal)}`}</span>
              </div>
              {restock && warehouses.length > 1 && (
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Return stock to
                  <select className={input} value={locId} onChange={(e) => setLocId(e.target.value)}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                </label>
              )}
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={restock} onChange={() => setRestock((v) => !v)} className="size-4" />Return items to stock</label>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={printReceipt} onChange={() => setPrintReceipt((v) => !v)} className="size-4" />Print return receipt</label>
              {err && <p role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
            </aside>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-dash-border-soft px-6 py-4">
            <span className="text-xs text-dash-muted">{order ? "" : "Pick an order to continue."}</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className={outlineBtn}>Cancel</button>
              <button type="button" disabled={saving || picked.length === 0} onClick={() => submit("request")} className={outlineBtn}>Submit for approval</button>
              <button type="button" disabled={saving || picked.length === 0} onClick={() => submit("complete")} className={primaryBtn}>
                {saving ? "Saving…" : method === "none" ? "Record return" : `Approve & refund ${formatCurrency(refund)}`}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------------- Detail ---------------- */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-xl">
          {detail && (
            <>
              <div className="border-b border-dash-border-soft px-6 py-4">
                <DialogTitle className="font-dash-display text-xl font-bold">{detail.returnNumber}</DialogTitle>
                <DialogDescription className="text-[13px]">{fmt(detail.createdAt)} · {detail.customerName || "Walk-in"} · {detail.invoiceNo || "No invoice"}</DialogDescription>
              </div>
              <div className="flex flex-col gap-3 p-6 text-sm">
                <div className="flex flex-col rounded-xl border border-dash-border">
                  {detail.lines.map((l, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 border-b border-dash-border-soft px-3 py-2.5 last:border-0">
                      <span className="flex flex-col"><span className="font-semibold">{l.name}</span><span className="text-xs text-dash-muted">{l.reason}</span></span>
                      <span className="text-dash-muted tabular-nums">{l.quantity} × {formatCurrency(l.price)}</span>
                      <span className="font-bold tabular-nums">{formatCurrency(l.total)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between rounded-[10px] bg-dash-neutral-soft px-3.5 py-2.5"><span>Refund ({METHOD_LABEL[detail.refundMethod ?? ""] ?? "—"}{detail.refundedVia ? ` · ${detail.refundedVia}` : ""})</span><strong className="tabular-nums">{formatCurrency(detail.amount)}</strong></div>
                <div className="text-[13px] text-dash-muted">
                  {detail.status === "pending" ? (detail.restocked ? "Will return to stock on approval" : "Will be written off on approval") : detail.restocked ? "Returned to stock" : "Written off (not restocked)"} · Location: {detail.locationName ?? "—"}
                </div>
                <div className="text-[13px] text-dash-muted">Status: <strong className="text-dash-ink">{statusOf(detail).label}</strong>{detail.processedAt ? ` · Processed ${fmt(detail.processedAt)}` : ""}</div>
                <div className="text-[13px] text-dash-muted">Reason: <span className="text-dash-ink">{detail.reason || "—"}</span></div>
                <div className="text-[13px] text-dash-muted">Note: <span className="text-dash-ink">{detail.note || "—"}</span></div>
                {detail.status === "rejected" && <div className="text-[13px] text-dash-danger-fg">Rejection reason: {detail.rejectionReason || "—"}</div>}
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-dash-border-soft px-6 py-4">
                {detail.status === "pending" && <button type="button" disabled={busyId === detail.id} onClick={() => reject(detail)} className={cn(outlineBtn, "text-dash-danger-fg")}>Reject</button>}
                {detail.status === "pending" && <button type="button" disabled={busyId === detail.id} onClick={() => approve(detail)} className={primaryBtn}>Approve &amp; refund</button>}
                <button type="button" onClick={() => printReturn(detail)} className={outlineBtn}><Printer className="size-4" aria-hidden /> Print</button>
                <button type="button" onClick={() => setDetail(null)} className={outlineBtn}>Close</button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
