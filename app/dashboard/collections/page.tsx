"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
      .catch((err) => toast({ variant: "destructive", title: "Could not load collections", description: apiErrorMessage(err) }))
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
      toast({ variant: "destructive", title: "Could not update", description: apiErrorMessage(err) })
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
      toast({ variant: "destructive", title: "Could not reorder", description: apiErrorMessage(err) })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await collectionApi.delete(deleteTarget.id)
      toast({ title: "Collection deleted", description: deleteTarget.name })
      setCollections((prev) => prev.filter((x) => x.id !== deleteTarget.id))
    } catch (err) {
      toast({ variant: "destructive", title: "Could not delete", description: apiErrorMessage(err) })
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
        title="Collections"
        description="Curated groups of products for your online store — hand-picked or filled automatically by rules."
        actions={canWrite ? (
          <Button asChild>
            <Link href="/dashboard/collections/new"><Plus className="size-4" aria-hidden /> Add collection</Link>
          </Button>
        ) : undefined}
      />

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={setTab} tabs={[
            { value: "all", label: "All", count: collections.length },
            { value: "published", label: "Published", count: publishedCount },
            { value: "hidden", label: "Hidden", count: collections.length - publishedCount },
            { value: "homepage", label: "On homepage", count: homepageCount },
          ]} />
        </div>

        <Toolbar className="p-4">
          <div className="relative min-w-[240px] flex-1">
            <Label htmlFor="collection-search" className="sr-only">Search collections</Label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="collection-search" type="search" placeholder="Search name or slug…" value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Label htmlFor="collection-type-filter" className="sr-only">Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger id="collection-type-filter" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="automatic">Automatic</SelectItem>
            </SelectContent>
          </Select>
          {(search || typeFilter !== "all") && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(""); setTypeFilter("all") }}>
              <X className="size-4" aria-hidden /> Clear
            </Button>
          )}
        </Toolbar>

        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-4">Collection</TableHead>
              <TableHead scope="col">Type</TableHead>
              <TableHead scope="col" className="text-right">Products</TableHead>
              <TableHead scope="col">Published</TableHead>
              <TableHead scope="col">Homepage</TableHead>
              <TableHead scope="col" className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={6} className="px-4"><Skeleton className="h-10 rounded" /></TableCell></TableRow>)
            ) : currentItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={Layers} className="p-4 md:p-6"
                    title={collections.length === 0 ? "No collections yet" : "No collections found"}
                    description={collections.length === 0
                      ? "Group products like “Summer sale” or “New arrivals” and show them on your store."
                      : "Try a different search, type or tab."}
                    action={collections.length === 0 && canWrite ? (
                      <Button asChild><Link href="/dashboard/collections/new"><Plus className="size-4" aria-hidden /> Add collection</Link></Button>
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
                        <Badge variant="secondary"><Sparkles className="size-3" aria-hidden /> Automatic</Badge>
                      ) : (
                        <Badge variant="outline">Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div>{c.productCount} product{c.productCount === 1 ? "" : "s"}</div>
                      {c.visibleProductCount < c.productCount && (
                        <div className="text-xs text-muted-foreground">{c.visibleProductCount} visible online</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.isPublished} disabled={!canWrite || busyId === c.id} aria-label={`Published: ${c.name}`}
                        onCheckedChange={(v) => patch(c, { isPublished: v })} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={c.showOnHomepage} disabled={!canWrite || busyId === c.id} aria-label={`Show on homepage: ${c.name}`}
                          onCheckedChange={(v) => patch(c, { showOnHomepage: v })} />
                        {c.showOnHomepage && !c.isPublished && (
                          <WithTooltip content="Hidden collections are not shown on the homepage">
                            <Badge variant="outline" tabIndex={0}><Home className="size-3" aria-hidden /> Not live</Badge>
                          </WithTooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1">
                        {canWrite && !filtering && (
                          <>
                            <WithTooltip content={`Move ${c.name} up`}>
                              <Button type="button" variant="outline" size="icon" aria-label={`Move ${c.name} up`} disabled={idx <= 0} onClick={() => move(c, -1)}><ArrowUp className="size-4" /></Button>
                            </WithTooltip>
                            <WithTooltip content={`Move ${c.name} down`}>
                              <Button type="button" variant="outline" size="icon" aria-label={`Move ${c.name} down`} disabled={idx < 0 || idx >= collections.length - 1} onClick={() => move(c, 1)}><ArrowDown className="size-4" /></Button>
                            </WithTooltip>
                          </>
                        )}
                        <WithTooltip content={`Edit ${c.name}`}>
                          <Button asChild variant="outline" size="icon" aria-label={`Edit ${c.name}`}>
                            <Link href={href}><Pencil className="size-4" /></Link>
                          </Button>
                        </WithTooltip>
                        <DropdownMenu>
                          <WithTooltip content={`More actions for ${c.name}`}><DropdownMenuTrigger asChild>
                            <Button type="button" variant="outline" size="icon" aria-label={`More actions for ${c.name}`}><MoreHorizontal className="size-4" /></Button>
                          </DropdownMenuTrigger></WithTooltip>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(href)}>Edit collection</DropdownMenuItem>
                            {canWrite && (
                              <>
                                <DropdownMenuItem onClick={() => patch(c, { isPublished: !c.isPublished })}>{c.isPublished ? "Hide from store" : "Publish"}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => patch(c, { showOnHomepage: !c.showOnHomepage })}>{c.showOnHomepage ? "Remove from homepage" : "Show on homepage"}</DropdownMenuItem>
                              </>
                            )}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(c)}>
                                  <Trash2 className="size-4" aria-hidden /> Delete collection
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
          {filtering ? `${filtered.length} of ${collections.length}` : collections.length} collection{collections.length === 1 ? "" : "s"}
          {filtering && collections.length > 1 ? " · clear filters to reorder" : collections.length > 1 ? " · order here is the order on your store" : ""}
        </div>
        <div className="px-4 pb-4">
          <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage} onItemsPerPageChange={handleItemsPerPageChange} totalItems={filtered.length} />
        </div>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="font-dash-body text-dash-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The collection is removed from your store. Its products are not deleted. This can’t be undone.
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
