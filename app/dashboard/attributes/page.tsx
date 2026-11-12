"use client"

import type React from "react"
import { Fragment, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { Download, Layers, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { Toolbar } from "@/components/common/Toolbar"
import { BulkBar } from "@/components/common/BulkBar"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { ColorPicker } from "@/components/common/ColorPicker"
import { SectionCard } from "@/components/common/SectionCard"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusTabs } from "@/components/ui/status-tabs"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { exportToCSV, parseCSV } from "@/lib/export-import-utils"
import { usePagination } from "@/hooks/use-pagination"
import { useAttribute, type Attribute } from "@/contexts/attribute-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { WithTooltip } from "@/components/common/WithTooltip"

type Option = "dropdown" | "radio" | "button" | "swatch"
type FormState = { name: string; displayName: string; option: Option; values: string[]; colors: Record<string, string>; published: boolean }

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
const HEX = /^#[0-9a-f]{6}$/i
type K = ParseKeys<["catalog", "common"]>

const emptyForm: FormState = { name: "", displayName: "", option: "dropdown", values: [], colors: {}, published: true }
// Labels are translation keys, translated at render
const OPTION_LABEL: Record<string, K> = { dropdown: "catalog:attributes.options.dropdown", radio: "catalog:attributes.options.buttons", button: "catalog:attributes.options.buttons", swatch: "catalog:attributes.options.swatch" }

// `sub` is a translation key, or a glyph preview shown as-is
const OPTIONS: { value: Option; label: K; sub: K | null; glyph?: string }[] = [
  { value: "dropdown", label: "catalog:attributes.options.dropdown", sub: "catalog:attributes.options.listMenu" },
  { value: "radio", label: "catalog:attributes.options.buttons", sub: null, glyph: "S  M  L" },
  { value: "swatch", label: "catalog:attributes.options.swatch", sub: null, glyph: "● ● ●" },
]


export default function AttributesPage() {
  const { t } = useTranslation(["catalog", "common"])
  const { attributes, isLoading, addAttribute, updateAttribute, deleteAttribute } = useAttribute()
  const { toast } = useToast()
  const prod = (n: number) => t("common:count.products", { count: n })

  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("all")
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<FormState>(emptyForm)
  const [editing, setEditing] = useState<Attribute | null>(null)
  const [chipDraft, setChipDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteTargets, setDeleteTargets] = useState<Attribute[]>([])
  const [deleting, setDeleting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const chipRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return attributes.filter(
      (a) =>
        (tab === "all" || (tab === "published" ? a.published : !a.published)) &&
        (!q || a.name?.toLowerCase().includes(q) || a.displayName?.toLowerCase().includes(q) || slugify(a.name).includes(q) || a.values.some((v) => v.toLowerCase().includes(q))),
    )
  }, [attributes, search, tab])
  const publishedCount = attributes.filter((a) => a.published).length

  const { currentItems, currentPage, totalPages, itemsPerPage, setCurrentPage, handleItemsPerPageChange } = usePagination(filtered, 10)

  const blocked = useModuleGuard("Attributes")
  if (blocked) return blocked

  const allChecked = filtered.length > 0 && filtered.every((a) => checked.has(a.id))
  const toggleAll = () => setChecked((prev) => { const n = new Set(prev); filtered.forEach((a) => (allChecked ? n.delete(a.id) : n.add(a.id))); return n })
  const toggleOne = (id: string) =>
    setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selected = attributes.filter((a) => checked.has(a.id))

  const resetForm = () => { setEditing(null); setForm(emptyForm); setChipDraft("") }

  const startEdit = (a: Attribute, focusValues = false) => {
    setEditing(a)
    setForm({ name: a.name, displayName: a.displayName, option: a.option ?? "dropdown", values: [...a.values], colors: { ...(a.valueColors ?? {}) }, published: a.published })
    setChipDraft("")
    if (focusValues) setTimeout(() => chipRef.current?.focus(), 50)
  }

  const addChip = (raw: string) => {
    const v = raw.replace(/,/g, " ").trim()
    if (!v) return
    if (form.values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      toast({ variant: "destructive", title: t("catalog:attributes.toast.valueDuplicate"), description: v })
      setChipDraft("")
      return
    }
    setForm((f) => (f.values.some((x) => x.toLowerCase() === v.toLowerCase()) ? f : { ...f, values: [...f.values, v], colors: f.option === "swatch" ? { ...f.colors, [v]: f.colors[v] ?? "#2449E8" } : f.colors }))
    setChipDraft("")
  }

  const handleSave = async () => {
    const pending = chipDraft.replace(/,/g, " ").trim()
    const values = pending && !form.values.some((x) => x.toLowerCase() === pending.toLowerCase()) ? [...form.values, pending] : form.values
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: t("catalog:shared.nameRequired"), description: t("catalog:attributes.toast.nameRequiredDesc") })
      return
    }
    if (values.length === 0) {
      toast({ variant: "destructive", title: t("catalog:attributes.toast.needValue"), description: t("catalog:attributes.toast.needValueDesc") })
      return
    }
    const nm = form.name.trim().toLowerCase()
    if (attributes.some((a) => a.id !== editing?.id && (a.name.trim().toLowerCase() === nm))) {
      toast({ variant: "destructive", title: t("catalog:shared.nameUsed"), description: t("catalog:attributes.toast.nameUsedDesc", { name: form.name.trim() }) })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        displayName: form.displayName.trim() || form.name.trim(),
        option: form.option,
        published: form.published,
        values: values.join(","),
        valueColors: form.option === "swatch" ? form.colors : undefined,
      }
      if (editing) {
        await updateAttribute(editing.id, payload as any)
        toast({ title: t("catalog:attributes.toast.updated"), description: payload.name })
      } else {
        await addAttribute(payload as any)
        toast({ title: t("catalog:attributes.toast.added"), description: payload.name })
      }
      resetForm()
    } catch (error: any) {
      toast({ variant: "destructive", title: t("catalog:shared.couldNotSave"), description: error?.message || t("common:extra.tryAgain") })
    } finally {
      setSaving(false)
    }
  }

  const setPublished = async (targets: Attribute[], published: boolean) => {
    const results = await Promise.allSettled(targets.map((a) => updateAttribute(a.id, { published })))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: t("catalog:shared.someFailed"), description: t("catalog:attributes.toast.failedOf", { failed, total: targets.length }) })
    else toast({ title: published ? t("common:status.published") : t("catalog:shared.unpublished"), description: t("catalog:attributes.toast.updatedCount", { count: targets.length }) })
    setChecked(new Set())
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const results = await Promise.allSettled(deleteTargets.map((a) => deleteAttribute(a.id)))
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]
    if (failed.length) toast({ variant: "destructive", title: t("catalog:shared.deletedFailed", { deleted: deleteTargets.length - failed.length, failed: failed.length }), description: failed[0].reason?.message })
    else toast({ title: t("common:status.deleted"), description: t("catalog:attributes.toast.removedCount", { count: deleteTargets.length }) })
    if (editing && deleteTargets.some((a) => a.id === editing.id)) resetForm()
    setDeleting(false)
    setDeleteTargets([])
    setChecked(new Set())
  }

  const handleExport = () => {
    const source = selected.length ? selected : filtered
    exportToCSV(
      source.map((a) => ({
        name: a.name, display_name: a.displayName, key: slugify(a.name), option: a.option,
        published: a.published ? "Yes" : "No",
        values: a.values.map((v) => (a.valueColors?.[v] ? `${v} ${a.valueColors[v]}` : v)).join(";"),
        used_in_products: a.usedInProducts,
      })),
      "attributes",
      ["Name", "Display Name", "Key", "Option", "Published", "Values", "Used In Products"],
    )
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const rows = parseCSV(e.target?.result as string).filter((r: any) => r.name)
      const results: PromiseSettledResult<void>[] = []
      const seen = new Set(attributes.map((a) => a.name.trim().toLowerCase()))
      for (const item of rows) {
        const key = String(item.name).trim().toLowerCase()
        if (seen.has(key)) { results.push({ status: "rejected", reason: new Error("duplicate") }); continue }
        const labels: string[] = []
        const colors: Record<string, string> = {}
        for (const raw of String(item.values ?? "").split(";")) {
          const m = raw.trim().match(/^(.*?)\s*(#[0-9a-f]{6})$/i)
          const label = (m ? m[1] : raw).trim()
          if (!label || labels.some((l) => l.toLowerCase() === label.toLowerCase())) continue
          labels.push(label)
          if (m && HEX.test(m[2])) colors[label] = m[2]
        }
        const opt = String(item.option ?? "").trim().toLowerCase()
        const option: Option = opt === "swatch" || opt === "radio" || opt === "button" ? (opt as Option) : Object.keys(colors).length ? "swatch" : "dropdown"
        const pub = String(item.published ?? "").trim().toLowerCase()
        try {
          await addAttribute({
            name: String(item.name).trim(),
            displayName: item.display_name || item.name,
            option,
            published: pub === "" || !["no", "false", "0"].includes(pub),
            values: labels,
            valueColors: Object.keys(colors).length ? colors : undefined,
          })
          seen.add(key)
          results.push({ status: "fulfilled", value: undefined })
        } catch (err) {
          results.push({ status: "rejected", reason: err })
        }
      }
      const ok = results.filter((r) => r.status === "fulfilled").length
      toast({
        variant: ok === rows.length ? undefined : "destructive",
        title: ok === rows.length ? t("catalog:shared.importFinished") : t("catalog:attributes.toast.importPartial"),
        description: t("catalog:attributes.toast.importResult", { ok, total: rows.length }),
      })
      setImportOpen(false)
    }
    reader.readAsText(file)
    event.target.value = ""
  }

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      {/* Header */}
      <PageHeader
        title={t("catalog:attributes.title")}
        description={t("catalog:attributes.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" aria-hidden /> {t("common:actions.import")}
          </Button>
          <Button type="button" variant="outline" onClick={handleExport}>
            <Download className="size-4" aria-hidden /> {t("common:actions.export")}
          </Button>
          <Button type="button" onClick={() => { resetForm(); document.getElementById("attr-name")?.focus() }}>
            <Plus className="size-4" aria-hidden /> {t("catalog:attributes.add")}
          </Button>
        </>}
      />

      <div className="flex flex-wrap items-start gap-4">
        {/* List */}
        <Card className="min-w-0 flex-[999_1_560px] gap-0 py-0">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(v) => { setTab(v); setChecked(new Set()); setCurrentPage(1) }} tabs={[
              { value: "all", label: t("common:status.all"), count: attributes.length },
              { value: "published", label: t("common:status.published"), count: publishedCount },
              { value: "unpublished", label: t("catalog:shared.unpublished"), count: attributes.length - publishedCount },
            ]} />
          </div>
          <Toolbar className="p-4">
            <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label={t("catalog:attributes.selectAll")} />
            <div className="relative min-w-[240px] flex-1">
              <Label htmlFor="attr-search" className="sr-only">{t("catalog:attributes.searchLabel")}</Label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="attr-search" type="search" placeholder={t("catalog:attributes.searchPlaceholder")} value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="pl-9" />
            </div>
            {search && (
              <Button type="button" variant="ghost" onClick={() => setSearch("")}>
                <X className="size-4" aria-hidden /> {t("common:actions.clear")}
              </Button>
            )}
          </Toolbar>

          <BulkBar count={checked.size} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setPublished(selected, true)}>{t("catalog:shared.publish")}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPublished(selected, false)}>{t("catalog:shared.unpublish")}</Button>
            <Button type="button" variant="outline" size="sm" onClick={handleExport}>{t("catalog:shared.exportSelected")}</Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTargets(selected)}>{t("common:actions.delete")}</Button>
          </BulkBar>

          <Separator />
          <div>
            {isLoading ? (
              [1, 2, 3].map((i) => <div key={i} className="p-4"><Skeleton className="h-16" /></div>)
            ) : currentItems.length === 0 ? (
              <EmptyState icon={Layers} title={t("catalog:attributes.emptyTitle")}
                description={search || tab !== "all" ? t("catalog:shared.noMatchHint") : t("catalog:attributes.emptyDesc")} />
            ) : (
              <ItemGroup>
              {currentItems.map((a, idx) => (
                <Fragment key={a.id}>
                {idx > 0 && <ItemSeparator />}
                <Item role="listitem" className={cn("rounded-none", editing?.id === a.id && "bg-muted/50")}>
                  <Checkbox checked={checked.has(a.id)} onCheckedChange={() => toggleOne(a.id)} aria-label={t("common:extra.selectRow", { name: a.name })} />
                  <ItemContent className="min-w-[140px] flex-none">
                    <ItemTitle><Link href={`/dashboard/attributes/${a.id}`} className="hover:underline">{a.displayName || a.name}</Link></ItemTitle>
                    <ItemDescription className="text-xs">
                      {t("catalog:attributes.meta", {
                        key: slugify(a.name),
                        option: t(OPTION_LABEL[a.option] ?? "catalog:attributes.options.dropdown"),
                        values: t("catalog:attributes.valueCount", { count: a.values.length }),
                        products: prod(a.usedInProducts),
                      })}
                    </ItemDescription>
                  </ItemContent>
                  <div className="flex min-w-[160px] flex-1 flex-wrap items-center gap-1.5">
                    {a.values.slice(0, 8).map((v) => (
                      <Badge key={v} variant="secondary">
                        {a.option === "swatch" && <span aria-hidden className="size-3 rounded-full border" style={{ background: a.valueColors?.[v] || "transparent" }} />}
                        {v}
                      </Badge>
                    ))}
                    {a.values.length > 8 && <span className="text-xs text-muted-foreground">{t("catalog:attributes.moreValues", { count: a.values.length - 8 })}</span>}
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(a, true)} className="border-dashed">
                      {t("catalog:attributes.addValueChip")}
                    </Button>
                  </div>
                  <ItemActions className="gap-1.5">
                    <Switch checked={a.published} onCheckedChange={(v) => setPublished([a], v)} aria-label={t("catalog:shared.publishedName", { name: a.name })} />
                    <WithTooltip content={t("catalog:shared.editName", { name: a.name })}><Button type="button" variant="outline" size="icon" onClick={() => startEdit(a)} aria-label={t("catalog:shared.editName", { name: a.name })}><Pencil className="size-4" /></Button></WithTooltip>
                    <WithTooltip content={t("catalog:shared.deleteName", { name: a.name })}><Button type="button" variant="outline" size="icon" onClick={() => setDeleteTargets([a])} aria-label={t("catalog:shared.deleteName", { name: a.name })}><Trash2 className="size-4" /></Button></WithTooltip>
                  </ItemActions>
                </Item>
                </Fragment>
              ))}
              </ItemGroup>
            )}
          </div>

          {!isLoading && filtered.length > 0 && (
            <>
            <Separator />
            <div className="p-4 pt-3">
              <PaginationControl
                currentPage={currentPage}
                totalPages={Math.max(1, totalPages)}
                itemsPerPage={itemsPerPage}
                totalItems={filtered.length}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </div>
            </>
          )}
        </Card>

        {/* Form panel */}
        <aside aria-label={t("catalog:attributes.form.aria")} className="min-w-0 flex-[1_1_320px] lg:sticky lg:top-0 lg:max-w-[400px]">
        <SectionCard title={editing ? t("catalog:shared.editName", { name: editing.name }) : t("catalog:attributes.form.newTitle")} description={t("catalog:attributes.form.desc")}
          contentClassName="flex flex-col gap-4">

          <FormField label={t("common:fields.name")} required htmlFor="attr-name" className="min-w-0">
            <Input id="attr-name" placeholder={t("catalog:attributes.form.namePlaceholder")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label={t("catalog:attributes.form.displayName")} htmlFor="attr-display-name" className="min-w-0">
            <Input id="attr-display-name" placeholder={t("catalog:attributes.form.displayPlaceholder")} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </FormField>

          <FormField label={<span id="attr-option-label">{t("catalog:attributes.form.howPick")}</span>}>
            <ChoiceCardGroup aria-labelledby="attr-option-label" className="grid-cols-3"
              value={form.option === "button" ? "radio" : form.option}
              onValueChange={(v) => setForm({ ...form, option: v as Option })}>
              {OPTIONS.map((o) => (
                <ChoiceCard key={o.value} value={o.value} title={t(o.label)} description={o.sub ? t(o.sub) : o.glyph} className="p-3" />
              ))}
            </ChoiceCardGroup>
          </FormField>

          <FormField label={t("catalog:attributes.form.values")} htmlFor="attr-values" description={t("catalog:attributes.form.valuesHelp")}>
            <InputGroup className="h-auto min-h-9 flex-wrap gap-1.5 p-1.5">
              {form.values.map((v) => (
                <Badge key={v} variant="secondary" className="gap-1 pr-1">
                  {form.option === "swatch" && (
                    <ColorPicker size="sm" aria-label={t("catalog:attributes.form.colourFor", { value: v })} value={form.colors[v] || "#2449E8"}
                      onChange={(hex) => setForm({ ...form, colors: { ...form.colors, [v]: hex } })} />
                  )}
                  {v}
                  <WithTooltip content={t("common:extra.removeName", { name: v })}><Button type="button" variant="ghost" size="icon" aria-label={t("common:extra.removeName", { name: v })} onClick={() => setForm({ ...form, values: form.values.filter((x) => x !== v) })}
                    className="size-4"><X className="size-3" /></Button></WithTooltip>
                </Badge>
              ))}
              <InputGroupInput id="attr-values" ref={chipRef} value={chipDraft} placeholder={t("catalog:attributes.form.typeEnter")}
                onChange={(e) => setChipDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addChip(chipDraft) }
                  else if (e.key === "Backspace" && !chipDraft && form.values.length) setForm({ ...form, values: form.values.slice(0, -1) })
                }}
                className="h-auto min-w-[120px] flex-1" />
            </InputGroup>
          </FormField>

          <Item variant="muted" size="sm">
            <ItemContent>
              <ItemTitle id="attr-pub">{t("common:status.published")}</ItemTitle>
              <ItemDescription>{t("catalog:attributes.form.publishedDesc")}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} aria-labelledby="attr-pub" />
            </ItemActions>
          </Item>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetForm}>{editing ? t("common:actions.cancel") : t("common:actions.clear")}</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? t("common:actions.saving") : editing ? t("common:actions.saveChanges") : t("catalog:attributes.add")}
            </Button>
          </div>
        </SectionCard>
        </aside>
      </div>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-dash-display text-xl font-bold">{t("catalog:attributes.import.title")}</DialogTitle>
            <DialogDescription>{t("catalog:attributes.import.desc")}</DialogDescription>
          </DialogHeader>
          <Input type="file" accept=".csv" onChange={handleImport} aria-label={t("catalog:shared.csvFile")} className="w-full" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>{t("common:actions.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && setDeleteTargets([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:confirm.deleteTitle", { name: deleteTargets.length === 1 ? deleteTargets[0].name : t("catalog:attributes.remove.many", { count: deleteTargets.length }) })}</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const inUse = deleteTargets.filter((a) => a.usedInProducts > 0)
                const total = inUse.reduce((n, a) => n + a.usedInProducts, 0)
                return (
                  <>
                    {inUse.length > 0 && (
                      <span className="mb-1 block font-semibold text-destructive">
                        {inUse.length === 1
                          ? t("catalog:attributes.remove.inUseOne", { name: inUse[0].name, products: prod(total) })
                          : t("catalog:attributes.remove.inUseMany", { count: inUse.length, products: prod(total) })}
                      </span>
                    )}
                    {t("common:confirm.cannotUndo")}
                  </>
                )
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? t("catalog:shared.deleting") : t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
