"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
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

const NS = ["commerce", "common"] as const
type Key = ParseKeys<typeof NS>

const ICONS: { value: string; label: Key; Icon: typeof Banknote }[] = [
  { value: "banknote", label: "commerce:paymentMethods.icon.banknote", Icon: Banknote },
  { value: "landmark", label: "commerce:paymentMethods.icon.landmark", Icon: Landmark },
  { value: "credit-card", label: "commerce:paymentMethods.icon.creditCard", Icon: CreditCard },
  { value: "wallet", label: "commerce:paymentMethods.icon.wallet", Icon: Wallet },
  { value: "qr-code", label: "commerce:paymentMethods.icon.qrCode", Icon: QrCode },
  { value: "smartphone", label: "commerce:paymentMethods.icon.mobilePay", Icon: Smartphone },
]
const iconOf = (v: string | null) => (ICONS.find((o) => o.value === v) ?? ICONS[0]).Icon

const GATEWAYS: { value: PaymentGatewayType | string; label: Key }[] = [
  { value: "cod", label: "commerce:paymentMethods.gateway.cod" },
  { value: "sslcommerz", label: "commerce:paymentMethods.gateway.sslcommerz" },
  { value: "portwallet", label: "commerce:paymentMethods.gateway.portwallet" },
  { value: "stripe", label: "commerce:paymentMethods.gateway.stripe" },
  { value: "paypal", label: "commerce:paymentMethods.gateway.paypal" },
  { value: "bkash", label: "commerce:paymentMethods.gateway.bkash" },
  { value: "nagad", label: "commerce:paymentMethods.gateway.nagad" },
  { value: "manual", label: "commerce:paymentMethods.gateway.manual" },
]
const gatewayKey = (g: string) => GATEWAYS.find((x) => x.value === g)?.label
const NEEDS_KEYS = ["sslcommerz", "portwallet", "stripe", "paypal", "bkash", "nagad"]


function Switch({ on, label, onClick, disabled, id }: { on: boolean; label: string; onClick: () => void; disabled?: boolean; id?: string }) {
  return (
    <UISwitch id={id} checked={on} aria-label={label} disabled={disabled} onCheckedChange={() => onClick()} />
  )
}

// name: brand names (bKash, Nagad) stay as is; others are keys. where: channel codes "POS" / "Online" (lower-cased when saved).
// fields: [settings key, label key, placeholder key or literal placeholder]
type Fixed = { slug: string; name: Key | string; ini: string; color: string; sub: Key; where: string[]; gateway: boolean; fields: [string, Key, Key | string][] }
const FIXED: Fixed[] = [
  { slug: "cash", name: "commerce:paymentMethods.fixed.cash", ini: "$", color: "#0F766E", sub: "commerce:paymentMethods.fixed.cashSub", where: ["POS"], gateway: false, fields: [] },
  { slug: "bkash", name: "bKash", ini: "bK", color: "#D12053", sub: "commerce:paymentMethods.fixed.walletSub", where: ["POS", "Online"], gateway: true, fields: [["account", "commerce:paymentMethods.field.bkashNumber", "01XXXXXXXXX"], ["accountName", "commerce:paymentMethods.field.accountName", "commerce:paymentMethods.field.merchantName"]] },
  { slug: "nagad", name: "Nagad", ini: "Ng", color: "#E8590C", sub: "commerce:paymentMethods.fixed.walletSub", where: ["POS", "Online"], gateway: true, fields: [["account", "commerce:paymentMethods.field.nagadNumber", "01XXXXXXXXX"], ["accountName", "commerce:paymentMethods.field.accountName", "commerce:paymentMethods.field.merchantName"]] },
  { slug: "card", name: "commerce:paymentMethods.fixed.card", ini: "Cd", color: "#1F2F5C", sub: "commerce:paymentMethods.fixed.cardSub", where: ["POS", "Online"], gateway: true, fields: [["account", "commerce:paymentMethods.field.terminalId", "commerce:paymentMethods.field.terminalExample"], ["accountName", "commerce:paymentMethods.field.acquirer", "commerce:paymentMethods.field.acquirerExample"]] },
  { slug: "bank", name: "commerce:paymentMethods.fixed.bank", ini: "Bk", color: "#3B4458", sub: "commerce:paymentMethods.fixed.bankSub", where: ["Online"], gateway: false, fields: [["account", "commerce:paymentMethods.field.accountNumber", "0000000000"], ["accountName", "commerce:paymentMethods.field.accountName", "commerce:paymentMethods.field.businessName"], ["bankName", "commerce:paymentMethods.field.bankBranch", "commerce:paymentMethods.field.bankBranchExample"]] },
  { slug: "cod", name: "commerce:paymentMethods.fixed.cod", ini: "COD", color: "#6D28D9", sub: "commerce:paymentMethods.fixed.codSub", where: ["Online"], gateway: false, fields: [] },
]
const CHANNEL_KEY: Record<string, Key> = { POS: "commerce:paymentMethods.channel.pos", Online: "commerce:paymentMethods.channel.online" }
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
type Cod = { deposit: boolean; max: string; fee: string; verify: "new" | "always" | "never"; hold: string }

export default function PaymentMethodsPage() {
  const { t } = useTranslation(NS)
  // FIXED names / placeholders are keys ("commerce:…") except brand names and literal samples
  const tx = (s: string) => (s.startsWith("commerce:") || s.startsWith("common:") ? t(s as Key) : s)
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
  const [base, setBase] = useState<Cod>({ deposit: false, max: "5000", fee: "0", verify: "new", hold: "15" })
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
        hold: String(p.payment_hold_minutes ?? 15),
      }
      setBase(c)
      setCod(c)
      const m = buildMethods(p)
      const d = p.default && m[p.default] ? p.default : "cash"
      setPmBase({ m, def: d }); setPm(m); setDef(d)
    } catch {
      toast({ variant: "destructive", title: t("commerce:paymentMethods.toast.loadFailed") })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  if (blocked) return blocked

  const fail = (title: string, e: any) =>
    toast({ variant: "destructive", title, description: e?.response?.data?.message || t("common:extra.tryAgain") })

  const onCount = FIXED.filter((f) => pm[f.slug].enabled).length
  const testCount = FIXED.filter((f) => f.gateway && pm[f.slug].enabled && pm[f.slug].test).length
  const defFixed = FIXED.find((f) => f.slug === def)
  const defName = defFixed ? tx(defFixed.name) : t("commerce:paymentMethods.none")
  const setM = (slug: string, patch: Partial<MState>) => { setPm((p) => ({ ...p, [slug]: { ...p[slug], ...patch } })); setCodErr("") }
  const toggleOn = (slug: string) => {
    if (def === slug && pm[slug].enabled) return toast({ variant: "destructive", title: t("commerce:paymentMethods.toast.defaultOff") })
    setM(slug, { enabled: !pm[slug].enabled })
  }
  const makeDefault = (slug: string) => {
    if (!pm[slug].enabled) return toast({ variant: "destructive", title: t("commerce:paymentMethods.toast.enableFirst") })
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
    if (!name) return setFormErr(t("commerce:paymentMethods.validation.nameRequired"))
    if (methods.some((m) => m.id !== form.id && m.name.toLowerCase() === name.toLowerCase())) return setFormErr(t("commerce:paymentMethods.validation.nameTaken"))
    if (form.sort !== "" && (!Number.isInteger(Number(form.sort)) || Number(form.sort) < 0)) return setFormErr(t("commerce:paymentMethods.validation.sort"))
    const body = {
      name, description: form.desc.trim(), gateway_type: form.gateway as PaymentGatewayType, icon: form.icon,
      sort_order: form.sort === "" ? methods.length + 1 : Number(form.sort), is_active: form.active,
    }
    setSaving(true)
    try {
      if (form.id) { await paymentMethodApi.update(form.id, body); toast({ title: t("commerce:paymentMethods.toast.updated") }) }
      else { await paymentMethodApi.create(body); toast({ title: t("commerce:paymentMethods.toast.created") }) }
      setForm(null)
      await load()
    } catch (e: any) {
      setFormErr(e?.response?.data?.message || t("commerce:paymentMethods.validation.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (m: PaymentMethod) => {
    setBusyId(m.id)
    setMethods((p) => p.map((x) => (x.id === m.id ? { ...x, isActive: !x.isActive } : x)))
    try { await paymentMethodApi.toggle(m.id) }
    catch (e) { setMethods((p) => p.map((x) => (x.id === m.id ? { ...x, isActive: m.isActive } : x))); fail(t("commerce:paymentMethods.toast.statusFailed"), e) }
    finally { setBusyId(null) }
  }

  const remove = async (m: PaymentMethod) => {
    if (!window.confirm(t("commerce:paymentMethods.confirmDelete", { name: m.name }))) return
    setBusyId(m.id)
    try {
      await paymentMethodApi.delete(m.id)
      toast({ title: t("commerce:paymentMethods.toast.deleted") })
      if (form?.id === m.id) setForm(null)
      await load()
    } catch (e) { fail(t("commerce:paymentMethods.toast.deleteFailed"), e) }
    finally { setBusyId(null) }
  }

  const saveCod = async () => {
    const mx = Number(cod.max), fee = Number(cod.fee), hold = Number(cod.hold)
    let e = ""
    const onN = FIXED.filter((f) => pm[f.slug].enabled).length
    if (!pm[def]?.enabled) e = t("commerce:paymentMethods.validation.defaultOn")
    else if (onN === 0) e = t("commerce:paymentMethods.validation.enableOne")
    else {
      const bad = FIXED.find((f) => f.fields.length > 0 && pm[f.slug].enabled && !pm[f.slug].fields.account?.trim())
      if (bad) { e = t("commerce:paymentMethods.validation.needsAccount", { name: tx(bad.name) }); setOpenSlug(bad.slug) }
    }
    if (!e && (cod.max === "" || !isFinite(mx) || mx < 0)) e = t("commerce:paymentMethods.validation.codLimit")
    if (!e && (cod.fee === "" || !isFinite(fee) || fee < 0)) e = t("commerce:paymentMethods.validation.codFee")
    if (!e && (!Number.isInteger(hold) || hold < 5 || hold > 1440)) e = t("commerce:paymentMethods.validation.hold")
    if (!e) {
      const noCh = FIXED.find((f) => pm[f.slug].enabled && pm[f.slug].channels.length === 0)
      if (noCh) { e = t("commerce:paymentMethods.validation.noChannel", { name: tx(noCh.name) }); setOpenSlug(noCh.slug) }
    }
    if (e) { setCodErr(e); toast({ variant: "destructive", title: e }); return }
    setCodSaving(true)
    try {
      const dep = payment?.cod_shipping_deposit
      await settingsApi.updatePayment({
        cod_limit: mx,
        cod_fee: fee,
        cod_phone_verify: cod.verify,
        payment_hold_minutes: hold,
        methods: pm,
        default: def,
        cod_shipping_deposit: { gateway: "sslcommerz", custom_amount: 0, ...dep, enabled: cod.deposit },
      })
      toast({ title: t("commerce:paymentMethods.toast.saved") })
      setCodErr("")
      await load()
    } catch (err) { fail(t("commerce:paymentMethods.toast.saveFailed"), err) }
    finally { setCodSaving(false) }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("commerce:paymentMethods.title")} description={t("commerce:paymentMethods.description")} />

      {!loading && (
        <Alert role="status">
          <AlertTitle>{testCount ? t("commerce:paymentMethods.summary.testMode", { count: testCount }) : t("commerce:paymentMethods.summary.onOf", { on: onCount, total: FIXED.length })}</AlertTitle>
          <AlertDescription>{testCount ? t("commerce:paymentMethods.summary.switchLive", { name: defName }) : t("commerce:paymentMethods.summary.defaultIs", { name: defName })}</AlertDescription>
        </Alert>
      )}

      <SectionCard title={t("commerce:paymentMethods.methods.title")} description={t("commerce:paymentMethods.methods.description")} contentClassName="px-0">
        {loading ? (
          <div className="flex flex-col gap-2.5 px-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : FIXED.map((f, fi) => {
          const m = pm[f.slug]
          const isDef = def === f.slug
          const open = openSlug === f.slug
          const status = !m.enabled ? "Off" : f.gateway && m.test ? "Test mode" : "Live"
          const statusLabel = !m.enabled ? t("commerce:paymentMethods.methods.off") : f.gateway && m.test ? t("commerce:paymentMethods.methods.testMode") : t("commerce:paymentMethods.methods.live")
          const fname = tx(f.name)
          return (
            <div key={f.slug}>
              {fi > 0 && <Separator />}
              <div className="flex flex-wrap items-center gap-3.5 px-6 py-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold text-white" style={{ background: f.color }}>{f.ini}</span>
                <div className="min-w-0 flex-1 basis-48">
                  <div className="font-medium">{fname}</div>
                  <div className="text-xs text-muted-foreground">{t(f.sub)}</div>
                </div>
                <StatusBadge status={status} label={statusLabel} variant={status === "Live" ? "default" : status === "Test mode" ? "secondary" : "outline"} />
                <Button type="button" size="sm" variant={isDef ? "default" : "outline"} aria-pressed={isDef} onClick={() => makeDefault(f.slug)}>
                  {isDef ? t("commerce:paymentMethods.methods.default") : t("commerce:paymentMethods.methods.makeDefault")}
                </Button>
                <span className="flex gap-1.5">{f.where.map((w) => {
                  const ch = w.toLowerCase() as Channel
                  const on = m.channels.includes(ch)
                  return (
                    <WithTooltip key={w} content={t("commerce:paymentMethods.methods.availableIn", { channel: CHANNEL_KEY[w] ? t(CHANNEL_KEY[w]) : w })}>
                      <Button type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on}
                        onClick={(ev) => { ev.stopPropagation(); setM(f.slug, { channels: on ? m.channels.filter((c) => c !== ch) : [...m.channels, ch] }) }}
                        className={cn(!on && "line-through")}>{CHANNEL_KEY[w] ? t(CHANNEL_KEY[w]) : w}</Button>
                    </WithTooltip>
                  )
                })}</span>
                <Switch on={m.enabled} label={t("commerce:paymentMethods.methods.enabledLabel", { name: fname })} onClick={() => toggleOn(f.slug)} />
                <Button type="button" variant="outline" size="sm" aria-expanded={open} onClick={() => setOpenSlug(open ? null : f.slug)}>
                  {f.fields.length ? (open ? t("common:actions.close") : t("commerce:paymentMethods.methods.editDetails")) : t("commerce:paymentMethods.methods.details")}
                </Button>
              </div>
              {open && (
                <Card className="mx-6 mb-4 gap-3 bg-muted/50 p-4 shadow-none sm:ml-[84px]">
                  {f.fields.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
                      {f.fields.map(([k, label, ph]) => (
                        <FormField key={k} label={t(label)} htmlFor={`pm-${f.slug}-${k}`}>
                          <Input id={`pm-${f.slug}-${k}`} className="font-mono" value={m.fields[k] ?? ""} placeholder={tx(ph)} onChange={(e) => setM(f.slug, { fields: { ...m.fields, [k]: e.target.value } })} />
                        </FormField>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {f.gateway && (
                      <FormField orientation="horizontal" label={t("commerce:paymentMethods.methods.testMode")} htmlFor={`pm-${f.slug}-test`} className="w-auto gap-2">
                        <Switch id={`pm-${f.slug}-test`} on={m.test} label={t("commerce:paymentMethods.methods.testMode")} onClick={() => setM(f.slug, { test: !m.test })} />
                      </FormField>
                    )}
                    <span className="min-w-[200px] flex-1 text-xs text-muted-foreground">
                      {f.fields.length ? t("commerce:paymentMethods.methods.detailsHelp") : f.slug === "cod" ? t("commerce:paymentMethods.methods.codHelp") : t("commerce:paymentMethods.methods.noDetails")}
                    </span>
                  </div>
                  {f.gateway && m.test && <span className="text-xs text-foreground">{t("commerce:paymentMethods.methods.testNote", { name: fname })}</span>}
                  <span className="text-xs text-muted-foreground">{t("commerce:paymentMethods.methods.saveBarNote")}</span>
                </Card>
              )}
            </div>
          )
        })}
      </SectionCard>

      <SectionCard
        title={t("commerce:paymentMethods.checkout.title")}
        description={t("commerce:paymentMethods.checkout.description")}
        actions={<Button type="button" onClick={openNew}><Plus className="size-4" /> {t("commerce:paymentMethods.checkout.add")}</Button>}
      >
        {form && (
          <Card className="mb-3.5 gap-3 bg-muted/50 p-4 shadow-none">
            <strong>{form.id ? t("commerce:paymentMethods.checkout.editTitle") : t("commerce:paymentMethods.checkout.addTitle")}</strong>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label={t("commerce:paymentMethods.checkout.name")} htmlFor="pm-form-name">
                <Input id="pm-form-name" value={form.name} placeholder={t("commerce:paymentMethods.checkout.namePlaceholder")} onChange={(e) => patch({ name: e.target.value })} />
              </FormField>
              <FormField label={t("common:fields.description")} htmlFor="pm-form-desc">
                <Input id="pm-form-desc" value={form.desc} placeholder={t("commerce:paymentMethods.checkout.descPlaceholder")} onChange={(e) => patch({ desc: e.target.value })} />
              </FormField>
              <FormField label={t("commerce:paymentMethods.checkout.gatewayType")} htmlFor="pm-form-gateway">
                <Select value={String(form.gateway)} onValueChange={(val) => patch({ gateway: val })}>
                  <SelectTrigger id="pm-form-gateway" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GATEWAYS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{t(o.label)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("commerce:paymentMethods.checkout.iconLabel")} htmlFor="pm-form-icon">
                <Select value={String(form.icon)} onValueChange={(val) => patch({ icon: val })}>
                  <SelectTrigger id="pm-form-icon" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{t(o.label)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("commerce:paymentMethods.checkout.sortOrder")} htmlFor="pm-form-sort">
                <Input id="pm-form-sort" type="number" min={0} step={1} value={form.sort} onChange={(e) => patch({ sort: e.target.value })} />
              </FormField>
              <FormField label={t("common:fields.status")} htmlFor="pm-form-status">
                <Select value={String(form.active ? "active" : "inactive")} onValueChange={(val) => patch({ active: val === "active" })}>
                  <SelectTrigger id="pm-form-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t("common:status.active")}</SelectItem>
                    <SelectItem value="inactive">{t("common:status.inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            {NEEDS_KEYS.includes(form.gateway) && (
              <Alert><AlertDescription>{t("commerce:paymentMethods.checkout.credentialsNote")}</AlertDescription></Alert>
            )}
            <Item variant="outline" size="sm" className="bg-card">
              {(() => { const I = iconOf(form.icon); return <ItemMedia variant="icon" className="size-10"><I className="size-5" /></ItemMedia> })()}
              <ItemContent className="min-w-0">
                <ItemTitle className="truncate">{form.name.trim() || t("commerce:paymentMethods.checkout.previewName")}</ItemTitle>
                <ItemDescription className="truncate">{form.desc.trim() || t("common:fields.description")}</ItemDescription>
              </ItemContent>
            </Item>
            {formErr && <p className="text-sm font-medium text-destructive">{formErr}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setForm(null)}>{t("common:actions.cancel")}</Button>
              <Button type="button" onClick={saveMethod} disabled={saving}>{saving ? t("common:actions.saving") : form.id ? t("common:actions.saveChanges") : t("commerce:paymentMethods.checkout.add")}</Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="flex flex-col gap-2.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[68px]" />)}</div>
        ) : methods.length === 0 ? (
          <EmptyState bordered title={t("commerce:paymentMethods.checkout.empty")} action={<Button type="button" variant="outline" onClick={openNew}>{t("commerce:paymentMethods.checkout.addFirst")}</Button>} />
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
                    <ItemDescription className="truncate">{(() => { const k = gatewayKey(m.gateway_type); return k ? t(k) : m.gateway_type })()} · {t("commerce:paymentMethods.checkout.sortNo", { n: m.sortOrder })}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                  <StatusBadge status={m.isActive ? "active" : "inactive"} label={m.isActive ? t("common:status.active") : t("common:status.inactive")} />
                  <Switch on={m.isActive} label={m.isActive ? t("commerce:paymentMethods.checkout.activeTurnOff") : t("commerce:paymentMethods.checkout.inactiveTurnOn")} disabled={busyId === m.id} onClick={() => toggle(m)} />
                  <div className="flex gap-1.5">
                    <WithTooltip content={t("commerce:paymentMethods.checkout.edit", { name: m.name })}><Button type="button" variant="outline" size="icon" aria-label={t("commerce:paymentMethods.checkout.edit", { name: m.name })} onClick={() => openEdit(m)}><Pencil className="size-4" /></Button></WithTooltip>
                    <WithTooltip content={t("commerce:paymentMethods.checkout.delete", { name: m.name })}><Button type="button" variant="destructive" size="icon" aria-label={t("commerce:paymentMethods.checkout.delete", { name: m.name })} disabled={busyId === m.id} onClick={() => remove(m)}><Trash2 className="size-4" /></Button></WithTooltip>
                  </div>
                  </ItemActions>
                </Item>
              )
            })}
          </div>
        )}
        <Alert className="mt-3.5">
          <AlertTitle>{t("commerce:paymentMethods.checkout.orderTitle")}</AlertTitle>
          <AlertDescription>{t("commerce:paymentMethods.checkout.orderNote")}</AlertDescription>
        </Alert>
      </SectionCard>

      <SectionCard title={t("commerce:paymentMethods.cod.title")} description={t("commerce:paymentMethods.cod.description")}>
        {loading ? <Skeleton className="h-28" /> : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium">{t("commerce:paymentMethods.cod.deposit")}</span>
                <span className="text-xs text-muted-foreground">{t("commerce:paymentMethods.cod.depositHelp")}</span>
              </span>
              <Switch on={cod.deposit} label={t("commerce:paymentMethods.cod.depositLabel")} onClick={() => setCod((c) => ({ ...c, deposit: !c.deposit }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField label={t("commerce:paymentMethods.cod.max", { cur })} htmlFor="pm-cod-max" description={t("commerce:paymentMethods.cod.noLimit")}>
                <Input id="pm-cod-max" type="number" min={0} value={cod.max} onChange={(e) => { setCod({ ...cod, max: e.target.value }); setCodErr("") }} />
              </FormField>
              <FormField label={t("commerce:paymentMethods.cod.fee", { cur })} htmlFor="pm-cod-fee">
                <Input id="pm-cod-fee" type="number" min={0} value={cod.fee} onChange={(e) => { setCod({ ...cod, fee: e.target.value }); setCodErr("") }} />
              </FormField>
              <FormField label={t("commerce:paymentMethods.cod.verify")} htmlFor="pm-cod-verify">
                <Select value={String(cod.verify)} onValueChange={(val) => setCod({ ...cod, verify: val as Cod["verify"] })}>
                  <SelectTrigger id="pm-cod-verify" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{t("commerce:paymentMethods.cod.verifyNew")}</SelectItem>
                    <SelectItem value="always">{t("commerce:paymentMethods.cod.verifyAlways")}</SelectItem>
                    <SelectItem value="never">{t("commerce:paymentMethods.cod.verifyNever")}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t("commerce:paymentMethods.hold.title")} description={t("commerce:paymentMethods.hold.description")}>
        {loading ? <Skeleton className="h-16" /> : (
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label={t("commerce:paymentMethods.hold.label")} htmlFor="pm-hold" description={t("commerce:paymentMethods.hold.help")}>
              <Input id="pm-hold" type="number" min={5} max={1440} step={1} value={cod.hold} onChange={(e) => { setCod({ ...cod, hold: e.target.value }); setCodErr("") }} />
            </FormField>
          </div>
        )}
      </SectionCard>

      <Card className="sticky bottom-0 flex-row flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className={cn("text-sm", codErr ? "text-destructive" : dirty ? "text-foreground" : "text-muted-foreground")}>
          {codErr || (dirty ? t("commerce:paymentMethods.footer.unsaved") : t("commerce:paymentMethods.footer.hint"))}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => { setCod(base); setPm(pmBase.m); setDef(pmBase.def); setCodErr("") }} disabled={!dirty}>{t("commerce:paymentMethods.footer.discard")}</Button>
          <Button type="button" onClick={saveCod} disabled={codSaving || !dirty}>{codSaving ? t("common:actions.saving") : t("common:actions.saveChanges")}</Button>
        </div>
      </Card>
    </div>
  )
}
