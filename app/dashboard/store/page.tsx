"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Globe, Heart, ImageUp, MapPin, Package, TrendingUp, Users } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch as UISwitch } from "@/components/ui/switch"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatsCards } from "@/components/ui/stats-card"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { settingsApi, resolveStorageUrl, type AuraShopHeroSlide, type HomepageSections } from "@/lib/settingsApi"
import { HomepageSectionsEditor, sectionsFromSettings, sectionsToSettings, validateSections, type LinkGroup, type SectionsForm } from "@/components/storefront-homepage-sections"
import wishlistApi, { type WishlistAnalytics } from "@/lib/wishlistApi"
import { productApi, type ProductResponse } from "@/lib/productApi"
import { categoryApi, type CategoryResponse } from "@/lib/categoryApi"
import { getCompanyId } from "@/lib/utils/apiInterceptor"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { EmptyState } from "@/components/common/EmptyState"
import { SlideDots } from "@/components/common/SlideDots"
import { WithTooltip } from "@/components/common/WithTooltip"

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
  sections: SectionsForm
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
    sections: sectionsFromSettings(business?.homepageSections),
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
    <UISwitch checked={on} aria-label={aria} onCheckedChange={() => onClick()} />
  )
}

function Bar({ pct }: { pct: number }) {
  return <Progress value={pct} aria-hidden className="w-full" />
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
  const linkGroups = useMemo<LinkGroup[]>(() => [
    { label: "Pages", options: PAGES.map(([v, l]) => ({ value: v, label: `${l} (${v})` })) },
    { label: "Category", options: linkOptions.cats.map((o) => ({ value: o.v, label: o.l })) },
    { label: "Product", options: linkOptions.prods.map((o) => ({ value: o.v, label: o.l })) },
  ], [linkOptions])
  const categoryChoices = useMemo(() => categories.filter((c) => c.status !== false).map((c) => ({ id: c.id, name: c.categoryName })), [categories])

  if (blocked) return blocked

  const shell = `${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`
  const header = (
    <PageHeader
      title="Online store"
      description="Your online storefront: locations, wishlist analytics, details, policies, homepage slider and homepage sections, with a live preview."
    />
  )

  if (loading || !d || !saved) {
    return (
      <div className={shell}>
        {header}
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
        <Skeleton className="h-96 w-full" />
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

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!/^image\//.test(file.type)) { toast.error("Please choose an image file (PNG, JPG, WEBP)."); return null }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be 10MB or smaller."); return null }
    try {
      setUploading(true)
      const res = await settingsApi.uploadStorefrontImage(file)
      toast.success("Image uploaded")
      return res.data.imagePath
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to upload storefront image")
      return null
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
    const sectionsError = validateSections(d.sections)
    if (sectionsError) return fail(sectionsError)
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
        homepageSections: sectionsToSettings(d.sections) as HomepageSections,
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

  const text = (lbl: string, key: keyof Omit<Form, "slides" | "published" | "sections">, placeholder = "", transform?: (v: string) => string) => (
    <FormField label={lbl} htmlFor={`store-${key}`} className="min-w-0">
      <Input id={`store-${key}`} type="text" className="w-full" value={d[key]} placeholder={placeholder} onChange={(e) => patch({ [key]: transform ? transform(e.target.value) : e.target.value })} />
    </FormField>
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

  return (
    <div className={shell}>
      {header}

      <nav aria-label="Store sections" className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
        <Item asChild variant="outline">
          <Link href="/dashboard/store/locations">
            <ItemMedia variant="icon"><MapPin /></ItemMedia>
            <ItemContent><ItemTitle>Locations</ItemTitle><ItemDescription>Manage your warehouses and physical stores</ItemDescription></ItemContent>
          </Link>
        </Item>
        {(
          <Item asChild variant="outline">
            <a href="#wishlist">
              <ItemMedia variant="icon"><Heart /></ItemMedia>
              <ItemContent><ItemTitle>Wishlist analytics</ItemTitle><ItemDescription>{wlHub}</ItemDescription></ItemContent>
            </a>
          </Item>
        )}
      </nav>

      <Item asChild variant="outline" className="bg-card">
        <section>
          <ItemMedia variant="icon"><Globe /></ItemMedia>
          <ItemContent className="min-w-[200px]">
            <ItemTitle>{saved.published ? `${saved.name} is live` : configured ? `${saved.name} is not published` : "Online store is not set up"}</ItemTitle>
            <ItemDescription>
              {configured ? `${saved.published ? "Published at " : "Will be served at "}${saved.slug}${saved.companyId ? ` · Company ID ${saved.companyId}` : ""}` : "Add a store name and domain below, then publish."}
            </ItemDescription>
          </ItemContent>
          <ItemActions className="flex-wrap">
            <Card className="gap-0 px-3 py-2 font-mono text-xs leading-5 shadow-none">{envLines[0]}<br />{envLines[1]}</Card>
            <Button type="button" variant="outline" onClick={copyEnv}>Copy .env</Button>
            {visitHref
              ? <Button asChild variant="outline"><a href={visitHref} target="_blank" rel="noopener noreferrer">Visit store ↗</a></Button>
              : <WithTooltip content={visitHint}><span tabIndex={0}><Button type="button" variant="outline" disabled>Visit store ↗</Button></span></WithTooltip>}
          </ItemActions>
        </section>
      </Item>

      <SectionCard
        aria-label="Store details"
        title="Store details"
        description="Name, address and visibility of your online store."
        actions={
          <span className="flex items-center gap-2 text-sm font-medium">
            {d.published ? "Published" : "Draft"}
            <Switch on={d.published} label="Publish store" onClick={() => patch({ published: !d.published })} />
          </span>
        }
        contentClassName="flex flex-col gap-4"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {text("Store name *", "name", "e.g. My Boutique")}
          {text("Domain or store slug", "slug", "my-boutique or shop.example.com", (v) => v.toLowerCase())}
          {text("API base URL", "apiUrl", "https://")}
          {text("Company ID", "companyId", currentCompany ? String(currentCompany) : "")}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">Theme colour</p>
          <div role="group" aria-label="Theme colour" className="flex flex-wrap gap-2">
            {THEMES.map(([color, l]) => (
              <Button key={color} type="button" size="sm" aria-pressed={d.theme === color} onClick={() => patch({ theme: color })}
                variant={d.theme === color ? "default" : "outline"}>
                <span className="size-4 rounded-full" style={{ background: color }} />{l}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          <FormField label="Returns policy" htmlFor="store-returns" className="min-w-0"><Textarea id="store-returns" rows={3} className="w-full" value={d.returns} placeholder="What customers can return and within how many days" onChange={(e) => patch({ returns: e.target.value })} /></FormField>
          <FormField label="Shipping policy" htmlFor="store-shipping" className="min-w-0"><Textarea id="store-shipping" rows={3} className="w-full" value={d.shipping} placeholder="Delivery areas, charges and timelines" onChange={(e) => patch({ shipping: e.target.value })} /></FormField>
          <FormField label="Privacy policy" htmlFor="store-privacy" className="min-w-0"><Textarea id="store-privacy" rows={3} className="w-full" value={d.privacy} placeholder="How you handle customer data" onChange={(e) => patch({ privacy: e.target.value })} /></FormField>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {text("Facebook", "facebook", "https://facebook.com/…")}
          {text("Instagram", "instagram", "https://instagram.com/…")}
          {text("WhatsApp", "whatsapp", "+8801…")}
          {text("YouTube", "youtube", "https://youtube.com/…")}
        </div>
      </SectionCard>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <SectionCard
          aria-label="Homepage hero"
          className="min-w-0 flex-[3]"
          title="Homepage hero"
          description="The large slider on your store’s front page."
          actions={
            <Label className="flex items-center gap-2">
              Change every
              <Input type="number" min={2} max={60} className="w-20" value={d.secs} onChange={(e) => patch({ secs: e.target.value })} />
              seconds
            </Label>
          }
          contentClassName="flex flex-col gap-4"
        >
          <div aria-label="Live preview" className="relative flex h-[220px] flex-col justify-center gap-2.5 overflow-hidden rounded-2xl px-9 text-white" style={{ background: pv.bg }}>
            <span className="absolute inset-0" style={{ background: pv.over }} />
            {pv.tag && <Badge variant="secondary" className="relative self-start">{pv.tag}</Badge>}
            <span className="relative max-w-[560px] text-[28px] font-bold leading-[1.1]">{pv.title}</span>
            <span className="relative max-w-[520px] text-sm opacity-90">{pv.sub}</span>
            <span aria-hidden className={cn(buttonVariants({ variant: "secondary" }), "pointer-events-none relative self-start")}>{pv.cta} →</span>
            <Badge variant="secondary" className="absolute right-3.5 top-3">{pv.note}</Badge>
            <SlideDots tone="light" count={d.slides.length} current={idx} onSelect={setCur} className="absolute bottom-3 left-1/2 -translate-x-1/2" />
          </div>

          <div className="flex flex-wrap gap-2">
            {d.slides.map((s, i) => (
              <Button key={s.id + i} type="button" aria-pressed={i === idx} onClick={() => setCur(i)}
                variant={i === idx ? "default" : "outline"}
                className="h-auto min-w-[150px] max-w-[220px] justify-start gap-2.5 p-2 text-left whitespace-normal">
                <span className="size-10 shrink-0 rounded-md bg-muted" style={s.imagePath ? { background: imgBg(s.imagePath) } : { background: overlay(s.gradient) }} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-xs font-normal opacity-80">Slide {i + 1} · {s.enabled ? "Showing" : "Hidden"}</span>
                  <span className="truncate">{s.title || "(untitled)"}</span>
                </span>
              </Button>
            ))}
            <Button type="button" variant="outline" className="h-auto self-stretch"
              onClick={() => { patch({ slides: [...d.slides, { id: `aura-${Date.now().toString(36)}`, imagePath: "", tag: "", title: "New slide", subtitle: "", cta: "Shop now", link: "/shop", gradient: OVERLAYS[0][1], enabled: true }] }); setCur(d.slides.length) }}>
              + Add slide
            </Button>
          </div>
        </SectionCard>

        <aside className="min-w-0 flex-[2]">
        <SectionCard
          title={c ? `Edit slide ${idx + 1}` : undefined}
          actions={c ? <span className="flex items-center gap-2 text-sm font-medium">Showing<Switch on={c.enabled} label="Slide enabled" onClick={() => patchSlide({ enabled: !c.enabled })} /></span> : undefined}
          contentClassName="flex flex-col gap-4"
        >
          {!c ? (
            <EmptyState title="No slides yet" description="Use “+ Add slide” to create your first homepage slide." className="p-4 md:p-6" />
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Image</p>
                <Input id="slide-image" type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = "" }} />
                <EmptyState
                  bordered
                  icon={ImageUp}
                  title={c.imagePath ? "Slide image set" : "No slide image"}
                  description="PNG, JPG, WEBP · 1920×800 · 10 MB"
                  className="border-dashed p-4 md:p-6"
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button asChild variant="outline" size="sm" aria-disabled={uploading || undefined} className={cn("cursor-pointer", uploading && "pointer-events-none opacity-50")}>
                        <Label htmlFor="slide-image">{uploading ? "Uploading…" : c.imagePath ? "Change slide image" : "Click to upload"}</Label>
                      </Button>
                      {c.imagePath && <Button type="button" variant="ghost" size="sm" onClick={() => patchSlide({ imagePath: "" })}>Remove image</Button>}
                    </div>
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Badge" htmlFor="slide-tag" className="min-w-0"><Input id="slide-tag" type="text" className="w-full" value={c.tag} onChange={(e) => patchSlide({ tag: e.target.value })} /></FormField>
                <FormField label="Button text" htmlFor="slide-cta" className="min-w-0"><Input id="slide-cta" type="text" className="w-full" value={c.cta} onChange={(e) => patchSlide({ cta: e.target.value })} /></FormField>
              </div>
              <FormField label="Headline" htmlFor="slide-title"><Input id="slide-title" type="text" className="w-full" value={c.title} onChange={(e) => patchSlide({ title: e.target.value })} /></FormField>
              <FormField label="Subtitle" htmlFor="slide-subtitle"><Textarea id="slide-subtitle" rows={2} className="w-full" value={c.subtitle} onChange={(e) => patchSlide({ subtitle: e.target.value })} /></FormField>
              <FormField label="Button goes to" htmlFor="slide-link" className="min-w-0">
                <Select value={c.link || undefined} onValueChange={(v) => patchSlide({ link: v })}>
                  <SelectTrigger id="slide-link" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup><SelectLabel>Pages</SelectLabel>{PAGES.map(([v, l]) => <SelectItem key={v} value={v}>{l} ({v})</SelectItem>)}</SelectGroup>
                    {linkOptions.cats.length > 0 && <SelectGroup><SelectLabel>Category</SelectLabel>{linkOptions.cats.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectGroup>}
                    {linkOptions.prods.length > 0 && <SelectGroup><SelectLabel>Product</SelectLabel>{linkOptions.prods.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectGroup>}
                    {slideLink && !knownLinks.has(slideLink) && <SelectGroup><SelectLabel>Current</SelectLabel><SelectItem value={slideLink}>{slideLink}</SelectItem></SelectGroup>}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Overlay colour</p>
                <div role="group" aria-label="Overlay" className="flex flex-wrap gap-1.5">
                  {OVERLAYS.map(([l, g]) => (
                    <Button key={l} type="button" size="sm" aria-pressed={c.gradient === g} onClick={() => patchSlide({ gradient: g })}
                      variant={c.gradient === g ? "default" : "outline"}>{l}</Button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between gap-2">
                <Button type="button" variant="destructive"
                  onClick={() => { if (window.confirm(`Delete slide ${idx + 1}? Save changes to apply.`)) { patch({ slides: d.slides.filter((_, i) => i !== idx) }); setCur(0) } }}>
                  Delete slide
                </Button>
                <Button type="button" variant="outline" disabled={idx === 0}
                  onClick={() => { const a = d.slides.slice(); [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; patch({ slides: a }); setCur(idx - 1) }}>Move earlier</Button>
              </div>
            </>
          )}
        </SectionCard>
        </aside>
      </div>

      <HomepageSectionsEditor
        value={d.sections}
        onChange={(sections) => patch({ sections })}
        linkGroups={linkGroups}
        categories={categoryChoices}
        uploading={uploading}
        uploadImage={uploadImage}
      />

      {(
        <SectionCard
          id="wishlist"
          aria-label="Wishlist analytics"
          className="scroll-mt-4"
          title="Wishlist analytics"
          description="Customer wishlist activity and most-wanted products."
          actions={canClearWishlist ? (
            <Button type="button" variant="destructive" disabled={clearing || wlLoading} onClick={clearWishlist}>
              {clearing ? "Clearing…" : "Clear wishlist data"}
            </Button>
          ) : (
            <WithTooltip content="You do not have permission to clear wishlist data">
              <span tabIndex={0}><Button type="button" variant="destructive" disabled>Clear wishlist data</Button></span>
            </WithTooltip>
          )}
          contentClassName="flex flex-col gap-4"
        >
          {!canViewWishlist && <p className="text-sm text-muted-foreground">You do not have permission to view wishlist analytics.</p>}
          {canViewWishlist && wlError && <Alert variant="destructive"><AlertDescription>{wlError}</AlertDescription></Alert>}
          {wlLoading ? (
            <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
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
                  {wl.topProducts.length === 0 && <p className="text-sm text-muted-foreground">No wishlist data yet.</p>}
                  {wl.topProducts.map((p, i) => (
                    <div key={p.productId} className="flex items-center gap-3">
                      <span className="w-5 text-right text-sm text-muted-foreground">{i + 1}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{p.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{[p.categoryName, formatCurrency(Number(p.salePrice ?? p.price))].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="w-24 shrink-0"><Bar pct={Math.round((p.wishlistCount / maxP) * 100)} /></span>
                      <strong className="w-6 text-right text-sm tabular-nums">{p.wishlistCount}</strong>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold">Most active wishlist customers</h3>
                  {wl.topCustomers.length === 0 && <p className="text-sm text-muted-foreground">No wishlist data yet.</p>}
                  {wl.topCustomers.map((cu, i) => (
                    <div key={cu.customerId} className="flex items-center gap-3">
                      <span className="w-5 text-right text-sm text-muted-foreground">{i + 1}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold">{cu.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{cu.email}</span>
                      </span>
                      <span className="w-24 shrink-0"><Bar pct={Math.round((cu.wishlistCount / maxC) * 100)} /></span>
                      <strong className="w-6 text-right text-sm tabular-nums">{cu.wishlistCount}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <h3 className="flex items-center gap-2 text-sm font-bold"><TrendingUp className="size-4 text-muted-foreground" />Daily wishlist adds, last 30 days</h3>
                {trend.length === 0 && <p className="text-sm text-muted-foreground">No activity in the last 30 days.</p>}
                {trend.map((t) => (
                  <div key={t.date} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-xs text-muted-foreground">{fmtDay(t.date)}</span>
                    <Bar pct={Math.round((t.count / maxD) * 100)} />
                    <strong className="w-6 text-right text-xs tabular-nums">{t.count}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </SectionCard>
      )}

      <Card className="sticky bottom-0 z-10 flex-row flex-wrap items-center gap-2.5 px-4 py-3.5">
        <span className={cn("text-sm", err ? "text-destructive" : "text-muted-foreground")}>{err || (dirty ? "You have unsaved changes." : "All changes saved.")}</span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => { setD(saved); setErr(""); setCur(0); toast.success("Changes discarded") }}>Discard</Button>
          <Button type="button" disabled={!dirty || saving || uploading} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>
    </div>
  )
}
