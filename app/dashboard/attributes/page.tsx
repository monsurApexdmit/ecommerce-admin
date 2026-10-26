"use client"

import type React from "react"
import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Download, Layers, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
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

const iconBtn =
  "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const fieldLabel = "flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold"
const fieldInput =
  "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal text-dash-ink outline-none placeholder:text-dash-muted focus-visible:border-dash-accent"
const switchCls = "h-6 w-11 data-[state=checked]:bg-dash-accent data-[state=unchecked]:bg-dash-border"

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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Attributes</h1>
          <p className="mt-1 text-sm text-dash-muted">Options like colour and size that turn one product into variants.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setImportOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
            <Upload className="size-4" aria-hidden /> Import
          </button>
          <button type="button" onClick={handleExport}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
            <Download className="size-4" aria-hidden /> Export
          </button>
          <button type="button" onClick={() => { resetForm(); document.getElementById("attr-name")?.focus() }}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">
            <Plus className="size-4" aria-hidden /> Add attribute
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {/* List */}
        <section className="min-w-0 flex-[999_1_560px] rounded-[14px] border border-dash-border bg-dash-card">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(v) => { setTab(v); setChecked(new Set()); setCurrentPage(1) }} tabs={[
              { value: "all", label: "All", count: attributes.length },
              { value: "published", label: "Published", count: publishedCount },
              { value: "unpublished", label: "Unpublished", count: attributes.length - publishedCount },
            ]} />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all attributes in this list" />
            <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
              <Search className="size-[18px]" aria-hidden />
              <span className="sr-only">Search attributes</span>
              <input type="search" placeholder="Search attributes…" value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
            </label>
            {search && (
              <button type="button" onClick={() => setSearch("")} className="inline-flex h-11 items-center gap-1 px-2 text-[13px] font-semibold text-dash-muted hover:text-dash-ink">
                <X className="size-4" aria-hidden /> Clear
              </button>
            )}
          </div>

          {checked.size > 0 && (
            <div className="mx-4 mb-3 flex flex-wrap items-center gap-2.5 rounded-[10px] bg-dash-ink px-3.5 py-2.5 text-dash-bg">
              <span className="text-sm font-semibold">{checked.size} selected</span>
              <button type="button" onClick={() => setPublished(selected, true)} className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Publish</button>
              <button type="button" onClick={() => setPublished(selected, false)} className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Unpublish</button>
              <button type="button" onClick={handleExport} className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Export selected</button>
              <button type="button" onClick={() => setDeleteTargets(selected)} className="h-9 rounded-lg border border-red-400/50 px-3 text-[13px] font-semibold text-red-300 hover:bg-white/10">Delete</button>
              <button type="button" onClick={() => setChecked(new Set())} className="ml-auto h-9 px-3 text-[13px] font-semibold opacity-80 hover:opacity-100">Clear</button>
            </div>
          )}

          <div className="flex flex-col border-t border-dash-border-soft">
            {isLoading ? (
              [1, 2, 3].map((i) => <div key={i} className="border-b border-dash-border-soft p-4"><Skeleton className="h-16 rounded-lg" /></div>)
            ) : currentItems.length === 0 ? (
              <div className="py-14 text-center">
                <Layers className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                <p className="font-semibold">No attributes found</p>
                <p className="text-sm text-dash-muted">{search || tab !== "all" ? "Try a different search or tab." : "Add your first attribute using the form."}</p>
              </div>
            ) : (
              currentItems.map((a) => (
                <article key={a.id} className={cn("flex flex-wrap items-center gap-3.5 border-b border-dash-border-soft p-4 last:border-b-0", editing?.id === a.id && "bg-dash-accent-soft/40")}>
                  <Checkbox checked={checked.has(a.id)} onCheckedChange={() => toggleOne(a.id)} aria-label={`Select ${a.name}`} />
                  <div className="flex min-w-[140px] flex-col">
                    <Link href={`/dashboard/attributes/${a.id}`} className="font-dash-display text-base font-bold hover:underline">{a.displayName || a.name}</Link>
                    <span className="text-xs text-dash-muted">
                      Key: {slugify(a.name)} · {OPTION_LABEL[a.option] ?? "Dropdown"} · {a.values.length} value{a.values.length === 1 ? "" : "s"} · used in {prod(a.usedInProducts)}
                    </span>
                  </div>
                  <div className="flex min-w-[160px] flex-1 flex-wrap items-center gap-1.5">
                    {a.values.slice(0, 8).map((v) => (
                      <span key={v} className="inline-flex items-center gap-1.5 rounded-md bg-dash-neutral-soft px-2 py-[3px] text-xs font-semibold text-dash-neutral-fg">
                        {a.option === "swatch" && <span className="size-3 rounded-full border border-dash-border" style={{ background: a.valueColors?.[v] || "transparent" }} />}
                        {v}
                      </span>
                    ))}
                    {a.values.length > 8 && <span className="text-xs text-dash-muted">+{a.values.length - 8} more</span>}
                    <button type="button" onClick={() => startEdit(a, true)} className="rounded-md border border-dashed border-dash-border px-2 py-[3px] text-xs font-semibold text-dash-muted hover:text-dash-ink">
                      + Value
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch checked={a.published} onCheckedChange={(v) => setPublished([a], v)} aria-label={`Published: ${a.name}`} className={switchCls} />
                    <button type="button" onClick={() => startEdit(a)} aria-label={`Edit ${a.name}`} className={iconBtn}><Pencil className="size-4" /></button>
                    <button type="button" onClick={() => setDeleteTargets([a])} aria-label={`Delete ${a.name}`} className={iconBtn}><Trash2 className="size-4" /></button>
                  </div>
                </article>
              ))
            )}
          </div>

          {!isLoading && filtered.length > 0 && (
            <div className="border-t border-dash-border-soft p-4 pt-3">
              <PaginationControl
                currentPage={currentPage}
                totalPages={Math.max(1, totalPages)}
                itemsPerPage={itemsPerPage}
                totalItems={filtered.length}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </div>
          )}
        </section>

        {/* Form panel */}
        <aside aria-label="Attribute form" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-[14px] border border-dash-border bg-dash-card p-[18px] lg:sticky lg:top-0 lg:max-w-[400px]">
          <div>
            <h2 className="font-dash-display text-lg font-bold">{editing ? `Edit ${editing.name}` : "New attribute"}</h2>
            <p className="text-[13px] text-dash-muted">Options like colour or size that create product variants.</p>
          </div>

          <label className={fieldLabel}>Name *
            <input id="attr-name" className={fieldInput} placeholder="e.g. Material" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className={fieldLabel}>Shown to customers as
            <input className={fieldInput} placeholder="e.g. Fabric" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </label>

          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
            How customers pick
            <div role="radiogroup" aria-label="Display type" className="grid grid-cols-3 gap-2">
              {OPTIONS.map((o) => {
                const on = form.option === o.value || (o.value === "radio" && form.option === "button")
                return (
                  <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => setForm({ ...form, option: o.value })}
                    className={cn("flex flex-col items-start rounded-xl border-2 px-3 py-2.5 text-left",
                      on ? "border-dash-accent bg-dash-accent-soft/50" : "border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>
                    <span className="text-sm font-semibold">{o.label}</span>
                    <span className="text-xs font-normal text-dash-muted">{o.sub}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
            <label htmlFor="attr-values">Values</label>
            <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-[10px] border border-dash-border bg-dash-card p-1.5 focus-within:border-dash-accent">
              {form.values.map((v) => (
                <span key={v} className="inline-flex items-center gap-1 rounded-md bg-dash-neutral-soft py-[3px] pl-2 pr-1 text-xs font-semibold text-dash-neutral-fg">
                  {form.option === "swatch" && (
                    <input type="color" aria-label={`Colour for ${v}`} value={form.colors[v] || "#2449E8"}
                      onChange={(e) => setForm({ ...form, colors: { ...form.colors, [v]: e.target.value } })}
                      className="size-4 cursor-pointer rounded border-0 bg-transparent p-0" />
                  )}
                  {v}
                  <button type="button" aria-label={`Remove ${v}`} onClick={() => setForm({ ...form, values: form.values.filter((x) => x !== v) })}
                    className="flex size-4 items-center justify-center rounded hover:bg-dash-border"><X className="size-3" /></button>
                </span>
              ))}
              <input id="attr-values" ref={chipRef} value={chipDraft} placeholder="Type and press Enter"
                onChange={(e) => setChipDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addChip(chipDraft) }
                  else if (e.key === "Backspace" && !chipDraft && form.values.length) setForm({ ...form, values: form.values.slice(0, -1) })
                }}
                className="min-w-[120px] flex-1 border-0 bg-transparent px-1.5 text-sm font-normal outline-none placeholder:text-dash-muted" />
            </div>
            <span className="text-xs font-normal text-dash-muted">Press Enter after each value. Order here is the order customers see.</span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[10px] bg-dash-bg px-3.5 py-3">
            <span className="flex flex-col text-[13px] font-semibold">
              <span id="attr-pub">Published</span>
              <span className="text-xs font-normal text-dash-muted">Use this attribute on products</span>
            </span>
            <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} aria-labelledby="attr-pub" className={switchCls} />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm}
              className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft">{editing ? "Cancel" : "Clear"}</button>
            <button type="button" onClick={handleSave} disabled={saving}
              className="h-11 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-40">
              {saving ? "Saving…" : editing ? "Save changes" : "Add attribute"}
            </button>
          </div>
        </aside>
      </div>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-dash-display text-xl font-bold">Import attributes</DialogTitle>
            <DialogDescription>Upload a CSV with columns: name (required), display_name, option (dropdown, radio, button or swatch), published (Yes/No; blank means published), values (separated by ;, add a colour like "Red #DC2626" for swatches).</DialogDescription>
          </DialogHeader>
          <input type="file" accept=".csv" onChange={handleImport}
            className="block w-full rounded-[10px] border border-dashed border-dash-border bg-dash-bg p-4 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-dash-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
          <DialogFooter>
            <button type="button" onClick={() => setImportOpen(false)}
              className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft">Close</button>
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
                      <span className="mb-1 block font-semibold text-dash-danger">
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
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
