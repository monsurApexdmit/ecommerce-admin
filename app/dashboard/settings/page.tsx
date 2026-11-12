"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Copy, Check, Upload } from "lucide-react"
import { toast } from "sonner"
import { Trans, useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { localeTag } from "@/lib/i18n"
import { Skeleton } from "@/components/ui/skeleton"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { cn } from "@/lib/utils"
import { TIMEZONES } from "@/lib/timezones"
import { settingsApi, type StoreHours } from "@/lib/settingsApi"
import { saasCompanyApi, type CompanySettingsPayload } from "@/lib/saasCompanyApi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { EmptyState } from "@/components/common/EmptyState"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/* ------------------------------------------------------------------ */
/* Static definitions (UI options, gateway field maps)                 */
/* ------------------------------------------------------------------ */

type Key = ParseKeys<["store", "common"]>

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const
type Day = (typeof DAYS)[number]
const DAY_LABEL: Record<Day, Key> = {
  monday: "store:settings.general.days.monday", tuesday: "store:settings.general.days.tuesday",
  wednesday: "store:settings.general.days.wednesday", thursday: "store:settings.general.days.thursday",
  friday: "store:settings.general.days.friday", saturday: "store:settings.general.days.saturday",
  sunday: "store:settings.general.days.sunday",
}
const DEFAULT_HOURS: Record<Day, DayHours> = {
  monday: { open: true, from: "09:00", to: "17:00" },
  tuesday: { open: true, from: "09:00", to: "17:00" },
  wednesday: { open: true, from: "09:00", to: "17:00" },
  thursday: { open: true, from: "09:00", to: "17:00" },
  friday: { open: true, from: "09:00", to: "17:00" },
  saturday: { open: true, from: "10:00", to: "15:00" },
  sunday: { open: false, from: "09:00", to: "17:00" },
}

// Saved as these English values; labels translated at render
const BIZ_TYPES = ["Retail", "Wholesale", "Restaurant", "Services", "Manufacturing", "Other"] as const
const BIZ_LABEL: Record<string, Key> = {
  Retail: "store:shared.bizTypes.Retail", Wholesale: "store:shared.bizTypes.Wholesale", Restaurant: "store:shared.bizTypes.Restaurant",
  Services: "store:shared.bizTypes.Services", Manufacturing: "store:shared.bizTypes.Manufacturing", Other: "store:shared.bizTypes.Other",
}
const CURRENCIES: [string, Key][] = [
  ["BDT", "store:settings.general.currencies.BDT"],
  ["USD", "store:settings.general.currencies.USD"],
  ["INR", "store:settings.general.currencies.INR"],
]
const CURRENCY_SYMBOL: Record<string, string> = {
  BDT: "৳", USD: "$", INR: "₹", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$", JPY: "¥",
}
const LANGUAGES: [string, Key][] = [["en", "common:language.en"], ["bn", "common:language.bn"]]

type DateStyle = "dmy" | "mdy" | "long"
const DATE_FORMAT_OF: Record<DateStyle, "DD/MM/YYYY" | "MM/DD/YYYY" | "D MMM YYYY"> = {
  dmy: "DD/MM/YYYY", mdy: "MM/DD/YYYY", long: "D MMM YYYY",
}
const styleOfDateFormat = (f?: string): DateStyle =>
  f === "MM/DD/YYYY" ? "mdy" : f === "D MMM YYYY" ? "long" : "dmy"

const PAPERS: [Paper, Key][] = [["58", "store:settings.general.papers.p58"], ["80", "store:settings.general.papers.p80"], ["a4", "store:settings.general.papers.a4"]]
const PAPER_WIDTH: Record<Paper, number> = { "58": 200, "80": 260, a4: 320 }

type GwId = "sslcommerz" | "portwallet" | "stripe" | "paypal" | "bkash" | "nagad"
interface GwDef {
  id: GwId
  /** Brand name, not translated */
  name: string
  sub: Key
  sandbox: boolean
  /** [field, label key, input type, placeholder (example value, or a key when it is words)] */
  fields: [string, Key, "text" | "password", string | { key: Key }][]
  need: string[]
  note: [Key, Key]
  noteIf?: (f: Record<string, string>) => boolean
}
const F = "store:settings.general.gateways.fields."
const N = "store:settings.general.gateways.notes."
const GATEWAYS: GwDef[] = [
  { id: "sslcommerz", name: "SSLCommerz", sub: "store:settings.general.gateways.subs.sslcommerz", sandbox: true,
    fields: [["store_id", `${F}storeId`, "text", "your_store_id"], ["store_passwd", `${F}storePassword`, "password", "••••••••"]],
    need: ["store_id", "store_passwd"],
    note: [`${N}sslcommerz`, `${N}sslcommerzBody`] },
  { id: "portwallet", name: "PortWallet", sub: "store:settings.general.gateways.subs.portwallet", sandbox: true,
    fields: [["app_key", `${F}appKey`, "text", "your_app_key"], ["app_secret", `${F}appSecret`, "password", "••••••••"]],
    need: ["app_key", "app_secret"],
    note: [`${N}portwallet`, `${N}portwalletBody`] },
  { id: "stripe", name: "Stripe", sub: "store:settings.general.gateways.subs.stripe", sandbox: false,
    fields: [["publishable_key", `${F}publishableKey`, "text", "pk_test_..."], ["secret_key", `${F}secretKey`, "password", "sk_test_..."], ["webhook_secret", `${F}webhookSecret`, "password", "whsec_..."]],
    need: ["publishable_key", "secret_key"],
    note: [`${N}stripe`, `${N}stripeBody`],
    noteIf: (f) => (f.secret_key ?? "") === "" || f.secret_key.startsWith("sk_test_") },
  { id: "paypal", name: "PayPal", sub: "store:settings.general.gateways.subs.paypal", sandbox: true,
    fields: [["client_id", `${F}clientId`, "text", "AY..."], ["client_secret", `${F}clientSecret`, "password", "••••••••"]],
    need: ["client_id", "client_secret"],
    note: [`${N}paypal`, `${N}paypalBody`] },
  { id: "bkash", name: "bKash", sub: "store:settings.general.gateways.subs.bkash", sandbox: true,
    fields: [["app_key", `${F}appKey`, "text", "bkash_app_key"], ["app_secret", `${F}appSecret`, "password", "••••••••"], ["username", `${F}username`, "text", { key: `${F}merchantUsernamePh` }], ["password", `${F}password`, "password", "••••••••"]],
    need: ["app_key", "app_secret", "username", "password"],
    note: [`${N}bkash`, `${N}bkashBody`] },
  { id: "nagad", name: "Nagad", sub: "store:settings.general.gateways.subs.nagad", sandbox: true,
    fields: [["merchant_id", `${F}merchantId`, "text", "686969"], ["nagad_public_key", `${F}nagadPublicKey`, "text", { key: `${F}nagadPublicKeyPh` }], ["private_key", `${F}privateKey`, "password", "MIIEpAIBAAKCAQEA..."]],
    need: ["merchant_id", "private_key"],
    note: [`${N}nagad`, `${N}nagadBody`] },
]

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Paper = "58" | "80" | "a4"
interface DayHours { open: boolean; from: string; to: string }
interface GwState { enabled: boolean; sandbox: boolean; fields: Record<string, string> }
interface Form {
  storeName: string; legalName: string; phone: string; email: string; address: string
  bin: string; licence: string; bizType: string; registration: string
  website: string; facebook: string; instagram: string; twitter: string
  currency: string; timezone: string; language: string
  nf: "intl" | "lakh"; df: DateStyle
  prefix: string; nextNo: string; poPrefix: string; taxRate: string; lowStock: string
  paper: Paper; footer: string
  hours: Record<Day, DayHours>
  holidays: string[]
  promo: { on: boolean; title: string; sub: string; cta: string; link: string }
  notif: { email: boolean; order: boolean; marketing: boolean }
  gw: Record<GwId, GwState>
  cod: { on: boolean; gateway: GwId; amount: string }
}
type FormKey = keyof Form

interface ImageState { url: string; file: File | null; preview: string; removed: boolean }
const EMPTY_IMG: ImageState = { url: "", file: null, preview: "", removed: false }

/* ------------------------------------------------------------------ */
/* Style tokens (shared with the finished dashboard pages)             */
/* ------------------------------------------------------------------ */

const lakhGroup = (i: string) => i.replace(/\B(?=(\d\d)*\d{3}(?!\d))/g, ",")
const intlGroup = (i: string) => i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <SectionCard title={title} description={sub} contentClassName="flex flex-col gap-4">
      {children}
    </SectionCard>
  )
}

function Toggle({ on, onClick, label, disabled, id }: { on: boolean; onClick: () => void; label: string; disabled?: boolean; id?: string }) {
  return (
    <Switch id={id} checked={on} aria-label={label} onCheckedChange={() => onClick()} disabled={disabled} />
  )
}

function Chips<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: [T, string][]; onPick: (v: T) => void }) {
  return (
    <SegmentedControl
      aria-label={label}
      value={value}
      onValueChange={(x) => onPick(x as T)}
      options={options.map(([id, text]) => ({ value: id, label: text }))}
    />
  )
}

function SwitchRow({ title, sub, on, onClick }: { title: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription>{sub}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Toggle on={on} onClick={onClick} label={title} />
      </ItemActions>
    </Item>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function GeneralSettingsPage() {
  const { t, i18n } = useTranslation(["store", "common"])
  const blocked = useModuleGuard("Settings")
  const { company, canWrite } = useSaasAuth()
  const { refreshSettings } = useCompanySettings()
  const writable = canWrite("Settings")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [base, setBase] = useState<Form | null>(null)
  const [v, setV] = useState<Form | null>(null)
  const [logo, setLogo] = useState<ImageState>(EMPTY_IMG)
  const [banner, setBanner] = useState<ImageState>(EMPTY_IMG)
  const [err, setErr] = useState("")
  const [holDraft, setHolDraft] = useState("")
  const [copied, setCopied] = useState(false)
  const [savedApiUrl, setSavedApiUrl] = useState("")
  const importRef = useRef<HTMLInputElement>(null)

  /* ---------- load ---------- */
  const load = useCallback(async () => {
    try {
      const [all, hoursRes, comp] = await Promise.all([
        settingsApi.getAll(),
        settingsApi.getStoreHours(),
        saasCompanyApi.getSettings(),
      ])
      const d: any = all.data ?? {}
      const g: any = d.general ?? {}
      const b: any = d.business ?? {}
      const social: any = b.socialLinks ?? {}
      const promo: any = b.promoBanner ?? {}
      const notif: any = d.notifications ?? {}
      const pay: any = d.payment ?? {}
      const c: any = comp.data ?? {}
      const sh: StoreHours = hoursRes.data ?? {}

      const hours = { ...DEFAULT_HOURS } as Record<Day, DayHours>
      DAYS.forEach((day) => {
        const x = sh[day]
        if (x) hours[day] = { open: !!x.isOpen, from: x.open || DEFAULT_HOURS[day].from, to: x.close || DEFAULT_HOURS[day].to }
      })

      const gw = {} as Record<GwId, GwState>
      GATEWAYS.forEach((def) => {
        const sv = pay[def.id] ?? {}
        const fields: Record<string, string> = {}
        def.fields.forEach(([k]) => { fields[k] = sv[k] ?? "" })
        gw[def.id] = { enabled: !!sv.enabled, sandbox: sv.sandbox ?? true, fields }
      })
      const cod = pay.cod_shipping_deposit ?? {}

      const form: Form = {
        storeName: g.storeName ?? b.businessName ?? "",
        legalName: g.legalName ?? "",
        phone: g.storePhone ?? "",
        email: g.storeEmail ?? "",
        address: g.storeAddress ?? "",
        bin: g.bin ?? "",
        licence: g.licence ?? "",
        bizType: b.businessType ?? "Retail",
        registration: b.registrationNumber ?? "",
        website: b.website ?? "",
        facebook: social.facebook ?? "",
        instagram: social.instagram ?? "",
        twitter: social.twitter ?? "",
        currency: c.currency ?? "BDT",
        timezone: c.timezone ?? "Asia/Dhaka",
        language: c.language ?? "en",
        nf: c.numberFormat === "intl" ? "intl" : "lakh",
        df: styleOfDateFormat(c.dateFormat),
        prefix: g.invoicePrefix ?? "INV",
        nextNo: String(g.nextInvoiceNumber ?? 1),
        poPrefix: g.poPrefix ?? "PO",
        taxRate: String(c.taxRate ?? 0),
        lowStock: String(g.lowStockDefault ?? 5),
        paper: (g.receiptPaper as Paper) ?? "80",
        footer: g.receiptFooter ?? "Thank you! Exchange within 7 days with receipt.",
        hours,
        holidays: Array.isArray(g.holidays) ? g.holidays : [],
        promo: {
          on: !!promo.enabled,
          title: promo.title ?? "",
          sub: promo.subtitle ?? "",
          cta: promo.cta ?? "",
          link: promo.link ?? "/shop",
        },
        notif: {
          email: notif.emailNotifications ?? true,
          order: notif.orderNotifications ?? true,
          marketing: notif.marketingEmails ?? false,
        },
        gw,
        cod: {
          on: !!cod.enabled,
          gateway: (cod.gateway as GwId) ?? "sslcommerz",
          amount: String(cod.custom_amount ?? 0),
        },
      }
      setBase(form)
      setV(form)
      setSavedApiUrl(String(b.onlineStore?.apiUrl ?? "").trim())
      setLogo({ ...EMPTY_IMG, url: b.logoUrl || "" })
      setBanner({ ...EMPTY_IMG, url: b.bannerUrl || "" })
      setErr("")
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("store:settings.general.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  /* ---------- dirty tracking ---------- */
  const changedKeys = useMemo(() => {
    if (!base || !v) return [] as FormKey[]
    return (Object.keys(v) as FormKey[]).filter((k) => JSON.stringify(v[k]) !== JSON.stringify(base[k]))
  }, [base, v])
  const imgChanges = (logo.file || logo.removed ? 1 : 0) + (banner.file || banner.removed ? 1 : 0)
  const dirtyCount = changedKeys.length + imgChanges
  const dirty = dirtyCount > 0

  const set = <K extends FormKey>(k: K, val: Form[K]) => { setV((p) => (p ? { ...p, [k]: val } : p)); setErr("") }
  const setText = (k: FormKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => set(k, e.target.value as never)

  /* ---------- image staging ---------- */
  const pickImage = (kind: "logo" | "banner", maxMb: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!file.type.startsWith("image/")) { toast.error(t("store:settings.general.image.notImage")); return }
    if (file.size > maxMb * 1024 * 1024) { toast.error(t("store:settings.general.image.tooBig", { mb: maxMb })); return }
    const next: ImageState = { url: "", file, preview: URL.createObjectURL(file), removed: false }
    if (kind === "logo") setLogo((p) => ({ ...next, url: p.url })); else setBanner((p) => ({ ...next, url: p.url }))
    toast.success(kind === "logo" ? t("store:settings.general.image.logoReady") : t("store:settings.general.image.bannerReady"))
  }
  const clearImage = (kind: "logo" | "banner") => {
    const upd = (p: ImageState): ImageState => ({ url: p.url, file: null, preview: "", removed: !!p.url })
    if (kind === "logo") setLogo(upd); else setBanner(upd)
  }
  const shownImg = (s: ImageState) => (s.removed ? "" : s.preview || s.url)

  /* ---------- hours / holidays ---------- */
  const setDay = (day: Day, patch: Partial<DayHours>) =>
    v && set("hours", { ...v.hours, [day]: { ...v.hours[day], ...patch } })
  const copyMonday = () => {
    if (!v) return
    const m = v.hours.monday
    set("hours", { ...v.hours, tuesday: { ...m }, wednesday: { ...m }, thursday: { ...m }, friday: { ...m } })
    toast.success(t("store:settings.general.hours.mondayCopied"))
  }
  const addHoliday = () => {
    if (!v) return
    if (!holDraft) { setErr(t("store:settings.general.hours.pickDate")); return }
    if (v.holidays.includes(holDraft)) { toast.error(t("store:settings.general.hours.dateListed")); return }
    set("holidays", [...v.holidays, holDraft])
    setHolDraft("")
  }

  /* ---------- formatting helpers (preview) ---------- */
  const symbol = v ? CURRENCY_SYMBOL[v.currency] ?? v.currency : ""
  const money = (n: number) => {
    const [i, f] = n.toFixed(2).split(".")
    return `${symbol}${v?.nf === "lakh" ? lakhGroup(i) : intlGroup(i)}.${f}`
  }
  const fmtDate = (d: Date, style: DateStyle) => {
    const dd = String(d.getDate()).padStart(2, "0"), mm = String(d.getMonth() + 1).padStart(2, "0")
    if (style === "dmy") return `${dd}/${mm}/${d.getFullYear()}`
    if (style === "mdy") return `${mm}/${dd}/${d.getFullYear()}`
    return `${d.getDate()} ${d.toLocaleString(localeTag(i18n.language), { month: "short" })} ${d.getFullYear()}`
  }
  const fmtHoliday = (iso: string) => fmtDate(new Date(iso + "T00:00:00"), v?.df ?? "dmy")
  const today = new Date()

  /* ---------- validate + save ---------- */
  const validate = (f: Form): string => {
    const email = f.email.trim()
    const tax = Number(f.taxRate), low = Number(f.lowStock), nxt = Number(f.nextNo)
    const E = "store:settings.general.errors."
    if (!f.storeName.trim()) return t(`${E}storeName`)
    if (!f.phone.trim()) return t(`${E}phone`)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t(`${E}email`)
    if (!f.prefix.trim()) return t(`${E}prefix`)
    if (!f.poPrefix.trim()) return t(`${E}poPrefix`)
    if (f.taxRate === "" || !isFinite(tax) || tax < 0 || tax > 100) return t(`${E}taxRate`)
    if (f.lowStock === "" || !Number.isInteger(low) || low < 0) return t(`${E}lowStock`)
    if (f.nextNo === "" || !Number.isInteger(nxt) || nxt < 1) return t(`${E}nextNo`)
    const bad = DAYS.find((d) => f.hours[d].open && (!f.hours[d].from || !f.hours[d].to || f.hours[d].from >= f.hours[d].to))
    if (bad) return t(`${E}hours`, { day: t(DAY_LABEL[bad]) })
    const URLRE = /^https?:\/\/[^\s/$.?#][^\s]*$/i
    for (const [k, label] of [["website", t("store:shared.website")], ["facebook", "Facebook"], ["instagram", "Instagram"], ["twitter", "Twitter"]] as const) {
      const u = f[k].trim()
      if (u && !URLRE.test(u)) return t(`${E}url`, { name: label })
    }
    if (f.promo.on && !f.promo.title.trim()) return t(`${E}promoTitle`)
    if (f.promo.on && f.promo.link.trim() && !/^(\/|https?:\/\/)/.test(f.promo.link.trim())) return t(`${E}promoLink`)
    const incomplete = GATEWAYS.find((g) => f.gw[g.id].enabled && g.need.some((k) => !(f.gw[g.id].fields[k] || "").trim()))
    if (incomplete) return t(`${E}gatewayIncomplete`, { name: incomplete.name })
    if (f.cod.on) {
      const cg = GATEWAYS.find((x) => x.id === f.cod.gateway)
      const amt = Number(f.cod.amount)
      if (f.cod.amount === "" || !isFinite(amt) || amt < 0) return t(`${E}codAmount`)
      if (!cg || !f.gw[cg.id].enabled) return t(`${E}codGateway`, { name: cg ? cg.name : t(`${E}chosenGateway`) })
    }
    return ""
  }

  const save = async () => {
    if (!v || !base) return
    const e = validate(v)
    if (e) { setErr(e); toast.error(e); return }
    const ch = new Set<FormKey>(changedKeys)
    const any = (...ks: FormKey[]) => ks.some((k) => ch.has(k))
    setSaving(true)
    setErr("")
    const jobs: Promise<unknown>[] = []
    const tags: { name: string; keys: FormKey[] }[] = []
    const run = (name: string, keys: FormKey[], p: Promise<unknown>) => { jobs.push(p); tags.push({ name, keys }) }
    try {
      if (any("storeName", "legalName", "phone", "email", "address", "bin", "licence", "prefix", "nextNo", "poPrefix", "lowStock", "paper", "footer", "holidays")) {
        run(t("store:settings.general.sectionNames.general"), ["storeName", "legalName", "phone", "email", "address", "bin", "licence", "prefix", "nextNo", "poPrefix", "lowStock", "paper", "footer", "holidays"], settingsApi.updateGeneral({
          storeName: v.storeName.trim(), legalName: v.legalName.trim(), storePhone: v.phone.trim(),
          storeEmail: v.email.trim(), storeAddress: v.address.trim(), bin: v.bin.trim(), licence: v.licence.trim(),
          invoicePrefix: v.prefix.trim(), nextInvoiceNumber: Number(v.nextNo), poPrefix: v.poPrefix.trim(),
          lowStockDefault: Number(v.lowStock), receiptPaper: v.paper, receiptFooter: v.footer, holidays: v.holidays,
        } as any))
      }
      if (any("storeName", "bizType", "registration", "website", "facebook", "instagram", "twitter", "promo")) {
        run(t("store:settings.general.sectionNames.business"), ["storeName", "bizType", "registration", "website", "facebook", "instagram", "twitter", "promo"], settingsApi.updateBusiness({
          businessName: v.storeName.trim(),
          businessType: v.bizType,
          registrationNumber: v.registration.trim(),
          website: v.website.trim(),
          socialLinks: { facebook: v.facebook.trim(), instagram: v.instagram.trim(), twitter: v.twitter.trim() },
          promoBanner: { enabled: v.promo.on, title: v.promo.title.trim(), subtitle: v.promo.sub.trim(), cta: v.promo.cta.trim(), link: v.promo.link.trim() },
        }))
      }
      if (any("currency", "timezone", "language", "nf", "df", "taxRate")) {
        const payload: CompanySettingsPayload = {
          currency: v.currency, timezone: v.timezone, language: v.language,
          taxRate: Number(v.taxRate), numberFormat: v.nf, dateFormat: DATE_FORMAT_OF[v.df],
        }
        run(t("store:settings.general.sectionNames.region"), ["currency", "timezone", "language", "nf", "df", "taxRate"], saasCompanyApi.updateSettings(payload))
      }
      if (any("taxRate")) run(t("store:settings.general.sectionNames.tax"), ["taxRate"], settingsApi.updateTax({ defaultTaxRate: Number(v.taxRate) }))
      if (any("hours")) {
        const out: StoreHours = {}
        DAYS.forEach((d) => { out[d] = { isOpen: v.hours[d].open, open: v.hours[d].open ? v.hours[d].from : "", close: v.hours[d].open ? v.hours[d].to : "" } })
        run(t("store:settings.general.sectionNames.hours"), ["hours"], settingsApi.updateStoreHours(out))
      }
      if (any("notif")) {
        run(t("store:settings.general.sectionNames.notifications"), ["notif"], settingsApi.updateNotifications({
          emailNotifications: v.notif.email, orderNotifications: v.notif.order, marketingEmails: v.notif.marketing,
        }))
      }
      if (any("gw", "cod")) {
        const payment: Record<string, unknown> = {}
        GATEWAYS.forEach((g) => { payment[g.id] = { enabled: v.gw[g.id].enabled, ...v.gw[g.id].fields, ...(g.sandbox ? { sandbox: v.gw[g.id].sandbox } : {}) } })
        payment.cod_shipping_deposit = { enabled: v.cod.on, gateway: v.cod.gateway, custom_amount: Number(v.cod.amount) || 0 }
        run(t("store:settings.general.sectionNames.gateways"), ["gw", "cod"], settingsApi.updatePayment(payment as any))
      }
      if (logo.file) run(t("store:settings.general.sectionNames.logo"), [], settingsApi.uploadLogo(logo.file))
      else if (logo.removed) run(t("store:settings.general.sectionNames.logo"), [], settingsApi.removeLogo())
      if (banner.file) run(t("store:settings.general.sectionNames.banner"), [], settingsApi.uploadBanner(banner.file))
      else if (banner.removed) run(t("store:settings.general.sectionNames.banner"), [], settingsApi.removeBanner())

      const results = await Promise.allSettled(jobs)
      const bad = results.map((r, i) => ({ r, t: tags[i] })).filter((x) => x.r.status === "rejected") as { r: PromiseRejectedResult; t: { name: string; keys: FormKey[] } }[]
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
      } else {
        toast.success(t("store:settings.general.saved"))
        await load()
      }
      refreshSettings()
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    setV(base); setLogo((p) => ({ ...EMPTY_IMG, url: p.url })); setBanner((p) => ({ ...EMPTY_IMG, url: p.url }))
    setErr(""); setHolDraft("")
    if (dirty) toast.success(t("store:shared.changesDiscarded"))
  }

  /* ---------- data: export / import ---------- */
  const SECRET_RE = /(secret|passw|token|key|username|credential|signature)/i
  const stripSecrets = (o: any): any => {
    if (Array.isArray(o)) return o.map(stripSecrets)
    if (o && typeof o === "object") {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(o)) if (!SECRET_RE.test(k)) out[k] = stripSecrets(val)
      return out
    }
    return o
  }
  const exportData = async () => {
    try {
      const [all, hours, comp] = await Promise.all([settingsApi.getAll(), settingsApi.getStoreHours(), saasCompanyApi.getSettings()])
      const d: any = all.data ?? {}
      const { id: _i, companyId: _c, createdAt: _ca, updatedAt: _ua, ...company } = (comp.data ?? {}) as any
      const bundle = {
        kind: "company-settings",
        version: 1,
        exportedAt: new Date().toISOString(),
        company,
        general: d.general ?? {},
        business: d.business ?? {}, // includes logoUrl / bannerUrl
        tax: d.tax ?? {},
        payment: stripSecrets(d.payment ?? {}), // secrets are never exported
        notifications: d.notifications ?? {},
        storeHours: hours.data ?? {},
      }
      const a = document.createElement("a")
      a.href = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }))
      a.download = `settings-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      toast.success(t("store:settings.general.data.exported"))
    } catch {
      toast.error(t("store:settings.general.data.exportFailed"))
    }
  }

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const rd = new FileReader()
    rd.onload = async () => {
      let p: any
      try { p = JSON.parse(String(rd.result)) } catch { toast.error(t("store:settings.general.data.invalidJson")); return }
      if (!p || typeof p !== "object" || Array.isArray(p) || p.kind !== "company-settings") { toast.error(t("store:settings.general.data.notBackup")); return }
      if (!window.confirm(t("store:settings.general.data.confirmImport"))) return
      const jobs: Promise<unknown>[] = []
      if (p.general && typeof p.general === "object") jobs.push(settingsApi.updateGeneral(p.general))
      if (p.business && typeof p.business === "object") {
        const { logoUrl, bannerUrl, ...biz } = p.business as any
        jobs.push(settingsApi.updateBusiness(biz))
        const brand: { logoUrl?: string; bannerUrl?: string } = {}
        if (typeof logoUrl === "string" && logoUrl) brand.logoUrl = logoUrl
        if (typeof bannerUrl === "string" && bannerUrl) brand.bannerUrl = bannerUrl
        if (Object.keys(brand).length) jobs.push(settingsApi.updateBranding(brand))
      }
      if (p.tax && typeof p.tax === "object") jobs.push(settingsApi.updateTax(p.tax))
      if (p.payment && typeof p.payment === "object") {
        // Gateway credentials are never imported (exports exclude them, and a shallow merge would wipe stored ones);
        // only the non-secret COD deposit setting is restored.
        const cod = (p.payment as any).cod_shipping_deposit
        if (cod && typeof cod === "object") jobs.push(settingsApi.updatePayment({ cod_shipping_deposit: stripSecrets(cod) } as any))
      }
      if (p.notifications && typeof p.notifications === "object") jobs.push(settingsApi.updateNotifications(p.notifications))
      if (p.storeHours && typeof p.storeHours === "object") jobs.push(settingsApi.updateStoreHours(p.storeHours))
      if (p.company && typeof p.company === "object") {
        const c = p.company
        const pick: CompanySettingsPayload = {}
        for (const k of ["taxId", "taxIdType", "taxRate", "currency", "timezone", "language", "currencySymbolPosition", "currencyDecimalSeparator", "currencyThousandsSeparator", "currencyDecimalPlaces", "weightUnit", "dimensionUnit", "dateFormat", "timeFormat", "numberFormat", "accentName", "brandPrimaryColor", "brandAccentColor", "brandBackgroundColor"] as const) {
          if (c[k] !== undefined) (pick as any)[k] = c[k]
        }
        jobs.push(saasCompanyApi.updateSettings(pick))
      }
      const res = await Promise.allSettled(jobs)
      const bad = res.filter((r) => r.status === "rejected").length
      if (bad) toast.error(t("store:settings.general.data.importPartial", { bad, total: res.length }))
      else toast.success(t("store:settings.general.data.imported"))
      await load()
      refreshSettings()
    }
    rd.readAsText(file)
  }

  const apiUrl = savedApiUrl || (typeof window !== "undefined" ? `${window.location.origin}/api` : "/api")
  const apiUrlSaved = !!savedApiUrl
  const envText = `VITE_API_BASE_URL=${apiUrl}\nVITE_COMPANY_ID=${company?.id ?? ""}`
  const copyEnv = async () => {
    try {
      await navigator.clipboard.writeText(envText)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
      toast.success(t("store:shared.envCopied"))
    } catch { toast.error(t("store:shared.copyFailed")) }
  }

  /* ---------- render ---------- */
  if (blocked) return blocked

  const wrapper = "flex flex-col gap-5"

  const heading = (
    <PageHeader title={t("store:settings.general.title")} description={t("store:settings.general.description")} />
  )

  if (loading || !v || !base) {
    return (
      <div className={wrapper}>
        {heading}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)}
          </div>
          <div className="flex flex-[1_1_340px] flex-col gap-4">
            <Skeleton className="h-96" />
            <Skeleton className="h-36" />
          </div>
        </div>
      </div>
    )
  }

  const fld = (label: string, key: FormKey, o: { type?: string; ph?: string } = {}) => (
    <FormField key={key} label={label} htmlFor={`gs-${key}`} className="min-w-0">
      <Input id={`gs-${key}`} type={o.type ?? "text"} placeholder={o.ph} value={v[key] as string} onChange={setText(key)} />
    </FormField>
  )
  const withCurrent = (opts: [string, string][], cur: string) => (opts.some(([a]) => a === cur) ? opts : [...opts, [cur, cur] as [string, string]])

  const imageBox = (kind: "logo" | "banner", s: ImageState, label: string, maxMb: number) => {
    const shown = shownImg(s)
    const changeLabel = kind === "logo" ? t("store:settings.general.image.changeLogo") : t("store:settings.general.image.changeBanner")
    return (
      <FormField label={label} htmlFor={`gs-${kind}-file`} className="min-w-0">
        {shown && (
          <span className="flex h-[130px] items-center justify-center overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt={t("store:settings.general.image.previewAlt", { label })} className="max-h-full max-w-full object-contain" />
          </span>
        )}
        <EmptyState
          bordered
          icon={shown ? undefined : Upload}
          title={shown ? changeLabel : t("store:settings.general.image.clickUpload")}
          description={t("store:settings.general.image.spec", { mb: maxMb })}
          action={
            <Button asChild variant="outline" size="sm">
              <Label htmlFor={`gs-${kind}-file`} className="cursor-pointer">{shown ? changeLabel : t("store:settings.general.image.chooseFile")}</Label>
            </Button>
          }
          className={shown ? "gap-2 p-3 md:p-3" : "gap-3 p-4 md:p-4"}
        />
        <Input id={`gs-${kind}-file`} type="file" accept="image/*" aria-label={t("store:settings.general.image.fileLabel", { label })} onChange={pickImage(kind, maxMb)} className="sr-only" />
        {shown && (
          <Button type="button" variant="link" size="sm" onClick={() => clearImage(kind)} className="self-start">{kind === "logo" ? t("store:settings.general.image.removeLogo") : t("store:settings.general.image.removeBanner")}</Button>
        )}
      </FormField>
    )
  }

  const barText = err ? err : dirty ? t("store:shared.unsavedCount", { count: dirtyCount }) : t("store:settings.general.barIdle")

  return (
    <div className={wrapper}>
      {heading}

      <div className="flex flex-wrap items-start gap-4">
        {/* ---------------- left column ---------------- */}
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-4">
          <Section title={t("store:settings.general.profile.title")} sub={t("store:settings.general.profile.sub")}>
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
              {imageBox("logo", logo, t("store:settings.general.profile.logo"), 5)}
              {imageBox("banner", banner, t("store:settings.general.profile.banner"), 10)}
            </div>
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
              {fld(t("store:settings.general.profile.storeName"), "storeName")}
              {fld(t("store:settings.general.profile.legalName"), "legalName", { ph: t("store:settings.general.profile.legalNamePh") })}
              {fld(t("store:settings.general.profile.phone"), "phone", { type: "tel" })}
              {fld(t("common:fields.email"), "email", { type: "email" })}
              {fld(t("store:settings.general.profile.address"), "address", { ph: t("store:settings.general.profile.addressPh") })}
              {fld(t("store:settings.general.profile.bin"), "bin", { ph: t("common:status.optional") })}
              {fld(t("store:settings.general.profile.licence"), "licence", { ph: t("common:status.optional") })}
              <FormField label={t("store:shared.businessType")} htmlFor="gs-bizType" className="min-w-0">
                <Select value={String(v.bizType)} onValueChange={(val) => set("bizType", val as never)}>
                  <SelectTrigger id="gs-bizType" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {withCurrent(BIZ_TYPES.map((b) => [b, BIZ_LABEL[b] ? t(BIZ_LABEL[b]) : b] as [string, string]), v.bizType).map(([a, b]) => <SelectItem key={a} value={String(a)}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              {fld(t("store:shared.registration"), "registration", { ph: t("store:settings.general.profile.registrationPh") })}
              {fld(t("store:shared.website"), "website", { ph: "https://" })}
              {fld("Facebook", "facebook", { ph: "https://facebook.com/…" })}
              {fld("Instagram", "instagram", { ph: "https://instagram.com/…" })}
              {fld(t("store:settings.general.profile.twitter"), "twitter", { ph: "https://twitter.com/…" })}
            </div>
          </Section>

          <Section title={t("store:settings.general.region.title")} sub={t("store:settings.general.region.sub")}>
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
              <FormField label={t("store:settings.general.region.currency")} htmlFor="gs-currency" className="min-w-0">
                <Select value={String(v.currency)} onValueChange={(val) => set("currency", val as never)}>
                  <SelectTrigger id="gs-currency" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {withCurrent(CURRENCIES.map(([a, k]) => [a, t(k)] as [string, string]), v.currency).map(([a, b]) => <SelectItem key={a} value={String(a)}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("store:settings.general.region.timezone")} htmlFor="gs-timezone" className="min-w-0">
                <Select value={String(v.timezone)} onValueChange={(val) => set("timezone", val as never)}>
                  <SelectTrigger id="gs-timezone" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {withCurrent(TIMEZONES, v.timezone).map(([a, b]) => <SelectItem key={a} value={String(a)}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("common:language.label")} htmlFor="gs-language" className="min-w-0">
                <Select value={String(v.language)} onValueChange={(val) => set("language", val as never)}>
                  <SelectTrigger id="gs-language" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {withCurrent(LANGUAGES.map(([a, k]) => [a, t(k)] as [string, string]), v.language).map(([a, b]) => <SelectItem key={a} value={String(a)} lang={a}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label={t("store:settings.general.region.numberFormat")}>
              <Chips label={t("store:settings.general.region.numberFormat")} value={v.nf} onPick={(x) => set("nf", x)}
                options={[["lakh", t("store:settings.general.region.lakh")], ["intl", "100,000.00"]]} />
            </FormField>
            <FormField label={t("store:settings.general.region.dateFormat")}>
              <Chips label={t("store:settings.general.region.dateFormat")} value={v.df} onPick={(x) => set("df", x)}
                options={[["dmy", fmtDate(today, "dmy")], ["mdy", fmtDate(today, "mdy")], ["long", fmtDate(today, "long")]]} />
            </FormField>
            <div className="text-sm text-muted-foreground">{t("store:settings.general.region.preview")} <strong className="text-foreground">{money(125450)}</strong> · <strong className="text-foreground">{fmtDate(today, v.df)}</strong></div>
          </Section>

          <Section title={t("store:settings.general.hours.title")} sub={t("store:settings.general.hours.sub")}>
            <div className="flex flex-col">
              {DAYS.map((d, di) => {
                const h = v.hours[d]
                return (
                  <div key={d}>
                  {di > 0 && <Separator />}
                  <div className="grid min-h-[52px] items-center gap-3 [grid-template-columns:110px_40px_minmax(0,1fr)]">
                    <span className="font-medium">{t(DAY_LABEL[d])}</span>
                    <Toggle on={h.open} label={t("store:settings.general.hours.openOn", { day: t(DAY_LABEL[d]) })} onClick={() => setDay(d, { open: !h.open })} />
                    {h.open ? (
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <Input type="time" className="w-auto" value={h.from} aria-label={t("store:settings.general.hours.opens", { day: t(DAY_LABEL[d]) })} onChange={(e) => setDay(d, { from: e.target.value })} />
                        <span className="text-muted-foreground">{t("store:settings.general.hours.to")}</span>
                        <Input type="time" className="w-auto" value={h.to} aria-label={t("store:settings.general.hours.closes", { day: t(DAY_LABEL[d]) })} onChange={(e) => setDay(d, { to: e.target.value })} />
                      </span>
                    ) : <span className="text-sm text-muted-foreground">{t("store:settings.general.hours.closed")}</span>}
                  </div>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={copyMonday}>{t("store:settings.general.hours.copyMonday")}</Button>
              <Input type="date" className="w-auto" value={holDraft} aria-label={t("store:settings.general.hours.holidayDate")} onChange={(e) => setHolDraft(e.target.value)} />
              <Button type="button" variant="outline" onClick={addHoliday}>{t("store:settings.general.hours.addHoliday")}</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...v.holidays].sort().map((iso) => (
                <Button key={iso} type="button" variant="outline" size="sm" aria-label={t("store:settings.general.hours.removeHoliday", { date: fmtHoliday(iso) })}
                  onClick={() => set("holidays", v.holidays.filter((x) => x !== iso))}>{fmtHoliday(iso)} ✕</Button>
              ))}
            </div>
          </Section>

          <Section title={t("store:settings.general.promo.title")} sub={t("store:settings.general.promo.sub")}>
            <SwitchRow title={t("store:settings.general.promo.show")} sub={t("store:settings.general.promo.showSub")} on={v.promo.on} onClick={() => set("promo", { ...v.promo, on: !v.promo.on })} />
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
              <FormField label={t("store:settings.general.promo.titleField")} htmlFor="gs-promo-title" className="min-w-0">
                <Input id="gs-promo-title" value={v.promo.title} onChange={(e) => set("promo", { ...v.promo, title: e.target.value })} /></FormField>
              <FormField label={t("store:settings.general.promo.buttonText")} htmlFor="gs-promo-cta" className="min-w-0">
                <Input id="gs-promo-cta" value={v.promo.cta} onChange={(e) => set("promo", { ...v.promo, cta: e.target.value })} /></FormField>
              <FormField label={t("store:settings.general.promo.subtitle")} htmlFor="gs-promo-sub" className="min-w-0">
                <Input id="gs-promo-sub" value={v.promo.sub} onChange={(e) => set("promo", { ...v.promo, sub: e.target.value })} /></FormField>
              <FormField label={t("store:settings.general.promo.buttonLink")} htmlFor="gs-promo-link" className="min-w-0">
                <Input id="gs-promo-link" value={v.promo.link} placeholder="/shop" onChange={(e) => set("promo", { ...v.promo, link: e.target.value })} /></FormField>
            </div>
            <Card className={cn("flex-row flex-wrap items-center justify-between gap-3 border-transparent bg-primary px-4 py-3 text-primary-foreground", !v.promo.on && "opacity-45")}>
              <span className="flex flex-col"><strong>{v.promo.title}</strong><span className="text-xs opacity-90">{v.promo.sub}</span></span>
              <Badge variant="secondary">{v.promo.cta}</Badge>
            </Card>
          </Section>

          <Section title={t("store:settings.general.notif.title")} sub={t("store:settings.general.notif.sub")}>
            <div className="flex flex-col gap-2.5">
              <SwitchRow title={t("store:settings.general.notif.email")} sub={t("store:settings.general.notif.emailSub")} on={v.notif.email} onClick={() => set("notif", { ...v.notif, email: !v.notif.email })} />
              <SwitchRow title={t("store:settings.general.notif.order")} sub={t("store:settings.general.notif.orderSub")} on={v.notif.order} onClick={() => set("notif", { ...v.notif, order: !v.notif.order })} />
              <SwitchRow title={t("store:settings.general.notif.marketing")} sub={t("store:settings.general.notif.marketingSub")} on={v.notif.marketing} onClick={() => set("notif", { ...v.notif, marketing: !v.notif.marketing })} />
            </div>
          </Section>

          <Section title={t("store:settings.general.gateways.title")} sub={t("store:settings.general.gateways.sub")}>
            {GATEWAYS.map((g) => {
              const x = v.gw[g.id]
              const setGw = (patch: Partial<GwState>) => set("gw", { ...v.gw, [g.id]: { ...x, ...patch } })
              const showNote = g.sandbox ? x.enabled && x.sandbox : g.noteIf ? x.enabled && g.noteIf(x.fields) : false
              return (
                <Card key={g.id} className="gap-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex flex-col"><span className="font-medium">{g.name}</span><span className="text-xs text-muted-foreground">{t(g.sub)}</span></span>
                    <Toggle on={x.enabled} label={t("store:settings.general.gateways.enable", { name: g.name })} onClick={() => setGw({ enabled: !x.enabled })} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {g.fields.map(([k, label, type, ph]) => (
                      <FormField key={k} label={t(label)} htmlFor={`gs-${g.id}-${k}`} className="min-w-0">
                        <Input id={`gs-${g.id}-${k}`} type={type} autoComplete="off" placeholder={typeof ph === "string" ? ph : t(ph.key)} value={x.fields[k] ?? ""}
                          onChange={(e) => setGw({ fields: { ...x.fields, [k]: e.target.value } })} />
                      </FormField>
                    ))}
                  </div>
                  {g.sandbox && (
                    <FormField orientation="horizontal" label={t("store:settings.general.gateways.sandbox")} htmlFor={`gs-${g.id}-sandbox`}>
                      <Toggle id={`gs-${g.id}-sandbox`} on={x.sandbox} label={t("store:settings.general.gateways.sandboxLabel", { name: g.name })} onClick={() => setGw({ sandbox: !x.sandbox })} />
                    </FormField>
                  )}
                  {showNote && (
                    <Alert>
                      <AlertTitle>{t(g.note[0])}</AlertTitle>
                      <AlertDescription>{t(g.note[1])}</AlertDescription>
                    </Alert>
                  )}
                </Card>
              )
            })}
            <Card className="gap-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex flex-col"><span className="font-medium">{t("store:settings.general.gateways.cod")}</span>
                  <span className="text-xs text-muted-foreground">{t("store:settings.general.gateways.codSub")}</span></span>
                <Toggle on={v.cod.on} label={t("store:settings.general.gateways.cod")} onClick={() => set("cod", { ...v.cod, on: !v.cod.on })} />
              </div>
              {v.cod.on && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={t("store:settings.general.gateways.codGateway")} htmlFor="gs-cod-gateway" className="min-w-0">
                    <Select value={String(v.cod.gateway)} onValueChange={(val) => set("cod", { ...v.cod, gateway: val as GwId })}>
                      <SelectTrigger id="gs-cod-gateway" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GATEWAYS.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={t("store:settings.general.gateways.codAmount")} htmlFor="gs-cod-amount" className="min-w-0">
                    <Input id="gs-cod-amount" type="number" min={0} value={v.cod.amount} onChange={(e) => set("cod", { ...v.cod, amount: e.target.value })} />
                  </FormField>
                </div>
              )}
            </Card>
          </Section>

          <Section title={t("store:settings.general.aura.title")} sub={t("store:settings.general.aura.sub")}>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t("store:settings.general.aura.companyId")}</span>
              <div className="font-mono text-2xl font-bold">{company?.id ?? "—"}</div>
            </div>
            <Card className="gap-0 bg-muted p-3.5 font-mono text-xs leading-relaxed shadow-none">
              <span>{`VITE_API_BASE_URL=${apiUrl}`}</span><span>{`VITE_COMPANY_ID=${company?.id ?? ""}`}</span>
            </Card>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={copyEnv}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {t("store:shared.copyEnv")}
              </Button>
              <span className="text-xs text-muted-foreground"><Trans t={t} i18nKey="store:settings.general.aura.envHint" components={[<code key="0" className="font-mono" />, <code key="1" className="font-mono" />]} /> {apiUrlSaved ? t("store:settings.general.aura.apiSaved") : t("store:settings.general.aura.apiNotSaved")}</span>
            </div>
          </Section>
        </div>

        {/* ---------------- right column ---------------- */}
        <aside className="flex max-w-full flex-[1_1_340px] flex-col gap-4">
          <Section title={t("store:settings.general.receipts.title")} sub={t("store:settings.general.receipts.sub")}>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={t("store:settings.general.receipts.invoicePrefix")} htmlFor="gs-prefix" className="min-w-0">
                <Input id="gs-prefix" className="font-mono" value={v.prefix} onChange={setText("prefix")} /></FormField>
              <FormField label={t("store:settings.general.receipts.nextNumber")} htmlFor="gs-nextNo" className="min-w-0">
                <Input id="gs-nextNo" type="number" value={v.nextNo} onChange={setText("nextNo")} /></FormField>
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr))]">
              <FormField label={t("store:settings.general.receipts.poPrefix")} htmlFor="gs-poPrefix" className="min-w-0">
                <Input id="gs-poPrefix" value={v.poPrefix} onChange={setText("poPrefix")} /></FormField>
              <FormField label={t("store:settings.general.receipts.taxRate")} htmlFor="gs-taxRate" className="min-w-0">
                <Input id="gs-taxRate" type="number" min={0} max={100} step={0.01} value={v.taxRate} onChange={setText("taxRate")} /></FormField>
              <FormField label={t("store:settings.general.receipts.lowStock")} htmlFor="gs-lowStock" className="min-w-0">
                <Input id="gs-lowStock" type="number" min={0} step={1} value={v.lowStock} onChange={setText("lowStock")} /></FormField>
            </div>
            <FormField label={t("store:settings.general.receipts.paper")}>
              <Chips label={t("store:settings.general.receipts.paperGroup")} value={v.paper} options={PAPERS.map(([p, k]) => [p, t(k)] as [Paper, string])} onPick={(x) => set("paper", x)} />
            </FormField>
            <FormField label={t("store:settings.general.receipts.footer")} htmlFor="gs-footer">
              <Input id="gs-footer" value={v.footer} onChange={setText("footer")} /></FormField>
            <div style={{ width: PAPER_WIDTH[v.paper] }}
              className="flex max-w-full flex-col gap-1 self-center border bg-white p-4 text-center font-mono text-[11px] text-[#0E1525] shadow-[0_4px_16px_rgba(14,21,37,0.08)]">
              <strong className="text-[13px]">{v.storeName.toUpperCase()}</strong>
              <span>{v.phone}</span>
              <span>{v.prefix}{v.nextNo} · {fmtDate(today, v.df)}</span>
              <span className="my-1 border-t border-dashed border-[#A9B3C9]" />
              <span className="flex justify-between"><span>{t("store:settings.general.receipts.sampleA")}</span><span>250.00</span></span>
              <span className="flex justify-between"><span>{t("store:settings.general.receipts.sampleB")}</span><span>400.00</span></span>
              <span className="my-1 border-t border-dashed border-[#A9B3C9]" />
              <span className="flex justify-between font-bold"><span>{t("store:settings.general.receipts.total")}</span><span>{money(650)}</span></span>
              <span className="mt-1.5">{v.footer}</span>
            </div>
          </Section>

          <Section title={t("store:settings.general.data.title")} sub={t("store:settings.general.data.sub")}>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={exportData}>{t("store:settings.general.data.export")}</Button>
              <Button type="button" variant="outline" onClick={discard} disabled={saving || !dirty}>{t("store:settings.general.data.reset")}</Button>
              <Button type="button" variant="outline" onClick={() => importRef.current?.click()} disabled={!writable}>{t("store:settings.general.data.import")}</Button>
              <Input ref={importRef} type="file" accept="application/json,.json" onChange={importData} className="hidden" />
            </div>
          </Section>
        </aside>
      </div>

      {/* ---------------- sticky save bar ---------------- */}
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
