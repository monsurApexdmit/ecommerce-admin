"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ArrowDown, ArrowUp, Home, Layers, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/common/PageHeader"
import { Toolbar } from "@/components/common/Toolbar"
import { EmptyState } from "@/components/common/EmptyState"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusTabs } from "@/components/ui/status-tabs"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { collectionApi, apiErrorMessage, type CollectionResponse } from "@/lib/collectionApi"
import { usePagination } from "@/hooks/use-pagination"
import { useToast } from "@/hooks/use-toast"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { cn } from "@/lib/utils"

export default function CollectionsPage() {
  const { t } = useTranslation(["catalog", "common"])
  const { toast } = useToast()
  const router = useRouter()
  const { hasPermission } = useSaasAuth()
  const [collections, setCollections] = useState<CollectionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [deleteTarget, setDeleteTarget] = useState<CollectionResponse | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(() => {
    collectionApi.listAll()
      .then((list) => setCollections(list))
      .catch((err) => toast({ variant: "destructive", title: t("catalog:collections.list.loadFailed"), description: apiErrorMessage(err, t("common:extra.tryAgain")) }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])

  const term = search.trim().toLowerCase()
  const filtering = !!term || tab !== "all" || typeFilter !== "all"
  const filtered = useMemo(
    () => collections.filter((c) =>
      (tab === "all" || (tab === "published" ? c.isPublished : tab === "hidden" ? !c.isPublished : c.showOnHomepage)) &&
      (typeFilter === "all" || c.type === typeFilter) &&
      (!term || c.name.toLowerCase().includes(term) || c.slug.toLowerCase().includes(term))),
    [collections, tab, typeFilter, term],
  )
  const { currentItems, currentPage, totalPages, itemsPerPage, setCurrentPage, handleItemsPerPageChange } = usePagination(filtered, 20)

  const blocked = useModuleGuard("Collections")
  if (blocked) return blocked

  const canWrite = hasPermission("Collections", "write")
  const canDelete = hasPermission("Collections", "delete")

  const patch = async (c: CollectionResponse, data: { isPublished?: boolean; showOnHomepage?: boolean }) => {
    setBusyId(c.id)
    setCollections((prev) => prev.map((x) => (x.id === c.id ? { ...x, ...data } : x)))
    try {
      // Publish has its own endpoint; the homepage flag is a partial update
      if (data.isPublished !== undefined) await collectionApi.setStatus(c.id, { isPublished: data.isPublished })
      if (data.showOnHomepage !== undefined) await collectionApi.update(c.id, { showOnHomepage: data.showOnHomepage })
    } catch (err) {
      setCollections((prev) => prev.map((x) => (x.id === c.id ? c : x)))
      toast({ variant: "destructive", title: t("catalog:shared.couldNotUpdate"), description: apiErrorMessage(err, t("common:extra.tryAgain")) })
    } finally {
      setBusyId(null)
    }
  }

  const move = async (c: CollectionResponse, dir: -1 | 1) => {
    const i = collections.findIndex((x) => x.id === c.id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= collections.length) return
    const next = [...collections]
    ;[next[i], next[j]] = [next[j], next[i]]
    const prev = collections
    setCollections(next.map((x, k) => ({ ...x, sortOrder: k })))
    try {
      await collectionApi.reorder(next.map((x) => x.id))
    } catch (err) {
      setCollections(prev)
      toast({ variant: "destructive", title: t("catalog:shared.couldNotReorder"), description: apiErrorMessage(err, t("common:extra.tryAgain")) })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await collectionApi.delete(deleteTarget.id)
      toast({ title: t("catalog:collections.list.deleted"), description: deleteTarget.name })
      setCollections((prev) => prev.filter((x) => x.id !== deleteTarget.id))
    } catch (err) {
      toast({ variant: "destructive", title: t("catalog:shared.couldNotDelete"), description: apiErrorMessage(err, t("common:extra.tryAgain")) })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const publishedCount = collections.filter((c) => c.isPublished).length
  const homepageCount = collections.filter((c) => c.showOnHomepage).length

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("catalog:collections.list.title")}
        description={t("catalog:collections.list.description")}
        actions={canWrite ? (
          <Button asChild>
            <Link href="/dashboard/collections/new"><Plus className="size-4" aria-hidden /> {t("catalog:collections.list.add")}</Link>
          </Button>
        ) : undefined}
      />

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={setTab} tabs={[
            { value: "all", label: t("common:status.all"), count: collections.length },
            { value: "published", label: t("common:status.published"), count: publishedCount },
            { value: "hidden", label: t("catalog:shared.hidden"), count: collections.length - publishedCount },
            { value: "homepage", label: t("catalog:collections.list.onHomepage"), count: homepageCount },
          ]} />
        </div>

        <Toolbar className="p-4">
          <div className="relative min-w-[240px] flex-1">
            <Label htmlFor="collection-search" className="sr-only">{t("catalog:collections.list.searchLabel")}</Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="collection-search" type="search" placeholder={t("catalog:collections.list.searchPlaceholder")} value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Label htmlFor="collection-type-filter" className="sr-only">{t("common:fields.type")}</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger id="collection-type-filter" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("catalog:collections.list.allTypes")}</SelectItem>
              <SelectItem value="manual">{t("catalog:collections.type.manual")}</SelectItem>
              <SelectItem value="automatic">{t("catalog:collections.type.automatic")}</SelectItem>
            </SelectContent>
          </Select>
          {(search || typeFilter !== "all") && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(""); setTypeFilter("all") }}>
              <X className="size-4" aria-hidden /> {t("common:actions.clear")}
            </Button>
          )}
        </Toolbar>

        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-4">{t("catalog:collections.list.colCollection")}</TableHead>
              <TableHead scope="col">{t("common:fields.type")}</TableHead>
              <TableHead scope="col" className="text-right">{t("common:fields.products")}</TableHead>
              <TableHead scope="col">{t("common:status.published")}</TableHead>
              <TableHead scope="col">{t("catalog:collections.list.colHomepage")}</TableHead>
              <TableHead scope="col" className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={6} className="px-4"><Skeleton className="h-10 rounded" /></TableCell></TableRow>)
            ) : currentItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={Layers} className="p-4 md:p-6"
                    title={collections.length === 0 ? t("catalog:collections.list.emptyTitle") : t("catalog:collections.list.notFoundTitle")}
                    description={collections.length === 0
                      ? t("catalog:collections.list.emptyDesc")
                      : t("catalog:collections.list.filteredDesc")}
                    action={collections.length === 0 && canWrite ? (
                      <Button asChild><Link href="/dashboard/collections/new"><Plus className="size-4" aria-hidden /> {t("catalog:collections.list.add")}</Link></Button>
                    ) : undefined} />
                </TableCell>
              </TableRow>
            ) : (
              currentItems.map((c) => {
                const idx = collections.findIndex((x) => x.id === c.id)
                const href = `/dashboard/collections/${c.id}`
                return (
                  <TableRow key={c.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar shape="square" src={c.imageUrl || null} alt="" name={c.name} className="size-10" />
                        <div className="min-w-0">
                          <Link href={href} className="block truncate font-semibold hover:underline">{c.name}</Link>
                          <span className="block truncate text-xs text-muted-foreground">/{c.slug}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.type === "automatic" ? (
                        <Badge variant="secondary"><Sparkles className="size-3" aria-hidden /> {t("catalog:collections.type.automatic")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("catalog:collections.type.manual")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div>{t("common:count.products", { count: c.productCount })}</div>
                      {c.visibleProductCount < c.productCount && (
                        <div className="text-xs text-muted-foreground">{t("catalog:collections.list.visibleOnline", { count: c.visibleProductCount })}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.isPublished} disabled={!canWrite || busyId === c.id} aria-label={t("catalog:shared.publishedName", { name: c.name })}
                        onCheckedChange={(v) => patch(c, { isPublished: v })} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={c.showOnHomepage} disabled={!canWrite || busyId === c.id} aria-label={t("catalog:collections.list.homepageName", { name: c.name })}
                          onCheckedChange={(v) => patch(c, { showOnHomepage: v })} />
                        {c.showOnHomepage && !c.isPublished && (
                          <WithTooltip content={t("catalog:collections.list.notLiveTip")}>
                            <Badge variant="outline" tabIndex={0}><Home className="size-3" aria-hidden /> {t("catalog:collections.list.notLive")}</Badge>
                          </WithTooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1">
                        {canWrite && !filtering && (
                          <>
                            <WithTooltip content={t("catalog:shared.moveUp", { name: c.name })}>
                              <Button type="button" variant="outline" size="icon" aria-label={t("catalog:shared.moveUp", { name: c.name })} disabled={idx <= 0} onClick={() => move(c, -1)}><ArrowUp className="size-4" /></Button>
                            </WithTooltip>
                            <WithTooltip content={t("catalog:shared.moveDown", { name: c.name })}>
                              <Button type="button" variant="outline" size="icon" aria-label={t("catalog:shared.moveDown", { name: c.name })} disabled={idx < 0 || idx >= collections.length - 1} onClick={() => move(c, 1)}><ArrowDown className="size-4" /></Button>
                            </WithTooltip>
                          </>
                        )}
                        <WithTooltip content={t("catalog:shared.editName", { name: c.name })}>
                          <Button asChild variant="outline" size="icon" aria-label={t("catalog:shared.editName", { name: c.name })}>
                            <Link href={href}><Pencil className="size-4" /></Link>
                          </Button>
                        </WithTooltip>
                        <DropdownMenu>
                          <WithTooltip content={t("catalog:shared.moreFor", { name: c.name })}><DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" aria-label={t("catalog:shared.moreFor", { name: c.name })}><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger></WithTooltip>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(href)}>{t("catalog:collections.list.editCollection")}</DropdownMenuItem>
                            {canWrite && (
                              <>
                                <DropdownMenuItem onClick={() => patch(c, { isPublished: !c.isPublished })}>{c.isPublished ? t("catalog:collections.list.hideFromStore") : t("catalog:shared.publish")}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => patch(c, { showOnHomepage: !c.showOnHomepage })}>{c.showOnHomepage ? t("catalog:collections.list.removeFromHomepage") : t("catalog:collections.list.showOnHomepage")}</DropdownMenuItem>
                              </>
                            )}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(c)}>
                                  <Trash2 className="size-4" aria-hidden /> {t("catalog:collections.list.deleteCollection")}
                                </DropdownMenuItem>
                              </>
                            )}
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
          {filtering
            ? t("catalog:collections.list.countFiltered", { shown: filtered.length, count: collections.length })
            : t("catalog:collections.list.count", { count: collections.length })}
          {filtering && collections.length > 1 ? ` ${t("catalog:collections.list.reorderFiltered")}` : collections.length > 1 ? ` ${t("catalog:collections.list.reorderHint")}` : ""}
        </div>
        <div className="px-4 pb-4">
          <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage} onItemsPerPageChange={handleItemsPerPageChange} totalItems={filtered.length} />
        </div>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="font-dash-body text-dash-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:confirm.deleteTitle", { name: deleteTarget?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("catalog:collections.list.deleteDesc")}
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
