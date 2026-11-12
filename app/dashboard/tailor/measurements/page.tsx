"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
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
import { localeTag } from "@/lib/i18n"
import { TAILOR_NS, fitLabel, garmentLabel, measFieldLabel, type TailorT } from "@/components/tailor/i18n"

/** Garment id → the product type stored by the API (English, data). Shown via garmentLabel(). */
const NM: Record<string, string> = {
  shirt: "Shirt", panjabi: "Panjabi", pant: "Pant", blouse: "Blouse", salwar: "Salwar Kameez", coat: "Coat",
  pajama: "Pajama", jama: "Jama", kurta: "Kurta", other: "Other",
}
/** Built-in measurement fields per garment (English source; stored under key(label), shown via measFieldLabel()). */
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
const fmtD = (d: string | null | undefined, lng: string, never: string) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(localeTag(lng), { month: "short", day: "numeric", year: "numeric" }) : never)
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
const setLabel = (t: TailorT, m: MeasurementSet) => (NM[garmentId(m.productType)] === m.productType || garmentId(m.productType) !== "other" ? garmentLabel(t, garmentId(m.productType)) : m.productType) + (m.label ? ` · ${m.label}` : "")

export default function MeasurementsPage() {
  const { canRead, canWrite } = useSaasAuth()
  const { t, i18n } = useTranslation(TAILOR_NS)
  const lng = i18n.language

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
      toast.error(t("tailor:measure.failedCustomers"))
    } finally {
      setLoading(false)
    }
  }, [qD, page, perPage, t])
  useEffect(() => { loadCustomers() }, [loadCustomers])

  const loadSets = useCallback(async (customerId: number, select?: number | "new") => {
    setSetsLoading(true)
    try {
      const s = await tailorWorkshopApi.getMeasurementSets(customerId)
      setSets(s)
      setSelM((cur) => select ?? (cur !== "new" && s.some((x) => x.id === cur) ? cur : (s[0]?.id ?? "new")))
    } catch {
      toast.error(t("tailor:measure.failedMeasurements")); setSets([])
    } finally {
      setSetsLoading(false)
    }
  }, [t])
  useEffect(() => { if (selCust) { setShowHist(false); loadSets(selCust.id) } else setSets([]) }, [selCust?.id, loadSets]) // eslint-disable-line react-hooks/exhaustive-deps

  const rec = selM === "new" ? null : sets.find((s) => s.id === selM) ?? null
  // Re-seed the editable draft whenever a different set (or fresh data) is selected.
  useEffect(() => {
    if (setsLoading) return
    if (selM !== "new" && !sets.some((s) => s.id === selM)) { setSelM(sets[0]?.id ?? "new"); return }
    setDraft(rec ? draftOf(rec) : newDraft()); setErr("")
  }, [selM, sets, setsLoading]) // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (p: Partial<Draft>) => { setDraft((d) => ({ ...d, ...p })); setErr("") }

  const baseDefs = (F[draft.garment] ?? []).map((l) => ({ l: measFieldLabel(t, key(l)), k: key(l) }))
  const extraDefs = Object.keys(draft.values).filter((k) => !baseDefs.some((d) => d.k === k)).map((k) => ({ l: measFieldLabel(t, k), k }))
  const fieldDefs = [...baseDefs, ...extraDefs]
  const prevVals = rec && rec.history.length ? rec.history[rec.history.length - 1].values : null
  const today = todayIso()

  const cleanValues = () => {
    const out: Record<string, number> = {}
    for (const { k } of fieldDefs) { const v = draft.values[k]; if (v !== undefined && v !== "") out[k] = Number(v) }
    return out
  }
  const validate = () => {
    if (!selCust) return t("tailor:measure.selectCustomerFirst")
    if (!draft.garment) return t("tailor:measure.chooseGarment")
    const lim = draft.unit === "cm" ? 500 : 200
    for (const { l, k } of fieldDefs) {
      const v = draft.values[k]
      if (v !== undefined && v !== "" && !(Number(v) > 0 && Number(v) < lim)) return t("tailor:measure.fieldRange", { field: l, max: lim, unit: draft.unit })
    }
    const cu = draft.custom.filter((c) => c.k.trim() || c.v.trim())
    for (const c of cu) { if (!c.k.trim()) return t("tailor:measure.nameExtra"); if (!c.v.trim()) return t("tailor:measure.valueFor", { name: c.k.trim() }) }
    const names = cu.map((c) => c.k.trim().toLowerCase())
    if (new Set(names).size !== names.length) return t("tailor:measure.uniqueNames")
    if (!Object.keys(cleanValues()).length && !cu.length) return t("tailor:measure.atLeastOne")
    if (!draft.measuredAt) return t("tailor:measure.pickDate")
    if (draft.measuredAt > today) return t("tailor:measure.dateFuture")
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
      toast.success(rec ? t("tailor:measure.updated") : t("tailor:measure.saved"))
      await loadSets(selCust.id, saved.id); loadCustomers()
    } catch (er: any) {
      setErr(er?.response?.data?.message || t("tailor:measure.couldNotSave"))
    } finally {
      setSaving(false)
    }
  }

  const duplicate = async () => {
    if (!rec || !selCust) { setErr(t("tailor:measure.saveBeforeDuplicate")); return }
    try {
      const copy = await tailorWorkshopApi.saveMeasurement(null, payload({ ...draftOf(rec), label: rec.label ? `${rec.label} (copy)` : "Copy", measuredAt: today }, selCust.id, { ...rec.values }))
      toast.success(t("tailor:measure.duplicated"))
      await loadSets(selCust.id, copy.id); loadCustomers()
    } catch (er: any) { toast.error(er?.response?.data?.message || t("tailor:measure.couldNotDuplicate")) }
  }

  const remove = async () => {
    if (!rec) { setSelM(sets[0]?.id ?? "new"); setDraft(newDraft()); return }
    const used = rec.usedByOrders ?? 0
    const msg = used > 0
      ? t("tailor:measure.deleteUsed", { count: used, name: setLabel(t, rec), customer: selCust?.name ?? "" })
      : t("tailor:measure.deleteConfirm", { name: setLabel(t, rec), customer: selCust?.name ?? "" })
    if (!window.confirm(msg)) return
    try {
      await tailorWorkshopApi.deleteMeasurement(rec.id)
      toast.success(t("tailor:measure.deleted"))
      if (selCust) { await loadSets(selCust.id, "new"); loadCustomers() }
    } catch (er: any) { toast.error(er?.response?.data?.message || t("tailor:shared.couldNotDelete")) }
  }

  const startNew = () => {
    if (!selCust) { toast.error(t("tailor:measure.addSelectFirst")); return }
    setSelM("new"); setDraft(newDraft()); setErr(""); setShowHist(false)
  }

  const addCustomer = async () => {
    if (!addName.trim() || !addPhone.trim()) { toast.error(t("tailor:measure.enterNamePhone")); return }
    try {
      const c = await tailorWorkshopApi.addCustomer({ name: addName.trim(), phone: addPhone.trim() })
      toast.success(t("tailor:measure.customerSaved"))
      setAddOpen(false); setAddName(""); setAddPhone(""); setQ("")
      setSelCust({ id: c.id, name: c.name, phone: c.phone, address: null, garments: [], setsCount: 0, lastMeasuredAt: null })
      loadCustomers()
    } catch (er: any) { toast.error(er?.response?.data?.message || t("tailor:measure.couldNotAddCustomer")) }
  }

  const printCard = () => {
    if (!selCust) { toast.error(t("tailor:measure.selectCustomerToast")); return }
    const list = rec ? [rec] : sets
    if (!list.length) { toast.error(t("tailor:measure.noSavedToPrint")); return }
    const body = list.map((m) => `<h2>${esc(setLabel(t, m))}</h2><table>${Object.entries(m.values).map(([k, v]) => `<tr><td>${esc(measFieldLabel(t, k))}</td><td>${esc(v)} ${esc(m.unit)}</td></tr>`).join("")}${Object.entries(m.customFields).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table><p>${esc(t("tailor:measure.printMeasured", { date: fmtD(m.measuredAt, lng, t("tailor:measure.never")), fit: fitLabel(t, m.fitPreference) }))}${m.notes ? ` &middot; ${esc(m.notes)}` : ""}</p>`).join("")
    const w = window.open("", "_blank")
    if (!w) { toast.error(t("tailor:measure.allowPopupsCard")); return }
    w.document.write(`<!doctype html><html lang="${esc(lng)}"><meta charset="utf-8"><title>${esc(t("tailor:measure.printTitle"))}</title><style>body{font-family:sans-serif;padding:24px;color:#0E1525}h1{margin:0}h2{margin:18px 0 6px;font-size:16px}table{border-collapse:collapse;min-width:260px}td{border:1px solid #D5DAE5;padding:6px 12px;text-transform:capitalize}</style><h1>${esc(selCust.name)}</h1><div>${esc(selCust.phone)}</div>${body}`)
    w.document.close(); w.focus(); w.print()
  }

  if (!canRead("TailorMeasurements")) return <AccessDenied />
  const total = pagination?.total ?? 0
  const writable = canWrite("TailorMeasurements")
  const lastAt = sets.map((s) => s.measuredAt).filter(Boolean).sort().pop() ?? selCust?.lastMeasuredAt ?? null

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("tailor:measure.title")}
        description={t("tailor:measure.description")}
        actions={writable ? <Button type="button" onClick={startNew}>{t("tailor:measure.newCustomerMeasurement")}</Button> : undefined}
      />

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full shrink-0 gap-2.5 p-4 xl:w-[340px]">
          <InputGroup>
            <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
            <InputGroupInput type="search" aria-label={t("common:actions.search")} placeholder={t("tailor:measure.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
          {canWrite("TailorOrders") && (
            addOpen ? (
              <Card className="gap-2 p-3 shadow-none">
                <Input aria-label={t("tailor:measure.customerName")} placeholder={t("tailor:measure.customerName")} value={addName} onChange={(e) => setAddName(e.target.value)} />
                <Input aria-label={t("common:fields.phone")} type="tel" placeholder={t("common:fields.phone")} value={addPhone} onChange={(e) => setAddPhone(e.target.value)} />
                <div className="flex gap-2"><Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="flex-1">{t("common:actions.cancel")}</Button>
                  <Button type="button" onClick={addCustomer} className="flex-1">{t("common:actions.save")}</Button></div>
              </Card>
            ) : (
              <>
              <Button type="button" variant="link" onClick={() => setAddOpen(true)} className="self-start"><UserPlus className="size-4" aria-hidden /> {t("tailor:measure.addCustomer")}</Button>
              <Link href="/dashboard/customers?add=1" className="self-start text-xs font-medium text-muted-foreground underline-offset-4 hover:text-primary hover:underline">{t("tailor:measure.openFullForm")}</Link>
              </>
            )
          )}
          {loading ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />) :
            customers.length === 0 ? (
              <EmptyState bordered className="p-5 md:p-5" title={t("tailor:measure.noCustomers")} description={qD ? t("tailor:measure.noMatch") : t("tailor:measure.noCustomersYet")} />
            ) : customers.map((c) => {
              const on = selCust?.id === c.id
              return (
                <Button key={c.id} type="button" aria-pressed={on} onClick={() => setSelCust(c)}
                  variant={on ? "secondary" : "ghost"} className="h-auto w-full justify-start gap-3 text-left whitespace-normal">
                  <UserAvatar name={c.name} className="size-10" />
                  <span className="flex min-w-0 flex-col"><span className="truncate font-medium">{c.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{c.phone || "—"} · {c.garments.length ? c.garments.map((g) => garmentLabel(t, g)).join(", ") : t("tailor:measure.noMeasurementsYet")}</span></span>
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
          title={<span className="text-xl">{selCust?.name ?? t("tailor:measure.noCustomerSelected")}</span>}
          description={t("tailor:measure.lastMeasured", { phone: selCust?.phone || "—", date: fmtD(lastAt, lng, t("tailor:measure.never")) })}
          actions={<>
            <Button type="button" variant="outline" onClick={printCard}><Printer className="size-4" aria-hidden /> {t("tailor:measure.printCard")}</Button>
            {selCust && canRead("TailorOrders") && (
              <Button asChild variant="outline"><Link href={`/dashboard/tailor/orders/new?customerId=${selCust.id}`}>{t("tailor:measure.newOrderWith")}</Link></Button>
            )}
          </>}
        >
          {!selCust ? (
            <EmptyState bordered title={t("tailor:measure.noCustomerSelected")} description={t("tailor:measure.selectOrAdd")} />
          ) : (
            <>
              <div role="tablist" aria-label={t("tailor:measure.garmentAria")} className="flex flex-wrap gap-2">
                {sets.map((m) => {
                  const on = m.id === selM
                  return <Button key={m.id} type="button" role="tab" aria-selected={on} onClick={() => { setSelM(m.id); setShowHist(false) }}
                    variant={on ? "default" : "outline"}>{setLabel(t, m)}</Button>
                })}
                {writable && <Button type="button" role="tab" aria-selected={selM === "new"} onClick={startNew}
                  variant={selM === "new" ? "default" : "outline"}>{selM === "new" ? t("tailor:measure.newGarment") : t("tailor:measure.addGarment")}</Button>}
              </div>
              {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

              {setsLoading ? <Skeleton className="h-64" /> : (
                <fieldset disabled={!writable} className="flex flex-col gap-4 border-0 p-0">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label={t("tailor:measure.garmentType")} htmlFor="meas-garment">
                      <Select value={draft.garment} onValueChange={(v) => patch({ garment: v })}>
                        <SelectTrigger id="meas-garment" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.keys(NM).map((id) => <SelectItem key={id} value={id}>{garmentLabel(t, id)}</SelectItem>)}</SelectContent>
                      </Select></FormField>
                    <FormField label={t("tailor:measure.label")} htmlFor="meas-label"><Input id="meas-label" value={draft.label} onChange={(e) => patch({ label: e.target.value })} placeholder={t("tailor:measure.labelPlaceholder")} /></FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                    {fieldDefs.map(({ l, k }) => {
                      const cur = draft.values[k] ?? ""
                      let diff = "", warn = false
                      if (prevVals && prevVals[k] != null && cur !== "" && Number.isFinite(Number(cur))) {
                        const dv = Math.round((Number(cur) - Number(prevVals[k])) * 100) / 100
                        diff = dv === 0 ? t("tailor:measure.sameAsBefore") : t("tailor:measure.sinceLast", { diff: `${dv > 0 ? "+" : "−"}${Math.abs(dv)}` }); warn = dv !== 0
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
                    <div className="flex items-center justify-between"><span className="text-sm font-medium">{t("tailor:measure.extraMeasurements")} <span className="font-normal text-muted-foreground">{t("tailor:measure.extraHint")}</span></span>
                      <Button type="button" variant="link" size="sm" onClick={() => patch({ custom: [...draft.custom, { k: "", v: "" }] })}>{t("tailor:measure.addExtra")}</Button></div>
                    {draft.custom.map((c, i) => (
                      <div key={i} className="flex gap-2">
                        <Input aria-label={t("tailor:measure.measName")} placeholder={t("tailor:measure.measNamePlaceholder")} value={c.k} onChange={(e) => patch({ custom: draft.custom.map((x, j) => j === i ? { ...x, k: e.target.value } : x) })} />
                        <Input aria-label={t("tailor:measure.measValue")} placeholder={t("tailor:measure.value")} value={c.v} onChange={(e) => patch({ custom: draft.custom.map((x, j) => j === i ? { ...x, v: e.target.value } : x) })} />
                        <Button type="button" variant="outline" aria-label={t("common:actions.remove")} onClick={() => patch({ custom: draft.custom.filter((_, j) => j !== i) })}>{t("common:actions.remove")}</Button>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label={t("tailor:measure.measuredOn")} htmlFor="meas-date"><Input id="meas-date" type="date" max={today} value={draft.measuredAt} onChange={(e) => patch({ measuredAt: e.target.value })} /></FormField>
                    <FormField label={t("common:extra.unit")} htmlFor="meas-unit">
                      <Select value={draft.unit} onValueChange={(v) => patch({ unit: v as "in" | "cm" })}>
                        <SelectTrigger id="meas-unit" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="in">{t("tailor:measure.inches")}</SelectItem><SelectItem value="cm">{t("tailor:measure.centimetres")}</SelectItem></SelectContent>
                      </Select></FormField>
                    <FormField label={t("tailor:measure.fitPreference")} htmlFor="meas-fit">
                      <Select value={draft.fit} onValueChange={(v) => patch({ fit: v })}>
                        <SelectTrigger id="meas-fit" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{["Regular", "Slim", "Loose", ...(["Regular", "Slim", "Loose"].includes(draft.fit) ? [] : [draft.fit])].map((f) => <SelectItem key={f} value={f}>{fitLabel(t, f)}</SelectItem>)}</SelectContent>
                      </Select></FormField>
                    <FormField label={t("common:fields.note")} htmlFor="meas-note"><Input id="meas-note" placeholder={t("tailor:measure.notePlaceholder")} value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} /></FormField>
                  </div>
                </fieldset>
              )}

              {showHist && rec && (
                <Card className="gap-2 p-3.5 shadow-none">
                  <SectionTitle>{t("tailor:measure.versionHistory")}</SectionTitle>
                  {rec.history.length === 0 ? <span className="text-sm text-muted-foreground">{t("tailor:measure.noEarlier")}</span> :
                    rec.history.slice().reverse().map((h, i) => (
                      <div key={i} className="flex flex-wrap justify-between gap-3 text-sm">
                        <span className="font-medium">{fmtD(h.at, lng, t("tailor:measure.never"))}</span>
                        <span className="text-muted-foreground">{Object.entries(h.values).slice(0, 4).map(([k, v]) => `${measFieldLabel(t, k)} ${v}`).join(", ")}{Object.keys(h.values).length > 4 ? "…" : ""}</span>
                      </div>
                    ))}
                </Card>
              )}

              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">{t("tailor:measure.footerHint")}</span>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setShowHist((s) => !s)} disabled={!rec}>{showHist ? t("tailor:measure.hideHistory") : t("tailor:measure.viewHistory")}</Button>
                  {writable && <>
                    <Button type="button" variant="outline" onClick={duplicate}>{t("common:actions.duplicate")}</Button>
                    <Button type="button" variant="destructive" onClick={remove}>{t("common:actions.delete")}</Button>
                    <Button type="button" onClick={save} disabled={saving}>{saving ? t("common:actions.saving") : rec ? t("tailor:measure.saveMeasurements") : t("tailor:measure.addMeasurements")}</Button>
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

