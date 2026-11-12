"use client"

import { useCallback, useEffect, useState } from "react"
import { Globe } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { settingsApi, resolveStorageUrl, type AuraShopHeroSlide } from "@/lib/settingsApi"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { SlideDots } from "@/components/common/SlideDots"
import { EmptyState } from "@/components/common/EmptyState"
import { WithTooltip } from "@/components/common/WithTooltip"

// Saved as these English values; labels translated at render
const TYPES = ["Retail", "Wholesale", "Manufacturing", "Service", "Restaurant", "Other"]
const TYPE_LABEL: Record<string, ParseKeys<["store"]>> = {
  Retail: "store:shared.bizTypes.Retail", Wholesale: "store:shared.bizTypes.Wholesale", Manufacturing: "store:shared.bizTypes.Manufacturing",
  Service: "store:shared.bizTypes.Service", Restaurant: "store:shared.bizTypes.Restaurant", Other: "store:shared.bizTypes.Other",
}
const PRESETS: [ParseKeys<["store"]>, string][] = [
  ["store:settings.aura.presets.primary", "from-primary/80 via-primary/40 to-transparent"],
  ["store:settings.aura.presets.accent", "from-accent/70 via-accent/30 to-transparent"],
  ["store:settings.aura.presets.dark", "from-foreground/70 via-foreground/30 to-transparent"],
]
// Built-in starter slides: storefront content the owner edits and saves, so not translated
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
  const { t } = useTranslation(["store", "common"])
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
      toast.error(e?.response?.data?.message || t("store:settings.aura.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (blocked) return blocked

  const shell = "flex flex-col gap-5"
  const header = <PageHeader title={t("store:settings.aura.title")} description={t("store:settings.aura.description")} />

  if (loading || !d || !saved) {
    return (
      <div className={shell}>
        {header}
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
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
    ? { tag: c.tag || " ", title: c.title || t("store:shared.untitled"), sub: c.subtitle, cta: c.cta || t("store:shared.learnMore"), bg: c.imagePath ? imgBg(c.imagePath) : "#2A3858", over: overlay(c.gradient), note: c.imagePath ? t("store:settings.aura.previewSlide", { n: curIdx + 1 }) : t("store:settings.aura.previewSlideNoImage", { n: curIdx + 1 }) }
    : { tag: "Aura Shop", title: d.slides.length ? t("store:settings.aura.allDisabled") : t("store:shared.noSlides"), sub: t("store:settings.aura.enableHint"), cta: t("store:settings.aura.explore"), bg: "#2A3858", over: "none", note: t("store:shared.preview") }

  const upload = async (i: number, file?: File) => {
    if (!file) return
    if (!/^image\//.test(file.type)) return toast.error(t("store:shared.chooseImage"))
    if (file.size > 10 * 1024 * 1024) return toast.error(t("store:shared.imageTooBig"))
    try {
      setUploading(i)
      const res = await settingsApi.uploadStorefrontImage(file)
      setD((cd) => (cd ? { ...cd, slides: cd.slides.map((x, k) => (k === i ? { ...x, imagePath: res.data.imagePath } : x)) } : cd))
      toast.success(t("store:shared.slideImageUploaded", { n: i + 1 }))
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("store:shared.uploadFailed"))
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
    if (!name) return fail(t("store:settings.aura.errors.name"))
    if (d.web.trim() && !URLRE.test(d.web.trim())) return fail(t("store:settings.aura.errors.website"))
    for (const [k, l] of [["fb", "Facebook"], ["ig", "Instagram"], ["tw", "Twitter"]] as const) {
      const v = d[k].trim()
      if (v && !URLRE.test(v)) return fail(t("store:shared.socialUrl", { name: l }))
    }
    const ms = Number(d.auto)
    if (!/^\d+$/.test(d.auto.trim()) || ms < 2000) return fail(t("store:settings.aura.errors.autoplay"))
    for (let i = 0; i < d.slides.length; i++) {
      const x = d.slides[i]
      if (x.enabled && !x.title.trim()) return fail(t("store:settings.aura.errors.slideTitle", { n: i + 1 }))
      const l = x.link.trim()
      if (l && !/^(\/|https?:\/\/)/i.test(l)) return fail(t("store:settings.aura.errors.slideLink", { n: i + 1 }))
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
      toast.success(t("store:settings.aura.saved"))
      await load()
    } catch (e: any) {
      const errors = e?.response?.data?.errors
      const first = errors ? (Object.values(errors)[0] as string[])?.[0] : undefined
      fail(first || e?.response?.data?.message || t("store:settings.aura.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const text = (lbl: string, key: keyof Omit<Form, "slides" | "type">, placeholder = "") => (
    <FormField label={lbl} htmlFor={`aura-${key}`} className="min-w-0">
      <Input id={`aura-${key}`} type="text" value={d[key]} placeholder={placeholder} onChange={(e) => patch({ [key]: e.target.value })} />
    </FormField>
  )

  return (
    <div className={shell}>
      {header}

      <SectionCard aria-label={t("store:settings.aura.details")} title={t("store:settings.aura.details")} description={t("store:settings.aura.detailsSub")}>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {text(t("store:settings.aura.name"), "name", t("store:settings.aura.namePh"))}
          <FormField label={t("store:shared.businessType")} htmlFor="aura-type" className="min-w-0">
            <Select value={String(d.type)} onValueChange={(val) => patch({ type: val })}>
              <SelectTrigger id="aura-type" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPES.map((ty) => <SelectItem key={ty} value={String(ty)}>{TYPE_LABEL[ty] ? t(TYPE_LABEL[ty]) : ty}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          {text(t("store:shared.registration"), "reg")}
          {text(t("store:settings.aura.gst"), "gst")}
          {text(t("store:shared.website"), "web", "https://example.com")}
          {text("Facebook", "fb", "https://facebook.com/…")}
          {text("Instagram", "ig", "https://instagram.com/…")}
          {text(t("store:settings.aura.twitter"), "tw", "https://x.com/…")}
        </div>
      </SectionCard>

      <SectionCard
        aria-label={t("store:settings.aura.heroAria")}
        title={<span className="flex items-center gap-2"><Globe className="size-5 text-muted-foreground" />{t("store:settings.aura.heroTitle")}</span>}
        description={t("store:settings.aura.heroSub")}
        contentClassName="flex flex-col gap-4"
      >
        <FormField label={t("store:settings.aura.autoplay")} htmlFor="aura-auto" description={t("store:settings.aura.autoplayHelp")} className="max-w-[360px]">
          <Input id="aura-auto" type="number" min={2000} step={500} value={d.auto} onChange={(e) => patch({ auto: e.target.value })} />
        </FormField>

        <div aria-label={t("store:shared.livePreview")} className="relative flex h-[220px] flex-col justify-center gap-2.5 overflow-hidden rounded-2xl px-9 text-white" style={{ background: pv.bg }}>
          <span className="absolute inset-0" style={{ background: pv.over }} />
          <Badge variant="secondary" className="relative self-start">{pv.tag}</Badge>
          <span className="relative max-w-[560px] text-[28px] font-bold leading-[1.1]">{pv.title}</span>
          <span className="relative max-w-[520px] text-sm opacity-90">{pv.sub}</span>
          <Button type="button" variant="secondary" tabIndex={-1} aria-hidden="true" className="pointer-events-none relative self-start">{pv.cta} →</Button>
          <Badge variant="secondary" className="absolute right-3.5 top-3">{pv.note}</Badge>
          <SlideDots tone="light" indices={enabledIdx} current={curIdx} onSelect={setCur} className="absolute bottom-3 left-1/2 -translate-x-1/2" />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("store:settings.aura.summary", { enabled: enabledIdx.length, total: d.slides.length, secs: (Number(d.auto) || 6000) / 1000 })}
        </p>

        {d.slides.length === 0 && (
          <EmptyState bordered title={t("store:shared.noSlides")} description={t("store:settings.aura.emptyHint")} />
        )}

        <div className="flex flex-col gap-4">
          {d.slides.map((s, i) => (
            <Card key={s.id + i} className="gap-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-base font-semibold">{t("store:settings.aura.slide", { n: i + 1 })}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t("store:settings.aura.slideSub")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <FormField orientation="horizontal" label={t("store:settings.aura.enabled")} htmlFor={`slide-${i}-enabled`} className="w-auto gap-2">
                    <Switch id={`slide-${i}-enabled`} checked={s.enabled} aria-label={t("store:settings.aura.slideEnabled")} onCheckedChange={() => patchSlide(i, { enabled: !s.enabled })} />
                  </FormField>
                  <WithTooltip content={t("store:settings.aura.moveUp")}><Button type="button" variant="outline" size="icon-sm" disabled={i === 0} aria-label={t("store:settings.aura.moveUp")} onClick={() => move(i, -1)}>↑</Button></WithTooltip>
                  <WithTooltip content={t("store:settings.aura.moveDown")}><Button type="button" variant="outline" size="icon-sm" disabled={i === d.slides.length - 1} aria-label={t("store:settings.aura.moveDown")} onClick={() => move(i, 1)}>↓</Button></WithTooltip>
                  <Button type="button" variant="destructive" size="sm" onClick={() => { if (window.confirm(t("store:settings.aura.confirmDelete", { n: i + 1 }))) patch({ slides: d.slides.filter((_, k) => k !== i) }) }}>{t("common:actions.delete")}</Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex max-w-[320px] flex-[1_1_240px] flex-col gap-2.5">
                  <div className="flex h-40 items-center justify-center overflow-hidden rounded-md border bg-muted text-sm text-muted-foreground" style={s.imagePath ? { background: imgBg(s.imagePath) } : undefined}>
                    {s.imagePath ? "" : t("store:settings.aura.noImage")}
                  </div>
                  <Label className="cursor-pointer">
                    <Input type="file" accept="image/*" className="sr-only" disabled={uploading !== null} onChange={(e) => { upload(i, e.target.files?.[0]); e.target.value = "" }} />
                    <span className="block text-sm font-semibold text-primary">{uploading === i ? t("store:shared.uploading") : s.imagePath ? t("store:shared.changeSlideImage") : t("store:settings.aura.uploadImage")}</span>
                    <span className="block text-xs text-muted-foreground">{t("store:settings.aura.imageSpec")}</span>
                  </Label>
                  {s.imagePath && <Button type="button" variant="outline" size="sm" onClick={() => patchSlide(i, { imagePath: "" })}>{t("store:shared.removeImage")}</Button>}
                </div>
                <div className="grid min-w-0 flex-[999_1_360px] grid-cols-[repeat(auto-fit,minmax(240px,1fr))] content-start gap-3">
                  <FormField label={t("store:settings.aura.badge")} htmlFor={`slide-${i}-tag`} className="min-w-0"><Input id={`slide-${i}-tag`} type="text" value={s.tag} onChange={(e) => patchSlide(i, { tag: e.target.value })} /></FormField>
                  <FormField label={t("store:settings.aura.cta")} htmlFor={`slide-${i}-cta`} className="min-w-0"><Input id={`slide-${i}-cta`} type="text" value={s.cta} onChange={(e) => patchSlide(i, { cta: e.target.value })} /></FormField>
                  <FormField label={t("store:settings.aura.titleField")} htmlFor={`slide-${i}-title`} className="col-span-full min-w-0"><Textarea id={`slide-${i}-title`} rows={2} value={s.title} onChange={(e) => patchSlide(i, { title: e.target.value })} /></FormField>
                  <FormField label={t("store:settings.aura.subtitle")} htmlFor={`slide-${i}-subtitle`} className="col-span-full min-w-0"><Textarea id={`slide-${i}-subtitle`} rows={3} value={s.subtitle} onChange={(e) => patchSlide(i, { subtitle: e.target.value })} /></FormField>
                  <FormField label={t("store:settings.aura.link")} htmlFor={`slide-${i}-link`} className="min-w-0"><Input id={`slide-${i}-link`} type="text" value={s.link} placeholder="/shop" onChange={(e) => patchSlide(i, { link: e.target.value })} /></FormField>
                  <FormField label={t("store:settings.aura.gradient")} htmlFor={`slide-${i}-gradient`} className="min-w-0">
                    <Input id={`slide-${i}-gradient`} type="text" value={s.gradient} onChange={(e) => patchSlide(i, { gradient: e.target.value })} />
                    <div className="flex flex-wrap gap-1.5">
                      {PRESETS.map(([l, g]) => (
                        <Button key={l} type="button" variant="outline" size="sm" onClick={() => patchSlide(i, { gradient: g })}>{t(l)}</Button>
                      ))}
                    </div>
                  </FormField>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline"
            onClick={() => patch({ slides: [...d.slides, { id: `aura-${Date.now().toString(36)}`, imagePath: "", tag: "", title: "New slide", subtitle: "", cta: "Shop now", link: "/shop", gradient: PRESETS[0][1], enabled: true }] })}>
            {t("store:shared.addSlide")}
          </Button>
          <Button type="button" variant="outline" onClick={() => { if (window.confirm(t("store:settings.aura.confirmRestore"))) patch({ slides: DEFAULT_SLIDES.map((x) => ({ ...x })) }) }}>
            {t("store:settings.aura.restore")}
          </Button>
        </div>
      </SectionCard>

      <Card className="sticky bottom-0 z-10 flex-row flex-wrap items-center gap-2.5 px-4 py-3">
        <span className={cn("text-sm", err ? "text-destructive" : "text-muted-foreground")}>{err || (dirty ? t("store:shared.unsaved") : t("store:shared.allSaved"))}</span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => { setD(saved); setErr(""); setCur(undefined); toast.success(t("store:shared.changesDiscarded")) }}>{t("store:shared.discard")}</Button>
          <Button type="button" disabled={!dirty || saving || uploading !== null} onClick={save}>
            {saving ? t("common:actions.saving") : t("store:settings.aura.save")}
          </Button>
        </div>
      </Card>
    </div>
  )
}
