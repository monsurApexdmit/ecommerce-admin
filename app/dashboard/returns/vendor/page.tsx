"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Banknote, Download, Eye, Printer, Search, Truck, Undo2, Package, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
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

type Tab = "all" | "pending" | "shipped" | "received" | "credited"

const TABS: [Tab, string][] = [["all", "All"], ["pending", "Pending"], ["shipped", "Shipped"], ["received", "Received"], ["credited", "Credited"]]
const REASONS = ["Defective/Damaged", "Expired products", "Overstocked items", "Wrong items received", "Quality issues", "Recall", "Other"]
const CREDITS: { id: "note" | "refund" | "replacement"; label: string; sub: string }[] = [
  { id: "note", label: "Credit note", sub: "Reduces what you owe" },
  { id: "refund", label: "Refund", sub: "Money back to you" },
  { id: "replacement", label: "Replacement", sub: "New stock sent" },
]
const CREDIT_LABEL: Record<string, string> = { note: "Credit note", refund: "Refund", replace: "Replacement", replacement: "Replacement" }
const STATUS: Record<string, { label: string; cls: string; next?: string; nextLabel?: string }> = {
  pending: { label: "Pending", cls: "bg-dash-warn-soft text-dash-warn-fg", next: "shipped", nextLabel: "Mark shipped" },
  shipped: { label: "Shipped", cls: "bg-dash-accent-soft text-dash-accent-fg", next: "received", nextLabel: "Mark received" },
  received: { label: "Received", cls: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300", next: "credited", nextLabel: "Mark credited" },
  credited: { label: "Credited", cls: "bg-dash-success-soft text-dash-success-fg" },
}

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const primaryBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Supplier returns</h1>
          <p className="mt-1 text-sm text-dash-muted">Send faulty or extra stock back and get credit for it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleExport} className={outlineBtn}><Download className="size-4" aria-hidden /> Export</button>
          <button type="button" onClick={openForm} className={primaryBtn}>New return</button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[118px] rounded-[14px]" />)}</div>
      ) : stats ? (
        <StatsCards stats={[
          { label: "Supplier returns", value: stats.count, icon: <Undo2 className="size-4" />, color: "blue", hint: "All time" },
          { label: "Pending / shipped", value: `${stats.pendingCount} / ${stats.shippedCount}`, icon: <Truck className="size-4" />, color: "yellow", hint: "Awaiting dispatch / in transit" },
          { label: "Credit to receive", value: formatCurrency(stats.creditToReceive), icon: <Banknote className="size-4" />, color: "yellow", hint: "Not yet credited" },
          { label: "Credit received", value: formatCurrency(stats.creditReceived), icon: <CheckCircle2 className="size-4" />, color: "green", hint: "Marked as credited" },
          { label: "Most returned to", value: stats.mostReturnedTo?.name ?? "—", icon: <Package className="size-4" />, color: "red", hint: stats.mostReturnedTo ? `${stats.mostReturnedTo.count} return(s)` : "No returns yet" },
        ]} />
      ) : null}

      <section className="rounded-[14px] border border-dash-border bg-dash-card">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }} tabs={TABS.map(([v, label]) => ({ value: v, label, count: counts[v] }))} />
        </div>
        <div className="flex flex-wrap items-end gap-2.5 p-4">
          <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden />
            <span className="sr-only">Search returns</span>
            <input type="search" placeholder="Search return #, PO, supplier or reason…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-dash-muted">From
            <input type="date" className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal text-dash-ink outline-none" value={fromD} onChange={(e) => { setFromD(e.target.value); setPage(1) }} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-dash-muted">To
            <input type="date" className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal text-dash-ink outline-none" value={toD} onChange={(e) => { setToD(e.target.value); setPage(1) }} />
          </label>
          <button type="button" onClick={cycleSup} className={outlineBtn}>{supLabel} ▾</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                <th className="py-3 pl-4 pr-2 font-semibold">Return</th><th className="px-2 py-3 font-semibold">Supplier / PO</th>
                <th className="px-2 py-3 font-semibold">Items &amp; reason</th><th className="px-2 py-3 text-right font-semibold">Value</th>
                <th className="px-2 py-3 font-semibold">Status</th><th className="py-3 pl-2 pr-4 text-right font-semibold">Next step</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>) :
                rows.length === 0 ? (
                  <tr><td colSpan={6} className="py-14 text-center">
                    <Undo2 className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                    <p className="font-semibold">No supplier returns found</p>
                    <p className="text-sm text-dash-muted">{hasFilter || tab !== "all" ? "Try clearing the filters." : "Create one with New return."}</p>
                  </td></tr>
                ) : rows.map((r) => {
                  const s = STATUS[stKey(r)]
                  return (
                    <tr key={r.id}>
                      <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                        <button type="button" onClick={() => setDetail(r)} className="font-bold hover:underline">{r.returnNumber}</button>
                        <div className="text-xs text-dash-muted">{fmt(r.returnDate ?? r.createdAt)}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="font-semibold">{r.supplierName || "—"}</div>
                        {r.poNumber ? <Link href="/dashboard/vendors/purchase-orders" className="text-xs font-semibold text-dash-accent hover:underline">{r.poNumber}</Link> : <span className="text-xs text-dash-muted">Not linked</span>}
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="max-w-[240px] truncate">{r.itemsSummary}</div>
                        <div className="text-xs text-dash-muted">{r.reason || "—"}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">
                        <div className="font-bold">{formatCurrency(r.amount)}</div>
                        <div className="text-xs text-dash-muted">{CREDIT_LABEL[r.creditType] ?? "Credit note"}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3"><span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", s.cls)}>{s.label}</span></td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {s.next && <button type="button" disabled={busyId === r.id} onClick={() => advance(r)} className="mr-1 h-9 rounded-lg bg-dash-ink px-3 text-[13px] font-semibold text-dash-bg disabled:opacity-40">{s.nextLabel}</button>}
                          <button type="button" aria-label="View return" className={iconBtn} onClick={() => setDetail(r)}><Eye className="size-4" /></button>
                          <button type="button" aria-label="Print return note" className={iconBtn} onClick={() => printReturn(r)}><Printer className="size-4" /></button>
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
        <div className="border-t border-dash-border-soft px-4 py-3 text-xs text-dash-muted tabular-nums">{formatCurrency(stats?.pendingCreditAmount ?? stats?.creditToReceive ?? 0)} credit still to receive</div>
      </section>

      {/* ---------------- New supplier return ---------------- */}
      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[980px]">
          <div className="border-b border-dash-border-soft px-6 py-4">
            <DialogTitle className="font-dash-display text-xl font-bold">New supplier return</DialogTitle>
            <DialogDescription className="text-[13px]">Stock leaves {locName || "the location"} as soon as you create the return.</DialogDescription>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
            <div className="flex min-w-0 flex-col gap-5">
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">1 · Supplier</legend>
                <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Supplier *
                  <div className="flex flex-wrap gap-1.5">
                    {vendors.filter((v) => v.status === "Active").map((v) => (
                      <button key={v.id} type="button" aria-pressed={supId === String(v.id)} onClick={() => { setSupId(String(v.id)); setErr("") }}
                        className={cn("h-9 rounded-full border px-3 text-[13px] font-semibold", supId === String(v.id) ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{v.name}</button>
                    ))}
                  </div>
                </div>
                {supId && (
                  <div className="flex flex-col gap-1.5 text-[13px] font-semibold">From purchase order
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" aria-pressed={poId === ""} onClick={() => setPoId("")} className={cn("h-9 rounded-full border px-3 text-[13px] font-semibold", poId === "" ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>Not linked</button>
                      {pos.map((p) => (
                        <button key={p.id} type="button" aria-pressed={poId === String(p.id)} onClick={() => setPoId(String(p.id))}
                          className={cn("h-9 rounded-full border px-3 text-[13px] font-semibold", poId === String(p.id) ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{p.poNumber}</button>
                      ))}
                    </div>
                    {pos.length === 0 && <span className="text-xs font-normal text-dash-muted">No received purchase orders for this supplier.</span>}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Return date *<input type="date" max={today()} className={input} value={retDate} onChange={(e) => setRetDate(e.target.value)} /></label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Shipment / tracking no. (optional)<input className={input} value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Courier or waybill number" /></label>
                </div>
                <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Taken from
                  <div className="flex flex-wrap gap-1.5">
                    {warehouses.map((w) => (
                      <button key={w.id} type="button" aria-pressed={locId === String(w.id)} onClick={() => setLocId(String(w.id))}
                        className={cn("h-9 rounded-full border px-3 text-[13px] font-semibold", locId === String(w.id) ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{w.name}</button>
                    ))}
                  </div>
                </div>
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">2 · Items going back</legend>
                <label className="flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
                  <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search products</span>
                  <input type="search" value={sq} onChange={(e) => setSq(e.target.value)} placeholder="Search products in stock at this location…"
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
                </label>
                {itemsLoading && items.length === 0 ? <Skeleton className="h-16 rounded-xl" /> : items.length === 0 ? (
                  <span className="text-[13px] text-dash-muted">{supId ? "No products with stock here to return." : "Choose a supplier, then pick items."}</span>
                ) : (
                  <div className="flex flex-col rounded-xl border border-dash-border">
                    {items.map((i) => (
                      <div key={i.key} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 border-b border-dash-border-soft px-3 py-3 last:border-0 lg:grid-cols-[auto_1fr_auto_88px_150px_80px]">
                        <input type="checkbox" checked={i.on} onChange={() => patch(i.key, { on: !i.on })} aria-label={`Return ${i.name}`} className="size-4" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{i.name}</div>
                          <div className="text-xs text-dash-muted">{i.receivedQty !== null ? `${i.receivedQty} received · ` : ""}cost {formatCurrency(i.cost)} · {i.stock} in stock</div>
                        </div>
                        <div className="col-start-2 flex items-center lg:col-start-auto">
                          <button type="button" aria-label="Decrease quantity" onClick={() => patch(i.key, { qty: Math.max(1, i.qty - 1), on: true })} className="h-9 w-8 rounded-l-lg border border-dash-border">−</button>
                          <span className="flex h-9 w-10 items-center justify-center border-y border-dash-border text-sm tabular-nums">{i.qty}</span>
                          <button type="button" aria-label="Increase quantity" onClick={() => patch(i.key, { qty: Math.min(i.stock, i.qty + 1), on: true })} className="h-9 w-8 rounded-r-lg border border-dash-border">+</button>
                        </div>
                        <input type="number" min={0} step="0.01" aria-label="Unit cost" value={i.cost} onChange={(e) => patch(i.key, { cost: Number(e.target.value) || 0 })}
                          className="col-start-2 h-9 rounded-lg border border-dash-border bg-dash-card px-2 text-sm outline-none focus-visible:border-dash-accent lg:col-start-auto" />
                        <select aria-label="Reason" value={i.reason} onChange={(e) => patch(i.key, { reason: e.target.value })} className="col-start-2 h-9 rounded-lg border border-dash-border bg-dash-card px-2 text-xs lg:col-start-auto">
                          {REASONS.map((r) => <option key={r}>{r}</option>)}
                        </select>
                        <span className="col-start-2 text-right text-sm font-bold tabular-nums lg:col-start-auto">{formatCurrency(i.qty * i.cost)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>

              <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Photos of the problem (optional)
                <input type="file" accept="image/*,application/pdf" multiple aria-label="Attach photos"
                  onChange={(e) => { const f = Array.from(e.target.files ?? []); setPhotos((p) => [...p, ...f].slice(0, 10)); e.target.value = "" }}
                  className="block text-xs font-normal file:mr-3 file:h-9 file:rounded-lg file:border file:border-dash-border file:bg-dash-card file:px-3 file:text-[13px] file:font-semibold" />
                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {photos.map((f, i) => (
                      <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-dash-border bg-dash-bg px-3 py-1 text-xs font-medium">
                        {f.name}
                        <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="font-bold text-dash-muted hover:text-dash-ink">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Note to supplier
                <textarea rows={2} className={cn(input, "h-auto py-2.5")} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Stitching open on 3 pieces, photos attached" />
              </label>
            </div>

            <aside className="flex flex-col gap-3 rounded-xl border border-dash-border-soft bg-dash-bg p-4 lg:self-start">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">3 · What you get back</span>
              <div role="radiogroup" aria-label="Credit type" className="flex flex-col gap-1.5">
                {CREDITS.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={credit === c.id} onClick={() => setCredit(c.id)}
                    className={cn("flex flex-col rounded-[10px] border-2 px-3 py-2 text-left text-[13px] font-semibold", credit === c.id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>
                    {c.label}<span className="text-[11px] font-normal opacity-80">{c.sub}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5 text-[13px]">
                <div className="flex justify-between"><span className="text-dash-muted">{units} units at cost</span><span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-dash-muted">Return transport</span><span className="font-semibold tabular-nums">{formatCurrency(0)}</span></div>
                <div className="flex items-baseline justify-between border-t border-dashed border-dash-border pt-2">
                  <span className="font-bold">{credit === "note" ? "Credit note" : credit === "refund" ? "Refund due" : "Replacement value"}</span>
                  <span className="font-dash-display text-2xl font-bold tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 rounded-[10px] bg-dash-card px-3 py-2.5 text-xs text-dash-muted">
                <span className="font-semibold text-dash-ink">What happens</span>
                <span>− {units} units leave {locName || "the location"} now</span>
                <span>{creditEffect(credit, subtotal, vendors.find((v) => String(v.id) === supId)?.name ?? "")}</span>
              </div>
              <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={printNote} onChange={() => setPrintNote((v) => !v)} className="size-4" />Print return note for driver</label>
              {err && <p role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
            </aside>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-dash-border-soft px-6 py-4">
            <button type="button" onClick={() => setFormOpen(false)} className={outlineBtn}>Cancel</button>
            <button type="button" disabled={saving || picked.length === 0} onClick={submit} className={primaryBtn}>{saving ? "Saving…" : `Create return · ${formatCurrency(subtotal)}`}</button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------------- Detail ---------------- */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-xl">
          {detail && (() => {
            const s = STATUS[stKey(detail)]
            return (
              <>
                <div className="border-b border-dash-border-soft px-6 py-4">
                  <DialogTitle className="font-dash-display text-xl font-bold">{detail.returnNumber}</DialogTitle>
                  <DialogDescription className="text-[13px]">{fmt(detail.returnDate ?? detail.createdAt)} · {detail.supplierName} · {detail.poNumber ?? "Not linked"}</DialogDescription>
                </div>
                <div className="flex flex-col gap-3 p-6 text-sm">
                  <div className="flex flex-col rounded-xl border border-dash-border">
                    {detail.lines.map((l, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 border-b border-dash-border-soft px-3 py-2.5 last:border-0">
                        <span className="font-semibold">{l.name}</span>
                        <span className="text-dash-muted tabular-nums">{l.quantity} × {formatCurrency(l.unitCost)}</span>
                        <span className="font-bold tabular-nums">{formatCurrency(l.total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between rounded-[10px] bg-dash-neutral-soft px-3.5 py-2.5"><span>Value ({CREDIT_LABEL[detail.creditType] ?? "Credit note"})</span><strong className="tabular-nums">{formatCurrency(detail.amount)}</strong></div>
                  <div className="text-[13px] text-dash-muted">Status: <strong className="text-dash-ink">{s.label}</strong> · Return date: {fmt(detail.returnDate ?? detail.createdAt)} · Taken from: {detail.locationName ?? "—"}</div>
                  <div className="text-[13px] text-dash-muted">Tracking: <span className="text-dash-ink">{detail.trackingNo || "—"}</span> · {timeline}</div>
                  <div className="text-[13px] text-dash-muted">Reason: <span className="text-dash-ink">{detail.reason || "—"}</span></div>
                  <div className="text-[13px] text-dash-muted">Note: <span className="text-dash-ink">{detail.note || "—"}</span></div>
                  <div className="flex flex-col gap-2">
                    <div className="text-[13px] font-semibold">Photos ({detail.attachments?.length ?? 0})</div>
                    {(detail.attachments?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {detail.attachments!.map((a) => (
                          <div key={a.id} className="relative">
                            <a href={a.url} target="_blank" rel="noreferrer" className="flex size-20 items-center justify-center overflow-hidden rounded-lg border border-dash-border bg-dash-bg text-[11px] font-semibold text-dash-muted">
                              {a.mime?.startsWith("image/") ? <img src={a.url} alt={a.name} className="size-full object-cover" /> : "PDF"}
                            </a>
                            <button type="button" aria-label={`Remove ${a.name}`} disabled={photoBusy} onClick={() => removePhoto(detail, a.id)}
                              className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-dash-ink text-xs font-bold text-dash-bg disabled:opacity-40">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <input type="file" accept="image/*,application/pdf" multiple disabled={photoBusy} aria-label="Add photos"
                      onChange={(e) => { addPhotos(detail, Array.from(e.target.files ?? [])); e.target.value = "" }}
                      className="block text-xs file:mr-3 file:h-9 file:rounded-lg file:border file:border-dash-border file:bg-dash-card file:px-3 file:text-[13px] file:font-semibold" />
                  </div>
                  <div className="rounded-[10px] bg-dash-bg px-3 py-2 text-xs text-dash-muted">{creditEffect(detail.creditType, detail.amount, detail.supplierName)}</div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 border-t border-dash-border-soft px-6 py-4">
                  {s.next && <button type="button" disabled={busyId === detail.id} onClick={() => advance(detail)} className={primaryBtn}>{s.nextLabel}</button>}
                  <button type="button" onClick={() => printReturn(detail)} className={outlineBtn}><Printer className="size-4" aria-hidden /> Print</button>
                  <button type="button" onClick={() => setDetail(null)} className={outlineBtn}>Close</button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
