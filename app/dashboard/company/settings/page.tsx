"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { ColorPicker } from "@/components/common/ColorPicker"
import { UserAvatar, getInitials } from "@/components/common/UserAvatar"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ACCENTS, ACCENT_STORAGE_KEY, applyAccent } from "@/components/accent-picker"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { cn } from "@/lib/utils"
import { settingsApi } from "@/lib/settingsApi"
import { TIMEZONES } from "@/lib/timezones"
import { saasCompanyApi, type CompanySettingsPayload } from "@/lib/saasCompanyApi"

/* ------------------------------------------------------------------ */
/* Static options                                                      */
/* ------------------------------------------------------------------ */

const DEF_COL = { primaryColor: "#6B1A2A", accentColor: "#B8963E", backgroundColor: "#F0EBE3" }
const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", INR: "₹", AUD: "A$", CAD: "C$", JPY: "¥", BDT: "৳" }

type Opt = [string, string]
type Key = ParseKeys<["store", "common"]>
/** [saved value, label key] — labels translated at render */
type KOpt = [string, Key]
const TAX_TYPES: KOpt[] = [["gst", "store:company.tax.types.gst"], ["vat", "store:company.tax.types.vat"], ["ein", "store:company.tax.types.ein"], ["other", "store:company.tax.types.other"]]
const CURRENCIES: KOpt[] = [
  ["USD", "store:company.regional.currencies.USD"], ["EUR", "store:company.regional.currencies.EUR"], ["GBP", "store:company.regional.currencies.GBP"],
  ["INR", "store:company.regional.currencies.INR"], ["AUD", "store:company.regional.currencies.AUD"], ["CAD", "store:company.regional.currencies.CAD"],
  ["JPY", "store:company.regional.currencies.JPY"], ["BDT", "store:company.regional.currencies.BDT"],
]
// Language names are written in their own language (endonyms), so they are not translated
const LANGUAGES: Opt[] = [["en", "English"], ["es", "Español (Spanish)"], ["fr", "Français (French)"], ["de", "Deutsch (German)"], ["it", "Italiano (Italian)"], ["pt", "Português (Portuguese)"], ["ja", "日本語 (Japanese)"], ["zh", "中文 (Chinese)"]]
const SYMBOL_POS: KOpt[] = [["before", "store:company.format.before"], ["after", "store:company.format.after"]]
const DEC_SEP: KOpt[] = [[".", "store:company.format.period"], [",", "store:company.format.comma"]]
const THOU_SEP: KOpt[] = [[",", "store:company.format.comma"], [".", "store:company.format.period"], [" ", "store:company.format.space"], ["", "store:company.format.none"]]
const WEIGHT: KOpt[] = [["kg", "store:company.units.kg"], ["lb", "store:company.units.lb"], ["g", "store:company.units.g"], ["oz", "store:company.units.oz"]]
const DIMENSION: KOpt[] = [["cm", "store:company.units.cm"], ["in", "store:company.units.in"], ["mm", "store:company.units.mm"]]
// Format patterns are shown as-is
const DATE_FMT: Opt[] = [["MM/DD/YYYY", "MM/DD/YYYY (01/15/2024)"], ["DD/MM/YYYY", "DD/MM/YYYY (15/01/2024)"], ["YYYY-MM-DD", "YYYY-MM-DD (2024-01-15)"]]
const TIME_FMT: KOpt[] = [["12h", "store:company.dateTime.h12"], ["24h", "store:company.dateTime.h24"]]
const ACCENT_LABEL: Record<string, Key> = {
  Blue: "store:company.appearance.accents.Blue", Emerald: "store:company.appearance.accents.Emerald", Indigo: "store:company.appearance.accents.Indigo",
  Violet: "store:company.appearance.accents.Violet", Rose: "store:company.appearance.accents.Rose", Amber: "store:company.appearance.accents.Amber",
  Sky: "store:company.appearance.accents.Sky",
}

interface Form {
  name: string; industry: string; website: string; phone: string; address: string
  city: string; state: string; zipCode: string; country: string; description: string
  taxId: string; taxIdType: string; taxRate: string
  currency: string; timezone: string; language: string
  currencySymbolPosition: string; currencyDecimalSeparator: string; currencyThousandsSeparator: string; currencyDecimalPlaces: string
  weightUnit: string; dimensionUnit: string; dateFormat: string; timeFormat: string
  accentName: string
  primaryColor: string; accentColor: string; backgroundColor: string
  bEmail: string; bPhone: string; bAddress: string; bCity: string; bState: string; bZip: string; bCountry: string; bTaxId: string; bTaxIdType: string
}
type K = keyof Form

const PROFILE_KEYS: K[] = ["name", "industry", "website", "phone", "address", "city", "state", "zipCode", "country", "description"]
const SETTINGS_KEYS: K[] = ["taxId", "taxIdType", "taxRate", "currency", "timezone", "language", "currencySymbolPosition", "currencyDecimalSeparator", "currencyThousandsSeparator", "currencyDecimalPlaces", "weightUnit", "dimensionUnit", "dateFormat", "timeFormat", "accentName"]
const COLOR_KEYS: K[] = ["primaryColor", "accentColor", "backgroundColor"]
const BILLING_KEYS: K[] = ["bEmail", "bPhone", "bAddress", "bCity", "bState", "bZip", "bCountry", "bTaxId", "bTaxIdType"]

/* ------------------------------------------------------------------ */
/* Style tokens                                                        */
/* ------------------------------------------------------------------ */

const grid = "grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]"

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <SectionCard title={title} description={sub} contentClassName="flex flex-col gap-4">
      {children}
    </SectionCard>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CompanySettingsPage() {
  const { t } = useTranslation(["store", "common"])
  const tOpts = (opts: KOpt[]): Opt[] => opts.map(([v, k]) => [v, t(k)])
  const blocked = useModuleGuard("Company Settings")
  const { canWrite } = useSaasAuth()
  const { refreshSettings } = useCompanySettings()
  const writable = canWrite("Company Settings")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [base, setBase] = useState<Form | null>(null)
  const [v, setV] = useState<Form | null>(null)
  const [errs, setErrs] = useState<Partial<Record<K, string>>>({})
  const [err, setErr] = useState("")
  const [ok, setOk] = useState("")

  const load = useCallback(async () => {
    try {
      const [pr, st, gen] = await Promise.all([
        saasCompanyApi.getProfile(),
        saasCompanyApi.getSettings(),
        settingsApi.getAll(),
      ])
      // Billing contact is optional (new companies have none yet)
      const bc: any = await saasCompanyApi.getBillingContact().then((r) => r.data).catch(() => ({}))
      const p: any = pr.data ?? {}
      const s: any = st.data ?? {}
      const g: any = gen.data?.general ?? {}
      // Server value wins; localStorage is only a cache/fallback
      let savedAccent = ACCENTS[0].name as string
      try {
        const val = localStorage.getItem(ACCENT_STORAGE_KEY)
        savedAccent = ACCENTS.find((a) => a.value === val)?.name ?? savedAccent
      } catch { /* storage unavailable */ }
      const serverAccent = ACCENTS.find((a) => a.name === s.accentName)
      if (serverAccent) {
        savedAccent = serverAccent.name
        try { applyAccent(serverAccent.value) } catch { /* storage unavailable */ }
      }

      const form: Form = {
        name: p.name ?? "", industry: p.industry ?? "", website: p.website ?? "", phone: p.phone ?? "",
        address: p.address ?? "", city: p.city ?? "", state: p.state ?? "", zipCode: p.zipCode ?? "",
        country: p.country ?? "", description: p.description ?? "",
        taxId: s.taxId ?? "", taxIdType: s.taxIdType || "gst", taxRate: String(s.taxRate ?? 0),
        currency: s.currency ?? "BDT", timezone: s.timezone ?? "Asia/Dhaka", language: s.language ?? "en",
        currencySymbolPosition: s.currencySymbolPosition ?? "before",
        currencyDecimalSeparator: s.currencyDecimalSeparator ?? ".",
        currencyThousandsSeparator: s.currencyThousandsSeparator ?? ",",
        currencyDecimalPlaces: String(s.currencyDecimalPlaces ?? 2),
        weightUnit: s.weightUnit ?? "kg", dimensionUnit: s.dimensionUnit ?? "cm",
        dateFormat: s.dateFormat ?? "MM/DD/YYYY", timeFormat: s.timeFormat ?? "12h",
        accentName: savedAccent,
        primaryColor: s.brandPrimaryColor ?? g.primaryColor ?? DEF_COL.primaryColor,
        accentColor: s.brandAccentColor ?? g.accentColor ?? DEF_COL.accentColor,
        backgroundColor: s.brandBackgroundColor ?? g.backgroundColor ?? DEF_COL.backgroundColor,
        bEmail: bc.email ?? "", bPhone: bc.phone ?? "", bAddress: bc.address ?? "", bCity: bc.city ?? "",
        bState: bc.state ?? "", bZip: bc.zipCode ?? "", bCountry: bc.country ?? "",
        bTaxId: bc.taxId ?? "", bTaxIdType: bc.taxIdType || "gst",
      }
      setBase(form); setV(form); setErrs({})
    } catch (e: any) {
      setErr(e?.response?.data?.message || t("store:company.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const changed = useMemo(() => {
    if (!base || !v) return [] as K[]
    return (Object.keys(v) as K[]).filter((k) => v[k] !== base[k])
  }, [base, v])
  const dirty = changed.length > 0

  const set = (k: K, val: string) => { setV((p) => (p ? { ...p, [k]: val } : p)); setErrs({}); setErr(""); setOk("") }

  const fmtSample = (f: Form) => {
    const dp = Number(f.currencyDecimalPlaces), n = 1234.5678
    const [i, fr] = n.toFixed(dp).split(".")
    const int = f.currencyThousandsSeparator ? i.replace(/\B(?=(\d{3})+(?!\d))/g, f.currencyThousandsSeparator) : i
    const num = int + (dp ? f.currencyDecimalSeparator + fr : "")
    const sym = SYMBOLS[f.currency] ?? f.currency
    return f.currencySymbolPosition === "after" ? `${num} ${sym}` : `${sym}${num}`
  }

  const validate = (f: Form) => {
    const e: Partial<Record<K, string>> = {}
    const name = f.name.trim()
    if (!name) e.name = t("store:company.errors.nameRequired")
    else if (name.length > 80) e.name = t("store:company.errors.nameLong")
    if (f.website.trim() && !/^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(f.website.trim())) e.website = t("store:company.errors.website")
    if (f.phone.trim() && !/^[+()\d][\d\s().\-+]{5,}$/.test(f.phone.trim())) e.phone = t("store:company.errors.phone")
    const tr = Number(f.taxRate)
    if (f.taxRate === "" || isNaN(tr) || tr < 0 || tr > 100) e.taxRate = t("store:company.errors.taxRate")
    COLOR_KEYS.forEach((k) => { if (!/^#[0-9a-fA-F]{6}$/.test(f[k].trim())) e[k] = t("store:company.errors.hex") })
    const anyB = (["bEmail", "bPhone", "bAddress", "bCity", "bState", "bZip", "bCountry", "bTaxId"] as K[]).some((k) => f[k].trim())
    if (anyB) {
      if (!f.bEmail.trim()) e.bEmail = t("store:company.errors.emailRequired")
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.bEmail.trim())) e.bEmail = t("store:company.errors.email")
      if (!f.bPhone.trim()) e.bPhone = t("store:company.errors.phoneRequired")
      if (!f.bAddress.trim()) e.bAddress = t("store:company.errors.street")
      if (!f.bCity.trim()) e.bCity = t("store:company.errors.city")
    }
    return e
  }

  const save = async () => {
    if (!v || !base) return
    const e = validate(v)
    if (Object.keys(e).length) { setErrs(e); setErr(t("store:company.fixFields")); setOk(""); return }
    const any = (ks: K[]) => ks.some((k) => changed.includes(k))
    setSaving(true); setErr(""); setOk("")
    const jobs: Promise<unknown>[] = []
    const tags: { name: string; keys: K[] }[] = []
    const run = (name: string, keys: K[], p: Promise<unknown>) => { jobs.push(p); tags.push({ name, keys }) }
    if (any(PROFILE_KEYS)) {
      run(t("store:company.sectionNames.profile"), PROFILE_KEYS, saasCompanyApi.updateProfile({
        companyProfile: {
          name: v.name.trim(), industry: v.industry.trim(), website: v.website.trim(), phone: v.phone.trim(),
          address: v.address.trim(), city: v.city.trim(), state: v.state.trim(), zipCode: v.zipCode.trim(),
          country: v.country.trim(), description: v.description.trim(),
        },
      }))
    }
    if (any(SETTINGS_KEYS) || any(COLOR_KEYS)) {
      const payload: CompanySettingsPayload = {
        taxId: v.taxId.trim(), taxIdType: v.taxIdType as any, taxRate: Number(v.taxRate),
        currency: v.currency, timezone: v.timezone, language: v.language,
        currencySymbolPosition: v.currencySymbolPosition as any,
        currencyDecimalSeparator: v.currencyDecimalSeparator as any,
        currencyThousandsSeparator: v.currencyThousandsSeparator as any,
        currencyDecimalPlaces: Number(v.currencyDecimalPlaces) as 0 | 1 | 2,
        weightUnit: v.weightUnit as any, dimensionUnit: v.dimensionUnit as any,
        dateFormat: v.dateFormat as any, timeFormat: v.timeFormat as any,
        accentName: v.accentName,
        brandPrimaryColor: v.primaryColor.trim(), brandAccentColor: v.accentColor.trim(), brandBackgroundColor: v.backgroundColor.trim(),
      }
      run(t("store:company.sectionNames.settings"), SETTINGS_KEYS, saasCompanyApi.updateSettings(payload))
    }
    if (any(COLOR_KEYS)) {
      run(t("store:company.sectionNames.colours"), COLOR_KEYS, settingsApi.updateGeneral({
        primaryColor: v.primaryColor.trim(), accentColor: v.accentColor.trim(), backgroundColor: v.backgroundColor.trim(),
      }))
    }
    if (any(BILLING_KEYS)) {
      run(t("store:company.sectionNames.billing"), BILLING_KEYS, saasCompanyApi.updateBillingContact({
        email: v.bEmail.trim(), phone: v.bPhone.trim(), address: v.bAddress.trim(), city: v.bCity.trim(),
        state: v.bState.trim(), zipCode: v.bZip.trim(), country: v.bCountry.trim(),
        taxId: v.bTaxId.trim(), taxIdType: v.bTaxIdType as any,
      }))
    }
    if (changed.includes("accentName")) {
      const a = ACCENTS.find((x) => x.name === v.accentName)
      if (a) { try { applyAccent(a.value) } catch { /* storage unavailable */ } }
    }
    const results = await Promise.allSettled(jobs)
    const bad = results.map((r, i) => ({ r, t: tags[i] })).filter((x) => x.r.status === "rejected") as { r: PromiseRejectedResult; t: { name: string; keys: K[] } }[]
    if (bad.length) {
      const names = Array.from(new Set(bad.map((x) => x.t.name)))
      const m = [t("store:shared.couldNotSave", { names: names.join(", ") }), names.length < tags.length ? t("store:shared.otherSectionsSaved") : "", (bad[0].r.reason as any)?.response?.data?.message ?? ""].filter(Boolean).join(" ")
      setErr(m); toast.error(m)
      const keep = new Set(bad.flatMap((x) => x.t.keys))
      const mine = v
      await load()
      // keep the unsaved edits of the failed sections so the user can retry
      setV((p) => (p ? ({ ...p, ...Object.fromEntries([...keep].map((k) => [k, mine[k]])) } as Form) : p))
      setErr(m)
      refreshSettings()
      setSaving(false)
      return
    }
    setOk(t("store:company.updated"))
    toast.success(t("store:company.saved"))
    setTimeout(() => setOk(""), 3000)
    await load()
    refreshSettings()
    setSaving(false)
  }

  const discard = () => {
    setV(base); setErrs({}); setErr(""); setOk("")
    if (dirty) {
      const a = ACCENTS.find((x) => x.name === base?.accentName)
      if (a) { try { applyAccent(a.value) } catch { /* ignore */ } }
      toast.success(t("store:shared.changesDiscarded"))
    }
  }

  if (blocked) return blocked

  const wrapper = "flex flex-col gap-5"
  const heading = <PageHeader title={t("store:company.title")} description={t("store:company.description")} />

  if (loading || !v || !base) {
    return (
      <div className={wrapper}>
        {heading}
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}
      </div>
    )
  }

  const text = (label: string, k: K, o: { ph?: string; type?: string; span?: boolean; step?: string; min?: string; max?: string } = {}) => (
    <FormField key={k} label={label} htmlFor={`cs-${k}`} error={errs[k]} className={cn("min-w-0", o.span && "col-[1/-1]")}>
      <Input id={`cs-${k}`} className="w-full" aria-invalid={!!errs[k]} type={o.type ?? "text"} placeholder={o.ph} step={o.step} min={o.min} max={o.max}
        value={v[k]} onChange={(e) => set(k, e.target.value)} />
    </FormField>
  )
  const select = (label: string, k: K, opts: Opt[]) => {
    const all = opts.some(([a]) => a === v[k]) ? opts : [...opts, [v[k], v[k]] as Opt]
    return (
      <FormField key={k} label={label} htmlFor={`cs-${k}`} className="min-w-0">
        <Select value={v[k] === "" ? "__none" : v[k]} onValueChange={(val) => set(k, val === "__none" ? "" : val)}>
          <SelectTrigger id={`cs-${k}`} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {all.map(([a, b]) => <SelectItem key={a} value={a === "" ? "__none" : a}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </FormField>
    )
  }

  const barText = err ? err : dirty ? t("store:shared.unsavedCount", { count: changed.length }) : t("store:shared.allSaved")

  return (
    <div className={wrapper}>
      {heading}

      {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
      {ok && <Alert role="status"><AlertDescription>✓ {ok}</AlertDescription></Alert>}

      <Section title={t("store:company.appearance.title")} sub={t("store:company.appearance.sub")}>
        <div role="group" aria-label={t("store:company.appearance.group")} className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => {
            const on = v.accentName === a.name
            return (
              <Button key={a.name} type="button" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => set("accentName", a.name)}>
                <span className="size-5 rounded-full" style={{ background: a.value }} />{ACCENT_LABEL[a.name] ? t(ACCENT_LABEL[a.name]) : a.name}
              </Button>
            )
          })}
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold">{t("store:company.appearance.brandTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("store:company.appearance.brandSub")}</p>
          </div>
          <div className={grid.replace("240px", "220px")}>
            {([["primaryColor", t("store:shared.primaryColor")], ["accentColor", t("store:shared.accentColor")], ["backgroundColor", t("store:shared.backgroundColor")]] as [K, string][]).map(([k, label]) => (
              <FormField key={k} label={label} htmlFor={`cs-${k}`} error={errs[k]} className="min-w-0">
                <span className="flex gap-2">
                  <ColorPicker aria-label={t("store:shared.colorPicker", { label })} value={/^#[0-9a-fA-F]{6}$/.test(v[k]) ? v[k] : "#000000"} onChange={(hex) => set(k, hex.toUpperCase())} />
                  <Input id={`cs-${k}`} type="text" aria-label={t("store:shared.colorHex", { label })} aria-invalid={!!errs[k]} value={v[k]} onChange={(e) => set(k, e.target.value)} className="min-w-0 flex-1" />
                </span>
              </FormField>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex h-9 w-[120px] items-center justify-center rounded-lg border text-xs font-bold" style={{ background: v.backgroundColor, color: v.primaryColor }}>{t("store:company.appearance.preview")}</span>
            <span className="flex h-9 w-[120px] items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: v.accentColor }}>{t("store:company.appearance.accent")}</span>
            <Button type="button" variant="outline" onClick={() => { setV((p) => (p ? { ...p, ...DEF_COL } : p)); setErrs({}); setOk("") }}>{t("store:company.appearance.resetDefaults")}</Button>
          </div>
        </div>
      </Section>

      <Section title={t("store:company.profile.title")} sub={t("store:company.profile.sub")}>
        <div className="flex flex-wrap items-center gap-3.5">
          <UserAvatar shape="square" name={v.name || t("store:company.profile.fallbackName")} className="size-[72px]" fallback={<span className="text-2xl font-semibold">{getInitials(v.name || t("store:company.profile.fallbackName"))}</span>} />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("store:company.profile.logo")}</span>
            <span className="text-xs text-muted-foreground">{t("store:company.profile.logoHint")}</span>
          </div>
        </div>
        <div className={grid}>
          {text(t("store:company.profile.name"), "name", { ph: t("store:company.profile.namePh") })}
          {text(t("store:company.profile.industry"), "industry", { ph: t("store:company.profile.industryPh") })}
          {text(t("store:shared.website"), "website", { ph: "https://example.com", type: "url" })}
          {text(t("store:company.profile.phone"), "phone", { ph: "+1 (555) 000-0000", type: "tel" })}
          {text(t("store:company.profile.street"), "address", { ph: t("store:company.profile.streetPh"), span: true })}
          {text(t("store:company.profile.city"), "city", { ph: t("store:company.profile.cityPh") })}
          {text(t("store:company.profile.state"), "state", { ph: t("store:company.profile.statePh") })}
          {text(t("store:company.profile.zip"), "zipCode", { ph: t("store:company.profile.zipPh") })}
          {text(t("store:company.profile.country"), "country", { ph: t("store:company.profile.countryPh") })}
          <FormField label={t("common:fields.description")} htmlFor="cs-description" className="col-[1/-1] min-w-0">
            <Textarea id="cs-description" rows={4} placeholder={t("store:company.profile.descriptionPh")} value={v.description} onChange={(e) => set("description", e.target.value)}
              className="w-full" />
          </FormField>
        </div>
      </Section>

      <Section title={t("store:company.tax.title")} sub={t("store:company.tax.sub")}>
        <div className={grid}>
          {text(t("store:company.tax.taxId"), "taxId", { ph: t("store:company.tax.taxIdPh") })}
          {select(t("store:company.tax.taxIdType"), "taxIdType", tOpts(TAX_TYPES))}
          {text(t("store:company.tax.taxRate"), "taxRate", { ph: "18", type: "number", step: "0.1", min: "0", max: "100" })}
        </div>
      </Section>

      <Section title={t("store:company.regional.title")} sub={t("store:company.regional.sub")}>
        <div className={grid}>
          {select(t("store:company.regional.currency"), "currency", tOpts(CURRENCIES))}
          {select(t("store:company.regional.timezone"), "timezone", TIMEZONES)}
        </div>
      </Section>

      <Section title={t("store:company.localization.title")} sub={t("store:company.localization.sub")}>
        <div className={grid}>{select(t("common:language.label"), "language", LANGUAGES)}</div>
      </Section>

      <Section title={t("store:company.format.title")} sub={t("store:company.format.sub", { sample: fmtSample(v) })}>
        <div className={grid}>
          {select(t("store:company.format.symbolPos"), "currencySymbolPosition", tOpts(SYMBOL_POS))}
          {select(t("store:company.format.decimalSep"), "currencyDecimalSeparator", tOpts(DEC_SEP))}
          {select(t("store:company.format.thousandsSep"), "currencyThousandsSeparator", tOpts(THOU_SEP))}
          {select(t("store:company.format.decimalPlaces"), "currencyDecimalPlaces", [0, 1, 2].map((n): Opt => [String(n), t("store:company.format.places", { count: n })]))}
        </div>
      </Section>

      <Section title={t("store:company.units.title")} sub={t("store:company.units.sub")}>
        <div className={grid}>
          {select(t("store:company.units.weight"), "weightUnit", tOpts(WEIGHT))}
          {select(t("store:company.units.dimension"), "dimensionUnit", tOpts(DIMENSION))}
        </div>
      </Section>

      <Section title={t("store:company.dateTime.title")} sub={t("store:company.dateTime.sub")}>
        <div className={grid}>
          {select(t("store:company.dateTime.date"), "dateFormat", DATE_FMT)}
          {select(t("store:company.dateTime.time"), "timeFormat", tOpts(TIME_FMT))}
        </div>
      </Section>

      <Section title={t("store:company.billing.title")} sub={t("store:company.billing.sub")}>
        <div className={grid.replace("240px", "220px")}>
          {text(t("common:fields.email"), "bEmail", { ph: t("store:company.billing.emailPh"), type: "email" })}
          {text(t("store:company.profile.phone"), "bPhone", { ph: "+1 (555) 000-0000", type: "tel" })}
          {text(t("store:company.profile.street"), "bAddress", { ph: t("store:company.profile.streetPh"), span: true })}
          {text(t("store:company.profile.city"), "bCity", { ph: t("store:company.profile.cityPh") })}
          {text(t("store:company.profile.state"), "bState", { ph: t("store:company.profile.statePh") })}
          {text(t("store:company.profile.zip"), "bZip", { ph: t("store:company.profile.zipPh") })}
          {text(t("store:company.profile.country"), "bCountry", { ph: t("store:company.profile.countryPh") })}
          {text(t("store:company.tax.taxId"), "bTaxId", { ph: t("store:company.tax.taxIdPh") })}
          {select(t("store:company.tax.taxIdType"), "bTaxIdType", tOpts(TAX_TYPES))}
        </div>
      </Section>

      <Card className="sticky bottom-0 z-10 flex-row flex-wrap items-center gap-2.5 px-4 py-3">
        <span className={cn("text-sm", err ? "text-destructive" : dirty ? "text-foreground" : "text-muted-foreground")}>{barText}</span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={discard} disabled={saving || !dirty}>{t("store:shared.discard")}</Button>
          <Button type="button" onClick={save} disabled={saving || !writable}>
            {saving ? t("common:actions.saving") : t("common:actions.saveChanges")}
          </Button>
        </div>
      </Card>
    </div>
  )
}
