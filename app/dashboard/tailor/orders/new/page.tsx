"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { toast } from "sonner"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { apiError, tInput, tOutlineBtn, tPrimaryBtn, todayIso } from "@/components/tailor/order-ui"
import {
  GARMENT_DEFAULTS, PRODUCT_TYPES, TAILOR_PAY_METHODS, tailorApi, tailorCustomerSummary, tailorOrdersApi,
  type TailorCustomer, type TailorFabric, type TailorMeasurement, type TailorOrderFormOptions,
} from "@/lib/tailorApi"
import { measurementText, printJobCard } from "@/lib/tailorOrderPrint"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

/** Style-option chips offered per garment (labels only; saved with the item). */
const STYLE_OPTS: Record<string, string[]> = {
  shirt: ["Mandarin collar", "Double cuff", "Pocket"],
  panjabi: ["Embroidery", "Side pocket", "Hidden placket"],
  pant: ["Pleated", "Side pocket", "Belt loop"],
  blouse: ["Boat neck", "Back zip", "Lining", "Puff sleeve"],
  "salwar kameez": ["Churidar", "Piping", "Lining"],
  coat: ["Two button", "Lining", "Vent"],
  pajama: ["Elastic waist", "Drawstring", "Side pocket"],
  jama: ["Embroidery", "Lining", "Collar"],
  kurta: ["Mandarin collar", "Side slit", "Embroidery"],
}

interface Line {
  g: string
  qty: number
  own: boolean
  fabricId: string
  meters: number
  ownNote: string
  rate: number
  opts: Record<string, boolean>
  note: string
  price?: number
  measId?: string
}

const r2 = (v: number) => Math.round(v * 100) / 100
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
const ini = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")
const same = (a: string, b: string) => { const n = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "").replace(/^sh/, "s").replace(/s$/, ""); return n(a) === n(b) }

const label = "flex flex-col gap-1.5 text-[13px] font-semibold"
const card = "flex flex-col gap-4 rounded-[14px] border border-dash-border bg-dash-card p-5"
const h2 = "flex items-center gap-2.5 font-dash-display text-lg font-bold"
const caption = "text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted"
const chip = (on: boolean) => cn("rounded-[10px] border-2 px-3 py-2 text-left text-[13px] font-semibold", on ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card hover:bg-dash-neutral-soft")
const stepper = "flex h-9 w-9 items-center justify-center border border-dash-border bg-dash-card text-base font-semibold hover:bg-dash-neutral-soft"

export default function NewTailorOrderPage() {
  const { formatCurrency: fc } = useCompanySettings()
  const { canWrite } = useSaasAuth()
  const router = useRouter()
  const blocked = useModuleGuard("TailorOrders")
  const writable = canWrite("TailorOrders")

  const [fabrics, setFabrics] = useState<TailorFabric[]>([])
  const [opts, setOpts] = useState<TailorOrderFormOptions | null>(null)

  // customer
  const [cq, setCq] = useState("")
  const [results, setResults] = useState<TailorCustomer[]>([])
  const [searched, setSearched] = useState(false)
  const [cust, setCust] = useState<TailorCustomer | null>(null)
  const [custMeas, setCustMeas] = useState<TailorMeasurement[]>([])
  const [custInfo, setCustInfo] = useState<{ orders: number; due: number } | null>(null)
  const [nc, setNc] = useState({ name: "", phone: "", addr: "" })
  const [ncErr, setNcErr] = useState("")
  const [ncSaving, setNcSaving] = useState(false)
  const [showNew, setShowNew] = useState(false)

  // items
  const blank = (): Line => ({ g: "Shirt", qty: 1, own: true, fabricId: "", meters: 0, ownNote: "", rate: 0, opts: {}, note: "" })
  const [its, setIts] = useState<Line[]>([blank()])

  // delivery
  const [orderDate, setOrderDate] = useState(todayIso())
  const [date, setDate] = useState(addDays(7))
  const [urgent, setUrgent] = useState(false)
  const [dz, setDz] = useState<number | null>(null)
  const [orderNote, setOrderNote] = useState("")

  // charges / advance
  const [extra, setExtra] = useState(0)
  const [disc, setDisc] = useState(0)
  const [advMode, setAdvMode] = useState<"none" | "half" | "full">("none")
  const [advManual, setAdvManual] = useState<number | undefined>(undefined)
  const [method, setMethod] = useState("cash")
  const [printAfter, setPrintAfter] = useState(true)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    tailorApi.getFabrics({ limit: 200, status: "active" }).then((r) => setFabrics(r.data?.data?.data ?? [])).catch(() => toast.error("Failed to load fabrics"))
    tailorOrdersApi.formOptions().then(setOpts).catch(() => toast.error("Failed to load order options"))
    const id = Number(new URLSearchParams(window.location.search).get("customerId"))
    if (id > 0) tailorApi.getCustomers().then((r) => { const c = (r.data?.data as TailorCustomer[]).find((x) => x.id === id); if (c) pickCustomer(c) }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // first line starts as a Shirt: give it its price once the form options are in
  useEffect(() => {
    if (!opts) return
    setIts((p) => p.length === 1 && p[0].rate === 0 && p[0].g === "Shirt" ? [{ ...p[0], rate: hint("Shirt")?.lastPrice ?? 0 }] : p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts])

  // customer search
  useEffect(() => {
    const q = cq.trim()
    if (!q) { setResults([]); setSearched(false); return }
    const t = setTimeout(() => {
      tailorApi.getCustomers({ search: q }).then((r) => { setResults(((r.data?.data as TailorCustomer[]) ?? []).slice(0, 6)); setSearched(true) }).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [cq])

  const pickCustomer = (c: TailorCustomer) => {
    setCust(c); setCq(""); setErr("")
    setIts((p) => p.map((x) => ({ ...x, measId: undefined })))
    setCustMeas([]); setCustInfo(null)
    tailorApi.getMeasurementsByCustomer(c.id).then((r) => setCustMeas(r.data?.data ?? [])).catch(() => {})
    tailorCustomerSummary(c.id).then(setCustInfo).catch(() => {})
  }

  const saveNewCustomer = async () => {
    const phoneGuess = /^[0-9+\-\s]+$/.test(cq.trim()) ? cq.trim() : ""
    const name = (nc.name || (phoneGuess ? "" : cq.trim())).trim()
    const phone = (nc.phone || phoneGuess).trim()
    if (!name) return setNcErr("Customer name is required.")
    if (!phone) return setNcErr("Phone is required.")
    if (!/^[0-9+\-\s]{6,20}$/.test(phone)) return setNcErr("Enter a valid phone number.")
    setNcSaving(true); setNcErr("")
    try {
      const existing = await tailorApi.findCustomerByPhone(phone).then((r) => r.data?.data ?? null).catch(() => null)
      if (existing) return setNcErr("A customer with this phone already exists. Search by phone to select them.")
      const res = await tailorApi.saveCustomer({ name, phone, address: nc.addr.trim() || undefined })
      const c = res.data?.data ?? res.data
      pickCustomer({ id: c.id, companyId: c.company_id, name: c.name, phone: c.phone, address: c.address })
      setNc({ name: "", phone: "", addr: "" }); setShowNew(false)
      toast.success(`Customer ${c.name} added`)
    } catch (e) {
      setNcErr(apiError(e, "Failed to add customer"))
    } finally {
      setNcSaving(false)
    }
  }

  // garment list = known types + anything the shop has used before
  const garmentList = useMemo(() => {
    const extraTypes = (opts?.garments ?? []).map((g) => g.productType).filter((g) => !PRODUCT_TYPES.some((p) => same(p, g)))
    return [...PRODUCT_TYPES, ...extraTypes]
  }, [opts])
  // learned-from-history values win; the reference defaults fill the gaps
  const hint = (g: string) => {
    const learned = opts?.garments.find((x) => same(x.productType, g))
    const def = GARMENT_DEFAULTS.find((x) => same(x.name, g))
    const price = learned?.lastPrice || def?.price || 0
    const fabric = learned?.avgFabricEach || def?.fabric || 0
    return price || fabric ? { productType: g, lastPrice: price, avgFabricEach: fabric } : undefined
  }
  const suggest = (g: string, qty: number) => r2((hint(g)?.avgFabricEach ?? 0) * qty)
  const autoMeas = (g: string) => custMeas.filter((m) => same(m.productType, g)).sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1))[0]?.id

  const setIt = (i: number, patch: Partial<Line>) => { setIts((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x))); setErr("") }

  // totals
  const calc = its.map((it) => {
    const qty = Math.max(1, it.qty)
    const f = !it.own && it.fabricId ? fabrics.find((x) => String(x.id) === it.fabricId) : undefined
    const unitPrice = f ? (it.price !== undefined ? it.price : f.sellingPrice || f.purchasePrice) : 0
    const fabCost = f ? r2(it.meters * unitPrice) : 0
    return { qty, f, unitPrice, fabCost, stitch: qty * it.rate }
  })
  const stitch = calc.reduce((a, c) => a + c.stitch, 0)
  const fab = calc.reduce((a, c) => a + c.fabCost, 0)
  const urgFee = urgent ? opts?.urgentFee ?? 0 : 0
  const subtotal = stitch + fab + urgFee + extra
  const discount = Math.min(Math.max(0, disc), subtotal)
  const total = r2(Math.max(0, subtotal - discount))
  const advRaw = advManual !== undefined ? advManual : advMode === "half" ? Math.round(total / 2) : advMode === "full" ? total : 0
  const adv = Math.min(Math.max(0, advRaw), total)
  const due = r2(Math.max(0, total - adv))

  const sameDay = opts?.dueByDate?.[date] ?? 0
  const today = todayIso()
  const loadHint = !date ? "Pick a delivery date." : date < orderDate ? "Delivery cannot be before the order date." : date < today ? "That date is in the past."
    : sameDay ? `${sameDay} open order${sameDay > 1 ? "s" : ""} already due that day. Consider Urgent.` : "No other orders due that day."

  const save = async () => {
    if (saving) return
    if (!cust) return setErr("Select a customer.")
    for (let i = 0; i < its.length; i++) {
      const it = its[i], c = calc[i]
      if (it.rate < 0) return setErr(`Item ${i + 1}: stitching price cannot be negative.`)
      if (!it.own) {
        if (!c.f) return setErr(`Item ${i + 1}: choose a fabric or switch to customer’s fabric.`)
        if (!(it.meters > 0)) return setErr(`Item ${i + 1}: enter fabric quantity.`)
      }
    }
    if (!orderDate) return setErr("Pick the order date.")
    if (orderDate > today) return setErr("Order date cannot be in the future.")
    if (!date) return setErr("Pick a delivery date.")
    if (date < orderDate) return setErr("Delivery date cannot be before the order date.")
    if (date < today) return setErr("Delivery date cannot be in the past.")
    if (!(total > 0)) return setErr("Order total must be greater than 0.")
    if (advRaw > total + 0.005) return setErr("Advance cannot be more than the total.")
    setSaving(true); setErr("")
    try {
      const created = await tailorOrdersApi.place({
        customerId: cust.id, orderDate, deliveryDate: date, isUrgent: urgent, dorjiId: dz ?? undefined,
        notes: orderNote.trim() || undefined, extraCharge: extra, discount, advancePayment: adv, advancePaymentMethod: method,
        items: its.map((it, i) => {
          const c = calc[i]
          const measId = it.measId === undefined ? autoMeas(it.g) : it.measId
          return {
            productType: it.g, quantity: c.qty, stitchingPrice: it.rate, fabricSource: it.own ? "own" : "shop",
            fabricId: c.f?.id, fabricQuantity: c.f ? it.meters : undefined, fabricUnitPrice: c.f ? c.unitPrice : undefined,
            ownFabricNote: it.own ? it.ownNote.trim() || undefined : undefined,
            measurementId: measId ? Number(measId) : undefined,
            styleOptions: Object.keys(it.opts).filter((k) => it.opts[k]),
            notes: it.note.trim() || undefined,
          }
        }),
      })
      toast.success(`Order ${created.order_number} created`)
      if (printAfter) {
        try { const d = await tailorOrdersApi.detail(created.id); if (!printJobCard(d)) toast.error("Allow pop-ups to print the job card.") } catch { /* printing is best-effort */ }
      }
      router.push("/dashboard/tailor/orders")
    } catch (e) {
      setErr(apiError(e, "Failed to create order"))
      setSaving(false)
    }
  }

  if (blocked) return blocked
  if (!writable) return <div className="p-6 text-sm text-dash-muted">You do not have permission to create tailor orders.</div>

  const garmentsSaved = Array.from(new Set(custMeas.map((m) => m.productType))).join(", ")
  const phoneGuess = /^[0-9+\-\s]+$/.test(cq.trim()) ? cq.trim() : ""

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div>
        <h1 className="font-dash-display text-[32px] font-bold tracking-tight">New tailor order</h1>
        <p className="mt-1 text-sm text-dash-muted">Customer, garments, delivery — then take the advance.</p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* 1 · Customer */}
          <section className={card}>
            <h2 className={h2}><StepNo n={1} />Customer</h2>
            {!cust && (
              <>
                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
                    <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search</span>
                    <input type="search" value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Phone number or name"
                      className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
                  </label>
                  <button type="button" onClick={() => setShowNew((v) => !v)} className="text-[13px] font-semibold text-dash-accent hover:underline">{showNew ? "Hide new customer" : "+ New customer"}</button>
                </div>
                {results.length > 0 && (
                  <div className="flex flex-col overflow-hidden rounded-xl border border-dash-border">
                    {results.map((c) => (
                      <button key={c.id} type="button" onClick={() => pickCustomer(c)} className="flex items-center gap-3 border-b border-dash-border-soft px-3 py-2.5 text-left last:border-0 hover:bg-dash-neutral-soft">
                        <span className="flex size-8 items-center justify-center rounded-full bg-dash-accent-soft text-xs font-bold text-dash-accent-fg">{ini(c.name)}</span>
                        <span className="flex-1 text-sm font-semibold">{c.name}</span>
                        <span className="text-xs text-dash-muted">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {(showNew || (searched && cq.trim() && results.length === 0)) && (
                  <div className="flex flex-col gap-3 rounded-xl border border-dashed border-dash-border bg-dash-bg p-4">
                    <span className="text-[13px] font-semibold text-dash-muted">{showNew ? "New customer" : "No customer matches — add them now"}</span>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={label}>Name *<input className={tInput} value={nc.name} onChange={(e) => { setNc({ ...nc, name: e.target.value }); setNcErr("") }} placeholder="Full name" /></label>
                      <label className={label}>Phone *<input type="tel" className={tInput} value={nc.phone || phoneGuess} onChange={(e) => { setNc({ ...nc, phone: e.target.value }); setNcErr("") }} placeholder="01XXX-XXXXXX" /></label>
                    </div>
                    <label className={label}>Address<input className={tInput} value={nc.addr} onChange={(e) => setNc({ ...nc, addr: e.target.value })} placeholder="Optional" /></label>
                    <span role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{ncErr}</span>
                    <div><button type="button" disabled={ncSaving} onClick={saveNewCustomer} className={tPrimaryBtn}>{ncSaving ? "Saving…" : "Save & select customer"}</button></div>
                  </div>
                )}
                {!cq.trim() && <span className="text-[13px] text-dash-muted">Search and select a customer to start the order.</span>}
              </>
            )}
            {cust && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dash-border bg-dash-bg px-3.5 py-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-dash-accent-soft text-sm font-bold text-dash-accent-fg">{ini(cust.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{cust.name}{cust.phone ? ` · ${cust.phone}` : ""}</div>
                  <div className="text-xs text-dash-muted">{custInfo ? `${custInfo.orders} tailor order${custInfo.orders === 1 ? "" : "s"} · ` : ""}saved measurements: {garmentsSaved || "none"}{custInfo ? ` · ${fc(custInfo.due)} due` : ""}</div>
                </div>
                <button type="button" onClick={() => { setCust(null); setCustMeas([]); setCustInfo(null) }} className="text-[13px] font-semibold text-dash-accent hover:underline">Change</button>
                <Link href="/dashboard/tailor/measurements" className="text-[13px] font-semibold text-dash-accent hover:underline">View measurements</Link>
              </div>
            )}
          </section>

          {/* 2 · What to make */}
          <section className={card}>
            <h2 className={h2}><StepNo n={2} />What to make</h2>
            {its.map((it, i) => {
              const c = calc[i]
              const measId = it.measId === undefined ? autoMeas(it.g) : it.measId
              const meas = measId ? custMeas.find((m) => m.id === Number(measId)) : undefined
              const short = c.f && it.meters > c.f.stockQuantity
              const sug = suggest(it.g, c.qty)
              const styleOpts = Object.entries(STYLE_OPTS).find(([k]) => same(k, it.g))?.[1] ?? []
              return (
                <article key={i} className="flex flex-col gap-4 rounded-xl border border-dash-border bg-dash-bg p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold">Item {i + 1} · {it.g}</span>
                    <span className="flex items-center gap-3">
                      {its.length > 1 && <button type="button" onClick={() => setIts((p) => p.filter((_, j) => j !== i))} className="text-[13px] font-semibold text-dash-danger-fg hover:underline">Remove</button>}
                      <span className="font-bold tabular-nums">{fc(c.stitch + c.fabCost)}</span>
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className={caption}>Garment</span>
                    <div className="flex flex-wrap gap-2">
                      {garmentList.map((g) => {
                        const on = same(it.g, g)
                        const rate = hint(g)?.lastPrice
                        return (
                          <button key={g} type="button" aria-pressed={on} className={chip(on)}
                            onClick={() => setIt(i, { g, opts: {}, rate: rate ?? 0, measId: undefined, meters: it.own ? 0 : suggest(g, c.qty) })}>
                            <span className="block">{g}</span>{rate ? <span className="block text-[11px] font-normal opacity-70">{fc(rate)}</span> : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className={caption}>Measurement</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <select aria-label="Measurement profile" className={cn(tInput, "w-auto min-w-[220px]")} value={measId ?? ""} onChange={(e) => setIt(i, { measId: e.target.value })}>
                        <option value="">{custMeas.length ? "No measurement" : "No saved measurements"}</option>
                        {custMeas.map((m) => <option key={m.id} value={m.id}>{m.productType} · {new Date(m.measuredAt).toLocaleDateString()}</option>)}
                      </select>
                      <span className="min-w-0 flex-1 text-xs text-dash-muted">{meas ? measurementText(meas) : cust ? "No measurement selected" : "Pick a customer first"}</span>
                      <Link href="/dashboard/tailor/measurements" className="text-[13px] font-semibold text-dash-accent hover:underline">Change / new</Link>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className={caption}>Fabric</span>
                    <div role="radiogroup" aria-label="Fabric source" className="inline-flex w-fit rounded-[10px] bg-dash-neutral-soft p-1">
                      {([[true, "Customer’s fabric"], [false, "From shop stock"]] as const).map(([own, l]) => (
                        <button key={l} type="button" role="radio" aria-checked={it.own === own}
                          onClick={() => setIt(i, { own, meters: own ? 0 : suggest(it.g, c.qty), fabricId: own ? "" : it.fabricId })}
                          className={cn("rounded-lg px-3 py-1.5 text-[13px] font-semibold", it.own === own ? "bg-dash-card shadow-sm" : "text-dash-muted")}>{l}</button>
                      ))}
                    </div>
                    {!it.own && (
                      <div className="flex flex-col gap-2.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <select aria-label="Fabric" className={cn(tInput, "min-w-[260px] flex-1")} value={it.fabricId}
                            onChange={(e) => setIt(i, { fabricId: e.target.value, price: undefined, meters: it.meters || suggest(it.g, c.qty) })}>
                            <option value="">{fabrics.length ? "Choose fabric…" : "No fabrics in stock list"}</option>
                            {fabrics.map((f) => <option key={f.id} value={f.id}>{f.name}{f.color ? ` · ${f.color}` : ""} — {fc(f.sellingPrice)}/{f.unit} · {f.stockQuantity} {f.unit} left</option>)}
                          </select>
                          <span className="flex items-center gap-2 text-sm">
                            <span className="flex">
                              <button type="button" aria-label="Decrease quantity" className={cn(stepper, "rounded-l-lg")} onClick={() => setIt(i, { meters: Math.max(0.5, r2(it.meters - 0.5)) })}>−</button>
                              <span className="flex h-9 min-w-12 items-center justify-center border-y border-dash-border bg-dash-card px-2 tabular-nums">{it.meters}</span>
                              <button type="button" aria-label="Increase quantity" className={cn(stepper, "rounded-r-lg")} onClick={() => setIt(i, { meters: r2(it.meters + 0.5) })}>+</button>
                            </span>
                            {c.f?.unit ?? "m"}
                          </span>
                        </div>
                        {c.f && (
                          <label className={cn(label, "max-w-[220px]")}>Fabric price / {c.f.unit}
                            <input type="number" min={0} className={tInput} aria-label="Fabric price per unit" value={c.unitPrice} onChange={(e) => setIt(i, { price: Math.max(0, num(e.target.value)) })} />
                          </label>
                        )}
                        <span className="text-xs text-dash-muted">
                          {sug > 0 ? `Suggested ${sug} ${c.f?.unit ?? ""} for ${c.qty} ${it.g} (from past orders)` : ""}
                          {c.f ? ` ${sug > 0 ? "· " : ""}${fc(c.fabCost)} fabric${short ? ` · only ${c.f.stockQuantity} ${c.f.unit} in stock (cutting will be blocked until restocked)` : ""}` : ""}
                        </span>
                      </div>
                    )}
                    {it.own && <input className={tInput} value={it.ownNote} onChange={(e) => setIt(i, { ownNote: e.target.value })} placeholder="Describe the customer’s fabric, e.g. 2.5 m red georgette" />}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[auto_180px_1fr]">
                    <div className="flex flex-col gap-1.5">
                      <span className={caption}>Quantity</span>
                      <span className="flex">
                        <button type="button" aria-label="Decrease quantity" className={cn(stepper, "rounded-l-lg")}
                          onClick={() => setIt(i, { qty: Math.max(1, c.qty - 1), meters: !it.own && it.meters === suggest(it.g, c.qty) ? suggest(it.g, Math.max(1, c.qty - 1)) : it.meters })}>−</button>
                        <span className="flex h-9 min-w-12 items-center justify-center border-y border-dash-border bg-dash-card px-2 tabular-nums">{c.qty}</span>
                        <button type="button" aria-label="Increase quantity" className={cn(stepper, "rounded-r-lg")}
                          onClick={() => setIt(i, { qty: c.qty + 1, meters: !it.own && it.meters === suggest(it.g, c.qty) ? suggest(it.g, c.qty + 1) : it.meters })}>+</button>
                      </span>
                    </div>
                    <label className={label}>Stitching (each)<input type="number" min={0} className={tInput} value={it.rate} onChange={(e) => setIt(i, { rate: Math.max(0, num(e.target.value)) })} /></label>
                    {styleOpts.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className={caption}>Style options</span>
                        <div role="group" aria-label="Style options" className="flex flex-wrap gap-1.5">
                          {styleOpts.map((o) => {
                            const on = !!it.opts[o]
                            return <button key={o} type="button" aria-pressed={on} onClick={() => setIt(i, { opts: { ...it.opts, [o]: !on } })}
                              className={cn("h-8 rounded-full border px-3 text-xs font-semibold", on ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{on ? "✓ " : ""}{o}</button>
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <label className={label}>Note for dorji<input className={tInput} value={it.note} onChange={(e) => setIt(i, { note: e.target.value })} placeholder="e.g. Boat neck, back zip, no lining" /></label>
                </article>
              )
            })}
            <button type="button" onClick={() => setIts((p) => [...p, blank()])} className={cn(tOutlineBtn, "w-fit")}>+ Add another garment</button>
          </section>

          {/* 3 · Delivery & dorji */}
          <section className={card}>
            <h2 className={h2}><StepNo n={3} />Delivery &amp; dorji</h2>
            <label className={cn(label, "max-w-[220px]")}>Order date<input type="date" max={today} className={tInput} value={orderDate} onChange={(e) => { setOrderDate(e.target.value); setErr("") }} /></label>
            <div className="flex flex-col gap-1.5">
              <span className={caption}>Delivery date</span>
              <div className="flex flex-wrap items-center gap-3">
                <div role="group" aria-label="Delivery date" className="flex flex-wrap gap-1.5">
                  {[3, 5, 7, 10].map((n) => {
                    const v = addDays(n), on = date === v
                    return <button key={n} type="button" aria-pressed={on} onClick={() => { setDate(v); setErr("") }}
                      className={cn("h-9 rounded-[10px] border px-3 text-[13px] font-semibold", on ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>+{n} days</button>
                  })}
                </div>
                <input type="date" aria-label="Delivery date" className={cn(tInput, "w-auto")} value={date} onChange={(e) => { setDate(e.target.value); setErr("") }} />
              </div>
              <span className="text-xs text-dash-muted">{loadHint}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={caption}>Urgency</span>
              <div role="radiogroup" aria-label="Urgency" className="flex flex-wrap gap-2">
                <button type="button" role="radio" aria-checked={!urgent} onClick={() => setUrgent(false)} className={chip(!urgent)}>Normal</button>
                <button type="button" role="radio" aria-checked={urgent} onClick={() => setUrgent(true)} className={chip(urgent)}>
                  Urgent<span className="block text-[11px] font-normal opacity-70">+{fc(opts?.urgentFee ?? 0)} · jumps the queue</span>
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={caption}>Assign to dorji (optional)</span>
              <div className="flex flex-wrap gap-2">
                {(opts?.dorjis ?? []).map((d) => {
                  const on = dz === d.id
                  return (
                    <button key={d.id} type="button" aria-pressed={on} onClick={() => setDz(on ? null : d.id)} className={chip(on)}>
                      <span className="block">{d.name}</span>
                      <span className={cn("block text-[11px] font-normal", d.open >= 6 ? "text-dash-danger" : "text-dash-success-fg")}>{d.open} open order{d.open === 1 ? "" : "s"}{d.speciality.length ? ` · ${d.speciality.join(", ")}` : ""}</span>
                    </button>
                  )
                })}
              </div>
              {opts && opts.dorjis.length === 0 && <span className="text-xs text-dash-muted">No active dorjis yet. Add them under Dorjis, or leave unassigned.</span>}
            </div>
            <label className={label}>Order notes
              <textarea rows={2} className={cn(tInput, "h-auto py-2.5")} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Anything the shop should remember about this order" />
            </label>
          </section>
        </div>

        {/* Order summary */}
        <aside className="flex flex-col gap-4 rounded-[14px] border border-dash-border bg-dash-card p-5 lg:sticky lg:top-4">
          <h2 className="font-dash-display text-lg font-bold">Order summary</h2>
          <div className="flex flex-col gap-2 text-[13px]">
            <Row l="Stitching" v={fc(stitch)} />
            <Row l="Fabric" v={fc(fab)} />
            <Row l="Urgent charge" v={fc(urgFee)} />
            <div className="flex items-center justify-between gap-3"><label htmlFor="t-extra" className="text-dash-muted">Extra charge</label>
              <input id="t-extra" type="number" min={0} className={cn(tInput, "h-9 w-28 text-right")} value={extra} onChange={(e) => setExtra(Math.max(0, num(e.target.value)))} /></div>
            <div className="flex items-center justify-between gap-3"><label htmlFor="t-disc" className="text-dash-muted">Discount</label>
              <input id="t-disc" type="number" min={0} className={cn(tInput, "h-9 w-28 text-right")} value={disc} onChange={(e) => setDisc(Math.max(0, num(e.target.value)))} /></div>
            <div className="flex items-baseline justify-between border-t border-dashed border-dash-border pt-2">
              <span className="font-bold">Total</span><span className="font-dash-display text-2xl font-bold tabular-nums">{fc(total)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className={caption}>Advance</span>
            <div role="group" aria-label="Advance" className="flex gap-1.5">
              {([["none", "None"], ["half", "50%"], ["full", "Full"]] as const).map(([id, l]) => {
                const on = advMode === id && advManual === undefined
                return <button key={id} type="button" aria-pressed={on} onClick={() => { setAdvMode(id); setAdvManual(undefined); setErr("") }}
                  className={cn("h-9 flex-1 rounded-[10px] border text-[13px] font-semibold", on ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{l}</button>
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} aria-label="Advance amount" className={tInput} value={adv} onChange={(e) => { setAdvManual(Math.max(0, num(e.target.value))); setErr("") }} />
              <select aria-label="Method" className={tInput} value={method} onChange={(e) => setMethod(e.target.value)}>{TAILOR_PAY_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
            </div>
          </div>

          <div className={cn("flex items-center justify-between rounded-[10px] px-3.5 py-2.5 text-sm font-semibold", due ? "bg-dash-warn-soft text-dash-warn-fg" : "bg-dash-success-soft text-dash-success-fg")}>
            <span>Due on delivery</span><span className="tabular-nums">{fc(due)}</span>
          </div>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="size-4" checked={printAfter} onChange={() => setPrintAfter((v) => !v)} />Print job card after saving</label>
          {err && <p role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
          <div className="flex gap-2">
            <Link href="/dashboard/tailor/orders" className={cn(tOutlineBtn, "flex-1")}>Cancel</Link>
            <button type="button" disabled={saving} onClick={save} className={cn(tPrimaryBtn, "flex-1")}>{saving ? "Creating…" : "Create order"}</button>
          </div>
        </aside>
      </div>
    </div>
  )
}

function StepNo({ n }: { n: number }) {
  return <span className="flex size-7 items-center justify-center rounded-full bg-dash-accent-soft text-[13px] font-bold text-dash-accent-fg">{n}</span>
}

function Row({ l, v }: { l: string; v: string }) {
  return <div className="flex justify-between"><span className="text-dash-muted">{l}</span><span className="font-semibold tabular-nums">{v}</span></div>
}
