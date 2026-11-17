"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
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
import { WithTooltip } from "@/components/common/WithTooltip"
import { localeTag } from "@/lib/i18n"

type Tab = "all" | "pending" | "completed" | "rejected" | "restocked" | "written_off"

const NS = ["inventory", "common"] as const
type K = ParseKeys<typeof NS>

const TABS: [Tab, K][] = [
  ["all", "common:status.all"], ["pending", "common:orderStatus.pending"], ["completed", "common:orderStatus.completed"],
  ["rejected", "inventory:returns.customer.status.rejected"], ["restocked", "inventory:returns.customer.cond.restocked"], ["written_off", "inventory:returns.customer.cond.writtenOff"],
]
// Reason values are saved on the return as-is; only the shown label is translated
const REASONS = ["Size mismatch", "Defective product", "Not as described", "Changed my mind", "Package damaged", "Wrong item received", "Late delivery", "Other"]
const REASON_KEY: Record<string, K> = {
  "Size mismatch": "inventory:returns.customer.reason.sizeMismatch",
  "Defective product": "inventory:returns.customer.reason.defective",
  "Not as described": "inventory:returns.customer.reason.notAsDescribed",
  "Changed my mind": "inventory:returns.customer.reason.changedMind",
  "Package damaged": "inventory:returns.customer.reason.packageDamaged",
  "Wrong item received": "inventory:returns.customer.reason.wrongItem",
  "Late delivery": "inventory:returns.customer.reason.lateDelivery",
  Other: "common:extra.other",
}
const METHODS: { id: "cash" | "original" | "credit" | "none"; label: K; sub: K }[] = [
  { id: "cash", label: "inventory:returns.customer.method.cashRefund", sub: "inventory:returns.customer.method.cashSub" },
  { id: "original", label: "inventory:returns.customer.method.original", sub: "inventory:returns.customer.method.originalSub" },
  { id: "credit", label: "inventory:returns.customer.method.credit", sub: "inventory:returns.customer.method.creditSub" },
  { id: "none", label: "inventory:returns.customer.method.none", sub: "inventory:returns.customer.method.noneSub" },
]
const METHOD_LABEL: Record<string, K> = {
  cash: "common:payment.cash",
  original: "inventory:returns.customer.method.original",
  credit: "inventory:returns.customer.method.credit",
  none: "inventory:returns.customer.method.none",
}
const DATE_OPTS = [["all", "common:time.allTime"], ["7", "common:time.last7Days"], ["30", "common:time.last30Days"]] as const
const POLICY_DAYS = 30
const DEFAULT_REASON = "Changed my mind"

/** Display status (label key + badge variant) of a return row. */
function statusOf(r: CustomerReturnRow): { code: string; label: K; variant: StatusVariant } {
  if (r.status === "pending") return { code: "pending", label: "inventory:returns.customer.status.pendingApproval", variant: "secondary" }
  if (r.status === "rejected") return { code: "rejected", label: "inventory:returns.customer.status.rejected", variant: "destructive" }
  if (r.refundMethod === "cash" || r.refundMethod === "original") return { code: "refunded", label: "common:orderStatus.refunded", variant: "default" }
  if (r.refundMethod === "credit") return { code: "credited", label: "inventory:returns.customer.status.credited", variant: "default" }
  return { code: "completed", label: "common:orderStatus.completed", variant: "outline" }
}

interface PickLine { sellItemId: number; productId: number; variantId: number | null; name: string; bought: number; returnable: number; price: number; on: boolean; qty: number; reason: string }

export default function CustomerReturnsPage() {
  const { t, i18n } = useTranslation(NS)
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString(localeTag(i18n.language), { month: "short", day: "numeric", year: "numeric" }) : "—")
  const reasonLabel = (r?: string | null) => (r && REASON_KEY[r] ? t(REASON_KEY[r]) : r ?? "")
  const methodLabel = (m?: string | null) => (m && METHOD_LABEL[m] ? t(METHOD_LABEL[m]) : "—")
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

  useEffect(() => { const id = setTimeout(() => setSearchD(search.trim()), 250); return () => clearTimeout(id) }, [search])

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
      toast.error(t("inventory:returns.customer.toast.loadFailed"))
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
    const id = setTimeout(() => loadRecent(saleQ.trim()), 250)
    return () => clearTimeout(id)
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
    else setErr(recent.length === 0 ? t("inventory:returns.customer.validation.noMatch") : t("inventory:returns.customer.validation.manyMatch"))
  }
  const patch = (idx: number, p: Partial<PickLine>) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...p } : l)))

  const picked = lines.filter((l) => l.on)
  const units = picked.reduce((a, l) => a + l.qty, 0)
  const subtotal = Math.round(picked.reduce((a, l) => a + l.qty * l.price, 0) * 100) / 100
  const refund = method === "none" ? 0 : subtotal

  const validate = (): string => {
    if (!order) return t("inventory:returns.customer.validation.findOrder")
    if (picked.length === 0) return t("inventory:returns.customer.validation.pickItem")
    if (picked.some((l) => !l.reason)) return t("inventory:returns.customer.validation.reason")
    if (method === "credit" && !order.customerId) return t("inventory:returns.customer.validation.creditNeedsCustomer")
    if (!locId && restock) return t("inventory:returns.customer.validation.location")
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
      toast.success(mode === "request" ? t("inventory:returns.customer.toast.submitted", { number: res.returnNumber }) : t("inventory:returns.customer.toast.recorded", { number: res.returnNumber }))
      setFormOpen(false)
      if (printReceipt && mode === "complete") printReturn(res)
      setPage(1)
      load()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? t("inventory:returns.customer.toast.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const approve = async (r: CustomerReturnRow) => {
    const how = r.refundMethod === "cash" || r.refundMethod === "original" || r.refundMethod === "credit" ? r.refundMethod : "none"
    const opts = { number: r.returnNumber, amount: formatCurrency(r.amount) }
    const msg = r.restocked ? t(`inventory:returns.customer.approveRestock.${how}`, opts) : t(`inventory:returns.customer.approveWriteOff.${how}`, opts)
    if (!window.confirm(msg)) return
    setBusyId(r.id)
    try {
      await customerReturnsApi.approveReturn(r.id)
      toast.success(t("inventory:returns.customer.toast.approved", { number: r.returnNumber }))
      setDetail(null); load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t("inventory:returns.customer.toast.approveFailed"))
    } finally { setBusyId(null) }
  }
  const reject = async (r: CustomerReturnRow) => {
    const reason = window.prompt(t("inventory:returns.customer.rejectPrompt", { number: r.returnNumber }))
    if (reason === null) return
    if (!reason.trim()) { toast.error(t("inventory:returns.customer.toast.rejectReason")); return }
    setBusyId(r.id)
    try {
      await customerReturnsApi.rejectReturn(r.id, reason.trim())
      toast.success(t("inventory:returns.customer.toast.rejected", { number: r.returnNumber }))
      setDetail(null); load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t("inventory:returns.customer.toast.rejectFailed"))
    } finally { setBusyId(null) }
  }

  const printReturn = (r: CustomerReturnRow) => {
    const w = window.open("", "_blank", "width=720,height=800")
    if (!w) { toast.error(t("inventory:returns.allowPopups")); return }
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))
    w.document.write(`<!doctype html><html lang="${i18n.language === "bn" ? "bn" : "en"}"><title>${esc(r.returnNumber)}</title><body style="font-family:sans-serif;padding:24px">
      <h2 style="margin:0">${esc(t("inventory:returns.customer.print.title", { number: r.returnNumber }))}</h2>
      <p style="color:#5B6478">${fmt(r.createdAt)} · ${esc(r.customerName ?? t("common:extra.walkIn"))} · ${esc(r.invoiceNo ?? t("inventory:returns.customer.noInvoice"))}</p>
      <table style="width:100%;border-collapse:collapse">${r.lines.map((l) => `<tr><td style="padding:6px 0">${esc(l.name)}<br><small>${esc(reasonLabel(l.reason))}</small></td><td>${l.quantity} × ${formatCurrency(l.price)}</td><td style="text-align:right">${formatCurrency(l.total)}</td></tr>`).join("")}</table>
      <h3 style="text-align:right">${esc(t("inventory:returns.customer.print.refund", { method: methodLabel(r.refundMethod), amount: formatCurrency(r.amount) }))}</h3>
      <p>${esc(r.restocked ? t("inventory:returns.customer.cond.returnedToStock") : t("inventory:returns.customer.cond.writtenOffLong"))}</p>${r.note ? `<p>${esc(t("inventory:purchases.print.note", { note: r.note }))}</p>` : ""}</body>`)
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
      if (all.length === 0) { toast.error(t("common:extra.nothingToExport")); return }
      exportToCSV(all.map((r) => ({
        return: r.returnNumber, date: r.createdAt, customer: r.customerName ?? "", invoice: r.invoiceNo ?? "", items: r.itemsSummary, reason: reasonLabel(r.reason),
        status: t(statusOf(r).label), rejection_reason: r.rejectionReason ?? "", restocked: r.restocked ? t("common:actions.yes") : t("common:actions.no"),
        method: r.refundMethod && METHOD_LABEL[r.refundMethod] ? t(METHOD_LABEL[r.refundMethod]) : "", refunded_via: r.refundedVia ?? "", amount: r.amount, note: r.note ?? "",
      })), "customer-returns", ["return", "date", "customer", "invoice", "items", "reason", "status", "rejection_reason", "restocked", "method", "refunded_via", "amount", "note"])
    } catch {
      toast.error(t("inventory:returns.customer.toast.exportFailed"))
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
        title={t("inventory:returns.customer.title")}
        description={t("inventory:returns.customer.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={() => toast.message(t("inventory:returns.customer.policyText", { count: POLICY_DAYS }))}>{t("inventory:returns.customer.policy")}</Button>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> {t("common:actions.export")}</Button>
          <Button type="button" onClick={openForm}>{t("inventory:returns.customer.newReturn")}</Button>
        </>}
      />

      {loading && !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[118px]" />)}</div>
      ) : stats ? (
        <StatsCards stats={[
          { label: t("inventory:returns.customer.kpi.returns30"), value: stats.returns30d, icon: <RotateCcw className="size-4" />, color: "blue", hint: stats.ordersPct30d ?? undefined },
          { label: t("inventory:returns.customer.status.pendingApproval"), value: stats.pendingCount, icon: <Clock className="size-4" />, color: "yellow",
            hint: stats.pendingCount ? t("inventory:returns.customer.kpi.awaiting", { amount: formatCurrency(stats.pendingAmount) }) : t("inventory:returns.customer.kpi.nothingWaiting"),
            onClick: () => { setTab("pending"); setPage(1) }, active: tab === "pending" },
          { label: t("inventory:returns.customer.kpi.restockedUnits"), value: stats.restockedUnits, icon: <Package className="size-4" />, color: "purple", hint: t("inventory:returns.customer.kpi.backOnShelf") },
          { label: t("inventory:returns.customer.kpi.refunded"), value: formatCurrency(stats.refundedAmount), icon: <Banknote className="size-4" />, color: "green", hint: t("inventory:returns.customer.kpi.returnsCount", { count: stats.refundedCount }) },
          { label: t("inventory:returns.customer.kpi.topReason"), value: stats.topReason ? reasonLabel(stats.topReason) : "—", icon: <Tag className="size-4" />, color: "blue", hint: stats.topReason ? t("inventory:returns.customer.kpi.returnsCount", { count: stats.topReasonCount }) : t("inventory:returns.customer.kpi.noReturns") },
          { label: t("inventory:returns.customer.cond.writtenOff"), value: formatCurrency(stats.writtenOffValue), icon: <Trash2 className="size-4" />, color: "red", hint: t("inventory:returns.customer.kpi.atCost") },
        ]} />
      ) : null}

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(v) => { setTab(v as Tab); setPage(1) }}
            tabs={TABS.map(([v, label]) => ({ value: v, label: t(label), count: counts[v] }))} />
        </div>
        <Toolbar className="gap-2.5 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="cr-search" className="sr-only">{t("inventory:returns.customer.searchLabel")}</Label>
            <Input id="cr-search" type="search" placeholder={t("inventory:returns.customer.searchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9" />
          </div>
          <Button type="button" variant="outline" onClick={cycleReason}>{reasonF === "all" ? t("inventory:returns.reasonAll") : reasonLabel(reasonF)} ▾</Button>
          <Button type="button" variant="outline" onClick={cycleDate}>{t(DATE_OPTS.find((d) => d[0] === dateF)?.[1] ?? "common:time.allTime")} ▾</Button>
        </Toolbar>

        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t("inventory:returns.customer.col.return")}</TableHead><TableHead>{t("inventory:returns.customer.col.customerInvoice")}</TableHead>
                <TableHead>{t("inventory:returns.customer.col.itemsReason")}</TableHead><TableHead>{t("inventory:returns.customer.col.condition")}</TableHead>
                <TableHead className="text-right">{t("inventory:returns.customer.col.refund")}</TableHead><TableHead>{t("common:fields.status")}</TableHead>
                <TableHead className="pr-4 text-right">{t("inventory:purchases.col.nextStep")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={7} className="px-4"><Skeleton className="h-10" /></TableCell></TableRow>) :
                rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7}>
                    <EmptyState icon={RotateCcw} title={t("inventory:returns.customer.empty.title")} description={hasFilter || tab !== "all" ? t("inventory:purchases.empty.filtered") : t("inventory:returns.customer.empty.first")} className="p-4 md:p-6" />
                  </TableCell></TableRow>
                ) : rows.map((r) => {
                  const s = statusOf(r)
                  const pending = r.status === "pending"
                  const cond = pending ? (r.restocked ? t("inventory:returns.customer.cond.restockOnApproval") : t("inventory:returns.customer.cond.writeOffOnApproval")) : r.restocked ? t("inventory:returns.customer.cond.restocked") : t("inventory:returns.customer.cond.writtenOff")
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4">
                        <Button type="button" variant="link" className="h-auto p-0" onClick={() => setDetail(r)}>{r.returnNumber}</Button>
                        <div className="text-xs text-muted-foreground">{fmt(r.createdAt)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.customerName || t("common:extra.walkIn")}</div>
                        {r.invoiceNo ? <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs"><Link href="/dashboard/orders">{r.invoiceNo}</Link></Button> : <span className="text-xs text-muted-foreground">{t("inventory:returns.customer.noInvoice")}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[220px] truncate">{r.itemsSummary}</div>
                        <div className="text-xs text-muted-foreground">{reasonLabel(r.reason) || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.restocked ? "secondary" : "destructive"}>{cond}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="font-semibold">{formatCurrency(r.amount)}</div>
                        <div className="text-xs text-muted-foreground">{methodLabel(r.refundMethod)}{r.refundedVia ? ` · ${r.refundedVia}` : ""}</div>
                      </TableCell>
                      <TableCell><StatusBadge status={s.code} variant={s.variant} label={t(s.label)} /></TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {pending && <Button type="button" size="sm" className="mr-1" disabled={busyId === r.id} onClick={() => approve(r)}>{t("inventory:returns.approve")}</Button>}
                          {pending && <Button type="button" variant="ghost" size="sm" className="mr-1 text-destructive" disabled={busyId === r.id} onClick={() => reject(r)}>{t("inventory:returns.reject")}</Button>}
                          <WithTooltip content={t("inventory:returns.viewReturn")}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:returns.viewReturn")} onClick={() => setDetail(r)}><Eye className="size-4" /></Button></WithTooltip>
                          <WithTooltip content={t("inventory:returns.printReturn")}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:returns.printReturn")} onClick={() => printReturn(r)}><Printer className="size-4" /></Button></WithTooltip>
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
            <DialogTitle>{t("inventory:returns.customer.form.title")}</DialogTitle>
            <DialogDescription>{order ? `${order.invoiceNo} · ${order.customerName}` : t("inventory:returns.customer.form.findHint")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="flex min-w-0 flex-col gap-5">
              <fieldset className="flex flex-col gap-3">
                <SectionTitle as="legend" className="mb-2">{t("inventory:returns.customer.form.step1")}</SectionTitle>
                {order ? (
                  <Item variant="outline" size="sm">
                    <ItemContent>
                      <ItemTitle>{order.invoiceNo} · {order.customerName}</ItemTitle>
                      <ItemDescription className="text-xs">
                        {fmt(order.date)} · {formatCurrency(order.amount)} ·{" "}
                        <span className={order.ageDays > POLICY_DAYS ? "font-medium text-amber-600" : "font-medium text-emerald-600"}>
                          {order.ageDays <= 0 ? t("common:time.today") : t("common:ago.days", { count: order.ageDays })}{order.ageDays > POLICY_DAYS ? ` — ${t("inventory:returns.customer.form.outsidePolicy", { count: POLICY_DAYS })}` : ""}
                        </span>
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <Button type="button" variant="link" className="h-auto p-0" onClick={() => { setOrder(null); setLines([]) }}>{t("inventory:returns.change")}</Button>
                    </ItemActions>
                  </Item>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Label htmlFor="cr-order-search" className="sr-only">{t("inventory:returns.customer.form.searchOrders")}</Label>
                        <Input id="cr-order-search" type="search" value={saleQ} onChange={(e) => { setSaleQ(e.target.value); setErr("") }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); findOrder() } }} placeholder={t("inventory:returns.customer.form.searchPh")}
                          className="pl-9" />
                      </div>
                      <Button type="button" onClick={findOrder}>{t("inventory:returns.customer.form.find")}</Button>
                    </div>
                    {err && !order && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
                    <SectionTitle as="p">{t("inventory:returns.customer.form.recentOrders")}</SectionTitle>
                    {recentLoading ? <Skeleton className="h-16" /> : recent.length === 0 ? (
                      <span className="text-sm text-muted-foreground">{t("inventory:returns.customer.form.noRecent")}</span>
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
                    <SectionTitle as="legend" className="mb-2">{t("inventory:returns.customer.form.step2")}</SectionTitle>
                    <Card className="gap-0 py-0">
                      {lines.map((l, i) => (
                        <Fragment key={l.sellItemId}>
                          {i > 0 && <Separator />}
                          <div className="flex flex-col gap-2 px-3 py-3">
                            <div className="flex items-center gap-3">
                              <Checkbox checked={l.on} onCheckedChange={(v) => patch(i, { on: v === true })} aria-label={t("inventory:returns.customer.form.returnItem", { name: l.name })} />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{l.name}</div>
                                <div className="text-xs text-muted-foreground">{t("inventory:returns.customer.form.bought", { bought: l.bought, price: formatCurrency(l.price), returnable: l.returnable })}</div>
                              </div>
                              <ButtonGroup>
                                <WithTooltip content={t("inventory:returns.decreaseQty")}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:returns.decreaseQty")} onClick={() => patch(i, { qty: Math.max(1, l.qty - 1), on: true })}>−</Button></WithTooltip>
                                <ButtonGroupText className="w-10 justify-center tabular-nums">{l.qty}</ButtonGroupText>
                                <WithTooltip content={t("inventory:returns.increaseQty")}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:returns.increaseQty")} onClick={() => patch(i, { qty: Math.min(l.returnable, l.qty + 1), on: true })}>+</Button></WithTooltip>
                              </ButtonGroup>
                              <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatCurrency(l.qty * l.price)}</span>
                            </div>
                            {l.on && (
                              <div className="flex flex-wrap gap-1.5 pl-7">
                                {REASONS.map((r) => (
                                  <Button key={r} type="button" size="sm" variant={l.reason === r ? "default" : "outline"} aria-pressed={l.reason === r} onClick={() => patch(i, { reason: r })}>{reasonLabel(r)}</Button>
                                ))}
                              </div>
                            )}
                          </div>
                        </Fragment>
                      ))}
                    </Card>
                    <span className="text-xs text-muted-foreground">{t("inventory:returns.customer.form.restockHint")}</span>
                  </fieldset>
                  <FormField label={t("common:fields.note")} htmlFor="cr-note">
                    <Textarea id="cr-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("inventory:returns.customer.form.notePh")} />
                  </FormField>
                </>
              )}
            </div>

            <aside className="lg:self-start">
              <Card className="gap-3 p-4">
                <SectionTitle>{t("inventory:returns.customer.form.step3")}</SectionTitle>
                <ChoiceCardGroup value={method} onValueChange={(v) => { setMethod(v as typeof method); setErr("") }} aria-label={t("inventory:returns.customer.form.refundMethod")} className="grid-cols-2 gap-1.5">
                  {METHODS.map((m) => (
                    <ChoiceCard key={m.id} value={m.id} title={t(m.label)} description={t(m.sub)} className="p-3" />
                  ))}
                </ChoiceCardGroup>
                <InfoList>
                  <InfoRow label={t("inventory:returns.customer.form.itemsUnits", { count: units })} value={<span className="tabular-nums">{formatCurrency(subtotal)}</span>} />
                  <InfoRow label={t("inventory:returns.customer.form.restockingFee")} value={<span className="tabular-nums">{formatCurrency(0)}</span>} />
                  <Separator />
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{method === "credit" ? t("inventory:returns.customer.method.credit") : method === "none" ? t("inventory:returns.customer.method.none") : t("inventory:returns.customer.col.refund")}</span>
                    <span className="text-2xl font-semibold tabular-nums">{formatCurrency(refund)}</span>
                  </div>
                </InfoList>
                <Alert>
                  <AlertTitle>{t("inventory:returns.customer.form.whatHappens")}</AlertTitle>
                  <AlertDescription className="text-xs">
                    <span>{picked.length ? (restock ? t("inventory:returns.customer.effect.backToStock", { items: picked.map((l) => `${l.name} ×${l.qty}`).join(", ") }) : t("inventory:returns.customer.effect.nothingBack")) : t("inventory:returns.customer.effect.selectItems")}</span>
                    <span>{picked.length && !restock ? t("inventory:returns.customer.effect.writtenOff", { items: picked.map((l) => `${l.name} ×${l.qty}`).join(", ") }) : ""}</span>
                    <span>{method === "cash" ? t("inventory:returns.customer.effect.cash", { amount: formatCurrency(refund) }) : method === "original" ? (order?.paidVia ? t("inventory:returns.customer.effect.originalVia", { amount: formatCurrency(refund), via: order.paidVia }) : t("inventory:returns.customer.effect.original", { amount: formatCurrency(refund) })) : method === "credit" ? t("inventory:returns.customer.effect.credit", { amount: formatCurrency(refund) }) : t("inventory:returns.customer.effect.none", { amount: formatCurrency(subtotal) })}</span>
                  </AlertDescription>
                </Alert>
                {restock && warehouses.length > 1 && (
                  <FormField label={t("inventory:returns.customer.form.returnStockTo")} htmlFor="cr-loc">
                    <Select value={locId || undefined} onValueChange={(v) => setLocId(v)}>
                      <SelectTrigger id="cr-loc" className="w-full"><SelectValue placeholder={t("inventory:purchases.form.selectLocation")} /></SelectTrigger>
                      <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                )}
                <Field orientation="horizontal">
                  <Checkbox id="cr-restock" checked={restock} onCheckedChange={(v) => setRestock(v === true)} />
                  <FieldLabel htmlFor="cr-restock" className="font-normal">{t("inventory:returns.customer.form.restock")}</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <Checkbox id="cr-print" checked={printReceipt} onCheckedChange={(v) => setPrintReceipt(v === true)} />
                  <FieldLabel htmlFor="cr-print" className="font-normal">{t("inventory:returns.customer.form.printReceipt")}</FieldLabel>
                </Field>
                {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
              </Card>
            </aside>
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">{order ? "" : t("inventory:returns.customer.form.pickToContinue")}</span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t("common:actions.cancel")}</Button>
              <Button type="button" variant="outline" disabled={saving || picked.length === 0} onClick={() => submit("request")}>{t("inventory:returns.customer.form.submitApproval")}</Button>
              <Button type="button" disabled={saving || picked.length === 0} onClick={() => submit("complete")}>
                {saving ? t("common:actions.saving") : method === "none" ? t("inventory:returns.customer.form.recordReturn") : t("inventory:returns.customer.form.approveRefundAmount", { amount: formatCurrency(refund) })}
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
                <DialogDescription>{fmt(detail.createdAt)} · {detail.customerName || t("common:extra.walkIn")} · {detail.invoiceNo || t("inventory:returns.customer.noInvoice")}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 text-sm">
                <Card className="gap-0 py-0">
                  {detail.lines.map((l, i) => (
                    <Fragment key={i}>
                      {i > 0 && <Separator />}
                      <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                        <span className="flex flex-col"><span className="font-medium">{l.name}</span><span className="text-xs text-muted-foreground">{reasonLabel(l.reason)}</span></span>
                        <span className="text-muted-foreground tabular-nums">{l.quantity} × {formatCurrency(l.price)}</span>
                        <span className="font-semibold tabular-nums">{formatCurrency(l.total)}</span>
                      </div>
                    </Fragment>
                  ))}
                </Card>
                <Item variant="muted" size="sm">
                  <ItemContent><ItemTitle>{t("inventory:returns.customer.detail.refund", { method: `${methodLabel(detail.refundMethod)}${detail.refundedVia ? ` · ${detail.refundedVia}` : ""}` })}</ItemTitle></ItemContent>
                  <ItemActions><strong className="tabular-nums">{formatCurrency(detail.amount)}</strong></ItemActions>
                </Item>
                <InfoList>
                  <InfoRow label={t("inventory:returns.customer.col.condition")} value={detail.status === "pending" ? (detail.restocked ? t("inventory:returns.customer.cond.willRestock") : t("inventory:returns.customer.cond.willWriteOff")) : detail.restocked ? t("inventory:returns.customer.cond.returnedToStock") : t("inventory:returns.customer.cond.writtenOffLong")} />
                  <InfoRow label={t("common:fields.location")} value={detail.locationName ?? "—"} />
                  <InfoRow label={t("common:fields.status")} value={<StatusBadge status={statusOf(detail).code} variant={statusOf(detail).variant} label={t(statusOf(detail).label)} />} />
                  {detail.processedAt && <InfoRow label={t("inventory:returns.customer.detail.processed")} value={fmt(detail.processedAt)} />}
                  <InfoRow label={t("common:extra.reason")} value={reasonLabel(detail.reason) || "—"} />
                  <InfoRow label={t("common:fields.note")} value={detail.note || "—"} />
                  {detail.status === "rejected" && <InfoRow label={t("inventory:returns.customer.detail.rejectionReason")} value={detail.rejectionReason || "—"} className="text-destructive" />}
                </InfoList>
              </div>
              <DialogFooter className="flex-wrap">
                {detail.status === "pending" && <Button type="button" variant="destructive" disabled={busyId === detail.id} onClick={() => reject(detail)}>{t("inventory:returns.reject")}</Button>}
                {detail.status === "pending" && <Button type="button" disabled={busyId === detail.id} onClick={() => approve(detail)}>{t("inventory:returns.customer.detail.approveRefund")}</Button>}
                <Button type="button" variant="outline" onClick={() => printReturn(detail)}><Printer className="size-4" aria-hidden /> {t("common:actions.print")}</Button>
                <Button type="button" variant="outline" onClick={() => setDetail(null)}>{t("common:actions.close")}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
