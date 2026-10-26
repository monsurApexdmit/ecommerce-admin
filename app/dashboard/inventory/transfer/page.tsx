"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import transferApi, { type LocationProduct, type TransferDocument } from "@/lib/transferApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const REASONS = ["Restock store", "Rebalance stock", "Customer order pickup", "Return to warehouse"]

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"

interface Line { key: string; productId: number; variantId: number | null; name: string; avail: number; qty: number }

export default function TransferPage() {
  const { warehouses } = useWarehouse()
  const { toast } = useToast()
  const blocked = useModuleGuard("Transfers")

  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [q, setQ] = useState("")
  const [stock, setStock] = useState<LocationProduct[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [reason, setReason] = useState(REASONS[0])
  const [sentWith, setSentWith] = useState("")
  const [note, setNote] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const [history, setHistory] = useState<TransferDocument[]>([])
  const [stats, setStats] = useState({ count: 0, unitsMoved: 0 })
  const [total, setTotal] = useState(0)
  const [histLoading, setHistLoading] = useState(true)
  const [hq, setHq] = useState("")
  const [hqDebounced, setHqDebounced] = useState("")
  const [statusF, setStatusF] = useState("all")
  const [locF, setLocF] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [open, setOpen] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (warehouses.length === 0) return
    const def = warehouses.find((w) => w.isDefault) ?? warehouses[0]
    setFrom((f) => f || String(def.id))
    setTo((t) => t || String((warehouses.find((w) => w.id !== def.id) ?? def).id))
  }, [warehouses])

  useEffect(() => {
    const t = setTimeout(() => setHqDebounced(hq.trim()), 250)
    return () => clearTimeout(t)
  }, [hq])

  const loadStock = useCallback(async () => {
    if (!from) return
    setStockLoading(true)
    try {
      const res = await transferApi.getProductsByLocation(Number(from))
      const flat: LocationProduct[] = (res.data ?? []).flatMap((p): LocationProduct[] =>
        p.variants?.length
          ? p.variants.map((v) => ({ type: "variant" as const, id: v.id, productId: p.id, productName: p.name, variantName: v.name, sku: v.sku, stock: v.stock }))
          : [{ type: "product" as const, id: p.id, productId: p.id, productName: p.name, sku: p.sku, stock: p.stock }],
      )
      setStock(flat.filter((x) => x.stock > 0))
    } catch {
      setStock([])
    } finally {
      setStockLoading(false)
    }
  }, [from])

  useEffect(() => { loadStock() }, [loadStock])

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    try {
      const res = await transferApi.getDocuments({
        search: hqDebounced || undefined,
        status: statusF !== "all" ? statusF : undefined,
        location_id: locF !== "all" ? Number(locF) : undefined,
        page, per_page: perPage,
      })
      setHistory(res.data)
      setStats(res.stats)
      setTotal(res.total)
    } catch {
      setHistory([])
    } finally {
      setHistLoading(false)
    }
  }, [hqDebounced, statusF, locF, page, perPage])

  useEffect(() => { loadHistory() }, [loadHistory])

  const nameOf = (id: string) => warehouses.find((w) => String(w.id) === id)?.name ?? "—"
  const fromName = nameOf(from)

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return stock
      .filter((s) => !lines.some((l) => l.productId === s.productId && l.variantId === (s.type === "variant" ? s.id : null)))
      .filter((s) => `${s.productName} ${s.variantName ?? ""} ${s.sku}`.toLowerCase().includes(term))
      .slice(0, 6)
  }, [q, stock, lines])
  const noResults = q.trim() !== "" && results.length === 0

  const units = lines.reduce((a, l) => a + l.qty, 0)

  const swap = () => { setFrom(to); setTo(from); setLines([]); setErr("") }
  const changeFrom = (v: string) => { setFrom(v); setLines([]); setErr("") }

  const addLine = (s: LocationProduct) => {
    setLines((ls) => [...ls, {
      key: `${s.type}-${s.id}`, productId: s.productId, variantId: s.type === "variant" ? s.id : null,
      name: s.variantName ? `${s.productName} · ${s.variantName}` : s.productName, avail: s.stock, qty: 1,
    }])
    setQ("")
    setErr("")
  }
  const setQty = (key: string, v: number) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.min(l.avail, Math.floor(v) || 1)) } : l)))

  const submit = async () => {
    if (!from || !to) { setErr("Choose both locations."); return }
    if (from === to) { setErr("From and To must be different locations."); return }
    if (lines.length === 0) { setErr("Add at least one product."); return }
    setBusy(true); setErr("")
    try {
      const doc = await transferApi.createDocument({
        fromLocationId: Number(from), toLocationId: Number(to), reason,
        sentWith: sentWith.trim() || undefined, note: note.trim() || undefined,
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId ?? undefined, quantity: l.qty })),
      })
      toast({ title: `Transfer ${doc.transferNo} done`, description: `${units} units moved to ${nameOf(to)}` })
      setLines([]); setSentWith(""); setNote("")
      setPage(1)
      await Promise.all([loadStock(), loadHistory()])
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not complete the transfer.")
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (t: TransferDocument) => {
    if (!window.confirm(`Cancel ${t.transferNo} and return ${t.units} units to ${t.from.name}?`)) return
    try {
      await transferApi.cancelDocument(t.id)
      toast({ title: `${t.transferNo} cancelled`, description: "Stock returned to the source location" })
      await Promise.all([loadStock(), loadHistory()])
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not cancel", description: e?.response?.data?.message })
    }
  }

  const cycleLoc = () => {
    const opts = ["all", ...warehouses.map((w) => String(w.id))]
    setLocF(opts[(opts.indexOf(locF) + 1) % opts.length])
    setPage(1)
  }

  const handleExport = () => {
    const rows = history.flatMap((t) => {
      const base = {
        no: t.transferNo, date: t.createdAt, from: t.from.name, to: t.to.name,
        reason: t.reason, sentWith: t.sentWith ?? "", status: t.isReversal ? "reversal" : t.status,
        note: [t.reversedBy ? `Returned via ${t.reversedBy}` : "", t.note ?? ""].filter(Boolean).join(" · "), by: t.createdBy ?? "",
      }
      return t.lines.length
        ? t.lines.map((l) => ({ ...base, product: l.name, quantity: l.quantity }))
        : [{ ...base, product: "", quantity: t.units }]
    })
    exportToCSV(rows, "stock-transfers", ["no", "date", "from", "to", "product", "quantity", "reason", "sentWith", "status", "note", "by"])
  }

  if (blocked) return blocked

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Stock transfers</h1>
          <p className="mt-1 text-sm text-dash-muted">Move stock between your warehouse and shops.</p>
        </div>
        <button type="button" onClick={handleExport} className={outlineBtn}><Download className="size-4" aria-hidden /> Export</button>
      </div>

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <section className="w-full shrink-0 rounded-[14px] border border-dash-border bg-dash-card p-5 xl:w-[520px]">
          <h2 className="font-dash-display text-lg font-bold">New transfer</h2>
          <p className="mb-4 text-[13px] text-dash-muted">Move stock between locations. Stock moves immediately and is logged in the history.</p>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">From
                <select className={input} value={from} onChange={(e) => changeFrom(e.target.value)}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={swap} aria-label="Swap locations" className="flex size-[42px] items-center justify-center rounded-[10px] border border-dash-border bg-dash-card hover:bg-dash-neutral-soft">⇄</button>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">To
                <select className={input} value={to} onChange={(e) => { setTo(e.target.value); setErr("") }}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
            </div>

            <div className="flex flex-col gap-2 text-[13px] font-semibold">
              Products
              <label className="flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
                <span className="sr-only">Search products</span>
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search or scan a product in ${fromName}…`}
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm font-normal text-dash-ink outline-none placeholder:text-dash-muted" />
              </label>
              {results.length > 0 && (
                <div className="flex flex-col overflow-hidden rounded-xl border border-dash-border">
                  {results.map((r) => (
                    <button key={`${r.type}-${r.id}`} type="button" onClick={() => addLine(r)}
                      className="flex items-center justify-between gap-3 border-b border-dash-border-soft px-3 py-2 text-left font-normal last:border-0 hover:bg-dash-neutral-soft">
                      <span className="text-sm font-semibold">{r.variantName ? `${r.productName} · ${r.variantName}` : r.productName}</span>
                      <span className="text-xs text-dash-muted">{r.stock} available</span>
                    </button>
                  ))}
                </div>
              )}
              {noResults && !stockLoading && <div className="text-xs font-normal text-dash-muted">No matching product with stock in {fromName}.</div>}

              <div className="flex flex-col rounded-xl border border-dash-border">
                {lines.length === 0 ? (
                  <div className="px-3 py-5 text-center text-[13px] font-normal text-dash-muted">Add products to move.</div>
                ) : lines.map((l) => (
                  <div key={l.key} className="flex items-center gap-3 border-b border-dash-border-soft px-3 py-2.5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{l.name}</div>
                      <div className="text-xs font-normal text-dash-muted">{l.avail} available in {fromName}</div>
                    </div>
                    <div className="flex items-center">
                      <button type="button" aria-label="Decrease quantity" onClick={() => setQty(l.key, l.qty - 1)} className="h-9 w-8 rounded-l-lg border border-dash-border">−</button>
                      <input type="number" min={1} max={l.avail} aria-label="Quantity" value={l.qty} onChange={(e) => setQty(l.key, Number(e.target.value))}
                        className="h-9 w-14 border-y border-dash-border bg-dash-card text-center text-sm font-normal outline-none" />
                      <button type="button" aria-label="Increase quantity" onClick={() => setQty(l.key, l.qty + 1)} className="h-9 w-8 rounded-r-lg border border-dash-border">+</button>
                    </div>
                    <button type="button" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="text-lg text-dash-muted hover:text-dash-danger-fg">×</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Reason
                <select className={input} value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Sent with
                <input className={input} value={sentWith} onChange={(e) => setSentWith(e.target.value)} placeholder="e.g. Rafiq / van" />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Note
              <textarea rows={2} className={cn(input, "h-auto py-2.5")} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </label>

            {err && <p role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
            <div className="flex items-center justify-between gap-3 border-t border-dash-border-soft pt-3">
              <span className="text-[13px] text-dash-muted">{units} units · {fromName} → {nameOf(to)}</span>
              <button type="button" disabled={lines.length === 0 || busy} onClick={submit} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
                {busy ? "Moving…" : `Move ${units} units now`}
              </button>
            </div>
          </div>
        </section>

        <section className="w-full min-w-0 flex-1 rounded-[14px] border border-dash-border bg-dash-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-dash-display text-lg font-bold">Transfer history</h2>
            <button type="button" onClick={cycleLoc} aria-label="Filter by location" className={cn(outlineBtn, "h-10")}>
              {locF === "all" ? "All locations" : nameOf(locF)} ▾
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-2.5">
            <label className="flex h-11 min-w-[200px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
              <span className="sr-only">Search transfers</span>
              <input type="search" value={hq} onChange={(e) => { setHq(e.target.value); setPage(1) }} placeholder="Search no. or product…"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
            </label>
            <select aria-label="Status" value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1) }} className={cn(input, "w-[160px]")}>
              <option value="all">Status: All</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="mb-3 text-[13px] text-dash-muted">{stats.count} transfer{stats.count === 1 ? "" : "s"} · {stats.unitsMoved} units moved</div>

          {histLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-sm text-dash-muted">{hqDebounced || statusF !== "all" || locF !== "all" ? "No transfers match these filters." : "No transfers yet. Move stock with the form."}</div>
          ) : (
            <div className="flex flex-col gap-3">
              {history.map((t) => {
                const isOpen = open.has(t.id)
                return (
                  <article key={t.id} className="rounded-xl border border-dash-border-soft p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{t.transferNo}</span>
                      <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", t.status === "completed" ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-danger-soft text-dash-danger-fg")}>
                        {t.status !== "completed" ? "Cancelled" : t.isReversal ? "Reversal" : "Completed"}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm"><strong>{t.from.name}</strong><span aria-hidden>→</span><strong>{t.to.name}</strong></div>
                    <div className="mt-0.5 text-[13px] text-dash-muted">{t.itemsSummary}</div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-dash-muted">
                        {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {[t.reason, t.sentWith && `sent with ${t.sentWith}`, t.reversedBy && `Returned via ${t.reversedBy}`, t.createdBy].filter(Boolean).join(" · ")}
                      </span>
                      <div className="flex gap-2">
                        {t.canCancel && <button type="button" onClick={() => cancel(t)} className="h-8 rounded-lg border border-dash-border px-2.5 text-xs font-semibold text-dash-danger-fg hover:bg-dash-danger-soft">Cancel &amp; return stock</button>}
                        <button type="button" aria-expanded={isOpen} onClick={() => setOpen((p) => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })}
                          className="h-8 rounded-lg border border-dash-border px-2.5 text-xs font-semibold hover:bg-dash-neutral-soft">{isOpen ? "Hide details" : "Details"}</button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-3 flex flex-col gap-1 border-t border-dash-border-soft pt-3 text-[13px]">
                        {t.lines.map((x, i) => <div key={i} className="flex justify-between"><span>{x.name}</span><strong>×{x.quantity}</strong></div>)}
                        <div className="mt-1 text-dash-muted">{[t.sentWith && `Sent with ${t.sentWith}`, t.reversedBy && `Returned via ${t.reversedBy}`, t.note].filter(Boolean).join(" · ") || "No note."}</div>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          {!histLoading && total > 0 && (
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
