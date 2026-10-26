"use client"

import { useCallback, useEffect, useState } from "react"
import { Banknote, Landmark, CreditCard, Wallet, QrCode, Smartphone, Pencil, Trash2, Plus } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch as UISwitch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { StatusBadge } from "@/components/common/StatusBadge"
import { WithTooltip } from "@/components/common/WithTooltip"
import { EmptyState } from "@/components/common/EmptyState"
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


function Switch({ on, label, onClick, disabled, id }: { on: boolean; label: string; onClick: () => void; disabled?: boolean; id?: string }) {
  return (
    <UISwitch id={id} checked={on} aria-label={label} disabled={disabled} onCheckedChange={() => onClick()} />
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
    <div className="flex flex-col gap-5">
      <PageHeader title="Payments" description="How customers pay you — in the shop and online. One place for methods and gateway keys." />

      {!loading && (
        <Alert role="status">
          <AlertTitle>{testCount ? `${testCount} gateway${testCount > 1 ? "s are" : " is"} in test mode.` : `${onCount} of ${FIXED.length} methods on.`}</AlertTitle>
          <AlertDescription>{testCount ? `Switch them to live when you are ready to take real payments. Default: ${defName}.` : `Default method: ${defName}.`}</AlertDescription>
        </Alert>
      )}

      <SectionCard title="Payment methods" description="Turn on the methods you accept and choose the default." contentClassName="px-0">
        {loading ? (
          <div className="flex flex-col gap-2.5 px-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : FIXED.map((f, fi) => {
          const m = pm[f.slug]
          const isDef = def === f.slug
          const open = openSlug === f.slug
          const status = !m.enabled ? "Off" : f.gateway && m.test ? "Test mode" : "Live"
          return (
            <div key={f.slug}>
              {fi > 0 && <Separator />}
              <div className="flex flex-wrap items-center gap-3.5 px-6 py-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-white" style={{ background: f.color }}>{f.ini}</span>
                <div className="min-w-0 flex-1 basis-48">
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{f.sub}</div>
                </div>
                <StatusBadge status={status} variant={status === "Live" ? "default" : status === "Test mode" ? "secondary" : "outline"} />
                <Button type="button" size="sm" variant={isDef ? "default" : "outline"} aria-pressed={isDef} onClick={() => makeDefault(f.slug)}>
                  {isDef ? "Default" : "Make default"}
                </Button>
                <span className="flex gap-1.5">{f.where.map((w) => {
                  const ch = w.toLowerCase() as Channel
                  const on = m.channels.includes(ch)
                  return (
                    <WithTooltip key={w} content={`Available in ${w}`}>
                      <Button type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on}
                        onClick={(ev) => { ev.stopPropagation(); setM(f.slug, { channels: on ? m.channels.filter((c) => c !== ch) : [...m.channels, ch] }) }}
                        className={cn(!on && "line-through")}>{w}</Button>
                    </WithTooltip>
                  )
                })}</span>
                <Switch on={m.enabled} label={`${f.name} enabled`} onClick={() => toggleOn(f.slug)} />
                <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setOpenSlug(open ? null : f.slug)}>
                  {f.fields.length ? (open ? "Close" : "Edit details") : "Details"}
                </Button>
              </div>
              {open && (
                <Card className="mx-6 mb-4 gap-3 bg-muted/50 p-4 shadow-none sm:ml-[84px]">
                  {f.fields.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
                      {f.fields.map(([k, label, ph]) => (
                        <FormField key={k} label={label} htmlFor={`pm-${f.slug}-${k}`}>
                          <Input id={`pm-${f.slug}-${k}`} className="font-mono" value={m.fields[k] ?? ""} placeholder={ph} onChange={(e) => setM(f.slug, { fields: { ...m.fields, [k]: e.target.value } })} />
                        </FormField>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {f.gateway && (
                      <FormField orientation="horizontal" label="Test mode" htmlFor={`pm-${f.slug}-test`} className="w-auto gap-2">
                        <Switch id={`pm-${f.slug}-test`} on={m.test} label="Test mode" onClick={() => setM(f.slug, { test: !m.test })} />
                      </FormField>
                    )}
                    <span className="min-w-[200px] flex-1 text-xs text-muted-foreground">
                      {f.fields.length ? "These details appear on invoices and checkout so customers know where to pay." : f.slug === "cod" ? "Limits and fees are set under Cash on delivery below." : "No account details needed."}
                    </span>
                  </div>
                  {f.gateway && m.test && <span className="text-xs text-foreground">Test mode — use the sandbox credentials from the {f.name} developer portal. No real money moves.</span>}
                  <span className="text-xs text-muted-foreground">Use the Save changes bar at the bottom of the page to apply.</span>
                </Card>
              )}
            </div>
          )
        })}
      </SectionCard>

      <SectionCard
        title="Checkout payment methods"
        description="Payment options shown to online customers at checkout. Changes here save instantly."
        actions={<Button type="button" onClick={openNew}><Plus className="size-4" /> Add method</Button>}
      >
        {form && (
          <Card className="mb-3.5 gap-3 bg-muted/50 p-4 shadow-none">
            <strong>{form.id ? "Edit payment method" : "Add payment method"}</strong>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Name *" htmlFor="pm-form-name">
                <Input id="pm-form-name" value={form.name} placeholder="Cash on Delivery" onChange={(e) => patch({ name: e.target.value })} />
              </FormField>
              <FormField label="Description" htmlFor="pm-form-desc">
                <Input id="pm-form-desc" value={form.desc} placeholder="Pay when your order arrives" onChange={(e) => patch({ desc: e.target.value })} />
              </FormField>
              <FormField label="Gateway type" htmlFor="pm-form-gateway">
                <Select value={String(form.gateway)} onValueChange={(val) => patch({ gateway: val })}>
                  <SelectTrigger id="pm-form-gateway" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GATEWAYS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Icon" htmlFor="pm-form-icon">
                <Select value={String(form.icon)} onValueChange={(val) => patch({ icon: val })}>
                  <SelectTrigger id="pm-form-icon" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Sort order" htmlFor="pm-form-sort">
                <Input id="pm-form-sort" type="number" min={0} step={1} value={form.sort} onChange={(e) => patch({ sort: e.target.value })} />
              </FormField>
              <FormField label="Status" htmlFor="pm-form-status">
                <Select value={String(form.active ? "active" : "inactive")} onValueChange={(val) => patch({ active: val === "active" })}>
                  <SelectTrigger id="pm-form-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            {NEEDS_KEYS.includes(form.gateway) && (
              <Alert><AlertDescription>Credentials for this gateway are configured in Settings, General, Payment gateway credentials.</AlertDescription></Alert>
            )}
            <Item variant="outline" size="sm" className="bg-card">
              {(() => { const I = iconOf(form.icon); return <ItemMedia variant="icon" className="size-10"><I className="size-5" /></ItemMedia> })()}
              <ItemContent className="min-w-0">
                <ItemTitle className="truncate">{form.name.trim() || "Method name"}</ItemTitle>
                <ItemDescription className="truncate">{form.desc.trim() || "Description"}</ItemDescription>
              </ItemContent>
            </Item>
            {formErr && <p className="text-sm font-medium text-destructive">{formErr}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
              <Button type="button" onClick={saveMethod} disabled={saving}>{saving ? "Saving…" : form.id ? "Save changes" : "Add method"}</Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex flex-col gap-2.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[68px]" />)}</div>
        ) : methods.length === 0 ? (
          <EmptyState bordered title="No payment methods yet." action={<Button type="button" variant="outline" onClick={openNew}>Add first method</Button>} />
        ) : (
          <div className="flex flex-col gap-2.5">
            {methods.map((m) => {
              const I = iconOf(m.icon)
              return (
                <Item key={m.id} variant="outline" size="sm">
                  <ItemMedia variant="icon" className={cn("size-10", !m.isActive && "text-muted-foreground")}><I className="size-5" /></ItemMedia>
                  <ItemContent className="min-w-0">
                    <ItemTitle className={cn("truncate", !m.isActive && "text-muted-foreground")}>{m.name}</ItemTitle>
                    {m.description && <ItemDescription className="truncate">{m.description}</ItemDescription>}
                    <ItemDescription className="truncate">{gatewayLabel(m.gateway_type)} · Sort #{m.sortOrder}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                  <StatusBadge status={m.isActive ? "active" : "inactive"} label={m.isActive ? "Active" : "Inactive"} />
                  <Switch on={m.isActive} label={m.isActive ? "Active, turn off" : "Inactive, turn on"} disabled={busyId === m.id} onClick={() => toggle(m)} />
                  <div className="flex gap-1.5">
                    <WithTooltip content={`Edit ${m.name}`}><Button type="button" variant="outline" size="icon" aria-label={`Edit ${m.name}`} onClick={() => openEdit(m)}><Pencil className="size-4" /></Button></WithTooltip>
                    <WithTooltip content={`Delete ${m.name}`}><Button type="button" variant="destructive" size="icon" aria-label={`Delete ${m.name}`} disabled={busyId === m.id} onClick={() => remove(m)}><Trash2 className="size-4" /></Button></WithTooltip>
                  </div>
                  </ItemActions>
                </Item>
              )
            })}
          </div>
        )}
        <Alert className="mt-3.5">
          <AlertTitle>Display order.</AlertTitle>
          <AlertDescription>Methods are shown to customers ordered by Sort order (lowest first). Set the number when adding or editing a method.</AlertDescription>
        </Alert>
      </SectionCard>

      <SectionCard title="Cash on delivery" description="Reduce fake COD orders.">
        {loading ? <Skeleton className="h-28" /> : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium">Ask for delivery charge upfront</span>
                <span className="text-xs text-muted-foreground">Customer pays shipping online; the rest is paid on delivery.</span>
              </span>
              <Switch on={cod.deposit} label="Delivery charge upfront" onClick={() => setCod((c) => ({ ...c, deposit: !c.deposit }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label={`COD only for orders under (${cur})`} htmlFor="pm-cod-max" description="0 = no limit">
                <Input id="pm-cod-max" type="number" min={0} value={cod.max} onChange={(e) => { setCod({ ...cod, max: e.target.value }); setCodErr("") }} />
              </FormField>
              <FormField label={`Extra COD fee (${cur})`} htmlFor="pm-cod-fee">
                <Input id="pm-cod-fee" type="number" min={0} value={cod.fee} onChange={(e) => { setCod({ ...cod, fee: e.target.value }); setCodErr("") }} />
              </FormField>
              <FormField label="Phone verification" htmlFor="pm-cod-verify">
                <Select value={String(cod.verify)} onValueChange={(val) => setCod({ ...cod, verify: val as Cod["verify"] })}>
                  <SelectTrigger id="pm-cod-verify" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">OTP for new customers</SelectItem>
                    <SelectItem value="always">Always</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </div>
        )}
      </SectionCard>

      <Card className="sticky bottom-0 flex-row flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className={cn("text-sm", codErr ? "text-destructive" : dirty ? "text-foreground" : "text-muted-foreground")}>
          {codErr || (dirty ? "You have unsaved changes." : "Saved methods apply to new sales.")}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => { setCod(base); setPm(pmBase.m); setDef(pmBase.def); setCodErr("") }} disabled={!dirty}>Discard</Button>
          <Button type="button" onClick={saveCod} disabled={codSaving || !dirty}>{codSaving ? "Saving…" : "Save changes"}</Button>
        </div>
      </Card>
    </div>
  )
}
