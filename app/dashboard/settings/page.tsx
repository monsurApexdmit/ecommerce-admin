"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Copy, Check, Upload } from "lucide-react"
import { toast } from "sonner"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { Skeleton } from "@/components/ui/skeleton"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { cn } from "@/lib/utils"
import { TIMEZONES } from "@/lib/timezones"
import { settingsApi, type StoreHours } from "@/lib/settingsApi"
import { saasCompanyApi, type CompanySettingsPayload } from "@/lib/saasCompanyApi"

/* ------------------------------------------------------------------ */
/* Static definitions (UI options, gateway field maps)                 */
/* ------------------------------------------------------------------ */

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const
type Day = (typeof DAYS)[number]
const DAY_LABEL: Record<Day, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
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

const BIZ_TYPES = ["Retail", "Wholesale", "Restaurant", "Services", "Manufacturing", "Other"]
const CURRENCIES: [string, string][] = [
  ["BDT", "৳ Bangladeshi Taka (BDT)"],
  ["USD", "$ US Dollar (USD)"],
  ["INR", "₹ Indian Rupee (INR)"],
]
const CURRENCY_SYMBOL: Record<string, string> = {
  BDT: "৳", USD: "$", INR: "₹", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$", JPY: "¥",
}
const LANGUAGES: [string, string][] = [["en", "English"], ["bn", "বাংলা (Bangla)"]]

type DateStyle = "dmy" | "mdy" | "long"
const DATE_FORMAT_OF: Record<DateStyle, "DD/MM/YYYY" | "MM/DD/YYYY" | "D MMM YYYY"> = {
  dmy: "DD/MM/YYYY", mdy: "MM/DD/YYYY", long: "D MMM YYYY",
}
const styleOfDateFormat = (f?: string): DateStyle =>
  f === "MM/DD/YYYY" ? "mdy" : f === "D MMM YYYY" ? "long" : "dmy"

const PAPERS: [Paper, string][] = [["58", "58 mm"], ["80", "80 mm"], ["a4", "A4 invoice"]]
const PAPER_WIDTH: Record<Paper, number> = { "58": 200, "80": 260, a4: 320 }

type GwId = "sslcommerz" | "portwallet" | "stripe" | "paypal" | "bkash" | "nagad"
interface GwDef {
  id: GwId
  name: string
  sub: string
  sandbox: boolean
  fields: [string, string, "text" | "password", string][]
  need: string[]
  note: [string, string]
  noteIf?: (f: Record<string, string>) => boolean
}
const GATEWAYS: GwDef[] = [
  { id: "sslcommerz", name: "SSLCommerz", sub: "Covers bKash, Nagad, Rocket, Cards, Net Banking", sandbox: true,
    fields: [["store_id", "Store ID", "text", "your_store_id"], ["store_passwd", "Store password", "password", "••••••••"]],
    need: ["store_id", "store_passwd"],
    note: ["SSLCommerz sandbox.", "Register at developer.sslcommerz.com for a free sandbox Store ID and password. Callback URLs must be publicly accessible."] },
  { id: "portwallet", name: "PortWallet", sub: "Cards and mobile banking", sandbox: true,
    fields: [["app_key", "App key", "text", "your_app_key"], ["app_secret", "App secret", "password", "••••••••"]],
    need: ["app_key", "app_secret"],
    note: ["PortWallet sandbox.", "Register at portwallet.com for sandbox keys. The callback URL must be publicly accessible."] },
  { id: "stripe", name: "Stripe", sub: "Credit / debit card payments globally", sandbox: false,
    fields: [["publishable_key", "Publishable key", "text", "pk_test_..."], ["secret_key", "Secret key", "password", "sk_test_..."], ["webhook_secret", "Webhook secret", "password", "whsec_..."]],
    need: ["publishable_key", "secret_key"],
    note: ["Stripe test mode.", "Use pk_test_ and sk_test_ keys from the Stripe dashboard. Test card: 4242 4242 4242 4242, any future date, any CVC. Decline card: 4000 0000 0000 0002."],
    noteIf: (f) => (f.secret_key ?? "") === "" || f.secret_key.startsWith("sk_test_") },
  { id: "paypal", name: "PayPal", sub: "PayPal account and card payments", sandbox: true,
    fields: [["client_id", "Client ID", "text", "AY..."], ["client_secret", "Client secret", "password", "••••••••"]],
    need: ["client_id", "client_secret"],
    note: ["PayPal sandbox.", "Get sandbox Client ID and Secret from developer.paypal.com under My Apps and Credentials. Return and cancel URLs must be publicly accessible."] },
  { id: "bkash", name: "bKash", sub: "Direct bKash merchant payments, no SSLCommerz needed", sandbox: true,
    fields: [["app_key", "App key", "text", "bkash_app_key"], ["app_secret", "App secret", "password", "••••••••"], ["username", "Username", "text", "merchant username"], ["password", "Password", "password", "••••••••"]],
    need: ["app_key", "app_secret", "username", "password"],
    note: ["bKash sandbox.", "Use the sandbox credentials from the bKash developer portal. The callback URL must be publicly accessible."] },
  { id: "nagad", name: "Nagad", sub: "Direct Nagad merchant payments, no SSLCommerz needed", sandbox: true,
    fields: [["merchant_id", "Merchant ID", "text", "686969"], ["nagad_public_key", "Nagad public key (blank for sandbox default)", "text", "Nagad-provided RSA public key"], ["private_key", "Your RSA private key (base64, no headers)", "password", "MIIEpAIBAAKCAQEA..."]],
    need: ["merchant_id", "private_key"],
    note: ["Nagad sandbox.", "A real sandbox account needs merchant registration with Nagad. The callback URL must be publicly accessible."] },
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

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft disabled:opacity-50"
const card = "flex flex-col gap-4 rounded-[14px] border border-dash-border bg-dash-card p-[22px]"
const timeInput = "h-[38px] rounded-lg border border-dash-border bg-dash-card px-2.5 text-sm outline-none focus-visible:border-dash-accent"

const lakhGroup = (i: string) => i.replace(/\B(?=(\d\d)*\d{3}(?!\d))/g, ",")
const intlGroup = (i: string) => i.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className={card}>
      <div>
        <h2 className="font-dash-display text-lg font-bold">{title}</h2>
        {sub && <p className="mt-1 text-[13px] text-dash-muted">{sub}</p>}
      </div>
      {children}
    </section>
  )
}

function Toggle({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} disabled={disabled}
      className={cn("flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 disabled:opacity-50", on ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}>
      <span className="size-4 rounded-full bg-white" />
    </button>
  )
}

function Chips<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: [T, string][]; onPick: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([id, text]) => {
        const on = value === id
        return (
          <button key={id} type="button" aria-pressed={on} onClick={() => onPick(id)}
            className={cn("h-[38px] rounded-[10px] border px-3.5 text-[13px] font-semibold",
              on ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft")}>
            {text}
          </button>
        )
      })}
    </div>
  )
}

function SwitchRow({ title, sub, on, onClick }: { title: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-dash-border px-3.5 py-3">
      <span className="flex flex-col"><span className="font-semibold">{title}</span><span className="text-xs text-dash-muted">{sub}</span></span>
      <Toggle on={on} onClick={onClick} label={title} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function GeneralSettingsPage() {
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
      toast.error(e?.response?.data?.message || "Failed to load settings")
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
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file (PNG or JPG)"); return }
    if (file.size > maxMb * 1024 * 1024) { toast.error(`Image is over ${maxMb} MB. Pick a smaller file.`); return }
    const next: ImageState = { url: "", file, preview: URL.createObjectURL(file), removed: false }
    if (kind === "logo") setLogo((p) => ({ ...next, url: p.url })); else setBanner((p) => ({ ...next, url: p.url }))
    toast.success(kind === "logo" ? "Logo ready, save to apply" : "Banner ready, save to apply")
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
    toast.success("Monday hours copied to weekdays")
  }
  const addHoliday = () => {
    if (!v) return
    if (!holDraft) { setErr("Pick a date for the holiday closure."); return }
    if (v.holidays.includes(holDraft)) { toast.error("That date is already listed"); return }
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
    return `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}`
  }
  const fmtHoliday = (iso: string) => fmtDate(new Date(iso + "T00:00:00"), v?.df ?? "dmy")
  const today = new Date()

  /* ---------- validate + save ---------- */
  const validate = (f: Form): string => {
    const email = f.email.trim()
    const tax = Number(f.taxRate), low = Number(f.lowStock), nxt = Number(f.nextNo)
    if (!f.storeName.trim()) return "Store name is required."
    if (!f.phone.trim()) return "Phone is required."
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address."
    if (!f.prefix.trim()) return "Invoice prefix is required."
    if (!f.poPrefix.trim()) return "PO prefix is required."
    if (f.taxRate === "" || !isFinite(tax) || tax < 0 || tax > 100) return "Tax rate must be between 0 and 100."
    if (f.lowStock === "" || !Number.isInteger(low) || low < 0) return "Low-stock default must be a whole number, 0 or more."
    if (f.nextNo === "" || !Number.isInteger(nxt) || nxt < 1) return "Next invoice number must be a whole number, 1 or more."
    const bad = DAYS.find((d) => f.hours[d].open && (!f.hours[d].from || !f.hours[d].to || f.hours[d].from >= f.hours[d].to))
    if (bad) return `${DAY_LABEL[bad]}: opening time must be before closing time.`
    const URLRE = /^https?:\/\/[^\s/$.?#][^\s]*$/i
    for (const [k, label] of [["website", "Website"], ["facebook", "Facebook"], ["instagram", "Instagram"], ["twitter", "Twitter"]] as const) {
      const u = f[k].trim()
      if (u && !URLRE.test(u)) return `${label} must be a full URL starting with http:// or https://`
    }
    if (f.promo.on && !f.promo.title.trim()) return "Promo banner needs a title while it is turned on."
    if (f.promo.on && f.promo.link.trim() && !/^(\/|https?:\/\/)/.test(f.promo.link.trim())) return "Promo banner link must start with / or http(s)://"
    const incomplete = GATEWAYS.find((g) => f.gw[g.id].enabled && g.need.some((k) => !(f.gw[g.id].fields[k] || "").trim()))
    if (incomplete) return `${incomplete.name} is turned on but its credentials are incomplete.`
    if (f.cod.on) {
      const cg = GATEWAYS.find((x) => x.id === f.cod.gateway)
      const amt = Number(f.cod.amount)
      if (f.cod.amount === "" || !isFinite(amt) || amt < 0) return "COD deposit amount must be 0 or more."
      if (!cg || !f.gw[cg.id].enabled) return `Turn on ${cg ? cg.name : "the chosen gateway"} before using it for the COD deposit.`
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
        run("General", ["storeName", "legalName", "phone", "email", "address", "bin", "licence", "prefix", "nextNo", "poPrefix", "lowStock", "paper", "footer", "holidays"], settingsApi.updateGeneral({
          storeName: v.storeName.trim(), legalName: v.legalName.trim(), storePhone: v.phone.trim(),
          storeEmail: v.email.trim(), storeAddress: v.address.trim(), bin: v.bin.trim(), licence: v.licence.trim(),
          invoicePrefix: v.prefix.trim(), nextInvoiceNumber: Number(v.nextNo), poPrefix: v.poPrefix.trim(),
          lowStockDefault: Number(v.lowStock), receiptPaper: v.paper, receiptFooter: v.footer, holidays: v.holidays,
        } as any))
      }
      if (any("storeName", "bizType", "registration", "website", "facebook", "instagram", "twitter", "promo")) {
        run("Business", ["storeName", "bizType", "registration", "website", "facebook", "instagram", "twitter", "promo"], settingsApi.updateBusiness({
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
        run("Region", ["currency", "timezone", "language", "nf", "df", "taxRate"], saasCompanyApi.updateSettings(payload))
      }
      if (any("taxRate")) run("Tax", ["taxRate"], settingsApi.updateTax({ defaultTaxRate: Number(v.taxRate) }))
      if (any("hours")) {
        const out: StoreHours = {}
        DAYS.forEach((d) => { out[d] = { isOpen: v.hours[d].open, open: v.hours[d].open ? v.hours[d].from : "", close: v.hours[d].open ? v.hours[d].to : "" } })
        run("Opening hours", ["hours"], settingsApi.updateStoreHours(out))
      }
      if (any("notif")) {
        run("Notifications", ["notif"], settingsApi.updateNotifications({
          emailNotifications: v.notif.email, orderNotifications: v.notif.order, marketingEmails: v.notif.marketing,
        }))
      }
      if (any("gw", "cod")) {
        const payment: Record<string, unknown> = {}
        GATEWAYS.forEach((g) => { payment[g.id] = { enabled: v.gw[g.id].enabled, ...v.gw[g.id].fields, ...(g.sandbox ? { sandbox: v.gw[g.id].sandbox } : {}) } })
        payment.cod_shipping_deposit = { enabled: v.cod.on, gateway: v.cod.gateway, custom_amount: Number(v.cod.amount) || 0 }
        run("Payment gateways", ["gw", "cod"], settingsApi.updatePayment(payment as any))
      }
      if (logo.file) run("Logo", [], settingsApi.uploadLogo(logo.file))
      else if (logo.removed) run("Logo", [], settingsApi.removeLogo())
      if (banner.file) run("Banner", [], settingsApi.uploadBanner(banner.file))
      else if (banner.removed) run("Banner", [], settingsApi.removeBanner())

      const results = await Promise.allSettled(jobs)
      const bad = results.map((r, i) => ({ r, t: tags[i] })).filter((x) => x.r.status === "rejected") as { r: PromiseRejectedResult; t: { name: string; keys: FormKey[] } }[]
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
      } else {
        toast.success("Settings saved")
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
    if (dirty) toast.success("Changes discarded")
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
      toast.success("Settings exported")
    } catch {
      toast.error("Export failed")
    }
  }

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    const rd = new FileReader()
    rd.onload = async () => {
      let p: any
      try { p = JSON.parse(String(rd.result)) } catch { toast.error("That file is not valid JSON"); return }
      if (!p || typeof p !== "object" || Array.isArray(p) || p.kind !== "company-settings") { toast.error("Not a settings backup file"); return }
      if (!window.confirm("Import this backup? It replaces the matching current settings.")) return
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
      if (bad) toast.error(`${bad} of ${res.length} sections could not be imported`)
      else toast.success("Settings imported")
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
      toast.success(".env copied")
    } catch { toast.error("Could not copy to the clipboard") }
  }

  /* ---------- render ---------- */
  if (blocked) return blocked

  const wrapper = `${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`

  const heading = (
    <div>
      <h1 className="font-dash-display text-[32px] font-bold tracking-tight">General settings</h1>
      <p className="mt-1 text-sm text-dash-muted">Business details, logo and banner, region, receipts, opening hours, notifications and payment gateway credentials.</p>
    </div>
  )

  if (loading || !v || !base) {
    return (
      <div className={wrapper}>
        {heading}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-4">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-[14px]" />)}
          </div>
          <div className="flex flex-[1_1_340px] flex-col gap-4">
            <Skeleton className="h-96 rounded-[14px]" />
            <Skeleton className="h-36 rounded-[14px]" />
          </div>
        </div>
      </div>
    )
  }

  const fld = (label: string, key: FormKey, o: { type?: string; ph?: string } = {}) => (
    <label key={key} className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">{label}
      <input className={input} type={o.type ?? "text"} placeholder={o.ph} value={v[key] as string} onChange={setText(key)} />
    </label>
  )
  const withCurrent = (opts: [string, string][], cur: string) => (opts.some(([a]) => a === cur) ? opts : [...opts, [cur, cur] as [string, string]])

  const imageBox = (kind: "logo" | "banner", s: ImageState, label: string, maxMb: number) => {
    const shown = shownImg(s)
    return (
      <div className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">{label}
        {shown && (
          <span className="flex h-[130px] items-center justify-center overflow-hidden rounded-xl border border-dash-border bg-dash-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown} alt={`${label} preview`} className="max-h-full max-w-full object-contain" />
          </span>
        )}
        <label className={cn("relative flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-dash-border bg-dash-bg text-center text-[13px] font-semibold text-dash-neutral-fg", shown ? "h-16" : "h-[120px]")}>
          <Upload className="size-[22px]" aria-hidden />
          {shown ? `Change ${kind}` : "Click to upload"}
          <span className="text-xs font-normal text-dash-muted">PNG or JPG · up to {maxMb} MB</span>
          <input type="file" accept="image/*" aria-label={`${label} file`} onChange={pickImage(kind, maxMb)} className="absolute size-px opacity-0" />
        </label>
        {shown && (
          <button type="button" onClick={() => clearImage(kind)} className="self-start text-[13px] font-semibold text-dash-danger">Remove {kind}</button>
        )}
      </div>
    )
  }

  const barText = err ? err : dirty ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}` : "Changes apply to new receipts and orders."

  return (
    <div className={wrapper}>
      {heading}

      <div className="flex flex-wrap items-start gap-4">
        {/* ---------------- left column ---------------- */}
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-4">
          <Section title="Business profile" sub="Shown on receipts, invoices and your online store.">
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
              {imageBox("logo", logo, "Logo", 5)}
              {imageBox("banner", banner, "Banner", 10)}
            </div>
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
              {fld("Store name *", "storeName")}
              {fld("Legal / company name", "legalName", { ph: "e.g. SAAS Trading Ltd." })}
              {fld("Phone *", "phone", { type: "tel" })}
              {fld("Email", "email", { type: "email" })}
              {fld("Address", "address", { ph: "House, road, area" })}
              {fld("BIN / VAT reg. no.", "bin", { ph: "Optional" })}
              {fld("Trade licence no.", "licence", { ph: "Optional" })}
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Business type
                <select className={input} value={v.bizType} onChange={setText("bizType")}>
                  {withCurrent(BIZ_TYPES.map((t) => [t, t] as [string, string]), v.bizType).map(([a, b]) => <option key={a} value={a}>{b}</option>)}
                </select>
              </label>
              {fld("Registration number", "registration", { ph: "e.g. REG-2026-001" })}
              {fld("Website", "website", { ph: "https://" })}
              {fld("Facebook", "facebook", { ph: "https://facebook.com/…" })}
              {fld("Instagram", "instagram", { ph: "https://instagram.com/…" })}
              {fld("Twitter / X", "twitter", { ph: "https://twitter.com/…" })}
            </div>
          </Section>

          <Section title="Region & format" sub="Your current pages show “$” in some places — this fixes it everywhere.">
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Currency
                <select className={input} value={v.currency} onChange={setText("currency")}>
                  {withCurrent(CURRENCIES, v.currency).map(([a, b]) => <option key={a} value={a}>{b}</option>)}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Time zone
                <select className={input} value={v.timezone} onChange={setText("timezone")}>
                  {withCurrent(TIMEZONES, v.timezone).map(([a, b]) => <option key={a} value={a}>{b}</option>)}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Language
                <select className={input} value={v.language} onChange={setText("language")}>
                  {withCurrent(LANGUAGES, v.language).map(([a, b]) => <option key={a} value={a}>{b}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Number format
              <Chips label="Number format" value={v.nf} onPick={(x) => set("nf", x)}
                options={[["lakh", "1,00,000.00 (lakh)"], ["intl", "100,000.00"]]} />
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Date format
              <Chips label="Date format" value={v.df} onPick={(x) => set("df", x)}
                options={[["dmy", fmtDate(today, "dmy")], ["mdy", fmtDate(today, "mdy")], ["long", fmtDate(today, "long")]]} />
            </div>
            <div className="text-[13px] text-dash-muted">Preview: <strong className="text-dash-ink">{money(125450)}</strong> · <strong className="text-dash-ink">{fmtDate(today, v.df)}</strong></div>
          </Section>

          <Section title="Opening hours" sub="Used for online-store messages and staff schedules.">
            <div className="flex flex-col">
              {DAYS.map((d) => {
                const h = v.hours[d]
                return (
                  <div key={d} className="grid min-h-[52px] items-center gap-3 border-b border-dash-border-soft [grid-template-columns:110px_40px_minmax(0,1fr)]">
                    <span className="font-semibold">{DAY_LABEL[d]}</span>
                    <Toggle on={h.open} label={`Open on ${DAY_LABEL[d]}`} onClick={() => setDay(d, { open: !h.open })} />
                    {h.open ? (
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <input type="time" className={timeInput} value={h.from} aria-label={`${DAY_LABEL[d]} opens`} onChange={(e) => setDay(d, { from: e.target.value })} />
                        <span className="text-dash-muted">to</span>
                        <input type="time" className={timeInput} value={h.to} aria-label={`${DAY_LABEL[d]} closes`} onChange={(e) => setDay(d, { to: e.target.value })} />
                      </span>
                    ) : <span className="text-sm text-dash-muted">Closed</span>}
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyMonday} className={outlineBtn}>Copy Monday to weekdays</button>
              <input type="date" className={cn(input, "h-11 w-auto")} value={holDraft} aria-label="Holiday date" onChange={(e) => setHolDraft(e.target.value)} />
              <button type="button" onClick={addHoliday} className={outlineBtn}>+ Add holiday closure</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...v.holidays].sort().map((iso) => (
                <button key={iso} type="button" aria-label={`Remove holiday ${fmtHoliday(iso)}`}
                  onClick={() => set("holidays", v.holidays.filter((x) => x !== iso))}
                  className="h-[34px] rounded-full border border-dash-border bg-dash-bg px-3 text-[13px]">{fmtHoliday(iso)} ✕</button>
              ))}
            </div>
          </Section>

          <Section title="Promo banner" sub="A banner shown across the top of your online store.">
            <SwitchRow title="Show promo banner" sub="Turn off to hide it without losing the text." on={v.promo.on} onClick={() => set("promo", { ...v.promo, on: !v.promo.on })} />
            <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))]">
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Title
                <input className={input} value={v.promo.title} onChange={(e) => set("promo", { ...v.promo, title: e.target.value })} /></label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Button text
                <input className={input} value={v.promo.cta} onChange={(e) => set("promo", { ...v.promo, cta: e.target.value })} /></label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Subtitle
                <input className={input} value={v.promo.sub} onChange={(e) => set("promo", { ...v.promo, sub: e.target.value })} /></label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Button link
                <input className={input} value={v.promo.link} placeholder="/shop" onChange={(e) => set("promo", { ...v.promo, link: e.target.value })} /></label>
            </div>
            <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-xl bg-dash-accent px-4 py-3 text-white", !v.promo.on && "opacity-45")}>
              <span className="flex flex-col"><strong>{v.promo.title}</strong><span className="text-xs opacity-90">{v.promo.sub}</span></span>
              <span className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-bold text-dash-accent">{v.promo.cta}</span>
            </div>
          </Section>

          <Section title="Notification settings" sub="Manage how you receive notifications.">
            <div className="flex flex-col gap-2.5">
              <SwitchRow title="Email notifications" sub="Receive email updates about your account" on={v.notif.email} onClick={() => set("notif", { ...v.notif, email: !v.notif.email })} />
              <SwitchRow title="Order notifications" sub="Get notified when orders are placed or updated" on={v.notif.order} onClick={() => set("notif", { ...v.notif, order: !v.notif.order })} />
              <SwitchRow title="Marketing emails" sub="Receive promotional emails and updates" on={v.notif.marketing} onClick={() => set("notif", { ...v.notif, marketing: !v.notif.marketing })} />
            </div>
          </Section>

          <Section title="Payment gateway credentials" sub="SSLCommerz, PortWallet, Stripe, PayPal, bKash and Nagad credentials for online payments.">
            {GATEWAYS.map((g) => {
              const x = v.gw[g.id]
              const setGw = (patch: Partial<GwState>) => set("gw", { ...v.gw, [g.id]: { ...x, ...patch } })
              const showNote = g.sandbox ? x.enabled && x.sandbox : g.noteIf ? x.enabled && g.noteIf(x.fields) : false
              return (
                <div key={g.id} className="flex flex-col gap-3 rounded-xl border border-dash-border p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex flex-col"><span className="font-semibold">{g.name}</span><span className="text-xs text-dash-muted">{g.sub}</span></span>
                    <Toggle on={x.enabled} label={`Enable ${g.name}`} onClick={() => setGw({ enabled: !x.enabled })} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {g.fields.map(([k, label, type, ph]) => (
                      <label key={k} className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">{label}
                        <input className={input} type={type} autoComplete="off" placeholder={ph} value={x.fields[k] ?? ""}
                          onChange={(e) => setGw({ fields: { ...x.fields, [k]: e.target.value } })} />
                      </label>
                    ))}
                  </div>
                  {g.sandbox && (
                    <span className="flex items-center gap-2 text-[13px]">
                      <Toggle on={x.sandbox} label={`${g.name} sandbox mode`} onClick={() => setGw({ sandbox: !x.sandbox })} />
                      Sandbox mode (turn off for live payments)
                    </span>
                  )}
                  {showNote && (
                    <div className="rounded-lg bg-dash-warn-soft px-3 py-2 text-xs text-dash-warn-fg"><strong>{g.note[0]}</strong> {g.note[1]}</div>
                  )}
                </div>
              )
            })}
            <div className="flex flex-col gap-3 rounded-xl border border-dash-border p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex flex-col"><span className="font-semibold">COD shipping deposit</span>
                  <span className="text-xs text-dash-muted">Require customers to pay shipping cost upfront before a Cash on Delivery order is confirmed.</span></span>
                <Toggle on={v.cod.on} label="COD shipping deposit" onClick={() => set("cod", { ...v.cod, on: !v.cod.on })} />
              </div>
              {v.cod.on && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Payment gateway for deposit
                    <select className={input} value={v.cod.gateway} onChange={(e) => set("cod", { ...v.cod, gateway: e.target.value as GwId })}>
                      {GATEWAYS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Fixed deposit amount (0 = use actual shipping cost)
                    <input className={input} type="number" min={0} value={v.cod.amount} onChange={(e) => set("cod", { ...v.cod, amount: e.target.value })} />
                  </label>
                </div>
              )}
            </div>
          </Section>

          <Section title="Aura Shop integration" sub="Connect your storefront to this company.">
            <div className="flex flex-col gap-1 text-[13px] font-semibold">Your company ID
              <div className="font-mono text-2xl font-bold">{company?.id ?? "—"}</div>
            </div>
            <div className="rounded-xl bg-dash-ink p-3.5 font-mono text-xs leading-relaxed text-dash-card">
              {`VITE_API_BASE_URL=${apiUrl}`}<br />{`VITE_COMPANY_ID=${company?.id ?? ""}`}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={copyEnv} className={outlineBtn}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy .env
              </button>
              <span className="text-xs text-dash-muted">Set <code className="font-mono">VITE_COMPANY_ID</code> in the Aura Shop <code className="font-mono">.env</code> file. {apiUrlSaved ? "Change the company ID and API URL under Online store." : "No API URL saved yet, showing this site's /api. Set the real one under Online store."}</span>
            </div>
          </Section>
        </div>

        {/* ---------------- right column ---------------- */}
        <aside className="flex max-w-full flex-[1_1_340px] flex-col gap-4">
          <Section title="Receipts & invoices" sub="Live preview updates as you type.">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Invoice prefix
                <input className={cn(input, "font-mono")} value={v.prefix} onChange={setText("prefix")} /></label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Next number
                <input className={input} type="number" value={v.nextNo} onChange={setText("nextNo")} /></label>
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr))]">
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">PO prefix
                <input className={input} value={v.poPrefix} onChange={setText("poPrefix")} /></label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Tax rate (%)
                <input className={input} type="number" min={0} max={100} step={0.01} value={v.taxRate} onChange={setText("taxRate")} /></label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Low-stock default
                <input className={input} type="number" min={0} step={1} value={v.lowStock} onChange={setText("lowStock")} /></label>
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Receipt paper
              <Chips label="Paper" value={v.paper} options={PAPERS} onPick={(x) => set("paper", x)} />
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Footer message
              <input className={input} value={v.footer} onChange={setText("footer")} /></label>
            <div style={{ width: PAPER_WIDTH[v.paper] }}
              className="flex max-w-full flex-col gap-1 self-center border border-dash-border bg-white p-4 text-center font-mono text-[11px] text-[#0E1525] shadow-[0_4px_16px_rgba(14,21,37,0.08)]">
              <strong className="text-[13px]">{v.storeName.toUpperCase()}</strong>
              <span>{v.phone}</span>
              <span>{v.prefix}{v.nextNo} · {fmtDate(today, v.df)}</span>
              <span className="my-1 border-t border-dashed border-[#A9B3C9]" />
              <span className="flex justify-between"><span>Sample item A ×1</span><span>250.00</span></span>
              <span className="flex justify-between"><span>Sample item B ×1</span><span>400.00</span></span>
              <span className="my-1 border-t border-dashed border-[#A9B3C9]" />
              <span className="flex justify-between font-bold"><span>TOTAL</span><span>{money(650)}</span></span>
              <span className="mt-1.5">{v.footer}</span>
            </div>
          </Section>

          <Section title="Data" sub="Back up or restore your settings (including logo and banner links, excluding secrets) as a JSON file.">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportData} className={outlineBtn}>Export data</button>
              <button type="button" onClick={discard} disabled={saving || !dirty} className={outlineBtn}>Reset unsaved changes</button>
              <button type="button" onClick={() => importRef.current?.click()} disabled={!writable} className={outlineBtn}>Import data</button>
              <input ref={importRef} type="file" accept="application/json,.json" onChange={importData} className="hidden" />
            </div>
          </Section>
        </aside>
      </div>

      {/* ---------------- sticky save bar ---------------- */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2.5 rounded-[14px] border border-dash-border bg-dash-card px-[18px] py-3.5 shadow-[0_-6px_20px_rgba(14,21,37,0.06)]">
        <span className={cn("text-[13px]", err ? "text-dash-danger" : dirty ? "text-dash-warn-fg" : "text-dash-muted")}>{barText}</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={discard} disabled={saving || !dirty} className={outlineBtn}>Discard</button>
          <button type="button" onClick={save} disabled={saving || !writable}
            className="inline-flex h-11 items-center justify-center rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-60">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}
