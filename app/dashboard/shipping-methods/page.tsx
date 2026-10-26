"use client"

import { useCallback, useEffect, useState } from "react"
import { Box, Globe, Package, Pencil, Plus, Trash2, Truck, Zap } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import shippingMethodApi, { courierAccountApi, type CourierAccount, type ShippingMethod } from "@/lib/shippingMethodApi"
import { settingsApi } from "@/lib/settingsApi"

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

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft disabled:opacity-50"
const primaryBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft disabled:opacity-50"
const card = "rounded-[14px] border border-dash-border bg-dash-card p-[18px]"

function Switch({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick}
      className={cn("flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50", on ? "bg-dash-accent justify-end" : "bg-dash-border justify-start")}>
      <span className="size-4 rounded-full bg-white" />
    </button>
  )
}

type Form = { id: number | null; name: string; type: "delivery" | "pickup"; areas: string; std: string; exp: string; time: string; desc: string; sort: string; icon: string; active: boolean }
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
  const openNew = () => { setForm({ id: null, name: "", type: "delivery", areas: "", std: "", exp: "", time: "", desc: "", sort: String(zones.length + 1), icon: "package", active: true }); setFormErr("") }
  const openEdit = (z: ShippingMethod) => {
    setForm({ id: z.id, name: z.name, type: z.type === "pickup" ? "pickup" : "delivery", areas: z.areasCovered ?? "", std: String(z.price), exp: z.expressRate ? String(z.expressRate) : "", time: z.estimatedDays ?? "", desc: z.description ?? "", sort: String(z.sortOrder), icon: z.icon || "package", active: z.isActive })
    setFormErr("")
  }
  const patch = (p: Partial<Form>) => { setForm((f) => (f ? { ...f, ...p } : f)); setFormErr("") }

  const saveZone = async () => {
    if (!form) return
    const name = form.name.trim(), std = Number(form.std), exp = Number(form.exp === "" ? 0 : form.exp)
    if (!name) return setFormErr("Zone name is required.")
    if (zones.some((z) => z.id !== form.id && z.name.toLowerCase() === name.toLowerCase())) return setFormErr("A zone with this name already exists.")
    const pickup = form.type === "pickup"
    if (!pickup && (form.std === "" || !isFinite(std) || std < 0)) return setFormErr("Standard rate must be 0 or more.")
    if (!pickup && (!isFinite(exp) || exp < 0)) return setFormErr("Express rate must be 0 or more.")
    if (form.sort !== "" && (!Number.isInteger(Number(form.sort)) || Number(form.sort) < 0)) return setFormErr("Sort order must be a whole number, 0 or more.")
    const body = {
      name, type: form.type, areas_covered: form.areas.trim(), price: pickup ? 0 : std, express_rate: pickup ? 0 : exp, estimated_days: form.time.trim(),
      description: form.desc.trim(), icon: form.icon, sort_order: form.sort === "" ? zones.length + 1 : Number(form.sort), is_active: form.active,
    }
    setSaving(true)
    try {
      if (form.id) { await shippingMethodApi.update(form.id, body); toast({ title: "Shipping method updated" }) }
      else { await shippingMethodApi.create(body); toast({ title: "Shipping method added" }) }
      setForm(null)
      await load()
    } catch (e: any) {
      setFormErr(e?.response?.data?.message || "Could not save shipping method")
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
    if (!window.confirm(`Delete shipping method "${z.name}"? It will be removed from checkout immediately.`)) return
    setBusyId(z.id)
    try {
      await shippingMethodApi.delete(z.id)
      toast({ title: "Shipping method deleted" })
      if (form?.id === z.id) setForm(null)
      await load()
    } catch (e) { fail("Could not delete shipping method", e) }
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
  const checkout: { name: string; time: string; price: string; express?: boolean }[] = []
  active.forEach((z) => {
    checkout.push({ name: z.type === "pickup" ? `${z.name} (pickup, no address needed)` : z.name, time: [z.estimatedDays, z.areasCovered].filter(Boolean).join(" · ") || "—", price: fee(z, z.price) })
    if (z.type !== "pickup" && z.expressRate > 0) checkout.push({ name: `${z.name} — express`, time: z.estimatedDays || "—", price: fee(z, z.expressRate), express: true })
  })

  const presetRows = COURIERS.map(([name, ini, color]) => ({ name, ini, color, acct: couriers.find((c) => c.provider.toLowerCase() === name.toLowerCase()) }))
  const customRows = couriers.filter((c) => !COURIERS.some(([n]) => n.toLowerCase() === c.provider.toLowerCase()))

  const CourierCard = ({ name, ini, color, acct }: { name: string; ini: string; color: string; acct?: CourierAccount }) => (
    <div className="flex flex-col gap-3 rounded-[12px] border border-dash-border-soft p-3">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: color }}>{ini}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{name}</div>
          <div className={cn("truncate text-xs", acct?.isActive ? "text-dash-success-fg" : "text-dash-muted")}>
            {acct ? (acct.isActive ? "Enabled" : "Off") : "Not set up"}
            {acct?.accountId ? ` · ${acct.accountId}` : ""}{acct?.apiKey ? ` · key ${acct.apiKey}` : ""}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {acct ? (
          <>
            <button type="button" className={cn(outlineBtn, "h-9 px-3")} disabled={busyId === -acct.id} onClick={() => toggleCourier(acct)}>{acct.isActive ? "Turn off" : "Turn on"}</button>
            <button type="button" aria-label={`Edit ${name}`} className={iconBtn} onClick={() => editCourier(acct)}><Pencil className="size-4" /></button>
            <button type="button" aria-label={`Remove ${name}`} className={cn(iconBtn, "text-dash-danger")} disabled={busyId === -acct.id} onClick={() => removeCourier(acct)}><Trash2 className="size-4" /></button>
          </>
        ) : (
          <button type="button" className={cn(outlineBtn, "h-9 px-3")} onClick={() => newCourier(name)}>Set up</button>
        )}
      </div>
    </div>
  )

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div>
        <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Shipping &amp; delivery</h1>
        <p className="mt-1 text-sm text-dash-muted">Delivery zones, rates, couriers and what customers see at checkout.</p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <section className={card}>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-dash-display text-lg font-bold">Delivery zones &amp; shipping methods</h2>
                <p className="text-sm text-dash-muted">Shipping options shown to customers at checkout: price, estimated delivery and order.</p>
              </div>
              <button type="button" onClick={openNew} className={primaryBtn}><Plus className="size-4" /> Add method</button>
            </div>

            {form && (
              <div className="mb-3.5 flex flex-col gap-3 rounded-[12px] bg-dash-neutral-soft p-4">
                <strong>{form.id ? "Edit shipping method" : "New shipping method"}</strong>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Name *
                    <input className={input} value={form.name} onChange={(e) => patch({ name: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Zone type
                    <select className={input} value={form.type} onChange={(e) => patch(e.target.value === "pickup" ? { type: "pickup", std: "0", exp: "" } : { type: "delivery" })}>
                      <option value="delivery">Delivery (ships to an address)</option>
                      <option value="pickup">Pickup (collect in store, free)</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">{form.type === "pickup" ? "Pickup locations" : "Areas covered"}
                    <input className={input} value={form.areas} placeholder="e.g. Dhaka city corporation areas" onChange={(e) => patch({ areas: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Price (standard rate) *
                    <input className={input} type="number" min={0} value={form.std} disabled={form.type === "pickup"} onChange={(e) => patch({ std: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Express rate (0 = none)
                    <input className={input} type="number" min={0} value={form.exp} disabled={form.type === "pickup"} onChange={(e) => patch({ exp: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Estimated delivery
                    <input className={input} value={form.time} placeholder="1–2 days" onChange={(e) => patch({ time: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Description
                    <input className={input} value={form.desc} onChange={(e) => patch({ desc: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Sort order
                    <input className={input} type="number" min={0} step={1} value={form.sort} onChange={(e) => patch({ sort: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Icon
                    <select className={input} value={form.icon} onChange={(e) => patch({ icon: e.target.value })}>
                      {ICONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Status
                    <select className={input} value={form.active ? "active" : "inactive"} onChange={(e) => patch({ active: e.target.value === "active" })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-3 rounded-[10px] border border-dash-border bg-dash-card p-3">
                  {(() => { const I = iconOf(form.icon); return <span className="flex size-10 items-center justify-center rounded-xl bg-dash-success-soft text-dash-success-fg"><I className="size-5" /></span> })()}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-bold">{form.name.trim() || "Method name"}</span>
                    <span className="truncate text-xs text-dash-muted">{form.desc.trim() || "Description"}</span>
                  </span>
                  <span className="flex flex-col items-end">
                    <strong>{form.type === "pickup" || !Number(form.std) ? "Free" : money(Number(form.std))}</strong>
                    <span className="text-xs text-dash-muted">{form.time.trim() || "Est. days"}</span>
                  </span>
                </div>
                {formErr && <p className="text-[13px] font-semibold text-dash-danger">{formErr}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setForm(null)} className={outlineBtn}>Cancel</button>
                  <button type="button" onClick={saveZone} disabled={saving} className={primaryBtn}>{saving ? "Saving…" : form.id ? "Save changes" : "Add method"}</button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col gap-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-[10px]" />)}</div>
            ) : zones.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-[12px] bg-dash-neutral-soft p-8 text-sm text-dash-muted">
                No shipping methods yet. Add one to start charging for delivery.
                <button type="button" onClick={openNew} className={outlineBtn}>Add first method</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-dash-border text-left text-xs font-semibold text-dash-muted">
                      <th className="py-2 pr-3">Zone</th><th className="px-3 py-2">Sort</th><th className="px-3 py-2">Standard</th>
                      <th className="px-3 py-2">Express</th><th className="px-3 py-2">Time</th><th className="px-3 py-2">On</th><th className="py-2 pl-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map((z) => {
                      const I = iconOf(z.icon)
                      return (
                        <tr key={z.id} className="border-b border-dash-border-soft last:border-0">
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2.5">
                              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", z.isActive ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-neutral-soft text-dash-muted")}><I className="size-4" /></span>
                              <div className="min-w-0">
                                <div className={cn("truncate font-bold", !z.isActive && "text-dash-muted")}>{z.name}{z.type === "pickup" && <span className="ml-2 rounded-full bg-dash-neutral-soft px-2 py-[2px] align-middle text-[11px] font-semibold text-dash-neutral-fg">Pickup</span>}</div>
                                {(z.areasCovered || z.description) && <div className="max-w-[240px] truncate text-xs text-dash-muted">{z.areasCovered || z.description}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 tabular-nums">{z.sortOrder}</td>
                          <td className="px-3 font-semibold tabular-nums">{z.price ? money(z.price) : "Free"}</td>
                          <td className="px-3 tabular-nums">{z.expressRate ? money(z.expressRate) : "—"}</td>
                          <td className="px-3">{z.estimatedDays || "—"}</td>
                          <td className="px-3"><Switch on={z.isActive} label={z.isActive ? "Active, turn off" : "Inactive, turn on"} disabled={busyId === z.id} onClick={() => toggleZone(z)} /></td>
                          <td className="py-2.5 pl-3">
                            <div className="flex justify-end gap-1.5">
                              <button type="button" aria-label={`Edit ${z.name}`} className={iconBtn} onClick={() => openEdit(z)}><Pencil className="size-4" /></button>
                              <button type="button" aria-label={`Delete ${z.name}`} className={cn(iconBtn, "text-dash-danger")} disabled={busyId === z.id} onClick={() => removeZone(z)}><Trash2 className="size-4" /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-3.5 rounded-[10px] bg-dash-accent-soft px-3 py-2 text-[13px] text-dash-accent-fg">
              <strong>Display order.</strong> Methods are shown to customers ordered by Sort order (lowest first). Set the number when adding or editing a method.
            </p>

            <div className="mt-3.5 flex flex-wrap items-center gap-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold">Free delivery over a minimum order</span>
                <span className="text-xs text-dash-muted">Shown as “Add {formatCurrency(0).replace(/[\d.,\s-]/g, "")}X more for free delivery” at checkout</span>
              </span>
              <input type="number" min={0} aria-label="Free delivery threshold amount" value={opts.freeMin} disabled={loading}
                onChange={(e) => { setOpts({ ...opts, freeMin: e.target.value }); setOptErr("") }} className={cn(input, "w-28")} />
              <Switch on={opts.freeOn} label="Free delivery enabled" disabled={loading} onClick={() => { setOpts({ ...opts, freeOn: !opts.freeOn }); setOptErr("") }} />
            </div>
          </section>

          <section className={card}>
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-dash-display text-lg font-bold">Courier accounts</h2>
                <p className="text-sm text-dash-muted">Turn on the couriers you ship with.</p>
              </div>
              <button type="button" onClick={() => newCourier("")} className={outlineBtn}><Plus className="size-4" /> Add courier</button>
            </div>

            {cform && (
              <div className="mb-3.5 flex flex-col gap-3 rounded-[12px] bg-dash-neutral-soft p-4">
                <strong>{cform.id ? `Edit ${cform.provider}` : "Add courier account"}</strong>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Provider *
                    <input className={input} list="courier-presets" value={cform.provider} disabled={cform.locked} placeholder="Pathao"
                      onChange={(e) => { setCform({ ...cform, provider: e.target.value }); setCerr("") }} />
                    <datalist id="courier-presets">{COURIERS.map(([n]) => <option key={n} value={n} />)}</datalist>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Account / merchant ID
                    <input className={input} value={cform.accountId} onChange={(e) => setCform({ ...cform, accountId: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">API key
                    <input className={input} type="password" autoComplete="off" value={cform.apiKey}
                      placeholder={cform.id ? "Leave blank to keep the stored key" : ""} onChange={(e) => setCform({ ...cform, apiKey: e.target.value })} />
                  </label>
                </div>
                {cerr && <p className="text-[13px] font-semibold text-dash-danger">{cerr}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setCform(null)} className={outlineBtn}>Cancel</button>
                  <button type="button" onClick={saveCourier} disabled={csaving} className={primaryBtn}>{csaving ? "Saving…" : cform.id ? "Save changes" : "Add courier"}</button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[100px] rounded-[12px]" />)}</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {presetRows.map((r) => <CourierCard key={r.name} {...r} />)}
                {customRows.map((c) => <CourierCard key={c.id} name={c.provider} ini={c.provider.slice(0, 2).toUpperCase()} color="#3B4458" acct={c} />)}
              </div>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <section className={card}>
            <div className="mb-3.5">
              <h2 className="font-dash-display text-lg font-bold">Checkout options</h2>
              <p className="text-sm text-dash-muted">Built from your enabled zones.</p>
            </div>
            <label className="mb-3 flex flex-col gap-1.5 text-[13px] font-semibold">Sample cart subtotal
              <input className={input} type="number" min={0} value={sampleCart} onChange={(e) => setSampleCart(e.target.value)} />
            </label>
            {loading ? <Skeleton className="h-24 rounded-[12px]" /> : checkout.length === 0 ? (
              <p className="text-sm text-dash-muted">No active zones — customers cannot choose a delivery option.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {checkout.map((o, i) => (
                  <div key={i} className={cn("flex items-center gap-3 rounded-[10px] border p-3", i === 0 ? "border-dash-accent" : "border-dash-border")}>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-dash-accent-soft text-dash-accent-fg">{o.express ? <Zap className="size-4" /> : <Truck className="size-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{o.name}</div>
                      <div className="truncate text-xs text-dash-muted">{o.time}</div>
                    </div>
                    <strong className="tabular-nums">{o.price}</strong>
                  </div>
                ))}
              </div>
            )}
            {!loading && opts.freeOn && freeMin > 0 && (
              <span className="mt-3 block text-xs text-dash-muted">
                {freeApplies ? `Free delivery applied for a ${money(cart)} cart.` : `Add ${money(Math.max(0, freeMin - cart))} more for free delivery (free on ${money(freeMin)}+).`}
              </span>
            )}
          </section>

          <section className={card}>
            <div className="mb-3.5">
              <h2 className="font-dash-display text-lg font-bold">Packaging defaults</h2>
              <p className="text-sm text-dash-muted">Used when booking couriers.</p>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Default weight (kg)
                <input className={input} type="number" min={0} step={0.1} value={opts.weight} disabled={loading}
                  onChange={(e) => { setOpts({ ...opts, weight: e.target.value }); setOptErr("") }} />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Default package
                <select className={input} value={opts.pkg} disabled={loading} onChange={(e) => setOpts({ ...opts, pkg: e.target.value })}>
                  {PACKAGES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>
          </section>
        </aside>
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-dash-border bg-dash-card px-[18px] py-3">
        <span className={cn("text-sm", optErr ? "text-dash-danger" : dirty ? "text-dash-warn-fg" : "text-dash-muted")}>
          {optErr || (dirty ? "You have unsaved changes." : "Zone changes save instantly; other rates apply to new orders only.")}
        </span>
        <div className="flex gap-2">
          <button type="button" className={outlineBtn} disabled={!dirty} onClick={() => { setOpts(base); setOptErr("") }}>Discard</button>
          <button type="button" className={primaryBtn} disabled={optSaving || !dirty} onClick={saveOpts}>{optSaving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  )
}
