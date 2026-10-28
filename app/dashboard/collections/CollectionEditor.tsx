"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDown, ArrowUp, Hand, ImageOff, Layers, Loader2, Package, Plus, Search, Sparkles, Trash2, X,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { EmptyState } from "@/components/common/EmptyState"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import {
  collectionApi, apiErrorMessage, apiFieldErrors,
  type CollectionMatch, type CollectionPreview, type CollectionProduct, type CollectionProductSort, type CollectionRule,
  type CollectionRuleField, type CollectionType,
} from "@/lib/collectionApi"
import { productApi, type ProductResponse } from "@/lib/productApi"
import { categoryApi } from "@/lib/categoryApi"
import { brandApi } from "@/lib/brandApi"
import { resolveStorageUrl } from "@/lib/settingsApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------- rule metadata
// Rule shapes follow COLLECTIONS_API_CONTRACT.md §4.

/** Editable rule row: `value` holds the id / text / number (best sellers: the top-N limit), `days` the window. */
interface UiRule {
  field: CollectionRuleField
  operator: string
  value: string
  days: string
}

interface FieldMeta {
  label: string
  operators: { value: string; label: string }[]
  hint?: string
}

const IS = [{ value: "is", label: "is" }, { value: "is_not", label: "is not" }]
const FIELDS: Record<CollectionRuleField, FieldMeta> = {
  category: { label: "Category", operators: IS, hint: "Includes its sub-categories" },
  brand: { label: "Brand", operators: IS },
  tag: { label: "Tag", operators: [{ value: "equals", label: "equals" }, { value: "not_equals", label: "does not equal" }, { value: "contains", label: "contains" }] },
  flag: { label: "Product flag", operators: IS },
  price: { label: "Price", operators: [{ value: "greater_than", label: "greater than" }, { value: "less_than", label: "less than" }], hint: "Compares the price buyers pay now (sale and offer prices included)" },
  on_offer: { label: "On offer", operators: [{ value: "is", label: "is" }], hint: "Products with a live offer price" },
  new_arrivals: { label: "New arrivals", operators: [{ value: "within_days", label: "within" }] },
  best_sellers: { label: "Best sellers", operators: [{ value: "top", label: "top" }], hint: "Products that sold nothing never qualify" },
  in_stock: { label: "In stock", operators: [{ value: "is", label: "is" }], hint: "Always applied, even when matching any condition" },
}
const FIELD_ORDER = Object.keys(FIELDS) as CollectionRuleField[]
const SINGLE_OP = new Set<CollectionRuleField>(["on_offer", "new_arrivals", "best_sellers", "in_stock"])

const FLAGS = [
  { value: "best_seller", label: "Best seller" },
  { value: "hot_deal", label: "Hot deal" },
  { value: "featured", label: "Featured" },
]

const defaultRule = (field: CollectionRuleField): UiRule => {
  const operator = FIELDS[field].operators[0].value
  switch (field) {
    case "flag": return { field, operator, value: "best_seller", days: "" }
    case "new_arrivals": return { field, operator, value: "30", days: "" }
    case "best_sellers": return { field, operator, value: "10", days: "30" }
    default: return { field, operator, value: "", days: "" }
  }
}

const toUiRule = (r: CollectionRule): UiRule => {
  const field = (FIELDS[r.field] ? r.field : "category") as CollectionRuleField
  const operator = r.operator && FIELDS[field].operators.some((o) => o.value === r.operator) ? r.operator : FIELDS[field].operators[0].value
  if (field === "best_sellers") {
    const v = (r.value && typeof r.value === "object" ? r.value : {}) as { limit?: unknown; days?: unknown }
    return { field, operator, value: v.limit == null ? "" : String(v.limit), days: v.days == null ? "" : String(v.days) }
  }
  return { field, operator, value: r.value == null || typeof r.value === "boolean" || typeof r.value === "object" ? "" : String(r.value), days: "" }
}

const isBlank = (v: string) => v.trim() === ""
const isIntIn = (v: string, min: number, max: number) => !isBlank(v) && Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max

/** Returns an error message for an incomplete rule, or null. */
const ruleError = (r: UiRule): string | null => {
  switch (r.field) {
    case "category": return isBlank(r.value) ? "Choose a category" : null
    case "brand": return isBlank(r.value) ? "Choose a brand" : null
    case "tag": return isBlank(r.value) ? "Enter a tag" : r.value.trim().length > 100 ? "Keep the tag under 100 characters" : null
    case "flag": return isBlank(r.value) ? "Choose a flag" : null
    case "price": return isBlank(r.value) || Number.isNaN(Number(r.value)) || Number(r.value) < 0 ? "Enter a price of 0 or more" : null
    case "new_arrivals": return isIntIn(r.value, 1, 3650) ? null : "Days must be between 1 and 3650"
    case "best_sellers":
      return !isIntIn(r.value, 1, 500) ? "Top products must be between 1 and 500" : !isIntIn(r.days, 1, 3650) ? "Days must be between 1 and 3650" : null
    default: return null
  }
}

/** API shape for a complete rule. */
const toApiRule = (r: UiRule): CollectionRule => {
  const base = { field: r.field, operator: r.operator }
  switch (r.field) {
    case "category":
    case "brand": return { ...base, value: Number(r.value) }
    case "tag": return { ...base, value: r.value.trim() }
    case "flag": return { ...base, value: r.value }
    case "price": return { ...base, value: Number(r.value) }
    case "new_arrivals": return { ...base, value: Number(r.value) }
    case "best_sellers": return { ...base, value: { limit: Number(r.value), days: Number(r.days) } }
    default: return { ...base, value: true }
  }
}

const SORTS: { value: CollectionProductSort; label: string }[] = [
  { value: "manual", label: "Manual order" },
  { value: "best_selling", label: "Best selling" },
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
]

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120)
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const fromProduct = (p: ProductResponse): CollectionProduct => ({
  id: p.id,
  name: p.name,
  sku: p.sku,
  imageUrl: resolveStorageUrl(p.image) || null,
  price: Number(p.price ?? 0),
  salePrice: Number(p.sale_price ?? p.salePrice ?? 0) || null,
  stock: p.stock ?? null,
  published: p.published,
})

interface FormState {
  name: string
  slug: string
  description: string
  type: CollectionType
  match: CollectionMatch
  rules: UiRule[]
  products: CollectionProduct[]
  productSort: CollectionProductSort
  isPublished: boolean
  showOnHomepage: boolean
  seoTitle: string
  seoDescription: string
  imageUrl: string
  imageFile: File | null
  removeImage: boolean
}

const emptyForm: FormState = {
  name: "", slug: "", description: "", type: "manual", match: "all", rules: [defaultRule("category")], products: [],
  productSort: "manual", isPublished: true, showOnHomepage: false, seoTitle: "", seoDescription: "",
  imageUrl: "", imageFile: null, removeImage: false,
}

// ---------------------------------------------------------------- editor

export function CollectionEditor({ collectionId }: { collectionId: number | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const { formatCurrency } = useCompanySettings()
  const { hasPermission } = useSaasAuth()
  const isNew = collectionId == null

  const [form, setForm] = useState<FormState>(emptyForm)
  const [slugTouched, setSlugTouched] = useState(!isNew)
  const [loading, setLoading] = useState(!isNew)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showRuleErrors, setShowRuleErrors] = useState(false)
  /** Server-side (422) messages per rule index. */
  const [ruleServerErrors, setRuleServerErrors] = useState<Record<number, string>>({})
  const [sortTouched, setSortTouched] = useState(!isNew)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [initialName, setInitialName] = useState("")

  const [categories, setCategories] = useState<{ value: string; label: string }[]>([])
  const [brands, setBrands] = useState<{ value: string; label: string }[]>([])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key as string]) setErrors((e) => { const n = { ...e }; delete n[key as string]; return n })
  }

  // Load the collection
  useEffect(() => {
    if (isNew) return
    let alive = true
    collectionApi.getById(collectionId!)
      .then((c) => {
        if (!alive) return
        setInitialName(c.name)
        setForm({
          name: c.name, slug: c.slug, description: c.description ?? "", type: c.type, match: c.match,
          rules: c.rules.length ? c.rules.map(toUiRule) : [defaultRule("category")],
          products: [...(c.products ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
          productSort: c.productSort, isPublished: c.isPublished, showOnHomepage: c.showOnHomepage,
          seoTitle: c.seoTitle ?? "", seoDescription: c.seoDescription ?? "",
          imageUrl: c.imageUrl ?? "", imageFile: null, removeImage: false,
        })
      })
      .catch((err) => {
        if (!alive) return
        if (err?.response?.status === 404) setNotFound(true)
        else toast({ variant: "destructive", title: "Could not load collection", description: apiErrorMessage(err) })
      })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId])

  // Category + brand options for the rule builder
  useEffect(() => {
    categoryApi.getSimple()
      .then((r) => setCategories(r.data.map((c: any) => ({ value: String(c.id), label: c.categoryName ?? c.category_name ?? c.name ?? `#${c.id}` }))))
      .catch(() => {})
    brandApi.simple()
      .then((r) => setBrands(r.map((b: any) => ({ value: String(b.id), label: b.brandName ?? b.brand_name ?? b.name ?? `#${b.id}` }))))
      .catch(() => {})
  }, [])

  // Image preview URL (revoke object URLs)
  const imagePreview = useMemo(() => (form.imageFile ? URL.createObjectURL(form.imageFile) : form.removeImage ? "" : form.imageUrl), [form.imageFile, form.imageUrl, form.removeImage])
  useEffect(() => () => { if (form.imageFile && imagePreview) URL.revokeObjectURL(imagePreview) }, [form.imageFile, imagePreview])

  // ------------------------------------------------ live preview (automatic)
  const completeRules = useMemo(() => form.rules.filter((r) => !ruleError(r)).map(toApiRule), [form.rules])
  const previewKey = JSON.stringify({ m: form.match, r: completeRules, s: form.productSort })
  const [preview, setPreview] = useState<CollectionPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    if (form.type !== "automatic" || loading) return
    if (completeRules.length === 0) { setPreview(null); setPreviewError(null); return }
    const ctrl = new AbortController()
    setPreviewLoading(true)
    const t = setTimeout(() => {
      collectionApi.preview({ type: "automatic", match: form.match, rules: completeRules, productSort: form.productSort, limit: 12 }, ctrl.signal)
        .then((r) => { setPreview(r); setPreviewError(null) })
        .catch((err) => { if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") setPreviewError(apiErrorMessage(err, "Could not load preview")) })
        .finally(() => { if (!ctrl.signal.aborted) setPreviewLoading(false) })
    }, 450)
    return () => { clearTimeout(t); ctrl.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, form.type, loading])

  const blocked = useModuleGuard("Collections")
  if (blocked) return blocked

  const canWrite = hasPermission("Collections", "write")
  const canDelete = hasPermission("Collections", "delete")

  // ------------------------------------------------ rules helpers
  const clearRuleServerError = (i: number) =>
    setRuleServerErrors((prev) => { if (!(i in prev)) return prev; const n = { ...prev }; delete n[i]; return n })
  const updateRule = (i: number, patch: Partial<UiRule>) => {
    clearRuleServerError(i)
    set("rules", form.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  const changeField = (i: number, field: CollectionRuleField) => {
    clearRuleServerError(i)
    set("rules", form.rules.map((r, j) => (j === i ? defaultRule(field) : r)))
  }
  const changeType = (type: CollectionType) => {
    setForm((f) => ({
      ...f,
      type,
      // Contract default: manual -> "manual", automatic -> "best_selling" (until the admin picks one)
      productSort: sortTouched ? f.productSort : type === "automatic" ? "best_selling" : "manual",
    }))
  }
  const addRule = () => {
    const used = new Set(form.rules.map((r) => r.field))
    const next = FIELD_ORDER.find((f) => !used.has(f)) ?? "category"
    set("rules", [...form.rules, defaultRule(next)])
  }
  const removeRule = (i: number) => {
    setRuleServerErrors({})
    set("rules", form.rules.filter((_, j) => j !== i))
  }

  // ------------------------------------------------ manual products helpers
  const addProduct = (p: CollectionProduct) => {
    if (form.products.some((x) => x.id === p.id)) return
    set("products", [...form.products, p])
  }
  const removeProduct = (id: number) => set("products", form.products.filter((p) => p.id !== id))
  const moveProduct = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= form.products.length) return
    const next = [...form.products]
    ;[next[i], next[j]] = [next[j], next[i]]
    set("products", next)
  }

  // ------------------------------------------------ save
  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = "Give the collection a name"
    else if (form.name.trim().length > 150) e.name = "Keep the name under 150 characters"
    const slug = form.slug.trim() || slugify(form.name)
    if (!slug) e.slug = "Enter a slug"
    else if (!SLUG_RE.test(slug)) e.slug = "Use lowercase letters, numbers and dashes only"
    if (form.description.length > 5000) e.description = "Keep the description under 5000 characters"
    if (form.type === "automatic") {
      if (form.rules.length === 0) e.rules = "Add at least one condition"
      else if (form.rules.length > 20) e.rules = "A collection can have at most 20 conditions"
      else if (form.rules.some((r) => ruleError(r))) e.rules = "Complete or remove the highlighted conditions"
    }
    if (form.type === "manual" && form.products.length > 1000) e.products = "A collection can hold at most 1000 hand-picked products"
    if (form.seoTitle.length > 255) e.seoTitle = "Keep the SEO title under 255 characters"
    if (form.seoDescription.length > 500) e.seoDescription = "Keep the SEO description under 500 characters"
    return e
  }

  const save = async () => {
    const e = validate()
    setErrors(e)
    setShowRuleErrors(true)
    if (Object.keys(e).length) {
      toast({ variant: "destructive", title: "Check the form", description: Object.values(e)[0] })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim() || slugify(form.name),
        description: form.description.trim() || null,
        type: form.type,
        match: form.match,
        rules: form.type === "automatic" ? form.rules.map(toApiRule) : [],
        productSort: form.productSort,
        isPublished: form.isPublished,
        showOnHomepage: form.showOnHomepage,
        seoTitle: form.seoTitle.trim() || null,
        seoDescription: form.seoDescription.trim() || null,
        productIds: form.type === "manual" ? form.products.map((p) => p.id) : undefined,
        imageFile: form.imageFile,
        removeImage: form.removeImage && !form.imageFile ? true : undefined,
      }
      setRuleServerErrors({})
      // productIds in the body saves the manual products and their order in the same request
      const saved = isNew ? await collectionApi.create(payload) : await collectionApi.update(collectionId!, payload)
      toast({ title: isNew ? "Collection created" : "Collection saved", description: payload.name })
      if (isNew) router.replace(`/dashboard/collections/${saved.id}`)
      else {
        setInitialName(saved.name || payload.name)
        setForm((f) => ({
          ...f,
          slug: saved.slug || payload.slug,
          imageUrl: saved.imageUrl ?? "",
          imageFile: null,
          removeImage: false,
          rules: saved.type === "automatic" && saved.rules.length ? saved.rules.map(toUiRule) : f.rules,
        }))
        setSlugTouched(true)
      }
    } catch (err: any) {
      if (err?.response?.status === 422) {
        const fe = apiFieldErrors(err)
        const mapped: Record<string, string> = {}
        const perRule: Record<number, string> = {}
        Object.entries(fe).forEach(([k, v]) => {
          const m = /^rules\.(\d+)/.exec(k)
          if (m) { perRule[Number(m[1])] = v; return }
          const key = k.startsWith("rules") ? "rules" : k.startsWith("productIds") ? "products" : k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
          if (!mapped[key]) mapped[key] = v
        })
        if (Object.keys(perRule).length && !mapped.rules) mapped.rules = "Fix the highlighted conditions"
        setRuleServerErrors(perRule)
        setErrors(mapped)
      }
      toast({ variant: "destructive", title: "Could not save", description: apiErrorMessage(err) })
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (isNew) return
    setDeleting(true)
    try {
      await collectionApi.delete(collectionId!)
      toast({ title: "Collection deleted", description: initialName })
      router.push("/dashboard/collections")
    } catch (err) {
      toast({ variant: "destructive", title: "Could not delete", description: apiErrorMessage(err) })
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const title = isNew ? "New collection" : initialName || "Collection"
  const priceOf = (p: CollectionProduct) => {
    const sale = p.effectivePrice ?? p.salePrice ?? null
    const base = p.price ?? null
    if (sale != null && base != null && sale > 0 && sale < base) return <><span className="font-medium">{formatCurrency(sale)}</span> <s className="text-muted-foreground">{formatCurrency(base)}</s></>
    const v = base ?? sale
    return v == null ? "—" : formatCurrency(v)
  }

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <div className="flex flex-col gap-1.5">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/dashboard/collections">Collections</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{title}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <PageHeader
          title={title}
          description={isNew ? "Group products for your online store." : `/${form.slug}`}
          actions={!notFound && <>
            {!isNew && canDelete && (
              <Button type="button" variant="outline" onClick={() => setDeleteOpen(true)} disabled={loading}>
                <Trash2 className="size-4" aria-hidden /> Delete
              </Button>
            )}
            <Button type="button" variant="outline" asChild><Link href="/dashboard/collections">Cancel</Link></Button>
            <Button type="button" onClick={save} disabled={saving || loading || !canWrite}>
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {saving ? "Saving…" : isNew ? "Create collection" : "Save changes"}
            </Button>
          </>}
        />
      </div>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-5"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>
          <div className="flex flex-col gap-5"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-56 rounded-xl" /></div>
        </div>
      ) : notFound ? (
        <EmptyState icon={Layers} bordered title="Collection not found" description="It may have been deleted."
          action={<Button asChild variant="link"><Link href="/dashboard/collections">Back to collections</Link></Button>} />
      ) : (
        <form className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" onSubmit={(e) => { e.preventDefault(); save() }}>
          {/* -------------------------------------------------- main column */}
          <div className="flex min-w-0 flex-col gap-5">
            <SectionCard title="Details" contentClassName="flex flex-col gap-4">
              <FormField label="Name" required htmlFor="col-name" error={errors.name}>
                <Input id="col-name" placeholder="e.g. Summer sale" value={form.name} autoFocus={isNew} aria-invalid={!!errors.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }))
                    setErrors((er) => { const n = { ...er }; delete n.name; if (!slugTouched) delete n.slug; return n })
                  }} />
              </FormField>
              <FormField label="URL slug" htmlFor="col-slug" error={errors.slug}
                description={<>Store address: <span className="font-mono">/collections/{form.slug || slugify(form.name) || "…"}</span></>}>
                <div className="flex gap-2">
                  <Input id="col-slug" className="font-mono" placeholder="summer-sale" value={form.slug} aria-invalid={!!errors.slug}
                    onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-")) }}
                    onBlur={() => form.slug && set("slug", slugify(form.slug))} />
                  {slugTouched && (
                    <Button type="button" variant="outline" onClick={() => { setSlugTouched(false); set("slug", slugify(form.name)) }}>
                      Reset
                    </Button>
                  )}
                </div>
              </FormField>
              <FormField label="Description" htmlFor="col-description" error={errors.description}>
                <Textarea id="col-description" rows={3} placeholder="Shown at the top of the collection page" value={form.description}
                  onChange={(e) => set("description", e.target.value)} />
              </FormField>
            </SectionCard>

            <SectionCard title="Collection type" description="Pick products yourself, or let rules keep the collection up to date."
              contentClassName="flex flex-col gap-4">
              <ChoiceCardGroup value={form.type} onValueChange={(v) => changeType(v as CollectionType)} aria-label="Collection type" className="sm:grid-cols-2">
                <ChoiceCard value="manual" icon={<Hand className="size-4" aria-hidden />} title="Manual"
                  description="Choose products one by one and set their order." />
                <ChoiceCard value="automatic" icon={<Sparkles className="size-4" aria-hidden />} title="Automatic"
                  description="Products that match your conditions are added and removed on their own." />
              </ChoiceCardGroup>
            </SectionCard>

            {form.type === "manual" ? (
              <ManualProducts
                products={form.products}
                error={errors.products}
                onAdd={addProduct}
                onRemove={removeProduct}
                onMove={moveProduct}
                priceOf={priceOf}
              />
            ) : (
              <>
                <SectionCard title="Conditions" contentClassName="flex flex-col gap-4"
                  description="Products are added when they match these conditions.">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>Products must match</span>
                    <SegmentedControl aria-label="Products must match" value={form.match} onValueChange={(v) => set("match", v as CollectionMatch)}
                      options={[{ value: "all", label: "All conditions" }, { value: "any", label: "Any condition" }]} />
                  </div>
                  <ul className="flex flex-col gap-2">
                    {form.rules.map((r, i) => (
                      <RuleRow key={i} index={i} rule={r} categories={categories} brands={brands}
                        error={ruleServerErrors[i] ?? (showRuleErrors ? ruleError(r) : null)}
                        canRemove={form.rules.length > 1}
                        onField={(f) => changeField(i, f)}
                        onChange={(p) => updateRule(i, p)}
                        onRemove={() => removeRule(i)} />
                    ))}
                  </ul>
                  {errors.rules && <p role="alert" className="text-sm text-destructive">{errors.rules}</p>}
                  <div>
                    <Button type="button" variant="outline" onClick={addRule}><Plus className="size-4" aria-hidden /> Add condition</Button>
                  </div>
                </SectionCard>

                <SectionCard title="Matching products"
                  description="Live preview. Only products that are published and visible online appear on the store."
                  actions={
                    <span className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                      {previewLoading && <Loader2 className="size-4 animate-spin" aria-hidden />}
                      {preview && completeRules.length > 0 && <Badge variant="secondary" className="tabular-nums">{preview.total} product{preview.total === 1 ? "" : "s"}</Badge>}
                    </span>
                  }>
                  {completeRules.length === 0 ? (
                    <EmptyState icon={Sparkles} title="Add a condition" description="Matching products show up here as you build the rules." className="p-4 md:p-6" />
                  ) : previewError ? (
                    <p role="alert" className="text-sm text-destructive">{previewError}</p>
                  ) : !preview && previewLoading ? (
                    <div className="flex flex-col gap-2">{[1, 2, 3].map((k) => <Skeleton key={k} className="h-12 rounded-lg" />)}</div>
                  ) : preview && preview.products.length === 0 ? (
                    <EmptyState icon={Package} title="No products match" description="Try loosening the conditions or switching to “Any condition”." className="p-4 md:p-6" />
                  ) : preview ? (
                    <div className={cn("flex flex-col gap-2 transition-opacity", previewLoading && "opacity-60")}>
                      <ul className="divide-y rounded-lg border">
                        {preview.products.map((p) => (
                          <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                            <UserAvatar shape="square" src={p.imageUrl || null} alt="" name={p.name} className="size-10" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{p.name}</div>
                              <div className="truncate text-xs text-muted-foreground tabular-nums">
                                {[p.sku, p.categoryName, p.stock == null ? null : p.stock <= 0 ? "Out of stock" : `${p.stock} in stock`,
                                  p.unitsSold ? `${p.unitsSold} sold` : null].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                            {p.visibleOnStorefront === false && <Badge variant="outline">Hidden online</Badge>}
                            <div className="text-right text-sm tabular-nums">{priceOf(p)}</div>
                          </li>
                        ))}
                      </ul>
                      {preview.total > preview.products.length && (
                        <p className="text-xs text-muted-foreground">Showing the first {preview.products.length} of {preview.total}.</p>
                      )}
                      {preview.hint && <p className="text-xs text-muted-foreground">{preview.hint} {preview.visibleTotal} will show on the store.</p>}
                    </div>
                  ) : null}
                </SectionCard>
              </>
            )}

            <SectionCard title="Search engine listing" description="How this collection appears in Google and when shared." contentClassName="flex flex-col gap-4">
              <FormField label="SEO title" htmlFor="col-seo-title" error={errors.seoTitle}
                description={`${form.seoTitle.length} characters (about 60 show in Google) · leave blank to use the collection name`}>
                <Input id="col-seo-title" value={form.seoTitle} placeholder={form.name || "Collection name"} aria-invalid={!!errors.seoTitle}
                  onChange={(e) => set("seoTitle", e.target.value)} />
              </FormField>
              <FormField label="SEO description" htmlFor="col-seo-description" error={errors.seoDescription}
                description={`${form.seoDescription.length} characters (about 160 show in Google)`}>
                <Textarea id="col-seo-description" rows={3} value={form.seoDescription} aria-invalid={!!errors.seoDescription}
                  placeholder={form.description || "A short summary for search results"}
                  onChange={(e) => set("seoDescription", e.target.value)} />
              </FormField>
            </SectionCard>
          </div>

          {/* -------------------------------------------------- side column */}
          <div className="flex min-w-0 flex-col gap-5">
            <SectionCard title="Visibility" contentClassName="flex flex-col gap-3">
              <Item variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle id="col-pub-label">Published</ItemTitle>
                  <ItemDescription>Visible on your online store</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Switch checked={form.isPublished} onCheckedChange={(v) => set("isPublished", v)} aria-labelledby="col-pub-label" />
                </ItemActions>
              </Item>
              <Item variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle id="col-home-label">Show on homepage</ItemTitle>
                  <ItemDescription>{form.isPublished ? "Feature it on the store homepage" : "Only shown once published"}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Switch checked={form.showOnHomepage} onCheckedChange={(v) => set("showOnHomepage", v)} aria-labelledby="col-home-label" />
                </ItemActions>
              </Item>
            </SectionCard>

            <SectionCard title="Image" contentClassName="flex flex-col gap-3">
              <Button asChild variant="outline" className="h-auto min-h-36 w-full cursor-pointer flex-col gap-2 border-dashed p-3">
                <Label htmlFor="col-image">
                  {imagePreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="" className="aspect-[16/9] w-full rounded-md bg-muted object-cover" />
                      <span className="max-w-full truncate text-xs text-muted-foreground">{form.imageFile?.name ?? "Click to replace"}</span>
                    </>
                  ) : (
                    <>
                      <ImageOff className="size-6 text-muted-foreground" aria-hidden />
                      <span>Click to upload an image</span>
                      <span className="text-xs font-normal text-muted-foreground">JPG, PNG, WebP or GIF · up to 5 MB</span>
                    </>
                  )}
                </Label>
              </Button>
              <Input id="col-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  e.target.value = ""
                  if (!file) return
                  if (file.size > 5 * 1024 * 1024) { toast({ variant: "destructive", title: "Image too large", description: "Choose an image under 5 MB" }); return }
                  setForm((f) => ({ ...f, imageFile: file, removeImage: false }))
                }} />
              {errors.image && <p role="alert" className="text-sm text-destructive">{errors.image}</p>}
              {imagePreview && (
                <Button type="button" variant="ghost" size="sm" className="self-start"
                  onClick={() => setForm((f) => ({ ...f, imageFile: null, removeImage: !!f.imageUrl }))}>
                  <X className="size-4" aria-hidden /> Remove image
                </Button>
              )}
            </SectionCard>

            <SectionCard title="Product order" contentClassName="flex flex-col gap-2">
              <FormField label="Default sort on the collection page" htmlFor="col-sort">
                <Select value={form.productSort} onValueChange={(v) => { setSortTouched(true); set("productSort", v as CollectionProductSort) }}>
                  <SelectTrigger id="col-sort" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SORTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.value === "manual" && form.type === "automatic" ? "Default (newest, or best-seller rank)" : s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <p className="text-xs text-muted-foreground">Shoppers can still change the sort on the store.</p>
            </SectionCard>

            {!isNew && (
              <SectionCard title="Summary" contentClassName="flex flex-col gap-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>{form.type === "manual" ? "Manual" : "Automatic"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Products</span>
                  <span className="tabular-nums">{form.type === "manual" ? form.products.length : preview?.total ?? "—"}</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span>{form.isPublished ? "Published" : "Hidden"}</span></div>
              </SectionCard>
            )}
          </div>
        </form>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="font-dash-body text-dash-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {initialName || "this collection"}?</AlertDialogTitle>
            <AlertDialogDescription>The collection is removed from your store. Its products are not deleted. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------- rule row

function RuleRow({ index, rule, categories, brands, error, canRemove, onField, onChange, onRemove }: {
  index: number
  rule: UiRule
  categories: { value: string; label: string }[]
  brands: { value: string; label: string }[]
  error: string | null
  canRemove: boolean
  onField: (f: CollectionRuleField) => void
  onChange: (patch: Partial<UiRule>) => void
  onRemove: () => void
}) {
  const meta = FIELDS[rule.field] ?? FIELDS.category
  const id = `rule-${index}`
  const n = index + 1
  const errorId = error ? `${id}-error` : undefined
  return (
    <li className={cn("flex flex-col gap-2 rounded-lg border p-3", error && "border-destructive")}>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`${id}-field`} className="sr-only">Condition {n} field</Label>
        <Select value={rule.field} onValueChange={(v) => onField(v as CollectionRuleField)}>
          <SelectTrigger id={`${id}-field`} className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELD_ORDER.map((f) => <SelectItem key={f} value={f}>{FIELDS[f].label}</SelectItem>)}
          </SelectContent>
        </Select>

        {!SINGLE_OP.has(rule.field) && (
          <>
            <Label htmlFor={`${id}-op`} className="sr-only">Condition {n} operator</Label>
            <Select value={rule.operator} onValueChange={(v) => onChange({ operator: v })}>
              <SelectTrigger id={`${id}-op`} className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {meta.operators.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}

        <div className="flex min-w-[180px] flex-1 flex-wrap items-center gap-2">
          {rule.field === "category" && (
            <div className="min-w-[180px] flex-1">
              <SearchableSelect options={categories} value={rule.value} onChange={(v) => onChange({ value: v })}
                placeholder="Choose a category" searchPlaceholder="Search categories…" emptyText="No categories found." />
            </div>
          )}
          {rule.field === "brand" && (
            <div className="min-w-[180px] flex-1">
              <SearchableSelect options={brands} value={rule.value} onChange={(v) => onChange({ value: v })}
                placeholder="Choose a brand" searchPlaceholder="Search brands…" emptyText="No brands found." />
            </div>
          )}
          {rule.field === "tag" && (
            <>
              <Label htmlFor={`${id}-value`} className="sr-only">Condition {n} tag</Label>
              <Input id={`${id}-value`} className="min-w-[160px] flex-1" placeholder="e.g. summer" maxLength={100} value={rule.value}
                aria-invalid={!!error} aria-describedby={errorId} onChange={(e) => onChange({ value: e.target.value })} />
            </>
          )}
          {rule.field === "flag" && (
            <>
              <Label htmlFor={`${id}-value`} className="sr-only">Condition {n} flag</Label>
              <Select value={rule.value} onValueChange={(v) => onChange({ value: v })}>
                <SelectTrigger id={`${id}-value`} className="w-[160px]"><SelectValue placeholder="Choose a flag" /></SelectTrigger>
                <SelectContent>
                  {FLAGS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
          {rule.field === "price" && (
            <>
              <Label htmlFor={`${id}-value`} className="sr-only">Condition {n} price</Label>
              <Input id={`${id}-value`} type="number" min={0} step="0.01" inputMode="decimal" className="w-[140px]" placeholder="0.00"
                aria-invalid={!!error} aria-describedby={errorId} value={rule.value} onChange={(e) => onChange({ value: e.target.value })} />
            </>
          )}
          {rule.field === "new_arrivals" && (
            <>
              <span className="text-sm text-muted-foreground">added in the last</span>
              <Label htmlFor={`${id}-value`} className="sr-only">Condition {n} days</Label>
              <Input id={`${id}-value`} type="number" min={1} max={3650} step={1} className="w-[90px]" value={rule.value}
                aria-invalid={!!error} aria-describedby={errorId} onChange={(e) => onChange({ value: e.target.value })} />
              <span className="text-sm text-muted-foreground">days</span>
            </>
          )}
          {rule.field === "best_sellers" && (
            <>
              <span className="text-sm text-muted-foreground">top</span>
              <Label htmlFor={`${id}-value`} className="sr-only">Condition {n} number of products</Label>
              <Input id={`${id}-value`} type="number" min={1} max={500} step={1} className="w-[80px]" value={rule.value}
                aria-invalid={!!error} aria-describedby={errorId} onChange={(e) => onChange({ value: e.target.value })} />
              <span className="text-sm text-muted-foreground">by units sold in the last</span>
              <Label htmlFor={`${id}-days`} className="sr-only">Condition {n} days</Label>
              <Input id={`${id}-days`} type="number" min={1} max={3650} step={1} className="w-[80px]" value={rule.days}
                aria-invalid={!!error} aria-describedby={errorId} onChange={(e) => onChange({ days: e.target.value })} />
              <span className="text-sm text-muted-foreground">days</span>
            </>
          )}
          {(rule.field === "on_offer" || rule.field === "in_stock") && (
            <span className="text-sm text-muted-foreground">{meta.hint}</span>
          )}
        </div>

        <WithTooltip content={canRemove ? `Remove condition ${n}` : "An automatic collection needs at least one condition"}>
          <span tabIndex={canRemove ? -1 : 0} className="ml-auto">
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove condition ${n}`} disabled={!canRemove} onClick={onRemove}>
              <Trash2 className="size-4" />
            </Button>
          </span>
        </WithTooltip>
      </div>

      {meta.hint && rule.field !== "on_offer" && rule.field !== "in_stock" && (
        <p className="text-xs text-muted-foreground">{meta.hint}</p>
      )}
      {error && <p id={errorId} className="text-xs text-destructive">{error}</p>}
    </li>
  )
}

// ---------------------------------------------------------------- manual picker

function ManualProducts({ products, error, onAdd, onRemove, onMove, priceOf }: {
  products: CollectionProduct[]
  error?: string
  onAdd: (p: CollectionProduct) => void
  onRemove: (id: number) => void
  onMove: (index: number, dir: -1 | 1) => void
  priceOf: (p: CollectionProduct) => React.ReactNode
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CollectionProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const reqId = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setSearching(false); return }
    const my = ++reqId.current
    setSearching(true)
    const t = setTimeout(() => {
      productApi.getAll({ search: q, limit: 12 })
        .then((r) => { if (my === reqId.current) setResults(r.data.map(fromProduct)) })
        .catch(() => { if (my === reqId.current) setResults([]) })
        .finally(() => { if (my === reqId.current) setSearching(false) })
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const chosen = new Set(products.map((p) => p.id))

  return (
    <SectionCard title="Products" description="Search and add products. The order here is the manual order on the store."
      actions={<Badge variant="secondary" className="tabular-nums">{products.length} selected</Badge>}
      contentClassName="flex flex-col gap-3">
      <div className="relative">
        <Label htmlFor="col-product-search" className="sr-only">Search products to add</Label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id="col-product-search" type="search" className="pl-9" placeholder="Search products by name, SKU or barcode…"
          value={query} autoComplete="off"
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); if (e.key === "Enter") e.preventDefault() }} />
        {searching && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      </div>

      {open && query.trim() && (
        <div className="rounded-lg border">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{searching ? "Searching…" : "No products found."}</p>
          ) : (
            <ul className="max-h-72 divide-y overflow-y-auto" aria-label="Search results">
              {results.map((p) => {
                const added = chosen.has(p.id)
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <UserAvatar shape="square" src={p.imageUrl || null} alt="" name={p.name} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{p.sku ? `${p.sku} · ` : ""}{p.stock ?? 0} in stock</div>
                    </div>
                    <div className="text-sm tabular-nums">{priceOf(p)}</div>
                    <Button type="button" size="sm" variant={added ? "ghost" : "outline"} disabled={added} onClick={() => onAdd(p)}>
                      {added ? "Added" : <><Plus className="size-4" aria-hidden /> Add</>}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {products.length === 0 ? (
        <EmptyState icon={Package} bordered title="No products yet" description="Search above to add products to this collection." className="p-4 md:p-6" />
      ) : (
        <ol className="divide-y rounded-lg border">
          {products.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <UserAvatar shape="square" src={p.imageUrl || null} alt="" name={p.name} className="size-10" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground tabular-nums">
                  {p.sku && <span>{p.sku}</span>}
                  <span className={cn(p.stock != null && p.stock <= 0 && "text-destructive")}>
                    {p.stock == null ? "—" : p.stock <= 0 ? "Out of stock" : `${p.stock} in stock`}
                  </span>
                </div>
              </div>
              {(p.visibleOnStorefront === false || p.published === false) && (
                <WithTooltip content="Not published or not visible online, so the store won’t show it">
                  <Badge variant="outline" tabIndex={0}>Hidden online</Badge>
                </WithTooltip>
              )}
              <div className="hidden text-right text-sm tabular-nums sm:block">{priceOf(p)}</div>
              <div className="flex gap-1">
                <WithTooltip content={`Move ${p.name} up`}>
                  <Button type="button" variant="outline" size="icon-sm" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => onMove(i, -1)}>
                    <ArrowUp className="size-4" />
                  </Button>
                </WithTooltip>
                <WithTooltip content={`Move ${p.name} down`}>
                  <Button type="button" variant="outline" size="icon-sm" aria-label={`Move ${p.name} down`} disabled={i === products.length - 1} onClick={() => onMove(i, 1)}>
                    <ArrowDown className="size-4" />
                  </Button>
                </WithTooltip>
                <WithTooltip content={`Remove ${p.name}`}>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${p.name}`} onClick={() => onRemove(p.id)}>
                    <X className="size-4" />
                  </Button>
                </WithTooltip>
              </div>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  )
}
