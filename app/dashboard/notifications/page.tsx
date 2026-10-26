"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, ShoppingCart, Package, Wallet, MessageSquare, Star, Settings, X, Smartphone, Loader2, SlidersHorizontal, AlertTriangle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { useNotifications } from "@/contexts/notification-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { notificationApi, type NotificationResponse, type NotificationType, type LiveAlertsResult } from "@/lib/notificationApi"
import { cn } from "@/lib/utils"

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

const TYPE_META: Record<NotificationType, { icon: typeof Bell; tint: string; label: string }> = {
  order: { icon: ShoppingCart, tint: "bg-dash-accent-soft text-dash-accent-fg", label: "New order" },
  stock_alert: { icon: Package, tint: "bg-dash-danger-soft text-dash-danger-fg", label: "Stock alert" },
  payment: { icon: Wallet, tint: "bg-dash-warn-soft text-dash-warn-fg", label: "Payment" },
  support: { icon: MessageSquare, tint: "bg-dash-accent-soft text-dash-accent-fg", label: "Support" },
  review: { icon: Star, tint: "bg-dash-warn-soft text-dash-warn-fg", label: "Product review" },
  system: { icon: Settings, tint: "bg-dash-neutral-soft text-dash-neutral-fg", label: "System" },
}

const PRIORITY: Record<string, { label: string; cls: string } | undefined> = {
  high: { label: "High priority", cls: "bg-dash-danger-soft text-dash-danger-fg" },
  medium: { label: "Medium", cls: "bg-dash-warn-soft text-dash-warn-fg" },
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


const card = "rounded-[14px] border border-dash-border bg-dash-card"
const select = "h-[38px] rounded-lg border border-dash-border bg-dash-card px-2.5 text-[13px] outline-none focus-visible:border-dash-accent"
const tbtn = "h-[38px] rounded-lg border border-dash-border bg-dash-card px-3 text-[13px] font-semibold disabled:opacity-50"

interface TodoItem { n: string; label: string; href: string; cls: string }

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
    if (a.pendingOrders > 0) out.push({ n: String(a.pendingOrders), label: "Orders pending confirmation", href: "/dashboard/orders", cls: "bg-dash-warn-soft text-dash-warn-fg" })
    if (a.customerDue > 0) out.push({ n: formatCurrency(a.customerDue), label: `Customer dues to collect (${a.customerDueInvoices} invoice${a.customerDueInvoices === 1 ? "" : "s"})`, href: "/dashboard/dues/customers", cls: "bg-dash-warn-soft text-dash-warn-fg" })
    if (a.vendorDue > 0) out.push({ n: formatCurrency(a.vendorDue), label: `Owed to vendors (${a.vendorDueOrders} order${a.vendorDueOrders === 1 ? "" : "s"})`, href: "/dashboard/dues/vendors", cls: "bg-dash-danger-soft text-dash-danger-fg" })
    if (a.salariesUnpaid > 0) out.push({ n: formatCurrency(a.salariesUnpaid), label: `Salaries due (${a.salaryMonth})`, href: "/dashboard/staff/salary", cls: "bg-dash-accent-soft text-dash-accent-fg" })
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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div>
        <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-dash-muted">Everything that happened in your business, with a next step for each. Filter by type or status, then bulk read or delete.</p>
      </div>

      <div className="flex flex-col items-start gap-4 xl:flex-row">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
        {live && (live.alerts.length > 0 || live.dismissedCount > 0) && (
          <section className={cn(card, "overflow-hidden")} aria-label="Live alerts">
            <div className="flex flex-wrap items-center gap-2 border-b border-dash-border-soft px-5 py-3">
              <AlertTriangle className="size-[18px] text-dash-warn-fg" aria-hidden />
              <h2 className="font-dash-display text-lg font-bold">Live alerts</h2>
              <span className="text-[13px] text-dash-muted">{live.total} active · computed from your current data</span>
              {live.dismissedCount > 0 && (
                <button type="button" disabled={liveBusy} onClick={() => void restoreLive()} className="ml-auto text-[13px] font-semibold text-dash-accent hover:underline">
                  Restore {live.dismissedCount} dismissed
                </button>
              )}
            </div>
            {live.alerts.length === 0 && <p className="px-5 py-4 text-[13px] text-dash-muted">No active alerts. Dismissed alerts come back on their own if the problem returns.</p>}
            {live.alerts.map((a) => {
              const pri = PRIORITY[a.priority]
              return (
                <div key={a.key} className="flex items-start gap-3 border-b border-dash-border-soft px-5 py-3 last:border-b-0">
                  <span className={cn("flex size-9 flex-none items-center justify-center rounded-[10px]", a.priority === "high" ? "bg-dash-danger-soft text-dash-danger-fg" : "bg-dash-warn-soft text-dash-warn-fg")}><Package className="size-[18px]" aria-hidden /></span>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-bold">{a.title}</span>
                    <span className="text-[13px] text-dash-muted">{a.message}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-dash-muted">
                      {pri && <span className={cn("rounded-full px-2 py-px font-bold", pri.cls)}>{pri.label}</span>}
                      {a.since && rel(a.since)}
                      <Link href={a.actionUrl} className="font-semibold text-dash-accent hover:underline">{a.ctaLabel} →</Link>
                    </span>
                  </div>
                  <button type="button" title="Dismiss" aria-label={`Dismiss ${a.title}`} disabled={liveBusy} onClick={() => void dismissLive(a.key)} className="flex size-7 items-center justify-center rounded-lg text-dash-muted hover:text-dash-danger-fg">
                    <X className="size-4" />
                  </button>
                </div>
              )
            })}
            {live.total > live.alerts.length && <p className="border-t border-dash-border-soft px-5 py-2.5 text-xs text-dash-muted">Showing the top {live.alerts.length} of {live.total}.</p>}
          </section>
        )}
        <section className={cn(card, "w-full min-w-0")}>
          <div className="px-4">
            <StatusTabs
              value={tab}
              onChange={(t) => { setTab(t as TabKey); setPage(1); setSelected([]) }}
              tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: counts?.[t.value] }))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 border-b border-dash-border-soft px-4 py-3">
            <span className="text-[13px] text-dash-muted">
              {meta.unreadCount} unread · {totalAll} total{meta.total !== totalAll ? ` · ${meta.total} shown` : ""}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" onClick={clearAll} disabled={busy || totalAll === 0} className={cn(tbtn, "text-dash-danger-fg")}>Clear all</button>
              <button type="button" onClick={markAll} disabled={busy} className={tbtn}>Mark all as read</button>
              <Link href="/dashboard/settings/notifications" className={cn(tbtn, "flex items-center")}>Settings</Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 border-b border-dash-border-soft px-4 py-3">
            <label className="flex min-h-[38px] items-center gap-2 text-[13px] font-semibold">
              <input
                type="checkbox" className="size-[18px]" checked={allChecked}
                aria-label="Select all notifications on this page"
                onChange={() => setSelected(allChecked ? selected.filter((id) => !pageIds.includes(id)) : [...new Set([...selected, ...pageIds])])}
              />
              Select page
            </label>
            <button type="button" onClick={markSelected} disabled={busy} className={cn(tbtn, !selected.length && "opacity-50")}>Mark selected as read{selTxt}</button>
            {selected.length > 0 && (
              <button type="button" onClick={deleteSelected} disabled={busy} className={cn(tbtn, "text-dash-danger-fg")}>Delete selected{selTxt}</button>
            )}
            <label className="ml-auto flex items-center gap-1.5 text-[13px] font-semibold">
              Status
              <select value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); setSelected([]) }} className={select}>
                <option value="all">All status</option>
                <option value="unread">Unread only</option>
                <option value="read">Read only</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-[13px] font-semibold">
              Sort
              <select value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1) }} className={select}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-dash-muted">
              <strong className="mb-1 block text-dash-ink">{totalAll === 0 && status === "all" ? "You’re all caught up." : "No notifications found."}</strong>
              {totalAll === 0 && status === "all" ? "New orders, stock alerts and payment reminders will show up here." : "Try adjusting your filters."}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.day}>
                <div className="border-b border-dash-border-soft bg-dash-bg px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-dash-muted">{g.day}</div>
                {g.rows.map((n) => {
                  const unread = !n.readAt
                  const t = TYPE_META[n.type] ?? TYPE_META.system
                  const Icon = n.data && "adjustmentNo" in n.data ? SlidersHorizontal : t.icon
                  const pri = PRIORITY[n.priority]
                  return (
                    <div key={n.id} className={cn("flex items-start gap-3 border-b border-dash-border-soft px-5 py-3", unread ? "bg-dash-accent-soft/40" : "bg-dash-card")}>
                      <input
                        type="checkbox" className="mt-2.5 size-[18px] flex-none" checked={selected.includes(n.id)}
                        aria-label={`Select notification ${n.title}`}
                        onChange={() => setSelected((s) => (s.includes(n.id) ? s.filter((x) => x !== n.id) : [...s, n.id]))}
                      />
                      <span className={cn("flex size-9 flex-none items-center justify-center rounded-[10px]", t.tint)}><Icon className="size-[18px]" aria-hidden /></span>
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={cn("text-sm", unread ? "font-bold" : "font-medium")}>{n.title}</span>
                        <span className="text-[13px] text-dash-muted">{n.message}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-dash-muted">
                          <span className={cn("rounded-full px-2 py-px font-bold", t.tint)}>{t.label}</span>
                          {pri && <span className={cn("rounded-full px-2 py-px font-bold", pri.cls)}>{pri.label}</span>}
                          {rel(n.createdAt)}
                          {n.actionUrl && (
                            <Link href={n.actionUrl} onClick={() => open(n)} className="font-semibold text-dash-accent hover:underline">{ctaFor(n.actionUrl)} →</Link>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {unread ? (
                          <button type="button" title="Mark as read" aria-label="Mark as read" disabled={busy} onClick={() => void act(() => notificationApi.markAsRead(n.id))} className="flex size-7 items-center justify-center rounded-full">
                            <span className="size-2.5 rounded-full bg-dash-accent" />
                          </button>
                        ) : (
                          <button type="button" title="Mark as unread" aria-label="Mark as unread" disabled={busy} onClick={() => void act(() => notificationApi.markAsUnread(n.id))} className="flex size-7 items-center justify-center rounded-full">
                            <span className="size-2.5 rounded-full border-2 border-dash-border" />
                          </button>
                        )}
                        <button type="button" title="Delete" aria-label="Delete notification" disabled={busy} onClick={() => void act(() => notificationApi.delete(n.id))} className="flex size-7 items-center justify-center rounded-lg text-dash-muted hover:text-dash-danger-fg">
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}

          {meta.total > 0 && (
            <div className="border-t border-dash-border-soft p-4">
              <PaginationControl
                currentPage={page} totalPages={Math.max(1, meta.lastPage)} totalItems={meta.total} itemsPerPage={perPage}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
              />
            </div>
          )}
        </section>
        </div>

        <aside className="flex w-full flex-col gap-4 xl:w-[340px] xl:flex-none">
          <section className={cn(card, "flex flex-col gap-3 p-5")}>
            <h2 className="font-dash-display text-lg font-bold">Needs your attention</h2>
            {todo === null ? (
              <div className="flex flex-col gap-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>
            ) : todo.length === 0 ? (
              <p className="text-[13px] text-dash-muted">Nothing needs your attention right now.</p>
            ) : (
              todo.map((t) => (
                <Link key={t.label} href={t.href} className={cn("flex items-center gap-3 rounded-[10px] px-3 py-2.5", t.cls)}>
                  <strong className="min-w-8 text-lg">{t.n}</strong>
                  <span className="flex-1 text-[13px] font-semibold">{t.label}</span>
                  <span aria-hidden>→</span>
                </Link>
              ))
            )}
          </section>

          <section className={cn(card, "flex flex-col gap-2.5 p-5")}>
            <h2 className="flex items-center gap-2 font-dash-display text-lg font-bold"><Smartphone className="size-[18px]" aria-hidden />Get these on your phone</h2>
            <p className="text-[13px] leading-relaxed text-dash-muted">Turn on SMS or app alerts for new orders and low stock so you don’t have to keep this page open.</p>
            <Link href="/dashboard/settings/notifications" className="flex h-11 items-center justify-center rounded-[10px] bg-dash-accent text-sm font-semibold text-white">Choose alerts</Link>
          </section>
        </aside>
      </div>
      {busy && <Loader2 className="sr-only" aria-hidden />}
    </div>
  )
}
