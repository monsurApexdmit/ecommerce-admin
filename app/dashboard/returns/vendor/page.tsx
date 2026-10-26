"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
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

type Tab = "all" | "pending" | "shipped" | "received" | "credited"

const TABS: [Tab, string][] = [["all", "All"], ["pending", "Pending"], ["shipped", "Shipped"], ["received", "Received"], ["credited", "Credited"]]
const REASONS = ["Defective/Damaged", "Expired products", "Overstocked items", "Wrong items received", "Quality issues", "Recall", "Other"]
const CREDITS: { id: "note" | "refund" | "replacement"; label: string; sub: string }[] = [
  { id: "note", label: "Credit note", sub: "Reduces what you owe" },
  { id: "refund", label: "Refund", sub: "Money back to you" },
  { id: "replacement", label: "Replacement", sub: "New stock sent" },
]
const CREDIT_LABEL: Record<string, string> = { note: "Credit note", refund: "Refund", replace: "Replacement", replacement: "Replacement" }
const STATUS: Record<string, { label: string; variant: StatusVariant; next?: string; nextLabel?: string }> = {
  pending: { label: "Pending", variant: "secondary", next: "shipped", nextLabel: "Mark shipped" },
  shipped: { label: "Shipped", variant: "secondary", next: "received", nextLabel: "Mark received" },
  received: { label: "Received", variant: "outline", next: "credited", nextLabel: "Mark credited" },
  credited: { label: "Credited", variant: "default" },
}

const creditEffectText = (type: string, amount: string, supplier: string) =>
  type === "refund" ? `${supplier || "The supplier"} refunds ${amount}; mark credited when the money arrives`
    : type === "replacement" || type === "replace" ? `${supplier || "The supplier"} sends replacement stock worth ${amount}; mark credited when it arrives`
    : `A credit note of ${amount} lowers what you owe ${supplier || "this supplier"} once marked credited`
const today = () => new Date().toISOString().slice(0, 10)
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")
const stKey = (r: SupplierReturnRow) => (STATUS[r.status] ? r.status : r.status === "completed" ? "credited" : "pending")

interface PickLine { key: string; productId: number; variantId: number | null; name: string; sku: string; stock: number; receivedQty: number | null; on: boolean; qty: number; cost: number; reason: string }

export default function SupplierReturnsPage() {
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

  useEffect(() => { const t = setTimeout(() => setSearchD(search.trim()), 250); return () => clearTimeout(t) }, [search])
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
      toast.error("Failed to load supplier returns")
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
    const t = setTimeout(async () => {
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
    return () => clearTimeout(t)
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
    if (!supId) { setErr("Choose a supplier."); return }
    if (picked.length === 0) { setErr("Select at least one item to return."); return }
    if (!retDate) { setErr("Choose the return date."); return }
    if (retDate > today()) { setErr("Return date cannot be in the future."); return }
    if (picked.some((i) => i.cost < 0)) { setErr("Unit cost must be 0 or more."); return }
    if (picked.some((i) => i.qty > i.stock)) { setErr("A quantity is more than the stock at this location."); return }
    setSaving(true); setErr("")
    try {
      const res = await vendorReturnsApi.createReturn({
        vendorId: Number(supId), purchaseOrderId: poId ? Number(poId) : undefined, locationId: Number(locId), returnDate: retDate,
        trackingNo: tracking.trim() || undefined, creditType: credit, note: note.trim() || undefined,
        items: picked.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.qty, unitCost: i.cost, reason: i.reason })),
      })
      let created = res
      if (photos.length > 0) {
        try { created = await vendorReturnsApi.uploadPhotos(res.id, photos) } catch { toast.error("Return created, but the photos could not be uploaded. Add them from the return details.") }
      }
      toast.success(`${res.returnNumber} created`)
      setFormOpen(false)
      if (printNote) printReturn(created)
      setPage(1); load()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? "Could not create the return.")
    } finally {
      setSaving(false)
    }
  }

  const advance = async (r: SupplierReturnRow) => {
    const s = STATUS[stKey(r)]
    if (!s.next) return
    if (!window.confirm(`Move ${r.returnNumber} to "${STATUS[s.next].label}"?`)) return
    setBusyId(r.id)
    try {
      const updated = await vendorReturnsApi.advance(r.id, s.next)
      toast.success(`${r.returnNumber} marked ${STATUS[s.next].label.toLowerCase()}`)
      if (detail?.id === r.id) setDetail(updated)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Could not update the status")
    } finally { setBusyId(null) }
  }

  const addPhotos = async (r: SupplierReturnRow, files: File[]) => {
    if (files.length === 0) return
    setPhotoBusy(true)
    try {
      const updated = await vendorReturnsApi.uploadPhotos(r.id, files)
      setDetail(updated); load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Could not upload the photos")
    } finally { setPhotoBusy(false) }
  }
  const removePhoto = async (r: SupplierReturnRow, attId: number) => {
    if (!window.confirm("Remove this photo?")) return
    setPhotoBusy(true)
    try { setDetail(await vendorReturnsApi.removePhoto(r.id, attId)); load() } catch { toast.error("Could not remove the photo") } finally { setPhotoBusy(false) }
  }

  const printReturn = (r: SupplierReturnRow) => {
    const w = window.open("", "_blank", "width=720,height=800")
    if (!w) { toast.error("Allow pop-ups to print"); return }
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))
    w.document.write(`<!doctype html><title>${esc(r.returnNumber)}</title><body style="font-family:sans-serif;padding:24px">
      <h2 style="margin:0">Return note ${esc(r.returnNumber)}</h2>
      <p style="color:#5B6478">${fmt(r.returnDate ?? r.createdAt)} · ${esc(r.supplierName)} · ${esc(r.poNumber ?? "Not linked to a PO")}</p>
      <table style="width:100%;border-collapse:collapse">${r.lines.map((l) => `<tr><td style="padding:6px 0">${esc(l.name)}</td><td>${l.quantity} × ${formatCurrency(l.unitCost)}</td><td style="text-align:right">${formatCurrency(l.total)}</td></tr>`).join("")}</table>
      <h3 style="text-align:right">Value (${esc(CREDIT_LABEL[r.creditType] ?? "Credit note")}): ${formatCurrency(r.amount)}</h3>
      <p>Reason: ${esc(r.reason ?? "—")}</p>${r.trackingNo ? `<p>Tracking: ${esc(r.trackingNo)}</p>` : ""}${r.note ? `<p>Note: ${esc(r.note)}</p>` : ""}</body>`)
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
      if (all.length === 0) { toast.error("Nothing to export"); return }
      exportToCSV(all.map((r) => ({
        return: r.returnNumber, date: r.returnDate ?? r.createdAt, supplier: r.supplierName, po: r.poNumber ?? "Not linked", items: r.itemsSummary, reason: r.reason ?? "",
        credit_type: CREDIT_LABEL[r.creditType] ?? r.creditType, amount: r.amount, status: STATUS[stKey(r)].label, tracking: r.trackingNo ?? "", photos: r.attachments?.length ?? 0, note: r.note ?? "",
      })), "supplier-returns", ["return", "date", "supplier", "po", "items", "reason", "credit_type", "amount", "status", "tracking", "photos", "note"])
    } catch {
      toast.error("Could not export returns")
    }
  }

  const cycleSup = () => {
    const opts = ["all", ...(stats?.suppliers ?? []).map((v) => String(v.id))]
    setSupF(opts[(opts.indexOf(supF) + 1) % opts.length]); setPage(1)
  }
  const supLabel = supF === "all" ? "Supplier: All" : stats?.suppliers?.find((v) => String(v.id) === supF)?.name ?? "Supplier"
  const hasFilter = !!(searchD || fromD || toD || supF !== "all")
  const timeline = useMemo(() => detail ? [["Shipped", detail.shippedAt], ["Received by supplier", detail.receivedAt], ["Credited", detail.creditedAt]]
    .filter((x) => x[1]).map((x) => `${x[0]} ${fmt(x[1])}`).join(" · ") || "No updates yet" : "", [detail])

  if (blocked) return blocked

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title="Supplier returns"
        description="Send faulty or extra stock back and get credit for it."
        actions={<>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export</Button>
          <Button type="button" onClick={openForm}>New return</Button>
        </>}
      />

      {loading && !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[118px]" />)}</div>
      ) : stats ? (
        <StatsCards stats={[
          { label: "Supplier returns", value: stats.count, icon: <Undo2 className="size-4" />, color: "blue", hint: "All time" },
          { label: "Pending / shipped", value: `${stats.pendingCount} / ${stats.shippedCount}`, icon: <Truck className="size-4" />, color: "yellow", hint: "Awaiting dispatch / in transit" },
          { label: "Credit to receive", value: formatCurrency(stats.creditToReceive), icon: <Banknote className="size-4" />, color: "yellow", hint: "Not yet credited" },
          { label: "Credit received", value: formatCurrency(stats.creditReceived), icon: <CheckCircle2 className="size-4" />, color: "green", hint: "Marked as credited" },
          { label: "Most returned to", value: stats.mostReturnedTo?.name ?? "—", icon: <Package className="size-4" />, color: "red", hint: stats.mostReturnedTo ? `${stats.mostReturnedTo.count} return(s)` : "No returns yet" },
        ]} />
      ) : null}

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }} tabs={TABS.map(([v, label]) => ({ value: v, label, count: counts[v] }))} />
        </div>
        <Toolbar className="items-end gap-2.5 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="vr-search" className="sr-only">Search returns</Label>
            <Input id="vr-search" type="search" placeholder="Search return #, PO, supplier or reason…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9" />
          </div>
          <FormField label="From" htmlFor="vr-from" className="w-auto gap-1">
            <Input id="vr-from" type="date" value={fromD} onChange={(e) => { setFromD(e.target.value); setPage(1) }} />
          </FormField>
          <FormField label="To" htmlFor="vr-to" className="w-auto gap-1">
            <Input id="vr-to" type="date" value={toD} onChange={(e) => { setToD(e.target.value); setPage(1) }} />
          </FormField>
          <Button type="button" variant="outline" onClick={cycleSup}>{supLabel} ▾</Button>
        </Toolbar>

        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Return</TableHead><TableHead>Supplier / PO</TableHead>
                <TableHead>Items &amp; reason</TableHead><TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead><TableHead className="pr-4 text-right">Next step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={6} className="px-4"><Skeleton className="h-10" /></TableCell></TableRow>) :
                rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>
                    <EmptyState icon={Undo2} title="No supplier returns found" description={hasFilter || tab !== "all" ? "Try clearing the filters." : "Create one with New return."} className="p-4 md:p-6" />
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
                        {r.poNumber ? <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs"><Link href="/dashboard/vendors/purchase-orders">{r.poNumber}</Link></Button> : <span className="text-xs text-muted-foreground">Not linked</span>}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[240px] truncate">{r.itemsSummary}</div>
                        <div className="text-xs text-muted-foreground">{r.reason || "—"}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div className="font-semibold">{formatCurrency(r.amount)}</div>
                        <div className="text-xs text-muted-foreground">{CREDIT_LABEL[r.creditType] ?? "Credit note"}</div>
                      </TableCell>
                      <TableCell><StatusBadge status={s.label} variant={s.variant} /></TableCell>
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {s.next && <Button type="button" size="sm" className="mr-1" disabled={busyId === r.id} onClick={() => advance(r)}>{s.nextLabel}</Button>}
                          <WithTooltip content="View return"><Button type="button" variant="outline" size="icon" aria-label="View return" onClick={() => setDetail(r)}><Eye className="size-4" /></Button></WithTooltip>
                          <WithTooltip content="Print return note"><Button type="button" variant="outline" size="icon" aria-label="Print return note" onClick={() => printReturn(r)}><Printer className="size-4" /></Button></WithTooltip>
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
        <div className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{formatCurrency(stats?.pendingCreditAmount ?? stats?.creditToReceive ?? 0)} credit still to receive</div>
      </Card>

      {/* ---------------- New supplier return ---------------- */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[980px]">
          <DialogHeader>
            <DialogTitle>New supplier return</DialogTitle>
            <DialogDescription>Stock leaves {locName || "the location"} as soon as you create the return.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="flex min-w-0 flex-col gap-5">
              <fieldset className="flex flex-col gap-3">
                <SectionTitle as="legend" className="mb-2">1 · Supplier</SectionTitle>
                <FormField label="Supplier" required>
                  <div className="flex flex-wrap gap-1.5">
                    {vendors.filter((v) => v.status === "Active").map((v) => (
                      <Button key={v.id} type="button" size="sm" variant={supId === String(v.id) ? "default" : "outline"} aria-pressed={supId === String(v.id)} onClick={() => { setSupId(String(v.id)); setErr("") }}>{v.name}</Button>
                    ))}
                  </div>
                </FormField>
                {supId && (
                  <FormField label="From purchase order" description={pos.length === 0 ? "No received purchase orders for this supplier." : undefined}>
                    <div className="flex flex-wrap gap-1.5">
                      <Button type="button" size="sm" variant={poId === "" ? "default" : "outline"} aria-pressed={poId === ""} onClick={() => setPoId("")}>Not linked</Button>
                      {pos.map((p) => (
                        <Button key={p.id} type="button" size="sm" variant={poId === String(p.id) ? "default" : "outline"} aria-pressed={poId === String(p.id)} onClick={() => setPoId(String(p.id))}>{p.poNumber}</Button>
                      ))}
                    </div>
                  </FormField>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Return date" required htmlFor="vr-date"><Input id="vr-date" type="date" max={today()} value={retDate} onChange={(e) => setRetDate(e.target.value)} /></FormField>
                  <FormField label="Shipment / tracking no. (optional)" htmlFor="vr-tracking"><Input id="vr-tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Courier or waybill number" /></FormField>
                </div>
                <FormField label="Taken from">
                  <div className="flex flex-wrap gap-1.5">
                    {warehouses.map((w) => (
                      <Button key={w.id} type="button" size="sm" variant={locId === String(w.id) ? "default" : "outline"} aria-pressed={locId === String(w.id)} onClick={() => setLocId(String(w.id))}>{w.name}</Button>
                    ))}
                  </div>
                </FormField>
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <SectionTitle as="legend" className="mb-2">2 · Items going back</SectionTitle>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Label htmlFor="vr-product-search" className="sr-only">Search products</Label>
                  <Input id="vr-product-search" type="search" value={sq} onChange={(e) => setSq(e.target.value)} placeholder="Search products in stock at this location…"
                    className="pl-9" />
                </div>
                {itemsLoading && items.length === 0 ? <Skeleton className="h-16" /> : items.length === 0 ? (
                  <span className="text-sm text-muted-foreground">{supId ? "No products with stock here to return." : "Choose a supplier, then pick items."}</span>
                ) : (
                  <Card className="gap-0 py-0">
                    {items.map((i, idx) => (
                      <Fragment key={i.key}>
                        {idx > 0 && <Separator />}
                        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 px-3 py-3 lg:grid-cols-[auto_1fr_auto_88px_150px_80px]">
                          <Checkbox checked={i.on} onCheckedChange={(v) => patch(i.key, { on: v === true })} aria-label={`Return ${i.name}`} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{i.name}</div>
                            <div className="text-xs text-muted-foreground">{i.receivedQty !== null ? `${i.receivedQty} received · ` : ""}cost {formatCurrency(i.cost)} · {i.stock} in stock</div>
                          </div>
                          <ButtonGroup className="col-start-2 lg:col-start-auto">
                            <WithTooltip content="Decrease quantity"><Button type="button" variant="outline" size="icon" aria-label="Decrease quantity" onClick={() => patch(i.key, { qty: Math.max(1, i.qty - 1), on: true })}>−</Button></WithTooltip>
                            <ButtonGroupText className="w-10 justify-center tabular-nums">{i.qty}</ButtonGroupText>
                            <WithTooltip content="Increase quantity"><Button type="button" variant="outline" size="icon" aria-label="Increase quantity" onClick={() => patch(i.key, { qty: Math.min(i.stock, i.qty + 1), on: true })}>+</Button></WithTooltip>
                          </ButtonGroup>
                          <Input type="number" min={0} step="0.01" aria-label="Unit cost" value={i.cost} onChange={(e) => patch(i.key, { cost: Number(e.target.value) || 0 })}
                            className="col-start-2 tabular-nums lg:col-start-auto" />
                          <Select value={i.reason} onValueChange={(v) => patch(i.key, { reason: v })}>
                            <SelectTrigger aria-label="Reason" className="col-start-2 w-full lg:col-start-auto"><SelectValue /></SelectTrigger>
                            <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                          </Select>
                          <span className="col-start-2 text-right text-sm font-semibold tabular-nums lg:col-start-auto">{formatCurrency(i.qty * i.cost)}</span>
                        </div>
                      </Fragment>
                    ))}
                  </Card>
                )}
              </fieldset>

              <FormField label="Photos of the problem (optional)" htmlFor="vr-photos">
                <Input id="vr-photos" type="file" accept="image/*,application/pdf" multiple aria-label="Attach photos"
                  onChange={(e) => { const f = Array.from(e.target.files ?? []); setPhotos((p) => [...p, ...f].slice(0, 10)); e.target.value = "" }} />
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {photos.map((f, i) => (
                      <Badge key={`${f.name}-${i}`} variant="outline" className="gap-1.5 pr-0.5">
                        {f.name}
                        <WithTooltip content={`Remove ${f.name}`}><Button type="button" variant="ghost" size="icon-sm" className="size-5" aria-label={`Remove ${f.name}`} onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}>×</Button></WithTooltip>
                      </Badge>
                    ))}
                  </div>
                )}
              </FormField>
              <FormField label="Note to supplier" htmlFor="vr-note">
                <Textarea id="vr-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Stitching open on 3 pieces, photos attached" />
              </FormField>
            </div>

            <aside className="lg:self-start">
              <Card className="gap-3 p-4">
                <SectionTitle>3 · What you get back</SectionTitle>
                <ChoiceCardGroup value={credit} onValueChange={(v) => setCredit(v as typeof credit)} aria-label="Credit type" className="gap-1.5">
                  {CREDITS.map((c) => (
                    <ChoiceCard key={c.id} value={c.id} title={c.label} description={c.sub} className="p-3" />
                  ))}
                </ChoiceCardGroup>
                <InfoList>
                  <InfoRow label={`${units} units at cost`} value={<span className="tabular-nums">{formatCurrency(subtotal)}</span>} />
                  <InfoRow label="Return transport" value={<span className="tabular-nums">{formatCurrency(0)}</span>} />
                  <Separator />
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">{credit === "note" ? "Credit note" : credit === "refund" ? "Refund due" : "Replacement value"}</span>
                    <span className="text-2xl font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                </InfoList>
                <Alert>
                  <AlertTitle>What happens</AlertTitle>
                  <AlertDescription className="text-xs">
                    <span>− {units} units leave {locName || "the location"} now</span>
                    <span>{creditEffect(credit, subtotal, vendors.find((v) => String(v.id) === supId)?.name ?? "")}</span>
                  </AlertDescription>
                </Alert>
                <Field orientation="horizontal">
                  <Checkbox id="vr-print" checked={printNote} onCheckedChange={(v) => setPrintNote(v === true)} />
                  <FieldLabel htmlFor="vr-print" className="font-normal">Print return note for driver</FieldLabel>
                </Field>
                {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
              </Card>
            </aside>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="button" disabled={saving || picked.length === 0} onClick={submit}>{saving ? "Saving…" : `Create return · ${formatCurrency(subtotal)}`}</Button>
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
                  <DialogDescription>{fmt(detail.returnDate ?? detail.createdAt)} · {detail.supplierName} · {detail.poNumber ?? "Not linked"}</DialogDescription>
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
                    <ItemContent><ItemTitle>Value ({CREDIT_LABEL[detail.creditType] ?? "Credit note"})</ItemTitle></ItemContent>
                    <ItemActions><strong className="tabular-nums">{formatCurrency(detail.amount)}</strong></ItemActions>
                  </Item>
                  <InfoList>
                    <InfoRow label="Status" value={<StatusBadge status={s.label} variant={s.variant} />} />
                    <InfoRow label="Return date" value={fmt(detail.returnDate ?? detail.createdAt)} />
                    <InfoRow label="Taken from" value={detail.locationName ?? "—"} />
                    <InfoRow label="Tracking" value={detail.trackingNo || "—"} />
                    <InfoRow label="Timeline" value={timeline} />
                    <InfoRow label="Reason" value={detail.reason || "—"} />
                    <InfoRow label="Note" value={detail.note || "—"} />
                  </InfoList>
                  <div className="flex flex-col gap-2">
                    <SectionTitle as="h4">Photos ({detail.attachments?.length ?? 0})</SectionTitle>
                    {(detail.attachments?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {detail.attachments!.map((a) => (
                          <div key={a.id} className="relative">
                            <Button asChild variant="outline" className="size-20 overflow-hidden p-0 text-xs text-muted-foreground">
                              <a href={a.url} target="_blank" rel="noreferrer">
                                {a.mime?.startsWith("image/") ? <img src={a.url} alt={a.name} className="size-full object-cover" /> : "PDF"}
                              </a>
                            </Button>
                            <WithTooltip content={`Remove ${a.name}`}><Button type="button" variant="secondary" size="icon-sm" aria-label={`Remove ${a.name}`} disabled={photoBusy} onClick={() => removePhoto(detail, a.id)}
                              className="absolute -right-1.5 -top-1.5 size-5 rounded-full">×</Button></WithTooltip>
                          </div>
                        ))}
                      </div>
                    )}
                    <Input type="file" accept="image/*,application/pdf" multiple disabled={photoBusy} aria-label="Add photos"
                      onChange={(e) => { addPhotos(detail, Array.from(e.target.files ?? [])); e.target.value = "" }} />
                  </div>
                  <Alert><AlertDescription className="text-xs">{creditEffect(detail.creditType, detail.amount, detail.supplierName)}</AlertDescription></Alert>
                </div>
                <DialogFooter className="flex-wrap">
                  {s.next && <Button type="button" disabled={busyId === detail.id} onClick={() => advance(detail)}>{s.nextLabel}</Button>}
                  <Button type="button" variant="outline" onClick={() => printReturn(detail)}><Printer className="size-4" aria-hidden /> Print</Button>
                  <Button type="button" variant="outline" onClick={() => setDetail(null)}>Close</Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
