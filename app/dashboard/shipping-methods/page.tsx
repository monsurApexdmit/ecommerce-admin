"use client"

import { useCallback, useEffect, useState } from "react"
import { Trans, useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { Box, Globe, Package, Pencil, Plus, Trash2, Truck, Zap } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch as UISwitch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { EmptyState } from "@/components/common/EmptyState"
import { UserAvatar } from "@/components/common/UserAvatar"
import shippingMethodApi, { type ShippingMethod } from "@/lib/shippingMethodApi"
import { CourierIntegrations } from "@/components/couriers/courier-integrations"
import { settingsApi } from "@/lib/settingsApi"
import { WithTooltip } from "@/components/common/WithTooltip"

const NS = ["commerce", "common"] as const
type Key = ParseKeys<typeof NS>

const ICONS: { value: string; label: Key; Icon: typeof Package }[] = [
  { value: "package", label: "commerce:shipping.icon.package", Icon: Package },
  { value: "truck", label: "commerce:shipping.icon.truck", Icon: Truck },
  { value: "zap", label: "commerce:shipping.icon.zap", Icon: Zap },
  { value: "box", label: "commerce:shipping.icon.box", Icon: Box },
  { value: "globe", label: "commerce:shipping.icon.globe", Icon: Globe },
]
const iconOf = (v: string | null) => (ICONS.find((o) => o.value === v) ?? ICONS[0]).Icon

// Stored as English values in settings; shown via PACKAGE_LABEL
const PACKAGES = ["Small pouch", "Medium box", "Large box"]
const PACKAGE_LABEL: Record<string, Key> = {
  "Small pouch": "commerce:shipping.pkg.small", "Medium box": "commerce:shipping.pkg.medium", "Large box": "commerce:shipping.pkg.large",
}

function Switch({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <UISwitch checked={on} aria-label={label} disabled={disabled} onCheckedChange={() => onClick()} />
  )
}

type Form = { id: number | null; name: string; type: "delivery" | "pickup"; std: string; time: string; desc: string; sort: string; icon: string; active: boolean }
type Opts = { freeOn: boolean; freeMin: string; weight: string; pkg: string }

export default function ShippingMethodsPage() {
  const { t } = useTranslation(NS)
  const blocked = useModuleGuard("Shipping Methods")
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()

  const [zones, setZones] = useState<ShippingMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [formErr, setFormErr] = useState("")
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [base, setBase] = useState<Opts>({ freeOn: false, freeMin: "2000", weight: "0.5", pkg: PACKAGES[0] })
  const [opts, setOpts] = useState<Opts>(base)
  const [sampleCart, setSampleCart] = useState("1450")
  const [optErr, setOptErr] = useState("")
  const [optSaving, setOptSaving] = useState(false)
  const dirty = JSON.stringify(opts) !== JSON.stringify(base)

  const load = useCallback(async () => {
    try {
      const [list, all] = await Promise.all([shippingMethodApi.getAll(), settingsApi.getAll()])
      setZones([...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
      const sh = (all.data.shipping ?? {}) as any
      const threshold = Number((all.data.general as any)?.freeShippingThreshold ?? 0) || 0
      const DEFAULT_FREE_MIN = 2000
      const o: Opts = {
        freeOn: sh.freeOn ?? threshold > 0,
        freeMin: String(sh.freeMin ?? (threshold || DEFAULT_FREE_MIN)),
        weight: String(sh.weight ?? 0.5),
        pkg: sh.pkg || PACKAGES[0],
      }
      setBase(o)
      setOpts(o)
    } catch {
      toast({ variant: "destructive", title: t("commerce:shipping.toast.loadFailed") })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  if (blocked) return blocked

  const fail = (title: string, e: any) =>
    toast({ variant: "destructive", title, description: e?.response?.data?.message || t("common:extra.tryAgain") })
  const money = (n: number) => formatCurrency(Number(n) || 0)

  // ---- shipping methods -------------------------------------------------
  const openNew = () => { setForm({ id: null, name: "", type: "delivery", std: "", time: "", desc: "", sort: String(zones.length + 1), icon: "package", active: true }); setFormErr("") }
  const openEdit = (z: ShippingMethod) => {
    setForm({ id: z.id, name: z.name, type: z.type === "pickup" ? "pickup" : "delivery", std: String(z.price), time: z.estimatedDays ?? "", desc: z.description ?? "", sort: String(z.sortOrder), icon: z.icon || "package", active: z.isActive })
    setFormErr("")
  }
  const patch = (p: Partial<Form>) => { setForm((f) => (f ? { ...f, ...p } : f)); setFormErr("") }

  const saveZone = async () => {
    if (!form) return
    const name = form.name.trim(), std = Number(form.std)
    if (!name) return setFormErr(t("commerce:shipping.validation.nameRequired"))
    if (zones.some((z) => z.id !== form.id && z.name.toLowerCase() === name.toLowerCase())) return setFormErr(t("commerce:shipping.validation.nameTaken"))
    const pickup = form.type === "pickup"
    if (!pickup && (form.std === "" || !isFinite(std) || std < 0)) return setFormErr(t("commerce:shipping.validation.charge"))
    if (form.sort !== "" && (!Number.isInteger(Number(form.sort)) || Number(form.sort) < 0)) return setFormErr(t("commerce:shipping.validation.sort"))
    const body = {
      name, type: form.type, price: pickup ? 0 : std, estimated_days: form.time.trim(),
      description: form.desc.trim(), icon: form.icon, sort_order: form.sort === "" ? zones.length + 1 : Number(form.sort), is_active: form.active,
    }
    setSaving(true)
    try {
      if (form.id) { await shippingMethodApi.update(form.id, body); toast({ title: t("commerce:shipping.toast.updated") }) }
      else { await shippingMethodApi.create(body); toast({ title: t("commerce:shipping.toast.added") }) }
      setForm(null)
      await load()
    } catch (e: any) {
      setFormErr(e?.response?.data?.message || t("commerce:shipping.validation.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const toggleZone = async (z: ShippingMethod) => {
    setBusyId(z.id)
    setZones((p) => p.map((x) => (x.id === z.id ? { ...x, isActive: !x.isActive } : x)))
    try { await shippingMethodApi.toggle(z.id) }
    catch (e) { setZones((p) => p.map((x) => (x.id === z.id ? { ...x, isActive: z.isActive } : x))); fail(t("commerce:shipping.toast.statusFailed"), e) }
    finally { setBusyId(null) }
  }

  const removeZone = async (z: ShippingMethod) => {
    if (!window.confirm(t("commerce:shipping.confirmDelete", { name: z.name }))) return
    setBusyId(z.id)
    try {
      await shippingMethodApi.delete(z.id)
      toast({ title: t("commerce:shipping.toast.deleted") })
      if (form?.id === z.id) setForm(null)
      await load()
    } catch (e) { fail(t("commerce:shipping.toast.deleteFailed"), e) }
    finally { setBusyId(null) }
  }

  // ---- options / packaging ---------------------------------------------
  const saveOpts = async () => {
    const min = Number(opts.freeMin), w = Number(opts.weight)
    let e = ""
    if (opts.freeMin === "" || !isFinite(min) || min < 0) e = t("commerce:shipping.validation.freeMin")
    else if (opts.freeOn && min === 0) e = t("commerce:shipping.validation.freeMinZero")
    else if (opts.weight === "" || !isFinite(w) || w <= 0) e = t("commerce:shipping.validation.weight")
    if (e) { setOptErr(e); toast({ variant: "destructive", title: e }); return }
    setOptSaving(true)
    try {
      await settingsApi.updateShipping({ freeOn: opts.freeOn, freeMin: min, weight: w, pkg: opts.pkg })
      // storefront reads the free-shipping threshold from general settings
      await settingsApi.updateGeneral({ freeShippingThreshold: opts.freeOn ? min : null })
      toast({ title: t("commerce:shipping.toast.settingsSaved") })
      setOptErr("")
      await load()
    } catch (err) { fail(t("commerce:shipping.toast.settingsFailed"), err) }
    finally { setOptSaving(false) }
  }

  const active = zones.filter((z) => z.isActive)
  const freeMin = Number(opts.freeMin) || 0
  const cart = Number(sampleCart) || 0
  const freeApplies = opts.freeOn && freeMin > 0 && cart >= freeMin
  const fee = (z: ShippingMethod, rate: number) => (z.type === "pickup" || freeApplies || !rate ? t("commerce:shipping.free") : money(rate))
  const checkout = active.map((z) => ({
    name: z.type === "pickup" ? t("commerce:shipping.pickupName", { name: z.name }) : z.name,
    time: [z.description, z.estimatedDays].filter(Boolean).join(" · ") || "—",
    price: fee(z, z.price),
  }))

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("commerce:shipping.title")}
        description={t("commerce:shipping.description")}
      />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <SectionCard
            title={t("commerce:shipping.options.title")}
            description={t("commerce:shipping.options.description")}
            actions={<Button type="button" onClick={openNew}><Plus className="size-4" /> {t("commerce:shipping.options.add")}</Button>}
          >
            {form && (
              <Card className="mb-3.5 gap-3 p-4 shadow-none">
                <strong>{form.id ? t("commerce:shipping.options.editTitle") : t("commerce:shipping.options.newTitle")}</strong>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={t("commerce:shipping.options.name")} htmlFor="sm-name">
                    <Input id="sm-name" className="w-full" value={form.name} placeholder={form.type === "pickup" ? t("commerce:shipping.options.namePickup") : t("commerce:shipping.options.nameDelivery")} onChange={(e) => patch({ name: e.target.value })} />
                  </FormField>
                  <FormField label={t("commerce:shipping.options.type")} htmlFor="sm-type">
                    <Select value={form.type} onValueChange={(v) => patch(v === "pickup" ? { type: "pickup", std: "0" } : { type: "delivery" })}>
                      <SelectTrigger id="sm-type" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="delivery">{t("commerce:shipping.options.typeDelivery")}</SelectItem>
                        <SelectItem value="pickup">{t("commerce:shipping.options.typePickup")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={t("commerce:shipping.options.charge")} htmlFor="sm-std">
                    <Input id="sm-std" className="w-full" type="number" min={0} value={form.std} disabled={form.type === "pickup"} onChange={(e) => patch({ std: e.target.value })} />
                  </FormField>
                  <FormField label={t("commerce:shipping.options.estimate")} htmlFor="sm-time">
                    <Input id="sm-time" className="w-full" value={form.time} placeholder={t("commerce:shipping.options.estimatePlaceholder")} onChange={(e) => patch({ time: e.target.value })} />
                  </FormField>
                  <FormField label={t("common:fields.description")} htmlFor="sm-desc">
                    <Input id="sm-desc" className="w-full" value={form.desc} placeholder={form.type === "pickup" ? t("commerce:shipping.options.descPickup") : t("commerce:shipping.options.descDelivery")} onChange={(e) => patch({ desc: e.target.value })} />
                  </FormField>
                  <FormField label={t("commerce:shipping.options.sortOrder")} htmlFor="sm-sort">
                    <Input id="sm-sort" className="w-full" type="number" min={0} step={1} value={form.sort} onChange={(e) => patch({ sort: e.target.value })} />
                  </FormField>
                  <FormField label={t("commerce:shipping.options.iconLabel")} htmlFor="sm-icon">
                    <Select value={form.icon || undefined} onValueChange={(v) => patch({ icon: v })}>
                      <SelectTrigger id="sm-icon" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ICONS.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={t("common:fields.status")} htmlFor="sm-status">
                    <Select value={form.active ? "active" : "inactive"} onValueChange={(v) => patch({ active: v === "active" })}>
                      <SelectTrigger id="sm-status" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t("common:status.active")}</SelectItem>
                        <SelectItem value="inactive">{t("common:status.inactive")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
                <Item variant="outline" size="sm" className="flex-nowrap bg-card">
                  {(() => { const I = iconOf(form.icon); return <ItemMedia variant="icon"><I /></ItemMedia> })()}
                  <ItemContent className="min-w-0">
                    <ItemTitle className="block w-full truncate">{form.name.trim() || t("commerce:shipping.options.previewName")}</ItemTitle>
                    <ItemDescription className="truncate">{form.desc.trim() || t("common:fields.description")}</ItemDescription>
                  </ItemContent>
                  <ItemActions className="flex-col items-end gap-0">
                    <strong>{form.type === "pickup" || !Number(form.std) ? t("commerce:shipping.free") : money(Number(form.std))}</strong>
                    <span className="text-xs text-muted-foreground">{form.time.trim() || t("commerce:shipping.options.previewDays")}</span>
                  </ItemActions>
                </Item>
                {formErr && <p className="text-sm font-medium text-destructive">{formErr}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setForm(null)}>{t("common:actions.cancel")}</Button>
                  <Button type="button" onClick={saveZone} disabled={saving}>{saving ? t("common:actions.saving") : form.id ? t("common:actions.saveChanges") : t("commerce:shipping.options.add")}</Button>
                </div>
              </Card>
            )}

            {loading ? (
              <div className="flex flex-col gap-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : zones.length === 0 ? (
              <EmptyState
                bordered
                icon={Truck}
                title={t("commerce:shipping.options.emptyTitle")}
                description={t("commerce:shipping.options.emptyDesc")}
                action={<Button type="button" variant="outline" onClick={openNew}>{t("commerce:shipping.options.addFirst")}</Button>}
              />
            ) : (
              <div>
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("commerce:shipping.options.colOption")}</TableHead><TableHead>{t("commerce:shipping.options.colSort")}</TableHead><TableHead>{t("commerce:shipping.options.colCharge")}</TableHead>
                      <TableHead>{t("commerce:shipping.options.colTime")}</TableHead><TableHead>{t("commerce:shipping.options.colOn")}</TableHead><TableHead className="text-right">{t("common:fields.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {zones.map((z) => {
                      const I = iconOf(z.icon)
                      return (
                        <TableRow key={z.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <UserAvatar shape="square" className={cn("size-9", !z.isActive && "opacity-60")} fallback={<I className="size-4" />} />
                              <div className="min-w-0">
                                <div className={cn("truncate font-bold", !z.isActive && "text-muted-foreground")}>{z.name}{z.type === "pickup" && <Badge variant="secondary" className="ml-2 align-middle">{t("commerce:shipping.options.pickup")}</Badge>}</div>
                                {z.description && <div className="max-w-[240px] truncate text-xs text-muted-foreground">{z.description}</div>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums">{z.sortOrder}</TableCell>
                          <TableCell className="font-semibold tabular-nums">{z.price ? money(z.price) : t("commerce:shipping.free")}</TableCell>
                          <TableCell>{z.estimatedDays || "—"}</TableCell>
                          <TableCell><Switch on={z.isActive} label={z.isActive ? t("commerce:shipping.options.activeTurnOff") : t("commerce:shipping.options.inactiveTurnOn")} disabled={busyId === z.id} onClick={() => toggleZone(z)} /></TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1.5">
                              <WithTooltip content={t("commerce:shipping.courier.edit", { name: z.name })}><Button type="button" variant="outline" size="icon" aria-label={t("commerce:shipping.courier.edit", { name: z.name })} onClick={() => openEdit(z)}><Pencil className="size-4" /></Button></WithTooltip>
                              <WithTooltip content={t("commerce:shipping.options.deleteName", { name: z.name })}><Button type="button" variant="destructive" size="icon" aria-label={t("commerce:shipping.options.deleteName", { name: z.name })} disabled={busyId === z.id} onClick={() => removeZone(z)}><Trash2 className="size-4" /></Button></WithTooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <Alert role="note" className="mt-3.5">
              <AlertDescription>
                <p><Trans t={t} i18nKey="commerce:shipping.options.orderNote" components={{ b: <strong className="text-foreground" /> }} /></p>
              </AlertDescription>
            </Alert>

            <div className="mt-3.5 flex flex-wrap items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold">{t("commerce:shipping.options.freeTitle")}</span>
                <span className="text-xs text-muted-foreground">{t("commerce:shipping.options.freeHint", { symbol: formatCurrency(0).replace(/[\d.,\s-]/g, "") })}</span>
              </span>
              <Input type="number" min={0} aria-label={t("commerce:shipping.options.freeAmount")} value={opts.freeMin} disabled={loading}
                onChange={(e) => { setOpts({ ...opts, freeMin: e.target.value }); setOptErr("") }} className="w-28" />
              <Switch on={opts.freeOn} label={t("commerce:shipping.options.freeEnabled")} disabled={loading} onClick={() => { setOpts({ ...opts, freeOn: !opts.freeOn }); setOptErr("") }} />
            </div>
          </SectionCard>

          <CourierIntegrations />
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <SectionCard title={t("commerce:shipping.preview.title")} description={t("commerce:shipping.preview.description")}>
            <FormField label={t("commerce:shipping.preview.sampleCart")} htmlFor="sample-cart" className="mb-3">
              <Input id="sample-cart" className="w-full" type="number" min={0} value={sampleCart} onChange={(e) => setSampleCart(e.target.value)} />
            </FormField>
            {loading ? <Skeleton className="h-24" /> : checkout.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("commerce:shipping.preview.none")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {checkout.map((o, i) => (
                  <Item key={i} variant="outline" size="sm" className={cn("flex-nowrap", i === 0 && "border-primary")}>
                    <ItemMedia variant="icon"><Truck /></ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="block w-full truncate">{o.name}</ItemTitle>
                      <ItemDescription className="truncate">{o.time}</ItemDescription>
                    </ItemContent>
                    <strong className="tabular-nums">{o.price}</strong>
                  </Item>
                ))}
              </div>
            )}
            {!loading && opts.freeOn && freeMin > 0 && (
              <span className="mt-3 block text-xs text-muted-foreground">
                {freeApplies ? t("commerce:shipping.preview.applied", { amount: money(cart) }) : t("commerce:shipping.preview.addMore", { amount: money(Math.max(0, freeMin - cart)), min: money(freeMin) })}
              </span>
            )}
          </SectionCard>

          <SectionCard title={t("commerce:shipping.packaging.title")} description={t("commerce:shipping.packaging.description")}>
            <div className="flex flex-col gap-3">
              <FormField label={t("commerce:shipping.packaging.weight")} htmlFor="pk-weight">
                <Input id="pk-weight" className="w-full" type="number" min={0} step={0.1} value={opts.weight} disabled={loading}
                  onChange={(e) => { setOpts({ ...opts, weight: e.target.value }); setOptErr("") }} />
              </FormField>
              <FormField label={t("commerce:shipping.packaging.pkg")} htmlFor="pk-package">
                <Select value={opts.pkg || undefined} disabled={loading} onValueChange={(v) => setOpts({ ...opts, pkg: v })}>
                  <SelectTrigger id="pk-package" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(PACKAGES.includes(opts.pkg) || !opts.pkg ? PACKAGES : [...PACKAGES, opts.pkg]).map((p) => <SelectItem key={p} value={p}>{PACKAGE_LABEL[p] ? t(PACKAGE_LABEL[p]) : p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </SectionCard>
        </aside>
      </div>

      <Card className="sticky bottom-0 flex-row flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className={cn("text-sm", optErr ? "text-destructive" : dirty ? "text-foreground" : "text-muted-foreground")}>
          {optErr || (dirty ? t("commerce:shipping.footer.unsaved") : t("commerce:shipping.footer.hint"))}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={!dirty} onClick={() => { setOpts(base); setOptErr("") }}>{t("commerce:shipping.footer.discard")}</Button>
          <Button type="button" disabled={optSaving || !dirty} onClick={saveOpts}>{optSaving ? t("common:actions.saving") : t("common:actions.saveChanges")}</Button>
        </div>
      </Card>
    </div>
  )
}
