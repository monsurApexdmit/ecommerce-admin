"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, Trash2, ExternalLink } from "lucide-react"
import { useNotifications } from "@/contexts/notification-context"

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications()
  const router = useRouter()

  const recent = notifications.slice(0, 5)

  const typeColors: Record<string, string> = {
    order: 'bg-emerald-500',
    stock_alert: 'bg-orange-500',
    payment: 'bg-blue-500',
    system: 'bg-gray-500',
    support: 'bg-blue-500',
    review: 'bg-amber-500',
  }
  const typeLabels: Record<string, string> = {
    order: 'New Order',
    stock_alert: 'Stock Alert',
    payment: 'Payment',
    system: 'System',
    support: 'Support',
    review: 'Product Review',
  }

  function getRelativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const handleNotificationClick = async (id: number, actionUrl?: string | null) => {
    if (!notifications.find(notification => notification.id === id)?.readAt) {
      await markAsRead(id)
    }

    setOpen(false)

    if (actionUrl) {
      router.push(actionUrl)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={open}
        className="shell-btn relative"
      >
        <Bell className="size-5" strokeWidth={2} aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#B42318] px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <strong className="text-sm">Notifications</strong>
            <span className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button type="button" onClick={() => void markAllAsRead()} className="text-xs font-semibold text-brand-fg hover:underline">
                  Mark all read
                </button>
              )}
              <span className="text-xs text-muted-foreground">{unreadCount ? `${unreadCount} unread` : "All caught up"}</span>
            </span>
          </div>
          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {recent.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
            ) : recent.map((n) => (
              <div
                key={n.id}
                className={`group flex items-start gap-3 p-3 transition-colors hover:bg-muted/60 ${!n.readAt ? "bg-brand-soft" : ""}`}
              >
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${!n.readAt ? "bg-brand" : "bg-transparent"}`} aria-hidden />
                <button
                  type="button"
                  onClick={() => void handleNotificationClick(n.id, n.actionUrl)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm leading-snug">{n.message}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium text-white ${typeColors[n.type] ?? "bg-gray-500"}`}>
                        {typeLabels[n.type] ?? n.type}
                      </span>
                      <span className="text-xs text-muted-foreground">{getRelativeTime(n.createdAt)}</span>
                      {n.actionUrl && (
                        <ExternalLink className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                      )}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="Delete notification"
                  onClick={(e) => { e.stopPropagation(); void deleteNotification(n.id) }}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-red-600"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border p-3 text-center text-sm font-semibold text-brand-fg hover:bg-muted/60"
          >
            Show all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
