"use client"

import type React from "react"
import { Fragment, useMemo, useRef, useState } from "react"
import Link from "next/link"
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
const prod = (n: number) => `${n} product${n === 1 ? "" : "s"}`

const emptyForm: FormState = { name: "", displayName: "", option: "dropdown", values: [], colors: {}, published: true }
const OPTION_LABEL: Record<string, string> = { dropdown: "Dropdown", radio: "Buttons", button: "Buttons", swatch: "Colour swatch" }

const OPTIONS: { value: Option; label: string; sub: string }[] = [
  { value: "dropdown", label: "Dropdown", sub: "List menu" },
  { value: "radio", label: "Buttons", sub: "S  M  L" },
  { value: "swatch", label: "Colour swatch", sub: "● ● ●" },
]


export default function AttributesPage() {
  const { attributes, isLoading, addAttribute, updateAttribute, deleteAttribute } = useAttribute()
  const { toast } = useToast()

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
      toast({ variant: "destructive", title: "Value already added", description: v })
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
      toast({ variant: "destructive", title: "Name required", description: "Give the attribute a name, e.g. Material" })
      return
    }
    if (values.length === 0) {
      toast({ variant: "destructive", title: "Add at least one value", description: "Type a value and press Enter, e.g. Small" })
      return
    }
    const nm = form.name.trim().toLowerCase()
    if (attributes.some((a) => a.id !== editing?.id && (a.name.trim().toLowerCase() === nm))) {
      toast({ variant: "destructive", title: "Name already used", description: `An attribute named "${form.name.trim()}" already exists` })
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
        toast({ title: "Attribute updated", description: payload.name })
      } else {
        await addAttribute(payload as any)
        toast({ title: "Attribute added", description: payload.name })
      }
      resetForm()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Could not save", description: error?.message || "Please try again" })
    } finally {
      setSaving(false)
    }
  }

  const setPublished = async (targets: Attribute[], published: boolean) => {
    const results = await Promise.allSettled(targets.map((a) => updateAttribute(a.id, { published })))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: "Some updates failed", description: `${failed} of ${targets.length} could not be changed` })
    else toast({ title: published ? "Published" : "Unpublished", description: `${targets.length} attribute${targets.length === 1 ? "" : "s"} updated` })
    setChecked(new Set())
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const results = await Promise.allSettled(deleteTargets.map((a) => deleteAttribute(a.id)))
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[]
    if (failed.length) toast({ variant: "destructive", title: `${deleteTargets.length - failed.length} deleted, ${failed.length} failed`, description: failed[0].reason?.message })
    else toast({ title: "Deleted", description: `${deleteTargets.length} attribute${deleteTargets.length === 1 ? "" : "s"} removed` })
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
        title: ok === rows.length ? "Import finished" : "Import partially completed",
        description: `${ok} of ${rows.length} attributes added`,
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
        title="Attributes"
        description="Options like colour and size that turn one product into variants."
        actions={<>
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="size-4" aria-hidden /> Import
          </Button>
          <Button type="button" variant="outline" onClick={handleExport}>
            <Download className="size-4" aria-hidden /> Export
          </Button>
          <Button type="button" onClick={() => { resetForm(); document.getElementById("attr-name")?.focus() }}>
            <Plus className="size-4" aria-hidden /> Add attribute
          </Button>
        </>}
      />

      <div className="flex flex-wrap items-start gap-4">
        {/* List */}
        <Card className="min-w-0 flex-[999_1_560px] gap-0 py-0">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(v) => { setTab(v); setChecked(new Set()); setCurrentPage(1) }} tabs={[
              { value: "all", label: "All", count: attributes.length },
              { value: "published", label: "Published", count: publishedCount },
              { value: "unpublished", label: "Unpublished", count: attributes.length - publishedCount },
            ]} />
          </div>
          <Toolbar className="p-4">
            <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all attributes in this list" />
            <div className="relative min-w-[240px] flex-1">
              <Label htmlFor="attr-search" className="sr-only">Search attributes</Label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="attr-search" type="search" placeholder="Search attributes…" value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="pl-9" />
            </div>
            {search && (
              <Button type="button" variant="ghost" onClick={() => setSearch("")}>
                <X className="size-4" aria-hidden /> Clear
              </Button>
            )}
          </Toolbar>

          <BulkBar count={checked.size} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setPublished(selected, true)}>Publish</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPublished(selected, false)}>Unpublish</Button>
            <Button type="button" variant="outline" size="sm" onClick={handleExport}>Export selected</Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTargets(selected)}>Delete</Button>
          </BulkBar>

          <Separator />
          <div>
            {isLoading ? (
              [1, 2, 3].map((i) => <div key={i} className="p-4"><Skeleton className="h-16" /></div>)
            ) : currentItems.length === 0 ? (
              <EmptyState icon={Layers} title="No attributes found"
                description={search || tab !== "all" ? "Try a different search or tab." : "Add your first attribute using the form."} />
            ) : (
              <ItemGroup>
              {currentItems.map((a, idx) => (
                <Fragment key={a.id}>
                {idx > 0 && <ItemSeparator />}
                <Item role="listitem" className={cn("rounded-none", editing?.id === a.id && "bg-muted/50")}>
                  <Checkbox checked={checked.has(a.id)} onCheckedChange={() => toggleOne(a.id)} aria-label={`Select ${a.name}`} />
                  <ItemContent className="min-w-[140px] flex-none">
                    <ItemTitle><Link href={`/dashboard/attributes/${a.id}`} className="hover:underline">{a.displayName || a.name}</Link></ItemTitle>
                    <ItemDescription className="text-xs">
                      Key: {slugify(a.name)} · {OPTION_LABEL[a.option] ?? "Dropdown"} · {a.values.length} value{a.values.length === 1 ? "" : "s"} · used in {prod(a.usedInProducts)}
                    </ItemDescription>
                  </ItemContent>
                  <div className="flex min-w-[160px] flex-1 flex-wrap items-center gap-1.5">
                    {a.values.slice(0, 8).map((v) => (
                      <Badge key={v} variant="secondary">
                        {a.option === "swatch" && <span aria-hidden className="size-3 rounded-full border" style={{ background: a.valueColors?.[v] || "transparent" }} />}
                        {v}
                      </Badge>
                    ))}
                    {a.values.length > 8 && <span className="text-xs text-muted-foreground">+{a.values.length - 8} more</span>}
                    <Button type="button" variant="outline" size="sm" onClick={() => startEdit(a, true)} className="border-dashed">
                      + Value
                    </Button>
                  </div>
                  <ItemActions className="gap-1.5">
                    <Switch checked={a.published} onCheckedChange={(v) => setPublished([a], v)} aria-label={`Published: ${a.name}`} />
                    <WithTooltip content={`Edit ${a.name}`}><Button type="button" variant="outline" size="icon" onClick={() => startEdit(a)} aria-label={`Edit ${a.name}`}><Pencil className="size-4" /></Button></WithTooltip>
                    <WithTooltip content={`Delete ${a.name}`}><Button type="button" variant="outline" size="icon" onClick={() => setDeleteTargets([a])} aria-label={`Delete ${a.name}`}><Trash2 className="size-4" /></Button></WithTooltip>
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
        <aside aria-label="Attribute form" className="min-w-0 flex-[1_1_320px] lg:sticky lg:top-0 lg:max-w-[400px]">
        <SectionCard title={editing ? `Edit ${editing.name}` : "New attribute"} description="Options like colour or size that create product variants."
          contentClassName="flex flex-col gap-4">

          <FormField label="Name" required htmlFor="attr-name" className="min-w-0">
            <Input id="attr-name" placeholder="e.g. Material" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormField label="Shown to customers as" htmlFor="attr-display-name" className="min-w-0">
            <Input id="attr-display-name" placeholder="e.g. Fabric" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </FormField>

          <FormField label={<span id="attr-option-label">How customers pick</span>}>
            <ChoiceCardGroup aria-labelledby="attr-option-label" className="grid-cols-3"
              value={form.option === "button" ? "radio" : form.option}
              onValueChange={(v) => setForm({ ...form, option: v as Option })}>
              {OPTIONS.map((o) => (
                <ChoiceCard key={o.value} value={o.value} title={o.label} description={o.sub} className="p-3" />
              ))}
            </ChoiceCardGroup>
          </FormField>

          <FormField label="Values" htmlFor="attr-values" description="Press Enter after each value. Order here is the order customers see.">
            <InputGroup className="h-auto min-h-9 flex-wrap gap-1.5 p-1.5">
              {form.values.map((v) => (
                <Badge key={v} variant="secondary" className="gap-1 pr-1">
                  {form.option === "swatch" && (
                    <ColorPicker size="sm" aria-label={`Colour for ${v}`} value={form.colors[v] || "#2449E8"}
                      onChange={(hex) => setForm({ ...form, colors: { ...form.colors, [v]: hex } })} />
                  )}
                  {v}
                  <WithTooltip content={`Remove ${v}`}><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${v}`} onClick={() => setForm({ ...form, values: form.values.filter((x) => x !== v) })}
                    className="size-4"><X className="size-3" /></Button></WithTooltip>
                </Badge>
              ))}
              <InputGroupInput id="attr-values" ref={chipRef} value={chipDraft} placeholder="Type and press Enter"
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
              <ItemTitle id="attr-pub">Published</ItemTitle>
              <ItemDescription>Use this attribute on products</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} aria-labelledby="attr-pub" />
            </ItemActions>
          </Item>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={resetForm}>{editing ? "Cancel" : "Clear"}</Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add attribute"}
            </Button>
          </div>
        </SectionCard>
        </aside>
      </div>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-dash-display text-xl font-bold">Import attributes</DialogTitle>
            <DialogDescription>Upload a CSV with columns: name (required), display_name, option (dropdown, radio, button or swatch), published (Yes/No; blank means published), values (separated by ;, add a colour like "Red #DC2626" for swatches).</DialogDescription>
          </DialogHeader>
          <Input type="file" accept=".csv" onChange={handleImport} aria-label="CSV file" className="w-full" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && setDeleteTargets([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTargets.length === 1 ? deleteTargets[0].name : `${deleteTargets.length} attributes`}?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const inUse = deleteTargets.filter((a) => a.usedInProducts > 0)
                const total = inUse.reduce((n, a) => n + a.usedInProducts, 0)
                return (
                  <>
                    {inUse.length > 0 && (
                      <span className="mb-1 block font-semibold text-destructive">
                        {inUse.length === 1 ? `"${inUse[0].name}" is` : `${inUse.length} of these attributes are`} used in {prod(total)}. Those products will lose {inUse.length === 1 ? "it" : "them"}.
                      </span>
                    )}
                    This can’t be undone.
                  </>
                )
              })()}
            </AlertDialogDescription>
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
