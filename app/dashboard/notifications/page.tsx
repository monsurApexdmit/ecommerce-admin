"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { localeTag } from "@/lib/i18n"
import { Bell, ShoppingCart, Package, Wallet, MessageSquare, Star, Settings, X, Smartphone, Circle, SlidersHorizontal, AlertTriangle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { useNotifications } from "@/contexts/notification-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { notificationApi, type NotificationResponse, type NotificationType, type LiveAlertsResult } from "@/lib/notificationApi"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/common/EmptyState"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { Toolbar } from "@/components/common/Toolbar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type K = ParseKeys<["account", "common"]>
type TabKey = "all" | NotificationType

const TABS: { value: TabKey; label: K }[] = [
  { value: "all", label: "common:status.all" },
  { value: "order", label: "account:notifications.tabs.orders" },
  { value: "stock_alert", label: "account:notifications.tabs.stockAlerts" },
  { value: "payment", label: "account:notifications.tabs.payments" },
  { value: "support", label: "account:notifications.tabs.support" },
  { value: "review", label: "account:notifications.tabs.reviews" },
  { value: "system", label: "account:notifications.tabs.system" },
]

const TYPE_META: Record<NotificationType, { icon: typeof Bell; label: K }> = {
  order: { icon: ShoppingCart, label: "account:notifications.types.order" },
  stock_alert: { icon: Package, label: "account:notifications.types.stockAlert" },
  payment: { icon: Wallet, label: "account:notifications.types.payment" },
  support: { icon: MessageSquare, label: "account:notifications.types.support" },
  review: { icon: Star, label: "account:notifications.types.review" },
  system: { icon: Settings, label: "account:notifications.types.system" },
}

const PRIORITY: Record<string, { label: K; variant: "destructive" | "secondary" } | undefined> = {
  high: { label: "account:notifications.priority.high", variant: "destructive" },
  medium: { label: "account:notifications.priority.medium", variant: "secondary" },
}

const CTA: [string, K][] = [
  ["/dashboard/vendors/purchase-orders", "account:notifications.cta.reorder"],
  ["/dashboard/dues/vendors", "account:notifications.cta.payVendor"],
  ["/dashboard/coupons", "account:notifications.cta.viewCoupon"],
  ["/dashboard/inventory/adjustment", "account:notifications.cta.viewAdjustment"],
  ["/dashboard/orders", "account:notifications.cta.viewOrders"],
  ["/dashboard/inventory", "account:notifications.cta.viewStock"],
  ["/dashboard/staff/salary", "account:notifications.cta.openPayroll"],
  ["/dashboard/dues", "account:notifications.cta.collect"],
  ["/dashboard/support", "account:notifications.cta.openTicket"],
  ["/dashboard/products", "account:notifications.cta.viewProduct"],
  ["/dashboard/staff", "account:notifications.cta.viewStaff"],
]
const ctaFor = (url: string): K => CTA.find(([p]) => url.startsWith(p))?.[1] ?? "account:notifications.cta.open"

interface TodoItem { n: string; label: string; href: string }

export default function NotificationsPage() {
  const blocked = useModuleGuard("Notifications")
  const { t, i18n } = useTranslation(["account", "common"])
  const lang = localeTag(i18n.language)
  const rel = (iso: string) => {
    const ts = new Date(iso).getTime()
    if (Number.isNaN(ts)) return ""
    const m = Math.floor((Date.now() - ts) / 60000)
    if (m < 1) return t("account:notifications.justNow")
    if (m < 60) return t("common:ago.minutes", { count: m })
    if (m < 1440) return t("common:ago.hours", { count: Math.floor(m / 60) })
    return new Date(iso).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" })
  }
  const dayLabel = (iso: string) => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return t("account:notifications.earlier")
    const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
    if (key(d) === key(new Date())) return t("common:time.today")
    if (key(d) === key(new Date(Date.now() - 864e5))) return t("common:time.yesterday")
    return d.toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" })
  }
  const { toast } = useToast()
  const router = useRouter()
  const { formatCurrency } = useCompanySettings()
  const { unreadCount: liveUnread, fetchNotifications } = useNotifications()

  const [tab, setTab] = useState<TabKey>("all")
  const [status, setStatus] = useState<"all" | "unread" | "read">("all")
  const [sort, setSort] = useState<"newest" | "oldest">("newest")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [items, setItems] = useState<NotificationResponse[]>([])
  const [meta, setMeta] = useState<{ total: number; lastPage: number; unreadCount: number; counts?: Record<string, number> }>({ total: 0, lastPage: 1, unreadCount: 0 })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [live, setLive] = useState<LiveAlertsResult | null>(null)
  const [liveBusy, setLiveBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await notificationApi.getAll({
        page, limit: perPage, sort,
        ...(tab !== "all" ? { type: tab } : {}),
        ...(status !== "all" ? { status } : {}),
      })
      setItems(res.data ?? [])
      setMeta({ total: res.meta.total, lastPage: res.meta.lastPage, unreadCount: res.meta.unreadCount, counts: res.meta.counts })
    } catch {
      toast({ variant: "destructive", title: t("account:notifications.loadFailed") })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, sort, tab, status])

  useEffect(() => { void load() }, [load, liveUnread])

  // Live alerts + attention totals come from the backend (computed over all records, not this page).
  const loadLive = useCallback(async () => {
    try { setLive(await notificationApi.getAlerts()) } catch { setLive((x) => x ?? null) }
  }, [])
  useEffect(() => { if (!blocked) void loadLive() }, [blocked, loadLive])

  const todo = useMemo<TodoItem[] | null>(() => {
    if (!live) return null
    const a = live.attention
    const out: TodoItem[] = []
    if (a.pendingOrders > 0) out.push({ n: String(a.pendingOrders), label: t("account:notifications.todo.pendingOrders"), href: "/dashboard/orders" })
    if (a.customerDue > 0) out.push({ n: formatCurrency(a.customerDue), label: t("account:notifications.todo.customerDue", { count: a.customerDueInvoices }), href: "/dashboard/dues/customers" })
    if (a.vendorDue > 0) out.push({ n: formatCurrency(a.vendorDue), label: t("account:notifications.todo.vendorDue", { count: a.vendorDueOrders }), href: "/dashboard/dues/vendors" })
    if (a.salariesUnpaid > 0) out.push({ n: formatCurrency(a.salariesUnpaid), label: t("account:notifications.todo.salariesDue", { month: a.salaryMonth }), href: "/dashboard/staff/salary" })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, t])

  const dismissLive = async (key: string) => {
    setLiveBusy(true)
    try { await notificationApi.dismissAlert(key); await loadLive() } catch { toast({ variant: "destructive", title: t("account:notifications.dismissFailed") }) } finally { setLiveBusy(false) }
  }
  const restoreLive = async () => {
    setLiveBusy(true)
    try { await notificationApi.restoreAlerts(); await loadLive() } catch { toast({ variant: "destructive", title: t("account:notifications.restoreFailed") }) } finally { setLiveBusy(false) }
  }

  const pageIds = items.map((n) => n.id)
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.includes(id))

  const groups = useMemo(() => {
    const out: { day: string; rows: NotificationResponse[] }[] = []
    for (const n of items) {
      const day = dayLabel(n.createdAt)
      let g = out.find((x) => x.day === day)
      if (!g) out.push((g = { day, rows: [] }))
      g.rows.push(n)
    }
    return out
  }, [items, t, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  if (blocked) return blocked

  async function act(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true)
    try {
      await fn()
      if (okMsg) toast({ title: okMsg })
      await load()
      void fetchNotifications()
    } catch {
      toast({ variant: "destructive", title: t("account:notifications.actionFailed") })
    } finally {
      setBusy(false)
    }
  }

  const markSelected = () => {
    const unread = items.filter((n) => selected.includes(n.id) && !n.readAt)
    if (!selected.length) return toast({ variant: "destructive", title: t("account:notifications.selectFirst") })
    void act(async () => { await Promise.all(unread.map((n) => notificationApi.markAsRead(n.id))); setSelected([]) }, t("account:notifications.markedRead"))
  }
  const deleteSelected = () => {
    if (!selected.length || !window.confirm(t("account:notifications.deleteSelectedConfirm", { count: selected.length }))) return
    void act(async () => { await notificationApi.bulkDelete(selected); setSelected([]) }, t("account:notifications.deleted"))
  }
  const clearAll = () => {
    if (!window.confirm(t("account:notifications.clearConfirm", { count: totalAll }))) return
    void act(async () => { await notificationApi.deleteAll(); setSelected([]); setPage(1) }, t("account:notifications.cleared"))
  }
  const markAll = () => {
    if (meta.unreadCount === 0) return toast({ title: t("account:notifications.nothingToMark") })
    void act(() => notificationApi.markAllAsRead(), t("account:notifications.allMarked"))
  }
  const open = (n: NotificationResponse) => {
    if (!n.readAt) void notificationApi.markAsRead(n.id).then(() => fetchNotifications()).catch(() => {})
    if (n.actionUrl) router.push(n.actionUrl)
  }

  const counts = meta.counts
  const totalAll = counts?.all ?? 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("account:notifications.title")}
        description={t("account:notifications.description")}
      />

      <div className="flex flex-col items-start gap-4 xl:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
        {live && (live.alerts.length > 0 || live.dismissedCount > 0) && (
          <Card className="gap-0 overflow-hidden py-0" role="region" aria-label={t("account:notifications.live.title")}>
            <div className="flex flex-wrap items-center gap-2 px-5 py-3">
              <AlertTriangle className="size-[18px] text-muted-foreground" aria-hidden />
              <h2 className="text-lg font-semibold">{t("account:notifications.live.title")}</h2>
              <span className="text-sm text-muted-foreground">{t("account:notifications.live.summary", { count: live.total })}</span>
              {live.dismissedCount > 0 && (
                <Button type="button" variant="link" size="sm" disabled={liveBusy} onClick={() => void restoreLive()} className="ml-auto">
                  {t("account:notifications.live.restore", { count: live.dismissedCount })}
                </Button>
              )}
            </div>
            <Separator />
            {live.alerts.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">{t("account:notifications.live.none")}</p>}
            <ItemGroup>
              {live.alerts.map((a, i) => {
                const pri = PRIORITY[a.priority]
                return (
                  <Fragment key={a.key}>
                    {i > 0 && <ItemSeparator />}
                    <Item size="sm" className="items-start rounded-none px-5">
                      <ItemMedia variant="icon"><Package aria-hidden /></ItemMedia>
                      <ItemContent className="min-w-0 gap-0.5">
                        <ItemTitle className="font-semibold">{a.title}</ItemTitle>
                        <ItemDescription className="line-clamp-none">{a.message}</ItemDescription>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {pri && <Badge variant={pri.variant}>{t(pri.label)}</Badge>}
                          {a.since && rel(a.since)}
                          <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs"><Link href={a.actionUrl}>{a.ctaLabel} →</Link></Button>
                        </span>
                      </ItemContent>
                      <ItemActions>
                        <WithTooltip content={t("account:notifications.live.dismiss")}>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={t("account:notifications.live.dismissName", { title: a.title })} disabled={liveBusy} onClick={() => void dismissLive(a.key)}>
                            <X className="size-4" />
                          </Button>
                        </WithTooltip>
                      </ItemActions>
                    </Item>
                  </Fragment>
                )
              })}
            </ItemGroup>
            {live.total > live.alerts.length && <><Separator /><p className="px-5 py-2.5 text-xs text-muted-foreground">{t("account:notifications.live.showingTop", { shown: live.alerts.length, total: live.total })}</p></>}
          </Card>
        )}
        <Card className="w-full min-w-0 gap-0 py-0">
          <div className="px-4">
            <StatusTabs
              value={tab}
              onChange={(v) => { setTab(v as TabKey); setPage(1); setSelected([]) }}
              tabs={TABS.map((tb) => ({ value: tb.value, label: t(tb.label), count: counts?.[tb.value] }))}
            />
          </div>

          <Toolbar
            className="px-4 py-3"
            actions={<>
              <Button type="button" variant="destructive" size="sm" onClick={clearAll} disabled={busy || totalAll === 0}>{t("account:notifications.clearAll")}</Button>
              <Button type="button" variant="outline" size="sm" onClick={markAll} disabled={busy}>{t("account:notifications.markAll")}</Button>
              <Button asChild variant="outline" size="sm"><Link href="/dashboard/settings/notifications">{t("common:extra.settings")}</Link></Button>
            </>}
          >
            <span className="text-sm text-muted-foreground">
              {meta.total !== totalAll
                ? t("account:notifications.countsShown", { unread: meta.unreadCount, total: totalAll, shown: meta.total })
                : t("account:notifications.counts", { unread: meta.unreadCount, total: totalAll })}
            </span>
          </Toolbar>
          <Separator />

          <Toolbar className="px-4 py-3">
            <Label className="min-h-9">
              <Checkbox
                checked={allChecked}
                aria-label={t("account:notifications.selectAllAria")}
                onCheckedChange={() => setSelected(allChecked ? selected.filter((id) => !pageIds.includes(id)) : [...new Set([...selected, ...pageIds])])}
              />
              {t("account:notifications.selectPage")}
            </Label>
            <Button type="button" variant="outline" size="sm" onClick={markSelected} disabled={busy} className={cn(!selected.length && "opacity-50")}>{selected.length ? t("account:notifications.markSelectedCount", { count: selected.length }) : t("account:notifications.markSelected")}</Button>
            {selected.length > 0 && (
              <Button type="button" variant="destructive" size="sm" onClick={deleteSelected} disabled={busy}>{t("account:notifications.deleteSelectedCount", { count: selected.length })}</Button>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <Label htmlFor="notif-status">{t("common:fields.status")}</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); setSelected([]) }}>
                <SelectTrigger id="notif-status" size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("account:notifications.allStatus")}</SelectItem>
                  <SelectItem value="unread">{t("account:notifications.unreadOnly")}</SelectItem>
                  <SelectItem value="read">{t("account:notifications.readOnly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="notif-sort">{t("account:notifications.sort")}</Label>
              <Select value={sort} onValueChange={(v) => { setSort(v as typeof sort); setPage(1) }}>
                <SelectTrigger id="notif-sort" size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("account:notifications.newest")}</SelectItem>
                  <SelectItem value="oldest">{t("account:notifications.oldest")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Toolbar>
          <Separator />

          {loading ? (
            <div className="flex flex-col gap-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={totalAll === 0 && status === "all" ? t("account:notifications.caughtUp") : t("account:notifications.noneFound")}
              description={totalAll === 0 && status === "all" ? t("account:notifications.caughtUpDesc") : t("account:notifications.noneFoundDesc")}
            />
          ) : (
            groups.map((g) => (
              <div key={g.day}>
                <SectionTitle className="bg-muted/50 px-5 py-2.5">{g.day}</SectionTitle>
                <Separator />
                {g.rows.map((n) => {
                  const unread = !n.readAt
                  const meta_ = TYPE_META[n.type] ?? TYPE_META.system
                  const Icon = n.data && "adjustmentNo" in n.data ? SlidersHorizontal : meta_.icon
                  const pri = PRIORITY[n.priority]
                  return (
                    <Fragment key={n.id}>
                      <Item size="sm" variant={unread ? "muted" : "default"} className="items-start rounded-none px-5">
                        <Checkbox
                          className="mt-2.5 flex-none" checked={selected.includes(n.id)}
                          aria-label={t("account:notifications.selectOne", { title: n.title })}
                          onCheckedChange={() => setSelected((s) => (s.includes(n.id) ? s.filter((x) => x !== n.id) : [...s, n.id]))}
                        />
                        <ItemMedia variant="icon"><Icon aria-hidden /></ItemMedia>
                        <ItemContent className="min-w-0 gap-0.5">
                          <ItemTitle className={unread ? "font-bold" : "font-medium"}>{n.title}</ItemTitle>
                          <ItemDescription className="line-clamp-none">{n.message}</ItemDescription>
                          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary">{t(meta_.label)}</Badge>
                            {pri && <Badge variant={pri.variant}>{t(pri.label)}</Badge>}
                            {rel(n.createdAt)}
                            {n.actionUrl && (
                              <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs"><Link href={n.actionUrl} onClick={() => open(n)}>{t(ctaFor(n.actionUrl))} →</Link></Button>
                            )}
                          </span>
                        </ItemContent>
                        <ItemActions className="flex-col items-end gap-1.5">
                          {unread ? (
                            <WithTooltip content={t("account:notifications.markRead")}>
                              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("account:notifications.markRead")} disabled={busy} onClick={() => void act(() => notificationApi.markAsRead(n.id))}>
                                <Circle className="size-2.5 fill-primary text-primary" aria-hidden />
                              </Button>
                            </WithTooltip>
                          ) : (
                            <WithTooltip content={t("account:notifications.markUnread")}>
                              <Button type="button" variant="ghost" size="icon-sm" aria-label={t("account:notifications.markUnread")} disabled={busy} onClick={() => void act(() => notificationApi.markAsUnread(n.id))}>
                                <Circle className="size-2.5 text-muted-foreground" aria-hidden />
                              </Button>
                            </WithTooltip>
                          )}
                          <WithTooltip content={t("common:actions.delete")}>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label={t("account:notifications.deleteOne")} disabled={busy} onClick={() => void act(() => notificationApi.delete(n.id))}>
                              <X className="size-4" />
                            </Button>
                          </WithTooltip>
                        </ItemActions>
                      </Item>
                      <Separator />
                    </Fragment>
                  )
                })}
              </div>
            ))
          )}

          {meta.total > 0 && (
            <div className="p-4">
              <PaginationControl
                currentPage={page} totalPages={Math.max(1, meta.lastPage)} totalItems={meta.total} itemsPerPage={perPage}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
              />
            </div>
          )}
        </Card>
        </div>

        <aside className="flex w-full flex-col gap-4 xl:w-[340px] xl:flex-none">
          <SectionCard title={t("account:notifications.attention")} contentClassName="flex flex-col gap-3">
            {todo === null ? (
              <div className="flex flex-col gap-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : todo.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("account:notifications.attentionNone")}</p>
            ) : (
              todo.map((td) => (
                <Item key={td.href} asChild variant="outline" size="sm">
                  <Link href={td.href}>
                    <strong className="min-w-8 text-lg">{td.n}</strong>
                    <ItemContent><ItemTitle>{td.label}</ItemTitle></ItemContent>
                    <span aria-hidden>→</span>
                  </Link>
                </Item>
              ))
            )}
          </SectionCard>

          <SectionCard
            title={<span className="flex items-center gap-2"><Smartphone className="size-[18px]" aria-hidden />{t("account:notifications.phoneTitle")}</span>}
            description={t("account:notifications.phoneDesc")}
          >
            <Button asChild className="w-full"><Link href="/dashboard/settings/notifications">{t("account:notifications.chooseAlerts")}</Link></Button>
          </SectionCard>
        </aside>
      </div>
      {busy && <Spinner className="sr-only" aria-hidden />}
    </div>
  )
}
