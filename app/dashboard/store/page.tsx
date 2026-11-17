"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
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
import { StorefrontThemePicker, type BrandColors, type ColorSource } from "@/components/storefront-theme-picker"
import { DEFAULT_STORE_THEME, TEMPLATE_HIDDEN_SECTIONS, isStoreThemeId, type StoreThemeId } from "@/lib/storeThemes"
import { TemplateContentEditor, templateContentFromSettings, templateContentToSettings, validateTemplateContent, type TemplateContentForm } from "@/components/storefront-template-content"
import { HomepageSectionsEditor, sectionsFromSettings, sectionsToSettings, validateSections, type LinkGroup, type SectionsForm, type StoreT } from "@/components/storefront-homepage-sections"
import wishlistApi, { type WishlistAnalytics } from "@/lib/wishlistApi"
import { productApi, type ProductResponse } from "@/lib/productApi"
import { categoryApi, type CategoryResponse } from "@/lib/categoryApi"
import { getCompanyId } from "@/lib/utils/apiInterceptor"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { localeTag } from "@/lib/i18n"
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
  /** Accent colour hex, or "" for the theme's own */
  theme: string
  themePreset: StoreThemeId
  colorSource: ColorSource
  /** Default storefront language; shoppers can switch */
  language: "en" | "bn"
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
  facebookPixelId: string
  tiktokPixelId: string
  whatsappNumber: string
  secs: string
  slides: Slide[]
  sections: SectionsForm
  content: TemplateContentForm
}

// Accent colours offered on top of a theme (saved as onlineStore.theme); labels translated at render
const ACCENTS = [
  ["#2449E8", "store:template.accents.blue"],
  ["#0F766E", "store:template.accents.teal"],
  ["#6D28D9", "store:template.accents.violet"],
  ["#0E1525", "store:template.accents.ink"],
] as const
const HEX = /^#[0-9a-fA-F]{6}$/
// Overlay presets share the exact gradient classes used by the Aura Shop settings page / storefront.
const OVERLAYS = [
  ["store:store.hero.overlays.brandBlue", "from-primary/80 via-primary/40 to-transparent"],
  ["store:store.hero.overlays.teal", "from-accent/70 via-accent/30 to-transparent"],
  ["store:store.hero.overlays.dark", "from-foreground/70 via-foreground/30 to-transparent"],
] as const
// Customer-facing storefront destinations (routes of the online store).
const PAGES = [
  ["/shop", "store:store.links.page.shop"],
  ["/deals", "store:store.links.page.deals"],
  ["/wishlist", "store:store.links.page.wishlist"],
  ["/about", "store:store.links.page.about"],
  ["/contact", "store:store.links.page.contact"],
  ["/faq", "store:store.links.page.faq"],
  ["/returns", "store:store.links.page.returns"],
  ["/shipping", "store:store.links.page.shipping"],
  ["/privacy", "store:store.links.page.privacy"],
  ["/track-order", "store:store.links.page.trackOrder"],
  ["/support", "store:store.links.page.support"],
  ["/login", "store:store.links.page.login"],
  ["/signup", "store:store.links.page.signup"],
  ["/account", "store:store.links.page.account"],
] as const

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
    theme: ACCENTS.some(([c]) => c === o.theme) ? o.theme : "",
    themePreset: isStoreThemeId(o.themePreset) ? o.themePreset : DEFAULT_STORE_THEME,
    // Stores saved before themes keep their brand colours until the owner picks theme colours
    colorSource: o.colorSource === "theme" ? "theme" : "brand",
    language: o.language === "bn" ? "bn" : "en",
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
    facebookPixelId: S(o.facebookPixelId),
    tiktokPixelId: S(o.tiktokPixelId),
    whatsappNumber: S(o.whatsappNumber),
    secs: String(ms >= 2000 ? Math.round(ms / 1000) : 6),
    slides,
    sections: sectionsFromSettings(business?.homepageSections),
    content: templateContentFromSettings(business?.templateContent),
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
  const { t, i18n } = useTranslation(["store", "common"])
  const blocked = useModuleGuard("Store")
  const { canRead, canDelete, company } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const canViewWishlist = canRead("Store Wishlist")
  const canClearWishlist = canDelete("Store Wishlist")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState<Form | null>(null)
  const [d, setD] = useState<Form | null>(null)
  const [brand, setBrand] = useState<BrandColors | null>(null)
  const [err, setErr] = useState("")
  // Field the last save error belongs to (shown under that field)
  const [errField, setErrField] = useState<keyof Form | null>(null)
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
      const g = res.data.general ?? {}
      // Never set up: start from the store name in General settings, else the company name
      if (!form.name.trim()) form.name = S(g.storeName).trim() || company?.name?.trim() || ""
      const brandHex = (v: unknown) => (typeof v === "string" && HEX.test(v.trim()) ? v.trim() : "")
      setBrand(
        [g.primaryColor, g.accentColor, g.backgroundColor].some(brandHex)
          ? { primaryColor: brandHex(g.primaryColor) || "#1C1917", accentColor: brandHex(g.accentColor) || "#94234A", backgroundColor: brandHex(g.backgroundColor) || "#FFFFFF" }
          : null,
      )
      setSaved(form)
      setD(form)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("store:store.toast.loadFailed"))
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
      .catch(() => setWlError(t("store:store.wishlist.loadFailed")))
      .finally(() => setWlLoading(false))
  }, [canViewWishlist])

  const [clearing, setClearing] = useState(false)
  const clearWishlist = async () => {
    const n = wl?.summary.totalItems ?? 0
    if (!n) return toast.info(t("store:store.wishlist.nothingToClear"))
    if (!window.confirm(t("store:store.wishlist.confirmClear", { count: n }))) return
    setClearing(true)
    try {
      await wishlistApi.clear()
      setWl(await wishlistApi.getAnalytics())
      toast.success(t("store:store.wishlist.cleared"))
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("store:store.wishlist.clearFailed"))
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
    { label: t("store:store.links.pages"), options: PAGES.map(([v, l]) => ({ value: v, label: t("store:store.links.withPath", { label: t(l), path: v }) })) },
    { label: t("store:store.links.category"), options: linkOptions.cats.map((o) => ({ value: o.v, label: o.l })) },
    { label: t("store:store.links.product"), options: linkOptions.prods.map((o) => ({ value: o.v, label: o.l })) },
  ], [linkOptions, t])
  const categoryChoices = useMemo(() => categories.filter((c) => c.status !== false).map((c) => ({ id: c.id, name: c.categoryName })), [categories])

  if (blocked) return blocked

  const shell = `${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`
  const header = (
    <PageHeader
      title={t("store:store.title")}
      description={t("store:store.description")}
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
  const patch = (p: Partial<Form>) => { setD({ ...d, ...p }); setErr(""); setErrField(null) }
  const idx = d.slides.length ? Math.min(cur, d.slides.length - 1) : -1
  const c = idx >= 0 ? d.slides[idx] : null
  const patchSlide = (p: Partial<Slide>) => patch({ slides: d.slides.map((x, i) => (i === idx ? { ...x, ...p } : x)) })

  const pv = c
    ? { tag: c.tag, title: c.title || t("store:shared.untitled"), sub: c.subtitle, cta: c.cta || t("store:shared.learnMore"), bg: c.imagePath ? imgBg(c.imagePath) : "#2A3858", over: overlay(c.gradient), note: c.imagePath ? t("store:shared.preview") : t("store:store.hero.previewNoImage") }
    : { tag: "", title: t("store:shared.noSlides"), sub: t("store:store.hero.noSlidesSub"), cta: t("store:store.hero.shopNow"), bg: "#2A3858", over: "none", note: t("store:shared.preview") }

  const fail = (m: string, slideIdx?: number, field?: keyof Form) => {
    setErr(m)
    setErrField(field ?? null)
    if (slideIdx != null) setCur(slideIdx)
    toast.error(m)
    // Take the owner to the field that needs fixing
    if (field) {
      const el = document.getElementById(`store-${field}`)
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
      el?.focus({ preventScroll: true })
    }
  }

  const upload = async (file?: File) => {
    if (!file || idx < 0) return
    if (!/^image\//.test(file.type)) return toast.error(t("store:shared.chooseImage"))
    if (file.size > 10 * 1024 * 1024) return toast.error(t("store:shared.imageTooBig"))
    const at = idx
    try {
      setUploading(true)
      const res = await settingsApi.uploadStorefrontImage(file)
      setD((cd) => (cd ? { ...cd, slides: cd.slides.map((x, k) => (k === at ? { ...x, imagePath: res.data.imagePath } : x)) } : cd))
      toast.success(t("store:shared.slideImageUploaded", { n: at + 1 }))
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("store:shared.uploadFailed"))
    } finally {
      setUploading(false)
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!/^image\//.test(file.type)) { toast.error(t("store:shared.chooseImage")); return null }
    if (file.size > 10 * 1024 * 1024) { toast.error(t("store:shared.imageTooBig")); return null }
    try {
      setUploading(true)
      const res = await settingsApi.uploadStorefrontImage(file)
      toast.success(t("store:store.toast.imageUploaded"))
      return res.data.imagePath
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("store:shared.uploadFailed"))
      return null
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    const name = d.name.trim(), slug = d.slug.trim()
    if (!name) return fail(t("store:store.errors.nameRequired"), undefined, "name")
    if (slug && !/^[a-z0-9]+(?:[-.][a-z0-9]+)*$/.test(slug)) return fail(t("store:store.errors.slugFormat"), undefined, "slug")
    if (d.published && !slug) return fail(t("store:store.errors.slugBeforePublish"), undefined, "slug")
    if (d.apiUrl.trim() && !URLRE.test(d.apiUrl.trim())) return fail(t("store:store.errors.apiUrl"), undefined, "apiUrl")
    for (const [k, l] of [["facebook", "Facebook"], ["instagram", "Instagram"], ["youtube", "YouTube"]] as const) {
      const v = d[k].trim()
      if (v && !URLRE.test(v)) return fail(t("store:shared.socialUrl", { name: l }))
    }
    const wa = d.whatsapp.trim()
    if (wa && !URLRE.test(wa) && !/^\+?[0-9][0-9\s-]{6,}$/.test(wa)) return fail(t("store:store.errors.whatsapp"), undefined, "whatsapp")
    const fbPixel = d.facebookPixelId.trim(), ttPixel = d.tiktokPixelId.trim()
    if (fbPixel && !/^\d{5,20}$/.test(fbPixel)) return fail(t("store:store.errors.fbPixel"))
    if (ttPixel && !/^[A-Za-z0-9]{5,40}$/.test(ttPixel)) return fail(t("store:store.errors.ttPixel"))
    const waNumber = d.whatsappNumber.replace(/[\s-]/g, "").replace(/^\+/, "")
    if (waNumber && !/^\d{8,15}$/.test(waNumber)) return fail(t("store:store.errors.waNumber"))
    const secs = Number(d.secs)
    if (!(secs >= 2 && secs <= 60)) return fail(t("store:store.errors.slideTiming"))
    for (let i = 0; i < d.slides.length; i++) {
      if (!d.slides[i].title.trim()) return fail(t("store:store.errors.slideHeadline", { n: i + 1 }), i)
    }
    const sectionsError = validateSections(d.sections, t as StoreT)
    if (sectionsError) return fail(sectionsError)
    const contentError = validateTemplateContent(d.content, d.themePreset, t as StoreT)
    if (contentError) return fail(contentError)
    try {
      setSaving(true)
      await settingsApi.updateBusiness({
        onlineStore: {
          name, slug, theme: d.theme || null, themePreset: d.themePreset, colorSource: d.colorSource, language: d.language, published: d.published, apiUrl: d.apiUrl.trim(), companyId: d.companyId.trim(),
          policies: { returns: d.returns.trim(), shipping: d.shipping.trim(), privacy: d.privacy.trim() },
          social: { facebook: d.facebook.trim(), instagram: d.instagram.trim(), whatsapp: wa, youtube: d.youtube.trim() },
          facebookPixelId: fbPixel, tiktokPixelId: ttPixel, whatsappNumber: waNumber,
        },
        auraShopHero: {
          autoplayMs: Math.round(secs * 1000),
          slides: d.slides.map((x, i) => ({ ...x, id: x.id || `aura-slide-${i + 1}`, tag: x.tag.trim(), title: x.title.trim(), subtitle: x.subtitle.trim(), cta: x.cta.trim(), link: x.link.trim() || "/shop", gradient: x.gradient.trim() })),
        },
        homepageSections: sectionsToSettings(d.sections) as HomepageSections,
        templateContent: templateContentToSettings(d.content),
      })
      toast.success(t("store:store.toast.saved"))
      await load()
    } catch (e: any) {
      const errors = e?.response?.data?.errors
      const first = errors ? (Object.values(errors)[0] as string[])?.[0] : undefined
      fail(first || e?.response?.data?.message || t("store:store.toast.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const text = (lbl: string, key: keyof Omit<Form, "slides" | "published" | "sections" | "content">, placeholder = "", transform?: (v: string) => string) => (
    <FormField label={lbl} htmlFor={`store-${key}`} className="min-w-0" error={errField === key ? err : undefined}>
      <Input id={`store-${key}`} type="text" className="w-full" aria-invalid={errField === key || undefined} value={d[key]} placeholder={placeholder} onChange={(e) => patch({ [key]: transform ? transform(e.target.value) : e.target.value })} />
    </FormField>
  )

  const configured = !!(saved.name && saved.slug)
  const effCompany = d.companyId.trim() || (currentCompany ? String(currentCompany) : "")
  const envLines = [`VITE_API_BASE_URL=${d.apiUrl.trim()}`, `VITE_COMPANY_ID=${effCompany}`]
  const host = d.slug.trim()
  // Dotted slug = custom domain. Otherwise build from the storefront base URL (env), when configured.
  const shopBase = (process.env.NEXT_PUBLIC_AURA_SHOP_URL || "").replace(/\/+$/, "")
  const visitHref = !d.published || !host ? "" : host.includes(".") ? `https://${host}` : shopBase
  const visitHint = !d.published ? t("store:store.status.hintPublish") : !host ? t("store:store.status.hintSlug") : t("store:store.status.hintEnv")
  const copyEnv = async () => {
    try { await navigator.clipboard.writeText(envLines.join("\n")); toast.success(t("store:shared.envCopied")) }
    catch { toast.error(t("store:shared.copyFailed")) }
  }

  const maxP = wl?.topProducts[0]?.wishlistCount ?? 1
  const maxC = wl?.topCustomers[0]?.wishlistCount ?? 1
  const trend = wl ? [...wl.dailyTrend].sort((a, b) => b.date.localeCompare(a.date)) : []
  const maxD = Math.max(1, ...trend.map((t) => t.count))
  const fmtDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(localeTag(i18n.language), { day: "numeric", month: "short", year: "numeric" })
  const wlHub = wl && wl.summary.totalItems
    ? t("store:store.wishlist.hub", { count: wl.summary.totalItems, customers: t("store:store.wishlist.customers", { count: wl.summary.uniqueCustomers }) })
    : t("store:store.wishlist.description")

  return (
    <div className={shell}>
      {header}

      <nav aria-label={t("store:store.nav.label")} className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
        <Item asChild variant="outline">
          <Link href="/dashboard/store/locations">
            <ItemMedia variant="icon"><MapPin /></ItemMedia>
            <ItemContent><ItemTitle>{t("store:store.nav.locations")}</ItemTitle><ItemDescription>{t("store:store.nav.locationsDesc")}</ItemDescription></ItemContent>
          </Link>
        </Item>
        {(
          <Item asChild variant="outline">
            <a href="#wishlist">
              <ItemMedia variant="icon"><Heart /></ItemMedia>
              <ItemContent><ItemTitle>{t("store:store.nav.wishlist")}</ItemTitle><ItemDescription>{wlHub}</ItemDescription></ItemContent>
            </a>
          </Item>
        )}
      </nav>

      <Item asChild variant="outline" className="bg-card">
        <section>
          <ItemMedia variant="icon"><Globe /></ItemMedia>
          <ItemContent className="min-w-[200px]">
            <ItemTitle>{saved.published ? t("store:store.status.live", { name: saved.name }) : configured ? t("store:store.status.notPublished", { name: saved.name }) : t("store:store.status.notSetUp")}</ItemTitle>
            <ItemDescription>
              {!configured
                ? t("store:store.status.setupHint")
                : saved.published
                  ? (saved.companyId ? t("store:store.status.publishedAtCompany", { slug: saved.slug, id: saved.companyId }) : t("store:store.status.publishedAt", { slug: saved.slug }))
                  : (saved.companyId ? t("store:store.status.willServeCompany", { slug: saved.slug, id: saved.companyId }) : t("store:store.status.willServe", { slug: saved.slug }))}
            </ItemDescription>
          </ItemContent>
          <ItemActions className="flex-wrap">
            <Card className="gap-0 px-3 py-2 font-mono text-xs leading-5 shadow-none">{envLines[0]}<br />{envLines[1]}</Card>
            <Button type="button" variant="outline" onClick={copyEnv}>{t("store:shared.copyEnv")}</Button>
            {visitHref
              ? <Button asChild variant="outline"><a href={visitHref} target="_blank" rel="noopener noreferrer">{t("store:store.status.visit")}</a></Button>
              : <WithTooltip content={visitHint}><span tabIndex={0}><Button type="button" variant="outline" disabled>{t("store:store.status.visit")}</Button></span></WithTooltip>}
          </ItemActions>
        </section>
      </Item>

      <SectionCard
        aria-label={t("store:store.details.title")}
        title={t("store:store.details.title")}
        description={t("store:store.details.description")}
        actions={
          <span className="flex items-center gap-2 text-sm font-medium">
            {d.published ? t("common:status.published") : t("common:status.draft")}
            <Switch on={d.published} label={t("store:store.details.publish")} onClick={() => patch({ published: !d.published })} />
          </span>
        }
        contentClassName="flex flex-col gap-4"
      >
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {text(t("store:store.details.name"), "name", t("store:store.details.namePh"))}
          {text(t("store:store.details.slug"), "slug", t("store:store.details.slugPh"), (v) => v.toLowerCase())}
          {text(t("store:store.details.apiUrl"), "apiUrl", "https://")}
          {text(t("store:store.details.companyId"), "companyId", currentCompany ? String(currentCompany) : "")}
          <FormField label={t("store:store.details.language")} htmlFor="store-language" description={t("store:store.details.languageHelp")} className="min-w-0">
            <Select value={d.language} onValueChange={(v) => patch({ language: v === "bn" ? "bn" : "en" })}>
              <SelectTrigger id="store-language" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en" lang="en">{t("common:language.en")}</SelectItem>
                <SelectItem value="bn" lang="bn">{t("common:language.bn")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          <FormField label={t("store:store.details.returns")} htmlFor="store-returns" className="min-w-0"><Textarea id="store-returns" rows={3} className="w-full" value={d.returns} placeholder={t("store:store.details.returnsPh")} onChange={(e) => patch({ returns: e.target.value })} /></FormField>
          <FormField label={t("store:store.details.shipping")} htmlFor="store-shipping" className="min-w-0"><Textarea id="store-shipping" rows={3} className="w-full" value={d.shipping} placeholder={t("store:store.details.shippingPh")} onChange={(e) => patch({ shipping: e.target.value })} /></FormField>
          <FormField label={t("store:store.details.privacy")} htmlFor="store-privacy" className="min-w-0"><Textarea id="store-privacy" rows={3} className="w-full" value={d.privacy} placeholder={t("store:store.details.privacyPh")} onChange={(e) => patch({ privacy: e.target.value })} /></FormField>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {text("Facebook", "facebook", "https://facebook.com/…")}
          {text("Instagram", "instagram", "https://instagram.com/…")}
          {text("WhatsApp", "whatsapp", "+8801…")}
          {text("YouTube", "youtube", "https://youtube.com/…")}
        </div>
      </SectionCard>

      <SectionCard
        aria-label={t("store:template.title")}
        title={t("store:template.title")}
        description={t("store:template.description")}
      >
        <StorefrontThemePicker
          theme={d.themePreset}
          onTheme={(id) => patch({ themePreset: id, colorSource: "theme" })}
          colorSource={d.colorSource}
          onColorSource={(v) => patch({ colorSource: v })}
          accent={d.theme}
          onAccent={(hex) => patch({ theme: hex })}
          accents={ACCENTS.map(([hex, key]): [string, string] => [hex, t(key)])}
          brand={brand}
        />
      </SectionCard>

      <TemplateContentEditor
        template={d.themePreset}
        value={d.content}
        onChange={(content) => patch({ content })}
        linkGroups={linkGroups}
        uploading={uploading}
        uploadImage={uploadImage}
      />

      <SectionCard
        aria-label={t("store:store.ads.aria")}
        title={t("store:store.ads.title")}
        description={t("store:store.ads.description")}
        actions={<Button asChild variant="outline" size="sm"><Link href="/dashboard/marketing/links">{t("store:store.ads.adLinks")}</Link></Button>}
        contentClassName="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3"
      >
        <FormField label={t("store:store.ads.fbPixel")} htmlFor="store-facebookPixelId" className="min-w-0"
          description={t("store:store.ads.fbPixelHelp")}>
          <Input id="store-facebookPixelId" inputMode="numeric" className="w-full font-mono" value={d.facebookPixelId} placeholder={t("store:store.ads.fbPixelPh")}
            onChange={(e) => patch({ facebookPixelId: e.target.value.trim() })} />
        </FormField>
        <FormField label={t("store:store.ads.ttPixel")} htmlFor="store-tiktokPixelId" className="min-w-0"
          description={t("store:store.ads.ttPixelHelp")}>
          <Input id="store-tiktokPixelId" className="w-full font-mono" value={d.tiktokPixelId} placeholder={t("store:store.ads.ttPixelPh")}
            onChange={(e) => patch({ tiktokPixelId: e.target.value.trim() })} />
        </FormField>
        <FormField label={t("store:store.ads.waNumber")} htmlFor="store-whatsappNumber" className="min-w-0"
          description={t("store:store.ads.waNumberHelp")}>
          <Input id="store-whatsappNumber" inputMode="tel" className="w-full" value={d.whatsappNumber} placeholder="8801712345678"
            onChange={(e) => patch({ whatsappNumber: e.target.value })} />
        </FormField>
      </SectionCard>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <SectionCard
          aria-label={t("store:store.hero.title")}
          className="min-w-0 flex-[3]"
          title={t("store:store.hero.title")}
          description={t("store:store.hero.description")}
          actions={
            <Label className="flex items-center gap-2">
              {t("store:store.hero.changeEvery")}
              <Input type="number" min={2} max={60} className="w-20" value={d.secs} onChange={(e) => patch({ secs: e.target.value })} />
              {t("store:store.hero.seconds")}
            </Label>
          }
          contentClassName="flex flex-col gap-4"
        >
          <div aria-label={t("store:shared.livePreview")} className="relative flex h-[220px] flex-col justify-center gap-2.5 overflow-hidden rounded-2xl px-9 text-white" style={{ background: pv.bg }}>
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
                  <span className="text-xs font-normal opacity-80">{s.enabled ? t("store:store.hero.slideShowing", { n: i + 1 }) : t("store:store.hero.slideHidden", { n: i + 1 })}</span>
                  <span className="truncate">{s.title || t("store:shared.untitled")}</span>
                </span>
              </Button>
            ))}
            <Button type="button" variant="outline" className="h-auto self-stretch"
              onClick={() => { patch({ slides: [...d.slides, { id: `aura-${Date.now().toString(36)}`, imagePath: "", tag: "", title: "New slide", subtitle: "", cta: "Shop now", link: "/shop", gradient: OVERLAYS[0][1], enabled: true }] }); setCur(d.slides.length) }}>
              {t("store:shared.addSlide")}
            </Button>
          </div>
        </SectionCard>

        <aside className="min-w-0 flex-[2]">
        <SectionCard
          title={c ? t("store:store.hero.editSlide", { n: idx + 1 }) : undefined}
          actions={c ? <span className="flex items-center gap-2 text-sm font-medium">{t("store:store.hero.showing")}<Switch on={c.enabled} label={t("store:store.hero.slideEnabled")} onClick={() => patchSlide({ enabled: !c.enabled })} /></span> : undefined}
          contentClassName="flex flex-col gap-4"
        >
          {!c ? (
            <EmptyState title={t("store:shared.noSlides")} description={t("store:store.hero.emptyHint")} className="p-4 md:p-6" />
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{t("store:store.hero.image")}</p>
                <Input id="slide-image" type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = "" }} />
                <EmptyState
                  bordered
                  icon={ImageUp}
                  title={c.imagePath ? t("store:store.hero.imageSet") : t("store:store.hero.noImage")}
                  description={t("store:store.hero.imageSpec")}
                  className="border-dashed p-4 md:p-6"
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button asChild variant="outline" size="sm" aria-disabled={uploading || undefined} className={cn("cursor-pointer", uploading && "pointer-events-none opacity-50")}>
                        <Label htmlFor="slide-image">{uploading ? t("store:shared.uploading") : c.imagePath ? t("store:shared.changeSlideImage") : t("store:store.hero.clickUpload")}</Label>
                      </Button>
                      {c.imagePath && <Button type="button" variant="ghost" size="sm" onClick={() => patchSlide({ imagePath: "" })}>{t("store:shared.removeImage")}</Button>}
                    </div>
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={t("store:store.hero.badge")} htmlFor="slide-tag" className="min-w-0"><Input id="slide-tag" type="text" className="w-full" value={c.tag} onChange={(e) => patchSlide({ tag: e.target.value })} /></FormField>
                <FormField label={t("store:store.hero.buttonText")} htmlFor="slide-cta" className="min-w-0"><Input id="slide-cta" type="text" className="w-full" value={c.cta} onChange={(e) => patchSlide({ cta: e.target.value })} /></FormField>
              </div>
              <FormField label={t("store:store.hero.headline")} htmlFor="slide-title"><Input id="slide-title" type="text" className="w-full" value={c.title} onChange={(e) => patchSlide({ title: e.target.value })} /></FormField>
              <FormField label={t("store:store.hero.subtitle")} htmlFor="slide-subtitle"><Textarea id="slide-subtitle" rows={2} className="w-full" value={c.subtitle} onChange={(e) => patchSlide({ subtitle: e.target.value })} /></FormField>
              <FormField label={t("store:store.hero.buttonGoesTo")} htmlFor="slide-link" className="min-w-0">
                <Select value={c.link || undefined} onValueChange={(v) => patchSlide({ link: v })}>
                  <SelectTrigger id="slide-link" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup><SelectLabel>{t("store:store.links.pages")}</SelectLabel>{PAGES.map(([v, l]) => <SelectItem key={v} value={v}>{t("store:store.links.withPath", { label: t(l), path: v })}</SelectItem>)}</SelectGroup>
                    {linkOptions.cats.length > 0 && <SelectGroup><SelectLabel>{t("store:store.links.category")}</SelectLabel>{linkOptions.cats.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectGroup>}
                    {linkOptions.prods.length > 0 && <SelectGroup><SelectLabel>{t("store:store.links.product")}</SelectLabel>{linkOptions.prods.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectGroup>}
                    {slideLink && !knownLinks.has(slideLink) && <SelectGroup><SelectLabel>{t("store:store.links.current")}</SelectLabel><SelectItem value={slideLink}>{slideLink}</SelectItem></SelectGroup>}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{t("store:store.hero.overlay")}</p>
                <div role="group" aria-label={t("store:store.hero.overlayGroup")} className="flex flex-wrap gap-1.5">
                  {OVERLAYS.map(([l, g]) => (
                    <Button key={l} type="button" size="sm" aria-pressed={c.gradient === g} onClick={() => patchSlide({ gradient: g })}
                      variant={c.gradient === g ? "default" : "outline"}>{t(l)}</Button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between gap-2">
                <Button type="button" variant="destructive"
                  onClick={() => { if (window.confirm(t("store:store.hero.confirmDelete", { n: idx + 1 }))) { patch({ slides: d.slides.filter((_, i) => i !== idx) }); setCur(0) } }}>
                  {t("store:store.hero.deleteSlide")}
                </Button>
                <Button type="button" variant="outline" disabled={idx === 0}
                  onClick={() => { const a = d.slides.slice(); [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; patch({ slides: a }); setCur(idx - 1) }}>{t("store:store.hero.moveEarlier")}</Button>
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
        hide={TEMPLATE_HIDDEN_SECTIONS[d.themePreset]}
      />

      {(
        <SectionCard
          id="wishlist"
          aria-label={t("store:store.wishlist.title")}
          className="scroll-mt-4"
          title={t("store:store.wishlist.title")}
          description={t("store:store.wishlist.description")}
          actions={canClearWishlist ? (
            <Button type="button" variant="destructive" disabled={clearing || wlLoading} onClick={clearWishlist}>
              {clearing ? t("store:store.wishlist.clearing") : t("store:store.wishlist.clear")}
            </Button>
          ) : (
            <WithTooltip content={t("store:store.wishlist.noPermClear")}>
              <span tabIndex={0}><Button type="button" variant="destructive" disabled>{t("store:store.wishlist.clear")}</Button></span>
            </WithTooltip>
          )}
          contentClassName="flex flex-col gap-4"
        >
          {!canViewWishlist && <p className="text-sm text-muted-foreground">{t("store:store.wishlist.noPermView")}</p>}
          {canViewWishlist && wlError && <Alert variant="destructive"><AlertDescription>{wlError}</AlertDescription></Alert>}
          {wlLoading ? (
            <div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : wl ? (
            <>
              <StatsCards stats={[
                { label: t("store:store.wishlist.totalItems"), value: wl.summary.totalItems.toLocaleString(localeTag(i18n.language)), icon: <Heart className="size-4" />, color: "red" },
                { label: t("store:store.wishlist.customersWith"), value: wl.summary.uniqueCustomers.toLocaleString(localeTag(i18n.language)), icon: <Users className="size-4" />, color: "blue" },
                { label: t("store:store.wishlist.uniqueProducts"), value: wl.summary.uniqueProducts.toLocaleString(localeTag(i18n.language)), icon: <Package className="size-4" />, color: "purple" },
              ]} />
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <h3 className="text-sm font-bold">{t("store:store.wishlist.topProducts")}</h3>
                  {wl.topProducts.length === 0 && <p className="text-sm text-muted-foreground">{t("store:store.wishlist.noData")}</p>}
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
                  <h3 className="text-sm font-bold">{t("store:store.wishlist.topCustomers")}</h3>
                  {wl.topCustomers.length === 0 && <p className="text-sm text-muted-foreground">{t("store:store.wishlist.noData")}</p>}
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
                <h3 className="flex items-center gap-2 text-sm font-bold"><TrendingUp className="size-4 text-muted-foreground" />{t("store:store.wishlist.daily")}</h3>
                {trend.length === 0 && <p className="text-sm text-muted-foreground">{t("store:store.wishlist.noActivity")}</p>}
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
        <span className={cn("text-sm", err ? "text-destructive" : "text-muted-foreground")}>{err || (dirty ? t("store:shared.unsaved") : t("store:shared.allSaved"))}</span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => { setD(saved); setErr(""); setCur(0); toast.success(t("store:shared.changesDiscarded")) }}>{t("store:shared.discard")}</Button>
          <Button type="button" disabled={!dirty || saving || uploading} onClick={save}>
            {saving ? t("common:actions.saving") : t("common:actions.saveChanges")}
          </Button>
        </div>
      </Card>
    </div>
  )
}
