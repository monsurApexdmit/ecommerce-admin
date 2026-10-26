"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Bell, Eye, FileText, Loader2, Plus, Search, Trash2, X } from "lucide-react"
import Link from "next/link"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import notificationApi, { type NotificationResponse } from "@/lib/notificationApi"
import { settingsApi } from "@/lib/settingsApi"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
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
const ICONS = ["users", "truck", "award", "globe", "shield-check", "heart", "zap", "target", "star", "package"]
const TYPES: { value: PageTemplate; label: string }[] = [
  { value: "policy", label: "Policy" },
  { value: "about", label: "About" },
  { value: "faq", label: "FAQ" },
  { value: "custom", label: "Custom" },
]
const PLACES: { value: PagePlace; label: string }[] = [
  { value: "footer", label: "Footer" },
  { value: "header", label: "Header menu" },
  { value: "checkout", label: "Checkout" },
  { value: "none", label: "Nowhere (link only)" },
]
const TYPE_LABEL: Record<string, string> = { policy: "Policy", about: "About", faq: "FAQ", custom: "Custom" }

// Standard storefront slugs that already count as a quick-start page.
const PRESET_ALIASES: Record<string, string[]> = {
  about: ["about", "about-us"],
  faq: ["faq", "faqs"],
  returns: ["returns", "returns-refunds", "refund-policy", "returns-and-refunds"],
  shipping: ["shipping", "shipping-policy"],
  privacy: ["privacy", "privacy-policy"],
}

// Starter templates (custom pages)
const STARTERS: { label: string; slug: string; type: PageTemplate; summary: string; body: string }[] = [
  { label: "Contact us", slug: "contact", type: "about", summary: "How to reach us.", body: "# Get in touch\nEmail us or call during business hours and we will reply within one working day." },
  { label: "Size guide", slug: "size-guide", type: "custom", summary: "Find your size.", body: "# How to measure\nMeasure your chest, waist and hip and compare with the chart below." },
  { label: "Blank page", slug: "", type: "custom", summary: "", body: "" },
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

/** Validate the form and turn it into an API payload. Returns an error string on failure. */
function buildPayload(f: FormState): { error: string } | { payload: ContentPagePayload } {
  const title = f.title.trim()
  const slug = slugify(f.slug || f.title)
  if (!title) return { error: "Page title is required." }
  if (!slug) return { error: "Page address is required." }
  const hero = { kicker: f.heroKicker.trim(), title: f.heroTitle.trim(), description: f.heroDesc.trim() }
  const seo = { title: f.seoTitle.trim(), description: f.seoDesc.trim() }
  let content: PageContent
  let body = f.body

  if (f.type === "about") {
    const stats = f.stats.filter((r) => r.label.trim() || r.value.trim())
    const values = f.values.filter((r) => r.title.trim() || r.description.trim())
    const team = f.team.filter((r) => r.name.trim() || r.role.trim() || r.bio.trim())
    let i = stats.findIndex((r) => !r.label.trim() || !r.value.trim())
    if (i >= 0) return { error: `Stat ${i + 1} needs both a label and a value.` }
    i = values.findIndex((r) => !r.title.trim())
    if (i >= 0) return { error: `Value ${i + 1} needs a title.` }
    i = team.findIndex((r) => !r.name.trim())
    if (i >= 0) return { error: `Team member ${i + 1} needs a name.` }
    content = {
      template: "about", hero, seo, valuesHeading: f.valuesHeading.trim(), teamHeading: f.teamHeading.trim(),
      stats: stats.map((r) => ({ label: r.label.trim(), value: r.value.trim(), icon: r.icon || "users" })),
      values: values.map((r) => ({ title: r.title.trim(), description: r.description.trim(), icon: r.icon || "heart" })),
      team: team.map((r) => ({ name: r.name.trim(), role: r.role.trim(), bio: r.bio.trim() })),
    }
  } else if (f.type === "faq") {
    const cats = f.faq.map((c) => ({ title: c.title.trim(), items: c.items.filter((x) => x.q.trim() || x.a.trim()) })).filter((c) => c.title || c.items.length)
    for (let i = 0; i < cats.length; i++) {
      if (!cats[i].title) return { error: `Question category ${i + 1} needs a title.` }
      const j = cats[i].items.findIndex((x) => !x.q.trim() || !x.a.trim())
      if (j >= 0) return { error: `"${cats[i].title}", question ${j + 1} needs both a question and an answer.` }
    }
    content = { template: "faq", hero, seo, faqCategories: cats.map((c) => ({ title: c.title, items: c.items.map((x) => ({ question: x.q.trim(), answer: x.a.trim() })) })) }
    // Markdown copy of the structured content, kept in sync so the storefront can render `body`.
    body = cats.map((c) => [`## ${c.title}`, ...c.items.map((x) => `**${x.q.trim()}**\n\n${x.a.trim()}`)].join("\n\n")).join("\n\n")
  } else if (f.type === "policy") {
    const secs = f.sections.map((x) => ({ title: x.title.trim(), paragraphs: paras(x.text) })).filter((x) => x.title || x.paragraphs.length)
    const i = secs.findIndex((x) => !x.title)
    if (i >= 0) return { error: `Section ${i + 1} needs a title.` }
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

function previewBlocks(f: FormState): Block[] {
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
      c.items.forEach((i) => { if (i.q) b.push({ h: false, text: `Q. ${i.q}` }); if (i.a) b.push({ h: false, text: i.a }) })
    })
  } else if (f.type === "policy") {
    f.sections.forEach((s) => { if (s.title) b.push({ h: true, text: s.title }); paras(s.text).forEach((t) => b.push({ h: false, text: t })) })
  } else b.push(...mdBlocks(f.body))
  return b
}

const fmtD = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "")

const inputCls = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const areaCls = "w-full rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm font-normal outline-none focus-visible:border-dash-accent"
const labelCls = "flex flex-col gap-1.5 text-[13px] font-semibold"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft disabled:opacity-50"
const primaryBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-dash-accent px-4 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
const smallBtn = "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-dash-border bg-dash-card px-3 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const xBtn = "flex size-9 shrink-0 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-muted hover:bg-dash-neutral-soft"

export default function PagesManagementPage() {
  const blocked = useModuleGuard("Pages")

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
      toast.error(e?.response?.data?.message || "Failed to load pages")
      return []
    } finally {
      setLoading(false)
    }
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
  const blocks = useMemo(() => (f ? previewBlocks(f) : []), [f])
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
    if ("error" in r) { setErr(r.error); return }
    setSaving(true)
    try {
      const saved = rec ? await pageApi.update(rec.id, r.payload) : await pageApi.create(r.payload)
      toast.success(rec ? "Page saved" : "Page created")
      await load()
      setSelId(saved.id); setForm(fromPage(saved)); setDirty(false); setErr("")
    } catch (e: any) {
      const errs = e?.response?.data?.errors
      const msg = errs?.slug?.[0] ? `Another page already uses the address "/${r.payload.slug}".` : (errs && (Object.values(errs)[0] as string[])?.[0]) || e?.response?.data?.message || "Failed to save page"
      setErr(msg)
    } finally { setSaving(false) }
  }

  const togglePublish = async () => {
    if (!f) return
    if (!rec) { patch({ isPublished: !f.isPublished }); return }
    if (!rec.isPublished && !rec.title.trim()) { setErr("Add a title first."); return }
    setSaving(true)
    try {
      const saved = await pageApi.update(rec.id, { isPublished: !rec.isPublished })
      toast.success(saved.isPublished ? "Page published" : "Page unpublished")
      await load()
      setForm((cur) => (cur ? { ...cur, isPublished: saved.isPublished } : cur))
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to update status") }
    finally { setSaving(false) }
  }

  const remove = async () => {
    if (!rec) { const first = sorted[0]; if (first) open(first); else { setForm(null); setSelId(null) } return }
    if (!window.confirm(`Delete page "${rec.title}"?`)) return
    try {
      await pageApi.delete(rec.id)
      toast.success("Page deleted")
      const list = await load()
      const next = [...list].sort((a, b) => a.title.localeCompare(b.title)).find((p) => p.id !== rec.id)
      if (next) open(next); else { setSelId(null); setForm(null) }
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to delete page") }
  }

  const createAll = async () => {
    setCreatingAll(true)
    try {
      for (const pr of missing) {
        await pageApi.create({ title: pr.title, slug: pr.slug, summary: pr.summary, type: pr.content.template, place: "footer", body: "", isPublished: true, content: pr.content })
      }
      toast.success("Standard pages created and published")
      await load()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to create standard pages"); await load() }
    finally { setCreatingAll(false) }
  }

  const published = rec ? rec.isPublished : f?.isPublished ?? false
  const bodyEditable = f && (f.type === "about" || f.type === "custom")

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Pages</h1>
          <p className="mt-1 text-sm text-dash-muted">Policies and content pages for your Aura Shop storefront.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={notifOpen} onOpenChange={(o) => { setNotifOpen(o); if (o) void loadNotifs() }}>
            <PopoverTrigger asChild>
              <button type="button" className={cn(outlineBtn, "relative")} aria-label="Notifications">
                <Bell className="size-4" /> Notifications
                {unread > 0 && <span className="rounded-full bg-dash-accent px-1.5 text-xs font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[360px] p-0">
              <div className="flex items-center justify-between border-b border-dash-border px-4 py-3">
                <span className="text-sm font-bold">Notifications</span>
                <button type="button" disabled={unread === 0} className="text-xs font-semibold text-dash-accent disabled:opacity-40"
                  onClick={async () => { try { await notificationApi.markAllAsRead(); await loadNotifs() } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to mark all read") } }}>
                  Mark all read
                </button>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="p-6 text-center text-sm text-dash-muted">No notifications yet.</p>
                ) : notifs.map((n) => (
                  <div key={n.id} className={cn("flex flex-col gap-0.5 border-b border-dash-border px-4 py-3 last:border-b-0", !n.readAt && "bg-dash-accent-soft")}>
                    <span className="text-sm font-semibold">{n.title}</span>
                    <span className="line-clamp-2 text-xs text-dash-muted">{n.message}</span>
                    <span className="text-xs text-dash-muted">{fmtD(n.createdAt)}</span>
                  </div>
                ))}
              </div>
              <Link href="/dashboard/notifications" className="block border-t border-dash-border px-4 py-3 text-center text-[13px] font-semibold text-dash-accent hover:bg-dash-neutral-soft">View all notifications</Link>
            </PopoverContent>
          </Popover>
          {storeUrl
            ? <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={cn(outlineBtn, "text-dash-accent")}>View store ↗</a>
            : <span className={cn(outlineBtn, "cursor-not-allowed opacity-50")} aria-disabled title="Publish your store with a domain in Online store settings">View store ↗</span>}
          <button type="button" onClick={() => startNew(blank())} className={primaryBtn}><Plus className="size-4" /> New page</button>
        </div>
      </div>

      {!loading && missing.length > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-dash-border bg-dash-card p-5">
          <div>
            <h2 className="text-base font-bold">Quick start pages</h2>
            <p className="mt-0.5 text-sm text-dash-muted">Create the standard storefront help and policy pages with ready-to-edit default content.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={createAll} disabled={creatingAll} className={primaryBtn}>
              {creatingAll && <Loader2 className="size-4 animate-spin" />} Create all standard pages
            </button>
            {missing.map((pr) => (
              <button key={pr.slug} type="button" onClick={() => startNew({ ...fromPreset(pr), isPublished: true })} className={outlineBtn}>+ {pr.title}</button>
            ))}
          </div>
        </section>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* List */}
        <section className="flex flex-col gap-3 rounded-[14px] border border-dash-border bg-dash-card p-4">
          <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPageNo(1) }}
            tabs={[{ value: "all", label: "All", count: counts.all }, { value: "published", label: "Published", count: counts.published }, { value: "draft", label: "Drafts", count: counts.draft }]} />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dash-muted" />
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setPageNo(1) }} placeholder="Search pages…" aria-label="Search pages" className={cn(inputCls, "pl-9")} />
          </div>
          {loading ? (
            <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-[10px]" />)}</div>
          ) : rows.length === 0 ? (
            <div className="rounded-[10px] bg-dash-neutral-soft p-6 text-center text-sm text-dash-muted">No pages match.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((p) => {
                const on = p.id === selId
                return (
                  <button key={p.id} type="button" onClick={() => open(p)} aria-pressed={on}
                    className={cn("flex flex-col gap-1 rounded-[10px] border border-dash-border border-l-4 p-3 text-left hover:bg-dash-neutral-soft", on ? "border-l-dash-accent bg-dash-accent-soft" : "border-l-transparent bg-dash-card")}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{p.title}</span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", p.isPublished ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-neutral-soft text-dash-neutral-fg")}>{p.isPublished ? "Published" : "Draft"}</span>
                    </span>
                    <span className="text-xs text-dash-muted">aura.shop/{p.slug}</span>
                    <span className="text-xs text-dash-muted">
                      {TYPE_LABEL[typeOf(p)] ?? "Custom"} · {typeOf(p)} · updated {fmtD(p.updatedAt || p.createdAt)} · {p.publishedAt ? `published ${fmtD(p.publishedAt)}` : "not published"}
                    </span>
                    <span className="line-clamp-2 text-xs text-dash-muted">{p.summary || "No summary provided."}</span>
                  </button>
                )
              })}
            </div>
          )}
          {shown.length > 0 && (
            <PaginationControl currentPage={pageNo} totalPages={Math.max(1, Math.ceil(shown.length / perPage))} itemsPerPage={perPage} totalItems={shown.length}
              onPageChange={setPageNo} onItemsPerPageChange={(n) => { setPerPage(n); setPageNo(1) }} />
          )}
          <div className="flex flex-col gap-2 border-t border-dash-border pt-3">
            <span className="text-[13px] font-semibold">Start from a template</span>
            <div role="group" aria-label="Templates" className="flex flex-wrap gap-2">
              {STARTERS.map((t) => (
                <button key={t.label} type="button" className={smallBtn} onClick={() => startNew({
                  ...blank(), title: t.label === "Blank page" ? "" : t.label, slug: t.slug, type: t.type, summary: t.summary, body: t.body, slugTouched: !!t.slug,
                })}>+ {t.label}</button>
              ))}
            </div>
          </div>
        </section>

        {/* Editor */}
        <section className="flex flex-col rounded-[14px] border border-dash-border bg-dash-card">
          {loading ? (
            <div className="flex flex-col gap-3 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-[42px] w-full" /><Skeleton className="h-40 w-full" /></div>
          ) : !f ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center text-sm text-dash-muted">
              <FileText className="size-8" /> No page selected. Create a new page or pick one from the list.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-dash-border p-4">
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", published ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-neutral-soft text-dash-neutral-fg")}>{published ? "Published" : "Draft"}</span>
                <span className="text-xs text-dash-muted">
                  {rec ? `Updated ${fmtD(rec.updatedAt || rec.createdAt)} · Published: ${rec.publishedAt ? fmtD(rec.publishedAt) : "not published"}` : "New page, not saved yet"}{dirty ? " · unsaved changes" : ""}
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPreviewing((v) => !v)} aria-pressed={previewing} className={outlineBtn}><Eye className="size-4" />{previewing ? "Back to editor" : "Preview"}</button>
                  <button type="button" onClick={togglePublish} disabled={saving} className={outlineBtn}>{published ? "Unpublish" : "Publish"}</button>
                  <button type="button" onClick={save} disabled={saving} className={primaryBtn}>
                    {saving && <Loader2 className="size-4 animate-spin" />}{!rec ? "Create page" : published ? "Update live page" : "Save draft"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4 p-5">
                {err && <p className="rounded-[10px] bg-dash-danger-soft px-3 py-2 text-sm font-semibold text-dash-danger-fg" role="alert">{err}</p>}
                <input type="text" value={f.title} placeholder="Page title" aria-label="Page title"
                  onChange={(e) => { const v = e.target.value; patch(rec || f.slugTouched ? { title: v } : { title: v, slug: slugify(v) }) }}
                  className={cn(inputCls, "h-12 text-base font-semibold")} />
                <div className="grid gap-3 md:grid-cols-3">
                  <label className={labelCls}>Page address
                    <span className="flex h-[42px] items-center rounded-[10px] border border-dash-border bg-dash-card pl-3 focus-within:border-dash-accent">
                      <span className="text-sm font-normal text-dash-muted">aura.shop/</span>
                      <input type="text" value={f.slug} onChange={(e) => patch({ slug: slugify(e.target.value), slugTouched: true })} className="h-full min-w-0 flex-1 bg-transparent px-1 text-sm font-normal outline-none" />
                    </span>
                  </label>
                  <label className={labelCls}>Type
                    <select value={f.type} onChange={(e) => patch({ type: e.target.value as PageTemplate })} className={inputCls}>
                      {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>
                  <label className={labelCls}>Show link in
                    <select value={f.place} onChange={(e) => patch({ place: e.target.value as PagePlace })} className={inputCls}>
                      {PLACES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>
                </div>

                <div className="flex flex-col gap-3 rounded-[10px] border border-dash-border p-4">
                  <strong className="text-sm">Page header and search listing</strong>
                  <label className={labelCls}>Summary (internal)
                    <textarea rows={2} value={f.summary} onChange={(e) => patch({ summary: e.target.value })} placeholder="Short internal description for this content page" className={areaCls} />
                  </label>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className={labelCls}>Hero kicker<input type="text" value={f.heroKicker} onChange={(e) => patch({ heroKicker: e.target.value })} placeholder="Our story" className={inputCls} /></label>
                    <label className={labelCls}>Hero title<input type="text" value={f.heroTitle} onChange={(e) => patch({ heroTitle: e.target.value })} className={inputCls} /></label>
                    <label className={labelCls}>SEO title<input type="text" value={f.seoTitle} onChange={(e) => patch({ seoTitle: e.target.value })} placeholder="About us | Aura Shop" className={inputCls} /></label>
                  </div>
                  <label className={labelCls}>Hero description
                    <textarea rows={2} value={f.heroDesc} onChange={(e) => patch({ heroDesc: e.target.value })} className={areaCls} />
                  </label>
                </div>

                {previewing ? (
                  <div className="flex flex-col gap-2 rounded-[10px] border border-dash-border bg-dash-neutral-soft p-5">
                    {blocks.map((b, i) => b.h
                      ? <h3 key={i} className="font-dash-display text-lg font-bold">{b.text}</h3>
                      : <p key={i} className="text-sm leading-relaxed">{b.text}</p>)}
                    {blocks.length === 0 && <span className="text-sm text-dash-muted">This page has no content yet.</span>}
                  </div>
                ) : (
                  <>
                    {bodyEditable && (
                      <div className="flex flex-col gap-2">
                        <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-1.5">
                          {([["Heading", "H", "# Heading"], ["Bold", "B", "**bold**"], ["Italic", "I", "_italic_"], ["Bulleted list", "•", "- Item"], ["Numbered list", "1.", "1. Item"], ["Link", "↗", "[link text](https://)"], ["Divider", "—", "---"]] as const).map(([label, glyph, txt]) => (
                            <button key={label} type="button" aria-label={label} title={label} className="flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-sm font-semibold hover:bg-dash-neutral-soft"
                              onClick={() => patch({ body: (f.body ? f.body.replace(/\s+$/, "") + "\n" : "") + txt })}>{glyph}</button>
                          ))}
                        </div>
                        <textarea rows={12} value={f.body} onChange={(e) => patch({ body: e.target.value })} aria-label={f.type === "about" ? "Story content" : "Page content"}
                          placeholder={f.type === "about" ? "Write the story shown above the stats…" : "Write the page content…"} className={areaCls} />
                        <span className="text-xs text-dash-muted">Start a line with # for a heading and - for a list item. Use Preview to see how it reads.</span>
                      </div>
                    )}

                    {f.type === "about" && (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <strong className="text-sm">Stats</strong>
                          {f.stats.length === 0 && <span className="text-sm text-dash-muted">No stats yet.</span>}
                          {f.stats.map((r, i) => (
                            <div key={i} className="flex flex-wrap gap-2">
                              <input type="text" value={r.label} onChange={(e) => upRow("stats", i, { label: e.target.value })} placeholder="Label, e.g. Happy customers" aria-label="Stat label" className={cn(inputCls, "min-w-40 flex-1")} />
                              <input type="text" value={r.value} onChange={(e) => upRow("stats", i, { value: e.target.value })} placeholder="Value, e.g. 50K+" aria-label="Stat value" className={cn(inputCls, "min-w-32 flex-1")} />
                              <select value={r.icon} onChange={(e) => upRow("stats", i, { icon: e.target.value })} aria-label="Stat icon" className={cn(inputCls, "w-40")}>{ICONS.map((o) => <option key={o}>{o}</option>)}</select>
                              <button type="button" onClick={() => delRow("stats", i)} aria-label="Remove stat" className={xBtn}><X className="size-4" /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => patch({ stats: [...f.stats, { label: "", value: "", icon: "users" }] })} className={cn(smallBtn, "self-start")}>+ Add stat</button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className={labelCls}>Values section heading<input type="text" value={f.valuesHeading} onChange={(e) => patch({ valuesHeading: e.target.value })} className={inputCls} /></label>
                          {f.values.length === 0 && <span className="text-sm text-dash-muted">No values yet.</span>}
                          {f.values.map((r, i) => (
                            <div key={i} className="flex flex-wrap gap-2">
                              <input type="text" value={r.title} onChange={(e) => upRow("values", i, { title: e.target.value })} placeholder="Title" aria-label="Value title" className={cn(inputCls, "min-w-40 flex-1")} />
                              <input type="text" value={r.description} onChange={(e) => upRow("values", i, { description: e.target.value })} placeholder="Description" aria-label="Value description" className={cn(inputCls, "min-w-48 flex-[2]")} />
                              <select value={r.icon} onChange={(e) => upRow("values", i, { icon: e.target.value })} aria-label="Value icon" className={cn(inputCls, "w-40")}>{ICONS.map((o) => <option key={o}>{o}</option>)}</select>
                              <button type="button" onClick={() => delRow("values", i)} aria-label="Remove value" className={xBtn}><X className="size-4" /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => patch({ values: [...f.values, { title: "", description: "", icon: "heart" }] })} className={cn(smallBtn, "self-start")}>+ Add value</button>
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className={labelCls}>Team section heading<input type="text" value={f.teamHeading} onChange={(e) => patch({ teamHeading: e.target.value })} className={inputCls} /></label>
                          {f.team.length === 0 && <span className="text-sm text-dash-muted">No team members yet.</span>}
                          {f.team.map((r, i) => (
                            <div key={i} className="flex flex-wrap gap-2">
                              <input type="text" value={r.name} onChange={(e) => upRow("team", i, { name: e.target.value })} placeholder="Name" aria-label="Team member name" className={cn(inputCls, "min-w-36 flex-1")} />
                              <input type="text" value={r.role} onChange={(e) => upRow("team", i, { role: e.target.value })} placeholder="Role" aria-label="Team member role" className={cn(inputCls, "min-w-36 flex-1")} />
                              <input type="text" value={r.bio} onChange={(e) => upRow("team", i, { bio: e.target.value })} placeholder="Short bio" aria-label="Team member bio" className={cn(inputCls, "min-w-48 flex-[2]")} />
                              <button type="button" onClick={() => delRow("team", i)} aria-label="Remove team member" className={xBtn}><X className="size-4" /></button>
                            </div>
                          ))}
                          <button type="button" onClick={() => patch({ team: [...f.team, { name: "", role: "", bio: "" }] })} className={cn(smallBtn, "self-start")}>+ Add team member</button>
                        </div>
                      </div>
                    )}

                    {f.type === "faq" && (
                      <div className="flex flex-col gap-3">
                        {f.faq.length === 0 && <span className="text-sm text-dash-muted">No question categories yet.</span>}
                        {f.faq.map((c, ci) => (
                          <div key={ci} className="flex flex-col gap-2 rounded-[10px] border border-dash-border p-3">
                            <div className="flex gap-2">
                              <input type="text" value={c.title} onChange={(e) => upCat(ci, { title: e.target.value })} placeholder="Category title, e.g. Orders & delivery" aria-label="Category title" className={inputCls} />
                              <button type="button" onClick={() => patch({ faq: f.faq.filter((_, j) => j !== ci) })} aria-label="Remove category" className={xBtn}><X className="size-4" /></button>
                            </div>
                            {c.items.map((it, qi) => (
                              <div key={qi} className="flex gap-2">
                                <div className="flex flex-1 flex-col gap-2">
                                  <input type="text" value={it.q} onChange={(e) => upCat(ci, { items: c.items.map((x, n) => (n === qi ? { ...x, q: e.target.value } : x)) })} placeholder="Question" aria-label="Question" className={inputCls} />
                                  <textarea rows={2} value={it.a} onChange={(e) => upCat(ci, { items: c.items.map((x, n) => (n === qi ? { ...x, a: e.target.value } : x)) })} placeholder="Answer" aria-label="Answer" className={areaCls} />
                                </div>
                                <button type="button" onClick={() => upCat(ci, { items: c.items.filter((_, n) => n !== qi) })} aria-label="Remove question" className={xBtn}><X className="size-4" /></button>
                              </div>
                            ))}
                            <button type="button" onClick={() => upCat(ci, { items: [...c.items, { q: "", a: "" }] })} className={cn(smallBtn, "self-start")}>+ Add question</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => patch({ faq: [...f.faq, { title: "", items: [{ q: "", a: "" }] }] })} className={cn(smallBtn, "self-start")}>+ Add category</button>
                      </div>
                    )}

                    {f.type === "policy" && (
                      <div className="flex flex-col gap-3">
                        {f.sections.length === 0 && <span className="text-sm text-dash-muted">No sections yet.</span>}
                        {f.sections.map((r, i) => (
                          <div key={i} className="flex gap-2">
                            <div className="flex flex-1 flex-col gap-2">
                              <input type="text" value={r.title} onChange={(e) => upRow("sections", i, { title: e.target.value })} placeholder="Section title" aria-label="Section title" className={inputCls} />
                              <textarea rows={5} value={r.text} onChange={(e) => upRow("sections", i, { text: e.target.value })} placeholder="Paragraphs. Leave a blank line between paragraphs." aria-label="Section paragraphs" className={areaCls} />
                            </div>
                            <button type="button" onClick={() => delRow("sections", i)} aria-label="Remove section" className={xBtn}><X className="size-4" /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => patch({ sections: [...f.sections, { title: "", text: "" }] })} className={cn(smallBtn, "self-start")}>+ Add section</button>
                      </div>
                    )}
                  </>
                )}

                <details open className="rounded-[10px] border border-dash-border">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Search engine listing</summary>
                  <div className="flex flex-col gap-3 border-t border-dash-border p-4">
                    <div className="rounded-[10px] bg-dash-neutral-soft p-3">
                      <div className="text-xs text-dash-muted">aura.shop › {f.slug || "…"}</div>
                      <div className="text-sm font-semibold text-dash-accent">{f.seoTitle.trim() || `${f.title} | Aura Shop`}</div>
                      <div className="text-xs text-dash-muted">{f.seoDesc}</div>
                    </div>
                    <label className={labelCls}>Meta description
                      <textarea rows={2} value={f.seoDesc} onChange={(e) => patch({ seoDesc: e.target.value.slice(0, 160) })} className={areaCls} />
                      <span className="text-xs font-normal text-dash-muted">{f.seoDesc.length} / 160 characters</span>
                    </label>
                  </div>
                </details>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button type="button" onClick={remove} className={cn(outlineBtn, "text-dash-danger-fg")}><Trash2 className="size-4" />{rec ? "Delete page" : "Discard"}</button>
                  <span className="text-xs text-dash-muted">{words} words · ~{Math.max(1, Math.round(words / 200))} min read</span>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
