"use client"

import { useCallback, useEffect, useState } from "react"
import { Banknote, Landmark, CreditCard, Wallet, QrCode, Smartphone, Pencil, Trash2, Plus } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import paymentMethodApi, { type PaymentGatewayType, type PaymentMethod } from "@/lib/paymentMethodApi"
import { settingsApi, type PaymentSettings } from "@/lib/settingsApi"

const ICONS = [
  { value: "banknote", label: "Banknote (Cash)", Icon: Banknote },
  { value: "landmark", label: "Landmark (Bank)", Icon: Landmark },
  { value: "credit-card", label: "Credit Card", Icon: CreditCard },
  { value: "wallet", label: "Wallet", Icon: Wallet },
  { value: "qr-code", label: "QR Code", Icon: QrCode },
  { value: "smartphone", label: "Mobile Pay", Icon: Smartphone },
]
const iconOf = (v: string | null) => (ICONS.find((o) => o.value === v) ?? ICONS[0]).Icon

const GATEWAYS: { value: PaymentGatewayType | string; label: string }[] = [
  { value: "cod", label: "Cash on Delivery (manual)" },
  { value: "sslcommerz", label: "SSLCommerz (bKash, Nagad, Rocket, Cards)" },
  { value: "portwallet", label: "PortWallet (Cards, Mobile Banking)" },
  { value: "stripe", label: "Stripe (Credit / Debit Card)" },
  { value: "paypal", label: "PayPal" },
  { value: "bkash", label: "bKash (Direct)" },
  { value: "nagad", label: "Nagad (Direct)" },
  { value: "manual", label: "Manual / Bank Transfer (offline)" },
]
const gatewayLabel = (g: string) => GATEWAYS.find((x) => x.value === g)?.label ?? g
const NEEDS_KEYS = ["sslcommerz", "portwallet", "stripe", "paypal", "bkash", "nagad"]

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft disabled:opacity-50"
const primaryBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft disabled:opacity-50"

function Switch({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick}
      className={cn("flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50", on ? "bg-dash-accent justify-end" : "bg-dash-border justify-start")}>
      <span className="size-4 rounded-full bg-white" />
    </button>
  )
}

type Fixed = { slug: string; name: string; ini: string; color: string; sub: string; where: string[]; gateway: boolean; fields: [string, string, string][] }
const FIXED: Fixed[] = [
  { slug: "cash", name: "Cash", ini: "$", color: "#0F766E", sub: "Cash at the counter", where: ["POS"], gateway: false, fields: [] },
  { slug: "bkash", name: "bKash", ini: "bK", color: "#D12053", sub: "Mobile wallet — merchant or personal number", where: ["POS", "Online"], gateway: true, fields: [["account", "bKash number", "01XXXXXXXXX"], ["accountName", "Account name", "Merchant name"]] },
  { slug: "nagad", name: "Nagad", ini: "Ng", color: "#E8590C", sub: "Mobile wallet — merchant or personal number", where: ["POS", "Online"], gateway: true, fields: [["account", "Nagad number", "01XXXXXXXXX"], ["accountName", "Account name", "Merchant name"]] },
  { slug: "card", name: "Card", ini: "Cd", color: "#1F2F5C", sub: "Debit and credit cards via POS terminal", where: ["POS", "Online"], gateway: true, fields: [["account", "Terminal / merchant ID", "e.g. MID-1042"], ["accountName", "Acquirer / bank", "e.g. City Bank"]] },
  { slug: "bank", name: "Bank transfer", ini: "Bk", color: "#3B4458", sub: "Direct deposit to your bank account", where: ["Online"], gateway: false, fields: [["account", "Account number", "0000000000"], ["accountName", "Account name", "Business name"], ["bankName", "Bank & branch", "e.g. Dutch-Bangla, Mirpur"]] },
  { slug: "cod", name: "Cash on delivery", ini: "COD", color: "#6D28D9", sub: "Pay when the order arrives", where: ["Online"], gateway: false, fields: [] },
]
type Channel = "pos" | "online"
type MState = { enabled: boolean; test: boolean; fields: Record<string, string>; channels: Channel[] }
type MMap = Record<string, MState>
const DEF_ON: Record<string, boolean> = { cash: true, cod: true }
const buildMethods = (p?: PaymentSettings | null): MMap => {
  const out: MMap = {}
  FIXED.forEach((f) => {
    const sm = p?.methods?.[f.slug]
    const fl: Record<string, string> = {}
    f.fields.forEach(([k]) => { fl[k] = (sm?.fields as Record<string, string> | undefined)?.[k] ?? "" })
    const allowed = f.where.map((w) => w.toLowerCase() as Channel)
    const saved = Array.isArray(sm?.channels) ? (sm!.channels as string[]).filter((c): c is Channel => allowed.includes(c as Channel)) : null
    out[f.slug] = { enabled: sm?.enabled ?? !!DEF_ON[f.slug], test: sm?.test ?? true, fields: fl, channels: saved ?? allowed }
  })
  return out
}

type Form = { id: number | null; name: string; desc: string; gateway: string; icon: string; sort: string; active: boolean }
type Cod = { deposit: boolean; max: string; fee: string; verify: "new" | "always" | "never" }

export default function PaymentMethodsPage() {
  const blocked = useModuleGuard("Payment Methods")
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const cur = formatCurrency(0).replace(/[\d.,\s-]/g, "") || "$"

  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [formErr, setFormErr] = useState("")
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [payment, setPayment] = useState<PaymentSettings | null>(null)
  const [base, setBase] = useState<Cod>({ deposit: false, max: "5000", fee: "0", verify: "new" })
  const [cod, setCod] = useState<Cod>(base)
  const [codErr, setCodErr] = useState("")
  const [codSaving, setCodSaving] = useState(false)

  const [pmBase, setPmBase] = useState<{ m: MMap; def: string }>({ m: buildMethods(null), def: "cash" })
  const [pm, setPm] = useState<MMap>(pmBase.m)
  const [def, setDef] = useState("cash")
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  const dirty = JSON.stringify(cod) !== JSON.stringify(base) || JSON.stringify({ m: pm, def }) !== JSON.stringify(pmBase)

  const load = useCallback(async () => {
    try {
      const [list, all] = await Promise.all([paymentMethodApi.getAll(), settingsApi.getAll()])
      setMethods([...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
      const p = (all.data.payment ?? {}) as PaymentSettings
      setPayment(p)
      const c: Cod = {
        deposit: !!p.cod_shipping_deposit?.enabled,
        max: String(p.cod_limit ?? 5000),
        fee: String(p.cod_fee ?? 0),
        verify: p.cod_phone_verify ?? "new",
      }
      setBase(c)
      setCod(c)
      const m = buildMethods(p)
      const d = p.default && m[p.default] ? p.default : "cash"
      setPmBase({ m, def: d }); setPm(m); setDef(d)
    } catch {
      toast({ variant: "destructive", title: "Failed to load payment methods" })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  if (blocked) return blocked

  const fail = (title: string, e: any) =>
    toast({ variant: "destructive", title, description: e?.response?.data?.message || "Please try again" })

  const onCount = FIXED.filter((f) => pm[f.slug].enabled).length
  const testCount = FIXED.filter((f) => f.gateway && pm[f.slug].enabled && pm[f.slug].test).length
  const defName = FIXED.find((f) => f.slug === def)?.name ?? "none"
  const setM = (slug: string, patch: Partial<MState>) => { setPm((p) => ({ ...p, [slug]: { ...p[slug], ...patch } })); setCodErr("") }
  const toggleOn = (slug: string) => {
    if (def === slug && pm[slug].enabled) return toast({ variant: "destructive", title: "Choose another default method before turning this one off" })
    setM(slug, { enabled: !pm[slug].enabled })
  }
  const makeDefault = (slug: string) => {
    if (!pm[slug].enabled) return toast({ variant: "destructive", title: "Turn this method on before making it the default" })
    setDef(slug); setCodErr("")
  }
  const openNew = () => { setForm({ id: null, name: "", desc: "", gateway: "cod", icon: "banknote", sort: String(methods.length + 1), active: true }); setFormErr("") }
  const openEdit = (m: PaymentMethod) => {
    setForm({ id: m.id, name: m.name, desc: m.description ?? "", gateway: m.gateway_type || "cod", icon: m.icon || "banknote", sort: String(m.sortOrder), active: m.isActive })
    setFormErr("")
  }
  const patch = (p: Partial<Form>) => { setForm((f) => (f ? { ...f, ...p } : f)); setFormErr("") }

  const saveMethod = async () => {
    if (!form) return
    const name = form.name.trim()
    if (!name) return setFormErr("Name is required.")
    if (methods.some((m) => m.id !== form.id && m.name.toLowerCase() === name.toLowerCase())) return setFormErr("A payment method with this name already exists.")
    if (form.sort !== "" && (!Number.isInteger(Number(form.sort)) || Number(form.sort) < 0)) return setFormErr("Sort order must be a whole number, 0 or more.")
    const body = {
      name, description: form.desc.trim(), gateway_type: form.gateway as PaymentGatewayType, icon: form.icon,
      sort_order: form.sort === "" ? methods.length + 1 : Number(form.sort), is_active: form.active,
    }
    setSaving(true)
    try {
      if (form.id) { await paymentMethodApi.update(form.id, body); toast({ title: "Payment method updated" }) }
      else { await paymentMethodApi.create(body); toast({ title: "Payment method created" }) }
      setForm(null)
      await load()
    } catch (e: any) {
      setFormErr(e?.response?.data?.message || "Could not save payment method")
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (m: PaymentMethod) => {
    setBusyId(m.id)
    setMethods((p) => p.map((x) => (x.id === m.id ? { ...x, isActive: !x.isActive } : x)))
    try { await paymentMethodApi.toggle(m.id) }
    catch (e) { setMethods((p) => p.map((x) => (x.id === m.id ? { ...x, isActive: m.isActive } : x))); fail("Could not update status", e) }
    finally { setBusyId(null) }
  }

  const remove = async (m: PaymentMethod) => {
    if (!window.confirm(`Delete payment method "${m.name}"? It will be removed from checkout immediately.`)) return
    setBusyId(m.id)
    try {
      await paymentMethodApi.delete(m.id)
      toast({ title: "Payment method deleted" })
      if (form?.id === m.id) setForm(null)
      await load()
    } catch (e) { fail("Could not delete payment method", e) }
    finally { setBusyId(null) }
  }

  const saveCod = async () => {
    const mx = Number(cod.max), fee = Number(cod.fee)
    let e = ""
    const onN = FIXED.filter((f) => pm[f.slug].enabled).length
    if (!pm[def]?.enabled) e = "The default method must be turned on."
    else if (onN === 0) e = "Enable at least one payment method."
    else {
      const bad = FIXED.find((f) => f.fields.length > 0 && pm[f.slug].enabled && !pm[f.slug].fields.account?.trim())
      if (bad) { e = `${bad.name} needs an account number or ID.`; setOpenSlug(bad.slug) }
    }
    if (!e && (cod.max === "" || !isFinite(mx) || mx < 0)) e = "COD order limit must be 0 or more."
    if (!e && (cod.fee === "" || !isFinite(fee) || fee < 0)) e = "COD fee must be 0 or more."
    if (!e) {
      const noCh = FIXED.find((f) => pm[f.slug].enabled && pm[f.slug].channels.length === 0)
      if (noCh) { e = `${noCh.name} is on but not available in POS or Online. Pick at least one channel.`; setOpenSlug(noCh.slug) }
    }
    if (e) { setCodErr(e); toast({ variant: "destructive", title: e }); return }
    setCodSaving(true)
    try {
      const dep = payment?.cod_shipping_deposit
      await settingsApi.updatePayment({
        cod_limit: mx,
        cod_fee: fee,
        cod_phone_verify: cod.verify,
        methods: pm,
        default: def,
        cod_shipping_deposit: { gateway: "sslcommerz", custom_amount: 0, ...dep, enabled: cod.deposit },
      })
      toast({ title: "Payment settings saved" })
      setCodErr("")
      await load()
    } catch (err) { fail("Could not save payment settings", err) }
    finally { setCodSaving(false) }
  }

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div>
        <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-dash-muted">How customers pay you — in the shop and online. One place for methods and gateway keys.</p>
      </div>

      {!loading && (
        <div className={cn("rounded-[14px] px-4 py-3 text-sm", testCount ? "bg-dash-warn-soft text-dash-warn-fg" : "bg-dash-success-soft text-dash-success-fg")}>
          <strong>{testCount ? `${testCount} gateway${testCount > 1 ? "s are" : " is"} in test mode.` : `${onCount} of ${FIXED.length} methods on.`}</strong>{" "}
          {testCount ? `Switch them to live when you are ready to take real payments. Default: ${defName}.` : `Default method: ${defName}.`}
        </div>
      )}

      <section className="rounded-[14px] border border-dash-border bg-dash-card">
        <div className="border-b border-dash-border-soft px-5 py-4">
          <h2 className="font-dash-display text-lg font-bold">Payment methods</h2>
          <p className="text-sm text-dash-muted">Turn on the methods you accept and choose the default.</p>
        </div>
        {loading ? (
          <div className="flex flex-col gap-2.5 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-[12px]" />)}</div>
        ) : FIXED.map((f) => {
          const m = pm[f.slug]
          const isDef = def === f.slug
          const open = openSlug === f.slug
          const status = !m.enabled ? "Off" : f.gateway && m.test ? "Test mode" : "Live"
          const sCls = status === "Live" ? "bg-dash-success-soft text-dash-success-fg" : status === "Test mode" ? "bg-dash-warn-soft text-dash-warn-fg" : "bg-dash-neutral-soft text-dash-neutral-fg"
          return (
            <div key={f.slug} className="border-b border-dash-border-soft last:border-b-0">
              <div className="flex flex-wrap items-center gap-3.5 px-5 py-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-white" style={{ background: f.color }}>{f.ini}</span>
                <div className="min-w-0 flex-1 basis-48">
                  <div className="font-bold">{f.name}</div>
                  <div className="text-xs text-dash-muted">{f.sub}</div>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", sCls)}>{status}</span>
                <button type="button" aria-pressed={isDef} onClick={() => makeDefault(f.slug)}
                  className={cn("h-9 rounded-lg border px-3 text-[13px] font-semibold", isDef ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>
                  {isDef ? "Default" : "Make default"}
                </button>
                <span className="flex gap-1.5">{f.where.map((w) => {
                  const ch = w.toLowerCase() as Channel
                  const on = m.channels.includes(ch)
                  return (
                    <button key={w} type="button" aria-pressed={on} title={`Available in ${w}`}
                      onClick={(ev) => { ev.stopPropagation(); setM(f.slug, { channels: on ? m.channels.filter((c) => c !== ch) : [...m.channels, ch] }) }}
                      className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", on ? "bg-dash-neutral-soft text-dash-neutral-fg" : "border border-dash-border text-dash-muted line-through")}>{w}</button>
                  )
                })}</span>
                <Switch on={m.enabled} label={`${f.name} enabled`} onClick={() => toggleOn(f.slug)} />
                <button type="button" aria-expanded={open} onClick={() => setOpenSlug(open ? null : f.slug)} className={cn(outlineBtn, "h-9 px-3 text-[13px]")}>
                  {f.fields.length ? (open ? "Close" : "Edit details") : "Details"}
                </button>
              </div>
              {open && (
                <div className="mx-5 mb-4 flex flex-col gap-3 rounded-[12px] bg-dash-neutral-soft p-4 sm:ml-[78px]">
                  {f.fields.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
                      {f.fields.map(([k, label, ph]) => (
                        <label key={k} className="flex flex-col gap-1.5 text-[13px] font-semibold">{label}
                          <input className={cn(input, "font-mono")} value={m.fields[k] ?? ""} placeholder={ph} onChange={(e) => setM(f.slug, { fields: { ...m.fields, [k]: e.target.value } })} />
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {f.gateway && (
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Switch on={m.test} label="Test mode" onClick={() => setM(f.slug, { test: !m.test })} />Test mode
                      </span>
                    )}
                    <span className="min-w-[200px] flex-1 text-xs text-dash-muted">
                      {f.fields.length ? "These details appear on invoices and checkout so customers know where to pay." : f.slug === "cod" ? "Limits and fees are set under Cash on delivery below." : "No account details needed."}
                    </span>
                  </div>
                  {f.gateway && m.test && <span className="text-xs text-dash-warn-fg">Test mode — use the sandbox credentials from the {f.name} developer portal. No real money moves.</span>}
                  <span className="text-xs text-dash-muted">Use the Save changes bar at the bottom of the page to apply.</span>
                </div>
              )}
            </div>
          )
        })}
      </section>

      <section className="rounded-[14px] border border-dash-border bg-dash-card p-[18px]">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-dash-display text-lg font-bold">Checkout payment methods</h2>
            <p className="text-sm text-dash-muted">Payment options shown to online customers at checkout. Changes here save instantly.</p>
          </div>
          <button type="button" onClick={openNew} className={primaryBtn}><Plus className="size-4" /> Add method</button>
        </div>

        {form && (
          <div className="mb-3.5 flex flex-col gap-3 rounded-[12px] bg-dash-neutral-soft p-4">
            <strong>{form.id ? "Edit payment method" : "Add payment method"}</strong>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Name *
                <input className={input} value={form.name} placeholder="Cash on Delivery" onChange={(e) => patch({ name: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Description
                <input className={input} value={form.desc} placeholder="Pay when your order arrives" onChange={(e) => patch({ desc: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Gateway type
                <select className={input} value={form.gateway} onChange={(e) => patch({ gateway: e.target.value })}>
                  {GATEWAYS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Icon
                <select className={input} value={form.icon} onChange={(e) => patch({ icon: e.target.value })}>
                  {ICONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Sort order
                <input className={input} type="number" min={0} step={1} value={form.sort} onChange={(e) => patch({ sort: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Status
                <select className={input} value={form.active ? "active" : "inactive"} onChange={(e) => patch({ active: e.target.value === "active" })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            {NEEDS_KEYS.includes(form.gateway) && (
              <span className="rounded-lg bg-dash-warn-soft px-3 py-2 text-xs text-dash-warn-fg">Credentials for this gateway are configured in Settings, General, Payment gateway credentials.</span>
            )}
            <div className="flex items-center gap-3 rounded-[10px] border border-dash-border bg-dash-card p-3">
              {(() => { const I = iconOf(form.icon); return <span className="flex size-10 items-center justify-center rounded-xl bg-dash-success-soft text-dash-success-fg"><I className="size-5" /></span> })()}
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-bold">{form.name.trim() || "Method name"}</span>
                <span className="truncate text-xs text-dash-muted">{form.desc.trim() || "Description"}</span>
              </span>
            </div>
            {formErr && <p className="text-[13px] font-semibold text-dash-danger">{formErr}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} className={outlineBtn}>Cancel</button>
              <button type="button" onClick={saveMethod} disabled={saving} className={primaryBtn}>{saving ? "Saving…" : form.id ? "Save changes" : "Add method"}</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-2.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[68px] rounded-[12px]" />)}</div>
        ) : methods.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[12px] bg-dash-neutral-soft p-8 text-sm text-dash-muted">
            No payment methods yet.
            <button type="button" onClick={openNew} className={outlineBtn}>Add first method</button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {methods.map((m) => {
              const I = iconOf(m.icon)
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-[12px] border border-dash-border-soft p-3">
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", m.isActive ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-neutral-soft text-dash-muted")}><I className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate font-bold", !m.isActive && "text-dash-muted")}>{m.name}</div>
                    {m.description && <div className="truncate text-xs text-dash-muted">{m.description}</div>}
                    <div className="truncate text-xs text-dash-muted">{gatewayLabel(m.gateway_type)} · Sort #{m.sortOrder}</div>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", m.isActive ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-neutral-soft text-dash-neutral-fg")}>
                    {m.isActive ? "Active" : "Inactive"}
                  </span>
                  <Switch on={m.isActive} label={m.isActive ? "Active, turn off" : "Inactive, turn on"} disabled={busyId === m.id} onClick={() => toggle(m)} />
                  <div className="flex gap-1.5">
                    <button type="button" aria-label={`Edit ${m.name}`} onClick={() => openEdit(m)} className={iconBtn}><Pencil className="size-4" /></button>
                    <button type="button" aria-label={`Delete ${m.name}`} disabled={busyId === m.id} onClick={() => remove(m)} className={cn(iconBtn, "text-dash-danger")}><Trash2 className="size-4" /></button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-3.5 rounded-[10px] bg-dash-accent-soft px-3 py-2 text-[13px] text-dash-accent-fg">
          <strong>Display order.</strong> Methods are shown to customers ordered by Sort order (lowest first). Set the number when adding or editing a method.
        </p>
      </section>

      <section className="rounded-[14px] border border-dash-border bg-dash-card p-[18px]">
        <div className="mb-3.5">
          <h2 className="font-dash-display text-lg font-bold">Cash on delivery</h2>
          <p className="text-sm text-dash-muted">Reduce fake COD orders.</p>
        </div>
        {loading ? <Skeleton className="h-28 rounded-[12px]" /> : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-sm font-semibold">Ask for delivery charge upfront</span>
                <span className="text-xs text-dash-muted">Customer pays shipping online; the rest is paid on delivery.</span>
              </span>
              <Switch on={cod.deposit} label="Delivery charge upfront" onClick={() => setCod((c) => ({ ...c, deposit: !c.deposit }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">COD only for orders under ({cur})
                <input className={input} type="number" min={0} value={cod.max} onChange={(e) => { setCod({ ...cod, max: e.target.value }); setCodErr("") }} />
                <span className="text-xs font-normal text-dash-muted">0 = no limit</span>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Extra COD fee ({cur})
                <input className={input} type="number" min={0} value={cod.fee} onChange={(e) => { setCod({ ...cod, fee: e.target.value }); setCodErr("") }} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Phone verification
                <select className={input} value={cod.verify} onChange={(e) => setCod({ ...cod, verify: e.target.value as Cod["verify"] })}>
                  <option value="new">OTP for new customers</option>
                  <option value="always">Always</option>
                  <option value="never">Never</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-dash-border bg-dash-card px-[18px] py-3">
        <span className={cn("text-sm", codErr ? "text-dash-danger" : dirty ? "text-dash-warn-fg" : "text-dash-muted")}>
          {codErr || (dirty ? "You have unsaved changes." : "Saved methods apply to new sales.")}
        </span>
        <div className="flex gap-2">
          <button type="button" className={outlineBtn} onClick={() => { setCod(base); setPm(pmBase.m); setDef(pmBase.def); setCodErr("") }} disabled={!dirty}>Discard</button>
          <button type="button" className={primaryBtn} onClick={saveCod} disabled={codSaving || !dirty}>{codSaving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  )
}
