"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Download, FolderTree, MoreHorizontal, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { Toolbar } from "@/components/common/Toolbar"
import { BulkBar } from "@/components/common/BulkBar"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { SwatchPicker } from "@/components/common/SwatchPicker"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusTabs } from "@/components/ui/status-tabs"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { exportToCSV } from "@/lib/export-import-utils"
import { parseCsvRows } from "@/lib/csv-rows"
import { categoryApi } from "@/lib/categoryApi"
import { usePagination } from "@/hooks/use-pagination"
import { useCategory, type Category } from "@/contexts/category-context"
import { useToast } from "@/hooks/use-toast"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { WithTooltip } from "@/components/common/WithTooltip"

interface Row { cat: Category; depth: number; hasChildren: boolean }

const SWATCHES = [
  { name: "Blue", value: "#2449E8" },
  { name: "Purple", value: "#6D28D9" },
  { name: "Amber", value: "#D97706" },
  { name: "Red", value: "#DC2626" },
  { name: "Teal", value: "#0F766E" },
]

const byOrder = (a: Category, b: Category) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.category_name.localeCompare(b.category_name)

const emptyForm = { name: "", parent_id: "none", published: true, description: "", color: SWATCHES[0].value as string, image: "" as string, imageFile: null as File | null }

export default function CategoriesPage() {
  const { categories, isLoading, getAllCategoriesFlat, addCategory, updateCategory, deleteCategory, bulkDeleteCategories, reorderCategories, refreshCategories } = useCategory()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("all")
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTargets, setDeleteTargets] = useState<Category[]>([])
  const [deleting, setDeleting] = useState(false)

  // Flat, de-duplicated list of every category
  const flat = useMemo(() => {
    const seen = new Map<string, Category>()
    getAllCategoriesFlat().forEach((c) => { if (!seen.has(c.id)) seen.set(c.id, c) })
    return Array.from(seen.values())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

  const byId = useMemo(() => new Map(flat.map((c) => [c.id, c])), [flat])
  const childrenOf = useMemo(() => {
    const m = new Map<string, Category[]>()
    flat.forEach((c) => {
      if (c.parent_id && byId.has(c.parent_id)) {
        const list = m.get(c.parent_id) ?? []
        list.push(c)
        m.set(c.parent_id, list)
      }
    })
    m.forEach((list) => list.sort(byOrder))
    return m
  }, [flat, byId])

  const roots = useMemo(
    () => flat.filter((c) => !c.parent_id || !byId.has(c.parent_id)).sort(byOrder),
    [flat, byId],
  )

  const term = search.trim().toLowerCase()

  // Whole tree in display order (ignores collapsing) with depth
  const treeOrder = useMemo(() => {
    const out: { cat: Category; depth: number }[] = []
    const walk = (c: Category, depth: number) => { out.push({ cat: c, depth }); (childrenOf.get(c.id) ?? []).forEach((k) => walk(k, depth + 1)) }
    roots.forEach((r) => walk(r, 0))
    return out
  }, [roots, childrenOf])

  const publishedCount = flat.filter((c) => c.status).length
  const flatMode = !!term || tab !== "all"
  // Rows matching the active tab + search (name or description), in tree order
  const filteredList = useMemo(
    () => treeOrder.map((t) => t.cat).filter((c) =>
      (tab === "all" || (tab === "published" ? c.status : !c.status)) &&
      (!term || c.category_name.toLowerCase().includes(term) || (c.description ?? "").toLowerCase().includes(term))),
    [treeOrder, tab, term],
  )

  // Each unit is one root with its visible descendants (or a single match while searching)
  const units = useMemo<Row[][]>(() => {
    if (flatMode) {
      return filteredList.map((c) => [{ cat: c, depth: 0, hasChildren: false }])
    }
    const walk = (c: Category, depth: number, out: Row[]) => {
      const kids = childrenOf.get(c.id) ?? []
      out.push({ cat: c, depth, hasChildren: kids.length > 0 })
      if (!collapsed.has(c.id)) kids.forEach((k) => walk(k, depth + 1, out))
    }
    return roots.map((r) => { const out: Row[] = []; walk(r, 0, out); return out })
  }, [flatMode, filteredList, roots, childrenOf, collapsed])

  const { currentItems, currentPage, totalPages, itemsPerPage, setCurrentPage, handleItemsPerPageChange } = usePagination(units, 10)

  const blocked = useModuleGuard("Categories")
  if (blocked) return blocked

  const rows = currentItems.flat()
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.cat.id))
  const selected = flat.filter((c) => checked.has(c.id))
  const parentName = (c: Category) => (c.parent_id ? byId.get(c.parent_id)?.category_name : undefined)

  const toggleOne = (id: string) =>
    setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () =>
    setChecked((prev) => { const n = new Set(prev); allChecked ? rows.forEach((r) => n.delete(r.cat.id)) : rows.forEach((r) => n.add(r.cat.id)); return n })

  const parentsWithKids = roots.filter((r) => (childrenOf.get(r.id) ?? []).length > 0).map((r) => r.id)
  const anyCollapsed = collapsed.size > 0
  const toggleExpandAll = () => setCollapsed(anyCollapsed ? new Set() : new Set(flat.filter((c) => childrenOf.has(c.id)).map((c) => c.id)))
  const toggleBranch = (id: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  // Descendants of the category being edited can't become its parent
  const blockedParents = (() => {
    const set = new Set<string>()
    if (!editing) return set
    const walk = (id: string) => { set.add(id); (childrenOf.get(id) ?? []).forEach((k) => walk(k.id)) }
    walk(editing.id)
    return set
  })()

  const openForm = (c?: Category | null) => {
    setEditing(c ?? null)
    setForm(c ? { name: c.category_name, parent_id: c.parent_id || "none", published: c.status, description: c.description ?? "", color: c.color || SWATCHES[0].value, image: c.image ?? "", imageFile: null } : emptyForm)
    setFormOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Name required", description: "Give the category a name" })
      return
    }
    const wanted = form.name.trim().toLowerCase()
    if (flat.some((c) => c.id !== editing?.id && c.category_name.trim().toLowerCase() === wanted)) {
      toast({ variant: "destructive", title: "Name already used", description: "A category with this name already exists." })
      return
    }
    setSaving(true)
    try {
      const payload = {
        category_name: form.name.trim().replace(/\b\w/g, (ch) => ch.toUpperCase()),
        color: form.color,
        status: form.published,
        parent_id: form.parent_id === "none" ? null : form.parent_id,
        description: form.description.trim(),
        imageFile: form.imageFile,
      }
      if (editing) {
        await updateCategory(editing.id, payload)
        toast({ title: "Category updated", description: payload.category_name })
      } else {
        await addCategory(payload)
        toast({ title: "Category added", description: payload.category_name })
      }
      setFormOpen(false)
    } catch (error: any) {
      toast({ variant: "destructive", title: "Could not save", description: error.message || "Please try again" })
    } finally {
      setSaving(false)
    }
  }

  const setPublished = async (list: Category[], status: boolean) => {
    const res = await Promise.allSettled(list.filter((c) => c.status !== status).map((c) => updateCategory(c.id, { status })))
    const failed = res.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: "Some updates failed", description: `${failed} categories could not be updated` })
    else toast({ title: status ? "Published" : "Unpublished", description: `${list.length} categor${list.length === 1 ? "y" : "ies"} updated` })
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      if (deleteTargets.length === 1) {
        await deleteCategory(deleteTargets[0].id)
        toast({ title: "Deleted", description: deleteTargets[0].category_name })
      } else {
        const r = await bulkDeleteCategories(deleteTargets.map((c) => c.id))
        toast({
          variant: r.kept && !r.deleted ? "destructive" : undefined,
          title: `${r.deleted} deleted, ${r.kept} kept`,
          description: r.kept ? `Kept because they have products or sub-categories: ${r.keptNames.join(", ")}` : undefined,
        })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not delete", description: e.message })
    } finally {
      setDeleting(false)
      setDeleteTargets([])
      setChecked(new Set())
    }
  }

  // Swap a category with its previous/next sibling and save the order
  const move = async (c: Category, dir: -1 | 1) => {
    const siblings = c.parent_id && byId.has(c.parent_id) ? (childrenOf.get(c.parent_id) ?? []) : roots
    const i = siblings.findIndex((s) => s.id === c.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= siblings.length) return
    const ids = siblings.map((s) => s.id)
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    try { await reorderCategories(ids) } catch (e: any) { toast({ variant: "destructive", title: "Could not reorder", description: e.message }) }
  }

  const handleExport = () => {
    const list = selected.length ? selected : filteredList
    exportToCSV(
      list.map((c) => ({
        name: c.category_name,
        parent: parentName(c) ?? "",
        description: c.description ?? "",
        products: String(c.products_count ?? 0),
        published: c.status ? "Yes" : "No",
      })),
      "categories",
      ["Name", "Parent", "Description", "Products", "Published"],
    )
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const items = parseCsvRows(ev.target?.result as string).filter((i) => i.name)
      const ids = new Map(flat.map((c) => [c.category_name.trim().toLowerCase(), Number(c.id)]))
      let pending = items
      let ok = 0, dup = 0
      // Parents first: keep passing over rows whose parent now exists
      for (let pass = 0; pass < 10 && pending.length; pass++) {
        const next: typeof items = []
        for (const item of pending) {
          const key = item.name.toLowerCase()
          if (ids.has(key)) { dup++; continue }
          const parentKey = (item.parent ?? item.parent_name ?? "").toLowerCase()
          if (parentKey && parentKey !== "none" && !ids.has(parentKey)) { next.push(item); continue }
          try {
            const r = await categoryApi.create({
              category_name: item.name,
              status: !["no", "false", "0"].includes((item.published ?? "").toLowerCase()),
              parent_id: parentKey && parentKey !== "none" ? ids.get(parentKey)! : null,
              description: item.description || null,
            })
            ids.set(key, r.data.id)
            ok++
          } catch { dup++ }
        }
        if (next.length === pending.length) break
        pending = next
      }
      await refreshCategories()
      toast({
        title: "Import finished",
        description: `${ok} added${dup ? `, ${dup} skipped (duplicate or invalid)` : ""}${pending.length ? `, ${pending.length} skipped (parent not found)` : ""}`,
      })
      setImportOpen(false)
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const total = flat.length

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      {/* Header */}
      <PageHeader
        title="Categories"
        description="Organise products into groups and sub-groups."
        actions={<>
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-4" aria-hidden /> Import</Button>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export</Button>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="size-4" aria-hidden /> Add category
          </Button>
        </>}
      />

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(v) => { setTab(v); setCurrentPage(1) }} tabs={[
            { value: "all", label: "All", count: flat.length },
            { value: "published", label: "Published", count: publishedCount },
            { value: "unpublished", label: "Unpublished", count: flat.length - publishedCount },
          ]} />
        </div>
        <Toolbar className="p-4">
          <div className="relative min-w-[240px] flex-1">
            <Label htmlFor="cat-search" className="sr-only">Search categories</Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="cat-search" type="search" placeholder="Search name or description…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9" />
          </div>
          {search && (
            <Button type="button" variant="ghost" onClick={() => setSearch("")}>
              <X className="size-4" aria-hidden /> Clear
            </Button>
          )}
          {!flatMode && parentsWithKids.length > 0 && (
            <Button type="button" variant="outline" onClick={toggleExpandAll}>{anyCollapsed ? "Expand all" : "Collapse all"}</Button>
          )}
        </Toolbar>

        <BulkBar count={checked.size} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setPublished(selected, true)}>Publish</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPublished(selected, false)}>Unpublish</Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>Export selected</Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTargets(selected)}>Delete</Button>
        </BulkBar>

        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-5 pl-4"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all categories on this page" /></TableHead>
              <TableHead scope="col">Category</TableHead>
              <TableHead scope="col" className="text-right">Products</TableHead>
              <TableHead scope="col">Published</TableHead>
              <TableHead scope="col" className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={5} className="px-4"><Skeleton className="h-10 rounded" /></TableCell></TableRow>)
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState icon={FolderTree} className="p-4 md:p-6"
                    title={flatMode ? "No categories found" : "No categories yet"}
                    description={flatMode ? "Try a different search or tab." : "Add your first category to group products."} />
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ cat: c, depth, hasChildren }) => {
                const kids = childrenOf.get(c.id)?.length ?? 0
                const parent = parentName(c)
                const sub = flatMode && parent ? `Sub-category of ${parent}` : depth > 0 ? `Sub-category of ${parent ?? "—"}` : kids > 0 ? `${kids} sub-categor${kids === 1 ? "y" : "ies"}` : "Top-level category"
                const ck = checked.has(c.id)
                return (
                  <TableRow key={c.id} data-state={ck ? "selected" : undefined}>
                    <TableCell className="pl-4">
                      <Checkbox checked={ck} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.category_name}`} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5" style={{ paddingLeft: depth * 28 }}>
                        {hasChildren && !flatMode ? (
                          <WithTooltip content={`${collapsed.has(c.id) ? "Expand" : "Collapse"} ${c.category_name}`}><Button type="button" variant="ghost" size="icon-sm" onClick={() => toggleBranch(c.id)} aria-expanded={!collapsed.has(c.id)}
                            aria-label={`${collapsed.has(c.id) ? "Expand" : "Collapse"} ${c.category_name}`}
                            className="shrink-0">
                            {collapsed.has(c.id) ? <ChevronRight className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
                          </Button></WithTooltip>
                        ) : (
                          <span aria-hidden className="w-8 shrink-0 text-center text-muted-foreground">{depth > 0 ? "└" : ""}</span>
                        )}
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", !c.color && "bg-muted text-muted-foreground")}
                          style={c.color ? { backgroundColor: `${c.color}1F`, color: c.color } : undefined}>
                          <FolderTree className="size-[18px]" aria-hidden />
                        </span>
                        <Button type="button" variant="ghost" onClick={() => openForm(c)} className="h-auto flex-col items-start gap-0 p-0 text-left whitespace-normal hover:bg-transparent">
                          <span className="font-semibold">{c.category_name}</span>
                          {c.description && <span className="line-clamp-1 max-w-[420px] text-xs font-normal text-foreground/80">{c.description}</span>}
                          <span className="text-xs font-normal text-muted-foreground">{sub}</span>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.products_count == null ? "—" : `${c.products_count} product${c.products_count === 1 ? "" : "s"}`}
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.status} aria-label={`Published: ${c.category_name}`}
                        onCheckedChange={(v) => setPublished([c], v)} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1">
                        {!flatMode && (() => {
                          const sibs = c.parent_id && byId.has(c.parent_id) ? (childrenOf.get(c.parent_id) ?? []) : roots
                          const idx = sibs.findIndex((s) => s.id === c.id)
                          return (
                            <>
                              <WithTooltip content={`Move ${c.category_name} up`}><Button type="button" variant="outline" size="icon" aria-label={`Move ${c.category_name} up`} disabled={idx <= 0} onClick={() => move(c, -1)}><ArrowUp className="size-4" /></Button></WithTooltip>
                              <WithTooltip content={`Move ${c.category_name} down`}><Button type="button" variant="outline" size="icon" aria-label={`Move ${c.category_name} down`} disabled={idx < 0 || idx >= sibs.length - 1} onClick={() => move(c, 1)}><ArrowDown className="size-4" /></Button></WithTooltip>
                            </>
                          )
                        })()}
                        <WithTooltip content={`Edit ${c.category_name}`}><Button type="button" variant="outline" size="icon" aria-label={`Edit ${c.category_name}`} onClick={() => openForm(c)}><Pencil className="size-4" /></Button></WithTooltip>
                        <DropdownMenu>
                          <WithTooltip content={`More actions for ${c.category_name}`}><DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" aria-label={`More actions for ${c.category_name}`}><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger></WithTooltip>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openForm(c)}>Edit category</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setPublished([c], !c.status)}>{c.status ? "Unpublish" : "Publish"}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargets([c])}>
                              <Trash2 className="size-4" aria-hidden /> Delete category
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        <Separator />
        <div className="px-4 py-3 text-xs text-muted-foreground">
          {flatMode ? `${filteredList.length} of ${total}` : total} categor{total === 1 ? "y" : "ies"} · {roots.length} top-level
        </div>
        <div className="px-4 pb-4">
          <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage} onItemsPerPageChange={handleItemsPerPageChange} totalItems={units.length} />
        </div>
      </Card>

      {/* Add / edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[480px] flex-col gap-0 overflow-hidden rounded-[18px] border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[480px]">
          <DialogHeader className="border-b border-dash-border px-6 py-[18px] text-left">
            <DialogTitle className="font-dash-display text-[22px] font-bold">{editing ? `Edit ${editing.category_name}` : "New category"}</DialogTitle>
            <DialogDescription className="text-[13px] text-dash-muted">Group products so they are easy to find in POS.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <FormField label="Name" required htmlFor="cat-name" className="min-w-0">
              <Input id="cat-name" placeholder="e.g. Panjabi" value={form.name} autoFocus
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") save() }} />
            </FormField>
            <FormField label={<span id="cat-parent-label">Parent category</span>} htmlFor="cat-parent" className="min-w-0">
              <Select value={form.parent_id} onValueChange={(v) => setForm({ ...form, parent_id: v })}>
                <SelectTrigger id="cat-parent" aria-labelledby="cat-parent-label" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top level)</SelectItem>
                  {treeOrder.filter(({ cat }) => !blockedParents.has(cat.id)).map(({ cat, depth }) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span style={{ paddingLeft: depth * 14 }}>{depth > 0 ? "└ " : ""}{cat.category_name}{cat.status ? "" : " (unpublished)"}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Description" htmlFor="cat-description" className="min-w-0">
              <Textarea id="cat-description" rows={2} placeholder="Shown on the storefront category page" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
            <FormField label={<span id="cat-color-label">Icon colour</span>} className="min-w-0">
              <SwatchPicker size="sm" aria-label="Icon colour"
                options={SWATCHES.map((sw) => ({ value: sw.value, label: sw.name, color: sw.value }))}
                value={form.color} onValueChange={(v) => setForm({ ...form, color: v })} />
            </FormField>
            <FormField label="Image (optional)" htmlFor="cat-image" className="min-w-0">
              <Button asChild variant="outline" className="h-20 w-full cursor-pointer gap-3 border-dashed">
                <Label htmlFor="cat-image">
                  {form.imageFile || form.image ? (
                    <>
                      <UserAvatar shape="square" src={form.imageFile ? URL.createObjectURL(form.imageFile) : form.image} alt="" name={form.name} className="size-14" />
                      <span className="truncate">{form.imageFile?.name ?? "Current image — click to replace"}</span>
                    </>
                  ) : "Drop an image or click to upload"}
                </Label>
              </Button>
              <Input id="cat-image" type="file" accept="image/*" className="sr-only" onChange={(e) => setForm({ ...form, imageFile: e.target.files?.[0] ?? null })} />
            </FormField>
            <Item variant="outline" size="sm">
              <ItemContent>
                <ItemTitle id="cat-pub-label">Published</ItemTitle>
                <ItemDescription>Show this category in POS and online</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} aria-labelledby="cat-pub-label" />
              </ItemActions>
            </Item>
          </div>
          <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 border-t border-dash-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md rounded-[18px] border-dash-border bg-dash-card font-dash-body text-dash-ink">
          <DialogHeader className="text-left">
            <DialogTitle className="font-dash-display text-[22px] font-bold">Import categories</DialogTitle>
            <DialogDescription className="text-[13px] text-dash-muted">Upload a CSV with the columns Name, Parent (parent category name), Description and Published (Yes/No). Products is ignored. Existing names are skipped.</DialogDescription>
          </DialogHeader>
          <FormField label="CSV file" htmlFor="cat-import-file" className="min-w-0">
            <Input id="cat-import-file" type="file" accept=".csv" onChange={handleImport} />
          </FormField>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && setDeleteTargets([])}>
        <AlertDialogContent className="font-dash-body text-dash-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTargets.length === 1 ? deleteTargets[0].category_name : `${deleteTargets.length} categories`}?</AlertDialogTitle>
            <AlertDialogDescription>Categories that have products or sub-categories are kept; the rest are deleted. This can’t be undone.</AlertDialogDescription>
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
