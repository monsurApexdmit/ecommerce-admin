"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
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
const TAX_TYPES: Opt[] = [["gst", "GST (Goods & Services Tax)"], ["vat", "VAT (Value Added Tax)"], ["ein", "EIN (Employer ID Number)"], ["other", "Other"]]
const CURRENCIES: Opt[] = [["USD", "USD - US Dollar"], ["EUR", "EUR - Euro"], ["GBP", "GBP - British Pound"], ["INR", "INR - Indian Rupee"], ["AUD", "AUD - Australian Dollar"], ["CAD", "CAD - Canadian Dollar"], ["JPY", "JPY - Japanese Yen"], ["BDT", "BDT - Bangladeshi Taka"]]
const LANGUAGES: Opt[] = [["en", "English"], ["es", "Español (Spanish)"], ["fr", "Français (French)"], ["de", "Deutsch (German)"], ["it", "Italiano (Italian)"], ["pt", "Português (Portuguese)"], ["ja", "日本語 (Japanese)"], ["zh", "中文 (Chinese)"]]
const SYMBOL_POS: Opt[] = [["before", "Before amount (e.g., $1,234.56)"], ["after", "After amount (e.g., 1,234.56 $)"]]
const DEC_SEP: Opt[] = [[".", "Period (.)"], [",", "Comma (,)"]]
const THOU_SEP: Opt[] = [[",", "Comma (,)"], [".", "Period (.)"], [" ", "Space"], ["", "None"]]
const DEC_PLACES: Opt[] = [["0", "0 decimal places"], ["1", "1 decimal place"], ["2", "2 decimal places"]]
const WEIGHT: Opt[] = [["kg", "Kilogram (kg)"], ["lb", "Pound (lb)"], ["g", "Gram (g)"], ["oz", "Ounce (oz)"]]
const DIMENSION: Opt[] = [["cm", "Centimeter (cm)"], ["in", "Inch (in)"], ["mm", "Millimeter (mm)"]]
const DATE_FMT: Opt[] = [["MM/DD/YYYY", "MM/DD/YYYY (01/15/2024)"], ["DD/MM/YYYY", "DD/MM/YYYY (15/01/2024)"], ["YYYY-MM-DD", "YYYY-MM-DD (2024-01-15)"]]
const TIME_FMT: Opt[] = [["12h", "12-hour (2:30 PM)"], ["24h", "24-hour (14:30)"]]

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
      setErr(e?.response?.data?.message || "Failed to load company settings")
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
    if (!name) e.name = "Company name is required."
    else if (name.length > 80) e.name = "Company name must be 80 characters or fewer."
    if (f.website.trim() && !/^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(f.website.trim())) e.website = "Enter a valid URL starting with http:// or https://."
    if (f.phone.trim() && !/^[+()\d][\d\s().\-+]{5,}$/.test(f.phone.trim())) e.phone = "Enter a valid phone number."
    const tr = Number(f.taxRate)
    if (f.taxRate === "" || isNaN(tr) || tr < 0 || tr > 100) e.taxRate = "Tax rate must be between 0 and 100."
    COLOR_KEYS.forEach((k) => { if (!/^#[0-9a-fA-F]{6}$/.test(f[k].trim())) e[k] = "Use a hex colour like #6B1A2A." })
    const anyB = (["bEmail", "bPhone", "bAddress", "bCity", "bState", "bZip", "bCountry", "bTaxId"] as K[]).some((k) => f[k].trim())
    if (anyB) {
      if (!f.bEmail.trim()) e.bEmail = "Email is required."
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.bEmail.trim())) e.bEmail = "Enter a valid email address."
      if (!f.bPhone.trim()) e.bPhone = "Phone is required."
      if (!f.bAddress.trim()) e.bAddress = "Street address is required."
      if (!f.bCity.trim()) e.bCity = "City is required."
    }
    return e
  }

  const save = async () => {
    if (!v || !base) return
    const e = validate(v)
    if (Object.keys(e).length) { setErrs(e); setErr("Please fix the highlighted fields before saving."); setOk(""); return }
    const any = (ks: K[]) => ks.some((k) => changed.includes(k))
    setSaving(true); setErr(""); setOk("")
    const jobs: Promise<unknown>[] = []
    const tags: { name: string; keys: K[] }[] = []
    const run = (name: string, keys: K[], p: Promise<unknown>) => { jobs.push(p); tags.push({ name, keys }) }
    if (any(PROFILE_KEYS)) {
      run("Company profile", PROFILE_KEYS, saasCompanyApi.updateProfile({
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
      run("Regional, tax & appearance", SETTINGS_KEYS, saasCompanyApi.updateSettings(payload))
    }
    if (any(COLOR_KEYS)) {
      run("Storefront brand colours", COLOR_KEYS, settingsApi.updateGeneral({
        primaryColor: v.primaryColor.trim(), accentColor: v.accentColor.trim(), backgroundColor: v.backgroundColor.trim(),
      }))
    }
    if (any(BILLING_KEYS)) {
      run("Billing contact", BILLING_KEYS, saasCompanyApi.updateBillingContact({
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
      const m = `Could not save: ${names.join(", ")}.${names.length < tags.length ? " Other sections were saved." : ""} ${(bad[0].r.reason as any)?.response?.data?.message ?? ""}`.trim()
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
    setOk("Company settings updated successfully")
    toast.success("Company settings saved")
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
      toast.success("Changes discarded")
    }
  }

  if (blocked) return blocked

  const wrapper = "flex flex-col gap-5"
  const heading = <PageHeader title="Company Settings" description="Manage your company profile and general settings" />

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

  const barText = err ? err : dirty ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "All changes saved."

  return (
    <div className={wrapper}>
      {heading}

      {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
      {ok && <Alert role="status"><AlertDescription>✓ {ok}</AlertDescription></Alert>}

      <Section title="Appearance" sub="Pick the accent colour used across the admin.">
        <div role="group" aria-label="Accent color" className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => {
            const on = v.accentName === a.name
            return (
              <Button key={a.name} type="button" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => set("accentName", a.name)}>
                <span className="size-5 rounded-full" style={{ background: a.value }} />{a.name}
              </Button>
            )
          })}
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold">Storefront brand colors</h3>
            <p className="mt-1 text-sm text-muted-foreground">Used on your online store. Saved with the other changes.</p>
          </div>
          <div className={grid.replace("240px", "220px")}>
            {([["primaryColor", "Primary Color"], ["accentColor", "Accent Color"], ["backgroundColor", "Background Color"]] as [K, string][]).map(([k, label]) => (
              <FormField key={k} label={label} htmlFor={`cs-${k}`} error={errs[k]} className="min-w-0">
                <span className="flex gap-2">
                  <ColorPicker aria-label={`${label} picker`} value={/^#[0-9a-fA-F]{6}$/.test(v[k]) ? v[k] : "#000000"} onChange={(hex) => set(k, hex.toUpperCase())} />
                  <Input id={`cs-${k}`} type="text" aria-label={`${label} hex`} aria-invalid={!!errs[k]} value={v[k]} onChange={(e) => set(k, e.target.value)} className="min-w-0 flex-1" />
                </span>
              </FormField>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex h-9 w-[120px] items-center justify-center rounded-lg border text-xs font-bold" style={{ background: v.backgroundColor, color: v.primaryColor }}>Preview</span>
            <span className="flex h-9 w-[120px] items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: v.accentColor }}>Accent</span>
            <Button type="button" variant="outline" onClick={() => { setV((p) => (p ? { ...p, ...DEF_COL } : p)); setErrs({}); setOk("") }}>Reset to defaults</Button>
          </div>
        </div>
      </Section>

      <Section title="Company Profile" sub="Your business identity shown on documents.">
        <div className="flex flex-wrap items-center gap-3.5">
          <UserAvatar shape="square" name={v.name || "Company"} className="size-[72px]" fallback={<span className="text-2xl font-semibold">{getInitials(v.name || "Company")}</span>} />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Company logo</span>
            <span className="text-xs text-muted-foreground">Upload the logo under Settings &gt; General. Initials are shown here.</span>
          </div>
        </div>
        <div className={grid}>
          {text("Company Name *", "name", { ph: "Your company name" })}
          {text("Industry", "industry", { ph: "e.g., Retail, Technology" })}
          {text("Website", "website", { ph: "https://example.com", type: "url" })}
          {text("Phone", "phone", { ph: "+1 (555) 000-0000", type: "tel" })}
          {text("Street Address", "address", { ph: "123 Main Street", span: true })}
          {text("City", "city", { ph: "New York" })}
          {text("State", "state", { ph: "NY" })}
          {text("Zip Code", "zipCode", { ph: "10001" })}
          {text("Country", "country", { ph: "United States" })}
          <FormField label="Description" htmlFor="cs-description" className="col-[1/-1] min-w-0">
            <Textarea id="cs-description" rows={4} placeholder="Brief description of your company..." value={v.description} onChange={(e) => set("description", e.target.value)}
              className="w-full" />
          </FormField>
        </div>
      </Section>

      <Section title="Tax & Compliance" sub="Tax registration used on invoices.">
        <div className={grid}>
          {text("Tax ID", "taxId", { ph: "e.g., 12-3456789" })}
          {select("Tax ID Type", "taxIdType", TAX_TYPES)}
          {text("Tax Rate (%)", "taxRate", { ph: "18", type: "number", step: "0.1", min: "0", max: "100" })}
        </div>
      </Section>

      <Section title="Regional" sub="Currency and timezone.">
        <div className={grid}>
          {select("Currency", "currency", CURRENCIES)}
          {select("Timezone", "timezone", TIMEZONES)}
        </div>
      </Section>

      <Section title="Localization" sub="Language of the admin.">
        <div className={grid}>{select("Language", "language", LANGUAGES)}</div>
      </Section>

      <Section title="Currency Format" sub={`How amounts are written. Example: ${fmtSample(v)}`}>
        <div className={grid}>
          {select("Symbol Position", "currencySymbolPosition", SYMBOL_POS)}
          {select("Decimal Separator", "currencyDecimalSeparator", DEC_SEP)}
          {select("Thousands Separator", "currencyThousandsSeparator", THOU_SEP)}
          {select("Decimal Places", "currencyDecimalPlaces", DEC_PLACES)}
        </div>
      </Section>

      <Section title="Units of Measurement" sub="Used for product weight and size.">
        <div className={grid}>
          {select("Weight Unit", "weightUnit", WEIGHT)}
          {select("Dimension Unit", "dimensionUnit", DIMENSION)}
        </div>
      </Section>

      <Section title="Date & Time Format" sub="How dates and times are displayed.">
        <div className={grid}>
          {select("Date Format", "dateFormat", DATE_FMT)}
          {select("Time Format", "timeFormat", TIME_FMT)}
        </div>
      </Section>

      <Section title="Billing Contact" sub="Billing address and tax info for invoices and payments">
        <div className={grid.replace("240px", "220px")}>
          {text("Email", "bEmail", { ph: "billing@example.com", type: "email" })}
          {text("Phone", "bPhone", { ph: "+1 (555) 000-0000", type: "tel" })}
          {text("Street Address", "bAddress", { ph: "123 Main Street", span: true })}
          {text("City", "bCity", { ph: "New York" })}
          {text("State", "bState", { ph: "NY" })}
          {text("Zip Code", "bZip", { ph: "10001" })}
          {text("Country", "bCountry", { ph: "United States" })}
          {text("Tax ID", "bTaxId", { ph: "e.g., 12-3456789" })}
          {select("Tax ID Type", "bTaxIdType", TAX_TYPES)}
        </div>
      </Section>

      <Card className="sticky bottom-0 z-10 flex-row flex-wrap items-center gap-2.5 px-4 py-3">
        <span className={cn("text-sm", err ? "text-destructive" : dirty ? "text-foreground" : "text-muted-foreground")}>{barText}</span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={discard} disabled={saving || !dirty}>Discard</Button>
          <Button type="button" onClick={save} disabled={saving || !writable}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
