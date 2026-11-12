"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import {
  Banknote, Copy, Eye, Link2, Megaphone, MoreHorizontal, MousePointerClick, Percent, Plus, QrCode, Search, ShoppingCart, X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PaginationControl } from "@/components/ui/pagination-control"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { StatTile } from "@/components/common/StatTile"
import { Toolbar } from "@/components/common/Toolbar"
import { EmptyState } from "@/components/common/EmptyState"
import { WithTooltip } from "@/components/common/WithTooltip"
import { AD_SOURCE_META, AdSourceBadge } from "@/components/sales/ad-source"
import { LinkDialog } from "@/components/marketing/link-dialog"
import { LinkDetailSheet } from "@/components/marketing/link-detail-sheet"
import { TARGET_LABEL, channelLabel, pct, periodOptions, shareUrl } from "@/components/marketing/link-ui"
import { MARKETING_NS } from "@/components/marketing/i18n"
import { ORDERS_NS } from "@/components/sales/i18n"
import { localeTag } from "@/lib/i18n"
import {
  LINK_CHANNELS, campaignLinkApi, type CampaignLink, type LinkPeriod, type LinksSummary,
} from "@/lib/campaignLinkApi"
import { apiErrorMessage } from "@/lib/collectionApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"

const fmtDate = (iso: string, tag: string) => (iso ? new Date(iso).toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" }) : "—")

export default function AdOrderLinksPage() {
  const { t, i18n } = useTranslation(MARKETING_NS)
  const { t: tOrders } = useTranslation(ORDERS_NS)
  const tag = localeTag(i18n.language)
  const { formatCurrency } = useCompanySettings()
  const { hasPermission } = useSaasAuth()
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [period, setPeriod] = useState<LinkPeriod>("30d")
  const [summary, setSummary] = useState<LinksSummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [links, setLinks] = useState<CampaignLink[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [channel, setChannel] = useState("all")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  const [dialog, setDialog] = useState<{ link: CampaignLink | null; shareOnly?: boolean } | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CampaignLink | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const latest = useRef(0)

  // Deep links: ?new=1 opens the create dialog, ?link=<id> opens a link's detail
  useEffect(() => {
    if (searchParams.get("new") === "1") setDialog({ link: null })
    const id = Number(searchParams.get("link"))
    if (id > 0) setDetailId(id)
  }, [searchParams])

  const loadSummary = useCallback(() => {
    setSummaryLoading(true)
    campaignLinkApi.summary(period)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false))
  }, [period])

  const loadLinks = useCallback(() => {
    const id = ++latest.current
    setLoading(true)
    campaignLinkApi.getAll({
      search: search.trim() || undefined,
      channel: channel !== "all" ? channel : undefined,
      isActive: status === "active" ? "true" : status === "inactive" ? "false" : undefined,
      period, page, perPage,
    })
      .then((r) => { if (id === latest.current) { setLinks(r.data); setTotal(r.total) } })
      .catch((err) => {
        if (id !== latest.current) return
        setLinks([])
        toast({ variant: "destructive", title: t("commerce:marketing.toast.loadFailed"), description: apiErrorMessage(err, t("common:extra.tryAgain")) })
      })
      .finally(() => { if (id === latest.current) setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, channel, status, period, page, perPage])

  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => {
    const timer = setTimeout(loadLinks, search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [loadLinks, search])

  const blocked = useModuleGuard("Marketing")
  if (blocked) return blocked

  const canWrite = hasPermission("Marketing", "write")
  const canDelete = hasPermission("Marketing", "delete")
  const filtering = !!search.trim() || channel !== "all" || status !== "all"

  const refresh = () => { loadLinks(); loadSummary() }

  const copyLink = async (l: CampaignLink) => {
    try {
      await navigator.clipboard.writeText(shareUrl(l))
      toast({ title: t("commerce:marketing.toast.copied"), description: shareUrl(l) })
    } catch {
      toast({ variant: "destructive", title: t("commerce:marketing.toast.copyFailed"), description: t("commerce:marketing.toast.clipboardBlocked") })
    }
  }

  const toggleActive = async (l: CampaignLink, isActive: boolean) => {
    setBusyId(l.id)
    setLinks((prev) => prev.map((x) => (x.id === l.id ? { ...x, isActive } : x)))
    try {
      await campaignLinkApi.setActive(l.id, isActive)
      toast({ title: isActive ? t("commerce:marketing.toast.turnedOn") : t("commerce:marketing.toast.turnedOff"), description: isActive ? l.name : t("commerce:marketing.toast.offDesc") })
      loadSummary()
    } catch (err) {
      setLinks((prev) => prev.map((x) => (x.id === l.id ? l : x)))
      toast({ variant: "destructive", title: t("commerce:marketing.toast.updateFailed"), description: apiErrorMessage(err, t("common:extra.tryAgain")) })
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await campaignLinkApi.delete(deleteTarget.id)
      toast({ title: t("commerce:marketing.toast.deleted"), description: t("commerce:marketing.toast.deletedDesc") })
      if (detailId === deleteTarget.id) setDetailId(null)
      refresh()
    } catch (err) {
      toast({ variant: "destructive", title: t("commerce:marketing.toast.deleteFailed"), description: apiErrorMessage(err, t("common:extra.tryAgain")) })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const closeDetail = () => {
    setDetailId(null)
    if (searchParams.get("link")) router.replace("/dashboard/marketing/links")
  }
  const closeDialog = () => {
    setDialog(null)
    if (searchParams.get("new")) router.replace("/dashboard/marketing/links")
  }

  const totals = summary?.totals
  const peakRevenue = Math.max(1, ...(summary?.byChannel ?? []).map((c) => c.revenue))
  const rowLink = links.find((l) => l.id === detailId) ?? null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("commerce:marketing.page.title")}
        description={t("commerce:marketing.page.description")}
        actions={canWrite && (
          <Button type="button" onClick={() => setDialog({ link: null })}>
            <Plus className="size-4" aria-hidden /> {t("commerce:marketing.page.newLink")}
          </Button>
        )}
      />

      <Toolbar actions={
        <SegmentedControl aria-label={t("commerce:marketing.page.period")} value={period} onValueChange={(v) => { setPeriod(v as LinkPeriod); setPage(1) }} options={periodOptions(t)} />
      }>
        <p className="text-sm text-muted-foreground">
          {summary?.period.from && summary.period.key !== "all"
            ? `${fmtDate(summary.period.from, tag)} – ${fmtDate(summary.period.to, tag)}`
            : t("common:time.allTime")}
        </p>
      </Toolbar>

      {/* KPIs */}
      {summaryLoading && !summary ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label={t("commerce:marketing.kpi.clicks")} value={(totals?.clicks ?? 0).toLocaleString()} icon={<MousePointerClick />}
            hint={totals ? t("commerce:marketing.kpi.activeOf", { active: totals.activeLinks, count: totals.links }) : undefined} />
          <StatTile label={t("commerce:marketing.kpi.orders")} value={(totals?.orders ?? 0).toLocaleString()} icon={<ShoppingCart />}
            hint={t("commerce:marketing.kpi.ordersHint")} />
          <StatTile label={t("commerce:marketing.kpi.revenue")} value={formatCurrency(totals?.revenue ?? 0)} icon={<Banknote />} hint={t("commerce:marketing.kpi.revenueHint")} />
          <StatTile label={t("commerce:marketing.kpi.conversion")} value={pct(totals?.conversionRate ?? 0)} icon={<Percent />} hint={t("commerce:marketing.kpi.conversionHint")} />
        </div>
      )}

      {/* By channel + top links */}
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <SectionCard title={t("commerce:marketing.byChannel.title")} description={t("commerce:marketing.byChannel.description")}>
          {summaryLoading && !summary ? (
            <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : !summary?.byChannel.length ? (
            <EmptyState icon={Megaphone} title={t("commerce:marketing.byChannel.emptyTitle")} description={t("commerce:marketing.byChannel.emptyDesc")} className="p-4" />
          ) : (
            <ul className="flex flex-col gap-4">
              {summary.byChannel.map((c) => {
                const meta = AD_SOURCE_META[c.channel]
                const Icon = meta?.icon ?? Link2
                return (
                  <li key={c.channel} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span className={`grid size-6 place-items-center rounded-md ${meta?.className ?? "bg-muted"}`}><Icon className="size-3.5" aria-hidden /></span>
                        {meta || c.channel === "direct" || !c.label ? channelLabel(tOrders, c.channel) : c.label}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{t("commerce:marketing.chart.clicks", { count: c.clicks })} · {t("common:count.orders", { count: c.orders })} · {pct(c.conversionRate)}</span>
                      <span className="ml-auto font-semibold tabular-nums">{formatCurrency(c.revenue)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((c.revenue / peakRevenue) * 100)}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t("commerce:marketing.topLinks.title")} description={t("commerce:marketing.topLinks.description")}>
          {summaryLoading && !summary ? (
            <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : !summary?.topLinks.length ? (
            <p className="py-4 text-sm text-muted-foreground">{t("commerce:marketing.topLinks.empty")}</p>
          ) : (
            <ol className="flex flex-col divide-y">
              {summary.topLinks.map((top, i) => (
                <li key={top.id}>
                  <Button type="button" variant="ghost" className="h-auto w-full justify-start gap-3 px-1 py-2.5 text-left" onClick={() => setDetailId(top.id)}>
                    <span className="w-4 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{top.name}</span>
                      <span className="text-xs font-normal text-muted-foreground">{channelLabel(tOrders, top.channel)} · {t("commerce:marketing.chart.clicks", { count: top.clicks })} · {pct(top.conversionRate)}</span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="font-semibold tabular-nums">{t("common:count.orders", { count: top.orders })}</span>
                      <span className="text-xs font-normal text-muted-foreground tabular-nums">{formatCurrency(top.revenue)}</span>
                    </span>
                  </Button>
                </li>
              ))}
            </ol>
          )}
        </SectionCard>
      </div>

      {/* Links table */}
      <Card className="gap-0 py-0">
        <Toolbar className="p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="links-search" className="sr-only">{t("commerce:marketing.table.searchLabel")}</Label>
            <Input id="links-search" type="search" placeholder={t("commerce:marketing.table.searchPlaceholder")} className="pl-8" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <Select value={channel} onValueChange={(v) => { setChannel(v); setPage(1) }}>
            <SelectTrigger aria-label={t("commerce:marketing.table.channel")} className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("commerce:marketing.table.channelAll")}</SelectItem>
              {LINK_CHANNELS.map((c) => <SelectItem key={c} value={c}>{channelLabel(tOrders, c)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger aria-label={t("common:fields.status")} className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("commerce:marketing.table.statusAll")}</SelectItem>
              <SelectItem value="active">{t("common:status.active")}</SelectItem>
              <SelectItem value="inactive">{t("common:status.inactive")}</SelectItem>
            </SelectContent>
          </Select>
          {filtering && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(""); setChannel("all"); setStatus("all"); setPage(1) }}>
              <X className="size-4" aria-hidden /> {t("common:actions.clear")}
            </Button>
          )}
        </Toolbar>

        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-4">{t("commerce:marketing.table.colLink")}</TableHead>
                <TableHead scope="col">{t("commerce:marketing.table.channel")}</TableHead>
                <TableHead scope="col">{t("commerce:marketing.table.colOpens")}</TableHead>
                <TableHead scope="col" className="text-right">{t("commerce:marketing.chart.legendClicks")}</TableHead>
                <TableHead scope="col" className="text-right">{t("commerce:marketing.chart.legendOrders")}</TableHead>
                <TableHead scope="col" className="text-right">{t("commerce:marketing.kpi.revenue")}</TableHead>
                <TableHead scope="col" className="text-right">{t("commerce:marketing.table.colConv")}</TableHead>
                <TableHead scope="col">{t("common:status.active")}</TableHead>
                <TableHead scope="col">{t("common:fields.createdAt")}</TableHead>
                <TableHead scope="col" className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && links.length === 0 ? (
                [1, 2, 3, 4].map((i) => (
                  <TableRow key={i}><TableCell colSpan={10} className="px-4"><Skeleton className="h-9" /></TableCell></TableRow>
                ))
              ) : links.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="whitespace-normal">
                    <EmptyState
                      icon={Link2}
                      title={filtering ? t("commerce:marketing.table.emptyFiltered") : t("commerce:marketing.table.emptyTitle")}
                      description={filtering
                        ? t("commerce:coupons.list.emptyFiltered")
                        : t("commerce:marketing.table.emptyDesc")}
                      action={!filtering && canWrite && (
                        <Button type="button" onClick={() => setDialog({ link: null })}><Plus className="size-4" aria-hidden /> {t("commerce:marketing.page.newLink")}</Button>
                      )}
                      className="p-4 md:p-6"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                links.map((l) => (
                  <TableRow key={l.id} className={loading ? "opacity-60" : undefined}>
                    <TableCell className="max-w-[260px] pl-4">
                      <Button type="button" variant="link" className="h-auto p-0 text-left font-semibold text-foreground" onClick={() => setDetailId(l.id)}>
                        <span className="truncate">{l.name}</span>
                      </Button>
                      <div className="truncate font-mono text-xs text-muted-foreground">/l/{l.code}</div>
                    </TableCell>
                    <TableCell><AdSourceBadge source={l.channel} /></TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="text-sm">{t(TARGET_LABEL[l.targetType])}</div>
                      {l.target && <div className="truncate text-xs text-muted-foreground">{l.target.name}</div>}
                      {!l.target && l.targetType !== "store" && <Badge variant="destructive" className="mt-0.5">{t("commerce:marketing.table.targetMissing")}</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.stats.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{l.stats.orders.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(l.stats.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{pct(l.stats.conversionRate)}</TableCell>
                    <TableCell>
                      <Switch checked={l.isActive} disabled={!canWrite || busyId === l.id} aria-label={l.isActive ? t("commerce:marketing.table.turnOff", { name: l.name }) : t("commerce:marketing.table.turnOn", { name: l.name })}
                        onCheckedChange={(v) => toggleActive(l, v)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {fmtDate(l.createdAt, tag)}
                      {l.createdByName && <div className="text-xs text-muted-foreground">{l.createdByName}</div>}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1">
                        <WithTooltip content={t("commerce:marketing.table.copyLink")}>
                          <Button type="button" variant="outline" size="icon" aria-label={t("commerce:marketing.table.copyLinkFor", { name: l.name })} onClick={() => copyLink(l)}><Copy className="size-4" /></Button>
                        </WithTooltip>
                        <WithTooltip content={t("commerce:marketing.table.shareTip")}>
                          <Button type="button" variant="outline" size="icon" aria-label={t("commerce:marketing.table.shareName", { name: l.name })} onClick={() => setDialog({ link: l, shareOnly: true })}><QrCode className="size-4" /></Button>
                        </WithTooltip>
                        <WithTooltip content={t("commerce:marketing.table.viewTip")}>
                          <Button type="button" variant="outline" size="icon" aria-label={t("commerce:marketing.table.viewName", { name: l.name })} onClick={() => setDetailId(l.id)}><Eye className="size-4" /></Button>
                        </WithTooltip>
                        {(canWrite || canDelete) && (
                          <DropdownMenu>
                            <WithTooltip content={t("commerce:marketing.table.moreFor", { name: l.name })}>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="icon" aria-label={t("commerce:marketing.table.moreFor", { name: l.name })}><MoreHorizontal className="size-4" /></Button>
                              </DropdownMenuTrigger>
                            </WithTooltip>
                            <DropdownMenuContent align="end">
                              {canWrite && <DropdownMenuItem onClick={() => setDialog({ link: l })}>{t("commerce:marketing.table.editLink")}</DropdownMenuItem>}
                              {canDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(l)}>{t("commerce:marketing.table.deleteLink")}</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {links.length > 0 && (
          <>
            <Separator />
            <div className="p-4 pt-3">
              <PaginationControl
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(total / perPage))}
                itemsPerPage={perPage}
                totalItems={total}
                onPageChange={setPage}
                onItemsPerPageChange={(n) => { setPerPage(Math.min(100, n)); setPage(1) }}
              />
            </div>
          </>
        )}
      </Card>

      <LinkDialog
        open={!!dialog}
        link={dialog?.link ?? null}
        shareOnly={dialog?.shareOnly}
        onClose={closeDialog}
        onSaved={(saved) => {
          setLinks((prev) => (prev.some((x) => x.id === saved.id) ? prev.map((x) => (x.id === saved.id ? { ...saved, stats: x.stats } : x)) : prev))
          refresh()
        }}
      />

      <LinkDetailSheet
        linkId={detailId}
        initial={rowLink}
        onClose={closeDetail}
        onEdit={canWrite ? (l) => { setDetailId(null); setDialog({ link: l }) } : undefined}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("commerce:marketing.remove.title", { name: deleteTarget?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("commerce:marketing.remove.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? t("commerce:marketing.remove.deleting") : t("commerce:marketing.table.deleteLink")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
