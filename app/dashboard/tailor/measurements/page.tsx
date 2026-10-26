"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Printer, Search, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControl } from "@/components/ui/pagination-control"
import { AccessDenied } from "@/components/ui/access-denied"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { tailorWorkshopApi, type MeasurementCustomer, type MeasurementSet, type Pagination } from "@/lib/tailorApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { cn } from "@/lib/utils"

const NM: Record<string, string> = {
  shirt: "Shirt", panjabi: "Panjabi", pant: "Pant", blouse: "Blouse", salwar: "Salwar Kameez", coat: "Coat",
  pajama: "Pajama", jama: "Jama", kurta: "Kurta", other: "Other",
}
const F: Record<string, string[]> = {
  blouse: ["Bust", "Waist", "Length", "Shoulder", "Sleeve", "Arm hole", "Front neck", "Back neck"],
  salwar: ["Bust", "Waist", "Hip", "Length", "Sleeve", "Salwar length", "Bottom", "Shoulder"],
  panjabi: ["Chest", "Length", "Shoulder", "Sleeve", "Collar", "Cuff", "Waist", "Hip", "Pajama waist", "Pajama length"],
  pant: ["Waist", "Hip", "Length", "Thigh", "Knee", "Bottom", "Fly", "Inseam"],
  shirt: ["Chest", "Length", "Shoulder", "Sleeve", "Collar", "Cuff", "Waist", "Hip"],
  coat: ["Chest", "Length", "Shoulder", "Sleeve", "Waist", "Hip", "Back", "Neck"],
  pajama: ["Waist", "Hip", "Length", "Thigh", "Bottom", "Inseam"],
  jama: ["Chest", "Waist", "Length", "Shoulder", "Sleeve", "Neck", "Bottom length"],
  kurta: ["Chest", "Waist", "Hip", "Length", "Shoulder", "Sleeve", "Neck", "Bottom"],
  other: ["Chest", "Waist", "Hip", "Shoulder", "Sleeve", "Length", "Neck", "Inseam", "Bottom length"],
}
const key = (l: string) => l.toLowerCase().replace(/\s+/g, "_")
const humanKey = (k: string) => { const t = k.replace(/_/g, " "); return t.charAt(0).toUpperCase() + t.slice(1) }
/** Map a stored product type (e.g. "Pants", "Shalwar Kameez") to a garment id. */
const garmentId = (t: string) => {
  const s = t.trim().toLowerCase()
  if (NM[s]) return s
  if (s === "pants" || s === "trouser") return "pant"
  if (s === "shalwar kameez" || s === "salwar kameez") return "salwar"
  const hit = Object.entries(NM).find(([, n]) => n.toLowerCase() === s)
  return hit ? hit[0] : "other"
}

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"
const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const fmtD = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "never")
const esc = (t: unknown) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

interface Draft {
  garment: string; label: string; values: Record<string, string>; fit: string; notes: string; unit: "in" | "cm"; measuredAt: string
  custom: { k: string; v: string }[]
}
const newDraft = (): Draft => ({ garment: "shirt", label: "", values: {}, fit: "Regular", notes: "", unit: "in", measuredAt: todayIso(), custom: [] })
const draftOf = (m: MeasurementSet): Draft => ({
  garment: garmentId(m.productType), label: m.label, values: Object.fromEntries(Object.entries(m.values).map(([k, v]) => [k, String(v)])),
  fit: m.fitPreference || "Regular", notes: m.notes, unit: m.unit, measuredAt: m.measuredAt || todayIso(),
  custom: Object.entries(m.customFields).map(([k, v]) => ({ k, v: String(v) })),
})
const setLabel = (m: MeasurementSet) => (NM[garmentId(m.productType)] === m.productType || garmentId(m.productType) !== "other" ? NM[garmentId(m.productType)] : m.productType) + (m.label ? ` · ${m.label}` : "")

export default function MeasurementsPage() {
  const { canRead, canWrite } = useSaasAuth()

  const [customers, setCustomers] = useState<MeasurementCustomer[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [selCust, setSelCust] = useState<MeasurementCustomer | null>(null)

  const [sets, setSets] = useState<MeasurementSet[]>([])
  const [setsLoading, setSetsLoading] = useState(false)
  const [selM, setSelM] = useState<number | "new">("new")
  const [draft, setDraft] = useState<Draft>(newDraft())
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)
  const [showHist, setShowHist] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState("")
  const [addPhone, setAddPhone] = useState("")

  useEffect(() => { const t = setTimeout(() => { setQD(q.trim()); setPage(1) }, 250); return () => clearTimeout(t) }, [q])

  const loadCustomers = useCallback(async () => {
    try {
      const r = await tailorWorkshopApi.getMeasurementCustomers({ search: qD || undefined, page, limit: perPage })
      setCustomers(r.rows); setPagination(r.pagination)
      setSelCust((cur) => cur ? (r.rows.find((c) => c.id === cur.id) ?? cur) : (r.rows[0] ?? null))
    } catch {
      toast.error("Failed to load customers")
    } finally {
      setLoading(false)
    }
  }, [qD, page, perPage])
  useEffect(() => { loadCustomers() }, [loadCustomers])

  const loadSets = useCallback(async (customerId: number, select?: number | "new") => {
    setSetsLoading(true)
    try {
      const s = await tailorWorkshopApi.getMeasurementSets(customerId)
      setSets(s)
      setSelM((cur) => select ?? (cur !== "new" && s.some((x) => x.id === cur) ? cur : (s[0]?.id ?? "new")))
    } catch {
      toast.error("Failed to load measurements"); setSets([])
    } finally {
      setSetsLoading(false)
    }
  }, [])
  useEffect(() => { if (selCust) { setShowHist(false); loadSets(selCust.id) } else setSets([]) }, [selCust?.id, loadSets]) // eslint-disable-line react-hooks/exhaustive-deps

  const rec = selM === "new" ? null : sets.find((s) => s.id === selM) ?? null
  // Re-seed the editable draft whenever a different set (or fresh data) is selected.
  useEffect(() => {
    if (setsLoading) return
    if (selM !== "new" && !sets.some((s) => s.id === selM)) { setSelM(sets[0]?.id ?? "new"); return }
    setDraft(rec ? draftOf(rec) : newDraft()); setErr("")
  }, [selM, sets, setsLoading]) // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (p: Partial<Draft>) => { setDraft((d) => ({ ...d, ...p })); setErr("") }

  const baseDefs = (F[draft.garment] ?? []).map((l) => ({ l, k: key(l) }))
  const extraDefs = Object.keys(draft.values).filter((k) => !baseDefs.some((d) => d.k === k)).map((k) => ({ l: humanKey(k), k }))
  const fieldDefs = [...baseDefs, ...extraDefs]
  const prevVals = rec && rec.history.length ? rec.history[rec.history.length - 1].values : null
  const today = todayIso()

  const cleanValues = () => {
    const out: Record<string, number> = {}
    for (const { k } of fieldDefs) { const v = draft.values[k]; if (v !== undefined && v !== "") out[k] = Number(v) }
    return out
  }
  const validate = () => {
    if (!selCust) return "Select a customer first."
    if (!draft.garment) return "Choose a garment type."
    const lim = draft.unit === "cm" ? 500 : 200
    for (const { l, k } of fieldDefs) {
      const v = draft.values[k]
      if (v !== undefined && v !== "" && !(Number(v) > 0 && Number(v) < lim)) return `${l} must be a number between 0 and ${lim} ${draft.unit}.`
    }
    const cu = draft.custom.filter((c) => c.k.trim() || c.v.trim())
    for (const c of cu) { if (!c.k.trim()) return "Give every extra measurement a name."; if (!c.v.trim()) return `Enter a value for "${c.k.trim()}".` }
    const names = cu.map((c) => c.k.trim().toLowerCase())
    if (new Set(names).size !== names.length) return "Extra measurement names must be unique."
    if (!Object.keys(cleanValues()).length && !cu.length) return "Enter at least one measurement."
    if (!draft.measuredAt) return "Pick the measurement date."
    if (draft.measuredAt > today) return "Measurement date cannot be in the future."
    return ""
  }

  const payload = (d: Draft, customerId: number, values: Record<string, number>) => ({
    customerId, productType: NM[d.garment] ?? "Other", label: d.label.trim(), unit: d.unit, fitPreference: d.fit, notes: d.notes.trim(), measuredAt: d.measuredAt, values,
    customFields: Object.fromEntries(d.custom.filter((c) => c.k.trim()).map((c) => [c.k.trim(), c.v.trim()])),
  })

  const save = async () => {
    const e = validate()
    if (e) { setErr(e); return }
    if (!selCust) return
    setSaving(true); setErr("")
    try {
      const saved = await tailorWorkshopApi.saveMeasurement(rec?.id ?? null, payload(draft, selCust.id, cleanValues()))
      toast.success(rec ? "Measurements updated" : "Measurements saved")
      await loadSets(selCust.id, saved.id); loadCustomers()
    } catch (er: any) {
      setErr(er?.response?.data?.message || "Could not save the measurements.")
    } finally {
      setSaving(false)
    }
  }

  const duplicate = async () => {
    if (!rec || !selCust) { setErr("Save the measurements before duplicating."); return }
    try {
      const copy = await tailorWorkshopApi.saveMeasurement(null, payload({ ...draftOf(rec), label: rec.label ? `${rec.label} (copy)` : "Copy", measuredAt: today }, selCust.id, { ...rec.values }))
      toast.success("Duplicated. Edit the label or values and save.")
      await loadSets(selCust.id, copy.id); loadCustomers()
    } catch (er: any) { toast.error(er?.response?.data?.message || "Could not duplicate") }
  }

  const remove = async () => {
    if (!rec) { setSelM(sets[0]?.id ?? "new"); setDraft(newDraft()); return }
    const used = rec.usedByOrders ?? 0
    const msg = used > 0
      ? `This set is used by ${used} tailor order${used === 1 ? "" : "s"}; ${used === 1 ? "that order keeps" : "those orders keep"} their copy.\n\nDelete "${setLabel(rec)}" for ${selCust?.name ?? ""}?`
      : `Delete "${setLabel(rec)}" for ${selCust?.name ?? ""}? Orders keep their own copy.`
    if (!window.confirm(msg)) return
    try {
      await tailorWorkshopApi.deleteMeasurement(rec.id)
      toast.success("Measurements deleted")
      if (selCust) { await loadSets(selCust.id, "new"); loadCustomers() }
    } catch (er: any) { toast.error(er?.response?.data?.message || "Could not delete") }
  }

  const startNew = () => {
    if (!selCust) { toast.error("Add or select a customer first"); return }
    setSelM("new"); setDraft(newDraft()); setErr(""); setShowHist(false)
  }

  const addCustomer = async () => {
    if (!addName.trim() || !addPhone.trim()) { toast.error("Enter the customer name and phone"); return }
    try {
      const c = await tailorWorkshopApi.addCustomer({ name: addName.trim(), phone: addPhone.trim() })
      toast.success("Customer saved")
      setAddOpen(false); setAddName(""); setAddPhone(""); setQ("")
      setSelCust({ id: c.id, name: c.name, phone: c.phone, address: null, garments: [], setsCount: 0, lastMeasuredAt: null })
      loadCustomers()
    } catch (er: any) { toast.error(er?.response?.data?.message || "Could not add the customer") }
  }

  const printCard = () => {
    if (!selCust) { toast.error("Select a customer first"); return }
    const list = rec ? [rec] : sets
    if (!list.length) { toast.error("No saved measurements to print"); return }
    const body = list.map((m) => `<h2>${esc(setLabel(m))}</h2><table>${Object.entries(m.values).map(([k, v]) => `<tr><td>${esc(k.replace(/_/g, " "))}</td><td>${esc(v)} ${esc(m.unit)}</td></tr>`).join("")}${Object.entries(m.customFields).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table><p>Measured: ${esc(fmtD(m.measuredAt))} &middot; Fit: ${esc(m.fitPreference)}${m.notes ? ` &middot; ${esc(m.notes)}` : ""}</p>`).join("")
    const w = window.open("", "_blank")
    if (!w) { toast.error("Allow pop-ups to print the card"); return }
    w.document.write(`<!doctype html><title>Measurement card</title><style>body{font-family:sans-serif;padding:24px;color:#0E1525}h1{margin:0}h2{margin:18px 0 6px;font-size:16px}table{border-collapse:collapse;min-width:260px}td{border:1px solid #D5DAE5;padding:6px 12px;text-transform:capitalize}</style><h1>${esc(selCust.name)}</h1><div>${esc(selCust.phone)}</div>${body}`)
    w.document.close(); w.focus(); w.print()
  }

  if (!canRead("TailorMeasurements")) return <AccessDenied />
  const total = pagination?.total ?? 0
  const writable = canWrite("TailorMeasurements")
  const lastAt = sets.map((s) => s.measuredAt).filter(Boolean).sort().pop() ?? selCust?.lastMeasuredAt ?? null

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Measurements</h1>
          <p className="mt-1 text-sm text-dash-muted">Saved body measurements per customer and garment — no more paper slips.</p>
        </div>
        {writable && <button type="button" onClick={startNew} className="h-11 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">+ New customer measurement</button>}
      </div>

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <section className="flex w-full shrink-0 flex-col gap-2.5 rounded-[14px] border border-dash-border bg-dash-card p-4 xl:w-[340px]">
          <label className="flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search</span>
            <input type="search" placeholder="Name or phone…" value={q} onChange={(e) => setQ(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          {canWrite("TailorOrders") && (
            addOpen ? (
              <div className="flex flex-col gap-2 rounded-[10px] bg-dash-bg p-3">
                <input className={input} placeholder="Customer name" value={addName} onChange={(e) => setAddName(e.target.value)} />
                <input type="tel" className={input} placeholder="Phone" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} />
                <div className="flex gap-2"><button type="button" onClick={() => setAddOpen(false)} className={cn(outlineBtn, "flex-1")}>Cancel</button>
                  <button type="button" onClick={addCustomer} className="h-11 flex-1 rounded-[10px] bg-dash-accent text-sm font-semibold text-white">Save</button></div>
              </div>
            ) : (
              <>
              <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-dash-accent hover:underline"><UserPlus className="size-4" aria-hidden /> Add customer</button>
              <Link href="/dashboard/customers?add=1" className="self-start text-xs font-semibold text-dash-muted hover:text-dash-accent hover:underline">Open the full customer form</Link>
              </>
            )
          )}
          {loading ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 rounded-[10px]" />) :
            customers.length === 0 ? (
              <div className="rounded-[10px] border border-dashed border-dash-border p-5 text-center text-sm text-dash-muted">{qD ? "No customers match your search." : "No customers yet. Add a customer to save measurements."}</div>
            ) : customers.map((c) => {
              const on = selCust?.id === c.id
              return (
                <button key={c.id} type="button" aria-pressed={on} onClick={() => setSelCust(c)}
                  className={cn("flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left", on ? "bg-dash-accent-soft" : "hover:bg-dash-neutral-soft")}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-dash-card text-sm font-bold text-dash-accent-fg ring-1 ring-dash-border">{initials(c.name)}</span>
                  <span className="flex min-w-0 flex-col"><span className="truncate font-semibold">{c.name}</span>
                    <span className="truncate text-xs text-dash-muted">{c.phone || "—"} · {c.garments.length ? c.garments.join(", ") : "No measurements yet"}</span></span>
                </button>
              )
            })}
          {!loading && total > 0 && (
            <PaginationControl currentPage={page} totalPages={pagination?.last_page ?? 1} itemsPerPage={perPage} totalItems={total}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
          )}
        </section>

        <section className="flex w-full min-w-0 flex-1 flex-col gap-4 rounded-[14px] border border-dash-border bg-dash-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-dash-display text-xl font-bold">{selCust?.name ?? "No customer selected"}</h2>
              <span className="text-[13px] text-dash-muted">{selCust?.phone || "—"} · last measured {fmtD(lastAt)}</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={printCard} className={outlineBtn}><Printer className="size-4" aria-hidden /> Print card</button>
              {selCust && canRead("TailorOrders") && (
                <Link href={`/dashboard/tailor/orders/new?customerId=${selCust.id}`} className={outlineBtn}>New order with these</Link>
              )}
            </div>
          </div>

          {!selCust ? (
            <div className="rounded-[10px] border border-dashed border-dash-border p-10 text-center text-sm text-dash-muted">Select or add a customer to see their measurements.</div>
          ) : (
            <>
              <div role="tablist" aria-label="Garment" className="flex flex-wrap gap-2">
                {sets.map((m) => {
                  const on = m.id === selM
                  return <button key={m.id} type="button" role="tab" aria-selected={on} onClick={() => { setSelM(m.id); setShowHist(false) }}
                    className={cn("h-10 rounded-full border px-3.5 text-[13px] font-semibold", on ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{setLabel(m)}</button>
                })}
                {writable && <button type="button" role="tab" aria-selected={selM === "new"} onClick={startNew}
                  className={cn("h-10 rounded-full border px-3.5 text-[13px] font-semibold", selM === "new" ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dashed border-dash-border bg-dash-bg text-dash-neutral-fg")}>{selM === "new" ? "New garment" : "+ Add garment"}</button>}
              </div>
              {err && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}

              {setsLoading ? <Skeleton className="h-64 rounded-[10px]" /> : (
                <fieldset disabled={!writable} className="flex flex-col gap-4 border-0 p-0">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Garment type
                      <select className={input} value={draft.garment} onChange={(e) => patch({ garment: e.target.value })}>
                        {Object.entries(NM).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                      </select></label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Label<input className={input} value={draft.label} onChange={(e) => patch({ label: e.target.value })} placeholder="e.g. Eid 2026" /></label>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {fieldDefs.map(({ l, k }) => {
                      const cur = draft.values[k] ?? ""
                      let diff = "", warn = false
                      if (prevVals && prevVals[k] != null && cur !== "" && Number.isFinite(Number(cur))) {
                        const dv = Math.round((Number(cur) - Number(prevVals[k])) * 100) / 100
                        diff = dv === 0 ? "Same as before" : `${dv > 0 ? "+" : "−"}${Math.abs(dv)} since last`; warn = dv !== 0
                      }
                      return (
                        <label key={k} className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">{l}
                          <span className="flex h-[42px] items-center overflow-hidden rounded-[10px] border border-dash-border bg-dash-card focus-within:border-dash-accent">
                            <input type="number" step="0.25" min="0" value={cur} onChange={(e) => patch({ values: { ...draft.values, [k]: e.target.value } })}
                              className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-normal outline-none" />
                            <span className="pr-3 text-xs font-normal text-dash-muted">{draft.unit}</span>
                          </span>
                          <span className={cn("min-h-4 text-xs font-normal", warn ? "text-amber-600" : "text-dash-muted/70")}>{diff}</span>
                        </label>
                      )
                    })}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between"><span className="text-[13px] font-semibold">Extra measurements <span className="font-normal text-dash-muted">(anything not listed above)</span></span>
                      <button type="button" onClick={() => patch({ custom: [...draft.custom, { k: "", v: "" }] })} className="text-[13px] font-semibold text-dash-accent hover:underline">+ Add</button></div>
                    {draft.custom.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <input aria-label="Measurement name" className={input} placeholder="e.g. Back length" value={c.k} onChange={(e) => patch({ custom: draft.custom.map((x, j) => j === i ? { ...x, k: e.target.value } : x) })} />
                        <input aria-label="Measurement value" className={input} placeholder="Value" value={c.v} onChange={(e) => patch({ custom: draft.custom.map((x, j) => j === i ? { ...x, v: e.target.value } : x) })} />
                        <button type="button" aria-label="Remove" onClick={() => patch({ custom: draft.custom.filter((_, j) => j !== i) })} className={outlineBtn}>Remove</button>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Measured on<input type="date" className={input} max={today} value={draft.measuredAt} onChange={(e) => patch({ measuredAt: e.target.value })} /></label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Unit
                      <select className={input} value={draft.unit} onChange={(e) => patch({ unit: e.target.value as "in" | "cm" })}><option value="in">Inches (in)</option><option value="cm">Centimetres (cm)</option></select></label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Fit preference
                      <select className={input} value={draft.fit} onChange={(e) => patch({ fit: e.target.value })}><option>Regular</option><option>Slim</option><option>Loose</option></select></label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Note<input className={input} placeholder="e.g. Prefers longer sleeves" value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} /></label>
                  </div>
                </fieldset>
              )}

              {showHist && rec && (
                <div className="flex flex-col gap-2 rounded-[10px] bg-dash-bg p-3.5">
                  <strong className="text-sm">Version history</strong>
                  {rec.history.length === 0 ? <span className="text-[13px] text-dash-muted">No earlier versions yet.</span> :
                    rec.history.slice().reverse().map((h, i) => (
                      <div key={i} className="flex flex-wrap justify-between gap-3 text-[13px]">
                        <span className="font-semibold">{fmtD(h.at)}</span>
                        <span className="text-dash-muted">{Object.entries(h.values).slice(0, 4).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ")}{Object.keys(h.values).length > 4 ? "…" : ""}</span>
                      </div>
                    ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dash-border-soft pt-4">
                <span className="text-xs text-dash-muted">Grey text shows change since last version · history keeps every version</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setShowHist((s) => !s)} disabled={!rec} className={cn(outlineBtn, "disabled:opacity-50")}>{showHist ? "Hide history" : "View history"}</button>
                  {writable && <>
                    <button type="button" onClick={duplicate} className={outlineBtn}>Duplicate</button>
                    <button type="button" onClick={remove} className={outlineBtn}>Delete</button>
                    <button type="button" onClick={save} disabled={saving} className="h-11 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : rec ? "Save measurements" : "Add measurements"}</button>
                  </>}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

