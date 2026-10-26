"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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

type TabKey = "all" | NotificationType

const TABS: { value: TabKey; label: string }[] = [
  { value: "all", label: "All" },
  { value: "order", label: "Orders" },
  { value: "stock_alert", label: "Stock alerts" },
  { value: "payment", label: "Payments" },
  { value: "support", label: "Support" },
  { value: "review", label: "Reviews" },
  { value: "system", label: "System" },
]

const TYPE_META: Record<NotificationType, { icon: typeof Bell; label: string }> = {
  order: { icon: ShoppingCart, label: "New order" },
  stock_alert: { icon: Package, label: "Stock alert" },
  payment: { icon: Wallet, label: "Payment" },
  support: { icon: MessageSquare, label: "Support" },
  review: { icon: Star, label: "Product review" },
  system: { icon: Settings, label: "System" },
}

const PRIORITY: Record<string, { label: string; variant: "destructive" | "secondary" } | undefined> = {
  high: { label: "High priority", variant: "destructive" },
  medium: { label: "Medium", variant: "secondary" },
}

const CTA: [string, string][] = [
  ["/dashboard/vendors/purchase-orders", "Reorder"],
  ["/dashboard/dues/vendors", "Pay vendor"],
  ["/dashboard/coupons", "View coupon"],
  ["/dashboard/inventory/adjustment", "View adjustment"],
  ["/dashboard/orders", "View orders"],
  ["/dashboard/inventory", "View stock"],
  ["/dashboard/staff/salary", "Open payroll"],
  ["/dashboard/dues", "Collect"],
  ["/dashboard/support", "Open ticket"],
  ["/dashboard/products", "View product"],
  ["/dashboard/staff", "View staff"],
]
const ctaFor = (url: string) => CTA.find(([p]) => url.startsWith(p))?.[1] ?? "Open"

const rel = (iso: string) => {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ""
  const m = Math.floor((Date.now() - t) / 60000)
  if (m < 1) return "Just now"
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.floor(m / 60)} hour${m >= 120 ? "s" : ""} ago`
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

const dayLabel = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Earlier"
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`
  if (key(d) === key(new Date())) return "Today"
  if (key(d) === key(new Date(Date.now() - 864e5))) return "Yesterday"
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

interface TodoItem { n: string; label: string; href: string }

export default function NotificationsPage() {
  const blocked = useModuleGuard("Notifications")
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
      toast({ variant: "destructive", title: "Could not load notifications" })
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
    if (a.pendingOrders > 0) out.push({ n: String(a.pendingOrders), label: "Orders pending confirmation", href: "/dashboard/orders" })
    if (a.customerDue > 0) out.push({ n: formatCurrency(a.customerDue), label: `Customer dues to collect (${a.customerDueInvoices} invoice${a.customerDueInvoices === 1 ? "" : "s"})`, href: "/dashboard/dues/customers" })
    if (a.vendorDue > 0) out.push({ n: formatCurrency(a.vendorDue), label: `Owed to vendors (${a.vendorDueOrders} order${a.vendorDueOrders === 1 ? "" : "s"})`, href: "/dashboard/dues/vendors" })
    if (a.salariesUnpaid > 0) out.push({ n: formatCurrency(a.salariesUnpaid), label: `Salaries due (${a.salaryMonth})`, href: "/dashboard/staff/salary" })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live])

  const dismissLive = async (key: string) => {
    setLiveBusy(true)
    try { await notificationApi.dismissAlert(key); await loadLive() } catch { toast({ variant: "destructive", title: "Could not dismiss alert" }) } finally { setLiveBusy(false) }
  }
  const restoreLive = async () => {
    setLiveBusy(true)
    try { await notificationApi.restoreAlerts(); await loadLive() } catch { toast({ variant: "destructive", title: "Could not restore alerts" }) } finally { setLiveBusy(false) }
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
  }, [items])

  if (blocked) return blocked

  async function act(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true)
    try {
      await fn()
      if (okMsg) toast({ title: okMsg })
      await load()
      void fetchNotifications()
    } catch {
      toast({ variant: "destructive", title: "Action failed" })
    } finally {
      setBusy(false)
    }
  }

  const markSelected = () => {
    const unread = items.filter((n) => selected.includes(n.id) && !n.readAt)
    if (!selected.length) return toast({ variant: "destructive", title: "Select notifications first" })
    void act(async () => { await Promise.all(unread.map((n) => notificationApi.markAsRead(n.id))); setSelected([]) }, "Marked as read")
  }
  const deleteSelected = () => {
    if (!selected.length || !window.confirm(`Delete ${selected.length} selected notification${selected.length > 1 ? "s" : ""}?`)) return
    void act(async () => { await notificationApi.bulkDelete(selected); setSelected([]) }, "Notifications deleted")
  }
  const clearAll = () => {
    if (!window.confirm(`Delete all ${totalAll} notification${totalAll === 1 ? "" : "s"}?`)) return
    void act(async () => { await notificationApi.deleteAll(); setSelected([]); setPage(1) }, "Notifications cleared")
  }
  const markAll = () => {
    if (meta.unreadCount === 0) return toast({ title: "Nothing to mark" })
    void act(() => notificationApi.markAllAsRead(), "All notifications marked as read")
  }
  const open = (n: NotificationResponse) => {
    if (!n.readAt) void notificationApi.markAsRead(n.id).then(() => fetchNotifications()).catch(() => {})
    if (n.actionUrl) router.push(n.actionUrl)
  }

  const counts = meta.counts
  const totalAll = counts?.all ?? 0
  const selTxt = selected.length ? ` (${selected.length})` : ""

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Notifications"
        description="Everything that happened in your business, with a next step for each. Filter by type or status, then bulk read or delete."
      />

      <div className="flex flex-col items-start gap-4 xl:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
        {live && (live.alerts.length > 0 || live.dismissedCount > 0) && (
          <Card className="gap-0 overflow-hidden py-0" role="region" aria-label="Live alerts">
            <div className="flex flex-wrap items-center gap-2 px-5 py-3">
              <AlertTriangle className="size-[18px] text-muted-foreground" aria-hidden />
              <h2 className="text-lg font-semibold">Live alerts</h2>
              <span className="text-sm text-muted-foreground">{live.total} active · computed from your current data</span>
              {live.dismissedCount > 0 && (
                <Button type="button" variant="link" size="sm" disabled={liveBusy} onClick={() => void restoreLive()} className="ml-auto">
                  Restore {live.dismissedCount} dismissed
                </Button>
              )}
            </div>
            <Separator />
            {live.alerts.length === 0 && <p className="px-5 py-4 text-sm text-muted-foreground">No active alerts. Dismissed alerts come back on their own if the problem returns.</p>}
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
                          {pri && <Badge variant={pri.variant}>{pri.label}</Badge>}
                          {a.since && rel(a.since)}
                          <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs"><Link href={a.actionUrl}>{a.ctaLabel} →</Link></Button>
                        </span>
                      </ItemContent>
                      <ItemActions>
                        <WithTooltip content="Dismiss">
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Dismiss ${a.title}`} disabled={liveBusy} onClick={() => void dismissLive(a.key)}>
                            <X className="size-4" />
                          </Button>
                        </WithTooltip>
                      </ItemActions>
                    </Item>
                  </Fragment>
                )
              })}
            </ItemGroup>
            {live.total > live.alerts.length && <><Separator /><p className="px-5 py-2.5 text-xs text-muted-foreground">Showing the top {live.alerts.length} of {live.total}.</p></>}
          </Card>
        )}
        <Card className="w-full min-w-0 gap-0 py-0">
          <div className="px-4">
            <StatusTabs
              value={tab}
              onChange={(t) => { setTab(t as TabKey); setPage(1); setSelected([]) }}
              tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: counts?.[t.value] }))}
            />
          </div>

          <Toolbar
            className="px-4 py-3"
            actions={<>
              <Button type="button" variant="destructive" size="sm" onClick={clearAll} disabled={busy || totalAll === 0}>Clear all</Button>
              <Button type="button" variant="outline" size="sm" onClick={markAll} disabled={busy}>Mark all as read</Button>
              <Button asChild variant="outline" size="sm"><Link href="/dashboard/settings/notifications">Settings</Link></Button>
            </>}
          >
            <span className="text-sm text-muted-foreground">
              {meta.unreadCount} unread · {totalAll} total{meta.total !== totalAll ? ` · ${meta.total} shown` : ""}
            </span>
          </Toolbar>
          <Separator />

          <Toolbar className="px-4 py-3">
            <Label className="min-h-9">
              <Checkbox
                checked={allChecked}
                aria-label="Select all notifications on this page"
                onCheckedChange={() => setSelected(allChecked ? selected.filter((id) => !pageIds.includes(id)) : [...new Set([...selected, ...pageIds])])}
              />
              Select page
            </Label>
            <Button type="button" variant="outline" size="sm" onClick={markSelected} disabled={busy} className={cn(!selected.length && "opacity-50")}>Mark selected as read{selTxt}</Button>
            {selected.length > 0 && (
              <Button type="button" variant="destructive" size="sm" onClick={deleteSelected} disabled={busy}>Delete selected{selTxt}</Button>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <Label htmlFor="notif-status">Status</Label>
              <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); setSelected([]) }}>
                <SelectTrigger id="notif-status" size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="unread">Unread only</SelectItem>
                  <SelectItem value="read">Read only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Label htmlFor="notif-sort">Sort</Label>
              <Select value={sort} onValueChange={(v) => { setSort(v as typeof sort); setPage(1) }}>
                <SelectTrigger id="notif-sort" size="sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
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
              title={totalAll === 0 && status === "all" ? "You’re all caught up." : "No notifications found."}
              description={totalAll === 0 && status === "all" ? "New orders, stock alerts and payment reminders will show up here." : "Try adjusting your filters."}
            />
          ) : (
            groups.map((g) => (
              <div key={g.day}>
                <SectionTitle className="bg-muted/50 px-5 py-2.5">{g.day}</SectionTitle>
                <Separator />
                {g.rows.map((n) => {
                  const unread = !n.readAt
                  const t = TYPE_META[n.type] ?? TYPE_META.system
                  const Icon = n.data && "adjustmentNo" in n.data ? SlidersHorizontal : t.icon
                  const pri = PRIORITY[n.priority]
                  return (
                    <Fragment key={n.id}>
                      <Item size="sm" variant={unread ? "muted" : "default"} className="items-start rounded-none px-5">
                        <Checkbox
                          className="mt-2.5 flex-none" checked={selected.includes(n.id)}
                          aria-label={`Select notification ${n.title}`}
                          onCheckedChange={() => setSelected((s) => (s.includes(n.id) ? s.filter((x) => x !== n.id) : [...s, n.id]))}
                        />
                        <ItemMedia variant="icon"><Icon aria-hidden /></ItemMedia>
                        <ItemContent className="min-w-0 gap-0.5">
                          <ItemTitle className={unread ? "font-bold" : "font-medium"}>{n.title}</ItemTitle>
                          <ItemDescription className="line-clamp-none">{n.message}</ItemDescription>
                          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary">{t.label}</Badge>
                            {pri && <Badge variant={pri.variant}>{pri.label}</Badge>}
                            {rel(n.createdAt)}
                            {n.actionUrl && (
                              <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs"><Link href={n.actionUrl} onClick={() => open(n)}>{ctaFor(n.actionUrl)} →</Link></Button>
                            )}
                          </span>
                        </ItemContent>
                        <ItemActions className="flex-col items-end gap-1.5">
                          {unread ? (
                            <WithTooltip content="Mark as read">
                              <Button type="button" variant="ghost" size="icon-sm" aria-label="Mark as read" disabled={busy} onClick={() => void act(() => notificationApi.markAsRead(n.id))}>
                                <Circle className="size-2.5 fill-primary text-primary" aria-hidden />
                              </Button>
                            </WithTooltip>
                          ) : (
                            <WithTooltip content="Mark as unread">
                              <Button type="button" variant="ghost" size="icon-sm" aria-label="Mark as unread" disabled={busy} onClick={() => void act(() => notificationApi.markAsUnread(n.id))}>
                                <Circle className="size-2.5 text-muted-foreground" aria-hidden />
                              </Button>
                            </WithTooltip>
                          )}
                          <WithTooltip content="Delete">
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete notification" disabled={busy} onClick={() => void act(() => notificationApi.delete(n.id))}>
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
          <SectionCard title="Needs your attention" contentClassName="flex flex-col gap-3">
            {todo === null ? (
              <div className="flex flex-col gap-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : todo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
            ) : (
              todo.map((t) => (
                <Item key={t.label} asChild variant="outline" size="sm">
                  <Link href={t.href}>
                    <strong className="min-w-8 text-lg">{t.n}</strong>
                    <ItemContent><ItemTitle>{t.label}</ItemTitle></ItemContent>
                    <span aria-hidden>→</span>
                  </Link>
                </Item>
              ))
            )}
          </SectionCard>

          <SectionCard
            title={<span className="flex items-center gap-2"><Smartphone className="size-[18px]" aria-hidden />Get these on your phone</span>}
            description="Turn on SMS or app alerts for new orders and low stock so you don’t have to keep this page open."
          >
            <Button asChild className="w-full"><Link href="/dashboard/settings/notifications">Choose alerts</Link></Button>
          </SectionCard>
        </aside>
      </div>
      {busy && <Spinner className="sr-only" aria-hidden />}
    </div>
  )
}
