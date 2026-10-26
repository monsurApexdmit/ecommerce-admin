"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import inventoryApi, { type StockRow } from "@/lib/inventoryApi"
import adjustmentApi, { type AdjustmentLogRow, type AdjustmentStats, type AdjustmentType } from "@/lib/adjustmentApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const TYPES: { id: AdjustmentType; label: string; sub: string }[] = [
  { id: "increase", label: "+ Increase", sub: "Add units" },
  { id: "decrease", label: "− Decrease", sub: "Remove units" },
  { id: "set", label: "= Set to", sub: "After a count" },
]
const REASONS: Record<AdjustmentType, string[]> = {
  increase: ["Recount", "Received without PO", "Customer return", "Found", "Other"],
  decrease: ["Recount", "Damaged", "Expired", "Theft / loss", "Gift / sample", "Own use", "Other"],
  set: ["Recount", "Opening stock", "Other"],
}
const BIG_CHANGE = 10

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")

interface Sku { key: string; productId: number; variantId: number | null; label: string; cost: number; byLoc: Record<number, number> }

export default function AdjustmentPage() {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const blocked = useModuleGuard("Inventory")

  const [skus, setSkus] = useState<Sku[]>([])
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([])
  const [loadingForm, setLoadingForm] = useState(true)

  const [loc, setLoc] = useState("")
  const [skuKey, setSkuKey] = useState("")
  const [type, setType] = useState<AdjustmentType>("decrease")
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState(REASONS.decrease[0])
  const [note, setNote] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const [log, setLog] = useState<AdjustmentLogRow[]>([])
  const [reasonOpts, setReasonOpts] = useState<string[]>([])
  const [stats, setStats] = useState<AdjustmentStats>({ added30d: 0, removed30d: 0, shrinkageValue30d: 0 })
  const [total, setTotal] = useState(0)
  const [logLoading, setLogLoading] = useState(true)
  const [reasonFilter, setReasonFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const loadForm = useCallback(async () => {
    try {
      const ov = await inventoryApi.getOverview()
      setLocations(ov.locations)
      const flat: StockRow[] = ov.items.flatMap((r) => (r.variants?.length ? r.variants : [r]))
      setSkus(flat.map((r) => ({
        key: `${r.type}-${r.id}`,
        productId: r.productId,
        variantId: r.type === "variant" ? r.id : null,
        label: r.variantName ? `${r.name} · ${r.variantName}` : r.name,
        cost: r.cost,
        byLoc: Object.fromEntries(r.locations.map((l) => [l.locationId, l.quantity])),
      })))
      setLoc((cur) => cur || String((ov.locations.find((l) => l.isDefault) ?? ov.locations[0])?.id ?? ""))
      setSkuKey((cur) => cur || (flat[0] ? `${flat[0].type}-${flat[0].id}` : ""))
    } catch {
      /* the form stays empty */
    } finally {
      setLoadingForm(false)
    }
  }, [])

  const loadLog = useCallback(async () => {
    setLogLoading(true)
    try {
      const res = await adjustmentApi.getLog({ page, per_page: perPage, reason: reasonFilter !== "all" ? reasonFilter : undefined })
      setLog(res.data)
      setStats(res.stats)
      setTotal(res.total)
      setReasonOpts(res.reasons)
    } catch {
      setLog([])
    } finally {
      setLogLoading(false)
    }
  }, [page, perPage, reasonFilter])

  useEffect(() => { loadForm() }, [loadForm])
  useEffect(() => { loadLog() }, [loadLog])

  const sku = skus.find((s) => s.key === skuKey)
  const before = sku ? sku.byLoc[Number(loc)] ?? 0 : 0
  const after = type === "increase" ? before + qty : type === "decrease" ? Math.max(0, before - qty) : qty
  const diff = after - before
  const locName = locations.find((l) => String(l.id) === loc)?.name ?? ""
  const bigChange = Math.abs(diff) >= BIG_CHANGE
  const valueImpact = diff * (sku?.cost ?? 0)

  const pickType = (t: AdjustmentType) => {
    setType(t)
    setReason((r) => (REASONS[t].includes(r) ? r : REASONS[t][0]))
    setErr("")
  }

  const startCount = () => { setType("set"); setReason("Recount"); setQty(before); setErr("") }

  const apply = async () => {
    if (!sku) { setErr("Choose a product."); return }
    if (!loc) { setErr("Choose a warehouse."); return }
    if (type !== "set" && qty <= 0) { setErr("Enter a quantity greater than 0."); return }
    if (type === "decrease" && qty > before) { setErr(`Only ${before} in stock at ${locName}.`); return }
    if (diff === 0) { setErr("No quantity changed."); return }
    if (reason === "Other" && !note.trim()) { setErr("Add a note explaining the reason."); return }
    setBusy(true); setErr("")
    try {
      await adjustmentApi.create({
        productId: sku.productId, variantId: sku.variantId, locationId: Number(loc),
        type, quantity: qty, reason, note: note.trim() || undefined,
      })
      toast({ title: "Adjustment applied", description: `${sku.label}: ${before} → ${after}` })
      setQty(1); setNote("")
      await Promise.all([loadForm(), loadLog()])
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not apply the adjustment.")
    } finally {
      setBusy(false)
    }
  }


  const handleExport = () => {
    exportToCSV(
      log.map((g) => ({
        no: g.number, date: g.createdAt ?? "", product: g.productName + (g.variantName ? ` · ${g.variantName}` : ""), warehouse: g.locationName ?? "",
        type: g.type, change: g.delta, before: g.before, after: g.after, reason: g.reason, note: g.note ?? "", by: g.createdBy ?? "",
      })),
      "stock-adjustments", ["no", "date", "product", "warehouse", "type", "change", "before", "after", "reason", "note", "by"],
    )
  }

  const productOptions = useMemo(
    () => skus.map((s) => ({ key: s.key, label: `${s.label} — ${s.byLoc[Number(loc)] ?? 0} in stock` })),
    [skus, loc],
  )

  if (blocked) return blocked

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Stock adjustment</h1>
          <p className="mt-1 text-sm text-dash-muted">Fix stock counts with a reason, so every change can be explained later.</p>
        </div>
        <button type="button" onClick={startCount} className={outlineBtn}>Start full stock count</button>
      </div>

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <section className="w-full shrink-0 rounded-[14px] border border-dash-border bg-dash-card p-5 xl:w-[460px]">
          <h2 className="font-dash-display text-lg font-bold">New adjustment</h2>
          <p className="mb-4 text-[13px] text-dash-muted">Correct stock after a count, damage or loss. Every change is logged.</p>

          {loadingForm ? (
            <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Warehouse
                <select className={input} value={loc} onChange={(e) => { setLoc(e.target.value); setErr("") }}>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Product
                <select className={input} value={skuKey} onChange={(e) => { setSkuKey(e.target.value); setErr("") }}>
                  <option value="">Select a product</option>
                  {productOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </label>

              <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Change type
                <div role="radiogroup" aria-label="Adjustment type" className="grid grid-cols-3 gap-2">
                  {TYPES.map((t) => (
                    <button key={t.id} type="button" role="radio" aria-checked={type === t.id} onClick={() => pickType(t.id)}
                      className={cn("flex flex-col items-center rounded-[10px] border-2 px-2 py-2.5 text-[13px] font-semibold",
                        type === t.id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>
                      {t.label}
                      <span className="text-[11px] font-normal opacity-80">{t.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">{type === "set" ? "Counted quantity" : "Quantity"}
                  <input type="number" min={0} className={input} value={qty} onChange={(e) => { setQty(Math.max(0, Math.floor(Number(e.target.value)) || 0)); setErr("") }} />
                </label>
                <div className="flex items-center gap-2 rounded-[10px] bg-dash-neutral-soft px-3 py-2 text-[13px]">
                  <span className="flex flex-col"><span className="text-[11px] text-dash-muted">Now</span><strong className="tabular-nums">{before}</strong></span>
                  <span aria-hidden>→</span>
                  <span className="flex flex-col"><span className="text-[11px] text-dash-muted">After</span><strong className="tabular-nums">{after}</strong></span>
                  <span className={cn("font-bold tabular-nums", diff > 0 ? "text-dash-success-fg" : diff < 0 ? "text-dash-danger-fg" : "text-dash-neutral-fg")}>{sign(diff)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Reason
                <div className="flex flex-wrap gap-1.5">
                  {REASONS[type].map((r) => (
                    <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}
                      className={cn("h-9 rounded-full border px-3 text-[13px] font-semibold",
                        reason === r ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Note
                <textarea rows={2} className={cn(input, "h-auto py-2.5")} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 pieces torn during unpacking" />
              </label>

              {bigChange && (
                <div className="rounded-[10px] bg-dash-warn-soft px-3 py-2.5 text-[13px] text-dash-warn-fg">
                  This is a large change ({sign(diff)}). It will be flagged for owner review.
                </div>
              )}
              {err && <p role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{err}</p>}

              <div className="flex items-center justify-between gap-3 border-t border-dash-border-soft pt-3">
                <span className="text-[13px] text-dash-muted">Value impact <strong className="text-dash-ink tabular-nums">{valueImpact < 0 ? "−" : "+"}{formatCurrency(Math.abs(valueImpact))}</strong></span>
                <button type="button" disabled={busy} onClick={apply} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
                  {busy ? "Applying…" : "Apply adjustment"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="w-full min-w-0 flex-1 rounded-[14px] border border-dash-border bg-dash-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-dash-display text-lg font-bold">Audit trail</h2>
            <div className="flex gap-2">
              <select aria-label="Filter by reason" value={reasonFilter} onChange={(e) => { setReasonFilter(e.target.value); setPage(1) }} className={cn(input, "h-10 w-[170px] font-semibold")}>
                <option value="all">Reason: All</option>
                {reasonOpts.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="button" onClick={handleExport} className={cn(outlineBtn, "h-10")}><Download className="size-4" aria-hidden /> Export</button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-[10px] bg-dash-success-soft px-3 py-2.5 text-dash-success-fg"><div className="text-[11px]">Added (30d)</div><div className="font-dash-display text-lg font-bold tabular-nums">+{stats.added30d}</div></div>
            <div className="rounded-[10px] bg-dash-danger-soft px-3 py-2.5 text-dash-danger-fg"><div className="text-[11px]">Removed (30d)</div><div className="font-dash-display text-lg font-bold tabular-nums">{stats.removed30d ? `−${stats.removed30d}` : "0"}</div></div>
            <div className="rounded-[10px] bg-dash-neutral-soft px-3 py-2.5"><div className="text-[11px] text-dash-muted">Shrinkage value</div><div className="font-dash-display text-lg font-bold tabular-nums">{formatCurrency(stats.shrinkageValue30d)}</div></div>
          </div>

          {logLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : log.length === 0 ? (
            <div className="py-12 text-center text-sm text-dash-muted">No adjustments yet.</div>
          ) : (
            <div className="flex flex-col">
              {log.map((g) => (
                <div key={g.id} className="flex items-center gap-3 border-b border-dash-border-soft py-3 last:border-0">
                  <span className={cn("flex h-9 min-w-[48px] items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums",
                    g.delta > 0 ? "bg-dash-success-soft text-dash-success-fg" : g.delta < 0 ? "bg-dash-danger-soft text-dash-danger-fg" : "bg-dash-neutral-soft text-dash-neutral-fg")}>
                    {sign(g.delta)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      <span className="mr-2 text-xs font-bold text-dash-muted">{g.number}</span>
                      {g.productName}{g.variantName ? ` · ${g.variantName}` : ""}
                      {g.flagged && <span className="ml-2 rounded-full bg-dash-warn-soft px-2 py-px text-[11px] font-bold text-dash-warn-fg">Flagged</span>}
                    </div>
                    <div className="truncate text-xs text-dash-muted">{g.locationName ?? "—"} · {g.reason}{g.note ? ` (${g.note})` : ""}{g.before !== null && g.after !== null ? ` · ${g.before} → ${g.after}` : ""}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[13px]">{g.createdAt ? new Date(g.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}{g.createdAt ? ` · ${new Date(g.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}</div>
                    <div className="text-xs text-dash-muted">{g.createdBy ?? "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!logLoading && total > 0 && (
            <div className="mt-3 border-t border-dash-border-soft pt-3">
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
      </div>
    </div>
  )
}
