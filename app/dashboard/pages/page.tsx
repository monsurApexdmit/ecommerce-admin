"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bell, ChevronDown, Eye, FileText, Plus, Search, Trash2, X } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { localeTag } from "@/lib/i18n"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import notificationApi, { type NotificationResponse } from "@/lib/notificationApi"
import { settingsApi } from "@/lib/settingsApi"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import pageApi, {
  PAGE_PRESETS,
  type ContentPage,
  type ContentPagePayload,
  type PageContent,
  type PagePlace,
  type PagePreset,
  type PageTemplate,
} from "@/lib/pageApi"

type Tab = "all" | "published" | "draft"
/** Translation key in the namespaces this file loads; module-level labels hold keys, translated at render */
type K = ParseKeys<["catalog", "common"]>
const ICONS = ["users", "truck", "award", "globe", "shield-check", "heart", "zap", "target", "star", "package"]
// Icon codes are stored in the page content; these are their display labels
const ICON_LABEL: Record<string, K> = {
  users: "catalog:pages.icons.users", truck: "catalog:pages.icons.truck", award: "catalog:pages.icons.award", globe: "catalog:pages.icons.globe",
  "shield-check": "catalog:pages.icons.shieldCheck", heart: "catalog:pages.icons.heart", zap: "catalog:pages.icons.zap",
  target: "catalog:pages.icons.target", star: "catalog:pages.icons.star", package: "catalog:pages.icons.package",
}
const TYPES: { value: PageTemplate; label: K }[] = [
  { value: "policy", label: "catalog:pages.types.policy" },
  { value: "about", label: "catalog:pages.types.about" },
  { value: "faq", label: "catalog:pages.types.faq" },
  { value: "custom", label: "catalog:pages.types.custom" },
]
const PLACES: { value: PagePlace; label: K }[] = [
  { value: "footer", label: "catalog:pages.places.footer" },
  { value: "header", label: "catalog:pages.places.header" },
  { value: "checkout", label: "catalog:pages.places.checkout" },
  { value: "none", label: "catalog:pages.places.none" },
]
const TYPE_LABEL: Record<string, K> = Object.fromEntries(TYPES.map((x) => [x.value, x.label]))

// Standard storefront slugs that already count as a quick-start page.
const PRESET_ALIASES: Record<string, string[]> = {
  about: ["about", "about-us"],
  faq: ["faq", "faqs"],
  returns: ["returns", "returns-refunds", "refund-policy", "returns-and-refunds"],
  shipping: ["shipping", "shipping-policy"],
  privacy: ["privacy", "privacy-policy"],
}

// Starter templates (custom pages). Label/summary/body are translation keys; the blank page starts empty.
const STARTERS: { label: K; slug: string; type: PageTemplate; summary: K | null; body: K | null }[] = [
  { label: "catalog:pages.starters.contact.label", slug: "contact", type: "about", summary: "catalog:pages.starters.contact.summary", body: "catalog:pages.starters.contact.body" },
  { label: "catalog:pages.starters.sizeGuide.label", slug: "size-guide", type: "custom", summary: "catalog:pages.starters.sizeGuide.summary", body: "catalog:pages.starters.sizeGuide.body" },
  { label: "catalog:pages.starters.blank.label", slug: "", type: "custom", summary: null, body: null },
]

interface FormState {
  title: string; slug: string; type: PageTemplate; place: PagePlace; summary: string; body: string
  heroKicker: string; heroTitle: string; heroDesc: string; seoTitle: string; seoDesc: string
  valuesHeading: string; teamHeading: string
  stats: { label: string; value: string; icon: string }[]
  values: { title: string; description: string; icon: string }[]
  team: { name: string; role: string; bio: string }[]
  faq: { title: string; items: { q: string; a: string }[] }[]
  sections: { title: string; text: string }[]
  isPublished: boolean
  slugTouched: boolean
}

const blank = (): FormState => ({
  title: "", slug: "", type: "custom", place: "footer", summary: "", body: "",
  heroKicker: "", heroTitle: "", heroDesc: "", seoTitle: "", seoDesc: "",
  valuesHeading: "What we stand for", teamHeading: "Meet the team",
  stats: [], values: [], team: [], faq: [], sections: [], isPublished: false, slugTouched: false,
})

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const paras = (t: string) => t.split(/\n\s*\n/).map((x) => x.replace(/\s+/g, " ").trim()).filter(Boolean)

const typeOf = (p: { type?: PageTemplate; content: PageContent; slug: string }): PageTemplate =>
  p.type && p.type !== "custom" ? p.type : ((p.content as { template?: PageTemplate })?.template ?? p.type ?? "custom")

function fromPage(p: ContentPage): FormState {
  const c = p.content as any
  const type = typeOf(p)
  return {
    ...blank(),
    title: p.title, slug: p.slug, type, place: p.place ?? "footer", summary: p.summary ?? "", body: p.body ?? "",
    heroKicker: c?.hero?.kicker ?? "", heroTitle: c?.hero?.title ?? "", heroDesc: c?.hero?.description ?? "",
    seoTitle: c?.seo?.title ?? "", seoDesc: c?.seo?.description ?? "",
    valuesHeading: c?.valuesHeading ?? "What we stand for", teamHeading: c?.teamHeading ?? "Meet the team",
    stats: (c?.stats ?? []).map((r: any) => ({ label: r.label ?? "", value: r.value ?? "", icon: r.icon || "users" })),
    values: (c?.values ?? []).map((r: any) => ({ title: r.title ?? "", description: r.description ?? "", icon: r.icon || "heart" })),
    team: (c?.team ?? []).map((r: any) => ({ name: r.name ?? "", role: r.role ?? "", bio: r.bio ?? "" })),
    faq: (c?.faqCategories ?? []).map((cat: any) => ({ title: cat.title ?? "", items: (cat.items ?? []).map((i: any) => ({ q: i.question ?? "", a: i.answer ?? "" })) })),
    sections: (c?.sections ?? []).map((s: any) => ({ title: s.title ?? "", text: (s.paragraphs ?? []).join("\n\n") })),
    isPublished: p.isPublished, slugTouched: true,
  }
}

function fromPreset(pr: PagePreset): FormState {
  return fromPage({
    id: 0, title: pr.title, slug: pr.slug, summary: pr.summary, type: pr.content.template, place: "footer", body: "",
    isPublished: true, publishedAt: null, createdAt: "", updatedAt: "", content: pr.content,
  })
}

/** Validate the form and turn it into an API payload. Returns an error message key (+ values) on failure. */
function buildPayload(f: FormState): { error: K; values?: Record<string, string | number> } | { payload: ContentPagePayload } {
  const title = f.title.trim()
  const slug = slugify(f.slug || f.title)
  if (!title) return { error: "catalog:pages.errors.titleRequired" }
  if (!slug) return { error: "catalog:pages.errors.addressRequired" }
  const hero = { kicker: f.heroKicker.trim(), title: f.heroTitle.trim(), description: f.heroDesc.trim() }
  const seo = { title: f.seoTitle.trim(), description: f.seoDesc.trim() }
  let content: PageContent
  let body = f.body

  if (f.type === "about") {
    const stats = f.stats.filter((r) => r.label.trim() || r.value.trim())
    const values = f.values.filter((r) => r.title.trim() || r.description.trim())
    const team = f.team.filter((r) => r.name.trim() || r.role.trim() || r.bio.trim())
    let i = stats.findIndex((r) => !r.label.trim() || !r.value.trim())
    if (i >= 0) return { error: "catalog:pages.errors.stat", values: { n: i + 1 } }
    i = values.findIndex((r) => !r.title.trim())
    if (i >= 0) return { error: "catalog:pages.errors.value", values: { n: i + 1 } }
    i = team.findIndex((r) => !r.name.trim())
    if (i >= 0) return { error: "catalog:pages.errors.member", values: { n: i + 1 } }
    content = {
      template: "about", hero, seo, valuesHeading: f.valuesHeading.trim(), teamHeading: f.teamHeading.trim(),
      stats: stats.map((r) => ({ label: r.label.trim(), value: r.value.trim(), icon: r.icon || "users" })),
      values: values.map((r) => ({ title: r.title.trim(), description: r.description.trim(), icon: r.icon || "heart" })),
      team: team.map((r) => ({ name: r.name.trim(), role: r.role.trim(), bio: r.bio.trim() })),
    }
  } else if (f.type === "faq") {
    const cats = f.faq.map((c) => ({ title: c.title.trim(), items: c.items.filter((x) => x.q.trim() || x.a.trim()) })).filter((c) => c.title || c.items.length)
    for (let i = 0; i < cats.length; i++) {
      if (!cats[i].title) return { error: "catalog:pages.errors.faqCat", values: { n: i + 1 } }
      const j = cats[i].items.findIndex((x) => !x.q.trim() || !x.a.trim())
      if (j >= 0) return { error: "catalog:pages.errors.faqItem", values: { title: cats[i].title, n: j + 1 } }
    }
    content = { template: "faq", hero, seo, faqCategories: cats.map((c) => ({ title: c.title, items: c.items.map((x) => ({ question: x.q.trim(), answer: x.a.trim() })) })) }
    // Markdown copy of the structured content, kept in sync so the storefront can render `body`.
    body = cats.map((c) => [`## ${c.title}`, ...c.items.map((x) => `**${x.q.trim()}**\n\n${x.a.trim()}`)].join("\n\n")).join("\n\n")
  } else if (f.type === "policy") {
    const secs = f.sections.map((x) => ({ title: x.title.trim(), paragraphs: paras(x.text) })).filter((x) => x.title || x.paragraphs.length)
    const i = secs.findIndex((x) => !x.title)
    if (i >= 0) return { error: "catalog:pages.errors.section", values: { n: i + 1 } }
    content = { template: "policy", hero, seo, sections: secs }
    body = secs.map((x) => [`## ${x.title}`, ...x.paragraphs].join("\n\n")).join("\n\n")
  } else {
    content = { template: "custom", hero, seo }
  }
  return { payload: { title, slug, type: f.type, place: f.place, summary: f.summary.trim(), body, isPublished: f.isPublished, content } }
}

interface Block { h: boolean; text: string }
const mdBlocks = (txt: string): Block[] =>
  txt.split("\n").filter((l) => l.trim()).map((l) => {
    const m = /^#{1,3}\s+(.*)$/.exec(l)
    const t = (m ? m[1] : l).replace(/\*\*(.+?)\*\*/g, "$1").replace(/_(.+?)_/g, "$1").replace(/^[-*]\s+/, "• ")
    return { h: !!m, text: t }
  })

function previewBlocks(f: FormState, question: (text: string) => string): Block[] {
  const b: Block[] = []
  if (f.heroKicker.trim()) b.push({ h: false, text: f.heroKicker.trim().toUpperCase() })
  if (f.heroTitle.trim()) b.push({ h: true, text: f.heroTitle.trim() })
  if (f.heroDesc.trim()) b.push({ h: false, text: f.heroDesc.trim() })
  if (f.type === "about") {
    b.push(...mdBlocks(f.body))
    f.stats.filter((r) => r.label || r.value).forEach((r) => b.push({ h: false, text: `${r.value} ${r.label}` }))
    if (f.values.length) { b.push({ h: true, text: f.valuesHeading }); f.values.filter((r) => r.title).forEach((r) => b.push({ h: false, text: `${r.title}: ${r.description}` })) }
    if (f.team.length) { b.push({ h: true, text: f.teamHeading }); f.team.filter((r) => r.name).forEach((r) => b.push({ h: false, text: `${r.name}, ${r.role}. ${r.bio}` })) }
  } else if (f.type === "faq") {
    f.faq.forEach((c) => {
      if (c.title) b.push({ h: true, text: c.title })
      c.items.forEach((i) => { if (i.q) b.push({ h: false, text: question(i.q) }); if (i.a) b.push({ h: false, text: i.a }) })
    })
  } else if (f.type === "policy") {
    f.sections.forEach((s) => { if (s.title) b.push({ h: true, text: s.title }); paras(s.text).forEach((t) => b.push({ h: false, text: t })) })
  } else b.push(...mdBlocks(f.body))
  return b
}

export default function PagesManagementPage() {
  const { t, i18n } = useTranslation(["catalog", "common"])
  const blocked = useModuleGuard("Pages")
  const fmtD = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(localeTag(i18n.language), { month: "short", day: "numeric", year: "numeric" }) : "")

  const [pages, setPages] = useState<ContentPage[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [pageNo, setPageNo] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [selId, setSelId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [dirty, setDirty] = useState(false)
  const [err, setErr] = useState("")
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [creatingAll, setCreatingAll] = useState(false)
  const [notifs, setNotifs] = useState<NotificationResponse[]>([])
  const [unread, setUnread] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [storeUrl, setStoreUrl] = useState("")
  const seeded = useRef(false)

  const load = useCallback(async (selectFirst = false) => {
    try {
      const list = await pageApi.getAll()
      setPages(list)
      if (selectFirst && list[0]) { setSelId(list[0].id); setForm(fromPage(list[0])) }
      return list
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("catalog:pages.toast.loadFailed"))
      return []
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadNotifs = useCallback(async () => {
    try {
      const r = await notificationApi.getAll({ limit: 6, sort: "newest" })
      setNotifs(r.data ?? [])
      setUnread(r.meta?.unreadCount ?? 0)
    } catch { /* header bell is non-critical */ }
  }, [])

  useEffect(() => {
    void (async () => {
      const list = await load(true)
      // Seed the About page once if the store has none yet.
      if (seeded.current) return
      seeded.current = true
      const hasAbout = list.some((p) => (PRESET_ALIASES.about).includes(p.slug))
      let flagged = false
      try { flagged = localStorage.getItem("pages_about_seeded") === "1" } catch { /* ignore */ }
      if (!hasAbout && !flagged) {
        const pr = PAGE_PRESETS.find((x) => x.slug === "about")
        if (pr) {
          try {
            const created = await pageApi.create({ title: pr.title, slug: pr.slug, summary: pr.summary, type: "about", place: "footer", body: "", isPublished: false, content: pr.content })
            try { localStorage.setItem("pages_about_seeded", "1") } catch { /* ignore */ }
            const after = await load()
            const rec0 = after.find((p) => p.id === created.id)
            if (rec0 && after.length === 1) { setSelId(rec0.id); setForm(fromPage(rec0)) }
          } catch { /* seeding is best effort */ }
        }
      } else if (hasAbout) {
        try { localStorage.setItem("pages_about_seeded", "1") } catch { /* ignore */ }
      }
    })()
    void loadNotifs()
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("notifications") === "1") setNotifOpen(true)
    settingsApi.getAll().then((r) => {
      const o = r.data?.business?.onlineStore
      const host = (o?.slug ?? "").trim()
      setStoreUrl(o?.published && host.includes(".") ? `https://${host}` : "")
    }).catch(() => {})
  }, [load, loadNotifs])

  const rec = useMemo(() => pages.find((p) => p.id === selId) ?? null, [pages, selId])
  const sorted = useMemo(() => [...pages].sort((a, b) => a.title.localeCompare(b.title)), [pages])
  const counts = { all: pages.length, published: pages.filter((p) => p.isPublished).length, draft: pages.filter((p) => !p.isPublished).length }
  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return sorted.filter((p) => (tab === "all" || (tab === "published") === p.isPublished) && (!ql || `${p.title} ${p.slug}`.toLowerCase().includes(ql)))
  }, [sorted, tab, q])
  const rows = shown.slice((pageNo - 1) * perPage, pageNo * perPage)

  const missing = useMemo(() => {
    const have = new Set(pages.map((p) => p.slug))
    return PAGE_PRESETS.filter((pr) => !(PRESET_ALIASES[pr.slug] ?? [pr.slug]).some((a) => have.has(a)))
  }, [pages])

  const f = form
  const blocks = useMemo(() => (f ? previewBlocks(f, (text) => t("catalog:pages.previewQuestion", { text })) : []), [f, t])
  const words = blocks.reduce((n, b) => n + (b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0)

  if (blocked) return blocked

  const patch = (p: Partial<FormState>) => { setForm((cur) => (cur ? { ...cur, ...p } : cur)); setDirty(true); setErr("") }
  const open = (p: ContentPage) => { setSelId(p.id); setForm(fromPage(p)); setDirty(false); setErr(""); setPreviewing(false) }
  const startNew = (init: FormState) => { setSelId(null); setForm(init); setDirty(false); setErr(""); setPreviewing(false) }

  const upRow = <K extends "stats" | "values" | "team" | "sections">(k: K, i: number, p: Partial<FormState[K][number]>) =>
    patch({ [k]: (f![k] as any[]).map((x, j) => (j === i ? { ...x, ...p } : x)) } as Partial<FormState>)
  const delRow = (k: "stats" | "values" | "team" | "sections", i: number) => patch({ [k]: (f![k] as any[]).filter((_, j) => j !== i) } as Partial<FormState>)
  const upCat = (i: number, p: Partial<FormState["faq"][number]>) => patch({ faq: f!.faq.map((c, j) => (j === i ? { ...c, ...p } : c)) })

  const save = async () => {
    if (!f) return
    const r = buildPayload(f)
    if ("error" in r) { setErr(t(r.error, r.values)); return }
    setSaving(true)
    try {
      const saved = rec ? await pageApi.update(rec.id, r.payload) : await pageApi.create(r.payload)
      toast.success(rec ? t("catalog:pages.toast.saved") : t("catalog:pages.toast.created"))
      await load()
      setSelId(saved.id); setForm(fromPage(saved)); setDirty(false); setErr("")
    } catch (e: any) {
      const errs = e?.response?.data?.errors
      const msg = errs?.slug?.[0] ? t("catalog:pages.errors.addressTaken", { slug: r.payload.slug }) : (errs && (Object.values(errs)[0] as string[])?.[0]) || e?.response?.data?.message || t("catalog:pages.toast.saveFailed")
      setErr(msg)
    } finally { setSaving(false) }
  }

  const togglePublish = async () => {
    if (!f) return
    if (!rec) { patch({ isPublished: !f.isPublished }); return }
    if (!rec.isPublished && !rec.title.trim()) { setErr(t("catalog:pages.errors.addTitleFirst")); return }
    setSaving(true)
    try {
      const saved = await pageApi.update(rec.id, { isPublished: !rec.isPublished })
      toast.success(saved.isPublished ? t("catalog:pages.toast.published") : t("catalog:pages.toast.unpublished"))
      await load()
      setForm((cur) => (cur ? { ...cur, isPublished: saved.isPublished } : cur))
    } catch (e: any) { toast.error(e?.response?.data?.message || t("catalog:pages.toast.statusFailed")) }
    finally { setSaving(false) }
  }

  const remove = async () => {
    if (!rec) { const first = sorted[0]; if (first) open(first); else { setForm(null); setSelId(null) } return }
    if (!window.confirm(t("common:confirm.deleteTitle", { name: `"${rec.title}"` }))) return
    try {
      await pageApi.delete(rec.id)
      toast.success(t("catalog:pages.toast.deleted"))
      const list = await load()
      const next = [...list].sort((a, b) => a.title.localeCompare(b.title)).find((p) => p.id !== rec.id)
      if (next) open(next); else { setSelId(null); setForm(null) }
    } catch (e: any) { toast.error(e?.response?.data?.message || t("catalog:pages.toast.deleteFailed")) }
  }

  const createAll = async () => {
    setCreatingAll(true)
    try {
      for (const pr of missing) {
        await pageApi.create({ title: pr.title, slug: pr.slug, summary: pr.summary, type: pr.content.template, place: "footer", body: "", isPublished: true, content: pr.content })
      }
      toast.success(t("catalog:pages.toast.allCreated"))
      await load()
    } catch (e: any) { toast.error(e?.response?.data?.message || t("catalog:pages.toast.createAllFailed")); await load() }
    finally { setCreatingAll(false) }
  }

  const published = rec ? rec.isPublished : f?.isPublished ?? false
  const bodyEditable = f && (f.type === "about" || f.type === "custom")

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("catalog:pages.title")}
        description={t("catalog:pages.description")}
        actions={<>
          <Popover open={notifOpen} onOpenChange={(o) => { setNotifOpen(o); if (o) void loadNotifs() }}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="relative" aria-label={t("catalog:pages.notifications")}>
                <Bell className="size-4" /> {t("catalog:pages.notifications")}
                {unread > 0 && <Badge className="h-5 min-w-5 rounded-full px-1">{unread > 99 ? "99+" : unread}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[360px] p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold">{t("catalog:pages.notifications")}</span>
                <Button type="button" variant="link" size="sm" disabled={unread === 0}
                  onClick={async () => { try { await notificationApi.markAllAsRead(); await loadNotifs() } catch (e: any) { toast.error(e?.response?.data?.message || t("catalog:pages.toast.markAllFailed")) } }}>
                  {t("catalog:pages.markAllRead")}
                </Button>
              </div>
              <Separator />
              <div className="max-h-[360px] overflow-y-auto">
                {notifs.length === 0 ? (
                  <EmptyState title={t("catalog:pages.noNotifs")} className="p-6 md:p-6" />
                ) : (
                  <ItemGroup>
                    {notifs.map((n, i) => (
                      <Fragment key={n.id}>
                        {i > 0 && <ItemSeparator />}
                        <Item size="sm" variant={n.readAt ? "default" : "muted"} className="rounded-none">
                          <ItemContent className="gap-0.5">
                            <ItemTitle>{n.title}</ItemTitle>
                            <ItemDescription className="text-xs">{n.message}</ItemDescription>
                            <span className="text-xs text-muted-foreground">{fmtD(n.createdAt)}</span>
                          </ItemContent>
                        </Item>
                      </Fragment>
                    ))}
                  </ItemGroup>
                )}
              </div>
              <Separator />
              <Button asChild variant="ghost" className="w-full rounded-none"><Link href="/dashboard/notifications">{t("catalog:pages.viewAllNotifs")}</Link></Button>
            </PopoverContent>
          </Popover>
          {storeUrl
            ? <Button asChild variant="outline"><a href={storeUrl} target="_blank" rel="noopener noreferrer">{t("catalog:pages.viewStore")}</a></Button>
            : <WithTooltip content={t("catalog:pages.viewStoreTip")}><span tabIndex={0} className="inline-flex"><Button type="button" variant="outline" disabled>{t("catalog:pages.viewStore")}</Button></span></WithTooltip>}
          <Button type="button" onClick={() => startNew(blank())}><Plus className="size-4" /> {t("catalog:pages.newPage")}</Button>
        </>}
      />

      {!loading && missing.length > 0 && (
        <SectionCard title={t("catalog:pages.quickStart")} description={t("catalog:pages.quickStartDesc")}>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={createAll} disabled={creatingAll}>
              {creatingAll && <Spinner />} {t("catalog:pages.createAll")}
            </Button>
            {missing.map((pr) => (
              <Button key={pr.slug} type="button" onClick={() => startNew({ ...fromPreset(pr), isPublished: true })} variant="outline">{t("catalog:pages.addItem", { name: pr.title })}</Button>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* List */}
        <Card className="gap-3 p-4">
          <StatusTabs value={tab} onChange={(v) => { setTab(v as Tab); setPageNo(1) }}
            tabs={[{ value: "all", label: t("common:status.all"), count: counts.all }, { value: "published", label: t("common:status.published"), count: counts.published }, { value: "draft", label: t("catalog:pages.drafts"), count: counts.draft }]} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPageNo(1) }} placeholder={t("catalog:pages.searchPlaceholder")} aria-label={t("catalog:pages.searchLabel")} className="pl-9" />
          </div>
          {loading ? (
            <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState title={t("catalog:pages.noMatch")} className="p-6 md:p-6" />
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((p) => {
                const on = p.id === selId
                return (
                  <Button key={p.id} type="button" variant={on ? "secondary" : "outline"} onClick={() => open(p)} aria-pressed={on}
                    className="h-auto w-full flex-col items-stretch gap-1 whitespace-normal text-left font-normal">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{p.title}</span>
                      <StatusBadge className="shrink-0" status={p.isPublished ? "published" : "draft"} label={p.isPublished ? t("common:status.published") : t("common:status.draft")} />
                    </span>
                    <span className="text-xs text-muted-foreground">aura.shop/{p.slug}</span>
                    <span className="text-xs text-muted-foreground">
                      {t("catalog:pages.meta", {
                        type: t(TYPE_LABEL[typeOf(p)] ?? "catalog:pages.types.custom"),
                        code: typeOf(p),
                        updated: fmtD(p.updatedAt || p.createdAt),
                        published: p.publishedAt ? t("catalog:pages.publishedOn", { date: fmtD(p.publishedAt) }) : t("catalog:pages.notPublished"),
                      })}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{p.summary || t("catalog:pages.noSummary")}</span>
                  </Button>
                )
              })}
            </div>
          )}
          {shown.length > 0 && (
            <PaginationControl currentPage={pageNo} totalPages={Math.max(1, Math.ceil(shown.length / perPage))} itemsPerPage={perPage} totalItems={shown.length}
              onPageChange={setPageNo} onItemsPerPageChange={(n) => { setPerPage(n); setPageNo(1) }} />
          )}
          <Separator />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("catalog:pages.startTemplate")}</span>
            <div role="group" aria-label={t("catalog:pages.templates")} className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <Button key={s.label} type="button" variant="outline" size="sm" onClick={() => startNew({
                  ...blank(), title: s.slug ? t(s.label) : "", slug: s.slug, type: s.type,
                  summary: s.summary ? t(s.summary) : "", body: s.body ? t(s.body) : "", slugTouched: !!s.slug,
                })}>{t("catalog:pages.addItem", { name: t(s.label) })}</Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Editor */}
        <Card className="gap-0 py-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-[42px] w-full" /><Skeleton className="h-40 w-full" /></div>
          ) : !f ? (
            <EmptyState icon={FileText} title={t("catalog:pages.noSelection")} description={t("catalog:pages.noSelectionDesc")} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 p-4">
                <StatusBadge status={published ? "published" : "draft"} label={published ? t("common:status.published") : t("common:status.draft")} />
                <span className="text-xs text-muted-foreground">
                  {rec
                    ? t("catalog:pages.editorMeta", { updated: fmtD(rec.updatedAt || rec.createdAt), published: rec.publishedAt ? fmtD(rec.publishedAt) : t("catalog:pages.notPublished") })
                    : t("catalog:pages.newUnsaved")}{dirty ? ` ${t("catalog:pages.unsavedSuffix")}` : ""}
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button type="button" onClick={() => setPreviewing((v) => !v)} aria-pressed={previewing} variant="outline"><Eye className="size-4" />{previewing ? t("catalog:pages.backToEditor") : t("catalog:pages.preview")}</Button>
                  <Button type="button" onClick={togglePublish} disabled={saving} variant="outline">{published ? t("catalog:shared.unpublish") : t("catalog:shared.publish")}</Button>
                  <Button type="button" onClick={save} disabled={saving}>
                    {saving && <Spinner />}{!rec ? t("catalog:pages.createPage") : published ? t("catalog:pages.updateLive") : t("catalog:pages.saveDraft")}
                  </Button>
                </div>
              </div>
              <Separator />

              <div className="flex flex-col gap-4 p-5">
                {err && <Alert variant="destructive" role="alert"><AlertDescription>{err}</AlertDescription></Alert>}
                <Input type="text" value={f.title} placeholder={t("catalog:pages.pageTitle")} aria-label={t("catalog:pages.pageTitle")}
                  onChange={(e) => { const v = e.target.value; patch(rec || f.slugTouched ? { title: v } : { title: v, slug: slugify(v) }) }}
                  />
                <div className="grid gap-3 md:grid-cols-3">
                  <FormField label={t("catalog:pages.address")} htmlFor="page-slug">
                    <InputGroup>
                      <InputGroupAddon><InputGroupText>aura.shop/</InputGroupText></InputGroupAddon>
                      <InputGroupInput id="page-slug" type="text" value={f.slug} onChange={(e) => patch({ slug: slugify(e.target.value), slugTouched: true })} />
                    </InputGroup>
                  </FormField>
                  <FormField label={t("common:fields.type")} htmlFor="page-type">
                    <Select value={f.type} onValueChange={(v) => patch({ type: v as PageTemplate })}>
                      <SelectTrigger id="page-type" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map((x) => <SelectItem key={x.value} value={x.value}>{t(x.label)}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                  <FormField label={t("catalog:pages.showLinkIn")} htmlFor="page-place">
                    <Select value={f.place} onValueChange={(v) => patch({ place: v as PagePlace })}>
                      <SelectTrigger id="page-place" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{PLACES.map((x) => <SelectItem key={x.value} value={x.value}>{t(x.label)}</SelectItem>)}</SelectContent>
                    </Select>
                  </FormField>
                </div>

                <SectionCard title={t("catalog:pages.headerCard")} className="gap-3 py-4" contentClassName="flex flex-col gap-3 px-4">
                  <FormField label={t("catalog:pages.summaryInternal")} htmlFor="page-summary">
                    <Textarea id="page-summary" rows={2} value={f.summary} onChange={(e) => patch({ summary: e.target.value })} placeholder={t("catalog:pages.summaryPlaceholder")} />
                  </FormField>
                  <div className="grid gap-3 md:grid-cols-3">
                    <FormField label={t("catalog:pages.heroKicker")} htmlFor="page-hero-kicker"><Input id="page-hero-kicker" type="text" value={f.heroKicker} onChange={(e) => patch({ heroKicker: e.target.value })} placeholder={t("catalog:pages.heroKickerPlaceholder")} /></FormField>
                    <FormField label={t("catalog:pages.heroTitle")} htmlFor="page-hero-title"><Input id="page-hero-title" type="text" value={f.heroTitle} onChange={(e) => patch({ heroTitle: e.target.value })} /></FormField>
                    <FormField label={t("catalog:shared.seoTitle")} htmlFor="page-seo-title"><Input id="page-seo-title" type="text" value={f.seoTitle} onChange={(e) => patch({ seoTitle: e.target.value })} placeholder="About us | Aura Shop" /></FormField>
                  </div>
                  <FormField label={t("catalog:pages.heroDesc")} htmlFor="page-hero-desc">
                    <Textarea id="page-hero-desc" rows={2} value={f.heroDesc} onChange={(e) => patch({ heroDesc: e.target.value })} />
                  </FormField>
                </SectionCard>

                {previewing ? (
                  <Card className="gap-2 bg-muted/50 p-5 shadow-none">
                    {blocks.map((b, i) => b.h
                      ? <h3 key={i} className="text-lg font-semibold">{b.text}</h3>
                      : <p key={i} className="text-sm leading-relaxed">{b.text}</p>)}
                    {blocks.length === 0 && <span className="text-sm text-muted-foreground">{t("catalog:pages.noContent")}</span>}
                  </Card>
                ) : (
                  <>
                    {bodyEditable && (
                      <div className="flex flex-col gap-2">
                        <div role="toolbar" aria-label={t("catalog:pages.format.toolbar")} className="flex flex-wrap gap-1.5">
                          {([
                            ["catalog:pages.format.heading", "H", "catalog:pages.format.headingSample"],
                            ["catalog:pages.format.bold", "B", "catalog:pages.format.boldSample"],
                            ["catalog:pages.format.italic", "I", "catalog:pages.format.italicSample"],
                            ["catalog:pages.format.bullets", "•", "catalog:pages.format.bulletSample"],
                            ["catalog:pages.format.numbered", "1.", "catalog:pages.format.numberedSample"],
                            ["catalog:pages.format.link", "↗", "catalog:pages.format.linkSample"],
                            ["catalog:pages.format.divider", "—", null],
                          ] as const).map(([label, glyph, sample]) => (
                            <WithTooltip key={label} content={t(label)}>
                              <Button type="button" aria-label={t(label)} variant="outline" size="icon"
                                onClick={() => patch({ body: (f.body ? f.body.replace(/\s+$/, "") + "\n" : "") + (sample ? t(sample) : "---") })}>{glyph}</Button>
                            </WithTooltip>
                          ))}
                        </div>
                        <Textarea rows={12} value={f.body} onChange={(e) => patch({ body: e.target.value })} aria-label={f.type === "about" ? t("catalog:pages.storyContent") : t("catalog:pages.pageContent")}
                          placeholder={f.type === "about" ? t("catalog:pages.storyPlaceholder") : t("catalog:pages.contentPlaceholder")} />
                        <span className="text-xs text-muted-foreground">{t("catalog:pages.markdownHelp")}</span>
                      </div>
                    )}

                    {f.type === "about" && (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <strong className="text-sm">{t("catalog:pages.about.stats")}</strong>
                          {f.stats.length === 0 && <span className="text-sm text-muted-foreground">{t("catalog:pages.about.noStats")}</span>}
                          {f.stats.map((r, i) => (
                            <div key={i} className="flex flex-wrap gap-2">
                              <Input type="text" value={r.label} onChange={(e) => upRow("stats", i, { label: e.target.value })} placeholder={t("catalog:pages.about.statLabelPh")} aria-label={t("catalog:pages.about.statLabel")} className="min-w-40 flex-1" />
                              <Input type="text" value={r.value} onChange={(e) => upRow("stats", i, { value: e.target.value })} placeholder={t("catalog:pages.about.statValuePh")} aria-label={t("catalog:pages.about.statValue")} className="min-w-32 flex-1" />
                              <Select value={r.icon} onValueChange={(v) => upRow("stats", i, { icon: v })}><SelectTrigger aria-label={t("catalog:pages.about.statIcon")} className="w-40"><SelectValue /></SelectTrigger><SelectContent>{ICONS.map((o) => <SelectItem key={o} value={o}>{ICON_LABEL[o] ? t(ICON_LABEL[o]) : o}</SelectItem>)}</SelectContent></Select>
                              <WithTooltip content={t("catalog:pages.about.removeStat")}><Button type="button" onClick={() => delRow("stats", i)} aria-label={t("catalog:pages.about.removeStat")} variant="outline" size="icon"><X className="size-4" /></Button></WithTooltip>
                            </div>
                          ))}
                          <Button type="button" onClick={() => patch({ stats: [...f.stats, { label: "", value: "", icon: "users" }] })} variant="outline" size="sm" className="self-start">{t("catalog:pages.about.addStat")}</Button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <FormField label={t("catalog:pages.about.valuesHeading")} htmlFor="page-values-heading"><Input id="page-values-heading" type="text" value={f.valuesHeading} onChange={(e) => patch({ valuesHeading: e.target.value })} /></FormField>
                          {f.values.length === 0 && <span className="text-sm text-muted-foreground">{t("catalog:pages.about.noValues")}</span>}
                          {f.values.map((r, i) => (
                            <div key={i} className="flex flex-wrap gap-2">
                              <Input type="text" value={r.title} onChange={(e) => upRow("values", i, { title: e.target.value })} placeholder={t("catalog:pages.about.titlePh")} aria-label={t("catalog:pages.about.valueTitle")} className="min-w-40 flex-1" />
                              <Input type="text" value={r.description} onChange={(e) => upRow("values", i, { description: e.target.value })} placeholder={t("common:fields.description")} aria-label={t("catalog:pages.about.valueDesc")} className="min-w-48 flex-[2]" />
                              <Select value={r.icon} onValueChange={(v) => upRow("values", i, { icon: v })}><SelectTrigger aria-label={t("catalog:pages.about.valueIcon")} className="w-40"><SelectValue /></SelectTrigger><SelectContent>{ICONS.map((o) => <SelectItem key={o} value={o}>{ICON_LABEL[o] ? t(ICON_LABEL[o]) : o}</SelectItem>)}</SelectContent></Select>
                              <WithTooltip content={t("catalog:pages.about.removeValue")}><Button type="button" onClick={() => delRow("values", i)} aria-label={t("catalog:pages.about.removeValue")} variant="outline" size="icon"><X className="size-4" /></Button></WithTooltip>
                            </div>
                          ))}
                          <Button type="button" onClick={() => patch({ values: [...f.values, { title: "", description: "", icon: "heart" }] })} variant="outline" size="sm" className="self-start">{t("catalog:pages.about.addValue")}</Button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <FormField label={t("catalog:pages.about.teamHeading")} htmlFor="page-team-heading"><Input id="page-team-heading" type="text" value={f.teamHeading} onChange={(e) => patch({ teamHeading: e.target.value })} /></FormField>
                          {f.team.length === 0 && <span className="text-sm text-muted-foreground">{t("catalog:pages.about.noTeam")}</span>}
                          {f.team.map((r, i) => (
                            <div key={i} className="flex flex-wrap gap-2">
                              <Input type="text" value={r.name} onChange={(e) => upRow("team", i, { name: e.target.value })} placeholder={t("common:fields.name")} aria-label={t("catalog:pages.about.memberName")} className="min-w-36 flex-1" />
                              <Input type="text" value={r.role} onChange={(e) => upRow("team", i, { role: e.target.value })} placeholder={t("catalog:pages.about.rolePh")} aria-label={t("catalog:pages.about.memberRole")} className="min-w-36 flex-1" />
                              <Input type="text" value={r.bio} onChange={(e) => upRow("team", i, { bio: e.target.value })} placeholder={t("catalog:pages.about.bioPh")} aria-label={t("catalog:pages.about.memberBio")} className="min-w-48 flex-[2]" />
                              <WithTooltip content={t("catalog:pages.about.removeMember")}><Button type="button" onClick={() => delRow("team", i)} aria-label={t("catalog:pages.about.removeMember")} variant="outline" size="icon"><X className="size-4" /></Button></WithTooltip>
                            </div>
                          ))}
                          <Button type="button" onClick={() => patch({ team: [...f.team, { name: "", role: "", bio: "" }] })} variant="outline" size="sm" className="self-start">{t("catalog:pages.about.addMember")}</Button>
                        </div>
                      </div>
                    )}

                    {f.type === "faq" && (
                      <div className="flex flex-col gap-3">
                        {f.faq.length === 0 && <span className="text-sm text-muted-foreground">{t("catalog:pages.faq.noCats")}</span>}
                        {f.faq.map((c, ci) => (
                          <Card key={ci} className="gap-2 p-3 shadow-none">
                            <div className="flex gap-2">
                              <Input type="text" value={c.title} onChange={(e) => upCat(ci, { title: e.target.value })} placeholder={t("catalog:pages.faq.catTitlePh")} aria-label={t("catalog:pages.faq.catTitle")} />
                              <WithTooltip content={t("catalog:pages.faq.removeCat")}><Button type="button" onClick={() => patch({ faq: f.faq.filter((_, j) => j !== ci) })} aria-label={t("catalog:pages.faq.removeCat")} variant="outline" size="icon"><X className="size-4" /></Button></WithTooltip>
                            </div>
                            {c.items.map((it, qi) => (
                              <div key={qi} className="flex gap-2">
                                <div className="flex flex-1 flex-col gap-2">
                                  <Input type="text" value={it.q} onChange={(e) => upCat(ci, { items: c.items.map((x, n) => (n === qi ? { ...x, q: e.target.value } : x)) })} placeholder={t("catalog:pages.faq.question")} aria-label={t("catalog:pages.faq.question")} />
                                  <Textarea rows={2} value={it.a} onChange={(e) => upCat(ci, { items: c.items.map((x, n) => (n === qi ? { ...x, a: e.target.value } : x)) })} placeholder={t("catalog:pages.faq.answer")} aria-label={t("catalog:pages.faq.answer")} />
                                </div>
                                <WithTooltip content={t("catalog:pages.faq.removeQuestion")}><Button type="button" onClick={() => upCat(ci, { items: c.items.filter((_, n) => n !== qi) })} aria-label={t("catalog:pages.faq.removeQuestion")} variant="outline" size="icon"><X className="size-4" /></Button></WithTooltip>
                              </div>
                            ))}
                            <Button type="button" onClick={() => upCat(ci, { items: [...c.items, { q: "", a: "" }] })} variant="outline" size="sm" className="self-start">{t("catalog:pages.faq.addQuestion")}</Button>
                          </Card>
                        ))}
                        <Button type="button" onClick={() => patch({ faq: [...f.faq, { title: "", items: [{ q: "", a: "" }] }] })} variant="outline" size="sm" className="self-start">{t("catalog:pages.faq.addCat")}</Button>
                      </div>
                    )}

                    {f.type === "policy" && (
                      <div className="flex flex-col gap-3">
                        {f.sections.length === 0 && <span className="text-sm text-muted-foreground">{t("catalog:pages.policy.noSections")}</span>}
                        {f.sections.map((r, i) => (
                          <div key={i} className="flex gap-2">
                            <div className="flex flex-1 flex-col gap-2">
                              <Input type="text" value={r.title} onChange={(e) => upRow("sections", i, { title: e.target.value })} placeholder={t("catalog:pages.policy.sectionTitle")} aria-label={t("catalog:pages.policy.sectionTitle")} />
                              <Textarea rows={5} value={r.text} onChange={(e) => upRow("sections", i, { text: e.target.value })} placeholder={t("catalog:pages.policy.sectionParasPh")} aria-label={t("catalog:pages.policy.sectionParas")} />
                            </div>
                            <WithTooltip content={t("catalog:pages.policy.removeSection")}><Button type="button" onClick={() => delRow("sections", i)} aria-label={t("catalog:pages.policy.removeSection")} variant="outline" size="icon"><X className="size-4" /></Button></WithTooltip>
                          </div>
                        ))}
                        <Button type="button" onClick={() => patch({ sections: [...f.sections, { title: "", text: "" }] })} variant="outline" size="sm" className="self-start">{t("catalog:pages.policy.addSection")}</Button>
                      </div>
                    )}
                  </>
                )}

                <Collapsible defaultOpen asChild>
                  <Card className="gap-0 py-0 shadow-none">
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" className="group w-full justify-between">
                        {t("catalog:shared.seoListing")}
                        <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <Separator />
                      <div className="flex flex-col gap-3 p-4">
                        <Card className="gap-0 bg-muted/50 p-3 shadow-none">
                          <div className="text-xs text-muted-foreground">aura.shop › {f.slug || "…"}</div>
                          <div className="text-sm font-semibold text-primary">{f.seoTitle.trim() || `${f.title} | Aura Shop`}</div>
                          <div className="text-xs text-muted-foreground">{f.seoDesc}</div>
                        </Card>
                        <FormField label={t("catalog:pages.metaDesc")} htmlFor="page-seo-desc" description={t("catalog:pages.metaDescHelp", { count: f.seoDesc.length })}>
                          <Textarea id="page-seo-desc" rows={2} value={f.seoDesc} onChange={(e) => patch({ seoDesc: e.target.value.slice(0, 160) })} />
                        </FormField>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" variant="destructive" onClick={remove}><Trash2 className="size-4" />{rec ? t("catalog:pages.deletePage") : t("catalog:pages.discard")}</Button>
                  <span className="text-xs text-muted-foreground">{t("catalog:pages.readTime", { count: words, min: Math.max(1, Math.round(words / 200)) })}</span>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
