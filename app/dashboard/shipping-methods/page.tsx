"use client"

import { useCallback, useEffect, useState } from "react"
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
import shippingMethodApi, { courierAccountApi, type CourierAccount, type ShippingMethod } from "@/lib/shippingMethodApi"
import { settingsApi } from "@/lib/settingsApi"
import { WithTooltip } from "@/components/common/WithTooltip"

const ICONS = [
  { value: "package", label: "Package", Icon: Package },
  { value: "truck", label: "Truck", Icon: Truck },
  { value: "zap", label: "Express (zap)", Icon: Zap },
  { value: "box", label: "Box", Icon: Box },
  { value: "globe", label: "Globe", Icon: Globe },
]
const iconOf = (v: string | null) => (ICONS.find((o) => o.value === v) ?? ICONS[0]).Icon

const COURIERS: [string, string, string][] = [
  ["Pathao", "PT", "#B42318"],
  ["Steadfast", "SF", "#0F766E"],
  ["RedX", "RX", "#C2410C"],
  ["Paperfly", "PF", "#1A2F99"],
]
const PACKAGES = ["Small pouch", "Medium box", "Large box"]

function Switch({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <UISwitch checked={on} aria-label={label} disabled={disabled} onCheckedChange={() => onClick()} />
  )
}

type Form = { id: number | null; name: string; type: "delivery" | "pickup"; std: string; time: string; desc: string; sort: string; icon: string; active: boolean }
type Opts = { freeOn: boolean; freeMin: string; weight: string; pkg: string }
type CForm = { id: number | null; provider: string; accountId: string; apiKey: string; locked: boolean }

export default function ShippingMethodsPage() {
  const blocked = useModuleGuard("Shipping Methods")
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()

  const [zones, setZones] = useState<ShippingMethod[]>([])
  const [couriers, setCouriers] = useState<CourierAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [formErr, setFormErr] = useState("")
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [cform, setCform] = useState<CForm | null>(null)
  const [cerr, setCerr] = useState("")
  const [csaving, setCsaving] = useState(false)

  const [base, setBase] = useState<Opts>({ freeOn: false, freeMin: "2000", weight: "0.5", pkg: PACKAGES[0] })
  const [opts, setOpts] = useState<Opts>(base)
  const [sampleCart, setSampleCart] = useState("1450")
  const [optErr, setOptErr] = useState("")
  const [optSaving, setOptSaving] = useState(false)
  const dirty = JSON.stringify(opts) !== JSON.stringify(base)

  const load = useCallback(async () => {
    try {
      const [list, accts, all] = await Promise.all([shippingMethodApi.getAll(), courierAccountApi.getAll(), settingsApi.getAll()])
      setZones([...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
      setCouriers(accts)
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
      toast({ variant: "destructive", title: "Failed to load shipping settings" })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  if (blocked) return blocked

  const fail = (title: string, e: any) =>
    toast({ variant: "destructive", title, description: e?.response?.data?.message || "Please try again" })
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
    if (!name) return setFormErr("Name is required.")
    if (zones.some((z) => z.id !== form.id && z.name.toLowerCase() === name.toLowerCase())) return setFormErr("An option with this name already exists.")
    const pickup = form.type === "pickup"
    if (!pickup && (form.std === "" || !isFinite(std) || std < 0)) return setFormErr("Delivery charge must be 0 or more.")
    if (form.sort !== "" && (!Number.isInteger(Number(form.sort)) || Number(form.sort) < 0)) return setFormErr("Sort order must be a whole number, 0 or more.")
    const body = {
      name, type: form.type, price: pickup ? 0 : std, estimated_days: form.time.trim(),
      description: form.desc.trim(), icon: form.icon, sort_order: form.sort === "" ? zones.length + 1 : Number(form.sort), is_active: form.active,
    }
    setSaving(true)
    try {
      if (form.id) { await shippingMethodApi.update(form.id, body); toast({ title: "Delivery option updated" }) }
      else { await shippingMethodApi.create(body); toast({ title: "Delivery option added" }) }
      setForm(null)
      await load()
    } catch (e: any) {
      setFormErr(e?.response?.data?.message || "Could not save delivery option")
    } finally {
      setSaving(false)
    }
  }

  const toggleZone = async (z: ShippingMethod) => {
    setBusyId(z.id)
    setZones((p) => p.map((x) => (x.id === z.id ? { ...x, isActive: !x.isActive } : x)))
    try { await shippingMethodApi.toggle(z.id) }
    catch (e) { setZones((p) => p.map((x) => (x.id === z.id ? { ...x, isActive: z.isActive } : x))); fail("Could not update status", e) }
    finally { setBusyId(null) }
  }

  const removeZone = async (z: ShippingMethod) => {
    if (!window.confirm(`Delete delivery option "${z.name}"? It will be removed from checkout immediately.`)) return
    setBusyId(z.id)
    try {
      await shippingMethodApi.delete(z.id)
      toast({ title: "Delivery option deleted" })
      if (form?.id === z.id) setForm(null)
      await load()
    } catch (e) { fail("Could not delete delivery option", e) }
    finally { setBusyId(null) }
  }

  // ---- couriers ---------------------------------------------------------
  const newCourier = (provider = "Pathao") => { setCform({ id: null, provider, accountId: "", apiKey: "", locked: false }); setCerr("") }
  const editCourier = (c: CourierAccount) => { setCform({ id: c.id, provider: c.provider, accountId: c.accountId ?? "", apiKey: "", locked: true }); setCerr("") }

  const saveCourier = async () => {
    if (!cform) return
    const provider = cform.provider.trim()
    if (!provider) return setCerr("Provider name is required.")
    if (!cform.id && couriers.some((c) => c.provider.toLowerCase() === provider.toLowerCase())) return setCerr("This courier is already added.")
    setCsaving(true)
    try {
      if (cform.id) {
        await courierAccountApi.update(cform.id, { accountId: cform.accountId.trim(), apiKey: cform.apiKey.trim() || undefined })
        toast({ title: "Courier account updated", description: provider })
      } else {
        await courierAccountApi.create({ provider, accountId: cform.accountId.trim() || undefined, apiKey: cform.apiKey.trim() || undefined, isActive: true })
        toast({ title: "Courier account added", description: provider })
      }
      setCform(null)
      await load()
    } catch (e: any) {
      setCerr(e?.response?.data?.errors?.provider?.[0] || e?.response?.data?.message || "Could not save courier account")
    } finally {
      setCsaving(false)
    }
  }

  const toggleCourier = async (c: CourierAccount) => {
    setBusyId(-c.id)
    try { await courierAccountApi.update(c.id, { isActive: !c.isActive }); await load() }
    catch (e) { fail("Could not update courier", e) }
    finally { setBusyId(null) }
  }

  const removeCourier = async (c: CourierAccount) => {
    if (!window.confirm(`Remove courier account "${c.provider}"?`)) return
    setBusyId(-c.id)
    try {
      await courierAccountApi.delete(c.id)
      toast({ title: "Courier account removed", description: c.provider })
      if (cform?.id === c.id) setCform(null)
      await load()
    } catch (e) { fail("Could not remove courier", e) }
    finally { setBusyId(null) }
  }

  // ---- options / packaging ---------------------------------------------
  const saveOpts = async () => {
    const min = Number(opts.freeMin), w = Number(opts.weight)
    let e = ""
    if (opts.freeMin === "" || !isFinite(min) || min < 0) e = "Free delivery minimum must be 0 or more."
    else if (opts.freeOn && min === 0) e = "Set a minimum order above 0 for free delivery."
    else if (opts.weight === "" || !isFinite(w) || w <= 0) e = "Default weight must be more than 0."
    if (e) { setOptErr(e); toast({ variant: "destructive", title: e }); return }
    setOptSaving(true)
    try {
      await settingsApi.updateShipping({ freeOn: opts.freeOn, freeMin: min, weight: w, pkg: opts.pkg })
      // storefront reads the free-shipping threshold from general settings
      await settingsApi.updateGeneral({ freeShippingThreshold: opts.freeOn ? min : null })
      toast({ title: "Shipping settings saved" })
      setOptErr("")
      await load()
    } catch (err) { fail("Could not save shipping settings", err) }
    finally { setOptSaving(false) }
  }

  const active = zones.filter((z) => z.isActive)
  const freeMin = Number(opts.freeMin) || 0
  const cart = Number(sampleCart) || 0
  const freeApplies = opts.freeOn && freeMin > 0 && cart >= freeMin
  const fee = (z: ShippingMethod, rate: number) => (z.type === "pickup" || freeApplies || !rate ? "Free" : money(rate))
  const checkout = active.map((z) => ({
    name: z.type === "pickup" ? `${z.name} (pickup, no address needed)` : z.name,
    time: [z.description, z.estimatedDays].filter(Boolean).join(" · ") || "—",
    price: fee(z, z.price),
  }))

  const presetRows = COURIERS.map(([name, ini]) => ({ name, ini, acct: couriers.find((c) => c.provider.toLowerCase() === name.toLowerCase()) }))
  const customRows = couriers.filter((c) => !COURIERS.some(([n]) => n.toLowerCase() === c.provider.toLowerCase()))

  const CourierCard = ({ name, ini, acct }: { name: string; ini: string; acct?: CourierAccount }) => (
    <Card className="gap-3 p-3 shadow-none">
      <div className="flex items-center gap-3">
        <UserAvatar shape="square" className="size-10" name={name} fallback={ini} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{name}</div>
          <div className={cn("truncate text-xs", acct?.isActive ? "text-foreground" : "text-muted-foreground")}>
            {acct ? (acct.isActive ? "Enabled" : "Off") : "Not set up"}
            {acct?.accountId ? ` · ${acct.accountId}` : ""}{acct?.apiKey ? ` · key ${acct.apiKey}` : ""}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {acct ? (
          <>
            <Button type="button" variant="outline" disabled={busyId === -acct.id} onClick={() => toggleCourier(acct)}>{acct.isActive ? "Turn off" : "Turn on"}</Button>
            <WithTooltip content={`Edit ${name}`}><Button type="button" variant="outline" size="icon" aria-label={`Edit ${name}`} onClick={() => editCourier(acct)}><Pencil className="size-4" /></Button></WithTooltip>
            <WithTooltip content={`Remove ${name}`}><Button type="button" variant="destructive" size="icon" aria-label={`Remove ${name}`} disabled={busyId === -acct.id} onClick={() => removeCourier(acct)}><Trash2 className="size-4" /></Button></WithTooltip>
          </>
        ) : (
          <Button type="button" variant="outline" onClick={() => newCourier(name)}>Set up</Button>
        )}
      </div>
    </Card>
  )

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={<>Shipping &amp; delivery</>}
        description="Delivery options, couriers and what customers see at checkout."
      />

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <SectionCard
            title="Delivery options"
            description="Customers pick one of these at checkout (e.g. Inside Dhaka / Outside Dhaka) and pay its fixed charge."
            actions={<Button type="button" onClick={openNew}><Plus className="size-4" /> Add option</Button>}
          >
            {form && (
              <Card className="mb-3.5 gap-3 p-4 shadow-none">
                <strong>{form.id ? "Edit delivery option" : "New delivery option"}</strong>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={"Name *"} htmlFor="sm-name">
                    <Input id="sm-name" className="w-full" value={form.name} placeholder={form.type === "pickup" ? "Pick up from store" : "Inside Dhaka"} onChange={(e) => patch({ name: e.target.value })} />
                  </FormField>
                  <FormField label={"Type"} htmlFor="sm-type">
                    <Select value={form.type} onValueChange={(v) => patch(v === "pickup" ? { type: "pickup", std: "0" } : { type: "delivery" })}>
                      <SelectTrigger id="sm-type" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="delivery">Delivery (ships to an address)</SelectItem>
                        <SelectItem value="pickup">Pickup (collect in store, free)</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={"Delivery charge *"} htmlFor="sm-std">
                    <Input id="sm-std" className="w-full" type="number" min={0} value={form.std} disabled={form.type === "pickup"} onChange={(e) => patch({ std: e.target.value })} />
                  </FormField>
                  <FormField label={"Estimated delivery"} htmlFor="sm-time">
                    <Input id="sm-time" className="w-full" value={form.time} placeholder="1–2 days" onChange={(e) => patch({ time: e.target.value })} />
                  </FormField>
                  <FormField label={"Description"} htmlFor="sm-desc">
                    <Input id="sm-desc" className="w-full" value={form.desc} placeholder={form.type === "pickup" ? "Collect from our store" : "Delivery inside Dhaka city"} onChange={(e) => patch({ desc: e.target.value })} />
                  </FormField>
                  <FormField label={"Sort order"} htmlFor="sm-sort">
                    <Input id="sm-sort" className="w-full" type="number" min={0} step={1} value={form.sort} onChange={(e) => patch({ sort: e.target.value })} />
                  </FormField>
                  <FormField label={"Icon"} htmlFor="sm-icon">
                    <Select value={form.icon || undefined} onValueChange={(v) => patch({ icon: v })}>
                      <SelectTrigger id="sm-icon" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ICONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={"Status"} htmlFor="sm-status">
                    <Select value={form.active ? "active" : "inactive"} onValueChange={(v) => patch({ active: v === "active" })}>
                      <SelectTrigger id="sm-status" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
                <Item variant="outline" size="sm" className="flex-nowrap bg-card">
                  {(() => { const I = iconOf(form.icon); return <ItemMedia variant="icon"><I /></ItemMedia> })()}
                  <ItemContent className="min-w-0">
                    <ItemTitle className="block w-full truncate">{form.name.trim() || "Option name"}</ItemTitle>
                    <ItemDescription className="truncate">{form.desc.trim() || "Description"}</ItemDescription>
                  </ItemContent>
                  <ItemActions className="flex-col items-end gap-0">
                    <strong>{form.type === "pickup" || !Number(form.std) ? "Free" : money(Number(form.std))}</strong>
                    <span className="text-xs text-muted-foreground">{form.time.trim() || "Est. days"}</span>
                  </ItemActions>
                </Item>
                {formErr && <p className="text-sm font-medium text-destructive">{formErr}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancel</Button>
                  <Button type="button" onClick={saveZone} disabled={saving}>{saving ? "Saving…" : form.id ? "Save changes" : "Add option"}</Button>
                </div>
              </Card>
            )}

            {loading ? (
              <div className="flex flex-col gap-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : zones.length === 0 ? (
              <EmptyState
                bordered
                icon={Truck}
                title="No delivery options yet"
                description="Example: “Inside Dhaka” at ৳60 and “Outside Dhaka” at ৳120 — customers pick one at checkout."
                action={<Button type="button" variant="outline" onClick={openNew}>Add first option</Button>}
              />
            ) : (
              <div>
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Option</TableHead><TableHead>Sort</TableHead><TableHead>Charge</TableHead>
                      <TableHead>Time</TableHead><TableHead>On</TableHead><TableHead className="text-right">Actions</TableHead>
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
                                <div className={cn("truncate font-bold", !z.isActive && "text-muted-foreground")}>{z.name}{z.type === "pickup" && <Badge variant="secondary" className="ml-2 align-middle">Pickup</Badge>}</div>
                                {z.description && <div className="max-w-[240px] truncate text-xs text-muted-foreground">{z.description}</div>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums">{z.sortOrder}</TableCell>
                          <TableCell className="font-semibold tabular-nums">{z.price ? money(z.price) : "Free"}</TableCell>
                          <TableCell>{z.estimatedDays || "—"}</TableCell>
                          <TableCell><Switch on={z.isActive} label={z.isActive ? "Active, turn off" : "Inactive, turn on"} disabled={busyId === z.id} onClick={() => toggleZone(z)} /></TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1.5">
                              <WithTooltip content={`Edit ${z.name}`}><Button type="button" variant="outline" size="icon" aria-label={`Edit ${z.name}`} onClick={() => openEdit(z)}><Pencil className="size-4" /></Button></WithTooltip>
                              <WithTooltip content={`Delete ${z.name}`}><Button type="button" variant="destructive" size="icon" aria-label={`Delete ${z.name}`} disabled={busyId === z.id} onClick={() => removeZone(z)}><Trash2 className="size-4" /></Button></WithTooltip>
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
                <p><strong className="text-foreground">Display order.</strong> Options are shown to customers ordered by Sort order (lowest first); the first one is preselected. Only active options appear at checkout.</p>
              </AlertDescription>
            </Alert>

            <div className="mt-3.5 flex flex-wrap items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold">Free delivery over a minimum order</span>
                <span className="text-xs text-muted-foreground">Shown as “Add {formatCurrency(0).replace(/[\d.,\s-]/g, "")}X more for free delivery” at checkout</span>
              </span>
              <Input type="number" min={0} aria-label="Free delivery threshold amount" value={opts.freeMin} disabled={loading}
                onChange={(e) => { setOpts({ ...opts, freeMin: e.target.value }); setOptErr("") }} className="w-28" />
              <Switch on={opts.freeOn} label="Free delivery enabled" disabled={loading} onClick={() => { setOpts({ ...opts, freeOn: !opts.freeOn }); setOptErr("") }} />
            </div>
          </SectionCard>

          <SectionCard
            title="Courier accounts"
            description="Turn on the couriers you ship with."
            actions={<Button type="button" variant="outline" onClick={() => newCourier("")}><Plus className="size-4" /> Add courier</Button>}
          >
            {cform && (
              <Card className="mb-3.5 gap-3 p-4 shadow-none">
                <strong>{cform.id ? `Edit ${cform.provider}` : "Add courier account"}</strong>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label={"Provider *"} htmlFor="cr-provider">
                    <Input id="cr-provider" className="w-full" list="courier-presets" value={cform.provider} disabled={cform.locked} placeholder="Pathao"
                      onChange={(e) => { setCform({ ...cform, provider: e.target.value }); setCerr("") }} />
                    <datalist id="courier-presets">{COURIERS.map(([n]) => <option key={n} value={n} />)}</datalist>
                  </FormField>
                  <FormField label={"Account / merchant ID"} htmlFor="cr-account">
                    <Input id="cr-account" className="w-full" value={cform.accountId} onChange={(e) => setCform({ ...cform, accountId: e.target.value })} />
                  </FormField>
                  <FormField label={"API key"} htmlFor="cr-key">
                    <Input id="cr-key" className="w-full" type="password" autoComplete="off" value={cform.apiKey}
                      placeholder={cform.id ? "Leave blank to keep the stored key" : ""} onChange={(e) => setCform({ ...cform, apiKey: e.target.value })} />
                  </FormField>
                </div>
                {cerr && <p className="text-sm font-medium text-destructive">{cerr}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCform(null)}>Cancel</Button>
                  <Button type="button" onClick={saveCourier} disabled={csaving}>{csaving ? "Saving…" : cform.id ? "Save changes" : "Add courier"}</Button>
                </div>
              </Card>
            )}

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[100px]" />)}</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {presetRows.map((r) => <CourierCard key={r.name} {...r} />)}
                {customRows.map((c) => <CourierCard key={c.id} name={c.provider} ini={c.provider.slice(0, 2).toUpperCase()} acct={c} />)}
              </div>
            )}
          </SectionCard>
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <SectionCard title="Checkout options" description="Built from your active delivery options.">
            <FormField label="Sample cart subtotal" htmlFor="sample-cart" className="mb-3">
              <Input id="sample-cart" className="w-full" type="number" min={0} value={sampleCart} onChange={(e) => setSampleCart(e.target.value)} />
            </FormField>
            {loading ? <Skeleton className="h-24" /> : checkout.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active options — customers cannot choose a delivery option.</p>
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
                {freeApplies ? `Free delivery applied for a ${money(cart)} cart.` : `Add ${money(Math.max(0, freeMin - cart))} more for free delivery (free on ${money(freeMin)}+).`}
              </span>
            )}
          </SectionCard>

          <SectionCard title="Packaging defaults" description="Used when booking couriers.">
            <div className="flex flex-col gap-3">
              <FormField label={"Default weight (kg)"} htmlFor="pk-weight">
                <Input id="pk-weight" className="w-full" type="number" min={0} step={0.1} value={opts.weight} disabled={loading}
                  onChange={(e) => { setOpts({ ...opts, weight: e.target.value }); setOptErr("") }} />
              </FormField>
              <FormField label={"Default package"} htmlFor="pk-package">
                <Select value={opts.pkg || undefined} disabled={loading} onValueChange={(v) => setOpts({ ...opts, pkg: v })}>
                  <SelectTrigger id="pk-package" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PACKAGES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </SectionCard>
        </aside>
      </div>

      <Card className="sticky bottom-0 flex-row flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className={cn("text-sm", optErr ? "text-destructive" : dirty ? "text-foreground" : "text-muted-foreground")}>
          {optErr || (dirty ? "You have unsaved changes." : "Delivery option changes save instantly; other rates apply to new orders only.")}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={!dirty} onClick={() => { setOpts(base); setOptErr("") }}>Discard</Button>
          <Button type="button" disabled={optSaving || !dirty} onClick={saveOpts}>{optSaving ? "Saving…" : "Save changes"}</Button>
        </div>
      </Card>
    </div>
  )
}
