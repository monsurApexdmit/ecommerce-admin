"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, Building2, MapPin, Pencil, Store, Trash2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { locationApi, type LocationResponse, type LocationType } from "@/lib/locationApi"
import { staffApi } from "@/lib/staffApi"
import saasCompanyApi, { type PlanLimits } from "@/lib/saasCompanyApi"
import { UpgradeRequiredModal } from "@/components/UpgradeRequiredModal"
import { cn } from "@/lib/utils"

const TYPES: LocationType[] = ["Warehouse", "Shop", "Pickup point"]
const DISTRICTS = ["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi", "Barishal", "Rangpur", "Mymensingh"]
const TYPE_STYLE: Record<string, { tint: string; Icon: typeof Store }> = {
  Warehouse: { tint: "bg-dash-accent-soft text-dash-accent-fg", Icon: Building2 },
  Shop: { tint: "bg-dash-success-soft text-dash-success-fg", Icon: Store },
  "Pickup point": { tint: "bg-dash-warn-soft text-dash-warn-fg", Icon: MapPin },
}

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft disabled:opacity-50"

const blank = { type: "Shop" as LocationType, name: "", address: "", district: "Dhaka", phone: "", manager: "" }

export default function LocationsPage() {
  const blocked = useModuleGuard("Store Locations")
  const { formatCurrency } = useCompanySettings()
  const { refreshLocations } = useWarehouse()
  const { toast } = useToast()

  const [locs, setLocs] = useState<LocationResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<LocationResponse | null>(null)
  const [form, setForm] = useState(blank)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)
  const [managers, setManagers] = useState<string[]>([])
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await locationApi.getAll()
      setLocs(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLimits = useCallback(() => { saasCompanyApi.getPlanLimits().then(setPlanLimits).catch(() => {}) }, [])

  useEffect(() => { load(); loadLimits() }, [load, loadLimits])
  useEffect(() => {
    staffApi.getAll({ limit: 100 }).then((r) => {
      setManagers(Array.from(new Set(r.data.map((s: any) => s.name).filter(Boolean))) as string[])
    }).catch(() => {})
  }, [])

  const unlimitedBranches = !!planLimits && (planLimits.maxBranches >= 999999 || planLimits.maxBranches < 0)
  const atLimit = planLimits !== null && !planLimits.canAddBranch && !editing
  const sorted = useMemo(() => [...locs].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.id - b.id), [locs])

  if (blocked) return blocked

  const reset = () => { setEditing(null); setForm(blank); setErr("") }
  const startEdit = (l: LocationResponse) => {
    setEditing(l)
    setForm({
      type: (l.type as LocationType) || "Shop", name: l.name, address: l.address || "",
      district: l.district || "Dhaka", phone: l.phone || "", manager: l.manager || "",
    })
    setErr("")
  }
  const sync = async () => { await load(); refreshLocations() }
  const fail = (title: string, e: any) =>
    toast({ variant: "destructive", title, description: e?.response?.data?.message || e?.response?.data?.errors?.name?.[0] || "Please try again" })

  const save = async () => {
    const name = form.name.trim(), address = form.address.trim()
    if (!name) return setErr("Name is required.")
    if (!address) return setErr("Address is required.")
    if (locs.some((l) => l.name.toLowerCase() === name.toLowerCase() && l.id !== editing?.id)) return setErr("A location with this name already exists.")
    if (atLimit) return setUpgradeOpen(true)
    setSaving(true)
    const body = { name, address, type: form.type, district: form.district, phone: form.phone.trim(), manager: form.manager.trim() }
    try {
      if (editing) {
        await locationApi.update(editing.id, body)
        toast({ title: "Location updated", description: name })
      } else {
        await locationApi.create(body)
        toast({ title: "Location added", description: name })
        loadLimits()
      }
      reset()
      await sync()
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not save location")
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (l: LocationResponse, key: "sellsInPos" | "shipsOnline") => {
    const next = !l[key]
    setLocs((p) => p.map((x) => (x.id === l.id ? { ...x, [key]: next } : x)))
    try { await locationApi.update(l.id, { [key]: next }) }
    catch (e) { setLocs((p) => p.map((x) => (x.id === l.id ? { ...x, [key]: !next } : x))); fail("Could not update location", e) }
  }

  const makeDefault = async (l: LocationResponse) => {
    try {
      await locationApi.update(l.id, { isDefault: true })
      toast({ title: `${l.name} is now the default location` })
      await sync()
    } catch (e) { fail("Could not set default", e) }
  }

  const remove = async (l: LocationResponse) => {
    if (l.isDefault) return toast({ variant: "destructive", title: "The default location cannot be deleted", description: "Set another default first." })
    if ((l.units ?? 0) > 0) return toast({ variant: "destructive", title: "Location still holds stock", description: `${l.name} still holds ${l.units} unit(s) of stock. Transfer it first.` })
    if (!window.confirm(`Delete location "${l.name}"?`)) return
    try {
      await locationApi.delete(l.id)
      toast({ title: "Location deleted", description: l.name })
      if (editing?.id === l.id) reset()
      loadLimits()
      await sync()
    } catch (e) { fail("Could not delete location", e) }
  }

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div>
        <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Locations</h1>
        <p className="mt-1 text-sm text-dash-muted">
          Warehouses and shops — where stock lives and where you sell from.
          {planLimits && <span className="ml-2 text-dash-muted">({planLimits.currentBranches}/{unlimitedBranches ? "unlimited" : planLimits.maxBranches} branches used)</span>}
        </p>
      </div>

      {atLimit && (
        <div className="flex items-start gap-3 rounded-[14px] border border-dash-border bg-dash-warn-soft p-4 text-dash-warn-fg">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Branch limit reached</p>
            <p>Your {planLimits?.plan?.name ?? "current"} plan allows {planLimits?.maxBranches} branch{planLimits?.maxBranches === 1 ? "" : "es"}. Upgrade your plan to add more locations.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <section className="grid min-w-0 flex-[999_1_600px] grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[300px] rounded-[14px]" />)
            : sorted.length === 0
              ? <div className="col-span-full rounded-[14px] border border-dash-border bg-dash-card p-10 text-center text-sm text-dash-muted">No locations yet. Add your first warehouse or shop.</div>
              : sorted.map((l) => {
                const st = TYPE_STYLE[l.type || "Shop"] ?? TYPE_STYLE.Shop
                return (
                  <article key={l.id} className="flex flex-col gap-3 rounded-[14px] border border-dash-border bg-dash-card p-[18px]">
                    <div className="flex items-center gap-3">
                      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", st.tint)}><st.Icon className="size-5" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-base font-bold">
                          <span className="truncate">{l.name}</span>
                          {l.isDefault && <span className="rounded-md bg-dash-ink px-1.5 py-px text-[11px] font-bold text-dash-card">Default</span>}
                        </div>
                        <div className="truncate text-xs text-dash-muted">{l.type || "Shop"} · {[l.address, l.district].filter(Boolean).join(", ")}</div>
                        {(l.phone || l.manager) && <div className="truncate text-xs text-dash-muted">{[l.manager, l.phone].filter(Boolean).join(" · ")}</div>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[["Stock value", formatCurrency(l.stockValue ?? 0)], ["SKUs", String(l.skus ?? 0)], ["Staff", String(l.staffCount ?? 0)]].map(([k, v]) => (
                        <div key={k} className="min-w-0 rounded-[10px] bg-dash-neutral-soft p-2">
                          <div className="text-[11px] text-dash-muted">{k}</div>
                          <div className="truncate font-bold tabular-nums">{v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 text-sm">
                      {([["Sells in POS", "sellsInPos"], ["Ships online orders", "shipsOnline"]] as const).map(([label, key]) => {
                        const on = !!l[key]
                        return (
                          <div key={key} className="flex items-center justify-between">
                            <span>{label}</span>
                            <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => toggle(l, key)}
                              className={cn("flex h-5 w-9 items-center rounded-full p-0.5 transition-colors", on ? "bg-dash-accent justify-end" : "bg-dash-border justify-start")}>
                              <span className="size-4 rounded-full bg-white" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-1.5">
                      <button type="button" aria-label="Edit" className={iconBtn} onClick={() => startEdit(l)}><Pencil className="size-4" /></button>
                      <button type="button" aria-label="Delete" className={cn(iconBtn, "text-dash-danger-fg")} onClick={() => remove(l)}><Trash2 className="size-4" /></button>
                      {!l.isDefault && <button type="button" onClick={() => makeDefault(l)} className="h-9 rounded-lg border border-dash-border bg-dash-card px-2.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">Set default</button>}
                      <Link href="/dashboard/inventory" className="flex h-9 flex-1 items-center justify-center rounded-lg border border-dash-border text-[13px] font-semibold hover:bg-dash-neutral-soft">View stock</Link>
                    </div>
                  </article>
                )
              })}
        </section>

        <aside className="flex flex-[1_1_340px] flex-col gap-3.5 self-start rounded-[14px] border border-dash-border bg-dash-card p-5">
          <h2 className="font-dash-display text-lg font-bold">{editing ? "Edit location" : "Add location"}</h2>
          {err && <p className="text-[13px] text-dash-danger-fg">{err}</p>}
          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Type
            <div role="radiogroup" aria-label="Type" className="grid grid-cols-3 gap-1.5">
              {TYPES.map((t) => {
                const on = form.type === t
                return (
                  <button key={t} type="button" role="radio" aria-checked={on} onClick={() => setForm({ ...form, type: t })}
                    className={cn("min-h-11 rounded-[10px] border-2 px-2 py-1.5 text-[13px] font-bold", on ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>
                    {t}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Name *
            <input className={input} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErr("") }} placeholder="e.g. Dhanmondi Outlet" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Address *
            <input className={input} value={form.address} onChange={(e) => { setForm({ ...form, address: e.target.value }); setErr("") }} placeholder="House, road, area" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">District
              <select className={input} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
                {Array.from(new Set([...DISTRICTS, form.district])).map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Phone
              <input className={input} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXX-XXXXXX" />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Manager
            {managers.length > 0 ? (
              <select className={input} value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })}>
                <option value="">No manager</option>
                {Array.from(new Set([...managers, ...(form.manager ? [form.manager] : [])])).map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input className={input} value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} placeholder="Manager name (no staff yet)" />
            )}
          </label>
          <div className="rounded-[10px] bg-dash-accent-soft px-3 py-2.5 text-[13px] text-dash-accent-fg">
            {planLimits ? (unlimitedBranches ? "Your plan allows unlimited locations. " : `Your plan allows ${planLimits.maxBranches} location${planLimits.maxBranches === 1 ? "" : "s"}. `) : ""}Stock starts at 0 — use Transfers to move items in.
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={outlineBtn} onClick={reset}>Clear</button>
            <button type="button" disabled={saving} onClick={save} className="h-11 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save changes" : "Add location"}
            </button>
          </div>
        </aside>
      </div>

      <UpgradeRequiredModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title="Branch Limit Reached"
        description={`Your current plan allows ${planLimits?.maxBranches} branch${planLimits?.maxBranches === 1 ? "" : "es"}.`}
        limitType="warehouses"
        currentLimit={planLimits?.maxBranches}
      />
    </div>
  )
}
