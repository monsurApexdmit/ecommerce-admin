"use client"

import { useEffect, useMemo, useState } from "react"
import { FileText, Loader2, Pencil, Plus, Save, ToggleLeft, ToggleRight, Trash2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import pageApi, {
  PAGE_PRESETS,
  type AboutPageContent,
  type ContentPage,
  type ContentPagePayload,
  type FaqPageContent,
  type PageContent,
  type PageTemplate,
  type PolicyPageContent,
  getPresetBySlug,
  inferPageTemplate,
} from "@/lib/pageApi"

type FormState = {
  template: PageTemplate
  title: string
  slug: string
  summary: string
  isPublished: boolean
  heroKicker: string
  heroTitle: string
  heroDescription: string
  seoTitle: string
  seoDescription: string
  statsJson: string
  valuesHeading: string
  valuesJson: string
  teamHeading: string
  teamJson: string
  faqJson: string
  sectionsJson: string
}

const formatJson = (value: unknown) => JSON.stringify(value, null, 2)

const buildFormFromContent = (
  content: PageContent,
  base: {
    title: string
    slug: string
    summary: string
    isPublished: boolean
  }
): FormState => {
  const template = inferPageTemplate(base.slug, content)

  return {
    template,
    title: base.title,
    slug: base.slug,
    summary: base.summary,
    isPublished: base.isPublished,
    heroKicker: content.hero?.kicker ?? "",
    heroTitle: content.hero?.title ?? "",
    heroDescription: content.hero?.description ?? "",
    seoTitle: content.seo?.title ?? "",
    seoDescription: content.seo?.description ?? "",
    statsJson: formatJson(template === "about" ? (content as AboutPageContent).stats ?? [] : []),
    valuesHeading: template === "about" ? (content as AboutPageContent).valuesHeading ?? "" : "",
    valuesJson: formatJson(template === "about" ? (content as AboutPageContent).values ?? [] : []),
    teamHeading: template === "about" ? (content as AboutPageContent).teamHeading ?? "" : "",
    teamJson: formatJson(template === "about" ? (content as AboutPageContent).team ?? [] : []),
    faqJson: formatJson(template === "faq" ? (content as FaqPageContent).faqCategories ?? [] : []),
    sectionsJson: formatJson(template === "policy" ? (content as PolicyPageContent).sections ?? [] : []),
  }
}

const createFormFromPreset = (slug: string): FormState => {
  const preset = getPresetBySlug(slug) ?? PAGE_PRESETS[0]
  return buildFormFromContent(preset.content, {
    title: preset.title,
    slug: preset.slug,
    summary: preset.summary,
    isPublished: true,
  })
}

const formatDateTime = (value: string | null) => {
  if (!value) return "Not published"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const getDefaultPresetSlugForTemplate = (template: PageTemplate, currentSlug: string) => {
  if (template === "about") return "about"
  if (template === "faq") return "faq"
  if (currentSlug === "returns" || currentSlug === "privacy") return currentSlug
  return "shipping"
}

export default function PagesManagementPage() {
  const { canRead } = useSaasAuth()
  const { toast } = useToast()
  const [pages, setPages] = useState<ContentPage[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPage, setEditingPage] = useState<ContentPage | null>(null)
  const [form, setForm] = useState<FormState>(createFormFromPreset("about"))
  const [saving, setSaving] = useState(false)
  const [creatingDefaults, setCreatingDefaults] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const loadPages = async () => {
    try {
      setLoading(true)
      setPages(await pageApi.getAll())
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error?.response?.data?.message || "Failed to load pages",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPages()
  }, [])

  const missingPresets = useMemo(() => {
    const existingSlugs = new Set(pages.map((page) => page.slug))
    return PAGE_PRESETS.filter((preset) => !existingSlugs.has(preset.slug))
  }, [pages])

  const templateHint = useMemo(() => {
    if (form.template === "about") {
      return 'About pages use stats, values, and team JSON arrays. Icons can be values like "users", "truck", "award", "shield-check", "heart", or "zap".'
    }

    if (form.template === "faq") {
      return 'FAQ JSON should be an array of categories: [{ "title": "Orders", "items": [{ "question": "...", "answer": "..." }] }].'
    }

    return 'Policy sections JSON should be an array: [{ "title": "Section title", "paragraphs": ["Paragraph one", "Paragraph two"] }].'
  }, [form.template])

  if (!canRead('Pages')) return <AccessDenied />

  const setField = (field: keyof FormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const applyPreset = (slug: string) => {
    setEditingPage(null)
    setForm(createFormFromPreset(slug))
    setDialogOpen(true)
  }

  const openCreate = () => {
    applyPreset("about")
  }

  const openEdit = (page: ContentPage) => {
    setEditingPage(page)
    setForm(
      buildFormFromContent(page.content, {
        title: page.title,
        slug: page.slug,
        summary: page.summary ?? "",
        isPublished: page.isPublished,
      })
    )
    setDialogOpen(true)
  }

  const handleTemplateChange = (template: PageTemplate) => {
    const presetSlug = getDefaultPresetSlugForTemplate(template, form.slug)
    const preset = getPresetBySlug(presetSlug)
    if (!preset) return

    setForm((current) =>
      buildFormFromContent(preset.content, {
        title: current.title,
        slug: current.slug,
        summary: current.summary,
        isPublished: current.isPublished,
      })
    )
  }

  const buildContent = (): PageContent => {
    const hero = {
      kicker: form.heroKicker.trim(),
      title: form.heroTitle.trim(),
      description: form.heroDescription.trim(),
    }
    const seo = {
      title: form.seoTitle.trim(),
      description: form.seoDescription.trim(),
    }

    if (form.template === "about") {
      return {
        template: "about",
        hero,
        valuesHeading: form.valuesHeading.trim(),
        teamHeading: form.teamHeading.trim(),
        stats: JSON.parse(form.statsJson),
        values: JSON.parse(form.valuesJson),
        team: JSON.parse(form.teamJson),
        seo,
      }
    }

    if (form.template === "faq") {
      return {
        template: "faq",
        hero,
        faqCategories: JSON.parse(form.faqJson),
        seo,
      }
    }

    return {
      template: "policy",
      hero,
      sections: JSON.parse(form.sectionsJson),
      seo,
    }
  }

  const buildPayload = (): ContentPagePayload => {
    if (!form.title.trim()) throw new Error("Title is required")
    if (!form.slug.trim()) throw new Error("Slug is required")

    return {
      title: form.title.trim(),
      slug: form.slug.trim().toLowerCase().replace(/\s+/g, "-"),
      summary: form.summary.trim(),
      isPublished: form.isPublished,
      content: buildContent(),
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const payload = buildPayload()

      if (editingPage) {
        await pageApi.update(editingPage.id, payload)
        toast({ title: "Page updated", description: "The content page was saved successfully." })
      } else {
        await pageApi.create(payload)
        toast({ title: "Page created", description: "The content page was created successfully." })
      }

      setDialogOpen(false)
      await loadPages()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Unable to save page",
        description: error?.response?.data?.message || error?.message || "Check the form and try again.",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCreateMissingPresets = async () => {
    if (missingPresets.length === 0) return

    try {
      setCreatingDefaults(true)

      for (const preset of missingPresets) {
        await pageApi.create({
          title: preset.title,
          slug: preset.slug,
          summary: preset.summary,
          isPublished: true,
          content: preset.content,
        })
      }

      toast({
        title: "Standard pages created",
        description: "Aura Shop help and policy pages were created with default content and published.",
      })

      await loadPages()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Unable to create default pages",
        description: error?.response?.data?.message || "Failed to create one or more standard pages.",
      })
    } finally {
      setCreatingDefaults(false)
    }
  }

  const handleTogglePublish = async (page: ContentPage) => {
    try {
      setUpdatingId(page.id)
      await pageApi.update(page.id, { isPublished: !page.isPublished })
      toast({
        title: page.isPublished ? "Page unpublished" : "Page published",
        description: `${page.title} is now ${page.isPublished ? "hidden" : "live"} on the storefront.`,
      })
      await loadPages()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Unable to update status",
        description: error?.response?.data?.message || "Failed to update publish status.",
      })
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (page: ContentPage) => {
    const confirmed = window.confirm(`Delete "${page.title}"?`)
    if (!confirmed) return

    try {
      setDeletingId(page.id)
      await pageApi.delete(page.id)
      toast({ title: "Page deleted", description: `${page.title} was removed.` })
      await loadPages()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Unable to delete page",
        description: error?.response?.data?.message || "Failed to delete the page.",
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pages</h1>
          <p className="mt-1 text-gray-600">Manage storefront content pages and publish them to Aura Shop.</p>
        </div>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          New Page
        </Button>
      </div>

      {missingPresets.length > 0 && (
        <Card className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Quick Start Pages</h2>
              <p className="mt-1 text-sm text-gray-600">
                Create the standard Aura Shop content pages with ready-to-edit default content.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleCreateMissingPresets}
                disabled={creatingDefaults}
              >
                {creatingDefaults ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create All Standard Pages
              </Button>
              {missingPresets.map((preset) => (
                <Button key={preset.slug} variant="outline" onClick={() => applyPreset(preset.slug)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {preset.title}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading pages...
          </div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="mb-4 h-12 w-12 text-gray-300" />
            <h2 className="text-lg font-semibold text-gray-900">No content pages yet</h2>
            <p className="mt-2 max-w-lg text-sm text-gray-500">
              Create pages for About, FAQ, Returns & Refunds, Shipping Policy, and Privacy Policy.
            </p>
            <Button onClick={openCreate} className="mt-6 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="mr-2 h-4 w-4" />
              Create First Page
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {pages.map((page) => (
              <div
                key={page.id}
                className="grid gap-4 rounded-xl border border-gray-200 p-4 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">{page.title}</h2>
                    <Badge variant={page.isPublished ? "default" : "secondary"}>
                      {page.isPublished ? "Published" : "Draft"}
                    </Badge>
                    <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                      /{page.slug}
                    </span>
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium capitalize text-emerald-700">
                      {inferPageTemplate(page.slug, page.content)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{page.summary || "No summary provided."}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                    <span>Updated: {formatDateTime(page.updatedAt)}</span>
                    <span>Published: {formatDateTime(page.publishedAt)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => openEdit(page)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleTogglePublish(page)}
                    disabled={updatingId === page.id}
                  >
                    {page.isPublished ? (
                      <ToggleRight className="mr-2 h-4 w-4 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="mr-2 h-4 w-4 text-gray-500" />
                    )}
                    {page.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleDelete(page)}
                    disabled={deletingId === page.id}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPage ? "Edit Content Page" : "Create Content Page"}</DialogTitle>
            <DialogDescription>
              Build About, FAQ, and policy pages for Aura Shop from structured content stored in the CMS.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-2">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="page-template">Template</Label>
                <Select value={form.template} onValueChange={(value) => handleTemplateChange(value as PageTemplate)}>
                  <SelectTrigger id="page-template">
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="about">About</SelectItem>
                    <SelectItem value="faq">FAQ</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="page-title">Title</Label>
                <Input
                  id="page-title"
                  value={form.title}
                  onChange={(event) => setField("title", event.target.value)}
                  placeholder="About Aura Shop"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="page-slug">Slug</Label>
                <Input
                  id="page-slug"
                  value={form.slug}
                  onChange={(event) => setField("slug", event.target.value)}
                  placeholder="about"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="page-summary">Summary</Label>
              <Textarea
                id="page-summary"
                value={form.summary}
                onChange={(event) => setField("summary", event.target.value)}
                placeholder="Short internal description for this content page"
              />
            </div>

            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              The page will be {form.isPublished ? "published to Aura Shop" : "saved as a draft"} when you click save.
              <Button
                type="button"
                variant="ghost"
                className="ml-3 h-auto p-0 font-semibold text-emerald-700 hover:bg-transparent"
                onClick={() => setField("isPublished", !form.isPublished)}
              >
                {form.isPublished ? "Switch to draft" : "Publish now"}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hero-kicker">Hero Kicker</Label>
                <Input
                  id="hero-kicker"
                  value={form.heroKicker}
                  onChange={(event) => setField("heroKicker", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hero-title">Hero Title</Label>
                <Input
                  id="hero-title"
                  value={form.heroTitle}
                  onChange={(event) => setField("heroTitle", event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero-description">Hero Description</Label>
              <Textarea
                id="hero-description"
                value={form.heroDescription}
                onChange={(event) => setField("heroDescription", event.target.value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="seo-title">SEO Title</Label>
                <Input
                  id="seo-title"
                  value={form.seoTitle}
                  onChange={(event) => setField("seoTitle", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seo-description">SEO Description</Label>
                <Input
                  id="seo-description"
                  value={form.seoDescription}
                  onChange={(event) => setField("seoDescription", event.target.value)}
                />
              </div>
            </div>

            {form.template === "about" && (
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="values-heading">Values Section Heading</Label>
                    <Input
                      id="values-heading"
                      value={form.valuesHeading}
                      onChange={(event) => setField("valuesHeading", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team-heading">Team Section Heading</Label>
                    <Input
                      id="team-heading"
                      value={form.teamHeading}
                      onChange={(event) => setField("teamHeading", event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stats-json">Stats JSON</Label>
                  <Textarea
                    id="stats-json"
                    className="min-h-44 font-mono text-sm"
                    value={form.statsJson}
                    onChange={(event) => setField("statsJson", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="values-json">Values JSON</Label>
                  <Textarea
                    id="values-json"
                    className="min-h-56 font-mono text-sm"
                    value={form.valuesJson}
                    onChange={(event) => setField("valuesJson", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team-json">Team JSON</Label>
                  <Textarea
                    id="team-json"
                    className="min-h-56 font-mono text-sm"
                    value={form.teamJson}
                    onChange={(event) => setField("teamJson", event.target.value)}
                  />
                </div>
              </div>
            )}

            {form.template === "faq" && (
              <div className="space-y-2">
                <Label htmlFor="faq-json">FAQ Categories JSON</Label>
                <Textarea
                  id="faq-json"
                  className="min-h-72 font-mono text-sm"
                  value={form.faqJson}
                  onChange={(event) => setField("faqJson", event.target.value)}
                />
              </div>
            )}

            {form.template === "policy" && (
              <div className="space-y-2">
                <Label htmlFor="sections-json">Policy Sections JSON</Label>
                <Textarea
                  id="sections-json"
                  className="min-h-72 font-mono text-sm"
                  value={form.sectionsJson}
                  onChange={(event) => setField("sectionsJson", event.target.value)}
                />
              </div>
            )}

            <p className="text-xs text-gray-500">{templateHint}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
