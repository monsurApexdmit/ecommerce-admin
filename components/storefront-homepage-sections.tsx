"use client"

import { ArrowDown, ArrowUp, ImageUp, Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ParseKeys, TFunction } from "i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/common/FormField"
import { SectionCard } from "@/components/common/SectionCard"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { WithTooltip } from "@/components/common/WithTooltip"
import { resolveStorageUrl, type HomepageAisle, type HomepagePerk, type HomepagePerkIcon, type HomepageProductSource, type HomepageSections } from "@/lib/settingsApi"
import { cn } from "@/lib/utils"

/** `t` of useTranslation(["store", "common"]), for helpers outside a component. */
export type StoreT = TFunction<["store", "common"]>
type StoreKey = ParseKeys<["store", "common"]>

/** auto = storefront builds the section itself; custom = content below; hidden = section not shown. */
export type SectionMode = "auto" | "custom" | "hidden"

export interface SectionsForm {
  aisles: { mode: SectionMode; title: string; subtitle: string; items: HomepageAisle[] }
  products: { mode: SectionMode; title: string; subtitle: string; source: HomepageProductSource; categoryId: number | null; limit: number }
  lookbook: { mode: SectionMode; tag: string; title: string; text: string; cta: string; link: string; images: string[] }
  perks: { mode: SectionMode; items: HomepagePerk[] }
  footer: { mode: Exclude<SectionMode, "hidden">; tagline: string }
}

export interface LinkGroup {
  label: string
  options: { value: string; label: string }[]
}

const MAX_AISLES = 6
const MAX_PERKS = 4
const NO_LINK = "__none"
const ALL_CATEGORIES = "__all"

const SOURCES: [HomepageProductSource, StoreKey][] = [
  ["latest", "store:sections.sources.latest"],
  ["featured", "store:sections.sources.featured"],
  ["best_seller", "store:sections.sources.best_seller"],
  ["hot_deal", "store:sections.sources.hot_deal"],
  ["on_sale", "store:sections.sources.on_sale"],
]

const ICONS: [HomepagePerkIcon, StoreKey][] = [
  ["truck", "store:sections.icons.truck"],
  ["rotate", "store:sections.icons.rotate"],
  ["shield", "store:sections.icons.shield"],
  ["heart", "store:sections.icons.heart"],
  ["gift", "store:sections.icons.gift"],
  ["star", "store:sections.icons.star"],
  ["sparkles", "store:sections.icons.sparkles"],
  ["package", "store:sections.icons.package"],
  ["clock", "store:sections.icons.clock"],
  ["phone", "store:sections.icons.phone"],
]

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const S = (v: unknown) => (typeof v === "string" ? v : "")

// Same copy the storefront shows in Automatic mode, so switching to Custom starts from what customers see.
// Storefront content (saved as the owner's own text once edited), so it is not translated here.
const DEFAULTS: SectionsForm = {
  aisles: {
    mode: "auto",
    title: "Pick your aisle",
    subtitle: "Three worlds, one wardrobe philosophy.",
    items: [
      { id: "aisle-women", label: "Women", tagline: "Soft power, loud color.", emoji: "🌸", imagePath: "", link: "/shop?search=Women", enabled: true },
      { id: "aisle-men", label: "Men", tagline: "Easy tailoring, sun-baked color.", emoji: "🌞", imagePath: "", link: "/shop?search=Men", enabled: true },
      { id: "aisle-kids", label: "Kids", tagline: "Built for jumping, spinning, climbing.", emoji: "🎈", imagePath: "", link: "/shop?search=Kids", enabled: true },
    ],
  },
  products: { mode: "auto", title: "This week's bloom", subtitle: "Fresh picks, hand-on-heart approved.", source: "latest", categoryId: null, limit: 8 },
  lookbook: {
    mode: "auto",
    tag: "Lookbook",
    title: "A year of *color*, no apologies.",
    text: "Bold colour, easy shapes and pieces for the whole family. Find your next favourite in the full collection.",
    cta: "Explore the collection",
    link: "/shop",
    images: [],
  },
  perks: {
    mode: "auto",
    items: [
      { id: "perk-delivery", icon: "truck", title: "Delivery to your door", text: "See delivery areas, charges and timelines.", link: "/shipping" },
      { id: "perk-returns", icon: "rotate", title: "Returns & exchanges", text: "See what you can return and how.", link: "/returns" },
      { id: "perk-secure", icon: "shield", title: "Secure checkout", text: "Your payment details stay protected.", link: "" },
    ],
  },
  footer: { mode: "auto", tagline: "Color-forward, joyfully made clothing for women, men and kids." },
}

const modeOf = (section: { enabled?: boolean } | null | undefined): SectionMode =>
  !section ? "auto" : section.enabled === false ? "hidden" : "custom"

export function sectionsFromSettings(raw: HomepageSections | undefined | null): SectionsForm {
  const a = raw?.aisles, p = raw?.products, l = raw?.lookbook, k = raw?.perks, f = raw?.footer
  return {
    aisles: a
      ? {
          mode: modeOf(a),
          title: S(a.title),
          subtitle: S(a.subtitle),
          items: (Array.isArray(a.items) ? a.items : []).map((x, i) => ({
            id: S(x.id) || `aisle-${i + 1}`, label: S(x.label), tagline: S(x.tagline), emoji: S(x.emoji),
            imagePath: S(x.imagePath), link: S(x.link) || "/shop", enabled: x.enabled !== false,
          })),
        }
      : DEFAULTS.aisles,
    products: p
      ? {
          mode: modeOf(p),
          title: S(p.title),
          subtitle: S(p.subtitle),
          source: SOURCES.some(([v]) => v === p.source) ? p.source : "latest",
          categoryId: typeof p.categoryId === "number" ? p.categoryId : null,
          limit: [4, 8, 12].includes(Number(p.limit)) ? Number(p.limit) : 8,
        }
      : DEFAULTS.products,
    lookbook: l
      ? {
          mode: modeOf(l), tag: S(l.tag), title: S(l.title), text: S(l.text), cta: S(l.cta), link: S(l.link) || "/shop",
          images: (Array.isArray(l.images) ? l.images : []).map(S).filter(Boolean).slice(0, 2),
        }
      : DEFAULTS.lookbook,
    perks: k
      ? {
          mode: modeOf(k),
          items: (Array.isArray(k.items) ? k.items : []).map((x, i) => ({
            id: S(x.id) || `perk-${i + 1}`, icon: ICONS.some(([v]) => v === x.icon) ? x.icon : "sparkles",
            title: S(x.title), text: S(x.text), link: S(x.link),
          })),
        }
      : DEFAULTS.perks,
    footer: f ? { mode: "custom", tagline: S(f.tagline) } : DEFAULTS.footer,
  }
}

/** Automatic sections are sent as null so the storefront keeps generating them. */
export function sectionsToSettings(v: SectionsForm): Record<keyof SectionsForm, unknown> {
  const on = (mode: SectionMode) => mode !== "hidden"
  return {
    aisles: v.aisles.mode === "auto" ? null : {
      enabled: on(v.aisles.mode), title: v.aisles.title.trim(), subtitle: v.aisles.subtitle.trim(),
      items: v.aisles.items.map((x) => ({ ...x, label: x.label.trim(), tagline: x.tagline.trim(), emoji: x.emoji.trim(), link: x.link.trim() || "/shop" })),
    },
    products: v.products.mode === "auto" ? null : {
      enabled: on(v.products.mode), title: v.products.title.trim(), subtitle: v.products.subtitle.trim(),
      source: v.products.source, categoryId: v.products.source === "latest" ? v.products.categoryId : null, limit: v.products.limit,
    },
    lookbook: v.lookbook.mode === "auto" ? null : {
      enabled: on(v.lookbook.mode), tag: v.lookbook.tag.trim(), title: v.lookbook.title.trim(), text: v.lookbook.text.trim(),
      cta: v.lookbook.cta.trim(), link: v.lookbook.link.trim() || "/shop", images: v.lookbook.images.filter(Boolean),
    },
    perks: v.perks.mode === "auto" ? null : {
      enabled: on(v.perks.mode),
      items: v.perks.items.map((x) => ({ ...x, title: x.title.trim(), text: x.text.trim(), link: x.link.trim() })),
    },
    footer: v.footer.mode === "auto" ? null : { tagline: v.footer.tagline.trim() },
  }
}

/** Returns the first problem with custom sections, or null. */
export function validateSections(v: SectionsForm, t: StoreT): string | null {
  if (v.aisles.mode === "custom") {
    const shown = v.aisles.items.filter((x) => x.enabled)
    if (shown.length === 0) return t("store:sections.errors.aislesNone")
    const i = v.aisles.items.findIndex((x) => x.enabled && !x.label.trim())
    if (i >= 0) return t("store:sections.errors.aisleName", { n: i + 1 })
  }
  if (v.lookbook.mode === "custom" && !v.lookbook.title.trim()) return t("store:sections.errors.lookbookTitle")
  if (v.perks.mode === "custom") {
    if (v.perks.items.length === 0) return t("store:sections.errors.perksNone")
    const i = v.perks.items.findIndex((x) => !x.title.trim())
    if (i >= 0) return t("store:sections.errors.perkTitle", { n: i + 1 })
  }
  return null
}

export function LinkSelect({ id, value, onChange, groups, optional }: { id: string; value: string; onChange: (v: string) => void; groups: LinkGroup[]; optional?: boolean }) {
  const { t } = useTranslation(["store", "common"])
  const known = groups.some((g) => g.options.some((o) => o.value === value))
  return (
    <Select value={value || (optional ? NO_LINK : undefined)} onValueChange={(v) => onChange(v === NO_LINK ? "" : v)}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder={t("store:sections.link.choose")} /></SelectTrigger>
      <SelectContent>
        {optional && <SelectItem value={NO_LINK}>{t("store:sections.link.none")}</SelectItem>}
        {groups.filter((g) => g.options.length > 0).map((g) => (
          <SelectGroup key={g.label}>
            <SelectLabel>{g.label}</SelectLabel>
            {g.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectGroup>
        ))}
        {value && !known && <SelectGroup><SelectLabel>{t("store:sections.link.current")}</SelectLabel><SelectItem value={value}>{value}</SelectItem></SelectGroup>}
      </SelectContent>
    </Select>
  )
}

export function ImageSlot({ id, path, label, uploading, onUpload, onRemove, className }: {
  id: string; path: string; label: string; uploading: boolean; onUpload: (f: File) => void; onRemove: () => void; className?: string
}) {
  const { t } = useTranslation(["store", "common"])
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Input id={id} type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = "" }} />
      <Label
        htmlFor={id}
        className={cn(
          "relative flex aspect-[4/5] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted text-muted-foreground hover:bg-muted/70",
          uploading && "pointer-events-none opacity-50"
        )}
        style={path ? { background: `center / cover no-repeat url("${resolveStorageUrl(path).replace(/"/g, "%22")}")` } : undefined}
      >
        {!path && <span className="flex flex-col items-center gap-1 text-xs"><ImageUp className="size-5" />{uploading ? t("store:shared.uploading") : t("store:sections.image.upload")}</span>}
        <span className="sr-only">{path ? t("store:sections.image.change", { label }) : t("store:sections.image.uploadLabel", { label })}</span>
      </Label>
      {path && <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onRemove}>{t("common:actions.remove")}</Button>}
    </div>
  )
}

const MODE_OPTIONS: { value: SectionMode; label: StoreKey }[] = [
  { value: "auto", label: "store:sections.mode.auto" },
  { value: "custom", label: "store:sections.mode.custom" },
  { value: "hidden", label: "store:sections.mode.hidden" },
]

export function ModeRow({ value, onChange, auto, allowHidden = true, label }: { value: SectionMode; onChange: (m: SectionMode) => void; auto: string; allowHidden?: boolean; label: string }) {
  const { t } = useTranslation(["store", "common"])
  const options = (allowHidden ? MODE_OPTIONS : MODE_OPTIONS.slice(0, 2)).map((o) => ({ value: o.value, label: t(o.label) }))
  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        aria-label={t("store:sections.mode.content", { label })}
        value={value}
        onValueChange={(m) => onChange(m as SectionMode)}
        options={options}
        className="self-start"
      />
      <p className="text-sm text-muted-foreground">
        {value === "auto" ? auto : value === "hidden" ? t("store:sections.mode.hiddenHint") : t("store:sections.mode.customHint")}
      </p>
    </div>
  )
}

interface EditorProps {
  value: SectionsForm
  onChange: (v: SectionsForm) => void
  linkGroups: LinkGroup[]
  categories: { id: number; name: string }[]
  uploading: boolean
  /** Uploads a storefront image and resolves to its stored path, or null on failure. */
  uploadImage: (file: File) => Promise<string | null>
  /** Tabs the chosen template has no place for (hidden here; their saved content is kept) */
  hide?: (keyof SectionsForm)[]
}

/** Online store > Homepage sections: everything on the Aura Shop homepage below the hero. */
export function HomepageSectionsEditor({ value: v, onChange, linkGroups, categories, uploading, uploadImage, hide = [] }: EditorProps) {
  const { t } = useTranslation(["store", "common"])
  const set = <K extends keyof SectionsForm>(key: K, p: Partial<SectionsForm[K]>) => onChange({ ...v, [key]: { ...v[key], ...p } })
  const setMode = <K extends keyof SectionsForm>(key: K, mode: SectionMode) => set(key, { mode } as Partial<SectionsForm[K]>)

  const aisles = v.aisles.items
  const setAisle = (i: number, p: Partial<HomepageAisle>) => set("aisles", { items: aisles.map((x, k) => (k === i ? { ...x, ...p } : x)) })
  const moveAisle = (i: number, d: -1 | 1) => { const a = aisles.slice(); [a[i], a[i + d]] = [a[i + d], a[i]]; set("aisles", { items: a }) }
  const perks = v.perks.items
  const setPerk = (i: number, p: Partial<HomepagePerk>) => set("perks", { items: perks.map((x, k) => (k === i ? { ...x, ...p } : x)) })
  const movePerk = (i: number, d: -1 | 1) => { const a = perks.slice(); [a[i], a[i + d]] = [a[i + d], a[i]]; set("perks", { items: a }) }

  const uploadTo = async (file: File, apply: (path: string) => void) => {
    const path = await uploadImage(file)
    if (path) apply(path)
  }

  const moveButtons = (i: number, count: number, move: (i: number, d: -1 | 1) => void, remove: () => void, what: string) => (
    <div className="flex items-center gap-1">
      <WithTooltip content={t("store:sections.move.up")}><Button type="button" variant="ghost" size="icon" aria-label={t("store:sections.move.upLabel", { what })} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button></WithTooltip>
      <WithTooltip content={t("store:sections.move.down")}><Button type="button" variant="ghost" size="icon" aria-label={t("store:sections.move.downLabel", { what })} disabled={i === count - 1} onClick={() => move(i, 1)}><ArrowDown /></Button></WithTooltip>
      <WithTooltip content={t("common:actions.remove")}><Button type="button" variant="ghost" size="icon" aria-label={t("store:sections.move.removeLabel", { what })} onClick={remove}><Trash2 /></Button></WithTooltip>
    </div>
  )

  return (
    <SectionCard
      aria-label={t("store:sections.title")}
      title={t("store:sections.title")}
      description={t("store:sections.description")}
      contentClassName="flex flex-col gap-4"
    >
      <Tabs defaultValue="aisles" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
          <TabsTrigger value="aisles">{t("store:sections.tabs.aisles")}</TabsTrigger>
          <TabsTrigger value="products">{t("store:sections.tabs.products")}</TabsTrigger>
          {!hide.includes("lookbook") && <TabsTrigger value="lookbook">{t("store:sections.tabs.lookbook")}</TabsTrigger>}
          {!hide.includes("perks") && <TabsTrigger value="perks">{t("store:sections.tabs.perks")}</TabsTrigger>}
          <TabsTrigger value="footer">{t("store:sections.tabs.footer")}</TabsTrigger>
        </TabsList>

        {/* Aisle cards */}
        <TabsContent value="aisles" className="flex flex-col gap-4">
          <ModeRow label={t("store:sections.tabs.aisles")} value={v.aisles.mode} onChange={(m) => setMode("aisles", m)}
            auto={t("store:sections.aislesAuto")} />
          {v.aisles.mode === "custom" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label={t("store:sections.heading")} htmlFor="aisles-title" className="min-w-0"><Input id="aisles-title" value={v.aisles.title} onChange={(e) => set("aisles", { title: e.target.value })} /></FormField>
                <FormField label={t("store:sections.subheading")} htmlFor="aisles-subtitle" className="min-w-0"><Input id="aisles-subtitle" value={v.aisles.subtitle} onChange={(e) => set("aisles", { subtitle: e.target.value })} /></FormField>
              </div>
              <div className="flex flex-col gap-3">
                {aisles.map((x, i) => (
                  <Card key={x.id} className="gap-0 p-3 shadow-none">
                    <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                      <ImageSlot id={`aisle-img-${x.id}`} path={x.imagePath} label={t("store:sections.cardPhoto", { n: i + 1 })} uploading={uploading} className="w-24"
                        onUpload={(f) => uploadTo(f, (p) => setAisle(i, { imagePath: p }))} onRemove={() => setAisle(i, { imagePath: "" })} />
                      <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{t("store:sections.card", { n: i + 1 })}</span>
                          <div className="flex items-center gap-3">
                            <Label className="flex items-center gap-2 text-sm font-normal">
                              {t("store:sections.show")}
                              <Switch checked={x.enabled} aria-label={t("store:sections.showCard", { n: i + 1 })} onCheckedChange={(c) => setAisle(i, { enabled: c })} />
                            </Label>
                            {moveButtons(i, aisles.length, moveAisle, () => set("aisles", { items: aisles.filter((_, k) => k !== i) }), t("store:sections.cardWhat", { n: i + 1 }))}
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_88px]">
                          <FormField label={t("common:fields.name")} htmlFor={`aisle-label-${x.id}`} className="min-w-0"><Input id={`aisle-label-${x.id}`} value={x.label} onChange={(e) => setAisle(i, { label: e.target.value })} /></FormField>
                          <FormField label={t("store:sections.emoji")} htmlFor={`aisle-emoji-${x.id}`} className="min-w-0"><Input id={`aisle-emoji-${x.id}`} value={x.emoji} maxLength={8} onChange={(e) => setAisle(i, { emoji: e.target.value })} /></FormField>
                        </div>
                        <FormField label={t("store:sections.tagline")} htmlFor={`aisle-tagline-${x.id}`} className="min-w-0"><Input id={`aisle-tagline-${x.id}`} value={x.tagline} onChange={(e) => setAisle(i, { tagline: e.target.value })} /></FormField>
                        <FormField label={t("store:sections.cardGoesTo")} htmlFor={`aisle-link-${x.id}`} className="min-w-0">
                          <LinkSelect id={`aisle-link-${x.id}`} value={x.link} groups={linkGroups} onChange={(link) => setAisle(i, { link })} />
                        </FormField>
                      </div>
                    </div>
                  </Card>
                ))}
                <Button type="button" variant="outline" className="self-start" disabled={aisles.length >= MAX_AISLES}
                  onClick={() => set("aisles", { items: [...aisles, { id: uid("aisle"), label: "New aisle", tagline: "", emoji: "✨", imagePath: "", link: "/shop", enabled: true }] })}>
                  <Plus /> {aisles.length >= MAX_AISLES ? t("store:sections.addCardMax", { max: MAX_AISLES }) : t("store:sections.addCard")}
                </Button>
                <p className="text-xs text-muted-foreground">{t("store:sections.aislesPhotoHint")}</p>
              </div>
            </>
          )}
        </TabsContent>

        {/* Product grid */}
        <TabsContent value="products" className="flex flex-col gap-4">
          <ModeRow label={t("store:sections.tabs.products")} value={v.products.mode} onChange={(m) => setMode("products", m)}
            auto={t("store:sections.productsAuto")} />
          {v.products.mode === "custom" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label={t("store:sections.heading")} htmlFor="products-title" className="min-w-0"><Input id="products-title" value={v.products.title} onChange={(e) => set("products", { title: e.target.value })} /></FormField>
                <FormField label={t("store:sections.subheading")} htmlFor="products-subtitle" className="min-w-0"><Input id="products-subtitle" value={v.products.subtitle} onChange={(e) => set("products", { subtitle: e.target.value })} /></FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label={t("store:sections.whichProducts")} htmlFor="products-source" className="min-w-0">
                  <Select value={v.products.source} onValueChange={(s) => set("products", { source: s as HomepageProductSource })}>
                    <SelectTrigger id="products-source" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{SOURCES.map(([val, l]) => <SelectItem key={val} value={val}>{t(l)}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label={t("common:fields.category")} htmlFor="products-category" className="min-w-0"
                  description={v.products.source !== "latest" ? t("store:sections.onlyNewest") : undefined}>
                  <Select disabled={v.products.source !== "latest"} value={v.products.categoryId != null ? String(v.products.categoryId) : ALL_CATEGORIES}
                    onValueChange={(c) => set("products", { categoryId: c === ALL_CATEGORIES ? null : Number(c) })}>
                    <SelectTrigger id="products-category" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_CATEGORIES}>{t("store:sections.allCategories")}</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label={t("store:sections.howMany")} htmlFor="products-limit" className="min-w-0">
                  <Select value={String(v.products.limit)} onValueChange={(n) => set("products", { limit: Number(n) })}>
                    <SelectTrigger id="products-limit" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{[4, 8, 12].map((n) => <SelectItem key={n} value={String(n)}>{t("common:count.products", { count: n })}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>
            </>
          )}
        </TabsContent>

        {/* Lookbook */}
        <TabsContent value="lookbook" className="flex flex-col gap-4">
          <ModeRow label={t("store:sections.tabs.lookbook")} value={v.lookbook.mode} onChange={(m) => setMode("lookbook", m)}
            auto={t("store:sections.lookbookAuto")} />
          {v.lookbook.mode === "custom" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="flex min-w-0 flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={t("store:sections.badge")} htmlFor="lookbook-tag" className="min-w-0"><Input id="lookbook-tag" value={v.lookbook.tag} onChange={(e) => set("lookbook", { tag: e.target.value })} /></FormField>
                  <FormField label={t("store:sections.buttonText")} htmlFor="lookbook-cta" className="min-w-0"><Input id="lookbook-cta" value={v.lookbook.cta} onChange={(e) => set("lookbook", { cta: e.target.value })} /></FormField>
                </div>
                <FormField label={t("store:sections.headline")} htmlFor="lookbook-title" description={t("store:sections.headlineHelp")} className="min-w-0">
                  <Input id="lookbook-title" value={v.lookbook.title} onChange={(e) => set("lookbook", { title: e.target.value })} />
                </FormField>
                <FormField label={t("store:sections.text")} htmlFor="lookbook-text" className="min-w-0"><Textarea id="lookbook-text" rows={3} value={v.lookbook.text} onChange={(e) => set("lookbook", { text: e.target.value })} /></FormField>
                <FormField label={t("store:sections.buttonGoesTo")} htmlFor="lookbook-link" className="min-w-0">
                  <LinkSelect id="lookbook-link" value={v.lookbook.link} groups={linkGroups} onChange={(link) => set("lookbook", { link })} />
                </FormField>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{t("store:sections.photos")}</p>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((n) => (
                    <ImageSlot key={n} id={`lookbook-img-${n}`} path={v.lookbook.images[n] ?? ""} label={t("store:sections.lookbookPhoto", { n: n + 1 })} uploading={uploading}
                      onUpload={(f) => uploadTo(f, (p) => { const imgs = [v.lookbook.images[0] ?? "", v.lookbook.images[1] ?? ""]; imgs[n] = p; set("lookbook", { images: imgs }) })}
                      onRemove={() => { const imgs = [v.lookbook.images[0] ?? "", v.lookbook.images[1] ?? ""]; imgs[n] = ""; set("lookbook", { images: imgs }) }} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t("store:sections.emptySlots")}</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Perk cards */}
        <TabsContent value="perks" className="flex flex-col gap-4">
          <ModeRow label={t("store:sections.tabs.perks")} value={v.perks.mode} onChange={(m) => setMode("perks", m)}
            auto={t("store:sections.perksAuto")} />
          {v.perks.mode === "custom" && (
            <div className="flex flex-col gap-3">
              {perks.map((x, i) => (
                <Card key={x.id} className="gap-3 p-3 shadow-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{t("store:sections.card", { n: i + 1 })}</span>
                    {moveButtons(i, perks.length, movePerk, () => set("perks", { items: perks.filter((_, k) => k !== i) }), t("store:sections.perkWhat", { n: i + 1 }))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <FormField label={t("store:sections.icon")} htmlFor={`perk-icon-${x.id}`} className="min-w-0">
                      <Select value={x.icon} onValueChange={(icon) => setPerk(i, { icon: icon as HomepagePerkIcon })}>
                        <SelectTrigger id={`perk-icon-${x.id}`} className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{ICONS.map(([val, l]) => <SelectItem key={val} value={val}>{t(l)}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                    <FormField label={t("store:sections.titleField")} htmlFor={`perk-title-${x.id}`} className="min-w-0"><Input id={`perk-title-${x.id}`} value={x.title} onChange={(e) => setPerk(i, { title: e.target.value })} /></FormField>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label={t("store:sections.text")} htmlFor={`perk-text-${x.id}`} className="min-w-0"><Input id={`perk-text-${x.id}`} value={x.text} onChange={(e) => setPerk(i, { text: e.target.value })} /></FormField>
                    <FormField label={t("store:sections.cardGoesTo")} htmlFor={`perk-link-${x.id}`} className="min-w-0">
                      <LinkSelect id={`perk-link-${x.id}`} value={x.link} groups={linkGroups} optional onChange={(link) => setPerk(i, { link })} />
                    </FormField>
                  </div>
                </Card>
              ))}
              <Button type="button" variant="outline" className="self-start" disabled={perks.length >= MAX_PERKS}
                onClick={() => set("perks", { items: [...perks, { id: uid("perk"), icon: "sparkles", title: "New perk", text: "", link: "" }] })}>
                <Plus /> {perks.length >= MAX_PERKS ? t("store:sections.addCardMax", { max: MAX_PERKS }) : t("store:sections.addCard")}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Footer text */}
        <TabsContent value="footer" className="flex flex-col gap-4">
          <ModeRow label={t("store:sections.tabs.footer")} value={v.footer.mode} allowHidden={false} onChange={(m) => setMode("footer", m)}
            auto={t("store:sections.footerAuto")} />
          {v.footer.mode === "custom" && (
            <FormField label={t("store:sections.footerText")} htmlFor="footer-tagline" className="min-w-0">
              <Textarea id="footer-tagline" rows={2} value={v.footer.tagline} onChange={(e) => set("footer", { tagline: e.target.value })} />
            </FormField>
          )}
        </TabsContent>
      </Tabs>
    </SectionCard>
  )
}
