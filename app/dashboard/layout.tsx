"use client"

import type React from "react"
import { Suspense } from "react"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { StaffProvider } from "@/contexts/staff-context"
import { VendorProvider } from "@/contexts/vendor-context"
import { ProductProvider } from "@/contexts/product-context"
import { AttributeProvider } from "@/contexts/attribute-context"
import { WarehouseProvider } from "@/contexts/warehouse-context"
import { TransferProvider } from "@/contexts/transfer-context"
import { CustomerReturnProvider } from "@/contexts/customer-return-context"
import { VendorReturnProvider } from "@/contexts/vendor-return-context"
import { CustomerProvider } from "@/contexts/customer-context"
import { CategoryProvider } from "@/contexts/category-context"
import { ShippingAddressProvider } from "@/contexts/shipping-address-context"
import { ShipmentProvider } from "@/contexts/shipment-context"
import { OrderProvider } from "@/contexts/order-context"
import { NotificationProvider, useNotifications } from "@/contexts/notification-context"
import {
  Bell,
  Trash2,
  ExternalLink,
} from "lucide-react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { CustomerSupportMessenger } from "@/components/customer-support-messenger"
import { ThemeAccentControls } from "@/components/theme-accent-controls"
import { CompanySettingsProvider } from "@/contexts/company-settings-context"


function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markAsRead, deleteNotification } = useNotifications()
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
        onClick={() => setOpen(v => !v)}
        className="relative text-gray-500 hover:text-gray-700"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border overflow-hidden z-50">
          <div className="px-4 py-2.5 border-b bg-gray-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs text-gray-500">{unreadCount} unread</span>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y">
            {recent.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">No notifications</div>
            ) : recent.map((n) => (
              <div
                key={n.id}
                className={`group flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors ${!n.readAt ? 'bg-emerald-50/40' : ''}`}
              >
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!n.readAt ? 'bg-emerald-500' : 'bg-transparent'}`} />
                <button
                  type="button"
                  onClick={() => void handleNotificationClick(n.id, n.actionUrl)}
                  className="flex flex-1 items-start gap-3 min-w-0 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 leading-snug line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium text-white ${typeColors[n.type] ?? 'bg-gray-500'}`}>
                        {typeLabels[n.type] ?? n.type}
                      </span>
                      <span className="text-xs text-gray-400">{getRelativeTime(n.createdAt)}</span>
                      {n.actionUrl && (
                        <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); void deleteNotification(n.id) }}
                  className="text-red-400 hover:text-red-600 shrink-0 mt-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Link
            href="/dashboard/notifications"
            onClick={() => setOpen(false)}
            className="block p-3 text-center text-sm font-medium text-emerald-600 hover:bg-gray-50 border-t"
          >
            Show all notifications
          </Link>
        </div>
      )}
    </div>
  )
}

// Derives a breadcrumb from the current path: home / current page (bolded).
// Skips the leading "dashboard" segment and humanises the last one.
function Breadcrumbs() {
  const pathname = usePathname()
  const segments = (pathname || "").split("/").filter(Boolean).filter((s) => s !== "dashboard")
  const current = segments[segments.length - 1]

  const humanise = (s: string) =>
    s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link href="/dashboard" className="text-muted-foreground transition-colors hover:text-foreground">
        Home
      </Link>
      {current && (
        <>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium text-foreground" aria-current="page">
            {humanise(current)}
          </span>
        </>
      )}
    </nav>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanySettingsProvider>
    <NotificationProvider>
    <VendorProvider>
      <CategoryProvider>
        <AttributeProvider>
          <WarehouseProvider>
            <TransferProvider>
              <ProductProvider>
                <StaffProvider>
                  <CustomerReturnProvider>
                      <CustomerProvider>
                        <VendorReturnProvider>
                          <ShippingAddressProvider>
                            <ShipmentProvider>
                              <OrderProvider>
                          <Suspense fallback={null}>
                      <SidebarProvider>
                        <AppSidebar />
                        <SidebarInset>
                          {/* Slim top bar: collapse toggle + breadcrumb (left), bell (right).
                              Trial banner and profile moved into the sidebar. */}
                          <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-white px-4 dark:bg-background">
                            <SidebarTrigger className="-ml-1" />
                            <Breadcrumbs />
                            <div className="ml-auto flex items-center gap-1">
                              <ThemeAccentControls />
                              <NotificationBell />
                            </div>
                          </header>
                          <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-muted/30 dark:bg-background">
                            <div className="flex-1 min-h-0 overflow-auto p-4 lg:p-8 has-[[data-pos-page]]:p-0 has-[[data-pos-page]]:overflow-hidden">
                              {children}
                            </div>
                          </main>
                        </SidebarInset>
                      </SidebarProvider>
                        </Suspense>
                        <Toaster />
                        <SonnerToaster position="top-right" richColors />
                        <CustomerSupportMessenger />
                              </OrderProvider>
                            </ShipmentProvider>
                          </ShippingAddressProvider>
                        </VendorReturnProvider>
                      </CustomerProvider>
                  </CustomerReturnProvider>
                </StaffProvider>
              </ProductProvider>
            </TransferProvider>
          </WarehouseProvider>
        </AttributeProvider>
      </CategoryProvider>
    </VendorProvider>
    </NotificationProvider>
    </CompanySettingsProvider>
  )
}
