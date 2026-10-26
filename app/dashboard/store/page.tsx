"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Globe, Heart, MapPin, Package, TrendingUp, Users } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { settingsApi, resolveStorageUrl, type AuraShopHeroSlide } from "@/lib/settingsApi"
import wishlistApi, { type WishlistAnalytics } from "@/lib/wishlistApi"
import { productApi, type ProductResponse } from "@/lib/productApi"
import { categoryApi, type CategoryResponse } from "@/lib/categoryApi"
import { getCompanyId } from "@/lib/utils/apiInterceptor"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

type Slide = Required<Pick<AuraShopHeroSlide, "id" | "imagePath" | "tag" | "title" | "subtitle" | "cta" | "link" | "gradient" | "enabled">>

interface Form {
  name: string
  slug: string
  theme: string
  published: boolean
  apiUrl: string
  companyId: string
  returns: string
  shipping: string
  privacy: string
  facebook: string
  instagram: string
  whatsapp: string
  youtube: string
  secs: string
  slides: Slide[]
}

const THEMES: [string, string][] = [["#2449E8", "Blue"], ["#0F766E", "Teal"], ["#6D28D9", "Violet"], ["#0E1525", "Ink"]]
// Overlay presets share the exact gradient classes used by the Aura Shop settings page / storefront.
const OVERLAYS: [string, string][] = [
  ["Brand blue", "from-primary/80 via-primary/40 to-transparent"],
  ["Teal", "from-accent/70 via-accent/30 to-transparent"],
  ["Dark", "from-foreground/70 via-foreground/30 to-transparent"],
]
// Customer-facing storefront destinations (routes of the online store).
const PAGES: [string, string][] = [
  ["/shop", "Shop (all products)"],
  ["/deals", "Deals"],
  ["/wishlist", "Wishlist"],
  ["/about", "About us"],
  ["/contact", "Contact"],
  ["/faq", "FAQ"],
  ["/returns", "Returns & refunds"],
  ["/shipping", "Shipping policy"],
  ["/privacy", "Privacy policy"],
  ["/track-order", "Track order"],
  ["/support", "Support"],
  ["/login", "Login"],
  ["/signup", "Sign up"],
  ["/account", "My account"],
]

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const textarea = "w-full resize-y rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm font-normal outline-none focus-visible:border-dash-accent"
const label = "flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold"
const outlineBtn = "inline-flex h-11 items-center justify-center rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft disabled:opacity-50"
const card = "flex flex-col gap-4 rounded-[14px] border border-dash-border bg-dash-card p-5"
const URLRE = /^https?:\/\/[^\s/$.?#][^\s]*$/i

const S = (v: unknown) => (typeof v === "string" ? v : "")
const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")

const normalize = (business: any): Form => {
  const o = business?.onlineStore ?? {}
  const po = o.policies ?? {}
  const so = o.social ?? {}
  const hero = business?.auraShopHero ?? business?.aura_shop_hero
  const slides: Slide[] = (Array.isArray(hero?.slides) ? hero.slides : []).map((x: any, i: number) => ({
    id: S(x.id) || `aura-slide-${i + 1}`,
    imagePath: S(x.imagePath),
    tag: S(x.tag),
    title: S(x.title),
    subtitle: S(x.subtitle),
    cta: S(x.cta),
    link: S(x.link) || "/shop",
    gradient: S(x.gradient),
    enabled: x.enabled !== false,
  }))
  const ms = Number(hero?.autoplayMs)
  return {
    name: o.name != null ? S(o.name) : S(business?.businessName),
    slug: S(o.slug),
    theme: THEMES.some(([c]) => c === o.theme) ? o.theme : THEMES[0][0],
    published: o.published === true,
    apiUrl: S(o.apiUrl),
    companyId: S(o.companyId),
    returns: S(po.returns),
    shipping: S(po.shipping),
    privacy: S(po.privacy),
    facebook: S(so.facebook),
    instagram: S(so.instagram),
    whatsapp: S(so.whatsapp),
    youtube: S(so.youtube),
    secs: String(ms >= 2000 ? Math.round(ms / 1000) : 6),
    slides,
  }
}

const COL: Record<string, string> = { primary: "36,73,232", accent: "15,118,110", foreground: "14,21,37", background: "255,255,255", white: "255,255,255", black: "0,0,0" }
const tok = (cls: string, p: string) => {
  const m = cls.match(new RegExp(`(?:^|\\s)${p}-([a-z]+)(?:/(\\d{1,3}))?(?=\\s|$)`))
  if (!m) return null
  if (m[1] === "transparent") return "rgba(0,0,0,0)"
  return `rgba(${COL[m[1]] || "14,21,37"},${m[2] != null ? Math.min(100, +m[2]) / 100 : 1})`
}
const overlay = (g: string) => {
  const f = tok(g, "from"), v = tok(g, "via"), t = tok(g, "to")
  if (!f && !v && !t) return "linear-gradient(90deg, rgba(14,21,37,0.55), rgba(14,21,37,0))"
  return `linear-gradient(90deg, ${[f || "rgba(0,0,0,0)", v, t || "rgba(0,0,0,0)"].filter(Boolean).join(", ")})`
}
const imgBg = (path: string) => `center / cover no-repeat url("${resolveStorageUrl(path).replace(/"/g, "%22")}")`

function Switch({ on, onClick, label: aria }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={aria} onClick={onClick}
      className={cn("flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}>
      <span className="size-4 rounded-full bg-white" />
    </button>
  )
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <span className="h-2 w-full overflow-hidden rounded-full bg-dash-neutral-soft">
      <span className={cn("block h-2 rounded-full", className)} style={{ width: `${pct}%` }} />
    </span>
  )
}

export default function OnlineStorePage() {
  const blocked = useModuleGuard("Store")
  const { canRead, canDelete } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const canViewWishlist = canRead("Store Wishlist")
  const canClearWishlist = canDelete("Store Wishlist")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState<Form | null>(null)
  const [d, setD] = useState<Form | null>(null)
  const [err, setErr] = useState("")
  const [cur, setCur] = useState(0)
  const [products, setProducts] = useState<ProductResponse[]>([])
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [wl, setWl] = useState<WishlistAnalytics | null>(null)
  const [wlLoading, setWlLoading] = useState(true)
  const [wlError, setWlError] = useState("")

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await settingsApi.getAll()
      const form = normalize(res.data.business || {})
      setSaved(form)
      setD(form)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load online store settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    productApi.getAll({ limit: 100 }).then((r) => setProducts(r.data)).catch(() => {})
    categoryApi.getAll({ view: "flat", limit: 200 }).then((r) => setCategories(r.data)).catch(() => {})
  }, [load])

  useEffect(() => {
    if (!canViewWishlist) { setWlLoading(false); return }
    wishlistApi.getAnalytics()
      .then(setWl)
      .catch(() => setWlError("Failed to load wishlist analytics"))
      .finally(() => setWlLoading(false))
  }, [canViewWishlist])

  const [clearing, setClearing] = useState(false)
  const clearWishlist = async () => {
    const n = wl?.summary.totalItems ?? 0
    if (!n) return toast.info("No wishlist data to clear")
    if (!window.confirm(`Delete all ${n} wishlist entries? This cannot be undone.`)) return
    setClearing(true)
    try {
      await wishlistApi.clear()
      setWl(await wishlistApi.getAnalytics())
      toast.success("Wishlist data cleared")
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not clear wishlist data")
    } finally { setClearing(false) }
  }

  const currentCompany = getCompanyId()
  const slideLink = d?.slides[Math.min(cur, (d?.slides.length ?? 1) - 1)]?.link
  const linkOptions = useMemo(() => {
    const cats = categories.filter((c) => c.status !== false).map((c) => ({ v: `/shop?category=${slugify(c.categoryName)}`, l: c.categoryName }))
    const prods = products.map((p) => ({ v: `/product/${p.id}`, l: p.name }))
    return { cats, prods }
  }, [categories, products])
  const knownLinks = useMemo(() => new Set([...PAGES.map(([v]) => v), ...linkOptions.cats.map((o) => o.v), ...linkOptions.prods.map((o) => o.v)]), [linkOptions])

  if (blocked) return blocked

  const shell = `${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`
  const header = (
    <div>
      <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Online store</h1>
      <p className="mt-1 text-sm text-dash-muted">Your online storefront: locations, wishlist analytics, details, policies and homepage slider, with a live preview.</p>
    </div>
  )

  if (loading || !d || !saved) {
    return (
      <div className={shell}>
        {header}
        <Skeleton className="h-20 w-full rounded-[14px]" />
        <Skeleton className="h-96 w-full rounded-[14px]" />
        <Skeleton className="h-96 w-full rounded-[14px]" />
      </div>
    )
  }

  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const patch = (p: Partial<Form>) => { setD({ ...d, ...p }); setErr("") }
  const idx = d.slides.length ? Math.min(cur, d.slides.length - 1) : -1
  const c = idx >= 0 ? d.slides[idx] : null
  const patchSlide = (p: Partial<Slide>) => patch({ slides: d.slides.map((x, i) => (i === idx ? { ...x, ...p } : x)) })

  const pv = c
    ? { tag: c.tag, title: c.title || "(untitled)", sub: c.subtitle, cta: c.cta || "Learn more", bg: c.imagePath ? imgBg(c.imagePath) : "#2A3858", over: overlay(c.gradient), note: `PREVIEW${c.imagePath ? "" : " · no image yet"}` }
    : { tag: "", title: "No slides yet", sub: "Add a slide to build your storefront hero.", cta: "Shop now", bg: "#2A3858", over: "none", note: "PREVIEW" }

  const fail = (m: string, slideIdx?: number) => {
    setErr(m)
    if (slideIdx != null) setCur(slideIdx)
    toast.error(m)
  }

  const upload = async (file?: File) => {
    if (!file || idx < 0) return
    if (!/^image\//.test(file.type)) return toast.error("Please choose an image file (PNG, JPG, WEBP).")
    if (file.size > 10 * 1024 * 1024) return toast.error("Image must be 10MB or smaller.")
    const at = idx
    try {
      setUploading(true)
      const res = await settingsApi.uploadStorefrontImage(file)
      setD((cd) => (cd ? { ...cd, slides: cd.slides.map((x, k) => (k === at ? { ...x, imagePath: res.data.imagePath } : x)) } : cd))
      toast.success(`Slide ${at + 1} image uploaded`)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to upload storefront image")
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    const name = d.name.trim(), slug = d.slug.trim()
    if (!name) return fail("Store name is required.")
    if (slug && !/^[a-z0-9]+(?:[-.][a-z0-9]+)*$/.test(slug)) return fail("Domain / slug can use lowercase letters, numbers, dots and hyphens only.")
    if (d.published && !slug) return fail("Add a domain or slug before publishing the store.")
    if (d.apiUrl.trim() && !URLRE.test(d.apiUrl.trim())) return fail("API base URL must start with http:// or https://")
    for (const [k, l] of [["facebook", "Facebook"], ["instagram", "Instagram"], ["youtube", "YouTube"]] as const) {
      const v = d[k].trim()
      if (v && !URLRE.test(v)) return fail(`${l} link must be a full URL starting with http(s)://`)
    }
    const wa = d.whatsapp.trim()
    if (wa && !URLRE.test(wa) && !/^\+?[0-9][0-9\s-]{6,}$/.test(wa)) return fail("WhatsApp must be a phone number or a URL.")
    const secs = Number(d.secs)
    if (!(secs >= 2 && secs <= 60)) return fail("Slide timing must be between 2 and 60 seconds.")
    for (let i = 0; i < d.slides.length; i++) {
      if (!d.slides[i].title.trim()) return fail(`Slide ${i + 1} needs a headline.`, i)
    }
    try {
      setSaving(true)
      await settingsApi.updateBusiness({
        onlineStore: {
          name, slug, theme: d.theme, published: d.published, apiUrl: d.apiUrl.trim(), companyId: d.companyId.trim(),
          policies: { returns: d.returns.trim(), shipping: d.shipping.trim(), privacy: d.privacy.trim() },
          social: { facebook: d.facebook.trim(), instagram: d.instagram.trim(), whatsapp: wa, youtube: d.youtube.trim() },
        },
        auraShopHero: {
          autoplayMs: Math.round(secs * 1000),
          slides: d.slides.map((x, i) => ({ ...x, id: x.id || `aura-slide-${i + 1}`, tag: x.tag.trim(), title: x.title.trim(), subtitle: x.subtitle.trim(), cta: x.cta.trim(), link: x.link.trim() || "/shop", gradient: x.gradient.trim() })),
        },
      })
      toast.success("Online store saved")
      await load()
    } catch (e: any) {
      const errors = e?.response?.data?.errors
      const first = errors ? (Object.values(errors)[0] as string[])?.[0] : undefined
      fail(first || e?.response?.data?.message || "Failed to save online store")
    } finally {
      setSaving(false)
    }
  }

  const text = (lbl: string, key: keyof Omit<Form, "slides" | "published">, placeholder = "", transform?: (v: string) => string) => (
    <label className={label}>
      {lbl}
      <input type="text" className={input} value={d[key]} placeholder={placeholder} onChange={(e) => patch({ [key]: transform ? transform(e.target.value) : e.target.value })} />
    </label>
  )

  const configured = !!(saved.name && saved.slug)
  const effCompany = d.companyId.trim() || (currentCompany ? String(currentCompany) : "")
  const envLines = [`VITE_API_BASE_URL=${d.apiUrl.trim()}`, `VITE_COMPANY_ID=${effCompany}`]
  const host = d.slug.trim()
  // Dotted slug = custom domain. Otherwise build from the storefront base URL (env), when configured.
  const shopBase = (process.env.NEXT_PUBLIC_AURA_SHOP_URL || "").replace(/\/+$/, "")
  const visitHref = !d.published || !host ? "" : host.includes(".") ? `https://${host}` : shopBase
  const visitHint = !d.published ? "Publish the store to enable this link" : !host ? "Add a domain or slug first" : "Set NEXT_PUBLIC_AURA_SHOP_URL to link slug-only stores"
  const copyEnv = async () => {
    try { await navigator.clipboard.writeText(envLines.join("\n")); toast.success(".env copied") }
    catch { toast.error("Could not copy to the clipboard") }
  }

  const maxP = wl?.topProducts[0]?.wishlistCount ?? 1
  const maxC = wl?.topCustomers[0]?.wishlistCount ?? 1
  const trend = wl ? [...wl.dailyTrend].sort((a, b) => b.date.localeCompare(a.date)) : []
  const maxD = Math.max(1, ...trend.map((t) => t.count))
  const fmtDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
  const wlHub = wl && wl.summary.totalItems
    ? `${wl.summary.totalItems} wishlist item${wl.summary.totalItems > 1 ? "s" : ""} from ${wl.summary.uniqueCustomers} customer${wl.summary.uniqueCustomers > 1 ? "s" : ""}`
    : "Customer wishlist activity and most-wanted products"

  const hubCard = "flex items-center gap-3 rounded-[14px] border border-dash-border bg-dash-card p-4 hover:bg-dash-neutral-soft"

  return (
    <div className={shell}>
      {header}

      <nav aria-label="Store sections" className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
        <Link href="/dashboard/store/locations" className={hubCard}>
          <span className="flex size-10 items-center justify-center rounded-[10px] bg-dash-success-soft text-dash-success-fg"><MapPin className="size-5" /></span>
          <span className="flex flex-col"><strong className="text-sm">Locations</strong><span className="text-[13px] text-dash-muted">Manage your warehouses and physical stores</span></span>
        </Link>
        {(
          <a href="#wishlist" className={hubCard}>
            <span className="flex size-10 items-center justify-center rounded-[10px] bg-dash-danger-soft text-dash-danger-fg"><Heart className="size-5" /></span>
            <span className="flex flex-col"><strong className="text-sm">Wishlist analytics</strong><span className="text-[13px] text-dash-muted">{wlHub}</span></span>
          </a>
        )}
      </nav>

      <section className="flex flex-wrap items-center gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-4">
        <span className={cn("flex size-10 items-center justify-center rounded-[10px]", saved.published ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-neutral-soft text-dash-muted")}><Globe className="size-5" /></span>
        <div className="min-w-[200px] flex-1">
          <div className="text-sm font-bold">{saved.published ? `${saved.name} is live` : configured ? `${saved.name} is not published` : "Online store is not set up"}</div>
          <div className="text-[13px] text-dash-muted">
            {configured ? `${saved.published ? "Published at " : "Will be served at "}${saved.slug}${saved.companyId ? ` · Company ID ${saved.companyId}` : ""}` : "Add a store name and domain below, then publish."}
          </div>
        </div>
        <div className="rounded-lg bg-dash-neutral-soft px-3 py-2 font-mono text-xs leading-5">{envLines[0]}<br />{envLines[1]}</div>
        <button type="button" className={outlineBtn} onClick={copyEnv}>Copy .env</button>
        {visitHref
          ? <a href={visitHref} target="_blank" rel="noopener noreferrer" className={cn(outlineBtn, "text-dash-accent")}>Visit store ↗</a>
          : <span className={cn(outlineBtn, "cursor-not-allowed opacity-50")} aria-disabled title={visitHint}>Visit store ↗</span>}
      </section>

      <section aria-label="Store details" className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-dash-display text-lg font-bold">Store details</h2>
            <p className="mt-1 text-[13px] text-dash-muted">Name, address and visibility of your online store.</p>
          </div>
          <span className="flex items-center gap-2 text-[13px] font-semibold">
            {d.published ? "Published" : "Draft"}
            <Switch on={d.published} label="Publish store" onClick={() => patch({ published: !d.published })} />
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {text("Store name *", "name", "e.g. My Boutique")}
          {text("Domain or store slug", "slug", "my-boutique or shop.example.com", (v) => v.toLowerCase())}
          {text("API base URL", "apiUrl", "https://")}
          {text("Company ID", "companyId", currentCompany ? String(currentCompany) : "")}
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
          Theme colour
          <div role="group" aria-label="Theme colour" className="flex flex-wrap gap-2">
            {THEMES.map(([color, l]) => (
              <button key={color} type="button" aria-pressed={d.theme === color} onClick={() => patch({ theme: color })}
                className={cn("flex h-9 items-center gap-2 rounded-full border bg-dash-card px-3 text-[13px] font-semibold", d.theme === color ? "border-dash-accent" : "border-dash-border")}>
                <span className="size-4 rounded-full" style={{ background: color }} />{l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          <label className={label}>Returns policy<textarea rows={3} className={textarea} value={d.returns} placeholder="What customers can return and within how many days" onChange={(e) => patch({ returns: e.target.value })} /></label>
          <label className={label}>Shipping policy<textarea rows={3} className={textarea} value={d.shipping} placeholder="Delivery areas, charges and timelines" onChange={(e) => patch({ shipping: e.target.value })} /></label>
          <label className={label}>Privacy policy<textarea rows={3} className={textarea} value={d.privacy} placeholder="How you handle customer data" onChange={(e) => patch({ privacy: e.target.value })} /></label>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {text("Facebook", "facebook", "https://facebook.com/…")}
          {text("Instagram", "instagram", "https://instagram.com/…")}
          {text("WhatsApp", "whatsapp", "+8801…")}
          {text("YouTube", "youtube", "https://youtube.com/…")}
        </div>
      </section>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <section aria-label="Homepage hero" className={cn(card, "min-w-0 flex-[3]")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-dash-display text-lg font-bold">Homepage hero</h2>
              <p className="mt-1 text-[13px] text-dash-muted">The large slider on your store’s front page.</p>
            </div>
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              Change every
              <input type="number" min={2} max={60} className={cn(input, "w-20")} value={d.secs} onChange={(e) => patch({ secs: e.target.value })} />
              seconds
            </label>
          </div>

          <div aria-label="Live preview" className="relative flex h-[220px] flex-col justify-center gap-2.5 overflow-hidden rounded-2xl px-9 text-white" style={{ background: pv.bg }}>
            <span className="absolute inset-0" style={{ background: pv.over }} />
            {pv.tag && <span className="relative self-start rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">{pv.tag}</span>}
            <span className="relative max-w-[560px] font-dash-display text-[28px] font-bold leading-[1.1]">{pv.title}</span>
            <span className="relative max-w-[520px] text-sm opacity-90">{pv.sub}</span>
            <span className="relative flex h-10 items-center self-start rounded-[10px] bg-white px-4 text-sm font-bold text-dash-ink">{pv.cta} →</span>
            <span className="absolute right-3.5 top-3 rounded-md bg-black/35 px-2 py-[3px] text-[11px] font-bold">{pv.note}</span>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {d.slides.map((_, i) => (
                <button key={i} type="button" aria-label={`Show slide ${i + 1}`} onClick={() => setCur(i)} className="h-1.5 rounded-full bg-white" style={{ width: i === idx ? 22 : 6, opacity: i === idx ? 1 : 0.5 }} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {d.slides.map((s, i) => (
              <button key={s.id + i} type="button" aria-pressed={i === idx} onClick={() => setCur(i)}
                className={cn("flex min-w-[150px] max-w-[220px] items-center gap-2.5 rounded-[10px] border bg-dash-card p-2 text-left", i === idx ? "border-dash-accent" : "border-dash-border")}>
                <span className="size-10 shrink-0 rounded-lg bg-dash-neutral-soft" style={s.imagePath ? { background: imgBg(s.imagePath) } : { background: overlay(s.gradient) }} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[11px] text-dash-muted">Slide {i + 1} · {s.enabled ? "Showing" : "Hidden"}</span>
                  <span className="truncate text-[13px] font-semibold">{s.title || "(untitled)"}</span>
                </span>
              </button>
            ))}
            <button type="button" className="h-[58px] rounded-[10px] border-2 border-dashed border-dash-border bg-dash-neutral-soft px-4 text-sm font-semibold hover:bg-dash-border/40"
              onClick={() => { patch({ slides: [...d.slides, { id: `aura-${Date.now().toString(36)}`, imagePath: "", tag: "", title: "New slide", subtitle: "", cta: "Shop now", link: "/shop", gradient: OVERLAYS[0][1], enabled: true }] }); setCur(d.slides.length) }}>
              + Add slide
            </button>
          </div>
        </section>

        <aside className={cn(card, "min-w-0 flex-[2]")}>
          {!c ? (
            <p className="py-6 text-center text-sm text-dash-muted">No slides yet. Use “+ Add slide” to create your first homepage slide.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-dash-display text-lg font-bold">Edit slide {idx + 1}</h2>
                <span className="flex items-center gap-2 text-[13px] font-semibold">Showing<Switch on={c.enabled} label="Slide enabled" onClick={() => patchSlide({ enabled: !c.enabled })} /></span>
              </div>
              <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Image
                <label className="block cursor-pointer rounded-[10px] border-2 border-dashed border-dash-border bg-dash-neutral-soft p-3 text-center">
                  <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = "" }} />
                  <span className="block text-sm font-semibold text-dash-accent">{uploading ? "Uploading…" : c.imagePath ? "Change slide image" : "Click to upload"}</span>
                  <span className="block text-xs font-normal text-dash-muted">PNG, JPG, WEBP · 1920×800 · 10 MB</span>
                </label>
                {c.imagePath && <button type="button" className="self-start text-xs font-semibold text-dash-danger-fg" onClick={() => patchSlide({ imagePath: "" })}>Remove image</button>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>Badge<input type="text" className={input} value={c.tag} onChange={(e) => patchSlide({ tag: e.target.value })} /></label>
                <label className={label}>Button text<input type="text" className={input} value={c.cta} onChange={(e) => patchSlide({ cta: e.target.value })} /></label>
              </div>
              <label className={label}>Headline<input type="text" className={input} value={c.title} onChange={(e) => patchSlide({ title: e.target.value })} /></label>
              <label className={label}>Subtitle<textarea rows={2} className={textarea} value={c.subtitle} onChange={(e) => patchSlide({ subtitle: e.target.value })} /></label>
              <label className={label}>
                Button goes to
                <select className={cn(input, "px-2.5")} value={c.link} onChange={(e) => patchSlide({ link: e.target.value })}>
                  <optgroup label="Pages">{PAGES.map(([v, l]) => <option key={v} value={v}>{l} ({v})</option>)}</optgroup>
                  {linkOptions.cats.length > 0 && <optgroup label="Category">{linkOptions.cats.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</optgroup>}
                  {linkOptions.prods.length > 0 && <optgroup label="Product">{linkOptions.prods.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</optgroup>}
                  {slideLink && !knownLinks.has(slideLink) && <optgroup label="Current"><option value={slideLink}>{slideLink}</option></optgroup>}
                </select>
              </label>
              <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
                Overlay colour
                <div role="group" aria-label="Overlay" className="flex flex-wrap gap-1.5">
                  {OVERLAYS.map(([l, g]) => (
                    <button key={l} type="button" aria-pressed={c.gradient === g} onClick={() => patchSlide({ gradient: g })}
                      className={cn("h-9 rounded-full border px-3 text-[13px] font-semibold", c.gradient === g ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between gap-2">
                <button type="button" className={cn(outlineBtn, "text-dash-danger-fg")}
                  onClick={() => { if (window.confirm(`Delete slide ${idx + 1}? Save changes to apply.`)) { patch({ slides: d.slides.filter((_, i) => i !== idx) }); setCur(0) } }}>
                  Delete slide
                </button>
                <button type="button" className={outlineBtn} disabled={idx === 0}
                  onClick={() => { const a = d.slides.slice(); [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; patch({ slides: a }); setCur(idx - 1) }}>Move earlier</button>
              </div>
            </>
          )}
        </aside>
      </div>

      {(
        <section id="wishlist" aria-label="Wishlist analytics" className={cn(card, "scroll-mt-4")}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-dash-display text-lg font-bold">Wishlist analytics</h2>
              <p className="mt-1 text-[13px] text-dash-muted">Customer wishlist activity and most-wanted products.</p>
            </div>
            <button type="button" className={cn(outlineBtn, "text-dash-danger-fg")} disabled={!canClearWishlist || clearing || wlLoading}
              title={canClearWishlist ? undefined : "You do not have permission to clear wishlist data"} onClick={clearWishlist}>
              {clearing ? "Clearing…" : "Clear wishlist data"}
            </button>
          </div>
          {!canViewWishlist && <p className="text-sm text-dash-muted">You do not have permission to view wishlist analytics.</p>}
          {canViewWishlist && wlError && <div className="rounded-[10px] border border-dash-danger-soft bg-dash-danger-soft px-3 py-2 text-sm text-dash-danger-fg">{wlError}</div>}
          {wlLoading ? (
            <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-[14px]" />)}</div>
          ) : wl ? (
            <>
              <StatsCards stats={[
                { label: "Total wishlist items", value: wl.summary.totalItems.toLocaleString(), icon: <Heart className="size-4" />, color: "red" },
                { label: "Customers with wishlists", value: wl.summary.uniqueCustomers.toLocaleString(), icon: <Users className="size-4" />, color: "blue" },
                { label: "Unique products wishlisted", value: wl.summary.uniqueProducts.toLocaleString(), icon: <Package className="size-4" />, color: "purple" },
              ]} />
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold">Most wishlisted products</h3>
                  {wl.topProducts.length === 0 && <p className="text-sm text-dash-muted">No wishlist data yet.</p>}
                  {wl.topProducts.map((p, i) => (
                    <div key={p.productId} className="flex items-center gap-3">
                      <span className="w-5 text-right text-sm text-dash-muted">{i + 1}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{p.name}</span>
                        <span className="truncate text-xs text-dash-muted">{[p.categoryName, formatCurrency(Number(p.salePrice ?? p.price))].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="w-24 shrink-0"><Bar pct={Math.round((p.wishlistCount / maxP) * 100)} className="bg-dash-accent" /></span>
                      <strong className="w-6 text-right text-sm tabular-nums">{p.wishlistCount}</strong>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold">Most active wishlist customers</h3>
                  {wl.topCustomers.length === 0 && <p className="text-sm text-dash-muted">No wishlist data yet.</p>}
                  {wl.topCustomers.map((cu, i) => (
                    <div key={cu.customerId} className="flex items-center gap-3">
                      <span className="w-5 text-right text-sm text-dash-muted">{i + 1}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{cu.name}</span>
                        <span className="truncate text-xs text-dash-muted">{cu.email}</span>
                      </span>
                      <span className="w-24 shrink-0"><Bar pct={Math.round((cu.wishlistCount / maxC) * 100)} className="bg-dash-accent" /></span>
                      <strong className="w-6 text-right text-sm tabular-nums">{cu.wishlistCount}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <h3 className="flex items-center gap-2 text-sm font-bold"><TrendingUp className="size-4 text-dash-success-fg" />Daily wishlist adds, last 30 days</h3>
                {trend.length === 0 && <p className="text-sm text-dash-muted">No activity in the last 30 days.</p>}
                {trend.map((t) => (
                  <div key={t.date} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-xs text-dash-muted">{fmtDay(t.date)}</span>
                    <Bar pct={Math.round((t.count / maxD) * 100)} className="bg-dash-success-fg" />
                    <strong className="w-6 text-right text-xs tabular-nums">{t.count}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>
      )}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2.5 rounded-[14px] border border-dash-border bg-dash-card px-4 py-3.5 shadow-[0_-6px_20px_rgba(14,21,37,0.06)]">
        <span className={cn("text-[13px]", err ? "text-dash-danger-fg" : "text-dash-muted")}>{err || (dirty ? "You have unsaved changes." : "All changes saved.")}</span>
        <div className="ml-auto flex gap-2">
          <button type="button" className={outlineBtn} disabled={!dirty || saving} onClick={() => { setD(saved); setErr(""); setCur(0); toast.success("Changes discarded") }}>Discard</button>
          <button type="button" className="h-11 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-50" disabled={!dirty || saving || uploading} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}
