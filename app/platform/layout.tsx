"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { UserAvatar } from "@/components/common/UserAvatar"
import {
  LayoutDashboard, Building2, CreditCard, LogOut, Zap, Menu, X, ChevronRight,
} from "lucide-react"
import { WithTooltip } from "@/components/common/WithTooltip"
import { useTranslation } from "react-i18next"
import { LanguageSwitcher } from "@/components/shell/language-switcher"

const nav = [
  { href: "/platform", label: "auth:platform.nav.overview", icon: LayoutDashboard, exact: true },
  { href: "/platform/companies", label: "auth:platform.nav.companies", icon: Building2, exact: false },
  { href: "/platform/plans", label: "auth:platform.nav.plans", icon: CreditCard, exact: false },
] as const

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation(["auth", "common"])
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [adminEmail, setAdminEmail] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("token")
    const role = localStorage.getItem("userRole")
    if (!token || role !== "super_admin") {
      router.replace("/auth/login")
      return
    }
    setAdminEmail(localStorage.getItem("userEmail") || "admin")
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userEmail")
    router.push("/auth/login")
  }

  const isActive = (item: (typeof nav)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-gray-900 text-white w-64">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm">StockFlow</p>
          <p className="text-xs text-emerald-400 font-medium">{t("auth:platform.adminLabel")}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => (
          <Button
            key={item.href}
            asChild
            variant={isActive(item) ? "default" : "ghost"}
            className="w-full justify-start"
          >
            <Link href={item.href} onClick={() => setSidebarOpen(false)}>
              <item.icon className="w-4 h-4" />
              {t(item.label)}
            </Link>
          </Button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <UserAvatar className="size-7" name={adminEmail} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white font-medium truncate">{adminEmail}</p>
            <p className="text-xs text-gray-500">{t("auth:platform.superAdmin")}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start"
        >
          <LogOut className="w-3.5 h-3.5" /> {t("auth:platform.signOut")}
        </Button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-10">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar: menu + title on mobile, language picker top-right on every size */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <WithTooltip content={t("auth:platform.openMenu")}><Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)} aria-label={t("auth:platform.openMenu")}>
            <Menu className="w-5 h-5" />
          </Button></WithTooltip>
          <span className="md:hidden font-semibold text-sm truncate">{t("auth:platform.adminLabel")}</span>
          <div className="ml-auto">
            <LanguageSwitcher />
          </div>
        </div>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
