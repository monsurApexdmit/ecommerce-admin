"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Printer, Search, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title="Measurements"
        description="Saved body measurements per customer and garment — no more paper slips."
        actions={writable ? <Button type="button" onClick={startNew}>+ New customer measurement</Button> : undefined}
      />

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full shrink-0 gap-2.5 p-4 xl:w-[340px]">
          <InputGroup>
            <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
            <InputGroupInput type="search" aria-label="Search" placeholder="Name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
          {canWrite("TailorOrders") && (
            addOpen ? (
              <Card className="gap-2 p-3 shadow-none">
                <Input aria-label="Customer name" placeholder="Customer name" value={addName} onChange={(e) => setAddName(e.target.value)} />
                <Input aria-label="Phone" type="tel" placeholder="Phone" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} />
                <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="flex-1">Cancel</Button>
                  <Button type="button" onClick={addCustomer} className="flex-1">Save</Button></div>
              </Card>
            ) : (
              <>
              <Button type="button" variant="link" onClick={() => setAddOpen(true)} className="self-start"><UserPlus className="size-4" aria-hidden /> Add customer</Button>
              <Link href="/dashboard/customers?add=1" className="self-start text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline">Open the full customer form</Link>
              </>
            )
          )}
          {loading ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />) :
            customers.length === 0 ? (
              <EmptyState bordered className="p-5 md:p-5" title="No customers" description={qD ? "No customers match your search." : "No customers yet. Add a customer to save measurements."} />
            ) : customers.map((c) => {
              const on = selCust?.id === c.id
              return (
                <Button key={c.id} type="button" aria-pressed={on} onClick={() => setSelCust(c)}
                  variant={on ? "secondary" : "ghost"} className="h-auto w-full justify-start gap-3 text-left whitespace-normal">
                  <UserAvatar name={c.name} className="size-10" />
                  <span className="flex min-w-0 flex-col"><span className="truncate font-medium">{c.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{c.phone || "—"} · {c.garments.length ? c.garments.join(", ") : "No measurements yet"}</span></span>
                </Button>
              )
            })}
          {!loading && total > 0 && (
            <PaginationControl currentPage={page} totalPages={pagination?.last_page ?? 1} itemsPerPage={perPage} totalItems={total}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
          )}
        </Card>

        <SectionCard
          className="w-full min-w-0 flex-1"
          contentClassName="flex flex-col gap-4"
          title={<span className="text-xl">{selCust?.name ?? "No customer selected"}</span>}
          description={`${selCust?.phone || "—"} · last measured ${fmtD(lastAt)}`}
          actions={<>
            <Button type="button" variant="outline" onClick={printCard}><Printer className="size-4" aria-hidden /> Print card</Button>
            {selCust && canRead("TailorOrders") && (
              <Button asChild variant="outline"><Link href={`/dashboard/tailor/orders/new?customerId=${selCust.id}`}>New order with these</Link></Button>
            )}
          </>}
        >
          {!selCust ? (
            <EmptyState bordered title="No customer selected" description="Select or add a customer to see their measurements." />
          ) : (
            <>
              <div role="tablist" aria-label="Garment" className="flex flex-wrap gap-2">
                {sets.map((m) => {
                  const on = m.id === selM
                  return <Button key={m.id} type="button" role="tab" aria-selected={on} onClick={() => { setSelM(m.id); setShowHist(false) }}
                    variant={on ? "default" : "outline"}>{setLabel(m)}</Button>
                })}
                {writable && <Button type="button" role="tab" aria-selected={selM === "new"} onClick={startNew}
                  variant={selM === "new" ? "default" : "outline"}>{selM === "new" ? "New garment" : "+ Add garment"}</Button>}
              </div>
              {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

              {setsLoading ? <Skeleton className="h-64" /> : (
                <fieldset disabled={!writable} className="flex flex-col gap-4 border-0 p-0">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Garment type" htmlFor="meas-garment">
                      <Select value={draft.garment} onValueChange={(v) => patch({ garment: v })}>
                        <SelectTrigger id="meas-garment" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(NM).map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
                      </Select></FormField>
                    <FormField label="Label" htmlFor="meas-label"><Input id="meas-label" value={draft.label} onChange={(e) => patch({ label: e.target.value })} placeholder="e.g. Eid 2026" /></FormField>
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
                        <FormField key={k} className="min-w-0 gap-1.5" label={l} htmlFor={`meas-${k}`}>
                          <InputGroup>
                            <InputGroupInput id={`meas-${k}`} type="number" step="0.25" min="0" value={cur} onChange={(e) => patch({ values: { ...draft.values, [k]: e.target.value } })} />
                            <InputGroupAddon align="inline-end"><InputGroupText>{draft.unit}</InputGroupText></InputGroupAddon>
                          </InputGroup>
                          <span className={cn("min-h-4 text-xs font-normal", warn ? "text-amber-600" : "text-muted-foreground")}>{diff}</span>
                        </FormField>
                      )
                    })}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between"><span className="text-sm font-medium">Extra measurements <span className="font-normal text-muted-foreground">(anything not listed above)</span></span>
                      <Button type="button" variant="link" size="sm" onClick={() => patch({ custom: [...draft.custom, { k: "", v: "" }] })}>+ Add</Button></div>
                    {draft.custom.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <Input aria-label="Measurement name" placeholder="e.g. Back length" value={c.k} onChange={(e) => patch({ custom: draft.custom.map((x, j) => j === i ? { ...x, k: e.target.value } : x) })} />
                        <Input aria-label="Measurement value" placeholder="Value" value={c.v} onChange={(e) => patch({ custom: draft.custom.map((x, j) => j === i ? { ...x, v: e.target.value } : x) })} />
                        <Button type="button" variant="outline" aria-label="Remove" onClick={() => patch({ custom: draft.custom.filter((_, j) => j !== i) })}>Remove</Button>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Measured on" htmlFor="meas-date"><Input id="meas-date" type="date" max={today} value={draft.measuredAt} onChange={(e) => patch({ measuredAt: e.target.value })} /></FormField>
                    <FormField label="Unit" htmlFor="meas-unit">
                      <Select value={draft.unit} onValueChange={(v) => patch({ unit: v as "in" | "cm" })}>
                        <SelectTrigger id="meas-unit" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="in">Inches (in)</SelectItem><SelectItem value="cm">Centimetres (cm)</SelectItem></SelectContent>
                      </Select></FormField>
                    <FormField label="Fit preference" htmlFor="meas-fit">
                      <Select value={draft.fit} onValueChange={(v) => patch({ fit: v })}>
                        <SelectTrigger id="meas-fit" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="Regular">Regular</SelectItem><SelectItem value="Slim">Slim</SelectItem><SelectItem value="Loose">Loose</SelectItem></SelectContent>
                      </Select></FormField>
                    <FormField label="Note" htmlFor="meas-note"><Input id="meas-note" placeholder="e.g. Prefers longer sleeves" value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} /></FormField>
                  </div>
                </fieldset>
              )}

              {showHist && rec && (
                <Card className="gap-2 p-3.5 shadow-none">
                  <SectionTitle>Version history</SectionTitle>
                  {rec.history.length === 0 ? <span className="text-sm text-muted-foreground">No earlier versions yet.</span> :
                    rec.history.slice().reverse().map((h, i) => (
                      <div key={i} className="flex flex-wrap justify-between gap-3 text-sm">
                        <span className="font-medium">{fmtD(h.at)}</span>
                        <span className="text-muted-foreground">{Object.entries(h.values).slice(0, 4).map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ")}{Object.keys(h.values).length > 4 ? "…" : ""}</span>
                      </div>
                    ))}
                </Card>
              )}

              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Grey text shows change since last version · history keeps every version</span>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowHist((s) => !s)} disabled={!rec}>{showHist ? "Hide history" : "View history"}</Button>
                  {writable && <>
                    <Button type="button" variant="outline" onClick={duplicate}>Duplicate</Button>
                    <Button type="button" variant="destructive" onClick={remove}>Delete</Button>
                    <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : rec ? "Save measurements" : "Add measurements"}</Button>
                  </>}
                </div>
              </div>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

