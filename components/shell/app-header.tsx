"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeft, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { WithTooltip } from "@/components/common/WithTooltip"
import { NotificationBell } from "@/components/notification-bell"
import { ThemeAccentControls } from "@/components/theme-accent-controls"
import { LanguageSwitcher } from "@/components/shell/language-switcher"
import { GlobalSearch } from "./global-search"
import { DashboardControls } from "./dashboard-controls"

const humanise = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

// Translated names for route segments (keys checked by tsc); unknown segments are title-cased from the URL
const LABELS = {
  adjustment: "nav:crumbs.adjustment",
  assignments: "nav:crumbs.assignments",
  attributes: "nav:crumbs.attributes",
  "aura-shop": "nav:crumbs.auraShop",
  barcode: "nav:crumbs.barcode",
  billing: "nav:crumbs.billing",
  "billing-contact": "nav:crumbs.billingContact",
  "blocked-access": "nav:crumbs.blockedAccess",
  brands: "nav:crumbs.brands",
  categories: "nav:crumbs.categories",
  checkout: "nav:crumbs.checkout",
  collections: "nav:crumbs.collections",
  company: "nav:crumbs.company",
  coupons: "nav:crumbs.coupons",
  customer: "nav:crumbs.customer",
  customers: "nav:crumbs.customers",
  dorjis: "nav:crumbs.dorjis",
  dues: "nav:crumbs.dues",
  edit: "nav:crumbs.edit",
  "edit-profile": "nav:crumbs.editProfile",
  expenses: "nav:crumbs.expenses",
  fabrics: "nav:crumbs.fabrics",
  finance: "nav:crumbs.finance",
  international: "nav:crumbs.international",
  inventory: "nav:crumbs.inventory",
  links: "nav:crumbs.links",
  locations: "nav:crumbs.locations",
  marketing: "nav:crumbs.marketing",
  measurements: "nav:crumbs.measurements",
  new: "nav:crumbs.new",
  notifications: "nav:crumbs.notifications",
  orders: "nav:crumbs.orders",
  overview: "nav:crumbs.overview",
  pages: "nav:crumbs.pages",
  "payment-methods": "nav:crumbs.paymentMethods",
  payments: "nav:crumbs.payments",
  payouts: "nav:crumbs.payouts",
  plans: "nav:crumbs.plans",
  pos: "nav:crumbs.pos",
  "print-barcode": "nav:crumbs.printBarcode",
  products: "nav:crumbs.products",
  profile: "nav:crumbs.profile",
  "purchase-orders": "nav:crumbs.purchaseOrders",
  receivables: "nav:crumbs.receivables",
  reports: "nav:crumbs.reports",
  returns: "nav:crumbs.returns",
  reviews: "nav:crumbs.reviews",
  roles: "nav:crumbs.roles",
  salary: "nav:crumbs.salary",
  sales: "nav:crumbs.sales",
  sells: "nav:crumbs.sells",
  "serial-batch": "nav:crumbs.serialBatch",
  settings: "nav:crumbs.settings",
  shipments: "nav:crumbs.shipments",
  "shipping-addresses": "nav:crumbs.shippingAddresses",
  "shipping-methods": "nav:crumbs.shippingMethods",
  staff: "nav:crumbs.staff",
  store: "nav:crumbs.store",
  subscriptions: "nav:crumbs.subscriptions",
  success: "nav:crumbs.success",
  support: "nav:crumbs.support",
  tailor: "nav:crumbs.tailor",
  team: "nav:crumbs.team",
  transactions: "nav:crumbs.transactions",
  transfer: "nav:crumbs.transfer",
  units: "nav:crumbs.units",
  users: "nav:crumbs.users",
  vendor: "nav:crumbs.vendor",
  vendors: "nav:crumbs.vendors",
  wishlist: "nav:crumbs.wishlist",
} as const

const isKnownSegment = (s: string): s is keyof typeof LABELS => Object.prototype.hasOwnProperty.call(LABELS, s)

/** Home / Section / Page, derived from the URL. Numeric ids read as "Details". */
function Breadcrumbs() {
  const { t } = useTranslation(["nav", "common"])
  const pathname = usePathname() ?? ""
  const segments = pathname.split("/").filter(Boolean).filter((s) => s !== "dashboard")
  const crumbs = segments.map((s) =>
    /^\d+$/.test(s) ? t("nav:breadcrumb.details") : isKnownSegment(s) ? t(LABELS[s]) : humanise(s),
  )

  return (
    <nav aria-label={t("nav:breadcrumb.label")} className="hidden min-w-0 items-center gap-1.5 text-sm lg:flex">
      <Link href="/dashboard" className="text-muted-foreground transition-colors hover:text-foreground">
        {t("nav:breadcrumb.home")}
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
  const { t } = useTranslation(["nav", "common"])
  const { toggleSidebar, state, isMobile } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile
  const label = collapsed ? t("nav:header.expandSidebar") : t("nav:header.collapseSidebar")
  const onDashboard = usePathname() === "/dashboard"

  return (
    <header className="app-header sticky top-0 z-20 flex min-h-[68px] shrink-0 flex-wrap items-center gap-3 px-4 py-2 lg:px-8">
      <WithTooltip content={t("nav:header.toggleHint", { label })}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={toggleSidebar}
          aria-label={label}
        >
          <PanelLeft className="size-5" strokeWidth={1.8} aria-hidden />
        </Button>
      </WithTooltip>

      {!onDashboard && <Breadcrumbs />}

      {/* On the dashboard the search stretches (as in the design) and the range + location live here */}
      {onDashboard && <GlobalSearch variant="bar" className="hidden min-w-[220px] flex-1 md:flex" />}

      <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2.5">
        {!onDashboard && <GlobalSearch variant="bar" className="hidden w-[min(34vw,380px)] md:flex" />}
        <GlobalSearch variant="icon" className="md:hidden" />
        {onDashboard && <DashboardControls />}
        <LanguageSwitcher />
        <ThemeAccentControls />
        <NotificationBell />
        <Button asChild>
          <Link href="/dashboard/sales?new=1" aria-label={t("nav:header.newSale")}>
            <Plus className="size-4" strokeWidth={2.4} aria-hidden />
            <span className="hidden sm:inline">{t("nav:header.newSale")}</span>
          </Link>
        </Button>
      </div>
    </header>
  )
}
