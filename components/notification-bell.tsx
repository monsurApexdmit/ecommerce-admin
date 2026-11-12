"use client"

import { cn } from "@/lib/utils"
import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Bell, Trash2, ExternalLink } from "lucide-react"
import { useNotifications } from "@/contexts/notification-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/common/EmptyState"
import { WithTooltip } from "@/components/common/WithTooltip"

const TYPE_KEYS = {
  order: "ui:notifications.types.order",
  stock_alert: "ui:notifications.types.stock_alert",
  payment: "ui:notifications.types.payment",
  system: "ui:notifications.types.system",
  support: "ui:notifications.types.support",
  review: "ui:notifications.types.review",
} as const

export function NotificationBell() {
  const { t } = useTranslation(["ui", "common"])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications()
  const router = useRouter()

  const recent = notifications.slice(0, 5)

  const typeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    order: 'default',
    stock_alert: 'destructive',
    payment: 'secondary',
    system: 'outline',
    support: 'secondary',
    review: 'secondary',
  }
  const typeLabel = (type: string) =>
    Object.prototype.hasOwnProperty.call(TYPE_KEYS, type) ? t(TYPE_KEYS[type as keyof typeof TYPE_KEYS]) : type

  function getRelativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t("common:ago.justNow")
    if (mins < 60) return t("ui:notifications.minutesShort", { count: mins })
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return t("ui:notifications.hoursShort", { count: hrs })
    return t("ui:notifications.daysShort", { count: Math.floor(hrs / 24) })
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
      <WithTooltip content={t("ui:notifications.unreadLabel", { count: unreadCount })}><Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("ui:notifications.unreadLabel", { count: unreadCount })}
        aria-expanded={open}
        className="relative"
      >
        <Bell className="size-5" strokeWidth={2} aria-hidden />
        {unreadCount > 0 && (
          <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button></WithTooltip>

      {open && (
        <Card
          role="dialog"
          aria-label={t("ui:notifications.title")}
          className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-1.5rem))] gap-0 overflow-hidden py-0 shadow-xl"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <strong className="text-sm">{t("ui:notifications.title")}</strong>
            <span className="flex items-center gap-3">
              {unreadCount > 0 && (
                <Button type="button" variant="link" size="sm" onClick={() => void markAllAsRead()}>
                  {t("ui:notifications.markAllRead")}
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{unreadCount ? t("ui:notifications.unread", { count: unreadCount }) : t("ui:notifications.allCaughtUp")}</span>
            </span>
          </div>
          <Separator />
          <div className="max-h-96 divide-y divide-border overflow-y-auto">
            {recent.length === 0 ? (
              <EmptyState icon={Bell} title={t("ui:notifications.empty")} className="p-6 md:p-6" />
            ) : recent.map((n) => (
              <div
                key={n.id}
                className={cn("group flex items-start gap-3 p-3 transition-colors hover:bg-muted/60", !n.readAt ? "bg-brand-soft" : "")}
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", !n.readAt ? "bg-brand" : "bg-transparent")} aria-hidden />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void handleNotificationClick(n.id, n.actionUrl)}
                  className="h-auto min-w-0 flex-1 items-start justify-start gap-3 whitespace-normal p-0 text-left font-normal hover:bg-transparent"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm leading-snug">{n.message}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant={typeVariant[n.type] ?? "outline"}>
                        {typeLabel(n.type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{getRelativeTime(n.createdAt)}</span>
                      {n.actionUrl && (
                        <ExternalLink className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                      )}
                    </div>
                  </div>
                </Button>
                <WithTooltip content={t("ui:notifications.delete")}><Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("ui:notifications.delete")}
                  onClick={(e) => { e.stopPropagation(); void deleteNotification(n.id) }}
                  className="shrink-0"
                >
                  <Trash2 className="size-3.5" />
                </Button></WithTooltip>
              </div>
            ))}
          </div>
          <Separator />
          <Button asChild variant="ghost" className="h-auto w-full rounded-none p-3">
            <Link href="/dashboard/notifications" onClick={() => setOpen(false)}>
              {t("ui:notifications.showAll")}
            </Link>
          </Button>
        </Card>
      )}
    </div>
  )
}
