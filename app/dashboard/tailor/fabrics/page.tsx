"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Layers, PackagePlus, Pencil, Plus, Scissors, Search, Trash2, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { apiError } from "@/components/tailor/order-ui"
import { tailorApi, type TailorFabricOverview, type TailorFabricRow } from "@/lib/tailorApi"
import vendorApi, { type VendorOverviewRow } from "@/lib/vendorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

type Tab = "all" | "ok" | "low" | "out" | "inactive"

const TYPES = ["Cotton", "Silk", "Linen", "Georgette", "Khadi", "Denim"]
const PATTERNS = ["Plain", "Striped", "Checked", "Printed", "Embroidered", "Textured"]
const COLOURS: [string, string][] = [["White", "#F4F1EA"], ["Beige", "#D9C7A4"], ["Maroon", "#7B1E2B"], ["Navy", "#1F2F5C"], ["Green", "#2F6B4F"], ["Black", "#1A1A1A"]]
const UNITS: [string, string][] = [["m", "Metre (m)"], ["goj", "Goj"], ["gaj", "Gaj"]]

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const filterSelCls = "h-11 rounded-[10px] border border-dash-border bg-dash-card px-2.5 text-[13px] font-semibold outline-none"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"

const fmt = (n: number) => String(Math.round(n * 100) / 100)
const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0 }

interface FormState {
  name: string; code: string; type: string; pattern: string; color: string; hex: string
  stock: string; rop: string; buy: string; sell: string; vendorId: string; unit: string; status: "active" | "inactive"
}
const blankForm = (): FormState => ({
  name: "", code: "", type: "Cotton", pattern: "Plain", color: "White", hex: "#F4F1EA",
  stock: "", rop: "", buy: "", sell: "", vendorId: "", unit: "m", status: "active",
})
const fromRow = (r: TailorFabricRow): FormState => ({
  name: r.name, code: r.code ?? "", type: r.fabricType || "Cotton", pattern: r.pattern || "Plain", color: r.color ?? "", hex: r.hexColor || "#E3E6EE",
  stock: String(r.stockQuantity ?? ""), rop: String(r.reorderLevel ?? ""), buy: String(r.purchasePrice ?? ""), sell: String(r.sellingPrice ?? ""),
  vendorId: r.vendorId ? String(r.vendorId) : "", unit: r.unit || "m", status: r.status,
})

const barColor: Record<string, string> = { out: "#B42318", low: "#F59E0B", inactive: "#9AA3B5", ok: "#0F766E" }

function csvCell(v: unknown) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export default function TailorFabricsPage() {
  const { formatCurrency } = useCompanySettings()
  const { canWrite, canDelete } = useSaasAuth()
  const blocked = useModuleGuard("TailorFabrics")
  const mayWrite = canWrite("TailorFabrics")
  const mayDelete = canDelete("TailorFabrics")

  const [ov, setOv] = useState<TailorFabricOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [vendors, setVendors] = useState<VendorOverviewRow[]>([])

  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [fType, setFType] = useState("all")
  const [fSup, setFSup] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [form, setForm] = useState<FormState>(blankForm())
  const [editing, setEditing] = useState<TailorFabricRow | null>(null)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  const [restocking, setRestocking] = useState<TailorFabricRow | null>(null)
  const [rQty, setRQty] = useState("")
  const [rSup, setRSup] = useState("")
  const [rErr, setRErr] = useState("")
  const [rSaving, setRSaving] = useState(false)

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 250); return () => clearTimeout(t) }, [q])

  useEffect(() => {
    vendorApi.getOverview({ limit: 500, sort: "name" }).then((r) => setVendors(r.data)).catch(() => {})
  }, [])

  const params = useCallback((p: number, pp: number) => {
    const o: Record<string, any> = { page: p, per_page: pp, tab }
    if (qD) o.search = qD
    if (fType !== "all") o.type = fType
    if (fSup !== "all") o.vendor_id = fSup
    return o
  }, [tab, qD, fType, fSup])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setOv(await tailorApi.getFabricOverview(params(page, perPage)))
    } catch {
      toast.error("Failed to load fabrics")
    } finally {
      setLoading(false)
    }
  }, [params, page, perPage])
  useEffect(() => { load() }, [load])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setForm((f) => ({ ...f, [k]: v })); setErr("") }

  const startEdit = (r: TailorFabricRow | null) => {
    setEditing(r); setErr(""); setRestocking(null)
    setForm(r ? fromRow(r) : blankForm())
  }

  const startRestock = (r: TailorFabricRow) => {
    setRestocking(r); setRQty(""); setRSup(r.vendorId ? String(r.vendorId) : ""); setRErr("")
  }

  const save = async () => {
    const name = form.name.trim()
    if (!name) { setErr("Fabric name is required."); return }
    for (const [k, label] of [["stock", "Opening stock"], ["rop", "Low-stock alert"], ["buy", "Cost price"], ["sell", "Sell price"]] as const) {
      if (form[k] !== "" && !(Number(form[k]) >= 0)) { setErr(`${label} must be a number, 0 or more.`); return }
    }
    const buy = num(form.buy), sell = num(form.sell)
    if (sell > 0 && sell < buy) { setErr("Sell price is below cost price."); return }
    setSaving(true); setErr("")
    try {
      const body = {
        name, code: form.code.trim() || undefined, fabricType: form.type, pattern: form.pattern, color: form.color.trim(), hexColor: form.hex,
        unit: form.unit as "m" | "goj" | "gaj", purchasePrice: buy, sellingPrice: sell, stockQuantity: num(form.stock), reorderLevel: num(form.rop),
        vendorId: (form.vendorId ? Number(form.vendorId) : null) as any, status: form.status,
      }
      if (editing) await tailorApi.updateFabric(editing.id, body)
      else await tailorApi.createFabric(body)
      toast.success(editing ? "Fabric updated" : "Fabric added")
      startEdit(null)
      load()
    } catch (e: any) {
      setErr(apiError(e, "Could not save the fabric."))
    } finally {
      setSaving(false)
    }
  }

  const doRestock = async () => {
    if (!restocking) return
    const qty = num(rQty)
    if (qty <= 0) { setRErr("Enter metres greater than 0."); return }
    setRSaving(true)
    try {
      await tailorApi.restockFabric(restocking.id, { quantity: qty, vendorId: rSup ? Number(rSup) : null })
      toast.success(`Added ${fmt(qty)} ${restocking.unit} to ${restocking.name}`)
      setRestocking(null); setRQty(""); setRErr("")
      load()
    } catch (e: any) {
      setRErr(apiError(e, "Could not add stock."))
    } finally {
      setRSaving(false)
    }
  }

  const remove = async (r: TailorFabricRow) => {
    if (r.ordersCount > 0) { toast.error(`"${r.name}" is used in ${r.ordersCount} tailor order(s) and cannot be deleted.`); return }
    if (!window.confirm(`Delete fabric "${r.name}"?`)) return
    try {
      await tailorApi.deleteFabric(r.id)
      toast.success("Fabric deleted")
      if (editing?.id === r.id) startEdit(null)
      if (restocking?.id === r.id) setRestocking(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not delete")
    }
  }

  const exportCsv = async () => {
    try {
      const rows: TailorFabricRow[] = []
      for (let p = 1; p <= 50; p++) {
        const r = await tailorApi.getFabricOverview(params(p, 100))
        rows.push(...r.data)
        if (rows.length >= r.total || r.data.length === 0) break
      }
      if (!rows.length) { toast.error("Nothing to export"); return }
      const head = ["Name", "Code", "Type", "Colour", "Pattern", "Stock", "Reorder at", "Unit", "Cost / unit", "Sell / unit", "Status", "Supplier"]
      const lines = [head, ...rows.map((r) => [r.name, r.code ?? "", r.fabricType ?? "", r.color ?? "", r.pattern ?? "", r.stockQuantity, r.reorderLevel ?? 0, r.unit, r.purchasePrice, r.sellingPrice, r.status === "inactive" ? "Inactive" : "Active", r.vendorName ?? ""])]
      const blob = new Blob([lines.map((l) => l.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob); a.download = "fabrics.csv"; a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      toast.error("Export failed")
    }
  }

  const typeOptions = useMemo(() => Array.from(new Set([...TYPES, ...(ov?.types ?? []), ...(form.type ? [form.type] : [])])), [ov?.types, form.type])
  const patternOptions = useMemo(() => Array.from(new Set([...PATTERNS, ...(form.pattern ? [form.pattern] : [])])), [form.pattern])

  if (blocked) return blocked

  const st = ov?.stats
  const rows = ov?.data ?? []
  const total = ov?.total ?? 0
  const counts = ov?.counts
  const hasFilter = !!(qD || fType !== "all" || fSup !== "all" || tab !== "all")
  const buyN = num(form.buy), sellN = num(form.sell)
  const unitSuffix = st?.unit ? ` ${st.unit}` : " units"

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Fabric inventory</h1>
          <p className="mt-1 text-sm text-dash-muted">Fabric stock by metre, goj or gaj — cost, stock value and margin.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportCsv} className={outlineBtn}>Export</button>
          <Link href="/dashboard/vendors/purchase-orders" className={outlineBtn}><Plus className="size-4" aria-hidden /> Order fabric</Link>
        </div>
      </div>

      {!st ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px] rounded-[14px]" />)}</div>
      ) : (
        <div className="[&>div]:lg:grid-cols-4">
          <StatsCards stats={[
            { label: "Fabrics", value: st.fabricsCount, icon: <Layers className="size-4" />, color: "blue", hint: `${st.inactiveCount} inactive · ${st.typesCount} type${st.typesCount === 1 ? "" : "s"}` },
            { label: "Stock value", value: formatCurrency(st.stockValue), icon: <Wallet className="size-4" />, color: "green", hint: `${fmt(st.totalStock)}${unitSuffix} at cost` },
            { label: "Low / out", value: st.lowCount, icon: <AlertTriangle className="size-4" />, color: st.lowCount ? "yellow" : "green", hint: st.lowCount ? st.lowNames.join(", ") : "All fabrics healthy" },
            { label: "Used this month", value: `${fmt(st.usedThisMonth)}${st.unit ? ` ${st.unit}` : ""}`, icon: <Scissors className="size-4" />, color: "purple", hint: st.topFabric ? `Mostly ${st.topFabric}` : "No usage yet" },
          ]} />
        </div>
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <section className="w-full min-w-0 flex-1 rounded-[14px] border border-dash-border bg-dash-card">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }} tabs={[
              { value: "all", label: "All", count: counts?.all }, { value: "ok", label: "In stock", count: counts?.ok },
              { value: "low", label: "Low", count: counts?.low }, { value: "out", label: "Out of stock", count: counts?.out },
              { value: "inactive", label: "Inactive", count: counts?.inactive },
            ]} />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
              <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search fabrics</span>
              <input type="search" placeholder="Search fabric, type or colour…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
            </label>
            <select aria-label="Type" className={filterSelCls} value={fType} onChange={(e) => { setFType(e.target.value); setPage(1) }}>
              <option value="all">Type: All</option>{(ov?.types ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select aria-label="Supplier" className={filterSelCls} value={fSup} onChange={(e) => { setFSup(e.target.value); setPage(1) }}>
              <option value="all">Supplier: All</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                  <th className="py-3 pl-4 pr-2 font-semibold">Fabric</th><th className="px-2 py-3 font-semibold">Stock</th>
                  <th className="px-2 py-3 font-semibold">Cost / sell per unit</th><th className="px-2 py-3 font-semibold">Margin</th>
                  <th className="px-2 py-3 font-semibold">Supplier</th><th className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && !ov ? [1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-11 rounded" /></td></tr>) :
                  rows.length === 0 ? (
                    <tr><td colSpan={6} className="py-14 text-center">
                      <Layers className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                      <p className="font-semibold">No fabrics found</p>
                      <p className="text-sm text-dash-muted">{hasFilter ? "No fabrics match the current filters." : "No fabrics yet. Add your first fabric using the form."}</p>
                    </td></tr>
                  ) : rows.map((r) => {
                    const stock = r.stockQuantity, rop = r.reorderLevel ?? 0
                    const w = rop > 0 ? Math.min(100, Math.round((stock / (rop * 3)) * 100)) : stock > 0 ? 100 : 0
                    const sub = [r.fabricType, r.color].filter(Boolean).join(" · ") || "—"
                    const extra = (r.pattern && r.pattern !== "Plain" ? ` · ${r.pattern}` : "") + (r.code ? ` · ${r.code}` : "") + (r.status === "inactive" ? " · Inactive" : "")
                    return (
                      <tr key={r.id} className={editing?.id === r.id || restocking?.id === r.id ? "bg-dash-accent-soft/40" : ""}>
                        <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                          <div className="flex items-center gap-3">
                            <span className="size-8 shrink-0 rounded-lg border border-dash-border" style={{ background: r.hexColor || "#E3E6EE" }} aria-hidden />
                            <span className="min-w-0"><span className="block font-semibold">{r.name}</span><span className="block text-xs text-dash-muted">{sub}{extra}</span></span>
                          </div>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <div className="flex items-baseline gap-2">
                            <strong className={cn("tabular-nums", r.stockState === "out" && "text-dash-danger-fg")}>{r.stockState === "out" ? "Out of stock" : `${fmt(stock)} ${r.unit}`}</strong>
                            <span className="text-xs text-dash-muted">min {fmt(rop)} {r.unit}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-dash-neutral-soft"><div className="h-full rounded-full" style={{ width: `${w}%`, background: barColor[r.stockState] }} /></div>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3 tabular-nums">{formatCurrency(r.purchasePrice)} / <strong>{r.sellingPrice ? formatCurrency(r.sellingPrice) : "—"}</strong></td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <span className="inline-flex rounded-full bg-dash-success-soft px-2.5 py-[3px] text-xs font-bold text-dash-success-fg">{r.marginPct != null ? `${r.marginPct}%` : "—"}</span>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">{r.vendorName ?? "—"}</td>
                        <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                          <div className="flex justify-end gap-1">
                            {mayWrite && <button type="button" aria-label={`Add stock to ${r.name}`} title="Add stock" className={iconBtn} onClick={() => startRestock(r)}><PackagePlus className="size-4" /></button>}
                            {mayWrite && <button type="button" aria-label={`Edit ${r.name}`} className={iconBtn} onClick={() => startEdit(r)}><Pencil className="size-4" /></button>}
                            {mayDelete && <button type="button" aria-label={`Delete ${r.name}`} className={iconBtn} onClick={() => remove(r)}><Trash2 className="size-4" /></button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="p-4 pt-3.5">
              <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            </div>
          )}
        </section>

        <aside aria-label="Fabric form" className="flex w-full shrink-0 flex-col gap-3.5 xl:w-[380px]">
          {restocking && (
            <div className="flex flex-col gap-3.5 rounded-[14px] border border-dash-accent bg-dash-card p-5">
              <div>
                <h2 className="font-dash-display text-lg font-bold">Restock {restocking.name}</h2>
                <span className="text-xs text-dash-muted">Current stock {fmt(restocking.stockQuantity)} {restocking.unit}</span>
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Quantity to add ({restocking.unit}) *
                <input type="number" min={0} step="any" className={input} value={rQty} onChange={(e) => { setRQty(e.target.value); setRErr("") }} placeholder="e.g. 25" autoFocus /></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Supplier (optional)
                <select className={input} value={rSup} onChange={(e) => setRSup(e.target.value)}><option value="">None</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
              {rErr && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{rErr}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setRestocking(null); setRErr("") }} className={outlineBtn}>Cancel</button>
                <button type="button" disabled={rSaving} onClick={doRestock} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">{rSaving ? "Adding…" : "Add stock"}</button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-5">
            <h2 className="font-dash-display text-lg font-bold">{editing ? "Edit fabric" : "Add fabric"}</h2>
            {err && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Fabric name *
              <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Premium cotton" /></label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Type
                <select className={input} value={form.type} onChange={(e) => set("type", e.target.value)}>{typeOptions.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Pattern
                <select className={input} value={form.pattern} onChange={(e) => set("pattern", e.target.value)}>{patternOptions.map((t) => <option key={t}>{t}</option>)}</select></label>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Unit of measure
                <select className={input} value={form.unit} onChange={(e) => set("unit", e.target.value)}>{UNITS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Status
                <select className={input} value={form.status} onChange={(e) => set("status", e.target.value as "active" | "inactive")}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Colour
              <div className="flex flex-wrap items-center gap-2">
                {COLOURS.map(([label, c]) => (
                  <button key={label} type="button" aria-label={label} aria-pressed={form.hex === c} onClick={() => { set("color", label); set("hex", c) }}
                    className={cn("size-8 rounded-full border-2", form.hex === c ? "border-dash-accent ring-2 ring-dash-accent-soft" : "border-white shadow-[0_0_0_1px_var(--dash-border)]")} style={{ background: c }} />
                ))}
                <input aria-label="Colour name" className={cn(input, "w-32 flex-1")} value={form.color} placeholder="Colour name"
                  onChange={(e) => { const v = e.target.value; const m = COLOURS.find((c) => c[0].toLowerCase() === v.trim().toLowerCase()); setForm((f) => ({ ...f, color: m ? m[0] : v, hex: m ? m[1] : f.hex })); setErr("") }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Code
                <input className={input} value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g. FAB-001" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Stock ({form.unit})
                <input type="number" min={0} step="any" className={input} value={form.stock} onChange={(e) => set("stock", e.target.value)} placeholder="0" /></label>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Cost price / {form.unit}
                <input type="number" min={0} step="any" className={input} value={form.buy} onChange={(e) => set("buy", e.target.value)} placeholder="0.00" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Sell price / {form.unit}
                <input type="number" min={0} step="any" className={input} value={form.sell} onChange={(e) => set("sell", e.target.value)} placeholder="0.00" /></label>
            </div>
            <div className="flex items-center justify-between rounded-[10px] bg-dash-neutral-soft px-3 py-2 text-[13px] text-dash-muted">
              <span>Profit per {form.unit} <strong className="text-dash-ink">{formatCurrency(sellN - buyN)}</strong></span>
              <span>margin <strong className="text-dash-ink">{sellN ? `${Math.round(((sellN - buyN) / sellN) * 100)}%` : "—"}</strong></span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Low-stock alert at ({form.unit})
                <input type="number" min={0} step="any" className={input} value={form.rop} onChange={(e) => set("rop", e.target.value)} placeholder="e.g. 10" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Supplier
                <select className={input} value={form.vendorId} onChange={(e) => set("vendorId", e.target.value)}><option value="">None</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => startEdit(null)} className={outlineBtn}>Clear</button>
              {mayWrite && (
                <button type="button" disabled={saving} onClick={save} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
                  {saving ? "Saving…" : editing ? "Save changes" : "Add fabric"}
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
