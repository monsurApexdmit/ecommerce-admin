"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Download, MoreHorizontal, Pencil, Plus, Search, Tag, Upload, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusTabs } from "@/components/ui/status-tabs"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { brandApi, type BrandResponse } from "@/lib/brandApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { parseCsvRows } from "@/lib/csv-rows"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { usePagination } from "@/hooks/use-pagination"
import { useToast } from "@/hooks/use-toast"
import { useModuleGuard } from "@/hooks/use-module-guard"

const TINTS = [
  "bg-dash-accent-soft text-dash-accent-fg",
  "bg-dash-warn-soft text-dash-warn-fg",
  "bg-dash-success-soft text-dash-success-fg",
  "bg-dash-danger-soft text-dash-danger-fg",
  "bg-dash-neutral-soft text-dash-neutral-fg",
]
const iconBtn =
  "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const fieldLabel = "flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold"
const fieldInput =
  "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal text-dash-ink outline-none placeholder:text-dash-muted focus-visible:border-dash-accent"
const emptyForm = { brandName: "", logo: "", website: "", description: "", status: true }

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "—"

export default function BrandsPage() {
  const { toast } = useToast()
  const [brands, setBrands] = useState<BrandResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("all")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<BrandResponse | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BrandResponse | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [noBrandCount, setNoBrandCount] = useState(0)
  const [importOpen, setImportOpen] = useState(false)
  const { formatCurrency } = useCompanySettings()

  const load = useCallback(() => {
    brandApi.getAll({ limit: 200 })
      .then((r) => { setBrands(r.data); setNoBrandCount(r.noBrandCount) })
      .catch(() => toast({ variant: "destructive", title: "Could not load brands" }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])

  const term = search.trim().toLowerCase()
  const filtered = useMemo(
    () => brands.filter((b) =>
      (tab === "all" || (tab === "active" ? b.status : !b.status)) &&
      (!term || b.brandName.toLowerCase().includes(term))),
    [brands, tab, term],
  )
  const { currentItems, currentPage, totalPages, itemsPerPage, setCurrentPage, handleItemsPerPageChange } = usePagination(filtered, 12)

  const blocked = useModuleGuard("Brands")
  if (blocked) return blocked

  const openForm = (b?: BrandResponse | null) => {
    setEditing(b ?? null)
    setForm(b ? { brandName: b.brandName, logo: b.logo ?? "", website: b.website ?? "", description: b.description ?? "", status: b.status } : emptyForm)
    setFormOpen(true)
  }

  const save = async () => {
    if (!form.brandName.trim()) {
      toast({ variant: "destructive", title: "Name required", description: "Give the brand a name" })
      return
    }
    const wanted = form.brandName.trim().toLowerCase()
    if (brands.some((b) => b.id !== editing?.id && b.brandName.trim().toLowerCase() === wanted)) {
      toast({ variant: "destructive", title: "Name already used", description: "A brand with this name already exists." })
      return
    }
    const logoUrl = form.logo.trim()
    if (logoUrl && !/^https?:\/\/\S+\.\S+/i.test(logoUrl)) {
      toast({ variant: "destructive", title: "Check the logo URL", description: "The logo must be an http:// or https:// link" })
      return
    }
    setSaving(true)
    try {
      const web = form.website.trim()
      if (web && !/^https?:\/\/\S+\.\S+/.test(web)) {
        toast({ variant: "destructive", title: "Check the website", description: "Start it with https://" })
        setSaving(false)
        return
      }
      const payload = { brandName: form.brandName.trim(), logo: form.logo.trim(), website: web, description: form.description.trim(), status: form.status }
      if (editing) await brandApi.update(editing.id, payload)
      else await brandApi.create(payload)
      toast({ title: editing ? "Brand updated" : "Brand added", description: payload.brandName })
      setFormOpen(false)
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not save", description: err?.response?.data?.message || "Please try again" })
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (b: BrandResponse, status: boolean) => {
    try {
      await brandApi.update(b.id, { status })
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not update", description: err?.response?.data?.message || "Please try again" })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await brandApi.delete(deleteTarget.id)
      toast({ title: "Brand deleted", description: deleteTarget.brandName })
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not delete", description: err?.response?.data?.message || "Please try again" })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const handleExport = () => {
    exportToCSV(
      filtered.map((b) => ({
        name: b.brandName, website: b.website ?? "", description: b.description ?? "", logo: b.logo ?? "",
        products: String(b.productsCount ?? 0), active: b.status ? "Yes" : "No",
      })),
      "brands",
      ["Name", "Website", "Description", "Logo", "Products", "Active"],
    )
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const items = parseCsvRows(ev.target?.result as string).filter((i) => i.name)
      const seen = new Set(brands.map((b) => b.brandName.trim().toLowerCase()))
      const http = /^https?:\/\/\S+\.\S+/i
      let ok = 0, skipped = 0
      for (const i of items) {
        const key = i.name.toLowerCase()
        if (seen.has(key) || (i.website && !http.test(i.website)) || (i.logo && !http.test(i.logo))) { skipped++; continue }
        try {
          await brandApi.create({
            brandName: i.name, website: i.website || undefined, description: i.description || undefined,
            logo: i.logo || undefined, status: !["no", "false", "0"].includes((i.active ?? "").toLowerCase()),
          })
          seen.add(key); ok++
        } catch { skipped++ }
      }
      toast({ title: "Import finished", description: `${ok} added${skipped ? `, ${skipped} skipped (duplicate or invalid)` : ""}` })
      setImportOpen(false)
      load()
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const activeCount = brands.filter((b) => b.status).length

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Brands</h1>
          <p className="mt-1 text-sm text-dash-muted">Companies that make the products you sell.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setImportOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"><Upload className="size-4" aria-hidden /> Import</button>
          <button type="button" onClick={handleExport} className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"><Download className="size-4" aria-hidden /> Export</button>
          <button type="button" onClick={() => openForm(null)}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">
            <Plus className="size-4" aria-hidden /> Add brand
          </button>
        </div>
      </div>

      <section className="rounded-[14px] border border-dash-border bg-dash-card">
        <div className="px-4">
          <StatusTabs value={tab} onChange={setTab} tabs={[
            { value: "all", label: "All", count: brands.length },
            { value: "active", label: "Active", count: activeCount },
            { value: "inactive", label: "Inactive", count: brands.length - activeCount },
          ]} />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden />
            <span className="sr-only">Search brands</span>
            <input type="search" placeholder="Search brands…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          {search && (
            <button type="button" onClick={() => setSearch("")} className="inline-flex h-11 items-center gap-1 px-2 text-[13px] font-semibold text-dash-muted hover:text-dash-ink">
              <X className="size-4" aria-hidden /> Clear
            </button>
          )}
        </div>

        <div className="px-4 pb-4">
          {loading ? (
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[112px] rounded-[14px]" />)}
            </div>
          ) : currentItems.length === 0 ? (
            <div className="py-14 text-center">
              <Tag className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
              <p className="font-semibold">{brands.length === 0 ? "No brands yet" : "No brands found"}</p>
              <p className="text-sm text-dash-muted">{brands.length === 0 ? "Add a brand to use it on products." : "Try a different search or tab."}</p>
            </div>
          ) : (
            <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {currentItems.map((b, i) => {
                const hasLogo = !!b.logo && /^(https?:)?\/\//.test(b.logo)
                return (
                  <li key={b.id} className="flex flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-4">
                    <div className="flex items-center gap-3">
                      {hasLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logo!} alt="" className="size-11 shrink-0 rounded-xl border border-dash-border object-contain" />
                      ) : (
                        <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${TINTS[(currentPage * 7 + i) % TINTS.length]}`}>
                          {initialsOf(b.brandName)}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{b.brandName}</div>
                        <div className="text-xs tabular-nums text-dash-muted">
                          {b.productsCount == null ? "—" : `${b.productsCount} product${b.productsCount === 1 ? "" : "s"}`}
                        </div>
                      </div>
                      <Switch checked={b.status} aria-label={`Active: ${b.brandName}`} onCheckedChange={(v) => setActive(b, v)}
                        className="data-[state=checked]:bg-dash-accent data-[state=unchecked]:bg-dash-neutral" />
                    </div>
                    {b.description && <p className="line-clamp-2 text-xs leading-snug text-dash-muted">{b.description}</p>}
                    {b.website && /^https?:\/\//i.test(b.website) && (
                      <a href={b.website} target="_blank" rel="noopener noreferrer" className="truncate text-xs font-semibold text-dash-accent hover:underline">{b.website.replace(/^https?:\/\//i, "")}</a>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-dash-muted">Stock value</span>
                      <span className="font-semibold tabular-nums">{b.stockValue == null ? "—" : formatCurrency(b.stockValue)}</span>
                    </div>
                    <Link href={`/dashboard/products?brand=${b.id}`} className="text-xs font-semibold text-dash-accent hover:underline">View products</Link>
                    <div className="flex items-center justify-between border-t border-dash-border-soft pt-3">
                      <span className={`rounded-md px-2 py-[3px] text-xs font-bold ${b.status ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-neutral-soft text-dash-neutral-fg"}`}>
                        {b.status ? "Active" : "Inactive"}
                      </span>
                      <div className="flex gap-1">
                        <button type="button" aria-label={`Edit ${b.brandName}`} onClick={() => openForm(b)} className={iconBtn}><Pencil className="size-4" /></button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" aria-label={`More actions for ${b.brandName}`} className={iconBtn}><MoreHorizontal className="size-4" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openForm(b)}>Edit brand</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setActive(b, !b.status)}>{b.status ? "Mark inactive" : "Mark active"}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-dash-danger focus:text-dash-danger" onClick={() => setDeleteTarget(b)}>Delete brand</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </li>
                )
              })}
              {tab === "all" && noBrandCount > 0 && (!term || "no brand".includes(term)) && (
                <li className="flex flex-col gap-3.5 rounded-[14px] border border-dashed border-dash-border bg-dash-card p-4">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-dash-neutral-soft text-sm font-bold text-dash-neutral-fg">—</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">No brand</div>
                      <div className="text-xs tabular-nums text-dash-muted">{noBrandCount} product{noBrandCount === 1 ? "" : "s"}</div>
                    </div>
                    <span className="rounded-md bg-dash-neutral-soft px-2 py-[3px] text-xs font-bold text-dash-neutral-fg">Unassigned</span>
                  </div>
                  <Link href="/dashboard/products?brand=none" className="text-xs font-semibold text-dash-accent hover:underline">View products</Link>
                </li>
              )}
              <li>
                <button type="button" onClick={() => openForm(null)}
                  className="flex h-full min-h-[112px] w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-dash-border text-sm font-semibold text-dash-muted hover:bg-dash-neutral-soft">
                  <Plus className="size-4" aria-hidden /> Add brand
                </button>
              </li>
            </ul>
          )}
        </div>

        <div className="px-4 pb-4">
          <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage} onItemsPerPageChange={handleItemsPerPageChange} totalItems={filtered.length} />
        </div>
      </section>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[480px] flex-col gap-0 overflow-hidden rounded-[18px] border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[480px]">
          <DialogHeader className="border-b border-dash-border px-6 py-[18px] text-left">
            <DialogTitle className="font-dash-display text-[22px] font-bold">{editing ? `Edit ${editing.brandName}` : "New brand"}</DialogTitle>
            <DialogDescription className="text-[13px] text-dash-muted">Brands help you group and filter products.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <label className={fieldLabel}>Brand name *
              <input className={fieldInput} placeholder="e.g. Aarong" value={form.brandName} autoFocus
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") save() }} />
            </label>
            <label className={fieldLabel}>Logo URL
              <input className={fieldInput} placeholder="https://…/logo.png" value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} />
              {/^(https?:)?\/\//.test(form.logo.trim()) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.logo.trim()} alt="" className="mt-1 size-14 rounded-xl border border-dash-border object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
              )}
            </label>
            <label className={fieldLabel}>Website
              <input className={fieldInput} placeholder="https://brand.com" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </label>
            <label className={fieldLabel}>Short description
              <textarea rows={2} className={`${fieldInput} h-auto py-2.5`} placeholder="What this brand is known for" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-dash-border px-3.5 py-3">
              <span className="flex flex-col">
                <span id="brand-active-label" className="text-sm font-semibold">Active</span>
                <span className="text-xs text-dash-muted">Available when creating products</span>
              </span>
              <Switch checked={form.status} onCheckedChange={(v) => setForm({ ...form, status: v })} aria-labelledby="brand-active-label"
                className="data-[state=checked]:bg-dash-accent data-[state=unchecked]:bg-dash-neutral" />
            </div>
          </div>
          <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 border-t border-dash-border px-6 py-4">
            <button type="button" onClick={() => setFormOpen(false)} className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-[18px] text-sm font-semibold hover:bg-dash-neutral-soft">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="h-11 rounded-[10px] bg-dash-accent px-[22px] text-sm font-bold text-white disabled:opacity-40">
              {saving ? "Saving…" : editing ? "Save changes" : "Add brand"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md rounded-[18px] border-dash-border bg-dash-card font-dash-body text-dash-ink">
          <DialogHeader className="text-left">
            <DialogTitle className="font-dash-display text-[22px] font-bold">Import brands</DialogTitle>
            <DialogDescription className="text-[13px] text-dash-muted">Upload a CSV with the columns Name, Website, Description, Logo and Active (Yes/No). Existing names and invalid links are skipped.</DialogDescription>
          </DialogHeader>
          <label className={fieldLabel}>CSV file
            <input type="file" accept=".csv" onChange={handleImport} className="text-sm font-normal file:mr-3 file:h-9 file:rounded-lg file:border file:border-dash-border file:bg-dash-card file:px-3 file:text-[13px] file:font-semibold" />
          </label>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="font-dash-body text-dash-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.brandName}?</AlertDialogTitle>
            <AlertDialogDescription>A brand that still has products can’t be deleted — reassign or delete those products first. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-dash-danger text-white hover:bg-dash-danger-fg">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
