"use client"

import { cn } from "@/lib/utils"
import type React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Download, MoreHorizontal, Pencil, Plus, Search, Tag, Upload, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { Toolbar } from "@/components/common/Toolbar"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { UserAvatar } from "@/components/common/UserAvatar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { WithTooltip } from "@/components/common/WithTooltip"

const emptyForm = { brandName: "", logo: "", website: "", description: "", status: true }

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "—"

export default function BrandsPage() {
  const { t } = useTranslation(["catalog", "common"])
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
      .catch(() => toast({ variant: "destructive", title: t("catalog:brands.toast.loadFailed") }))
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
      toast({ variant: "destructive", title: t("catalog:shared.nameRequired"), description: t("catalog:brands.toast.nameRequiredDesc") })
      return
    }
    const wanted = form.brandName.trim().toLowerCase()
    if (brands.some((b) => b.id !== editing?.id && b.brandName.trim().toLowerCase() === wanted)) {
      toast({ variant: "destructive", title: t("catalog:shared.nameUsed"), description: t("catalog:brands.toast.nameUsedDesc") })
      return
    }
    const logoUrl = form.logo.trim()
    if (logoUrl && !/^https?:\/\/\S+\.\S+/i.test(logoUrl)) {
      toast({ variant: "destructive", title: t("catalog:brands.toast.checkLogo"), description: t("catalog:brands.toast.checkLogoDesc") })
      return
    }
    setSaving(true)
    try {
      const web = form.website.trim()
      if (web && !/^https?:\/\/\S+\.\S+/.test(web)) {
        toast({ variant: "destructive", title: t("catalog:brands.toast.checkWebsite"), description: t("catalog:brands.toast.checkWebsiteDesc") })
        setSaving(false)
        return
      }
      const payload = { brandName: form.brandName.trim(), logo: form.logo.trim(), website: web, description: form.description.trim(), status: form.status }
      if (editing) await brandApi.update(editing.id, payload)
      else await brandApi.create(payload)
      toast({ title: editing ? t("catalog:brands.toast.updated") : t("catalog:brands.toast.added"), description: payload.brandName })
      setFormOpen(false)
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: t("catalog:shared.couldNotSave"), description: err?.response?.data?.message || t("common:extra.tryAgain") })
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (b: BrandResponse, status: boolean) => {
    try {
      await brandApi.update(b.id, { status })
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: t("catalog:shared.couldNotUpdate"), description: err?.response?.data?.message || t("common:extra.tryAgain") })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await brandApi.delete(deleteTarget.id)
      toast({ title: t("catalog:brands.toast.deleted"), description: deleteTarget.brandName })
      load()
    } catch (err: any) {
      toast({ variant: "destructive", title: t("catalog:shared.couldNotDelete"), description: err?.response?.data?.message || t("common:extra.tryAgain") })
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
      toast({
        title: t("catalog:shared.importFinished"),
        description: [t("catalog:shared.importAdded", { count: ok }), skipped ? t("catalog:shared.importSkipped", { count: skipped }) : null].filter(Boolean).join(", "),
      })
      setImportOpen(false)
      load()
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const activeCount = brands.filter((b) => b.status).length

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("catalog:brands.title")}
        description={t("catalog:brands.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}><Upload className="size-4" aria-hidden /> {t("common:actions.import")}</Button>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> {t("common:actions.export")}</Button>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="size-4" aria-hidden /> {t("catalog:brands.add")}
          </Button>
        </>}
      />

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={setTab} tabs={[
            { value: "all", label: t("common:status.all"), count: brands.length },
            { value: "active", label: t("common:status.active"), count: activeCount },
            { value: "inactive", label: t("common:status.inactive"), count: brands.length - activeCount },
          ]} />
        </div>

        <Toolbar className="p-4">
          <div className="relative min-w-[240px] flex-1">
            <Label htmlFor="brand-search" className="sr-only">{t("catalog:brands.searchLabel")}</Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="brand-search" type="search" placeholder={t("catalog:brands.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9" />
          </div>
          {search && (
            <Button type="button" variant="ghost" onClick={() => setSearch("")}>
              <X className="size-4" aria-hidden /> {t("common:actions.clear")}
            </Button>
          )}
        </Toolbar>

        <div className="px-4 pb-4">
          {loading ? (
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[112px] rounded-xl" />)}
            </div>
          ) : currentItems.length === 0 ? (
            <EmptyState icon={Tag}
              title={brands.length === 0 ? t("catalog:brands.emptyTitle") : t("catalog:brands.notFoundTitle")}
              description={brands.length === 0 ? t("catalog:brands.emptyDesc") : t("catalog:shared.noMatchHint")} />
          ) : (
            <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
              {currentItems.map((b) => {
                const hasLogo = !!b.logo && /^(https?:)?\/\//.test(b.logo)
                return (
                  <li key={b.id}>
                  <Card className="h-full gap-3.5 p-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar shape="square" src={hasLogo ? b.logo : null} alt="" fallback={initialsOf(b.brandName)} className="size-11" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{b.brandName}</div>
                        <div className="text-xs tabular-nums text-muted-foreground">
                          {b.productsCount == null ? "—" : t("common:count.products", { count: b.productsCount })}
                        </div>
                      </div>
                      <Switch checked={b.status} aria-label={t("catalog:shared.activeName", { name: b.brandName })} onCheckedChange={(v) => setActive(b, v)} />
                    </div>
                    {b.description && <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{b.description}</p>}
                    {b.website && /^https?:\/\//i.test(b.website) && (
                      <Button asChild variant="link" size="sm" className="h-auto justify-start p-0 text-xs">
                        <a href={b.website} target="_blank" rel="noopener noreferrer" className="truncate">{b.website.replace(/^https?:\/\//i, "")}</a>
                      </Button>
                    )}
                    <InfoList className="text-xs">
                      <InfoRow label={t("catalog:brands.stockValue")} value={<span className="tabular-nums">{b.stockValue == null ? "—" : formatCurrency(b.stockValue)}</span>} />
                    </InfoList>
                    <Button asChild variant="link" size="sm" className="h-auto justify-start p-0 text-xs">
                      <Link href={`/dashboard/products?brand=${b.id}`}>{t("catalog:brands.viewProducts")}</Link>
                    </Button>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <StatusBadge status={b.status ? "active" : "inactive"} label={b.status ? t("common:status.active") : t("common:status.inactive")} />
                      <div className="flex gap-1">
                        <WithTooltip content={t("catalog:shared.editName", { name: b.brandName })}><Button type="button" variant="outline" size="icon" aria-label={t("catalog:shared.editName", { name: b.brandName })} onClick={() => openForm(b)}><Pencil className="size-4" /></Button></WithTooltip>
                        <DropdownMenu>
                          <WithTooltip content={t("catalog:shared.moreFor", { name: b.brandName })}><DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" aria-label={t("catalog:shared.moreFor", { name: b.brandName })}><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger></WithTooltip>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openForm(b)}>{t("catalog:brands.edit")}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setActive(b, !b.status)}>{b.status ? t("catalog:shared.markInactive") : t("catalog:shared.markActive")}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(b)}>{t("catalog:brands.delete")}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </Card>
                  </li>
                )
              })}
              {tab === "all" && noBrandCount > 0 && (!term || "no brand".includes(term) || t("catalog:brands.noBrand").toLowerCase().includes(term)) && (
                <li>
                <Card className="h-full gap-3.5 border-dashed p-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar shape="square" aria-hidden fallback="—" className="size-11" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{t("catalog:brands.noBrand")}</div>
                      <div className="text-xs tabular-nums text-muted-foreground">{t("common:count.products", { count: noBrandCount })}</div>
                    </div>
                    <Badge variant="secondary">{t("catalog:brands.unassigned")}</Badge>
                  </div>
                  <Button asChild variant="link" size="sm" className="h-auto justify-start p-0 text-xs">
                    <Link href="/dashboard/products?brand=none">{t("catalog:brands.viewProducts")}</Link>
                  </Button>
                </Card>
                </li>
              )}
              <li>
                <Button type="button" variant="outline" onClick={() => openForm(null)}
                  className="h-full min-h-[112px] w-full border-dashed">
                  <Plus className="size-4" aria-hidden /> {t("catalog:brands.add")}
                </Button>
              </li>
            </ul>
          )}
        </div>

        <div className="px-4 pb-4">
          <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage} onItemsPerPageChange={handleItemsPerPageChange} totalItems={filtered.length} />
        </div>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[480px] flex-col gap-0 overflow-hidden rounded-[18px] border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[480px]">
          <DialogHeader className="border-b border-dash-border px-6 py-[18px] text-left">
            <DialogTitle className="font-dash-display text-[22px] font-bold">{editing ? t("catalog:shared.editName", { name: editing.brandName }) : t("catalog:brands.form.newTitle")}</DialogTitle>
            <DialogDescription className="text-[13px] text-dash-muted">{t("catalog:brands.form.desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <FormField label={t("catalog:brands.form.name")} required htmlFor="brand-name" className="min-w-0">
              <Input id="brand-name" placeholder={t("catalog:brands.form.namePlaceholder")} value={form.brandName} autoFocus
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") save() }} />
            </FormField>
            <FormField label={t("catalog:brands.form.logo")} htmlFor="brand-logo" className="min-w-0">
              <Input id="brand-logo" placeholder="https://…/logo.png" value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} />
              {/^(https?:)?\/\//.test(form.logo.trim()) && (
                <UserAvatar shape="square" src={form.logo.trim()} alt="" name={form.brandName} className="mt-1 size-14" />
              )}
            </FormField>
            <FormField label={t("catalog:brands.form.website")} htmlFor="brand-website" className="min-w-0">
              <Input id="brand-website" placeholder="https://brand.com" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </FormField>
            <FormField label={t("catalog:brands.form.shortDesc")} htmlFor="brand-description" className="min-w-0">
              <Textarea id="brand-description" rows={2} placeholder={t("catalog:brands.form.descPlaceholder")} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
            <Item variant="outline" size="sm">
              <ItemContent>
                <ItemTitle id="brand-active-label">{t("common:status.active")}</ItemTitle>
                <ItemDescription>{t("catalog:shared.availableForProducts")}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch checked={form.status} onCheckedChange={(v) => setForm({ ...form, status: v })} aria-labelledby="brand-active-label" />
              </ItemActions>
            </Item>
          </div>
          <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 border-t border-dash-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t("common:actions.cancel")}</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? t("common:actions.saving") : editing ? t("common:actions.saveChanges") : t("catalog:brands.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md rounded-[18px] border-dash-border bg-dash-card font-dash-body text-dash-ink">
          <DialogHeader className="text-left">
            <DialogTitle className="font-dash-display text-[22px] font-bold">{t("catalog:brands.import.title")}</DialogTitle>
            <DialogDescription className="text-[13px] text-dash-muted">{t("catalog:brands.import.desc")}</DialogDescription>
          </DialogHeader>
          <FormField label={t("catalog:shared.csvFile")} htmlFor="brand-import-file" className="min-w-0">
            <Input id="brand-import-file" type="file" accept=".csv" onChange={handleImport} />
          </FormField>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="font-dash-body text-dash-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:confirm.deleteTitle", { name: deleteTarget?.brandName ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("catalog:brands.deleteDesc")}</AlertDialogDescription>
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
