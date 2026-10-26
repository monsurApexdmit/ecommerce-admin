"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeftRight, BarChart3, Banknote, Boxes, ClipboardList, Download, Eye, Pencil, Search, Upload, X, AlertTriangle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import inventoryApi, { type StockHealth, type StockOverview, type StockRow } from "@/lib/inventoryApi"
import adjustmentApi from "@/lib/adjustmentApi"
import { exportToCSV, parseCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Tab = "all" | "attention" | "ok" | "low" | "out" | "over"

const HEALTH: Record<StockHealth, { label: string; cls: string }> = {
  ok: { label: "Healthy", cls: "bg-dash-success-soft text-dash-success-fg" },
  low: { label: "Low", cls: "bg-dash-warn-soft text-dash-warn-fg" },
  out: { label: "Out of stock", cls: "bg-dash-danger-soft text-dash-danger-fg" },
  over: { label: "Overstock", cls: "bg-dash-neutral-soft text-dash-neutral-fg" },
}
const QUICK_REASONS = ["Correction", "Damaged", "Lost", "Found", "Stock count"]

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const filterSelect = "h-11 rounded-[10px] border-dash-border bg-dash-card text-[13px] font-semibold"

export default function InventoryPage() {
  return <Suspense fallback={null}><InventoryInner /></Suspense>
}

function InventoryInner() {
  const searchParams = useSearchParams()
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const blocked = useModuleGuard("Inventory")

  const [data, setData] = useState<StockOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const stockParam = searchParams.get("stock")
  const [tab, setTab] = useState<Tab>((["attention", "ok", "low", "out", "over"] as const).find((t) => t === stockParam) ?? "all")
  const [search, setSearch] = useState("")
  const [debounced, setDebounced] = useState("")
  const [loc, setLoc] = useState("all")
  const [cat, setCat] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const [adj, setAdj] = useState<StockRow | null>(null)
  const [adjLoc, setAdjLoc] = useState("")
  const [adjQty, setAdjQty] = useState("")
  const [adjReason, setAdjReason] = useState(QUICK_REASONS[0])
  const [adjErr, setAdjErr] = useState("")
  const [adjBusy, setAdjBusy] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    try {
      setData(await inventoryApi.getOverview({
        search: debounced || undefined,
        location_id: loc !== "all" ? Number(loc) : undefined,
        category_id: cat !== "all" ? Number(cat) : undefined,
      }))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [debounced, loc, cat])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    const all = data?.items ?? []
    if (tab === "all") return all
    return all.filter((r) => (tab === "attention" ? r.health === "low" || r.health === "out" : r.health === tab))
  }, [data, tab])

  const pageRows = rows.slice((page - 1) * perPage, page * perPage)
  const locations = data?.locations ?? []
  const shownLocations = loc === "all" ? locations : locations.filter((l) => String(l.id) === loc)
  const key = (r: StockRow) => `${r.type}-${r.id}`
  const selectable = (r: StockRow) => r.type === "product" || !!r.productId
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(key(r)))
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map(key)))
  const toggleOne = (k: string) => setChecked((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })
  const selectedRows = rows.filter((r) => checked.has(key(r)))

  const changeTab = (t: string) => { setTab(t as Tab); setPage(1); setChecked(new Set()) }

  const openAdjust = (r: StockRow) => {
    const def = locations.find((l) => l.isDefault) ?? locations[0]
    setAdj(r)
    setAdjLoc(loc !== "all" ? loc : def ? String(def.id) : "")
    setAdjQty("")
    setAdjReason(QUICK_REASONS[0])
    setAdjErr("")
  }
  const onAdjLoc = (v: string) => {
    setAdjLoc(v)
    setAdjQty("")
    setAdjErr("")
  }
  const currentQty = adj?.locations.find((l) => String(l.locationId) === adjLoc)?.quantity ?? 0

  const applyAdjust = async () => {
    if (!adj) return
    const qty = Number(adjQty)
    if (!adjLoc) { setAdjErr("Choose a location."); return }
    if (adjQty.trim() === "" || !Number.isInteger(qty) || qty < 0) { setAdjErr("Enter a whole number, 0 or more."); return }
    if (qty === currentQty) { setAdjErr("Quantity is unchanged."); return }
    setAdjBusy(true); setAdjErr("")
    try {
      await adjustmentApi.create({
        productId: adj.productId,
        variantId: adj.type === "variant" ? adj.id : null,
        locationId: Number(adjLoc),
        type: "set",
        quantity: qty,
        reason: adjReason,
      })
      toast({ title: "Stock adjusted", description: `${adj.name}${adj.variantName ? ` · ${adj.variantName}` : ""}: ${currentQty} → ${qty}` })
      setAdj(null)
      load()
    } catch (e: any) {
      setAdjErr(e?.response?.data?.message || "Could not adjust the stock.")
    } finally {
      setAdjBusy(false)
    }
  }

  const handleExport = () => {
    const flat = rows.flatMap((r) => (r.variants?.length ? r.variants : [r]))
    exportToCSV(
      flat.map((r) => ({
        name: r.name, variant: r.variantName ?? "", sku: r.sku, barcode: r.barcode ?? "", category: r.categoryName ?? "",
        ...Object.fromEntries(locations.map((l) => [l.name, r.locations.find((x) => x.locationId === l.id)?.quantity ?? 0])),
        onHand: r.onHand, reserved: r.reserved, available: r.available, reorderAt: r.reorderPoint, health: HEALTH[r.health].label, unitCost: r.cost, value: r.value,
      })),
      "stock-overview",
      ["name", "variant", "sku", "barcode", "category", ...locations.map((l) => l.name), "onHand", "reserved", "available", "reorderAt", "health", "unitCost", "value"],
    )
    toast({ title: `Exported ${flat.length} SKUs` })
  }

  const handleImport = () => {
    const el = document.createElement("input")
    el.type = "file"
    el.accept = ".csv"
    el.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const parsed = parseCSV(ev.target?.result as string)
        const bySku = new Map<string, StockRow>()
        ;(data?.items ?? []).forEach((r) => (r.variants?.length ? r.variants : [r]).forEach((x) => x.sku && bySku.set(x.sku.toLowerCase(), x)))
        let done = 0
        let skipped = 0
        let unchanged = 0
        for (const row of parsed) {
          const sku = (row.sku ?? "").trim().toLowerCase()
          const raw = row.total_stock ?? row["total stock"] ?? row["on hand"] ?? row.onhand ?? row.onHand ?? row.stock ?? row.quantity ?? row.qty ?? ""
          const qty = String(raw).trim() === "" ? NaN : Number(raw)
          const target = bySku.get(sku)
          const where = locations.find((l) => l.name.toLowerCase() === (row.location ?? row.warehouse ?? "").toLowerCase())
            ?? locations.find((l) => String(l.id) === loc)
            ?? locations.find((l) => l.isDefault)
            ?? locations[0]
          if (!target || !where || !Number.isInteger(qty) || qty < 0) { skipped++; continue }
          if ((target.locations.find((x) => x.locationId === where.id)?.quantity ?? 0) === qty) { unchanged++; continue }
          try {
            await adjustmentApi.create({
              productId: target.productId, variantId: target.type === "variant" ? target.id : null,
              locationId: where.id, type: "set", quantity: qty, reason: "Stock count",
            })
            done++
          } catch { skipped++ }
        }
        toast({ title: `Updated ${done} SKU${done === 1 ? "" : "s"}`, description: [skipped ? `${skipped} row${skipped === 1 ? "" : "s"} skipped (unknown SKU, bad quantity or error)` : "", unchanged ? `${unchanged} unchanged` : "", !skipped && !unchanged ? "CSV needs sku and total_stock columns (location optional)" : ""].filter(Boolean).join(" · ") })
        load()
      }
      reader.readAsText(file)
    }
    el.click()
  }

  if (blocked) return blocked

  const s = data?.stats
  const reorderHref = `/dashboard/vendors/purchase-orders?new=1&items=${encodeURIComponent(
    selectedRows.map((r) => `${r.productId}:${Math.max(r.reorderPoint * 2 - r.onHand, 1)}`).join(","),
  )}`

  const renderRow = (r: StockRow, nested = false) => {
    const k = key(r)
    const h = HEALTH[r.health]
    const hasVariants = !nested && (r.variants?.length ?? 0) > 0
    const open = expanded.has(k)
    return (
      <tr key={k} className={cn(nested && "bg-dash-bg/60", checked.has(k) && "bg-dash-accent-soft/40")}>
        <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
          {!nested && selectable(r) && <Checkbox checked={checked.has(k)} onCheckedChange={() => toggleOne(k)} aria-label={`Select ${r.name}`} />}
        </td>
        <td className={cn("border-b border-dash-border-soft px-2 py-3", nested && "pl-8")}>
          <div className="flex items-center gap-2">
            <span className="flex flex-col">
              <span className="font-semibold">
                {nested ? r.variantName : r.name}
                {hasVariants && <span className="ml-1.5 text-xs font-normal text-dash-muted">{r.variants!.length} variants</span>}
              </span>
              <span className="text-xs text-dash-muted">{r.sku || "—"}</span>
            </span>
            {hasVariants && (
              <button type="button" aria-expanded={open} onClick={() => setExpanded((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })}
                className="rounded-md border border-dash-border px-2 py-0.5 text-xs font-semibold hover:bg-dash-neutral-soft">
                {open ? "Hide" : "Show"}
              </button>
            )}
          </div>
        </td>
        {shownLocations.map((l) => (
          <td key={l.id} className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">
            {r.locations.find((x) => x.locationId === l.id)?.quantity ?? 0}
          </td>
        ))}
        <td className="border-b border-dash-border-soft px-2 py-3 text-right font-bold tabular-nums">{r.onHand}</td>
        <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums text-dash-muted">{r.reserved}</td>
        <td className="border-b border-dash-border-soft px-2 py-3 text-right font-semibold tabular-nums">{r.available}</td>
        <td className="border-b border-dash-border-soft px-2 py-3">
          <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", h.cls)}>{h.label}</span>
          <div className="mt-0.5 text-xs text-dash-muted">Reorder at {r.reorderPoint}</div>
        </td>
        <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">{formatCurrency(r.value)}</td>
        <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
          <div className="flex justify-end gap-1">
            {!hasVariants && <button type="button" aria-label={`Adjust ${r.name}`} className={iconBtn} onClick={() => openAdjust(r)}><Pencil className="size-4" /></button>}
            <Link href="/dashboard/inventory/transfer" aria-label="Transfer" className={iconBtn}><ArrowLeftRight className="size-4" /></Link>
            <Link href="/dashboard/inventory/adjustment" aria-label="Stock history" className={iconBtn}><ClipboardList className="size-4" /></Link>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Stock overview</h1>
          <p className="mt-1 text-sm text-dash-muted">How much you have, where it is, and what needs attention.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleImport} className={outlineBtn}><Upload className="size-4" aria-hidden /> Import CSV</button>
          <button type="button" onClick={handleExport} className={outlineBtn}><Download className="size-4" aria-hidden /> Export CSV</button>
          <Link href="/dashboard/inventory/adjustment" className={outlineBtn}>Adjust stock</Link>
          <Link href="/dashboard/inventory/transfer" className="inline-flex h-11 items-center rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">Transfer stock</Link>
        </div>
      </div>

      {loading || !s ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[118px] rounded-[14px]" />)}
        </div>
      ) : (
        <StatsCards stats={[
          { label: "SKUs tracked", value: s.skus, icon: <Boxes className="size-4" />, color: "blue", hint: `${s.categories} categories` },
          { label: "Units on hand", value: s.units, icon: <BarChart3 className="size-4" />, color: "purple", hint: `${s.reserved} reserved for orders` },
          { label: "Stock value", value: formatCurrency(s.stockValue), icon: <Banknote className="size-4" />, color: "green", hint: "At cost price" },
          { label: "Published", value: s.published, icon: <Eye className="size-4" />, color: "blue", hint: `${s.unpublished} unpublished` },
          { label: "Low stock", value: s.low, icon: <AlertTriangle className="size-4" />, color: "yellow", hint: "At or below reorder level", onClick: () => changeTab("low"), active: tab === "low" },
          { label: "Out of stock", value: s.out, icon: <X className="size-4" />, color: "red", hint: "Needs restocking", onClick: () => changeTab("out"), active: tab === "out" },
        ]} />
      )}

      <section className="rounded-[14px] border border-dash-border bg-dash-card">
        <div className="px-4">
          <StatusTabs
            value={tab}
            onChange={changeTab}
            tabs={[
              { value: "all", label: "All", count: data?.counts.all },
              { value: "attention", label: "Needs attention", count: data?.counts.attention },
              { value: "ok", label: "Healthy", count: data?.counts.ok },
              { value: "low", label: "Low", count: data?.counts.low },
              { value: "out", label: "Out of stock", count: data?.counts.out },
              { value: "over", label: "Overstock", count: data?.counts.over },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden />
            <span className="sr-only">Search stock</span>
            <input type="search" placeholder="Search name, SKU or scan barcode…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          <Select value={loc} onValueChange={(v) => { setLoc(v); setPage(1) }}>
            <SelectTrigger aria-label="Warehouse" className={cn(filterSelect, "w-[170px]")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Warehouse: All</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={(v) => { setCat(v); setPage(1) }}>
            <SelectTrigger aria-label="Category" className={cn(filterSelect, "w-[170px]")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Category: All</SelectItem>
              {(data?.categories ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {selectedRows.length > 0 && (
          <div className="mx-4 mb-3 flex flex-wrap items-center gap-2.5 rounded-[10px] bg-dash-ink px-3.5 py-2.5 text-dash-bg">
            <span className="text-sm font-semibold">{selectedRows.length} selected</span>
            <Link href="/dashboard/inventory/transfer" className="inline-flex h-9 items-center rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Transfer</Link>
            <Link href="/dashboard/inventory/adjustment" className="inline-flex h-9 items-center rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Adjust</Link>
            <Link href={reorderHref} className="inline-flex h-9 items-center rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Reorder</Link>
            <Link href="/dashboard/products/print-barcode" className="inline-flex h-9 items-center rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Print labels</Link>
            <button type="button" onClick={() => setChecked(new Set())} className="ml-auto h-9 px-3 text-[13px] font-semibold opacity-80 hover:opacity-100">Clear</button>
          </div>
        )}

        {adj && (
          <div className="mx-4 mb-3 grid gap-3 rounded-xl border border-dash-border bg-dash-bg p-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-dash-muted">Quick adjust</div>
              <div className="font-semibold">{adj.name}{adj.variantName ? ` · ${adj.variantName}` : ""}</div>
              <div className="text-xs text-dash-muted">Current: {currentQty}</div>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Location
              <select className={input} value={adjLoc} onChange={(e) => onAdjLoc(e.target.value)}>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">New quantity
              <input type="number" min={0} step={1} inputMode="numeric" className={input} value={adjQty} placeholder={String(currentQty)}
                onChange={(e) => { setAdjQty(e.target.value); setAdjErr("") }} />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Reason
              <select className={input} value={adjReason} onChange={(e) => setAdjReason(e.target.value)}>
                {QUICK_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button type="button" disabled={adjBusy} onClick={applyAdjust} className="h-[42px] rounded-[10px] bg-dash-accent px-4 text-[13px] font-semibold text-white disabled:opacity-40">Apply</button>
              <button type="button" onClick={() => setAdj(null)} className="h-[42px] rounded-[10px] border border-dash-border bg-dash-card px-4 text-[13px] font-semibold">Cancel</button>
            </div>
            {adjErr && <p role="alert" className="text-[13px] font-semibold text-dash-danger-fg sm:col-span-2 lg:col-span-5">{adjErr}</p>}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                <th scope="col" className="w-5 py-3 pl-4 pr-2"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" /></th>
                <th scope="col" className="px-2 py-3 font-semibold">Product</th>
                {shownLocations.map((l) => <th key={l.id} scope="col" className="px-2 py-3 text-right font-semibold">{l.name}</th>)}
                <th scope="col" className="px-2 py-3 text-right font-semibold">On hand</th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">Reserved</th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">Available</th>
                <th scope="col" className="px-2 py-3 font-semibold">Health</th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">Value</th>
                <th scope="col" className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={9 + shownLocations.length} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>)
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9 + shownLocations.length} className="py-14 text-center">
                    <Boxes className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                    <p className="font-semibold">No stock found</p>
                    <p className="text-sm text-dash-muted">{search || tab !== "all" || loc !== "all" || cat !== "all" ? "Try clearing the search or filters." : "Add products to start tracking stock."}</p>
                  </td>
                </tr>
              ) : (
                pageRows.flatMap((r) => [renderRow(r), ...(expanded.has(key(r)) ? (r.variants ?? []).map((v) => renderRow(v, true)) : [])])
              )}
            </tbody>
          </table>
        </div>

        {!loading && rows.length > 0 && (
          <div className="border-t border-dash-border-soft p-4 pt-3">
            <PaginationControl
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(rows.length / perPage))}
              itemsPerPage={perPage}
              totalItems={rows.length}
              onPageChange={setPage}
              onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
            />
          </div>
        )}
        <div className="border-t border-dash-border-soft px-4 py-3 text-xs text-dash-muted">
          {rows.length} of {data?.counts.all ?? 0} SKUs across {locations.length} location{locations.length === 1 ? "" : "s"} · Reserved = held by unshipped orders
        </div>
      </section>
    </div>
  )
}
