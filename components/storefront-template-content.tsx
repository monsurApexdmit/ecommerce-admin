"use client"

import { Plus, Star } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/common/FormField"
import { SectionCard } from "@/components/common/SectionCard"
import { ImageSlot, LinkSelect, ModeRow, type LinkGroup, type SectionMode, type StoreT } from "@/components/storefront-homepage-sections"
import type { TemplateContent, TemplatePromoTile } from "@/lib/settingsApi"
import { STORE_THEMES, TEMPLATE_BLOCKS, type StoreThemeId, type TemplateBlock } from "@/lib/storeThemes"

type Tile = Omit<TemplatePromoTile, "imagePath"> & { imagePath: string }
type Stat = { value: string; label: string }
type Review = { name: string; text: string; rating: number; note: string }

/** One mode per block: auto = the template's own content, custom = the content below, hidden = not shown. */
export interface TemplateContentForm {
  announcement: { mode: SectionMode; text: string; code: string; link: string }
  headerNote: { mode: SectionMode; label: string; text: string }
  promoTiles: { mode: SectionMode; items: Tile[] }
  stats: { mode: SectionMode; items: Stat[] }
  testimonials: { mode: SectionMode; title: string; items: Review[] }
  newsletter: { mode: SectionMode; title: string; text: string }
  cta: { mode: SectionMode; tag: string; title: string; text: string; cta: string; link: string; cta2: string; link2: string; imagePath: string }
}

const MAX_TILES = 5
const MAX_STATS = 5
const MAX_REVIEWS = 6

const S = (v: unknown) => (typeof v === "string" ? v : "")
const uid = () => `tile-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const modeOf = (b: { enabled?: boolean } | null | undefined): SectionMode => (!b ? "auto" : b.enabled === false ? "hidden" : "custom")
const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as T[]) : [])

// Starting content when the owner switches a block to Custom (close to what the templates show by default).
// Storefront content the owner edits and saves, so it is not translated here.
const DEFAULTS: TemplateContentForm = {
  announcement: { mode: "auto", text: "Welcome offer: 15% off your first order", code: "WELCOME15", link: "/shop" },
  headerNote: { mode: "auto", label: "Delivery", text: "Same day in the city" },
  promoTiles: {
    mode: "auto",
    items: [
      { id: "tile-1", tag: "New season", title: "New arrivals", text: "Fresh picks just for you", cta: "Shop now", link: "/shop", imagePath: "" },
      { id: "tile-2", tag: "Limited time", title: "Today's deals", text: "Up to 30% off", cta: "See deals", link: "/deals", imagePath: "" },
      { id: "tile-3", tag: "Popular", title: "Best sellers", text: "What everyone is buying", cta: "Shop now", link: "/shop", imagePath: "" },
    ],
  },
  stats: {
    mode: "auto",
    items: [
      { value: "500+", label: "Products available" },
      { value: "10k+", label: "Happy customers" },
      { value: "4.8/5", label: "Customer rating" },
      { value: "100%", label: "Secure shopping" },
    ],
  },
  // No sample reviews: only real ones the owner types are shown
  testimonials: { mode: "auto", title: "What our customers say", items: [{ name: "", text: "", rating: 5, note: "" }] },
  newsletter: { mode: "auto", title: "Get our offers first", text: "New arrivals and deals straight to your inbox. No spam." },
  cta: {
    mode: "auto", tag: "Get in touch", title: "Looking for something special?", text: "Tell us what you need and our team will help you find it.",
    cta: "Contact us", link: "/contact", cta2: "Browse all", link2: "/shop", imagePath: "",
  },
}

export function templateContentFromSettings(raw: TemplateContent | undefined | null): TemplateContentForm {
  const a = raw?.announcement, h = raw?.headerNote, p = raw?.promoTiles, s = raw?.stats, t = raw?.testimonials, n = raw?.newsletter, c = raw?.cta
  return {
    announcement: a ? { mode: modeOf(a), text: S(a.text), code: S(a.code), link: S(a.link) } : DEFAULTS.announcement,
    headerNote: h ? { mode: modeOf(h), label: S(h.label), text: S(h.text) } : DEFAULTS.headerNote,
    promoTiles: p
      ? {
          mode: modeOf(p),
          items: list<TemplatePromoTile>(p.items).map((x, i) => ({
            id: S(x.id) || `tile-${i + 1}`, tag: S(x.tag), title: S(x.title), text: S(x.text), cta: S(x.cta), link: S(x.link) || "/shop", imagePath: S(x.imagePath),
          })),
        }
      : DEFAULTS.promoTiles,
    stats: s ? { mode: modeOf(s), items: list<Stat>(s.items).map((x) => ({ value: S(x.value), label: S(x.label) })) } : DEFAULTS.stats,
    testimonials: t
      ? {
          mode: modeOf(t), title: S(t.title),
          items: list<Review>(t.items).map((x) => ({ name: S(x.name), text: S(x.text), rating: Math.min(5, Math.max(1, Number(x.rating) || 5)), note: S(x.note) })),
        }
      : DEFAULTS.testimonials,
    newsletter: n ? { mode: modeOf(n), title: S(n.title), text: S(n.text) } : DEFAULTS.newsletter,
    cta: c
      ? { mode: modeOf(c), tag: S(c.tag), title: S(c.title), text: S(c.text), cta: S(c.cta), link: S(c.link) || "/shop", cta2: S(c.cta2), link2: S(c.link2), imagePath: S(c.imagePath) }
      : DEFAULTS.cta,
  }
}

/** Automatic blocks are sent as null so the template keeps its own content. */
export function templateContentToSettings(v: TemplateContentForm): TemplateContent {
  const wrap = <T extends object>(mode: SectionMode, body: () => T) => (mode === "auto" ? null : { enabled: mode !== "hidden", ...body() })
  return {
    announcement: wrap(v.announcement.mode, () => ({ text: v.announcement.text.trim(), code: v.announcement.code.trim(), link: v.announcement.link.trim() })),
    headerNote: wrap(v.headerNote.mode, () => ({ label: v.headerNote.label.trim(), text: v.headerNote.text.trim() })),
    promoTiles: wrap(v.promoTiles.mode, () => ({
      items: v.promoTiles.items.map((x) => ({ ...x, tag: x.tag.trim(), title: x.title.trim(), text: x.text.trim(), cta: x.cta.trim(), link: x.link.trim() || "/shop", imagePath: x.imagePath || null })),
    })),
    stats: wrap(v.stats.mode, () => ({ items: v.stats.items.map((x) => ({ value: x.value.trim(), label: x.label.trim() })) })),
    testimonials: wrap(v.testimonials.mode, () => ({
      title: v.testimonials.title.trim(),
      items: v.testimonials.items.map((x) => ({ name: x.name.trim(), text: x.text.trim(), rating: x.rating, note: x.note.trim() })),
    })),
    newsletter: wrap(v.newsletter.mode, () => ({ title: v.newsletter.title.trim(), text: v.newsletter.text.trim() })),
    cta: wrap(v.cta.mode, () => ({
      tag: v.cta.tag.trim(), title: v.cta.title.trim(), text: v.cta.text.trim(), cta: v.cta.cta.trim(), link: v.cta.link.trim() || "/shop",
      cta2: v.cta.cta2.trim(), link2: v.cta.link2.trim(), imagePath: v.cta.imagePath || null,
    })),
  }
}

/** First problem in the blocks the chosen template uses, or null. */
export function validateTemplateContent(v: TemplateContentForm, template: StoreThemeId, t: StoreT): string | null {
  const uses = new Set(TEMPLATE_BLOCKS[template].blocks)
  const custom = (b: TemplateBlock) => uses.has(b) && v[b].mode === "custom"
  if (custom("announcement") && !v.announcement.text.trim()) return t("store:content.errors.announcement")
  if (custom("headerNote") && !v.headerNote.text.trim()) return t("store:content.errors.headerNote")
  if (custom("promoTiles")) {
    if (v.promoTiles.items.length === 0) return t("store:content.errors.promoTilesNone")
    const i = v.promoTiles.items.findIndex((x) => !x.title.trim())
    if (i >= 0) return t("store:content.errors.promoTileTitle", { n: i + 1 })
  }
  if (custom("stats")) {
    if (v.stats.items.length === 0) return t("store:content.errors.statsNone")
    const i = v.stats.items.findIndex((x) => !x.value.trim())
    if (i >= 0) return t("store:content.errors.statValue", { n: i + 1 })
  }
  if (custom("testimonials")) {
    if (v.testimonials.items.length === 0) return t("store:content.errors.reviewsNone")
    const i = v.testimonials.items.findIndex((x) => !x.text.trim())
    if (i >= 0) return t("store:content.errors.reviewText", { n: i + 1 })
  }
  if (custom("newsletter") && !v.newsletter.title.trim()) return t("store:content.errors.newsletter")
  if (custom("cta") && !v.cta.title.trim()) return t("store:content.errors.cta")
  return null
}

type StoreKey = ParseKeys<["store", "common"]>

const LABEL: Record<TemplateBlock, StoreKey> = {
  announcement: "store:content.blocks.announcement",
  headerNote: "store:content.blocks.headerNote",
  promoTiles: "store:content.blocks.promoTiles",
  stats: "store:content.blocks.stats",
  testimonials: "store:content.blocks.testimonials",
  newsletter: "store:content.blocks.newsletter",
  cta: "store:content.blocks.cta",
}

const AUTO: Record<TemplateBlock, StoreKey> = {
  announcement: "store:content.auto.announcement",
  headerNote: "store:content.auto.headerNote",
  promoTiles: "store:content.auto.promoTiles",
  stats: "store:content.auto.stats",
  testimonials: "store:content.auto.testimonials",
  newsletter: "store:content.auto.newsletter",
  cta: "store:content.auto.cta",
}

interface Props {
  template: StoreThemeId
  value: TemplateContentForm
  onChange: (v: TemplateContentForm) => void
  linkGroups: LinkGroup[]
  uploading: boolean
  uploadImage: (file: File) => Promise<string | null>
}

/** Online store > Template content: blocks only some templates show (top bar, promo tiles, numbers, reviews…). */
export function TemplateContentEditor({ template, value: v, onChange, linkGroups, uploading, uploadImage }: Props) {
  const { t } = useTranslation(["store", "common"])
  const spec = TEMPLATE_BLOCKS[template]
  if (spec.blocks.length === 0) return null
  const theme = STORE_THEMES.find((x) => x.id === template)
  const name = theme ? t(theme.nameKey) : template
  const set = <K extends keyof TemplateContentForm>(key: K, p: Partial<TemplateContentForm[K]>) => onChange({ ...v, [key]: { ...v[key], ...p } })
  const maxTiles = Math.min(MAX_TILES, spec.promoTiles?.max ?? MAX_TILES)
  const tiles = v.promoTiles.items
  const setTile = (i: number, p: Partial<Tile>) => set("promoTiles", { items: tiles.map((x, k) => (k === i ? { ...x, ...p } : x)) })
  const stats = v.stats.items
  const setStat = (i: number, p: Partial<Stat>) => set("stats", { items: stats.map((x, k) => (k === i ? { ...x, ...p } : x)) })
  const reviews = v.testimonials.items
  const setReview = (i: number, p: Partial<Review>) => set("testimonials", { items: reviews.map((x, k) => (k === i ? { ...x, ...p } : x)) })
  const uploadTo = async (file: File, apply: (path: string) => void) => {
    const path = await uploadImage(file)
    if (path) apply(path)
  }
  const removeBtn = (label: string, onClick: () => void) => (
    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" aria-label={t("store:content.removeWhat", { what: label })} onClick={onClick}>{t("common:actions.remove")}</Button>
  )

  return (
    <SectionCard
      aria-label={t("store:content.title")}
      title={t("store:content.title")}
      description={t("store:content.description", { name })}
      contentClassName="flex flex-col gap-4"
    >
      <Tabs key={template} defaultValue={spec.blocks[0]} className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
          {spec.blocks.map((b) => <TabsTrigger key={b} value={b}>{t(LABEL[b])}</TabsTrigger>)}
        </TabsList>

        <TabsContent value="announcement" className="flex flex-col gap-4">
          <ModeRow label={t(LABEL.announcement)} value={v.announcement.mode} onChange={(mode) => set("announcement", { mode })} auto={t(AUTO.announcement)} />
          {v.announcement.mode === "custom" && (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <FormField label={t("store:content.text")} htmlFor="tc-ann-text" className="min-w-0"><Input id="tc-ann-text" value={v.announcement.text} maxLength={200} onChange={(e) => set("announcement", { text: e.target.value })} /></FormField>
              <FormField label={t("store:content.couponCode")} htmlFor="tc-ann-code" className="min-w-0"><Input id="tc-ann-code" value={v.announcement.code} maxLength={40} onChange={(e) => set("announcement", { code: e.target.value.toUpperCase() })} /></FormField>
              <FormField label={t("store:content.goesTo")} htmlFor="tc-ann-link" className="min-w-0"><LinkSelect id="tc-ann-link" value={v.announcement.link} groups={linkGroups} optional onChange={(link) => set("announcement", { link })} /></FormField>
            </div>
          )}
        </TabsContent>

        <TabsContent value="headerNote" className="flex flex-col gap-4">
          <ModeRow label={t(LABEL.headerNote)} value={v.headerNote.mode} onChange={(mode) => set("headerNote", { mode })} auto={t(AUTO.headerNote)} />
          {v.headerNote.mode === "custom" && (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <FormField label={t("store:content.smallLabel")} htmlFor="tc-note-label" className="min-w-0"><Input id="tc-note-label" value={v.headerNote.label} maxLength={40} placeholder={t("store:content.notePh")} onChange={(e) => set("headerNote", { label: e.target.value })} /></FormField>
              <FormField label={t("store:content.text")} htmlFor="tc-note-text" className="min-w-0"><Input id="tc-note-text" value={v.headerNote.text} maxLength={80} placeholder={t("store:content.noteTextPh")} onChange={(e) => set("headerNote", { text: e.target.value })} /></FormField>
            </div>
          )}
        </TabsContent>

        <TabsContent value="promoTiles" className="flex flex-col gap-4">
          <ModeRow label={t(LABEL.promoTiles)} value={v.promoTiles.mode} onChange={(mode) => set("promoTiles", { mode })} auto={t(AUTO.promoTiles)} />
          {spec.promoTiles && <p className="text-sm text-muted-foreground">{t(spec.promoTiles.hintKey)}</p>}
          {v.promoTiles.mode === "custom" && (
            <div className="flex flex-col gap-3">
              {tiles.map((x, i) => (
                <Card key={x.id} className={`gap-0 p-3 shadow-none ${i >= maxTiles ? "opacity-60" : ""}`}>
                  <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                    <ImageSlot id={`tc-tile-img-${x.id}`} path={x.imagePath} label={t("store:content.tilePhoto", { n: i + 1 })} uploading={uploading} className="w-24"
                      onUpload={(f) => uploadTo(f, (p) => setTile(i, { imagePath: p }))} onRemove={() => setTile(i, { imagePath: "" })} />
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{i >= maxTiles ? t("store:content.tileNotShown", { n: i + 1, name }) : t("store:content.tile", { n: i + 1 })}</span>
                        {removeBtn(t("store:content.tileWhat", { n: i + 1 }), () => set("promoTiles", { items: tiles.filter((_, k) => k !== i) }))}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label={t("store:content.titleField")} htmlFor={`tc-tile-title-${x.id}`} className="min-w-0"><Input id={`tc-tile-title-${x.id}`} value={x.title} maxLength={120} onChange={(e) => setTile(i, { title: e.target.value })} /></FormField>
                        <FormField label={t("store:content.smallLabel")} htmlFor={`tc-tile-tag-${x.id}`} className="min-w-0"><Input id={`tc-tile-tag-${x.id}`} value={x.tag} maxLength={60} onChange={(e) => setTile(i, { tag: e.target.value })} /></FormField>
                      </div>
                      <FormField label={t("store:content.text")} htmlFor={`tc-tile-text-${x.id}`} className="min-w-0"><Input id={`tc-tile-text-${x.id}`} value={x.text} maxLength={200} onChange={(e) => setTile(i, { text: e.target.value })} /></FormField>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <FormField label={t("store:content.buttonText")} htmlFor={`tc-tile-cta-${x.id}`} className="min-w-0"><Input id={`tc-tile-cta-${x.id}`} value={x.cta} maxLength={40} placeholder={t("store:content.shopNowPh")} onChange={(e) => setTile(i, { cta: e.target.value })} /></FormField>
                        <FormField label={t("store:content.goesTo")} htmlFor={`tc-tile-link-${x.id}`} className="min-w-0"><LinkSelect id={`tc-tile-link-${x.id}`} value={x.link} groups={linkGroups} onChange={(link) => setTile(i, { link })} /></FormField>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              <Button type="button" variant="outline" className="self-start" disabled={tiles.length >= maxTiles}
                onClick={() => set("promoTiles", { items: [...tiles, { id: uid(), tag: "", title: "New tile", text: "", cta: "Shop now", link: "/shop", imagePath: "" }] })}>
                <Plus /> {tiles.length >= maxTiles ? t("store:content.addTileMax", { max: maxTiles }) : t("store:content.addTile")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("store:content.tileNoPhoto")}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="stats" className="flex flex-col gap-4">
          <ModeRow label={t(LABEL.stats)} value={v.stats.mode} onChange={(mode) => set("stats", { mode })} auto={t(AUTO.stats)} />
          {template === "luxe" && <p className="text-sm text-muted-foreground">{t("store:content.luxeStatsHint")}</p>}
          {v.stats.mode === "custom" && (
            <div className="flex flex-col gap-3">
              {stats.map((x, i) => (
                <div key={i} className="grid items-end gap-3 sm:grid-cols-[140px_minmax(0,1fr)_auto]">
                  <FormField label={t("store:content.number", { n: i + 1 })} htmlFor={`tc-stat-value-${i}`} className="min-w-0"><Input id={`tc-stat-value-${i}`} value={x.value} maxLength={20} placeholder={t("store:content.statValuePh")} onChange={(e) => setStat(i, { value: e.target.value })} /></FormField>
                  <FormField label={t("store:content.label")} htmlFor={`tc-stat-label-${i}`} className="min-w-0"><Input id={`tc-stat-label-${i}`} value={x.label} maxLength={60} placeholder={t("store:content.statLabelPh")} onChange={(e) => setStat(i, { label: e.target.value })} /></FormField>
                  {removeBtn(t("store:content.numberWhat", { n: i + 1 }), () => set("stats", { items: stats.filter((_, k) => k !== i) }))}
                </div>
              ))}
              <Button type="button" variant="outline" className="self-start" disabled={stats.length >= MAX_STATS}
                onClick={() => set("stats", { items: [...stats, { value: "", label: "" }] })}>
                <Plus /> {stats.length >= MAX_STATS ? t("store:content.addNumberMax", { max: MAX_STATS }) : t("store:content.addNumber")}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="testimonials" className="flex flex-col gap-4">
          <ModeRow label={t(LABEL.testimonials)} value={v.testimonials.mode} onChange={(mode) => set("testimonials", { mode })} auto={t(AUTO.testimonials)} />
          {v.testimonials.mode === "custom" && (
            <div className="flex flex-col gap-3">
              <FormField label={t("store:content.heading")} htmlFor="tc-rev-title" className="min-w-0"><Input id="tc-rev-title" value={v.testimonials.title} maxLength={120} onChange={(e) => set("testimonials", { title: e.target.value })} /></FormField>
              {reviews.map((x, i) => (
                <Card key={i} className="gap-3 p-3 shadow-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{t("store:content.review", { n: i + 1 })}</span>
                    {removeBtn(t("store:content.reviewWhat", { n: i + 1 }), () => set("testimonials", { items: reviews.filter((_, k) => k !== i) }))}
                  </div>
                  <FormField label={t("store:content.whatSaid")} htmlFor={`tc-rev-text-${i}`} className="min-w-0"><Textarea id={`tc-rev-text-${i}`} rows={2} value={x.text} maxLength={500} onChange={(e) => setReview(i, { text: e.target.value })} /></FormField>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px]">
                    <FormField label={t("common:fields.name")} htmlFor={`tc-rev-name-${i}`} className="min-w-0"><Input id={`tc-rev-name-${i}`} value={x.name} maxLength={80} onChange={(e) => setReview(i, { name: e.target.value })} /></FormField>
                    <FormField label={t("store:content.note")} htmlFor={`tc-rev-note-${i}`} className="min-w-0"><Input id={`tc-rev-note-${i}`} value={x.note} maxLength={120} placeholder={t("store:content.reviewNotePh")} onChange={(e) => setReview(i, { note: e.target.value })} /></FormField>
                    <FormField label={t("store:content.stars")} htmlFor={`tc-rev-rating-${i}`} className="min-w-0">
                      <Select value={String(x.rating)} onValueChange={(r) => setReview(i, { rating: Number(r) })}>
                        <SelectTrigger id={`tc-rev-rating-${i}`} className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{[5, 4, 3, 2, 1].map((r) => <SelectItem key={r} value={String(r)}><span className="flex items-center gap-1">{r} <Star className="size-3.5" aria-hidden /></span></SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                  </div>
                </Card>
              ))}
              <Button type="button" variant="outline" className="self-start" disabled={reviews.length >= MAX_REVIEWS}
                onClick={() => set("testimonials", { items: [...reviews, { name: "", text: "", rating: 5, note: "" }] })}>
                <Plus /> {reviews.length >= MAX_REVIEWS ? t("store:content.addReviewMax", { max: MAX_REVIEWS }) : t("store:content.addReview")}
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="newsletter" className="flex flex-col gap-4">
          <ModeRow label={t(LABEL.newsletter)} value={v.newsletter.mode} onChange={(mode) => set("newsletter", { mode })} auto={t(AUTO.newsletter)} />
          {v.newsletter.mode === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("store:content.heading")} htmlFor="tc-news-title" className="min-w-0"><Input id="tc-news-title" value={v.newsletter.title} maxLength={120} onChange={(e) => set("newsletter", { title: e.target.value })} /></FormField>
              <FormField label={t("store:content.text")} htmlFor="tc-news-text" className="min-w-0"><Input id="tc-news-text" value={v.newsletter.text} maxLength={300} onChange={(e) => set("newsletter", { text: e.target.value })} /></FormField>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cta" className="flex flex-col gap-4">
          <ModeRow label={t(LABEL.cta)} value={v.cta.mode} onChange={(mode) => set("cta", { mode })} auto={t(AUTO.cta)} />
          {v.cta.mode === "custom" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
              <div className="flex min-w-0 flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={t("store:content.smallLabel")} htmlFor="tc-cta-tag" className="min-w-0"><Input id="tc-cta-tag" value={v.cta.tag} maxLength={60} onChange={(e) => set("cta", { tag: e.target.value })} /></FormField>
                  <FormField label={t("store:content.headline")} htmlFor="tc-cta-title" className="min-w-0"><Input id="tc-cta-title" value={v.cta.title} maxLength={160} onChange={(e) => set("cta", { title: e.target.value })} /></FormField>
                </div>
                <FormField label={t("store:content.text")} htmlFor="tc-cta-text" className="min-w-0"><Textarea id="tc-cta-text" rows={2} value={v.cta.text} maxLength={300} onChange={(e) => set("cta", { text: e.target.value })} /></FormField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={t("store:content.mainButton")} htmlFor="tc-cta-cta" className="min-w-0"><Input id="tc-cta-cta" value={v.cta.cta} maxLength={40} onChange={(e) => set("cta", { cta: e.target.value })} /></FormField>
                  <FormField label={t("store:content.mainButtonGoesTo")} htmlFor="tc-cta-link" className="min-w-0"><LinkSelect id="tc-cta-link" value={v.cta.link} groups={linkGroups} onChange={(link) => set("cta", { link })} /></FormField>
                  <FormField label={t("store:content.secondButton")} htmlFor="tc-cta-cta2" className="min-w-0"><Input id="tc-cta-cta2" value={v.cta.cta2} maxLength={40} onChange={(e) => set("cta", { cta2: e.target.value })} /></FormField>
                  <FormField label={t("store:content.secondButtonGoesTo")} htmlFor="tc-cta-link2" className="min-w-0"><LinkSelect id="tc-cta-link2" value={v.cta.link2} groups={linkGroups} optional onChange={(link2) => set("cta", { link2 })} /></FormField>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{t("store:content.bgPhoto")}</p>
                <ImageSlot id="tc-cta-img" path={v.cta.imagePath} label={t("store:content.bandPhoto")} uploading={uploading}
                  onUpload={(f) => uploadTo(f, (imagePath) => set("cta", { imagePath }))} onRemove={() => set("cta", { imagePath: "" })} />
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </SectionCard>
  )
}
