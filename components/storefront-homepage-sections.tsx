"use client"

import { ArrowDown, ArrowUp, ImageUp, Plus, Trash2 } from "lucide-react"
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

const SOURCES: [HomepageProductSource, string][] = [
  ["latest", "Newest products"],
  ["featured", "Featured"],
  ["best_seller", "Best sellers"],
  ["hot_deal", "Hot deals"],
  ["on_sale", "On sale"],
]

const ICONS: [HomepagePerkIcon, string][] = [
  ["truck", "Delivery truck"],
  ["rotate", "Returns arrow"],
  ["shield", "Shield"],
  ["heart", "Heart"],
  ["gift", "Gift"],
  ["star", "Star"],
  ["sparkles", "Sparkles"],
  ["package", "Package"],
  ["clock", "Clock"],
  ["phone", "Phone"],
]

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const S = (v: unknown) => (typeof v === "string" ? v : "")

// Same copy the storefront shows in Automatic mode, so switching to Custom starts from what customers see.
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
export function validateSections(v: SectionsForm): string | null {
  if (v.aisles.mode === "custom") {
    const shown = v.aisles.items.filter((x) => x.enabled)
    if (shown.length === 0) return "Aisle cards: show at least one card, or set the section to Hidden."
    const i = v.aisles.items.findIndex((x) => x.enabled && !x.label.trim())
    if (i >= 0) return `Aisle card ${i + 1} needs a name.`
  }
  if (v.lookbook.mode === "custom" && !v.lookbook.title.trim()) return "Lookbook needs a headline."
  if (v.perks.mode === "custom") {
    if (v.perks.items.length === 0) return "Perk cards: add at least one card, or set the section to Hidden."
    const i = v.perks.items.findIndex((x) => !x.title.trim())
    if (i >= 0) return `Perk card ${i + 1} needs a title.`
  }
  return null
}

function LinkSelect({ id, value, onChange, groups, optional }: { id: string; value: string; onChange: (v: string) => void; groups: LinkGroup[]; optional?: boolean }) {
  const known = groups.some((g) => g.options.some((o) => o.value === value))
  return (
    <Select value={value || (optional ? NO_LINK : undefined)} onValueChange={(v) => onChange(v === NO_LINK ? "" : v)}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Choose a page" /></SelectTrigger>
      <SelectContent>
        {optional && <SelectItem value={NO_LINK}>No link</SelectItem>}
        {groups.filter((g) => g.options.length > 0).map((g) => (
          <SelectGroup key={g.label}>
            <SelectLabel>{g.label}</SelectLabel>
            {g.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectGroup>
        ))}
        {value && !known && <SelectGroup><SelectLabel>Current</SelectLabel><SelectItem value={value}>{value}</SelectItem></SelectGroup>}
      </SelectContent>
    </Select>
  )
}

function ImageSlot({ id, path, label, uploading, onUpload, onRemove, className }: {
  id: string; path: string; label: string; uploading: boolean; onUpload: (f: File) => void; onRemove: () => void; className?: string
}) {
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
        {!path && <span className="flex flex-col items-center gap-1 text-xs"><ImageUp className="size-5" />{uploading ? "Uploading…" : "Upload"}</span>}
        <span className="sr-only">{path ? `Change ${label}` : `Upload ${label}`}</span>
      </Label>
      {path && <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onRemove}>Remove</Button>}
    </div>
  )
}

const MODE_OPTIONS = [
  { value: "auto", label: "Automatic" },
  { value: "custom", label: "Custom" },
  { value: "hidden", label: "Hidden" },
]

function ModeRow({ value, onChange, auto, allowHidden = true, label }: { value: SectionMode; onChange: (m: SectionMode) => void; auto: string; allowHidden?: boolean; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        aria-label={`${label} content`}
        value={value}
        onValueChange={(m) => onChange(m as SectionMode)}
        options={allowHidden ? MODE_OPTIONS : MODE_OPTIONS.slice(0, 2)}
        className="self-start"
      />
      <p className="text-sm text-muted-foreground">
        {value === "auto" ? auto : value === "hidden" ? "This section is not shown on the homepage." : "Customers see the content below."}
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
}

/** Online store > Homepage sections: everything on the Aura Shop homepage below the hero. */
export function HomepageSectionsEditor({ value: v, onChange, linkGroups, categories, uploading, uploadImage }: EditorProps) {
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
      <WithTooltip content="Move up"><Button type="button" variant="ghost" size="icon" aria-label={`Move ${what} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button></WithTooltip>
      <WithTooltip content="Move down"><Button type="button" variant="ghost" size="icon" aria-label={`Move ${what} down`} disabled={i === count - 1} onClick={() => move(i, 1)}><ArrowDown /></Button></WithTooltip>
      <WithTooltip content="Remove"><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${what}`} onClick={remove}><Trash2 /></Button></WithTooltip>
    </div>
  )

  return (
    <SectionCard
      aria-label="Homepage sections"
      title="Homepage sections"
      description="Everything on your store's homepage below the hero slider. Automatic sections fill themselves from your categories, products and settings."
      contentClassName="flex flex-col gap-4"
    >
      <Tabs defaultValue="aisles" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
          <TabsTrigger value="aisles">Aisle cards</TabsTrigger>
          <TabsTrigger value="products">Product grid</TabsTrigger>
          <TabsTrigger value="lookbook">Lookbook</TabsTrigger>
          <TabsTrigger value="perks">Perk cards</TabsTrigger>
          <TabsTrigger value="footer">Footer text</TabsTrigger>
        </TabsList>

        {/* Aisle cards */}
        <TabsContent value="aisles" className="flex flex-col gap-4">
          <ModeRow label="Aisle cards" value={v.aisles.mode} onChange={(m) => setMode("aisles", m)}
            auto="Shows Women, Men and Kids if you have those categories, otherwise your top-level categories (up to 6), each with its category image or a product photo." />
          {v.aisles.mode === "custom" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Heading" htmlFor="aisles-title" className="min-w-0"><Input id="aisles-title" value={v.aisles.title} onChange={(e) => set("aisles", { title: e.target.value })} /></FormField>
                <FormField label="Subheading" htmlFor="aisles-subtitle" className="min-w-0"><Input id="aisles-subtitle" value={v.aisles.subtitle} onChange={(e) => set("aisles", { subtitle: e.target.value })} /></FormField>
              </div>
              <div className="flex flex-col gap-3">
                {aisles.map((x, i) => (
                  <Card key={x.id} className="gap-0 p-3 shadow-none">
                    <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                      <ImageSlot id={`aisle-img-${x.id}`} path={x.imagePath} label={`card ${i + 1} photo`} uploading={uploading} className="w-24"
                        onUpload={(f) => uploadTo(f, (p) => setAisle(i, { imagePath: p }))} onRemove={() => setAisle(i, { imagePath: "" })} />
                      <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">Card {i + 1}</span>
                          <div className="flex items-center gap-3">
                            <Label className="flex items-center gap-2 text-sm font-normal">
                              Show
                              <Switch checked={x.enabled} aria-label={`Show card ${i + 1}`} onCheckedChange={(c) => setAisle(i, { enabled: c })} />
                            </Label>
                            {moveButtons(i, aisles.length, moveAisle, () => set("aisles", { items: aisles.filter((_, k) => k !== i) }), `card ${i + 1}`)}
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_88px]">
                          <FormField label="Name" htmlFor={`aisle-label-${x.id}`} className="min-w-0"><Input id={`aisle-label-${x.id}`} value={x.label} onChange={(e) => setAisle(i, { label: e.target.value })} /></FormField>
                          <FormField label="Emoji" htmlFor={`aisle-emoji-${x.id}`} className="min-w-0"><Input id={`aisle-emoji-${x.id}`} value={x.emoji} maxLength={8} onChange={(e) => setAisle(i, { emoji: e.target.value })} /></FormField>
                        </div>
                        <FormField label="Tagline" htmlFor={`aisle-tagline-${x.id}`} className="min-w-0"><Input id={`aisle-tagline-${x.id}`} value={x.tagline} onChange={(e) => setAisle(i, { tagline: e.target.value })} /></FormField>
                        <FormField label="Card goes to" htmlFor={`aisle-link-${x.id}`} className="min-w-0">
                          <LinkSelect id={`aisle-link-${x.id}`} value={x.link} groups={linkGroups} onChange={(link) => setAisle(i, { link })} />
                        </FormField>
                      </div>
                    </div>
                  </Card>
                ))}
                <Button type="button" variant="outline" className="self-start" disabled={aisles.length >= MAX_AISLES}
                  onClick={() => set("aisles", { items: [...aisles, { id: uid("aisle"), label: "New aisle", tagline: "", emoji: "✨", imagePath: "", link: "/shop", enabled: true }] })}>
                  <Plus /> Add card {aisles.length >= MAX_AISLES && `(max ${MAX_AISLES})`}
                </Button>
                <p className="text-xs text-muted-foreground">Photos: portrait, about 800×1000. Without a photo the card shows a pastel colour with the emoji.</p>
              </div>
            </>
          )}
        </TabsContent>

        {/* Product grid */}
        <TabsContent value="products" className="flex flex-col gap-4">
          <ModeRow label="Product grid" value={v.products.mode} onChange={(m) => setMode("products", m)}
            auto="Shows your 8 newest products under “This week's bloom”." />
          {v.products.mode === "custom" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Heading" htmlFor="products-title" className="min-w-0"><Input id="products-title" value={v.products.title} onChange={(e) => set("products", { title: e.target.value })} /></FormField>
                <FormField label="Subheading" htmlFor="products-subtitle" className="min-w-0"><Input id="products-subtitle" value={v.products.subtitle} onChange={(e) => set("products", { subtitle: e.target.value })} /></FormField>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label="Which products" htmlFor="products-source" className="min-w-0">
                  <Select value={v.products.source} onValueChange={(s) => set("products", { source: s as HomepageProductSource })}>
                    <SelectTrigger id="products-source" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{SOURCES.map(([val, l]) => <SelectItem key={val} value={val}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label="Category" htmlFor="products-category" className="min-w-0"
                  description={v.products.source !== "latest" ? "Only used with Newest products." : undefined}>
                  <Select disabled={v.products.source !== "latest"} value={v.products.categoryId != null ? String(v.products.categoryId) : ALL_CATEGORIES}
                    onValueChange={(c) => set("products", { categoryId: c === ALL_CATEGORIES ? null : Number(c) })}>
                    <SelectTrigger id="products-category" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
                      {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="How many" htmlFor="products-limit" className="min-w-0">
                  <Select value={String(v.products.limit)} onValueChange={(n) => set("products", { limit: Number(n) })}>
                    <SelectTrigger id="products-limit" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{[4, 8, 12].map((n) => <SelectItem key={n} value={String(n)}>{n} products</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>
            </>
          )}
        </TabsContent>

        {/* Lookbook */}
        <TabsContent value="lookbook" className="flex flex-col gap-4">
          <ModeRow label="Lookbook" value={v.lookbook.mode} onChange={(m) => setMode("lookbook", m)}
            auto="Spotlights the category most of your newest products are in, with its subcategories, photos and a button to shop it." />
          {v.lookbook.mode === "custom" && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="flex min-w-0 flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Badge" htmlFor="lookbook-tag" className="min-w-0"><Input id="lookbook-tag" value={v.lookbook.tag} onChange={(e) => set("lookbook", { tag: e.target.value })} /></FormField>
                  <FormField label="Button text" htmlFor="lookbook-cta" className="min-w-0"><Input id="lookbook-cta" value={v.lookbook.cta} onChange={(e) => set("lookbook", { cta: e.target.value })} /></FormField>
                </div>
                <FormField label="Headline" htmlFor="lookbook-title" description="Wrap a word in *asterisks* to show it in italics." className="min-w-0">
                  <Input id="lookbook-title" value={v.lookbook.title} onChange={(e) => set("lookbook", { title: e.target.value })} />
                </FormField>
                <FormField label="Text" htmlFor="lookbook-text" className="min-w-0"><Textarea id="lookbook-text" rows={3} value={v.lookbook.text} onChange={(e) => set("lookbook", { text: e.target.value })} /></FormField>
                <FormField label="Button goes to" htmlFor="lookbook-link" className="min-w-0">
                  <LinkSelect id="lookbook-link" value={v.lookbook.link} groups={linkGroups} onChange={(link) => set("lookbook", { link })} />
                </FormField>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Photos</p>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((n) => (
                    <ImageSlot key={n} id={`lookbook-img-${n}`} path={v.lookbook.images[n] ?? ""} label={`lookbook photo ${n + 1}`} uploading={uploading}
                      onUpload={(f) => uploadTo(f, (p) => { const imgs = [v.lookbook.images[0] ?? "", v.lookbook.images[1] ?? ""]; imgs[n] = p; set("lookbook", { images: imgs }) })}
                      onRemove={() => { const imgs = [v.lookbook.images[0] ?? "", v.lookbook.images[1] ?? ""]; imgs[n] = ""; set("lookbook", { images: imgs }) }} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Empty slots use product photos.</p>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Perk cards */}
        <TabsContent value="perks" className="flex flex-col gap-4">
          <ModeRow label="Perk cards" value={v.perks.mode} onChange={(m) => setMode("perks", m)}
            auto="Builds cards from your free-shipping amount, shipping and returns policies, and payment methods." />
          {v.perks.mode === "custom" && (
            <div className="flex flex-col gap-3">
              {perks.map((x, i) => (
                <Card key={x.id} className="gap-3 p-3 shadow-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">Card {i + 1}</span>
                    {moveButtons(i, perks.length, movePerk, () => set("perks", { items: perks.filter((_, k) => k !== i) }), `perk ${i + 1}`)}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <FormField label="Icon" htmlFor={`perk-icon-${x.id}`} className="min-w-0">
                      <Select value={x.icon} onValueChange={(icon) => setPerk(i, { icon: icon as HomepagePerkIcon })}>
                        <SelectTrigger id={`perk-icon-${x.id}`} className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{ICONS.map(([val, l]) => <SelectItem key={val} value={val}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Title" htmlFor={`perk-title-${x.id}`} className="min-w-0"><Input id={`perk-title-${x.id}`} value={x.title} onChange={(e) => setPerk(i, { title: e.target.value })} /></FormField>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Text" htmlFor={`perk-text-${x.id}`} className="min-w-0"><Input id={`perk-text-${x.id}`} value={x.text} onChange={(e) => setPerk(i, { text: e.target.value })} /></FormField>
                    <FormField label="Card goes to" htmlFor={`perk-link-${x.id}`} className="min-w-0">
                      <LinkSelect id={`perk-link-${x.id}`} value={x.link} groups={linkGroups} optional onChange={(link) => setPerk(i, { link })} />
                    </FormField>
                  </div>
                </Card>
              ))}
              <Button type="button" variant="outline" className="self-start" disabled={perks.length >= MAX_PERKS}
                onClick={() => set("perks", { items: [...perks, { id: uid("perk"), icon: "sparkles", title: "New perk", text: "", link: "" }] })}>
                <Plus /> Add card {perks.length >= MAX_PERKS && `(max ${MAX_PERKS})`}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Footer text */}
        <TabsContent value="footer" className="flex flex-col gap-4">
          <ModeRow label="Footer text" value={v.footer.mode} allowHidden={false} onChange={(m) => setMode("footer", m)}
            auto="Shows a short line about clothing for women, men and kids under your store name." />
          {v.footer.mode === "custom" && (
            <FormField label="Text under your store name" htmlFor="footer-tagline" className="min-w-0">
              <Textarea id="footer-tagline" rows={2} value={v.footer.tagline} onChange={(e) => set("footer", { tagline: e.target.value })} />
            </FormField>
          )}
        </TabsContent>
      </Tabs>
    </SectionCard>
  )
}
