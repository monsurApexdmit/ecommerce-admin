"use client"

import { type ReactNode, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { toast } from "sonner"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { Card } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiError, todayIso } from "@/components/tailor/order-ui"
import {
  GARMENT_DEFAULTS, PRODUCT_TYPES, TAILOR_PAY_METHODS, tailorApi, tailorCustomerSummary, tailorOrdersApi,
  type TailorCustomer, type TailorFabric, type TailorMeasurement, type TailorOrderFormOptions,
} from "@/lib/tailorApi"
import { measurementText, printJobCard } from "@/lib/tailorOrderPrint"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { WithTooltip } from "@/components/common/WithTooltip"

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
const same = (a: string, b: string) => { const n = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "").replace(/^sh/, "s").replace(/s$/, ""); return n(a) === n(b) }

const chipVariant = (on: boolean) => (on ? "default" : "outline") as "default" | "outline"
const chipCls = "h-auto flex-col items-start gap-0 text-left whitespace-normal"

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
  if (!writable) return <div className="p-6 text-sm text-muted-foreground">You do not have permission to create tailor orders.</div>

  const garmentsSaved = Array.from(new Set(custMeas.map((m) => m.productType))).join(", ")
  const phoneGuess = /^[0-9+\-\s]+$/.test(cq.trim()) ? cq.trim() : ""

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader title="New tailor order" description="Customer, garments, delivery — then take the advance." />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* 1 · Customer */}
          <SectionCard title={<StepTitle n={1}>Customer</StepTitle>} contentClassName="flex flex-col gap-4">
            {!cust && (
              <>
                <div className="flex flex-wrap items-center gap-2.5">
                  <InputGroup className="min-w-[240px] flex-1">
                    <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
                    <InputGroupInput type="search" aria-label="Search" value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Phone number or name" />
                  </InputGroup>
                  <Button type="button" variant="link" onClick={() => setShowNew((v) => !v)}>{showNew ? "Hide new customer" : "+ New customer"}</Button>
                </div>
                {results.length > 0 && (
                  <Card className="gap-0 overflow-hidden py-0">
                    {results.map((c) => (
                      <Button key={c.id} type="button" variant="ghost" onClick={() => pickCustomer(c)} className="h-auto w-full justify-start gap-3 rounded-none text-left">
                        <UserAvatar name={c.name} className="size-8" />
                        <span className="flex-1 text-sm font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.phone}</span>
                      </Button>
                    ))}
                  </Card>
                )}
                {(showNew || (searched && cq.trim() && results.length === 0)) && (
                  <Card className="gap-3 border-dashed p-4">
                    <p className="text-sm font-medium text-muted-foreground">{showNew ? "New customer" : "No customer matches — add them now"}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField label="Name" required htmlFor="nc-name"><Input id="nc-name" value={nc.name} onChange={(e) => { setNc({ ...nc, name: e.target.value }); setNcErr("") }} placeholder="Full name" /></FormField>
                      <FormField label="Phone" required htmlFor="nc-phone"><Input id="nc-phone" type="tel" value={nc.phone || phoneGuess} onChange={(e) => { setNc({ ...nc, phone: e.target.value }); setNcErr("") }} placeholder="01XXX-XXXXXX" /></FormField>
                    </div>
                    <FormField label="Address" htmlFor="nc-addr"><Input id="nc-addr" value={nc.addr} onChange={(e) => setNc({ ...nc, addr: e.target.value })} placeholder="Optional" /></FormField>
                    <span role="alert" className="text-sm font-medium text-destructive">{ncErr}</span>
                    <div><Button type="button" disabled={ncSaving} onClick={saveNewCustomer}>{ncSaving ? "Saving…" : "Save & select customer"}</Button></div>
                  </Card>
                )}
                {!cq.trim() && <span className="text-sm text-muted-foreground">Search and select a customer to start the order.</span>}
              </>
            )}
            {cust && (
              <Item variant="outline">
                <ItemMedia><UserAvatar name={cust.name} className="size-10" /></ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{cust.name}{cust.phone ? ` · ${cust.phone}` : ""}</ItemTitle>
                  <ItemDescription className="text-xs">{custInfo ? `${custInfo.orders} tailor order${custInfo.orders === 1 ? "" : "s"} · ` : ""}saved measurements: {garmentsSaved || "none"}{custInfo ? ` · ${fc(custInfo.due)} due` : ""}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button type="button" variant="link" onClick={() => { setCust(null); setCustMeas([]); setCustInfo(null) }}>Change</Button>
                  <Button asChild variant="link"><Link href="/dashboard/tailor/measurements">View measurements</Link></Button>
                </ItemActions>
              </Item>
            )}
          </SectionCard>

          {/* 2 · What to make */}
          <SectionCard title={<StepTitle n={2}>What to make</StepTitle>} contentClassName="flex flex-col gap-4">
            {its.map((it, i) => {
              const c = calc[i]
              const measId = it.measId === undefined ? autoMeas(it.g) : it.measId
              const meas = measId ? custMeas.find((m) => m.id === Number(measId)) : undefined
              const short = c.f && it.meters > c.f.stockQuantity
              const sug = suggest(it.g, c.qty)
              const styleOpts = Object.entries(STYLE_OPTS).find(([k]) => same(k, it.g))?.[1] ?? []
              return (
                <Card key={i} className="gap-4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Item {i + 1} · {it.g}</span>
                    <span className="flex items-center gap-3">
                      {its.length > 1 && <Button type="button" variant="destructive" size="sm" onClick={() => setIts((p) => p.filter((_, j) => j !== i))}>Remove</Button>}
                      <span className="font-semibold tabular-nums">{fc(c.stitch + c.fabCost)}</span>
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <SectionTitle as="p">Garment</SectionTitle>
                    <div className="flex flex-wrap gap-2">
                      {garmentList.map((g) => {
                        const on = same(it.g, g)
                        const rate = hint(g)?.lastPrice
                        return (
                          <Button key={g} type="button" aria-pressed={on} variant={chipVariant(on)} className={chipCls}
                            onClick={() => setIt(i, { g, opts: {}, rate: rate ?? 0, measId: undefined, meters: it.own ? 0 : suggest(g, c.qty) })}>
                            <span className="block">{g}</span>{rate ? <span className="block text-[11px] font-normal opacity-70">{fc(rate)}</span> : null}
                          </Button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <SectionTitle as="p">Measurement</SectionTitle>
                    <div className="flex flex-wrap items-center gap-3">
                      <Select value={measId ? String(measId) : "__none"} onValueChange={(v) => setIt(i, { measId: v === "__none" ? "" : v })}>
                        <SelectTrigger aria-label="Measurement profile" className="min-w-[220px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">{custMeas.length ? "No measurement" : "No saved measurements"}</SelectItem>
                          {custMeas.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.productType} · {new Date(m.measuredAt).toLocaleDateString()}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <span className="min-w-0 flex-1 text-xs text-muted-foreground">{meas ? measurementText(meas) : cust ? "No measurement selected" : "Pick a customer first"}</span>
                      <Button asChild variant="link" size="sm"><Link href="/dashboard/tailor/measurements">Change / new</Link></Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <SectionTitle as="p">Fabric</SectionTitle>
                    <SegmentedControl aria-label="Fabric source" className="w-fit" value={it.own ? "own" : "shop"}
                      options={[{ value: "own", label: "Customer’s fabric" }, { value: "shop", label: "From shop stock" }]}
                      onValueChange={(v) => { const own = v === "own"; setIt(i, { own, meters: own ? 0 : suggest(it.g, c.qty), fabricId: own ? "" : it.fabricId }) }} />
                    {!it.own && (
                      <div className="flex flex-col gap-2.5">
                        <div className="flex flex-wrap items-center gap-3">
                          <Select value={it.fabricId || "__none"}
                            onValueChange={(v) => setIt(i, { fabricId: v === "__none" ? "" : v, price: undefined, meters: it.meters || suggest(it.g, c.qty) })}>
                            <SelectTrigger aria-label="Fabric" className="min-w-[260px] flex-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">{fabrics.length ? "Choose fabric…" : "No fabrics in stock list"}</SelectItem>
                              {fabrics.map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.name}{f.color ? ` · ${f.color}` : ""} — {fc(f.sellingPrice)}/{f.unit} · {f.stockQuantity} {f.unit} left</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <span className="flex items-center gap-2 text-sm">
                            <ButtonGroup>
                              <WithTooltip content="Decrease quantity"><Button type="button" variant="outline" size="icon" aria-label="Decrease quantity" onClick={() => setIt(i, { meters: Math.max(0.5, r2(it.meters - 0.5)) })}>−</Button></WithTooltip>
                              <ButtonGroupText className="min-w-12 justify-center tabular-nums">{it.meters}</ButtonGroupText>
                              <WithTooltip content="Increase quantity"><Button type="button" variant="outline" size="icon" aria-label="Increase quantity" onClick={() => setIt(i, { meters: r2(it.meters + 0.5) })}>+</Button></WithTooltip>
                            </ButtonGroup>
                            {c.f?.unit ?? "m"}
                          </span>
                        </div>
                        {c.f && (
                          <FormField className="max-w-[220px]" label={`Fabric price / ${c.f.unit}`} htmlFor={`fab-price-${i}`}>
                            <Input id={`fab-price-${i}`} type="number" min={0} aria-label="Fabric price per unit" value={c.unitPrice} onChange={(e) => setIt(i, { price: Math.max(0, num(e.target.value)) })} />
                          </FormField>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {sug > 0 ? `Suggested ${sug} ${c.f?.unit ?? ""} for ${c.qty} ${it.g} (from past orders)` : ""}
                          {c.f ? ` ${sug > 0 ? "· " : ""}${fc(c.fabCost)} fabric${short ? ` · only ${c.f.stockQuantity} ${c.f.unit} in stock (cutting will be blocked until restocked)` : ""}` : ""}
                        </span>
                      </div>
                    )}
                    {it.own && <Input value={it.ownNote} onChange={(e) => setIt(i, { ownNote: e.target.value })} placeholder="Describe the customer’s fabric, e.g. 2.5 m red georgette" />}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[auto_180px_1fr]">
                    <div className="flex flex-col gap-1.5">
                      <SectionTitle as="p">Quantity</SectionTitle>
                      <ButtonGroup>
                        <WithTooltip content="Decrease quantity"><Button type="button" variant="outline" size="icon" aria-label="Decrease quantity"
                          onClick={() => setIt(i, { qty: Math.max(1, c.qty - 1), meters: !it.own && it.meters === suggest(it.g, c.qty) ? suggest(it.g, Math.max(1, c.qty - 1)) : it.meters })}>−</Button></WithTooltip>
                        <ButtonGroupText className="min-w-12 justify-center tabular-nums">{c.qty}</ButtonGroupText>
                        <WithTooltip content="Increase quantity"><Button type="button" variant="outline" size="icon" aria-label="Increase quantity"
                          onClick={() => setIt(i, { qty: c.qty + 1, meters: !it.own && it.meters === suggest(it.g, c.qty) ? suggest(it.g, c.qty + 1) : it.meters })}>+</Button></WithTooltip>
                      </ButtonGroup>
                    </div>
                    <FormField label="Stitching (each)" htmlFor={`rate-${i}`}><Input id={`rate-${i}`} type="number" min={0} value={it.rate} onChange={(e) => setIt(i, { rate: Math.max(0, num(e.target.value)) })} /></FormField>
                    {styleOpts.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <SectionTitle as="p">Style options</SectionTitle>
                        <div role="group" aria-label="Style options" className="flex flex-wrap gap-1.5">
                          {styleOpts.map((o) => {
                            const on = !!it.opts[o]
                            return <Button key={o} type="button" aria-pressed={on} onClick={() => setIt(i, { opts: { ...it.opts, [o]: !on } })}
                              variant={on ? "default" : "outline"} size="sm">{on ? "✓ " : ""}{o}</Button>
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <FormField label="Note for dorji" htmlFor={`note-${i}`}><Input id={`note-${i}`} value={it.note} onChange={(e) => setIt(i, { note: e.target.value })} placeholder="e.g. Boat neck, back zip, no lining" /></FormField>
                </Card>
              )
            })}
            <Button type="button" variant="outline" onClick={() => setIts((p) => [...p, blank()])} className="w-fit">+ Add another garment</Button>
          </SectionCard>

          {/* 3 · Delivery & dorji */}
          <SectionCard title={<StepTitle n={3}>Delivery &amp; dorji</StepTitle>} contentClassName="flex flex-col gap-4">
            <FormField className="max-w-[220px]" label="Order date" htmlFor="order-date"><Input id="order-date" type="date" max={today} value={orderDate} onChange={(e) => { setOrderDate(e.target.value); setErr("") }} /></FormField>
            <div className="flex flex-col gap-1.5">
              <SectionTitle as="p">Delivery date</SectionTitle>
              <div className="flex flex-wrap items-center gap-3">
                <div role="group" aria-label="Delivery date" className="flex flex-wrap gap-1.5">
                  {[3, 5, 7, 10].map((n) => {
                    const v = addDays(n), on = date === v
                    return <Button key={n} type="button" aria-pressed={on} onClick={() => { setDate(v); setErr("") }}
                      variant={on ? "default" : "outline"}>+{n} days</Button>
                  })}
                </div>
                <Input type="date" aria-label="Delivery date" className="w-auto" value={date} onChange={(e) => { setDate(e.target.value); setErr("") }} />
              </div>
              <span className="text-xs text-muted-foreground">{loadHint}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <SectionTitle as="p">Urgency</SectionTitle>
              <ChoiceCardGroup aria-label="Urgency" className="grid-cols-2 sm:max-w-md" value={urgent ? "urgent" : "normal"} onValueChange={(v) => setUrgent(v === "urgent")}>
                <ChoiceCard value="normal" title="Normal" />
                <ChoiceCard value="urgent" title="Urgent" description={`+${fc(opts?.urgentFee ?? 0)} · jumps the queue`} />
              </ChoiceCardGroup>
            </div>
            <div className="flex flex-col gap-1.5">
              <SectionTitle as="p">Assign to dorji (optional)</SectionTitle>
              {/* clicking the selected dorji again clears the assignment */}
              <ChoiceCardGroup aria-label="Assign to dorji" className="grid-cols-[repeat(auto-fill,minmax(180px,1fr))]"
                value={dz != null ? String(dz) : undefined} onValueChange={(v) => setDz(dz === Number(v) ? null : Number(v))}>
                {(opts?.dorjis ?? []).map((d) => (
                  <ChoiceCard key={d.id} value={String(d.id)} title={d.name}
                    description={<span className={d.open >= 6 ? "text-destructive" : "text-dash-success-fg"}>{d.open} open order{d.open === 1 ? "" : "s"}{d.speciality.length ? ` · ${d.speciality.join(", ")}` : ""}</span>} />
                ))}
              </ChoiceCardGroup>
              {opts && opts.dorjis.length === 0 && <span className="text-xs text-muted-foreground">No active dorjis yet. Add them under Dorjis, or leave unassigned.</span>}
            </div>
            <FormField label="Order notes" htmlFor="order-notes">
              <Textarea id="order-notes" rows={2} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} placeholder="Anything the shop should remember about this order" />
            </FormField>
          </SectionCard>
        </div>

        {/* Order summary */}
        <SectionCard title="Order summary" className="lg:sticky lg:top-4" contentClassName="flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-sm">
            <InfoList>
              <InfoRow label="Stitching"><span className="tabular-nums">{fc(stitch)}</span></InfoRow>
              <InfoRow label="Fabric"><span className="tabular-nums">{fc(fab)}</span></InfoRow>
              <InfoRow label="Urgent charge"><span className="tabular-nums">{fc(urgFee)}</span></InfoRow>
            </InfoList>
            <FormField orientation="horizontal" className="justify-between gap-3" label="Extra charge" htmlFor="t-extra">
              <Input id="t-extra" type="number" min={0} className="w-28 text-right" value={extra} onChange={(e) => setExtra(Math.max(0, num(e.target.value)))} />
            </FormField>
            <FormField orientation="horizontal" className="justify-between gap-3" label="Discount" htmlFor="t-disc">
              <Input id="t-disc" type="number" min={0} className="w-28 text-right" value={disc} onChange={(e) => setDisc(Math.max(0, num(e.target.value)))} />
            </FormField>
            <Separator />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">Total</span><span className="text-2xl font-semibold tabular-nums">{fc(total)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <SectionTitle as="p">Advance</SectionTitle>
            <div role="group" aria-label="Advance" className="flex gap-1.5">
              {([["none", "None"], ["half", "50%"], ["full", "Full"]] as const).map(([id, l]) => {
                const on = advMode === id && advManual === undefined
                return <Button key={id} type="button" aria-pressed={on} onClick={() => { setAdvMode(id); setAdvManual(undefined); setErr("") }}
                  variant={on ? "default" : "outline"} className="flex-1">{l}</Button>
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min={0} aria-label="Advance amount" value={adv} onChange={(e) => { setAdvManual(Math.max(0, num(e.target.value))); setErr("") }} />
              <Select value={method} onValueChange={(v) => setMethod(v)}><SelectTrigger aria-label="Method" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TAILOR_PAY_METHODS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>

          <Card className="p-3.5">
            <InfoList>
              <InfoRow label="Due on delivery"><span className={cn("tabular-nums", due ? "text-dash-warn-fg" : "text-dash-success-fg")}>{fc(due)}</span></InfoRow>
            </InfoList>
          </Card>
          <Label><Checkbox checked={printAfter} onCheckedChange={(v) => setPrintAfter(v === true)} />Print job card after saving</Label>
          {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}
          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1"><Link href="/dashboard/tailor/orders">Cancel</Link></Button>
            <Button type="button" disabled={saving} onClick={save} className="flex-1">{saving ? "Creating…" : "Create order"}</Button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function StepTitle({ n, children }: { n: number; children: ReactNode }) {
  return <span className="flex items-center gap-2.5"><Badge variant="secondary" className="size-7 rounded-full">{n}</Badge>{children}</span>
}
