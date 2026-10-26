"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Banknote, Download, Eye, Package, Printer, RotateCcw, Search, Trash2, Clock, Tag } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { Field, FieldLabel } from "@/components/ui/field"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionTitle } from "@/components/common/SectionTitle"
import { FormField } from "@/components/common/FormField"
import { EmptyState } from "@/components/common/EmptyState"
import { Toolbar } from "@/components/common/Toolbar"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { StatusBadge, type StatusVariant } from "@/components/common/StatusBadge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

function statusOf(r: CustomerReturnRow): { label: string; variant: StatusVariant } {
  if (r.status === "pending") return { label: "Pending approval", variant: "secondary" }
  if (r.status === "rejected") return { label: "Rejected", variant: "destructive" }
  if (r.refundMethod === "cash" || r.refundMethod === "original") return { label: "Refunded", variant: "default" }
  if (r.refundMethod === "credit") return { label: "Credited", variant: "default" }
  return { label: "Completed", variant: "outline" }
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
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title="Customer returns"
        description="Take items back, decide what returns to stock, and refund the right way."
        actions={<>
          <Button type="button" variant="outline" onClick={() => toast.message(`Returns accepted up to ${POLICY_DAYS} days after purchase; items return to stock unless damaged.`)}>Return policy</Button>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export</Button>
          <Button type="button" onClick={openForm}>New return</Button>
        </>}
      />

      {loading && !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[118px]" />)}</div>
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

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }}
            tabs={TABS.map(([v, label]) => ({ value: v, label, count: counts[v] }))} />
        </div>
        <Toolbar className="gap-2.5 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="cr-search" className="sr-only">Search returns</Label>
            <Input id="cr-search" type="search" placeholder="Search return #, invoice or customer…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9" />
          </div>
          <Button type="button" variant="outline" onClick={cycleReason}>{reasonF === "all" ? "Reason: All" : reasonF} ▾</Button>
          <Button type="button" variant="outline" onClick={cycleDate}>{DATE_OPTS.find((d) => d[0] === dateF)?.[1]} ▾</Button>
        </Toolbar>

        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Return</TableHead><TableHead>Customer / invoice</TableHead>
                <TableHead>Items &amp; reason</TableHead><TableHead>Condition</TableHead>
                <TableHead className="text-right">Refund</TableHead><TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Next step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={7} className="px-4"><Skeleton className="h-10" /></TableCell></TableRow>) :
                rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7}>
                    <EmptyState icon={RotateCcw} title="No returns found" description={hasFilter || tab !== "all" ? "Try clearing the filters." : "Record a return with New return."} className="p-4 md:p-6" />
                  </TableCell></TableRow>
                ) : rows.map((r) => {
                  const s = statusOf(r)
                  const pending = r.status === "pending"
                  const cond = pending ? (r.restocked ? "Restock on approval" : "Write off on approval") : r.restocked ? "Restocked" : "Written off"
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4">
                        <Button type="button" variant="link" className="h-auto p-0" onClick={() => setDetail(r)}>{r.returnNumber}</Button>
                        <div className="text-xs text-muted-foreground">{fmt(r.createdAt)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.customerName || "Walk-in"}</div>
                        {r.invoiceNo ? <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs"><Link href="/dashboard/orders">{r.invoiceNo}</Link></Button> : <span className="text-xs text-muted-foreground">No invoice</span>}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[220px] truncate">{r.itemsSummary}</div>
                        <div className="text-xs text-muted-foreground">{r.reason || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.restocked ? "secondary" : "destructive"}>{cond}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="font-semibold">{formatCurrency(r.amount)}</div>
                        <div className="text-xs text-muted-foreground">{METHOD_LABEL[r.refundMethod ?? ""] ?? "—"}{r.refundedVia ? ` · ${r.refundedVia}` : ""}</div>
                      </TableCell>
                      <TableCell><StatusBadge status={s.label} variant={s.variant} /></TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {pending && <Button type="button" size="sm" className="mr-1" disabled={busyId === r.id} onClick={() => approve(r)}>Approve</Button>}
                          {pending && <Button type="button" variant="ghost" size="sm" className="mr-1 text-destructive" disabled={busyId === r.id} onClick={() => reject(r)}>Reject</Button>}
                          <Button type="button" variant="outline" size="icon" aria-label="View return" onClick={() => setDetail(r)}><Eye className="size-4" /></Button>
                          <Button type="button" variant="outline" size="icon" aria-label="Print return" onClick={() => printReturn(r)}><Printer className="size-4" /></Button>
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
              <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            </div>
          </>
        )}
      </Card>

      {/* ---------------- New return ---------------- */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[980px]">
          <DialogHeader>
            <DialogTitle>New customer return</DialogTitle>
            <DialogDescription>{order ? `${order.invoiceNo} · ${order.customerName}` : "Find the order the items came from."}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="flex min-w-0 flex-col gap-5">
              <fieldset className="flex flex-col gap-3">
                <SectionTitle as="legend" className="mb-2">1 · Find the order</SectionTitle>
                {order ? (
                  <Item variant="outline" size="sm">
                    <ItemContent>
                      <ItemTitle>{order.invoiceNo} · {order.customerName}</ItemTitle>
                      <ItemDescription className="text-xs">
                        {fmt(order.date)} · {formatCurrency(order.amount)} ·{" "}
                        <span className={order.ageDays > POLICY_DAYS ? "font-medium text-amber-600" : "font-medium text-emerald-600"}>
                          {order.ageDays <= 0 ? "Today" : `${order.ageDays} days ago`}{order.ageDays > POLICY_DAYS ? ` — outside ${POLICY_DAYS}-day policy` : ""}
                        </span>
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button type="button" variant="link" className="h-auto p-0" onClick={() => { setOrder(null); setLines([]) }}>Change</Button>
                    </ItemActions>
                  </Item>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Label htmlFor="cr-order-search" className="sr-only">Search orders</Label>
                        <Input id="cr-order-search" type="search" value={saleQ} onChange={(e) => { setSaleQ(e.target.value); setErr("") }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); findOrder() } }} placeholder="Invoice number or customer name"
                          className="pl-9" />
                      </div>
                      <Button type="button" onClick={findOrder}>Find</Button>
                    </div>
                    {err && !order && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
                    <SectionTitle as="p">Recent orders</SectionTitle>
                    {recentLoading ? <Skeleton className="h-16" /> : recent.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No matching sales with returnable items.</span>
                    ) : (
                      <Card className="gap-0 overflow-hidden py-0">
                        {recent.map((o, i) => (
                          <Fragment key={o.id}>
                            {i > 0 && <Separator />}
                            <Button type="button" variant="ghost" onClick={() => pickOrder(o)} className="h-auto w-full justify-between gap-3 rounded-none text-left">
                              <span className="flex flex-col"><span className="text-sm font-semibold">{o.invoiceNo}</span><span className="text-xs font-normal text-muted-foreground">{o.customerName} · {fmt(o.date)}</span></span>
                              <span className="text-sm tabular-nums">{formatCurrency(o.amount)}</span>
                            </Button>
                          </Fragment>
                        ))}
                      </Card>
                    )}
                  </>
                )}
              </fieldset>

              {order && (
                <>
                  <fieldset className="flex flex-col gap-3">
                    <SectionTitle as="legend" className="mb-2">2 · What is coming back?</SectionTitle>
                    <Card className="gap-0 py-0">
                      {lines.map((l, i) => (
                        <Fragment key={l.sellItemId}>
                          {i > 0 && <Separator />}
                          <div className="flex flex-col gap-2 px-3 py-3">
                            <div className="flex items-center gap-3">
                              <Checkbox checked={l.on} onCheckedChange={(v) => patch(i, { on: v === true })} aria-label={`Return ${l.name}`} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{l.name}</div>
                                <div className="text-xs text-muted-foreground">Bought {l.bought} × {formatCurrency(l.price)} · {l.returnable} can still be returned</div>
                              </div>
                              <ButtonGroup>
                                <Button type="button" variant="outline" size="icon" aria-label="Decrease return quantity" onClick={() => patch(i, { qty: Math.max(1, l.qty - 1), on: true })}>−</Button>
                                <ButtonGroupText className="w-10 justify-center tabular-nums">{l.qty}</ButtonGroupText>
                                <Button type="button" variant="outline" size="icon" aria-label="Increase return quantity" onClick={() => patch(i, { qty: Math.min(l.returnable, l.qty + 1), on: true })}>+</Button>
                              </ButtonGroup>
                              <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatCurrency(l.qty * l.price)}</span>
                            </div>
                            {l.on && (
                              <div className="flex flex-wrap gap-1.5 pl-7">
                                {REASONS.map((r) => (
                                  <Button key={r} type="button" size="sm" variant={l.reason === r ? "default" : "outline"} aria-pressed={l.reason === r} onClick={() => patch(i, { reason: r })}>{r}</Button>
                                ))}
                              </div>
                            )}
                          </div>
                        </Fragment>
                      ))}
                    </Card>
                    <span className="text-xs text-muted-foreground">Items go back into stock unless you turn off “Return items to stock”.</span>
                  </fieldset>
                  <FormField label="Note" htmlFor="cr-note">
                    <Textarea id="cr-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional — what the customer said" />
                  </FormField>
                </>
              )}
            </div>

            <aside className="lg:self-start">
              <Card className="gap-3 p-4">
                <SectionTitle>3 · Refund</SectionTitle>
                <ChoiceCardGroup value={method} onValueChange={(v) => { setMethod(v as typeof method); setErr("") }} aria-label="Refund method" className="grid-cols-2 gap-1.5">
                  {METHODS.map((m) => (
                    <ChoiceCard key={m.id} value={m.id} title={m.label} description={m.sub} className="p-3" />
                  ))}
                </ChoiceCardGroup>
                <InfoList>
                  <InfoRow label={`Items · ${units} units`} value={<span className="tabular-nums">{formatCurrency(subtotal)}</span>} />
                  <InfoRow label="Restocking fee" value={<span className="tabular-nums">{formatCurrency(0)}</span>} />
                  <Separator />
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{method === "credit" ? "Store credit" : method === "none" ? "No refund" : "Refund"}</span>
                    <span className="text-2xl font-semibold tabular-nums">{formatCurrency(refund)}</span>
                  </div>
                </InfoList>
                <Alert>
                  <AlertTitle>What happens</AlertTitle>
                  <AlertDescription className="text-xs">
                    <span>{picked.length ? (restock ? `↩ Back to stock: ${picked.map((l) => `${l.name} ×${l.qty}`).join(", ")}` : "↩ Nothing goes back to stock") : "↩ Select items to see the effect"}</span>
                    <span>{picked.length && !restock ? `✕ Written off: ${picked.map((l) => `${l.name} ×${l.qty}`).join(", ")}` : ""}</span>
                    <span>{method === "cash" ? `${formatCurrency(refund)} paid back in cash` : method === "original" ? `${formatCurrency(refund)} returned to the original payment${order?.paidVia ? ` (${order.paidVia})` : ""}, reversing it on the invoice` : method === "credit" ? `${formatCurrency(refund)} added to the customer's balance` : `No money moves — the invoice total drops by ${formatCurrency(subtotal)}`}</span>
                  </AlertDescription>
                </Alert>
                {restock && warehouses.length > 1 && (
                  <FormField label="Return stock to" htmlFor="cr-loc">
                    <Select value={locId || undefined} onValueChange={(v) => setLocId(v)}>
                      <SelectTrigger id="cr-loc" className="w-full"><SelectValue placeholder="Select location" /></SelectTrigger>
                      <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                )}
                <Field orientation="horizontal">
                  <Checkbox id="cr-restock" checked={restock} onCheckedChange={(v) => setRestock(v === true)} />
                  <FieldLabel htmlFor="cr-restock" className="font-normal">Return items to stock</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox id="cr-print" checked={printReceipt} onCheckedChange={(v) => setPrintReceipt(v === true)} />
                  <FieldLabel htmlFor="cr-print" className="font-normal">Print return receipt</FieldLabel>
                </Field>
                {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
              </Card>
            </aside>
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">{order ? "" : "Pick an order to continue."}</span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="button" variant="outline" disabled={saving || picked.length === 0} onClick={() => submit("request")}>Submit for approval</Button>
              <Button type="button" disabled={saving || picked.length === 0} onClick={() => submit("complete")}>
                {saving ? "Saving…" : method === "none" ? "Record return" : `Approve & refund ${formatCurrency(refund)}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Detail ---------------- */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.returnNumber}</DialogTitle>
                <DialogDescription>{fmt(detail.createdAt)} · {detail.customerName || "Walk-in"} · {detail.invoiceNo || "No invoice"}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 text-sm">
                <Card className="gap-0 py-0">
                  {detail.lines.map((l, i) => (
                    <Fragment key={i}>
                      {i > 0 && <Separator />}
                      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                        <span className="flex flex-col"><span className="font-medium">{l.name}</span><span className="text-xs text-muted-foreground">{l.reason}</span></span>
                        <span className="text-muted-foreground tabular-nums">{l.quantity} × {formatCurrency(l.price)}</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(l.total)}</span>
                      </div>
                    </Fragment>
                  ))}
                </Card>
                <Item variant="muted" size="sm">
                  <ItemContent><ItemTitle>Refund ({METHOD_LABEL[detail.refundMethod ?? ""] ?? "—"}{detail.refundedVia ? ` · ${detail.refundedVia}` : ""})</ItemTitle></ItemContent>
                  <ItemActions><strong className="tabular-nums">{formatCurrency(detail.amount)}</strong></ItemActions>
                </Item>
                <InfoList>
                  <InfoRow label="Condition" value={detail.status === "pending" ? (detail.restocked ? "Will return to stock on approval" : "Will be written off on approval") : detail.restocked ? "Returned to stock" : "Written off (not restocked)"} />
                  <InfoRow label="Location" value={detail.locationName ?? "—"} />
                  <InfoRow label="Status" value={<StatusBadge status={statusOf(detail).label} variant={statusOf(detail).variant} />} />
                  {detail.processedAt && <InfoRow label="Processed" value={fmt(detail.processedAt)} />}
                  <InfoRow label="Reason" value={detail.reason || "—"} />
                  <InfoRow label="Note" value={detail.note || "—"} />
                  {detail.status === "rejected" && <InfoRow label="Rejection reason" value={detail.rejectionReason || "—"} className="text-destructive" />}
                </InfoList>
              </div>
              <DialogFooter className="flex-wrap">
                {detail.status === "pending" && <Button type="button" variant="destructive" disabled={busyId === detail.id} onClick={() => reject(detail)}>Reject</Button>}
                {detail.status === "pending" && <Button type="button" disabled={busyId === detail.id} onClick={() => approve(detail)}>Approve &amp; refund</Button>}
                <Button type="button" variant="outline" onClick={() => printReturn(detail)}><Printer className="size-4" aria-hidden /> Print</Button>
                <Button type="button" variant="outline" onClick={() => setDetail(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
