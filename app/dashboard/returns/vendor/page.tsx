"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { Banknote, Download, Eye, Printer, Search, Truck, Undo2, Package, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { Field, FieldLabel } from "@/components/ui/field"
import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item"
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
import vendorReturnsApi, { type ReturnableItem, type SupplierReturnRow, type SupplierReturnStats } from "@/lib/vendorReturnsApi"
import vendorApi, { type VendorOverviewRow } from "@/lib/vendorApi"
import purchaseOrderApi from "@/lib/purchaseOrderApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { WithTooltip } from "@/components/common/WithTooltip"
import { localeTag } from "@/lib/i18n"

type Tab = "all" | "pending" | "shipped" | "received" | "credited"

const NS = ["inventory", "common"] as const
type K = ParseKeys<typeof NS>

const TABS: [Tab, K][] = [
  ["all", "common:status.all"], ["pending", "common:orderStatus.pending"], ["shipped", "common:orderStatus.shipped"],
  ["received", "inventory:returns.supplier.status.received"], ["credited", "inventory:returns.supplier.status.credited"],
]
// Reason values are saved on the return as-is; only the shown label is translated
const REASONS = ["Defective/Damaged", "Expired products", "Overstocked items", "Wrong items received", "Quality issues", "Recall", "Other"]
const REASON_KEY: Record<string, K> = {
  "Defective/Damaged": "inventory:returns.supplier.reason.defective",
  "Expired products": "inventory:returns.supplier.reason.expired",
  "Overstocked items": "inventory:returns.supplier.reason.overstocked",
  "Wrong items received": "inventory:returns.supplier.reason.wrongItems",
  "Quality issues": "inventory:returns.supplier.reason.quality",
  Recall: "inventory:returns.supplier.reason.recall",
  Other: "common:extra.other",
}
const CREDITS: { id: "note" | "refund" | "replacement"; label: K; sub: K }[] = [
  { id: "note", label: "inventory:returns.supplier.credit.note", sub: "inventory:returns.supplier.credit.noteSub" },
  { id: "refund", label: "inventory:returns.supplier.credit.refund", sub: "inventory:returns.supplier.credit.refundSub" },
  { id: "replacement", label: "inventory:returns.supplier.credit.replacement", sub: "inventory:returns.supplier.credit.replacementSub" },
]
const CREDIT_LABEL: Record<string, K> = {
  note: "inventory:returns.supplier.credit.note",
  refund: "inventory:returns.supplier.credit.refund",
  replace: "inventory:returns.supplier.credit.replacement",
  replacement: "inventory:returns.supplier.credit.replacement",
}
/** Status code → label/next-step keys (codes stay as data). */
const STATUS: Record<string, { label: K; variant: StatusVariant; next?: string; nextLabel?: K }> = {
  pending: { label: "common:orderStatus.pending", variant: "secondary", next: "shipped", nextLabel: "inventory:returns.supplier.next.shipped" },
  shipped: { label: "common:orderStatus.shipped", variant: "secondary", next: "received", nextLabel: "inventory:returns.supplier.next.received" },
  received: { label: "inventory:returns.supplier.status.received", variant: "outline", next: "credited", nextLabel: "inventory:returns.supplier.next.credited" },
  credited: { label: "inventory:returns.supplier.status.credited", variant: "default" },
}

const today = () => new Date().toISOString().slice(0, 10)
const stKey = (r: SupplierReturnRow) => (STATUS[r.status] ? r.status : r.status === "completed" ? "credited" : "pending")

interface PickLine { key: string; productId: number; variantId: number | null; name: string; sku: string; stock: number; receivedQty: number | null; on: boolean; qty: number; cost: number; reason: string }

export default function SupplierReturnsPage() {
  const { t, i18n } = useTranslation(NS)
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString(localeTag(i18n.language), { month: "short", day: "numeric", year: "numeric" }) : "—")
  const reasonLabel = (r?: string | null) => (r && REASON_KEY[r] ? t(REASON_KEY[r]) : r ?? "")
  const creditLabel = (c?: string | null) => t(CREDIT_LABEL[c ?? ""] ?? "inventory:returns.supplier.credit.note")
  const creditEffectText = (type: string, amount: string, supplier: string) =>
    type === "refund"
      ? (supplier ? t("inventory:returns.supplier.effect.refund", { supplier, amount }) : t("inventory:returns.supplier.effect.refundAnon", { amount }))
      : type === "replacement" || type === "replace"
        ? (supplier ? t("inventory:returns.supplier.effect.replacement", { supplier, amount }) : t("inventory:returns.supplier.effect.replacementAnon", { amount }))
        : (supplier ? t("inventory:returns.supplier.effect.note", { supplier, amount }) : t("inventory:returns.supplier.effect.noteAnon", { amount }))
  const { formatCurrency } = useCompanySettings()
  const { warehouses } = useWarehouse()
  const blocked = useModuleGuard("Vendor Returns")

  const [rows, setRows] = useState<SupplierReturnRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Partial<Record<Tab, number>>>({})
  const [stats, setStats] = useState<SupplierReturnStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [searchD, setSearchD] = useState("")
  const [fromD, setFromD] = useState("")
  const [toD, setToD] = useState("")
  const [supF, setSupF] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [detail, setDetail] = useState<SupplierReturnRow | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [vendors, setVendors] = useState<VendorOverviewRow[]>([])

  // ---- new return form
  const [formOpen, setFormOpen] = useState(false)
  const [supId, setSupId] = useState("")
  const [pos, setPos] = useState<{ id: number; poNumber: string }[]>([])
  const [poId, setPoId] = useState("")
  const [retDate, setRetDate] = useState(today())
  const [tracking, setTracking] = useState("")
  const [locId, setLocId] = useState("")
  const [sq, setSq] = useState("")
  const [items, setItems] = useState<PickLine[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [credit, setCredit] = useState<"note" | "refund" | "replacement">("note")
  const [note, setNote] = useState("")
  const [printNote, setPrintNote] = useState(true)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoBusy, setPhotoBusy] = useState(false)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { const id = setTimeout(() => setSearchD(search.trim()), 250); return () => clearTimeout(id) }, [search])
  useEffect(() => { vendorApi.getOverview({ limit: 500, sort: "name" }).then((r) => setVendors(r.data)).catch(() => {}) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, per_page: perPage }
      if (tab !== "all") params.status = tab
      if (searchD) params.search = searchD
      if (fromD) params.from = fromD
      if (toD) params.to = toD
      if (supF !== "all") params.vendor_id = supF
      const res = await vendorReturnsApi.getLog(params)
      setRows(res.data); setTotal(res.total); setCounts(res.counts); setStats(res.stats)
    } catch {
      setRows([])
      toast.error(t("inventory:returns.supplier.toast.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [page, perPage, tab, searchD, fromD, toD, supF])
  useEffect(() => { load() }, [load])

  // purchase orders of the chosen supplier
  useEffect(() => {
    setPoId("")
    if (!supId) { setPos([]); return }
    purchaseOrderApi.getAll({ vendor_id: supId, limit: 20 })
      .then((r) => setPos(((r.data?.data?.data ?? []) as any[]).filter((p) => p.status === "partial" || p.status === "received").map((p) => ({ id: p.id, poNumber: p.poNumber }))))
      .catch(() => setPos([]))
  }, [supId])

  // items in stock at the chosen location
  useEffect(() => {
    if (!formOpen || !locId) { setItems([]); return }
    const timer = setTimeout(async () => {
      setItemsLoading(true)
      try {
        const res: ReturnableItem[] = await vendorReturnsApi.getReturnableItems({
          location_id: Number(locId), vendor_id: supId ? Number(supId) : undefined, po_id: poId ? Number(poId) : undefined, search: sq.trim() || undefined,
        })
        setItems((prev) => res.map((r) => {
          const key = `${r.productId}-${r.variantId ?? 0}`
          const old = prev.find((p) => p.key === key)
          return { key, productId: r.productId, variantId: r.variantId, name: r.name, sku: r.sku, stock: r.stock, receivedQty: r.receivedQty,
            on: old?.on ?? false, qty: old?.qty ?? 1, cost: old?.cost ?? r.lastCost, reason: old?.reason ?? REASONS[0] }
        }))
      } catch { setItems([]) } finally { setItemsLoading(false) }
    }, 250)
    return () => clearTimeout(timer)
  }, [formOpen, locId, supId, poId, sq])

  const openForm = () => {
    setSupId(""); setPoId(""); setRetDate(today()); setTracking(""); setSq(""); setItems([]); setCredit("note"); setNote(""); setPrintNote(true); setPhotos([]); setErr("")
    setLocId(warehouses[0] ? String(warehouses[0].id) : "")
    setFormOpen(true)
  }
  const patch = (key: string, p: Partial<PickLine>) => setItems((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)))

  const creditEffect = (type: string, amt: number, supplier: string) => creditEffectText(type, formatCurrency(amt), supplier)
  const picked = items.filter((i) => i.on)
  const units = picked.reduce((a, i) => a + i.qty, 0)
  const subtotal = Math.round(picked.reduce((a, i) => a + i.qty * i.cost, 0) * 100) / 100
  const locName = warehouses.find((w) => String(w.id) === locId)?.name ?? ""

  const submit = async () => {
    if (!supId) { setErr(t("inventory:purchases.validation.supplier")); return }
    if (picked.length === 0) { setErr(t("inventory:returns.customer.validation.pickItem")); return }
    if (!retDate) { setErr(t("inventory:returns.supplier.validation.date")); return }
    if (retDate > today()) { setErr(t("inventory:returns.supplier.validation.dateFuture")); return }
    if (picked.some((i) => i.cost < 0)) { setErr(t("inventory:returns.supplier.validation.cost")); return }
    if (picked.some((i) => i.qty > i.stock)) { setErr(t("inventory:returns.supplier.validation.qty")); return }
    setSaving(true); setErr("")
    try {
      const res = await vendorReturnsApi.createReturn({
        vendorId: Number(supId), purchaseOrderId: poId ? Number(poId) : undefined, locationId: Number(locId), returnDate: retDate,
        trackingNo: tracking.trim() || undefined, creditType: credit, note: note.trim() || undefined,
        items: picked.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.qty, unitCost: i.cost, reason: i.reason })),
      })
      let created = res
      if (photos.length > 0) {
        try { created = await vendorReturnsApi.uploadPhotos(res.id, photos) } catch { toast.error(t("inventory:returns.supplier.toast.photosFailed")) }
      }
      toast.success(t("inventory:returns.supplier.toast.created", { number: res.returnNumber }))
      setFormOpen(false)
      if (printNote) printReturn(created)
      setPage(1); load()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? t("inventory:returns.supplier.toast.createFailed"))
    } finally {
      setSaving(false)
    }
  }

  const advance = async (r: SupplierReturnRow) => {
    const s = STATUS[stKey(r)]
    if (!s.next) return
    if (!window.confirm(t("inventory:returns.supplier.confirmMove", { number: r.returnNumber, status: t(STATUS[s.next].label) }))) return
    setBusyId(r.id)
    try {
      const updated = await vendorReturnsApi.advance(r.id, s.next)
      toast.success(t("inventory:returns.supplier.toast.marked", { number: r.returnNumber, status: t(STATUS[s.next].label) }))
      if (detail?.id === r.id) setDetail(updated)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t("inventory:returns.supplier.toast.statusFailed"))
    } finally { setBusyId(null) }
  }

  const addPhotos = async (r: SupplierReturnRow, files: File[]) => {
    if (files.length === 0) return
    setPhotoBusy(true)
    try {
      const updated = await vendorReturnsApi.uploadPhotos(r.id, files)
      setDetail(updated); load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? t("inventory:returns.supplier.toast.uploadFailed"))
    } finally { setPhotoBusy(false) }
  }
  const removePhoto = async (r: SupplierReturnRow, attId: number) => {
    if (!window.confirm(t("inventory:returns.supplier.confirmRemovePhoto"))) return
    setPhotoBusy(true)
    try { setDetail(await vendorReturnsApi.removePhoto(r.id, attId)); load() } catch { toast.error(t("inventory:returns.supplier.toast.removePhotoFailed")) } finally { setPhotoBusy(false) }
  }

  const printReturn = (r: SupplierReturnRow) => {
    const w = window.open("", "_blank", "width=720,height=800")
    if (!w) { toast.error(t("inventory:returns.allowPopups")); return }
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))
    w.document.write(`<!doctype html><html lang="${i18n.language === "bn" ? "bn" : "en"}"><title>${esc(r.returnNumber)}</title><body style="font-family:sans-serif;padding:24px">
      <h2 style="margin:0">${esc(t("inventory:returns.supplier.print.title", { number: r.returnNumber }))}</h2>
      <p style="color:#5B6478">${fmt(r.returnDate ?? r.createdAt)} · ${esc(r.supplierName)} · ${esc(r.poNumber ?? t("inventory:returns.supplier.print.noPo"))}</p>
      <table style="width:100%;border-collapse:collapse">${r.lines.map((l) => `<tr><td style="padding:6px 0">${esc(l.name)}</td><td>${l.quantity} × ${formatCurrency(l.unitCost)}</td><td style="text-align:right">${formatCurrency(l.total)}</td></tr>`).join("")}</table>
      <h3 style="text-align:right">${esc(t("inventory:returns.supplier.print.value", { type: creditLabel(r.creditType), amount: formatCurrency(r.amount) }))}</h3>
      <p>${esc(t("inventory:returns.supplier.print.reason", { reason: reasonLabel(r.reason) || "—" }))}</p>${r.trackingNo ? `<p>${esc(t("inventory:returns.supplier.print.tracking", { tracking: r.trackingNo }))}</p>` : ""}${r.note ? `<p>${esc(t("inventory:purchases.print.note", { note: r.note }))}</p>` : ""}</body>`)
    w.document.close(); w.focus(); w.print()
  }

  const handleExport = async () => {
    try {
      const params: Record<string, any> = { per_page: 500 }
      if (tab !== "all") params.status = tab
      if (searchD) params.search = searchD
      if (fromD) params.from = fromD
      if (toD) params.to = toD
      if (supF !== "all") params.vendor_id = supF
      const all: SupplierReturnRow[] = []
      for (let p = 1; p <= 40; p++) {
        const res = await vendorReturnsApi.getLog({ ...params, page: p })
        all.push(...res.data)
        if (p >= res.lastPage) break
      }
      if (all.length === 0) { toast.error(t("common:extra.nothingToExport")); return }
      exportToCSV(all.map((r) => ({
        return: r.returnNumber, date: r.returnDate ?? r.createdAt, supplier: r.supplierName, po: r.poNumber ?? t("inventory:returns.supplier.notLinked"), items: r.itemsSummary, reason: reasonLabel(r.reason),
        credit_type: CREDIT_LABEL[r.creditType] ? t(CREDIT_LABEL[r.creditType]) : r.creditType, amount: r.amount, status: t(STATUS[stKey(r)].label), tracking: r.trackingNo ?? "", photos: r.attachments?.length ?? 0, note: r.note ?? "",
      })), "supplier-returns", ["return", "date", "supplier", "po", "items", "reason", "credit_type", "amount", "status", "tracking", "photos", "note"])
    } catch {
      toast.error(t("inventory:returns.customer.toast.exportFailed"))
    }
  }

  const cycleSup = () => {
    const opts = ["all", ...(stats?.suppliers ?? []).map((v) => String(v.id))]
    setSupF(opts[(opts.indexOf(supF) + 1) % opts.length]); setPage(1)
  }
  const supLabel = supF === "all" ? t("inventory:purchases.filter.supplierAll") : stats?.suppliers?.find((v) => String(v.id) === supF)?.name ?? t("common:extra.supplier")
  const hasFilter = !!(searchD || fromD || toD || supF !== "all")
  const timeline = useMemo(() => detail ? ([["inventory:returns.supplier.timeline.shipped", detail.shippedAt], ["inventory:returns.supplier.timeline.received", detail.receivedAt], ["inventory:returns.supplier.timeline.credited", detail.creditedAt]] as const)
    .filter((x) => x[1]).map((x) => t(x[0], { date: fmt(x[1]) })).join(" · ") || t("inventory:returns.supplier.timeline.none") : "", [detail, t, i18n.language]) // eslint-disable-line react-hooks/exhaustive-deps

  if (blocked) return blocked

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title={t("inventory:returns.supplier.title")}
        description={t("inventory:returns.supplier.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> {t("common:actions.export")}</Button>
          <Button type="button" onClick={openForm}>{t("inventory:returns.customer.newReturn")}</Button>
        </>}
      />

      {loading && !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[118px]" />)}</div>
      ) : stats ? (
        <StatsCards stats={[
          { label: t("inventory:returns.supplier.title"), value: stats.count, icon: <Undo2 className="size-4" />, color: "blue", hint: t("common:time.allTime") },
          { label: t("inventory:returns.supplier.kpi.pendingShipped"), value: `${stats.pendingCount} / ${stats.shippedCount}`, icon: <Truck className="size-4" />, color: "yellow", hint: t("inventory:returns.supplier.kpi.pendingShippedHint") },
          { label: t("inventory:returns.supplier.kpi.toReceive"), value: formatCurrency(stats.creditToReceive), icon: <Banknote className="size-4" />, color: "yellow", hint: t("inventory:returns.supplier.kpi.toReceiveHint") },
          { label: t("inventory:returns.supplier.kpi.received"), value: formatCurrency(stats.creditReceived), icon: <CheckCircle2 className="size-4" />, color: "green", hint: t("inventory:returns.supplier.kpi.receivedHint") },
          { label: t("inventory:returns.supplier.kpi.mostReturnedTo"), value: stats.mostReturnedTo?.name ?? "—", icon: <Package className="size-4" />, color: "red", hint: stats.mostReturnedTo ? t("inventory:returns.customer.kpi.returnsCount", { count: stats.mostReturnedTo.count }) : t("inventory:returns.customer.kpi.noReturns") },
        ]} />
      ) : null}

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(v) => { setTab(v as Tab); setPage(1) }} tabs={TABS.map(([v, label]) => ({ value: v, label: t(label), count: counts[v] }))} />
        </div>
        <Toolbar className="items-end gap-2.5 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="vr-search" className="sr-only">{t("inventory:returns.customer.searchLabel")}</Label>
            <Input id="vr-search" type="search" placeholder={t("inventory:returns.supplier.searchPlaceholder")} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9" />
          </div>
          <FormField label={t("common:extra.from")} htmlFor="vr-from" className="w-auto gap-1">
            <Input id="vr-from" type="date" value={fromD} onChange={(e) => { setFromD(e.target.value); setPage(1) }} />
          </FormField>
          <FormField label={t("common:extra.to")} htmlFor="vr-to" className="w-auto gap-1">
            <Input id="vr-to" type="date" value={toD} onChange={(e) => { setToD(e.target.value); setPage(1) }} />
          </FormField>
          <Button type="button" variant="outline" onClick={cycleSup}>{supLabel} ▾</Button>
        </Toolbar>

        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t("inventory:returns.customer.col.return")}</TableHead><TableHead>{t("inventory:returns.supplier.col.supplierPo")}</TableHead>
                <TableHead>{t("inventory:returns.customer.col.itemsReason")}</TableHead><TableHead className="text-right">{t("inventory:suppliers.detail.value")}</TableHead>
                <TableHead>{t("common:fields.status")}</TableHead><TableHead className="pr-4 text-right">{t("inventory:purchases.col.nextStep")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={6} className="px-4"><Skeleton className="h-10" /></TableCell></TableRow>) :
                rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>
                    <EmptyState icon={Undo2} title={t("inventory:returns.supplier.empty.title")} description={hasFilter || tab !== "all" ? t("inventory:purchases.empty.filtered") : t("inventory:returns.supplier.empty.first")} className="p-4 md:p-6" />
                  </TableCell></TableRow>
                ) : rows.map((r) => {
                  const s = STATUS[stKey(r)]
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4">
                        <Button type="button" variant="link" className="h-auto p-0" onClick={() => setDetail(r)}>{r.returnNumber}</Button>
                        <div className="text-xs text-muted-foreground">{fmt(r.returnDate ?? r.createdAt)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.supplierName || "—"}</div>
                        {r.poNumber ? <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs"><Link href="/dashboard/vendors/purchase-orders">{r.poNumber}</Link></Button> : <span className="text-xs text-muted-foreground">{t("inventory:returns.supplier.notLinked")}</span>}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[240px] truncate">{r.itemsSummary}</div>
                        <div className="text-xs text-muted-foreground">{reasonLabel(r.reason) || "—"}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="font-semibold">{formatCurrency(r.amount)}</div>
                        <div className="text-xs text-muted-foreground">{creditLabel(r.creditType)}</div>
                      </TableCell>
                      <TableCell><StatusBadge status={stKey(r)} variant={s.variant} label={t(s.label)} /></TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {s.next && s.nextLabel && <Button type="button" size="sm" className="mr-1" disabled={busyId === r.id} onClick={() => advance(r)}>{t(s.nextLabel)}</Button>}
                          <WithTooltip content={t("inventory:returns.viewReturn")}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:returns.viewReturn")} onClick={() => setDetail(r)}><Eye className="size-4" /></Button></WithTooltip>
                          <WithTooltip content={t("inventory:returns.supplier.printNote")}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:returns.supplier.printNote")} onClick={() => printReturn(r)}><Printer className="size-4" /></Button></WithTooltip>
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
        <Separator />
        <div className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{t("inventory:returns.supplier.stillToReceive", { amount: formatCurrency(stats?.pendingCreditAmount ?? stats?.creditToReceive ?? 0) })}</div>
      </Card>

      {/* ---------------- New supplier return ---------------- */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[980px]">
          <DialogHeader>
            <DialogTitle>{t("inventory:returns.supplier.form.title")}</DialogTitle>
            <DialogDescription>{t("inventory:returns.supplier.form.stockLeaves", { location: locName || t("inventory:returns.supplier.form.theLocation") })}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="flex min-w-0 flex-col gap-5">
              <fieldset className="flex flex-col gap-3">
                <SectionTitle as="legend" className="mb-2">{t("inventory:returns.supplier.form.step1")}</SectionTitle>
                <FormField label={t("common:extra.supplier")} required>
                  <div className="flex flex-wrap gap-1.5">
                    {vendors.filter((v) => v.status === "Active").map((v) => (
                      <Button key={v.id} type="button" size="sm" variant={supId === String(v.id) ? "default" : "outline"} aria-pressed={supId === String(v.id)} onClick={() => { setSupId(String(v.id)); setErr("") }}>{v.name}</Button>
                    ))}
                  </div>
                </FormField>
                {supId && (
                  <FormField label={t("inventory:returns.supplier.form.fromPo")} description={pos.length === 0 ? t("inventory:returns.supplier.form.noPos") : undefined}>
                    <div className="flex flex-wrap gap-1.5">
                      <Button type="button" size="sm" variant={poId === "" ? "default" : "outline"} aria-pressed={poId === ""} onClick={() => setPoId("")}>{t("inventory:returns.supplier.notLinked")}</Button>
                      {pos.map((p) => (
                        <Button key={p.id} type="button" size="sm" variant={poId === String(p.id) ? "default" : "outline"} aria-pressed={poId === String(p.id)} onClick={() => setPoId(String(p.id))}>{p.poNumber}</Button>
                      ))}
                    </div>
                  </FormField>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={t("inventory:returns.supplier.form.returnDate")} required htmlFor="vr-date"><Input id="vr-date" type="date" max={today()} value={retDate} onChange={(e) => setRetDate(e.target.value)} /></FormField>
                  <FormField label={t("inventory:returns.supplier.form.tracking")} htmlFor="vr-tracking"><Input id="vr-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder={t("inventory:returns.supplier.form.trackingPh")} /></FormField>
                </div>
                <FormField label={t("inventory:returns.supplier.form.takenFrom")}>
                  <div className="flex flex-wrap gap-1.5">
                    {warehouses.map((w) => (
                      <Button key={w.id} type="button" size="sm" variant={locId === String(w.id) ? "default" : "outline"} aria-pressed={locId === String(w.id)} onClick={() => setLocId(String(w.id))}>{w.name}</Button>
                    ))}
                  </div>
                </FormField>
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <SectionTitle as="legend" className="mb-2">{t("inventory:returns.supplier.form.step2")}</SectionTitle>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Label htmlFor="vr-product-search" className="sr-only">{t("inventory:returns.supplier.form.searchProducts")}</Label>
                  <Input id="vr-product-search" type="search" value={sq} onChange={(e) => setSq(e.target.value)} placeholder={t("inventory:returns.supplier.form.searchProductsPh")}
                    className="pl-9" />
                </div>
                {itemsLoading && items.length === 0 ? <Skeleton className="h-16" /> : items.length === 0 ? (
                  <span className="text-sm text-muted-foreground">{supId ? t("inventory:returns.supplier.form.noItems") : t("inventory:returns.supplier.form.chooseSupplier")}</span>
                ) : (
                  <Card className="gap-0 py-0">
                    {items.map((i, idx) => (
                      <Fragment key={i.key}>
                        {idx > 0 && <Separator />}
                        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-3 py-3 lg:grid-cols-[auto_1fr_auto_88px_150px_80px]">
                          <Checkbox checked={i.on} onCheckedChange={(v) => patch(i.key, { on: v === true })} aria-label={t("inventory:returns.customer.form.returnItem", { name: i.name })} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{i.name}</div>
                            <div className="text-xs text-muted-foreground">{i.receivedQty !== null ? `${t("inventory:returns.supplier.form.receivedQty", { count: i.receivedQty })} · ` : ""}{t("inventory:returns.supplier.form.costStock", { cost: formatCurrency(i.cost), count: i.stock })}</div>
                          </div>
                          <ButtonGroup className="col-start-2 lg:col-start-auto">
                            <WithTooltip content={t("inventory:returns.decreaseQty")}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:returns.decreaseQty")} onClick={() => patch(i.key, { qty: Math.max(1, i.qty - 1), on: true })}>−</Button></WithTooltip>
                            <ButtonGroupText className="w-10 justify-center tabular-nums">{i.qty}</ButtonGroupText>
                            <WithTooltip content={t("inventory:returns.increaseQty")}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:returns.increaseQty")} onClick={() => patch(i.key, { qty: Math.min(i.stock, i.qty + 1), on: true })}>+</Button></WithTooltip>
                          </ButtonGroup>
                          <Input type="number" min={0} step="0.01" aria-label={t("inventory:purchases.unitCost")} value={i.cost} onChange={(e) => patch(i.key, { cost: Number(e.target.value) || 0 })}
                            className="col-start-2 tabular-nums lg:col-start-auto" />
                          <Select value={i.reason} onValueChange={(v) => patch(i.key, { reason: v })}>
                            <SelectTrigger aria-label={t("common:extra.reason")} className="col-start-2 w-full lg:col-start-auto"><SelectValue /></SelectTrigger>
                            <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{reasonLabel(r)}</SelectItem>)}</SelectContent>
                          </Select>
                          <span className="col-start-2 text-right text-sm font-semibold tabular-nums lg:col-start-auto">{formatCurrency(i.qty * i.cost)}</span>
                        </div>
                      </Fragment>
                    ))}
                  </Card>
                )}
              </fieldset>

              <FormField label={t("inventory:returns.supplier.form.photos")} htmlFor="vr-photos">
                <Input id="vr-photos" type="file" accept="image/*,application/pdf" multiple aria-label={t("inventory:returns.supplier.form.attachPhotos")}
                  onChange={(e) => { const f = Array.from(e.target.files ?? []); setPhotos((p) => [...p, ...f].slice(0, 10)); e.target.value = "" }} />
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {photos.map((f, i) => (
                      <Badge key={`${f.name}-${i}`} variant="outline" className="gap-1.5 pr-0.5">
                        {f.name}
                        <WithTooltip content={t("common:extra.removeName", { name: f.name })}><Button type="button" variant="ghost" size="icon-sm" className="size-5" aria-label={t("common:extra.removeName", { name: f.name })} onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>×</Button></WithTooltip>
                      </Badge>
                    ))}
                  </div>
                )}
              </FormField>
              <FormField label={t("inventory:purchases.form.noteToSupplier")} htmlFor="vr-note">
                <Textarea id="vr-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("inventory:returns.supplier.form.notePh")} />
              </FormField>
            </div>

            <aside className="lg:self-start">
              <Card className="gap-3 p-4">
                <SectionTitle>{t("inventory:returns.supplier.form.step3")}</SectionTitle>
                <ChoiceCardGroup value={credit} onValueChange={(v) => setCredit(v as typeof credit)} aria-label={t("inventory:returns.supplier.form.creditType")} className="gap-1.5">
                  {CREDITS.map((c) => (
                    <ChoiceCard key={c.id} value={c.id} title={t(c.label)} description={t(c.sub)} className="p-3" />
                  ))}
                </ChoiceCardGroup>
                <InfoList>
                  <InfoRow label={t("inventory:returns.supplier.form.unitsAtCost", { count: units })} value={<span className="tabular-nums">{formatCurrency(subtotal)}</span>} />
                  <InfoRow label={t("inventory:returns.supplier.form.transport")} value={<span className="tabular-nums">{formatCurrency(0)}</span>} />
                  <Separator />
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{credit === "note" ? t("inventory:returns.supplier.credit.note") : credit === "refund" ? t("inventory:returns.supplier.form.refundDue") : t("inventory:returns.supplier.form.replacementValue")}</span>
                    <span className="text-2xl font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                </InfoList>
                <Alert>
                  <AlertTitle>{t("inventory:returns.customer.form.whatHappens")}</AlertTitle>
                  <AlertDescription className="text-xs">
                    <span>{t("inventory:returns.supplier.form.unitsLeave", { count: units, location: locName || t("inventory:returns.supplier.form.theLocation") })}</span>
                    <span>{creditEffect(credit, subtotal, vendors.find((v) => String(v.id) === supId)?.name ?? "")}</span>
                  </AlertDescription>
                </Alert>
                <Field orientation="horizontal">
                  <Checkbox id="vr-print" checked={printNote} onCheckedChange={(v) => setPrintNote(v === true)} />
                  <FieldLabel htmlFor="vr-print" className="font-normal">{t("inventory:returns.supplier.form.printForDriver")}</FieldLabel>
                </Field>
                {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
              </Card>
            </aside>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t("common:actions.cancel")}</Button>
            <Button type="button" disabled={saving || picked.length === 0} onClick={submit}>{saving ? t("common:actions.saving") : t("inventory:returns.supplier.form.create", { amount: formatCurrency(subtotal) })}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Detail ---------------- */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {detail && (() => {
            const s = STATUS[stKey(detail)]
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{detail.returnNumber}</DialogTitle>
                  <DialogDescription>{fmt(detail.returnDate ?? detail.createdAt)} · {detail.supplierName} · {detail.poNumber ?? t("inventory:returns.supplier.notLinked")}</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 text-sm">
                  <Card className="gap-0 py-0">
                    {detail.lines.map((l, i) => (
                      <Fragment key={i}>
                        {i > 0 && <Separator />}
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <span className="font-medium">{l.name}</span>
                          <span className="text-muted-foreground tabular-nums">{l.quantity} × {formatCurrency(l.unitCost)}</span>
                          <span className="font-semibold tabular-nums">{formatCurrency(l.total)}</span>
                        </div>
                      </Fragment>
                    ))}
                  </Card>
                  <Item variant="muted" size="sm">
                    <ItemContent><ItemTitle>{t("inventory:returns.supplier.detail.value", { type: creditLabel(detail.creditType) })}</ItemTitle></ItemContent>
                    <ItemActions><strong className="tabular-nums">{formatCurrency(detail.amount)}</strong></ItemActions>
                  </Item>
                  <InfoList>
                    <InfoRow label={t("common:fields.status")} value={<StatusBadge status={stKey(detail)} variant={s.variant} label={t(s.label)} />} />
                    <InfoRow label={t("inventory:returns.supplier.form.returnDate")} value={fmt(detail.returnDate ?? detail.createdAt)} />
                    <InfoRow label={t("inventory:returns.supplier.form.takenFrom")} value={detail.locationName ?? "—"} />
                    <InfoRow label={t("inventory:returns.supplier.detail.tracking")} value={detail.trackingNo || "—"} />
                    <InfoRow label={t("inventory:returns.supplier.detail.timeline")} value={timeline} />
                    <InfoRow label={t("common:extra.reason")} value={reasonLabel(detail.reason) || "—"} />
                    <InfoRow label={t("common:fields.note")} value={detail.note || "—"} />
                  </InfoList>
                  <div className="flex flex-col gap-2">
                    <SectionTitle as="h4">{t("inventory:returns.supplier.detail.photos", { count: detail.attachments?.length ?? 0 })}</SectionTitle>
                    {(detail.attachments?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {detail.attachments!.map((a) => (
                          <div key={a.id} className="relative">
                            <Button asChild variant="outline" className="size-20 overflow-hidden p-0 text-xs text-muted-foreground">
                              <a href={a.url} target="_blank" rel="noreferrer">
                                {a.mime?.startsWith("image/") ? <img src={a.url} alt={a.name} className="size-full object-cover" /> : "PDF"}
                              </a>
                            </Button>
                            <WithTooltip content={t("common:extra.removeName", { name: a.name })}><Button type="button" variant="secondary" size="icon-sm" aria-label={t("common:extra.removeName", { name: a.name })} disabled={photoBusy} onClick={() => removePhoto(detail, a.id)}
                              className="absolute -right-1.5 -top-1.5 size-5 rounded-full">×</Button></WithTooltip>
                          </div>
                        ))}
                      </div>
                    )}
                    <Input type="file" accept="image/*,application/pdf" multiple disabled={photoBusy} aria-label={t("inventory:returns.supplier.detail.addPhotos")}
                      onChange={(e) => { addPhotos(detail, Array.from(e.target.files ?? [])); e.target.value = "" }} />
                  </div>
                  <Alert><AlertDescription className="text-xs">{creditEffect(detail.creditType, detail.amount, detail.supplierName)}</AlertDescription></Alert>
                </div>
                <DialogFooter className="flex-wrap">
                  {s.next && s.nextLabel && <Button type="button" disabled={busyId === detail.id} onClick={() => advance(detail)}>{t(s.nextLabel)}</Button>}
                  <Button type="button" variant="outline" onClick={() => printReturn(detail)}><Printer className="size-4" aria-hidden /> {t("common:actions.print")}</Button>
                  <Button type="button" variant="outline" onClick={() => setDetail(null)}>{t("common:actions.close")}</Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
