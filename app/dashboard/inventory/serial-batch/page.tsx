"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Download, Hash, Layers, Pencil, Search, Trash2, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { serialBatchApi, type ProductBatch, type ProductSerial, type SerialBatchStats } from "@/lib/serialBatchApi"
import { productApi } from "@/lib/productApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Tab = "batch" | "serial"

const SERIAL_STYLE: Record<string, string> = {
  available: "bg-dash-success-soft text-dash-success-fg",
  sold: "bg-dash-neutral-soft text-dash-neutral-fg",
  returned: "bg-dash-accent-soft text-dash-accent-fg",
  damaged: "bg-dash-danger-soft text-dash-danger-fg",
}

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const today = () => new Date().toISOString().slice(0, 10)
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
      {label}{children}
      {hint && <span className="text-xs font-normal text-dash-muted">{hint}</span>}
    </label>
  )
}

function expiryInfo(b: ProductBatch): { txt: string; cls: string } {
  if (!b.expiryDate) return { txt: "OK", cls: "bg-dash-success-soft text-dash-success-fg" }
  const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 864e5)
  if (b.isExpired || days < 0) return { txt: `Expired ${Math.abs(days)}d ago`, cls: "bg-dash-danger-soft text-dash-danger-fg" }
  if (b.isExpiringSoon || days <= 30) return { txt: `In ${days} days`, cls: "bg-dash-warn-soft text-dash-warn-fg" }
  return { txt: "OK", cls: "bg-dash-success-soft text-dash-success-fg" }
}

export default function SerialBatchPage() {
  const { warehouses } = useWarehouse()
  const { toast } = useToast()
  const blocked = useModuleGuard("Inventory")

  const [tab, setTab] = useState<Tab>("batch")
  const [stats, setStats] = useState<SerialBatchStats | null>(null)
  const [products, setProducts] = useState<any[]>([])

  const [batches, setBatches] = useState<ProductBatch[]>([])
  const [serials, setSerials] = useState<ProductSerial[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [qDebounced, setQDebounced] = useState("")
  const [statusF, setStatusF] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  // form
  const [editing, setEditing] = useState<{ type: Tab; id: number } | null>(null)
  const [fProduct, setFProduct] = useState("")
  const [fVariant, setFVariant] = useState("")
  const [fCode, setFCode] = useState("")
  const [fQty, setFQty] = useState("")
  const [fMfg, setFMfg] = useState("")
  const [fExpiry, setFExpiry] = useState("")
  const [fPo, setFPo] = useState("")
  const [fLoc, setFLoc] = useState("")
  const [fNotes, setFNotes] = useState("")
  const [serialText, setSerialText] = useState("")
  const [fReceived, setFReceived] = useState(today())
  const [fStatus, setFStatus] = useState("available")
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { const t = setTimeout(() => setQDebounced(q.trim()), 250); return () => clearTimeout(t) }, [q])

  useEffect(() => {
    productApi.getAll({ limit: 500 }).then((r: any) => setProducts(r.data ?? [])).catch(() => {})
  }, [])
  useEffect(() => { setFLoc((l) => l || (warehouses[0] ? String(warehouses[0].id) : "")) }, [warehouses])

  const loadStats = useCallback(() => { serialBatchApi.getStats().then(setStats).catch(() => {}) }, [])
  useEffect(() => { loadStats() }, [loadStats])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, per_page: perPage }
      if (qDebounced) params.search = qDebounced
      if (statusF !== "all") params.status = statusF
      if (tab === "batch") {
        const r = await serialBatchApi.getBatches(params)
        setBatches(r.data); setTotal(r.total)
      } else {
        const r = await serialBatchApi.getSerials(params)
        setSerials(r.data); setTotal(r.total)
      }
    } catch {
      setBatches([]); setSerials([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [tab, page, perPage, qDebounced, statusF])
  useEffect(() => { load() }, [load])

  const batchCount = stats?.batchCount ?? stats?.batches.total ?? 0
  const serialCount = stats?.serialCount ?? stats?.serials.total ?? 0
  const noRecords = !!stats && batchCount === 0 && serialCount === 0

  const changeTab = (t: string) => { setTab(t as Tab); setPage(1); setStatusF("all"); clearForm(); setQ("") }

  function clearForm() {
    setEditing(null); setFProduct(""); setFVariant(""); setFCode(""); setFQty(""); setFMfg(""); setFExpiry(""); setFPo("")
    setFNotes(""); setSerialText(""); setFReceived(today()); setFStatus("available"); setErr("")
  }

  const product = products.find((p) => String(p.id) === fProduct)
  const variants: any[] = product?.variants ?? []
  const serialLines = useMemo(() => Array.from(new Set(serialText.split("\n").map((s) => s.trim()).filter(Boolean))), [serialText])

  const editBatch = (b: ProductBatch) => {
    setTab("batch")
    setEditing({ type: "batch", id: b.id })
    setFProduct(String(b.productId)); setFVariant(b.variantId ? String(b.variantId) : "")
    setFCode(b.batchNumber); setFQty(String(b.quantityRemaining)); setFMfg(b.manufactureDate?.slice(0, 10) ?? "")
    setFExpiry(b.expiryDate?.slice(0, 10) ?? ""); setFPo(b.purchaseOrderNumber ?? ""); setFLoc(b.locationId ? String(b.locationId) : fLoc)
    setFNotes(b.notes ?? ""); setErr("")
  }
  const editSerial = (s: ProductSerial) => {
    setTab("serial")
    setEditing({ type: "serial", id: s.id })
    setFProduct(String(s.productId)); setFVariant(s.variantId ? String(s.variantId) : "")
    setSerialText(s.serialNumber); setFReceived(s.receivedDate?.slice(0, 10) ?? today()); setFPo(s.purchaseOrderNumber ?? "")
    setFLoc(s.locationId ? String(s.locationId) : fLoc); setFStatus(s.status); setFNotes(s.notes ?? ""); setErr("")
  }

  const save = async () => {
    if (!fProduct) { setErr("Select a product."); return }
    if (variants.length > 0 && !fVariant) { setErr("Pick a variant."); return }
    setSaving(true); setErr("")
    try {
      if (tab === "batch") {
        if (!fCode.trim()) { setErr("Enter a batch / lot number."); setSaving(false); return }
        const qty = Number(fQty)
        if (!Number.isInteger(qty) || fQty.trim() === "" || qty < (editing ? 0 : 1)) { setErr(editing ? "Enter a whole number, 0 or more." : "Enter a whole number above zero."); setSaving(false); return }
        if (fMfg && fExpiry && fExpiry < fMfg) { setErr("Expiry cannot be before the manufacture date."); setSaving(false); return }
        const body = {
          productId: Number(fProduct), variantId: fVariant ? Number(fVariant) : undefined, locationId: fLoc ? Number(fLoc) : undefined,
          batchNumber: fCode.trim(), manufactureDate: fMfg || undefined, expiryDate: fExpiry || undefined,
          purchaseOrderNumber: fPo.trim() || undefined, notes: fNotes.trim() || undefined,
        }
        if (editing) await serialBatchApi.updateBatch(editing.id, {
          ...body, variantId: fVariant ? Number(fVariant) : null, quantityRemaining: qty,
          manufactureDate: fMfg || null, expiryDate: fExpiry || null, purchaseOrderNumber: fPo.trim() || null, notes: fNotes.trim() || null,
        } as any)
        else await serialBatchApi.createBatch({ ...body, quantityReceived: qty, receivedDate: today() })
        toast({ title: editing ? "Batch updated" : "Batch added", description: fCode.trim() })
      } else {
        if (editing) {
          await serialBatchApi.updateSerial(editing.id, {
            serialNumber: serialLines[0], status: fStatus as any, purchaseOrderNumber: fPo.trim() || undefined,
            receivedDate: fReceived || undefined, notes: fNotes.trim() || undefined, locationId: fLoc ? Number(fLoc) : undefined,
          })
          toast({ title: "Serial updated" })
        } else {
          if (serialLines.length === 0) { setErr("Enter at least one serial number."); setSaving(false); return }
          const res: any = await serialBatchApi.createSerials({
            productId: Number(fProduct), variantId: fVariant ? Number(fVariant) : undefined, locationId: fLoc ? Number(fLoc) : undefined,
            serials: serialLines.map((serialNumber) => ({
              serialNumber, purchaseOrderNumber: fPo.trim() || undefined, receivedDate: fReceived || undefined, notes: fNotes.trim() || undefined,
              ...(fStatus !== "available" ? { status: fStatus } : {}),
            })),
          } as any)
          const created = Array.isArray(res) ? res.length : res?.created?.length ?? 0
          const skipped = Array.isArray(res) ? 0 : res?.skipped?.length ?? 0
          toast({ title: `${created} serial${created === 1 ? "" : "s"} added`, description: skipped ? `${skipped} duplicate${skipped === 1 ? "" : "s"} skipped` : undefined })
        }
      }
      clearForm()
      load(); loadStats()
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (type: Tab, id: number, label: string) => {
    if (!window.confirm(`Delete ${label}?`)) return
    try {
      if (type === "batch") await serialBatchApi.deleteBatch(id)
      else await serialBatchApi.deleteSerial(id)
      toast({ title: "Deleted", description: label })
      load(); loadStats()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not delete", description: e?.response?.data?.message })
    }
  }

  const handleExport = async () => {
    try {
      const base: Record<string, any> = { page: 1, per_page: 500 }
      if (qDebounced) base.search = qDebounced
      const [bs, ss] = await Promise.all([
        serialBatchApi.getBatches({ ...base, ...(tab === "batch" && statusF !== "all" ? { status: statusF } : {}) }),
        serialBatchApi.getSerials({ ...base, ...(tab === "serial" && statusF !== "all" ? { status: statusF } : {}) }),
      ])
      const rows = [
        ...(bs.data as ProductBatch[]).map((b) => ({
          type: "Batch", code: b.batchNumber, product: b.productName + (b.variantName ? ` · ${b.variantName}` : ""), qty: b.quantityRemaining,
          manufactured: b.manufactureDate?.slice(0, 10) ?? "", expiry: b.expiryDate?.slice(0, 10) ?? "", status: expiryInfo(b).txt,
          warehouse: b.locationName ?? "", po: b.purchaseOrderNumber ?? "", received: b.receivedDate?.slice(0, 10) ?? "", sellOrder: b.sellOrderLabel ?? "", notes: b.notes ?? "",
        })),
        ...(ss.data as ProductSerial[]).map((s) => ({
          type: "Serial", code: s.serialNumber, product: s.productName + (s.variantName ? ` · ${s.variantName}` : ""), qty: 1,
          manufactured: "", expiry: "", status: s.status, warehouse: s.locationName ?? "", po: s.purchaseOrderNumber ?? "",
          received: s.receivedDate?.slice(0, 10) ?? "", sellOrder: "", notes: s.notes ?? "",
        })),
      ]
      if (rows.length === 0) { toast({ title: "Nothing to export" }); return }
      exportToCSV(rows, "serial-batch", ["type", "code", "product", "qty", "manufactured", "expiry", "status", "warehouse", "po", "received", "sellOrder", "notes"])
    } catch {
      toast({ variant: "destructive", title: "Could not export" })
    }
  }

  if (blocked) return blocked

  const rows = tab === "batch" ? batches : serials
  const formTitle = editing ? (tab === "batch" ? "Edit batch" : "Edit serial") : tab === "batch" ? "Add batch / lot" : "Add serial numbers"

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Serial &amp; batch tracking</h1>
          <p className="mt-1 text-sm text-dash-muted">Trace units one by one, or by batch with expiry dates — oldest stock sells first.</p>
        </div>
        <button type="button" onClick={handleExport} className={outlineBtn}><Download className="size-4" aria-hidden /> Export</button>
      </div>

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[118px] rounded-[14px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: "Batches", value: batchCount, icon: <Layers className="size-4" />, color: "blue", hint: `${stats.batchProducts ?? 0} products batch-tracked` },
          { label: "Expiring in 30 days", value: stats.expiringSoonCount ?? stats.batches.expiringSoon, icon: <AlertTriangle className="size-4" />, color: "yellow",
            hint: stats.firstExpiring ? `${stats.firstExpiring.batchNumber} · ${stats.firstExpiring.quantity} left` : "Nothing expiring soon" },
          { label: "Expired", value: stats.expiredCount ?? stats.batches.expired, icon: <X className="size-4" />, color: "red",
            hint: stats.firstExpired ? `${stats.firstExpired.batchNumber}${(stats.expiredCount ?? 0) > 1 ? ` +${(stats.expiredCount ?? 1) - 1} more` : ""}` : "None expired" },
          { label: "Serial numbers", value: serialCount, icon: <Hash className="size-4" />, color: "purple",
            hint: `${stats.serialAvailable ?? stats.serials.available} available · ${stats.serialSold ?? stats.serials.sold} sold` },
        ]} />
      )}

      {noRecords && (
        <div className="flex flex-wrap items-center gap-3.5 rounded-xl bg-dash-accent-soft px-[18px] py-3.5 text-dash-accent-fg">
          <span className="min-w-[260px] flex-1 text-sm">
            Serial and batch tracking is set per product. <strong>Nothing tracked yet</strong> — add a batch or serial numbers with the form on this page, or set tracking per product when adding or editing it.
          </span>
          <Link href="/dashboard/products" className="inline-flex h-10 items-center rounded-[10px] bg-dash-accent-fg px-3.5 text-[13px] font-semibold text-dash-accent-soft">Set up a product</Link>
        </div>
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <section className="w-full min-w-0 flex-1 rounded-[14px] border border-dash-border bg-dash-card">
          <div className="px-4">
            <StatusTabs value={tab} onChange={changeTab} tabs={[
              { value: "batch", label: "Batches / lots", count: batchCount },
              { value: "serial", label: "Serial numbers", count: serialCount },
            ]} />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
              <Search className="size-[18px]" aria-hidden />
              <span className="sr-only">Search</span>
              <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder="Search batch / serial number or product…"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
            </label>
            <select aria-label="Status" value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1) }} className={cn(input, "w-[190px] font-semibold")}>
              <option value="all">Status: All</option>
              {tab === "batch" ? (
                <>
                  <option value="ok">OK</option><option value="soon">Expiring in 30 days</option><option value="expired">Expired</option>
                </>
              ) : (
                <>
                  <option value="available">Available</option><option value="sold">Sold</option><option value="returned">Returned</option><option value="damaged">Damaged</option>
                </>
              )}
            </select>
          </div>

          <div className="overflow-x-auto">
            {tab === "batch" ? (
              <table className="w-full min-w-[780px] border-collapse text-sm">
                <thead>
                  <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                    <th className="py-3 pl-4 pr-2 font-semibold">Batch</th><th className="px-2 py-3 font-semibold">Product</th>
                    <th className="px-2 py-3 text-right font-semibold">Qty left</th><th className="px-2 py-3 font-semibold">Expiry</th>
                    <th className="px-2 py-3 font-semibold">Received</th><th className="px-2 py-3 font-semibold">Sell order</th>
                    <th className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? [1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>) :
                    batches.map((b) => {
                      const e = expiryInfo(b)
                      return (
                        <tr key={b.id}>
                          <td className="border-b border-dash-border-soft py-3 pl-4 pr-2 font-bold">{b.batchNumber}</td>
                          <td className="border-b border-dash-border-soft px-2 py-3">
                            <div className="font-semibold">{b.productName}{b.variantName ? ` · ${b.variantName}` : ""}</div>
                            <div className="text-xs text-dash-muted">{[b.locationName, b.notes].filter(Boolean).join(" · ") || "—"}</div>
                          </td>
                          <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">
                            <div className="font-bold">{b.quantityRemaining}</div>
                            <div className="text-xs text-dash-muted">of {Math.max(b.quantityReceived, b.quantityRemaining)} received</div>
                          </td>
                          <td className="border-b border-dash-border-soft px-2 py-3">
                            <div>{fmt(b.expiryDate)}</div>
                            <span className={cn("rounded-full px-2 py-px text-[11px] font-bold", e.cls)}>{e.txt}</span>
                          </td>
                          <td className="border-b border-dash-border-soft px-2 py-3">
                            <div>{fmt(b.receivedDate)}</div>
                            <div className="text-xs text-dash-muted">{b.purchaseOrderNumber || "—"}</div>
                          </td>
                          <td className="border-b border-dash-border-soft px-2 py-3 tabular-nums">{b.sellOrderLabel ?? "—"}</td>
                          <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                            <div className="flex justify-end gap-1">
                              <button type="button" aria-label={`Edit ${b.batchNumber}`} className={iconBtn} onClick={() => editBatch(b)}><Pencil className="size-4" /></button>
                              <button type="button" aria-label={`Delete ${b.batchNumber}`} className={iconBtn} onClick={() => remove("batch", b.id, b.batchNumber)}><Trash2 className="size-4" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                    <th className="py-3 pl-4 pr-2 font-semibold">Serial no.</th><th className="px-2 py-3 font-semibold">Product</th>
                    <th className="px-2 py-3 font-semibold">Warehouse</th><th className="px-2 py-3 font-semibold">Status</th>
                    <th className="px-2 py-3 font-semibold">Received</th><th className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? [1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>) :
                    serials.map((s) => (
                      <tr key={s.id}>
                        <td className="border-b border-dash-border-soft py-3 pl-4 pr-2 font-bold">{s.serialNumber}</td>
                        <td className="border-b border-dash-border-soft px-2 py-3 font-semibold">{s.productName}{s.variantName ? ` · ${s.variantName}` : ""}</td>
                        <td className="border-b border-dash-border-soft px-2 py-3">{s.locationName ?? "—"}</td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold capitalize", SERIAL_STYLE[s.status] ?? SERIAL_STYLE.sold)}>{s.status}</span>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <div>{fmt(s.receivedDate)}</div>
                          <div className="text-xs text-dash-muted">{s.purchaseOrderNumber || "—"}</div>
                        </td>
                        <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                          <div className="flex justify-end gap-1">
                            <button type="button" aria-label={`Edit ${s.serialNumber}`} className={iconBtn} onClick={() => editSerial(s)}><Pencil className="size-4" /></button>
                            <button type="button" aria-label={`Delete ${s.serialNumber}`} className={iconBtn} onClick={() => remove("serial", s.id, s.serialNumber)}><Trash2 className="size-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-14 text-center">
              {tab === "batch" ? <Layers className="size-8 text-dash-muted/50" aria-hidden /> : <Hash className="size-8 text-dash-muted/50" aria-hidden />}
              <h3 className="font-semibold">{q || statusF !== "all" ? "Nothing matches" : tab === "batch" ? "No batches yet" : "No serial numbers yet"}</h3>
              <p className="text-sm text-dash-muted">{q || statusF !== "all" ? "Try clearing the search or status." : "Use the form to add your first one."}</p>
            </div>
          )}

          {!loading && total > 0 && (
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
          )}
        </section>

        <aside aria-label="Add" className="flex w-full shrink-0 flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-5 xl:w-[380px]">
          <h2 className="font-dash-display text-lg font-bold">{formTitle}</h2>
          {err && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
          <Field label="Product *">
            <select className={input} value={fProduct} onChange={(e) => { setFProduct(e.target.value); setFVariant("") }} disabled={editing?.type === "serial"}>
              <option value="">Select a product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
            </select>
          </Field>
          {variants.length > 0 && (
            <Field label="Variant *">
              <select className={input} value={fVariant} onChange={(e) => setFVariant(e.target.value)} disabled={editing?.type === "serial"}>
                <option value="">Select variant</option>
                {variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
          )}

          {tab === "batch" ? (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Batch / lot no. *"><input className={input} value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder="e.g. GM-2610" /></Field>
                <Field label={editing ? "Qty left *" : "Quantity *"}><input type="number" min={editing ? 0 : 1} step={1} className={input} value={fQty} onChange={(e) => setFQty(e.target.value)} placeholder="0" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Manufactured"><input type="date" className={input} value={fMfg} onChange={(e) => setFMfg(e.target.value)} /></Field>
                <Field label="Expires"><input type="date" className={input} value={fExpiry} onChange={(e) => setFExpiry(e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="PO number"><input className={input} value={fPo} onChange={(e) => setFPo(e.target.value)} placeholder="Optional" /></Field>
                <Field label="Warehouse">
                  <select className={input} value={fLoc} onChange={(e) => setFLoc(e.target.value)}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
                </Field>
              </div>
              <Field label="Notes"><input className={input} value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Optional" /></Field>
            </>
          ) : (
            <>
              <Field label={editing ? "Serial number *" : "Serial numbers *"} hint={editing ? undefined : `${serialLines.length} serial${serialLines.length === 1 ? "" : "s"} · duplicates are skipped automatically`}>
                <textarea rows={editing ? 1 : 5} className={cn(input, "h-auto py-2.5")} value={serialText} onChange={(e) => setSerialText(e.target.value)} placeholder="Scan or type one per line" />
              </Field>
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="Received"><input type="date" className={input} value={fReceived} onChange={(e) => setFReceived(e.target.value)} /></Field>
                <Field label="PO number"><input className={input} value={fPo} onChange={(e) => setFPo(e.target.value)} placeholder="Optional" /></Field>
              </div>
              <Field label="Warehouse">
                <select className={input} value={fLoc} onChange={(e) => setFLoc(e.target.value)}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
              </Field>
              <Field label="Status">
                <select className={input} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                  <option value="available">Available</option><option value="sold">Sold</option><option value="returned">Returned</option><option value="damaged">Damaged</option>
                </select>
              </Field>
              <Field label="Notes"><input className={input} value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Optional" /></Field>
            </>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={clearForm} className={outlineBtn}>Clear</button>
            <button type="button" disabled={saving} onClick={save} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
              {saving ? "Saving…" : editing ? "Save changes" : tab === "batch" ? "Add batch" : `Add ${serialLines.length || ""} serial${serialLines.length === 1 ? "" : "s"}`.replace("  ", " ")}
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
