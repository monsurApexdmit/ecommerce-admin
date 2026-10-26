"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeft, Plus } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"
import { NotificationBell } from "@/components/notification-bell"
import { ThemeAccentControls } from "@/components/theme-accent-controls"
import { GlobalSearch } from "./global-search"
import { DashboardControls } from "./dashboard-controls"

const humanise = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

// Readable names for route segments that don't title-case well
const LABELS: Record<string, string> = {
  pos: "POS",
  vendors: "Suppliers",
  "serial-batch": "Serial & Batch",
  edit: "Edit",
  new: "New",
}

/** Home / Section / Page, derived from the URL. Numeric ids read as "Details". */
function Breadcrumbs() {
  const pathname = usePathname() ?? ""
  const segments = pathname.split("/").filter(Boolean).filter((s) => s !== "dashboard")
  const crumbs = segments.map((s) => (/^\d+$/.test(s) ? "Details" : LABELS[s] ?? humanise(s)))

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
      <Link href="/dashboard" className="text-muted-foreground transition-colors hover:text-foreground">
        Home
      </Link>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={`${c}-${i}`} className="flex min-w-0 items-center gap-1.5">
            <span className="text-muted-foreground/50" aria-hidden>/</span>
            <span
              className={last ? "truncate font-semibold text-foreground" : "truncate text-muted-foreground"}
              aria-current={last ? "page" : undefined}
            >
              {c}
            </span>
          </span>
        )
      })}
    </nav>
  )
}

/**
 * Global header: sidebar toggle, breadcrumb, search (Ctrl K), theme toggle,
 * notifications and the primary "New sale" action.
 */
export function AppHeader() {
  const { toggleSidebar, state, isMobile } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar"
  const onDashboard = usePathname() === "/dashboard"

  return (
    <header className="app-header sticky top-0 z-20 flex min-h-[68px] shrink-0 flex-wrap items-center gap-3 px-4 py-2 lg:px-8">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={label}
        title={`${label} (Ctrl+B)`}
        className="shell-btn"
      >
        <PanelLeft className="size-5" strokeWidth={1.8} aria-hidden />
      </button>

      {!onDashboard && <Breadcrumbs />}

      {/* On the dashboard the search stretches (as in the design) and the range + location live here */}
      {onDashboard && <GlobalSearch variant="bar" className="hidden min-w-[220px] flex-1 md:flex" />}

      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2.5">
        {!onDashboard && <GlobalSearch variant="bar" className="hidden w-[min(34vw,380px)] md:flex" />}
        <GlobalSearch variant="icon" className="md:hidden" />
        {onDashboard && <DashboardControls />}
        <ThemeAccentControls />
        <NotificationBell />
        <Link href="/dashboard/sales?new=1" className="brand-btn">
          <Plus className="size-4" strokeWidth={2.4} aria-hidden />
          <span className="hidden sm:inline">New sale</span>
        </Link>
      </div>
    </header>
  )
}
