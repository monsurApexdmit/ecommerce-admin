"use client"

import { useCallback, useEffect, useState } from "react"
import { Globe } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { settingsApi, resolveStorageUrl, type AuraShopHeroSlide } from "@/lib/settingsApi"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

const TYPES = ["Retail", "Wholesale", "Manufacturing", "Service", "Restaurant", "Other"]
const PRESETS: [string, string][] = [
  ["Primary", "from-primary/80 via-primary/40 to-transparent"],
  ["Accent", "from-accent/70 via-accent/30 to-transparent"],
  ["Dark", "from-foreground/70 via-foreground/30 to-transparent"],
]
const DEFAULT_SLIDES: Slide[] = [
  { tag: "New Collection 2026", title: "Discover Products That Define Your Style", subtitle: "Curated selections across fashion, electronics, health & more — all in one place.", cta: "Explore Now", link: "/shop", gradient: PRESETS[0][1] },
  { tag: "Farm Fresh", title: "Fresh Grocery Delivered in 30 Minutes", subtitle: "Handpicked organic fruits, vegetables, and daily essentials at your doorstep.", cta: "Order Fresh", link: "/shop?category=grocery", gradient: PRESETS[1][1] },
  { tag: "Wellness Hub", title: "Your Health, Our Priority", subtitle: "Shop vitamins, supplements, and medical essentials with certified quality.", cta: "Shop Health", link: "/shop?category=health", gradient: PRESETS[2][1] },
].map((x, i) => ({ ...x, id: `aura-slide-${i + 1}`, imagePath: "", enabled: true }))

type Slide = Required<Pick<AuraShopHeroSlide, "id" | "imagePath" | "tag" | "title" | "subtitle" | "cta" | "link" | "gradient" | "enabled">>

interface Form {
  name: string
  type: string
  reg: string
  gst: string
  web: string
  fb: string
  ig: string
  tw: string
  auto: string
  slides: Slide[]
}

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const textarea = "w-full resize-y rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm font-normal outline-none focus-visible:border-dash-accent"
const label = "flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold"
const outlineBtn = "inline-flex h-11 items-center justify-center rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft disabled:opacity-50"
const smBtn = "inline-flex h-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card px-3 text-[13px] font-semibold hover:bg-dash-neutral-soft disabled:opacity-40"
const card = "flex flex-col gap-4 rounded-[14px] border border-dash-border bg-dash-card p-5"

const S = (v: unknown) => (typeof v === "string" ? v : "")
const URLRE = /^https?:\/\/[^\s/$.?#][^\s]*$/i

const normalize = (business: any): Form => {
  const hero = business?.auraShopHero ?? business?.aura_shop_hero
  const social = business?.socialLinks ?? business?.social_links ?? {}
  const rawSlides: any[] | null = Array.isArray(hero?.slides) ? hero.slides : null
  const slides: Slide[] = rawSlides
    ? rawSlides.map((x, i) => ({
        id: S(x.id) || `aura-slide-${i + 1}`,
        imagePath: S(x.imagePath),
        tag: S(x.tag),
        title: S(x.title),
        subtitle: S(x.subtitle),
        cta: S(x.cta),
        link: S(x.link),
        gradient: S(x.gradient),
        enabled: x.enabled !== false,
      }))
    : DEFAULT_SLIDES.map((x) => ({ ...x }))
  const ms = Number(hero?.autoplayMs)
  return {
    name: S(business?.businessName),
    type: TYPES.includes(business?.businessType) ? business.businessType : "Retail",
    reg: S(business?.registrationNumber),
    gst: S(business?.gstNumber),
    web: S(business?.website),
    fb: S(social.facebook),
    ig: S(social.instagram),
    tw: S(social.twitter),
    auto: String(ms > 0 ? Math.round(ms) : 6000),
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

export default function AuraShopSettingsPage() {
  const blocked = useModuleGuard("Aura Shop")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<number | null>(null)
  const [saved, setSaved] = useState<Form | null>(null)
  const [d, setD] = useState<Form | null>(null)
  const [err, setErr] = useState("")
  const [cur, setCur] = useState<number | undefined>()

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await settingsApi.getAll()
      const form = normalize(res.data.business || {})
      setSaved(form)
      setD(form)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load Aura Shop settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (blocked) return blocked

  const shell = `${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`
  const header = (
    <div>
      <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Aura Shop</h1>
      <p className="mt-1 text-sm text-dash-muted">Manage the Aura Shop storefront homepage hero slider.</p>
    </div>
  )

  if (loading || !d || !saved) {
    return (
      <div className={shell}>
        {header}
        <Skeleton className="h-64 w-full rounded-[14px]" />
        <Skeleton className="h-96 w-full rounded-[14px]" />
      </div>
    )
  }

  const dirty = JSON.stringify(d) !== JSON.stringify(saved)
  const patch = (p: Partial<Form>) => {
    setD({ ...d, ...p })
    setErr("")
  }
  const patchSlide = (i: number, p: Partial<Slide>) => patch({ slides: d.slides.map((x, k) => (k === i ? { ...x, ...p } : x)) })
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= d.slides.length) return
    const a = d.slides.slice()
    ;[a[i], a[j]] = [a[j], a[i]]
    patch({ slides: a })
  }

  const enabledIdx = d.slides.map((_, i) => i).filter((i) => d.slides[i].enabled)
  const curIdx = cur !== undefined && enabledIdx.includes(cur) ? cur : enabledIdx[0] ?? -1
  const c = curIdx >= 0 ? d.slides[curIdx] : null
  const pv = c
    ? { tag: c.tag || " ", title: c.title || "(untitled)", sub: c.subtitle, cta: c.cta || "Learn more", bg: c.imagePath ? imgBg(c.imagePath) : "#2A3858", over: overlay(c.gradient), note: `PREVIEW · Slide ${curIdx + 1}${c.imagePath ? "" : " · no image"}` }
    : { tag: "Aura Shop", title: d.slides.length ? "All slides are disabled" : "No slides yet", sub: "Enable or add a slide to show the hero slider.", cta: "Explore", bg: "#2A3858", over: "none", note: "PREVIEW" }

  const upload = async (i: number, file?: File) => {
    if (!file) return
    if (!/^image\//.test(file.type)) return toast.error("Please choose an image file (PNG, JPG, WEBP).")
    if (file.size > 10 * 1024 * 1024) return toast.error("Image must be 10MB or smaller.")
    try {
      setUploading(i)
      const res = await settingsApi.uploadStorefrontImage(file)
      setD((cd) => (cd ? { ...cd, slides: cd.slides.map((x, k) => (k === i ? { ...x, imagePath: res.data.imagePath } : x)) } : cd))
      toast.success(`Slide ${i + 1} image uploaded`)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to upload storefront image")
    } finally {
      setUploading(null)
    }
  }

  const fail = (m: string) => {
    setErr(m)
    toast.error(m)
  }

  const save = async () => {
    const name = d.name.trim()
    if (!name) return fail("Business name is required.")
    if (d.web.trim() && !URLRE.test(d.web.trim())) return fail("Website must be a full URL starting with http:// or https://")
    for (const [k, l] of [["fb", "Facebook"], ["ig", "Instagram"], ["tw", "Twitter"]] as const) {
      const v = d[k].trim()
      if (v && !URLRE.test(v)) return fail(`${l} link must be a full URL starting with http(s)://`)
    }
    const ms = Number(d.auto)
    if (!/^\d+$/.test(d.auto.trim()) || ms < 2000) return fail("Autoplay interval must be a whole number of at least 2000 milliseconds.")
    for (let i = 0; i < d.slides.length; i++) {
      const x = d.slides[i]
      if (x.enabled && !x.title.trim()) return fail(`Slide ${i + 1} needs a title before it can be shown.`)
      const l = x.link.trim()
      if (l && !/^(\/|https?:\/\/)/i.test(l)) return fail(`Slide ${i + 1} button link must start with / or http(s)://`)
    }
    try {
      setSaving(true)
      await settingsApi.updateBusiness({
        businessName: name,
        businessType: d.type,
        registrationNumber: d.reg.trim(),
        gstNumber: d.gst.trim(),
        website: d.web.trim(),
        socialLinks: { facebook: d.fb.trim(), instagram: d.ig.trim(), twitter: d.tw.trim() },
        auraShopHero: {
          autoplayMs: ms,
          slides: d.slides.map((x, i) => ({ ...x, id: x.id || `aura-slide-${i + 1}`, tag: x.tag.trim(), title: x.title.trim(), subtitle: x.subtitle.trim(), cta: x.cta.trim(), link: x.link.trim(), gradient: x.gradient.trim() })),
        },
      })
      toast.success("Aura Shop settings saved successfully")
      await load()
    } catch (e: any) {
      const errors = e?.response?.data?.errors
      const first = errors ? (Object.values(errors)[0] as string[])?.[0] : undefined
      fail(first || e?.response?.data?.message || "Failed to save Aura Shop settings")
    } finally {
      setSaving(false)
    }
  }

  const text = (lbl: string, key: keyof Omit<Form, "slides" | "type">, placeholder = "") => (
    <label className={label}>
      {lbl}
      <input type="text" className={input} value={d[key]} placeholder={placeholder} onChange={(e) => patch({ [key]: e.target.value })} />
    </label>
  )

  return (
    <div className={shell}>
      {header}

      <section aria-label="Business details" className={card}>
        <div>
          <h2 className="font-dash-display text-lg font-bold">Business details</h2>
          <p className="mt-1 text-[13px] text-dash-muted">Shown on the storefront footer and contact areas.</p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {text("Business name *", "name", "e.g. Aura Retail")}
          <label className={label}>
            Business type
            <select className={cn(input, "px-2.5")} value={d.type} onChange={(e) => patch({ type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {text("Registration number", "reg")}
          {text("GST / VAT number", "gst")}
          {text("Website", "web", "https://example.com")}
          {text("Facebook", "fb", "https://facebook.com/…")}
          {text("Instagram", "ig", "https://instagram.com/…")}
          {text("Twitter / X", "tw", "https://x.com/…")}
        </div>
      </section>

      <section aria-label="Homepage hero" className={card}>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[10px] bg-dash-accent-soft text-dash-accent"><Globe className="size-5" /></span>
          <div>
            <h2 className="font-dash-display text-lg font-bold">Homepage Hero</h2>
            <p className="mt-0.5 text-[13px] text-dash-muted">Control the large slider shown on the Aura Shop landing page.</p>
          </div>
        </div>

        <label className={cn(label, "max-w-[360px]")}>
          Autoplay Interval (milliseconds)
          <input type="number" min={2000} step={500} className={input} value={d.auto} onChange={(e) => patch({ auto: e.target.value })} />
          <span className="text-xs font-normal text-dash-muted">Example: 6000 rotates slides every 6 seconds. Minimum 2000.</span>
        </label>

        <div aria-label="Live preview" className="relative flex h-[220px] flex-col justify-center gap-2.5 overflow-hidden rounded-2xl px-9 text-white" style={{ background: pv.bg }}>
          <span className="absolute inset-0" style={{ background: pv.over }} />
          <span className="relative self-start rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">{pv.tag}</span>
          <span className="relative max-w-[560px] font-dash-display text-[28px] font-bold leading-[1.1]">{pv.title}</span>
          <span className="relative max-w-[520px] text-sm opacity-90">{pv.sub}</span>
          <span className="relative flex h-10 items-center self-start rounded-[10px] bg-white px-4 text-sm font-bold text-dash-ink">{pv.cta} →</span>
          <span className="absolute right-3.5 top-3 rounded-md bg-black/35 px-2 py-[3px] text-[11px] font-bold">{pv.note}</span>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {enabledIdx.map((i) => (
              <button key={i} type="button" aria-label={`Show slide ${i + 1}`} onClick={() => setCur(i)} className="h-2 rounded-full bg-white" style={{ width: i === curIdx ? 22 : 8, opacity: i === curIdx ? 1 : 0.5 }} />
            ))}
          </div>
        </div>
        <p className="text-[13px] text-dash-muted">
          {enabledIdx.length} of {d.slides.length} slide(s) enabled · rotates every {(Number(d.auto) || 6000) / 1000}s on the storefront.
        </p>

        {d.slides.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-dash-border p-6 text-center text-sm text-dash-muted">
            No slides yet. Use “+ Add slide” to create the first hero slide.
          </div>
        )}

        <div className="flex flex-col gap-4">
          {d.slides.map((s, i) => (
            <div key={s.id + i} className="flex flex-col gap-4 rounded-xl border border-dash-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-base font-bold">Slide {i + 1}</h3>
                  <p className="mt-0.5 text-[13px] text-dash-muted">Edit image, headline, CTA, and link.</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2 text-[13px]">
                    Enabled
                    <button type="button" role="switch" aria-checked={s.enabled} aria-label="Slide enabled" onClick={() => patchSlide(i, { enabled: !s.enabled })}
                      className={cn("flex h-5 w-9 items-center rounded-full p-0.5 transition-colors", s.enabled ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}>
                      <span className="size-4 rounded-full bg-white" />
                    </button>
                  </span>
                  <button type="button" className={cn(smBtn, "w-9 px-0")} disabled={i === 0} aria-label="Move slide up" onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className={cn(smBtn, "w-9 px-0")} disabled={i === d.slides.length - 1} aria-label="Move slide down" onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className={cn(smBtn, "text-dash-danger-fg")} onClick={() => { if (window.confirm(`Delete slide ${i + 1}? Save to apply.`)) patch({ slides: d.slides.filter((_, k) => k !== i) }) }}>Delete</button>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex max-w-[320px] flex-[1_1_240px] flex-col gap-2.5">
                  <div className="flex h-40 items-center justify-center overflow-hidden rounded-[10px] border border-dash-border bg-dash-neutral-soft text-[13px] text-dash-muted" style={s.imagePath ? { background: imgBg(s.imagePath) } : undefined}>
                    {s.imagePath ? "" : "No image uploaded"}
                  </div>
                  <label className="block cursor-pointer rounded-[10px] border-2 border-dashed border-dash-border bg-dash-neutral-soft p-3 text-center">
                    <input type="file" accept="image/*" className="sr-only" disabled={uploading !== null} onChange={(e) => { upload(i, e.target.files?.[0]); e.target.value = "" }} />
                    <span className="block text-sm font-semibold text-dash-accent">{uploading === i ? "Uploading…" : s.imagePath ? "Change slide image" : "Upload slide image"}</span>
                    <span className="block text-xs text-dash-muted">PNG, JPG, WEBP up to 10MB</span>
                  </label>
                  {s.imagePath && <button type="button" className={smBtn} onClick={() => patchSlide(i, { imagePath: "" })}>Remove image</button>}
                </div>
                <div className="grid min-w-0 flex-[999_1_360px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] content-start gap-3">
                  <label className={label}>Badge Tag<input type="text" className={input} value={s.tag} onChange={(e) => patchSlide(i, { tag: e.target.value })} /></label>
                  <label className={label}>CTA Label<input type="text" className={input} value={s.cta} onChange={(e) => patchSlide(i, { cta: e.target.value })} /></label>
                  <label className={cn(label, "col-span-full")}>Title *<textarea rows={2} className={textarea} value={s.title} onChange={(e) => patchSlide(i, { title: e.target.value })} /></label>
                  <label className={cn(label, "col-span-full")}>Subtitle<textarea rows={3} className={textarea} value={s.subtitle} onChange={(e) => patchSlide(i, { subtitle: e.target.value })} /></label>
                  <label className={label}>Button Link<input type="text" className={input} value={s.link} placeholder="/shop" onChange={(e) => patchSlide(i, { link: e.target.value })} /></label>
                  <div className={label}>
                    Overlay Gradient Classes
                    <input type="text" aria-label="Overlay Gradient Classes" className={input} value={s.gradient} onChange={(e) => patchSlide(i, { gradient: e.target.value })} />
                    <div className="flex flex-wrap gap-1.5">
                      {PRESETS.map(([l, g]) => (
                        <button key={l} type="button" onClick={() => patchSlide(i, { gradient: g })} className="h-[30px] rounded-full border border-dash-border bg-dash-card px-2.5 text-xs font-semibold hover:bg-dash-neutral-soft">{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="h-11 rounded-[10px] border-2 border-dashed border-dash-border bg-dash-neutral-soft px-4 text-sm font-semibold hover:bg-dash-border/40"
            onClick={() => patch({ slides: [...d.slides, { id: `aura-${Date.now().toString(36)}`, imagePath: "", tag: "", title: "New slide", subtitle: "", cta: "Shop now", link: "/shop", gradient: PRESETS[0][1], enabled: true }] })}>
            + Add slide
          </button>
          <button type="button" className={outlineBtn} onClick={() => { if (window.confirm("Replace all slides with the three default slides? Save to apply.")) patch({ slides: DEFAULT_SLIDES.map((x) => ({ ...x })) }) }}>
            Restore default slides
          </button>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2.5 rounded-[14px] border border-dash-border bg-dash-card px-4 py-3.5 shadow-[0_-6px_20px_rgba(14,21,37,0.06)]">
        <span className={cn("text-[13px]", err ? "text-dash-danger-fg" : "text-dash-muted")}>{err || (dirty ? "You have unsaved changes." : "All changes saved.")}</span>
        <div className="ml-auto flex gap-2">
          <button type="button" className={outlineBtn} disabled={!dirty || saving} onClick={() => { setD(saved); setErr(""); setCur(undefined); toast.success("Changes discarded") }}>Discard</button>
          <button type="button" className="h-11 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-50" disabled={!dirty || saving || uploading !== null} onClick={save}>
            {saving ? "Saving…" : "Save Aura Shop Settings"}
          </button>
        </div>
      </div>
    </div>
  )
}
