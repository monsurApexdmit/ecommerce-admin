"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { AlertCircle, Building2, MapPin, Pencil, Store, Trash2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { EmptyState } from "@/components/common/EmptyState"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WithTooltip } from "@/components/common/WithTooltip"

const TYPES: LocationType[] = ["Warehouse", "Shop", "Pickup point"]
const DISTRICTS = ["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi", "Barishal", "Rangpur", "Mymensingh"]
const TYPE_STYLE: Record<string, { Icon: typeof Store; label: ParseKeys<["store"]> }> = {
  Warehouse: { Icon: Building2, label: "store:locations.types.Warehouse" },
  Shop: { Icon: Store, label: "store:locations.types.Shop" },
  "Pickup point": { Icon: MapPin, label: "store:locations.types.Pickup point" },
}
// District names are saved as English values; shown translated when known
const DISTRICT_LABEL: Record<string, ParseKeys<["store"]>> = {
  Dhaka: "store:locations.districts.Dhaka",
  Chattogram: "store:locations.districts.Chattogram",
  Sylhet: "store:locations.districts.Sylhet",
  Khulna: "store:locations.districts.Khulna",
  Rajshahi: "store:locations.districts.Rajshahi",
  Barishal: "store:locations.districts.Barishal",
  Rangpur: "store:locations.districts.Rangpur",
  Mymensingh: "store:locations.districts.Mymensingh",
}


const blank = { type: "Shop" as LocationType, name: "", address: "", district: "Dhaka", phone: "", manager: "" }

export default function LocationsPage() {
  const { t } = useTranslation(["store", "common"])
  const typeLabel = (v?: string | null) => { const k = TYPE_STYLE[v || "Shop"]?.label; return k ? t(k) : String(v ?? "") }
  const districtLabel = (v?: string | null) => { const k = DISTRICT_LABEL[v || ""]; return k ? t(k) : String(v ?? "") }
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
    toast({ variant: "destructive", title, description: e?.response?.data?.message || e?.response?.data?.errors?.name?.[0] || t("common:extra.tryAgain") })

  const save = async () => {
    const name = form.name.trim(), address = form.address.trim()
    if (!name) return setErr(t("store:locations.errors.name"))
    if (!address) return setErr(t("store:locations.errors.address"))
    if (locs.some((l) => l.name.toLowerCase() === name.toLowerCase() && l.id !== editing?.id)) return setErr(t("store:locations.errors.duplicate"))
    if (atLimit) return setUpgradeOpen(true)
    setSaving(true)
    const body = { name, address, type: form.type, district: form.district, phone: form.phone.trim(), manager: form.manager.trim() }
    try {
      if (editing) {
        await locationApi.update(editing.id, body)
        toast({ title: t("store:locations.toast.updated"), description: name })
      } else {
        await locationApi.create(body)
        toast({ title: t("store:locations.toast.added"), description: name })
        loadLimits()
      }
      reset()
      await sync()
    } catch (e: any) {
      setErr(e?.response?.data?.message || t("store:locations.errors.save"))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (l: LocationResponse, key: "sellsInPos" | "shipsOnline") => {
    const next = !l[key]
    setLocs((p) => p.map((x) => (x.id === l.id ? { ...x, [key]: next } : x)))
    try { await locationApi.update(l.id, { [key]: next }) }
    catch (e) { setLocs((p) => p.map((x) => (x.id === l.id ? { ...x, [key]: !next } : x))); fail(t("store:locations.toast.updateFailed"), e) }
  }

  const makeDefault = async (l: LocationResponse) => {
    try {
      await locationApi.update(l.id, { isDefault: true })
      toast({ title: t("store:locations.toast.nowDefault", { name: l.name }) })
      await sync()
    } catch (e) { fail(t("store:locations.toast.defaultFailed"), e) }
  }

  const remove = async (l: LocationResponse) => {
    if (l.isDefault) return toast({ variant: "destructive", title: t("store:locations.toast.defaultNoDelete"), description: t("store:locations.toast.setAnotherFirst") })
    if ((l.units ?? 0) > 0) return toast({ variant: "destructive", title: t("store:locations.toast.holdsStock"), description: t("store:locations.toast.holdsStockDesc", { name: l.name, units: l.units }) })
    if (!window.confirm(t("store:locations.toast.confirmDelete", { name: l.name }))) return
    try {
      await locationApi.delete(l.id)
      toast({ title: t("store:locations.toast.deleted"), description: l.name })
      if (editing?.id === l.id) reset()
      loadLimits()
      await sync()
    } catch (e) { fail(t("store:locations.toast.deleteFailed"), e) }
  }

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("store:locations.title")}
        description={<>
          {t("store:locations.description")}
          {planLimits && <span className="ml-2">{t("store:locations.branchesUsed", { used: planLimits.currentBranches, max: unlimitedBranches ? t("store:locations.unlimited") : planLimits.maxBranches })}</span>}
        </>}
      />

      {atLimit && (
        <Alert>
          <AlertCircle />
          <AlertTitle>{t("store:locations.limitTitle")}</AlertTitle>
          <AlertDescription>{t("store:locations.limitBody", { plan: planLimits?.plan?.name ?? t("store:locations.currentPlan"), count: planLimits?.maxBranches ?? 0 })}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <section className="grid min-w-0 flex-[999_1_600px] grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[300px]" />)
            : sorted.length === 0
              ? <EmptyState bordered title={t("store:locations.empty")} description={t("store:locations.emptyDesc")} className="col-span-full" />
              : sorted.map((l) => {
                const st = TYPE_STYLE[l.type || "Shop"] ?? TYPE_STYLE.Shop
                return (
                  <Card key={l.id} className="gap-3 p-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar shape="square" className="size-11" fallback={<st.Icon className="size-5" />} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-base font-bold">
                          <span className="truncate">{l.name}</span>
                          {l.isDefault && <Badge>{t("store:locations.default")}</Badge>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{typeLabel(l.type)} · {[l.address, l.district ? districtLabel(l.district) : ""].filter(Boolean).join(", ")}</div>
                        {(l.phone || l.manager) && <div className="truncate text-xs text-muted-foreground">{[l.manager, l.phone].filter(Boolean).join(" · ")}</div>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[[t("store:locations.stockValue"), formatCurrency(l.stockValue ?? 0)], [t("store:locations.skus"), String(l.skus ?? 0)], [t("store:locations.staff"), String(l.staffCount ?? 0)]].map(([k, v]) => (
                        <Card key={k} className="min-w-0 gap-0 p-2 shadow-none">
                          <div className="text-xs text-muted-foreground">{k}</div>
                          <div className="truncate font-bold tabular-nums">{v}</div>
                        </Card>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2">
                      {([[t("store:locations.sellsInPos"), "sellsInPos"], [t("store:locations.shipsOnline"), "shipsOnline"]] as const).map(([label, key]) => {
                        const on = !!l[key]
                        return (
                          <FormField key={key} orientation="horizontal" label={label} htmlFor={`loc-${l.id}-${key}`}>
                            <Switch id={`loc-${l.id}-${key}`} checked={on} aria-label={label} onCheckedChange={() => toggle(l, key)} />
                          </FormField>
                        )
                      })}
                    </div>
                    <div className="flex gap-1.5">
                      <WithTooltip content={t("common:actions.edit")}><Button type="button" variant="outline" size="icon" aria-label={t("common:actions.edit")} onClick={() => startEdit(l)}><Pencil className="size-4" /></Button></WithTooltip>
                      <WithTooltip content={t("common:actions.delete")}><Button type="button" variant="destructive" size="icon" aria-label={t("common:actions.delete")} onClick={() => remove(l)}><Trash2 className="size-4" /></Button></WithTooltip>
                      {!l.isDefault && <Button type="button" variant="outline" onClick={() => makeDefault(l)}>{t("store:locations.setDefault")}</Button>}
                      <Button asChild variant="outline" className="flex-1"><Link href="/dashboard/inventory">{t("store:locations.viewStock")}</Link></Button>
                    </div>
                  </Card>
                )
              })}
        </section>

        <aside className="flex-[1_1_340px] self-start">
        <SectionCard title={editing ? t("store:locations.edit") : t("store:locations.add")} contentClassName="flex flex-col gap-3.5">
          {err && <p className="text-sm text-destructive">{err}</p>}
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium">{t("store:locations.type")}</p>
            <div role="radiogroup" aria-label={t("store:locations.type")} className="grid grid-cols-3 gap-1.5">
              {TYPES.map((ty) => {
                const on = form.type === ty
                return (
                  <Button key={ty} type="button" role="radio" aria-checked={on} onClick={() => setForm({ ...form, type: ty })}
                    variant={on ? "default" : "outline"} className="h-auto min-h-9 whitespace-normal">
                    {typeLabel(ty)}
                  </Button>
                )
              })}
            </div>
          </div>
          <FormField label={t("store:locations.name")} htmlFor="loc-name">
            <Input id="loc-name" className="w-full" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setErr("") }} placeholder={t("store:locations.namePh")} />
          </FormField>
          <FormField label={t("store:locations.address")} htmlFor="loc-address">
            <Input id="loc-address" className="w-full" value={form.address} onChange={(e) => { setForm({ ...form, address: e.target.value }); setErr("") }} placeholder={t("store:locations.addressPh")} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t("store:locations.district")} htmlFor="loc-district" className="min-w-0">
              <Select value={form.district || undefined} onValueChange={(v) => setForm({ ...form, district: v })}>
                <SelectTrigger id="loc-district" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from(new Set([...DISTRICTS, form.district])).filter(Boolean).map((d) => <SelectItem key={d} value={d}>{districtLabel(d)}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t("common:fields.phone")} htmlFor="loc-phone" className="min-w-0">
              <Input id="loc-phone" className="w-full" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t("store:locations.phonePh")} />
            </FormField>
          </div>
          <FormField label={t("store:locations.manager")} htmlFor="loc-manager">
            {managers.length > 0 ? (
              <Select value={form.manager || "__none"} onValueChange={(v) => setForm({ ...form, manager: v === "__none" ? "" : v })}>
                <SelectTrigger id="loc-manager" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t("store:locations.noManager")}</SelectItem>
                  {Array.from(new Set([...managers, ...(form.manager ? [form.manager] : [])])).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input id="loc-manager" className="w-full" value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} placeholder={t("store:locations.managerPh")} />
            )}
          </FormField>
          <Alert role="note">
            <AlertDescription>
              {planLimits ? `${unlimitedBranches ? t("store:locations.planUnlimited") : t("store:locations.planAllows", { count: planLimits.maxBranches })} ` : ""}{t("store:locations.stockNote")}
            </AlertDescription>
          </Alert>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={reset}>{t("common:actions.clear")}</Button>
            <Button type="button" disabled={saving} onClick={save}>
              {saving ? t("common:actions.saving") : editing ? t("common:actions.saveChanges") : t("store:locations.add")}
            </Button>
          </div>
        </SectionCard>
        </aside>
      </div>

      <UpgradeRequiredModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        title={t("store:locations.upgradeTitle")}
        description={t("store:locations.upgradeBody", { count: planLimits?.maxBranches ?? 0 })}
        limitType="warehouses"
        currentLimit={planLimits?.maxBranches}
      />
    </div>
  )
}
