"use client"

import type React from "react"
import { Suspense } from "react"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { StaffProvider } from "@/contexts/staff-context"
import { VendorProvider } from "@/contexts/vendor-context"
import { ProductProvider } from "@/contexts/product-context"
import { AttributeProvider } from "@/contexts/attribute-context"
import { WarehouseProvider } from "@/contexts/warehouse-context"
import { TransferProvider } from "@/contexts/transfer-context"
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,

  ShoppingBag,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Globe,
  Store,
  FileText,
  Grid3x3,
  Trash2,
  CreditCard,
  ShieldCheck,
  Truck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Image from "next/image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    name: "Catalog",
    icon: Grid3x3,
    submenu: [
      { name: "Products", href: "/dashboard/products" },
      { name: "Categories", href: "/dashboard/categories" },
      { name: "Attributes", href: "/dashboard/attributes" },
      { name: "Coupons", href: "/dashboard/coupons" },
    ],
  },
  { name: "Customers", href: "/dashboard/customers", icon: Users },
  { name: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
  { name: "Vendors", href: "/dashboard/vendors", icon: Truck },
  { name: "POS", href: "/dashboard/pos", icon: CreditCard },
  {
    name: "Inventory",
    icon: Store,
    submenu: [
      { name: "Stock Overview", href: "/dashboard/inventory" },
      { name: "Transfers", href: "/dashboard/inventory/transfer" },
    ],
  },
  { name: "Sells", href: "/dashboard/sells", icon: ShoppingBag },
  {
    name: "Staff",
    icon: UserPlus,
    submenu: [
      { name: "All Staff", href: "/dashboard/staff" },
      { name: "Role & Permission", href: "/dashboard/staff/roles" },
      { name: "Salary Management", href: "/dashboard/staff/salary" },
    ],
  },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
  { name: "International", href: "/dashboard/international", icon: Globe, hasArrow: true },
  { name: "Online Store", href: "/dashboard/store", icon: Store, hasArrow: true },
  { name: "Pages", href: "/dashboard/pages", icon: FileText, hasArrow: true },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const { logout, userEmail } = useAuth()

  const notifications = [
    {
      id: 1,
      user: "Nevil Nevil",
      amount: 121.56,
      avatar: "/admin-avatar.jpg",
      time: "26 Dec, 2025 10:57 AM",
    },
    {
      id: 2,
      user: "TEJPAL SONI",
      amount: 166.49,
      avatar: "/marion-avatar.jpg",
      time: "25 Dec, 2025 1:17 PM",
    },
    {
      id: 3,
      user: "Nevil Nevil",
      amount: 660.0,
      avatar: "/admin-avatar.jpg",
      time: "25 Dec, 2025 12:26 PM",
    },
    {
      id: 4,
      user: "Justinn Luish",
      amount: 265.01,
      avatar: "/stacey-avatar.jpg",
      time: "23 Dec, 2025 8:37 PM",
    },
  ]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }

    if (notificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [notificationsOpen])

  const toggleSubmenu = (menuName: string) => {
    setExpandedMenu(expandedMenu === menuName ? null : menuName)
  }

  const handleDeleteNotification = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    console.log("Delete notification:", id)
  }

  return (
    <VendorProvider>
      <AttributeProvider>
        <WarehouseProvider>
          <TransferProvider>
          <ProductProvider>
          <StaffProvider>
            <Suspense fallback={null}>
              <div className="min-h-screen bg-gray-50">
                {sidebarOpen && (
                  <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="fixed inset-0 bg-gray-900/50" onClick={() => setSidebarOpen(false)} />
                    <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl">
                      <div className="flex h-full flex-col">
                        <div className="flex items-center justify-between p-4 border-b">
                          <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                              <ShieldCheck className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-lg">ADMIN</span>
                          </Link>
                          <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-gray-700">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                          {navigation.map((item) => {
                            if (item.submenu) {
                              const isExpanded = expandedMenu === item.name
                              const isAnySubmenuActive = item.submenu.some((sub) => pathname === sub.href)
                              return (
                                <div key={item.name}>
                                  <button
                                    onClick={() => toggleSubmenu(item.name)}
                                    className={cn(
                                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                      isAnySubmenuActive
                                        ? "text-gray-900"
                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      <item.icon className="w-5 h-5" />
                                      {item.name}
                                    </div>
                                    <ChevronDown
                                      className={cn("w-4 h-4 transition-transform", isExpanded ? "rotate-180" : "")}
                                    />
                                  </button>
                                  {isExpanded && (
                                    <div className="mt-1 ml-8 space-y-1">
                                      {item.submenu.map((subItem) => {
                                        const isActive = pathname === subItem.href
                                        return (
                                          <Link
                                            key={subItem.name}
                                            href={subItem.href}
                                            onClick={() => setSidebarOpen(false)}
                                            className={cn(
                                              "block px-3 py-2 rounded-lg text-sm transition-colors",
                                              isActive ? "text-emerald-700 font-medium" : "text-gray-600 hover:text-gray-900",
                                            )}
                                          >
                                            {subItem.name}
                                          </Link>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            }

                            const isActive = pathname === item.href
                            return (
                              <Link
                                key={item.name}
                                href={item.href!}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                  "flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                  isActive
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <item.icon className="w-5 h-5" />
                                  {item.name}
                                </div>
                                {item.hasArrow && <ChevronRight className="w-4 h-4" />}
                              </Link>
                            )
                          })}
                        </nav>
                      </div>
                    </div>
                  </div>
                )}

                <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
                  <div className="flex flex-col flex-1 bg-white border-r">
                    <div className="flex items-center gap-2 p-6 border-b">
                      <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-bold text-xl">ADMIN</span>
                    </div>
                    <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                      {navigation.map((item) => {
                        if (item.submenu) {
                          const isExpanded = expandedMenu === item.name
                          const isAnySubmenuActive = item.submenu.some((sub) => pathname === sub.href)
                          return (
                            <div key={item.name}>
                              <button
                                onClick={() => toggleSubmenu(item.name)}
                                className={cn(
                                  "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                  isAnySubmenuActive ? "text-gray-900" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <item.icon className="w-5 h-5" />
                                  {item.name}
                                </div>
                                <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded ? "rotate-180" : "")} />
                              </button>
                              {isExpanded && (
                                <div className="mt-1 ml-8 space-y-1">
                                  {item.submenu.map((subItem) => {
                                    const isActive = pathname === subItem.href
                                    return (
                                      <Link
                                        key={subItem.name}
                                        href={subItem.href}
                                        className={cn(
                                          "block px-3 py-2 rounded-lg text-sm transition-colors",
                                          isActive ? "text-emerald-700 font-medium" : "text-gray-600 hover:text-gray-900",
                                        )}
                                      >
                                        {subItem.name}
                                      </Link>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        }

                        const isActive = pathname === item.href
                        return (
                          <Link
                            key={item.name}
                            href={item.href!}
                            className={cn(
                              "flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                              isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon className="w-5 h-5" />
                              {item.name}
                            </div>
                            {item.hasArrow && <ChevronRight className="w-4 h-4" />}
                          </Link>
                        )
                      })}

                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-red-600 hover:bg-red-50 hover:text-red-700 mt-4"
                      >
                        <LogOut className="w-5 h-5" />
                        Log out
                      </button>
                    </nav>
                  </div>
                </div>

                <div className="lg:pl-64">
                  <header className="sticky top-0 z-40 bg-white border-b">
                    <div className="flex items-center justify-between px-4 py-3 lg:px-8">
                      <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700">
                        <Menu className="w-6 h-6" />
                      </button>



                      <div className="flex items-center gap-4 ml-auto">
                        <div className="relative" ref={notificationRef}>
                          <button
                            onClick={() => setNotificationsOpen(!notificationsOpen)}
                            className="relative text-gray-500 hover:text-gray-700"
                          >
                            <Bell className="w-6 h-6" />
                            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-medium">
                              26
                            </span>
                          </button>

                          {notificationsOpen && (
                            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border overflow-hidden">
                              <div className="max-h-96 overflow-y-auto">
                                {notifications.map((notification) => (
                                  <div
                                    key={notification.id}
                                    className="flex items-start gap-3 p-4 hover:bg-gray-50 border-b last:border-b-0"
                                  >
                                    <Image
                                      src={notification.avatar || "/placeholder.svg"}
                                      alt={notification.user}
                                      width={40}
                                      height={40}
                                      className="rounded-full"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-gray-900 mb-1">
                                        <span className="font-medium">{notification.user}</span> placed an order of{" "}
                                        {notification.amount.toFixed(2)}!
                                      </p>
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500 text-white">
                                          New Order
                                        </span>
                                        <span className="text-xs text-gray-500">{notification.time}</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => handleDeleteNotification(notification.id, e)}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <Link
                                href="/dashboard/notifications"
                                onClick={() => setNotificationsOpen(false)}
                                className="block p-3 text-center text-sm font-medium text-emerald-600 hover:bg-gray-50 border-t"
                              >
                                Show all notifications
                              </Link>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 pl-4 border-l">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center gap-3 hover:bg-gray-50 p-2 rounded-lg transition-colors outline-none">
                                <div className="hidden sm:block text-right">
                                  <p className="text-sm font-medium text-gray-900">Admin User</p>
                                  <p className="text-xs text-gray-500">{userEmail}</p>
                                </div>
                                <Avatar>
                                  <AvatarImage src="/admin-avatar.jpg" alt="Admin" />
                                  <AvatarFallback className="bg-emerald-100 text-emerald-700">AD</AvatarFallback>
                                </Avatar>
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>My Account</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link href="/dashboard" className="cursor-pointer">
                                  <LayoutDashboard className="mr-2 h-4 w-4" />
                                  <span>Dashboard</span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href="/dashboard/edit-profile" className="cursor-pointer">
                                  <Settings className="mr-2 h-4 w-4" />
                                  <span>Edit Profile</span>
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={logout} className="text-red-600 cursor-pointer focus:text-red-600">
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Log out</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </header>

                  <main className="p-4 lg:p-8">{children}</main>
                </div>
              </div>
            </Suspense>
          </StaffProvider>
          </ProductProvider>
          </TransferProvider>
        </WarehouseProvider>
      </AttributeProvider>
    </VendorProvider>
  )
}
