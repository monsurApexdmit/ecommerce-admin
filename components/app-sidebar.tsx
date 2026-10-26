"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    ShoppingCart,
    Users,
    Settings,
    LogOut,
    CreditCard,
    Truck,
    Store,
    Grid3x3,
    UserPlus,
    FileText,
    Box,
    ChevronRight,
    RotateCcw,
    Package,
    Bell,
    Headphones,
    Scissors,
    Receipt,
    Wallet,
    BarChart3,
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SectionTitle } from "@/components/common/SectionTitle"
import { WithTooltip } from "@/components/common/WithTooltip"
import { useAuth } from "@/contexts/auth-context"
import { useNotifications } from "@/contexts/notification-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { TrialCard } from "@/components/trial-card"
import { useNavBadges } from "@/hooks/use-nav-badges"
import { cn } from "@/lib/utils"

// Each item declares which permission module controls its visibility.
// Sections group the nav into scannable blocks; order here is the render order.
const SECTIONS = ["Overview", "Sell", "Catalog", "Operations", "Finance", "Workspace"] as const

const NAV_CONFIG = [
    { section: "Overview", name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "Dashboard" },

    { section: "Sell", name: "POS",       href: "/dashboard/pos",       icon: CreditCard, module: "POS" },
    { section: "Sell", name: "Sales",     href: "/dashboard/sales",     icon: Receipt,    module: "Orders" },
    {
        section: "Sell",
        name: "Orders",
        icon: ShoppingCart,
        items: [
            { name: "All orders", href: "/dashboard/orders",           module: "Orders" },
            { name: "Shipments",  href: "/dashboard/orders/shipments", module: "Shipments" },
        ],
    },
    { section: "Sell", name: "Customers", href: "/dashboard/customers", icon: Users, module: "Customers" },

    {
        section: "Catalog",
        name: "Catalog",
        icon: Grid3x3,
        items: [
            { name: "Products",      href: "/dashboard/products",               module: "Products" },
            { name: "Categories",    href: "/dashboard/categories",             module: "Categories" },
            { name: "Units",         href: "/dashboard/units",                  module: "Units" },
            { name: "Brands",        href: "/dashboard/brands",                 module: "Brands" },
            { name: "Attributes",    href: "/dashboard/attributes",             module: "Attributes" },
            { name: "Coupons",       href: "/dashboard/coupons",                module: "Coupons" },
            { name: "Print barcode", href: "/dashboard/products/print-barcode", module: "Print Barcode" },
        ],
    },

    {
        section: "Operations",
        name: "Suppliers",
        icon: Truck,
        items: [
            { name: "All suppliers",    href: "/dashboard/vendors",                  module: "Vendors" },
            { name: "Purchase orders",  href: "/dashboard/vendors/purchase-orders",  module: "Vendors" },
        ],
    },
    {
        section: "Operations",
        name: "Inventory",
        icon: Package,
        items: [
            { name: "Stock overview",   href: "/dashboard/inventory",               module: "Inventory" },
            { name: "Transfers",        href: "/dashboard/inventory/transfer",      module: "Transfers" },
            { name: "Stock adjustment", href: "/dashboard/inventory/adjustment",    module: "Inventory" },
            { name: "Serial & batch",   href: "/dashboard/inventory/serial-batch",  module: "Inventory" },
        ],
    },
    {
        section: "Operations",
        name: "Returns",
        icon: RotateCcw,
        items: [
            { name: "Customer returns", href: "/dashboard/returns/customer", module: "Customer Returns" },
            { name: "Supplier returns", href: "/dashboard/returns/vendor",   module: "Vendor Returns" },
        ],
    },
    {
        section: "Operations",
        name: "Tailor shop",
        icon: Scissors,
        items: [
            { name: "Dashboard",    href: "/dashboard/tailor",              module: "TailorDashboard" },
            { name: "Orders",       href: "/dashboard/tailor/orders",       module: "TailorOrders" },
            { name: "Fabrics",      href: "/dashboard/tailor/fabrics",      module: "TailorFabrics" },
            { name: "Measurements", href: "/dashboard/tailor/measurements", module: "TailorMeasurements" },
            { name: "Dorjis",       href: "/dashboard/tailor/dorjis",       module: "TailorDorji" },
            { name: "Assignments",  href: "/dashboard/tailor/assignments",  module: "TailorOrders" },
            { name: "Payments",     href: "/dashboard/tailor/payments",     module: "TailorPayments" },
            { name: "Reports",      href: "/dashboard/tailor/reports",      module: "TailorReports" },
        ],
    },

    {
        section: "Finance",
        name: "Expenses",
        icon: Wallet,
        items: [
            { name: "All expenses",   href: "/dashboard/expenses",            module: "Expenses" },
            { name: "Categories",     href: "/dashboard/expenses/categories", module: "Expenses" },
            { name: "Customer dues",  href: "/dashboard/dues/customers",      module: "Dues" },
            { name: "Vendor dues",    href: "/dashboard/dues/vendors",        module: "Dues" },
        ],
    },
    { section: "Finance", name: "Reports", href: "/dashboard/reports", icon: BarChart3, module: "Reports" },

    {
        section: "Workspace",
        name: "Staff",
        icon: UserPlus,
        items: [
            { name: "All staff",         href: "/dashboard/staff",        module: "Staff" },
            { name: "Role & permission", href: "/dashboard/staff/roles",  module: "Role & Permission" },
            { name: "Salary management", href: "/dashboard/staff/salary", module: "Salary Management" },
        ],
    },
    {
        section: "Workspace",
        name: "Settings",
        icon: Settings,
        items: [
            { name: "Store settings",     href: "/dashboard/settings",                  module: "Settings" },
            { name: "Aura shop",          href: "/dashboard/settings/aura-shop",        module: "Aura Shop" },
            { name: "Notifications",      href: "/dashboard/settings/notifications",    module: "Settings" },
            { name: "Company settings",   href: "/dashboard/company/settings",          module: "Company Settings" },
            { name: "Team members",       href: "/dashboard/team/users",                module: "Team Members" },
            { name: "Plan & billing",      href: "/dashboard/billing/overview",          module: "Subscriptions" },
            { name: "Subscriptions",      href: "/dashboard/billing/subscriptions",     module: "Subscriptions" },
            { name: "Billing plans",      href: "/dashboard/billing/plans",             module: "Billing Plans" },
        ],
    },
    {
        section: "Workspace",
        name: "Store",
        icon: Store,
        items: [
            { name: "Store settings",      href: "/dashboard/store",                      module: "Store" },
            { name: "Shipping methods",    href: "/dashboard/shipping-methods",           module: "Shipping Methods" },
            { name: "Payment methods",     href: "/dashboard/payment-methods",            module: "Payment Methods" },
            { name: "Shipping addresses",  href: "/dashboard/store/shipping-addresses",   module: "Shipping Addresses" },
        ],
    },
    { section: "Workspace", name: "Support", href: "/dashboard/support", icon: Headphones, module: "Support" },
    { section: "Workspace", name: "Pages",   href: "/dashboard/pages",   icon: FileText,   module: "Pages" },
] as const

type NavEntry = typeof NAV_CONFIG[number]
type NavGroup = Extract<NavEntry, { items: readonly unknown[] }>

/**
 * shadcn ghost Button re-shaped as a dark-sidebar row. `.nav-btn` (globals.css, components layer) supplies the
 * colours/active gradient; these utilities undo the Button size/hover defaults that would otherwise win over it.
 */
const NAV_BUTTON =
    "nav-btn h-auto min-h-11 justify-start gap-3 rounded-[11px] px-3 has-[>svg]:px-3 text-left hover:bg-white/[.07] hover:text-white dark:hover:bg-white/[.07] focus-visible:ring-[var(--brand-ring)]"

/** True when `href` is the current page or a parent of it (detail pages keep their menu lit). */
const matches = (pathname: string, href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`))

/** The child whose href is the longest match, so /products/print-barcode beats /products. */
function activeChildHref(group: NavGroup, pathname: string): string | null {
    let best: string | null = null
    for (const kid of group.items) {
        if (matches(pathname, kid.href) && (!best || kid.href.length > best.length)) best = kid.href
    }
    return best
}

/** Amber count chip styled for the dark sidebar (`.nav-badge` in globals.css). */
function NavBadge({ children }: { children: React.ReactNode }) {
    return <span className="nav-badge">{children}</span>
}


/** Icon-rail flyout: opens on hover (stays while the pointer is over trigger or panel), click pins it until outside click / Escape. */
function RailFlyout({ trigger, children }: { trigger: (p: { onClick: () => void; ref: React.Ref<HTMLButtonElement>; expanded: boolean }) => React.ReactNode; children: React.ReactNode }) {
    const [hover, setHover] = React.useState(false)
    const [pinned, setPinned] = React.useState(false)
    const [pos, setPos] = React.useState({ top: 0, left: 0 })
    const btnRef = React.useRef<HTMLButtonElement>(null)
    const wrapRef = React.useRef<HTMLDivElement>(null)
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const open = hover || pinned

    const enter = () => {
        if (timer.current) clearTimeout(timer.current)
        const r = btnRef.current?.getBoundingClientRect()
        if (r) setPos({ top: r.top, left: r.right + 6 })
        setHover(true)
    }
    const leave = () => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setHover(false), 150)
    }

    React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
    React.useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) { setPinned(false); setHover(false) }
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { setPinned(false); setHover(false); btnRef.current?.focus() }
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey)
        return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey) }
    }, [open])

    return (
        <div ref={wrapRef} onMouseEnter={enter} onMouseLeave={leave} onFocus={enter}>
            {trigger({
                ref: btnRef,
                expanded: open,
                onClick: () => {
                    const r = btnRef.current?.getBoundingClientRect()
                    if (r) setPos({ top: r.top, left: r.right + 6 })
                    setPinned((p) => !p)
                },
            })}
            {open && (
                <Card
                    role="menu"
                    style={{ position: "fixed", top: Math.max(8, Math.min(pos.top - 8, (typeof window !== "undefined" ? window.innerHeight : 800) - 320)), left: pos.left }}
                    className="z-50 w-56 gap-0 p-2 shadow-xl"
                    onClick={() => { setPinned(false); setHover(false) }}
                >
                    {children}
                </Card>
            )}
        </div>
    )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const pathname = usePathname() ?? ""
    const { logout } = useAuth()
    const { state, isMobile } = useSidebar()
    const { unreadCount } = useNotifications()
    const navBadges = useNavBadges()
    const { canRead, isPlanModule, user, company } = useSaasAuth()
    const { setOpen: setSidebarOpen } = useSidebar()
    const businessName = company?.name?.trim() || "Your business"

    // Collapsed state is remembered per user (no per-user settings store exists, so localStorage).
    const prefKey = user?.id ? `sidebar-collapsed:${user.id}` : null
    const prefLoaded = React.useRef<string | null>(null)
    React.useEffect(() => {
        if (!prefKey || isMobile || prefLoaded.current === prefKey) return
        prefLoaded.current = prefKey
        try {
            const saved = localStorage.getItem(prefKey)
            if (saved !== null) setSidebarOpen(saved !== "1")
        } catch {}
    }, [prefKey, isMobile, setSidebarOpen])
    React.useEffect(() => {
        if (!prefKey || isMobile || prefLoaded.current !== prefKey) return
        try { localStorage.setItem(prefKey, state === "collapsed" ? "1" : "0") } catch {}
    }, [state, prefKey, isMobile])

    // Icon rail only applies on desktop; the mobile sheet always shows the full menu.
    const collapsed = state === "collapsed" && !isMobile

    const [open, setOpen] = React.useState<Record<string, boolean>>({})

    const userName = user?.fullName || "Admin User"
    const userEmail = user?.email || ""
    const userRole = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : ""
    const initials = userName
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "AD"

    // A nav item is visible only when the module is BOTH in the current plan
    // (subscription tier) AND readable by the user's role (RBAC).
    const canSee = (module: string | null) =>
        module === null || (isPlanModule(module) && canRead(module))

    const visibleNav = NAV_CONFIG.map((item) => {
        if ("items" in item) {
            const visibleItems = item.items.filter((sub) => canSee(sub.module))
            if (visibleItems.length === 0) return null
            return { ...item, items: visibleItems } as unknown as NavGroup
        }
        if (!canSee(item.module)) return null
        return item
    }).filter(Boolean) as NavEntry[]

    const showNotifications = canSee("Notifications")

    /** Badge shown on a top-level row (pending orders, low stock, open tickets…). */
    const badgeFor = (name: string): number =>
        name === "Orders" ? navBadges.orders
        : name === "Inventory" ? navBadges.stock
        : name === "Staff" ? navBadges.salaryDue
        : name === "Support" ? navBadges.support
        : 0

    /** Small count chip on a sub-menu row. */
    const kidCount = (parent: string, kid: string): string => {
        if (parent === "Orders" && kid === "All orders" && navBadges.orders > 0) return String(navBadges.orders)
        if (parent === "Inventory" && kid === "Stock overview" && navBadges.stock > 0) return `${navBadges.stock} low`
        if (parent === "Staff" && kid === "Salary management" && navBadges.salaryDue > 0) return `${navBadges.salaryDue} due`
        return ""
    }

    const iconWrap = (Icon: React.ElementType, badge: number) => (
        <span className="relative flex flex-none">
            <Icon className="size-5" strokeWidth={1.8} aria-hidden />
            {collapsed && badge > 0 && <span className="nav-dot" aria-hidden />}
        </span>
    )

    const renderLeaf = (item: Extract<NavEntry, { href: string }>) => {
        const active = matches(pathname, item.href)
        const badge = badgeFor(item.name)
        return (
            <li key={item.name}>
                <WithTooltip content={collapsed ? item.name : undefined} side="right">
                    <Link
                        href={item.href}
                        aria-label={item.name}
                        data-active={active}
                        className={cn("nav-btn", collapsed && "justify-center px-0")}
                    >
                        {iconWrap(item.icon, badge)}
                        {!collapsed && <span className="flex-1 whitespace-nowrap">{item.name}</span>}
                        {!collapsed && badge > 0 && <NavBadge>{badge}</NavBadge>}
                    </Link>
                </WithTooltip>
            </li>
        )
    }

    const renderGroup = (group: NavGroup) => {
        const activeKid = activeChildHref(group, pathname)
        const parentActive = !!activeKid
        const expanded = open[group.name] ?? parentActive
        const badge = badgeFor(group.name)

        // Icon rail: the children open in a flyout menu
        if (collapsed) {
            return (
                <li key={group.name}>
                    <RailFlyout
                        trigger={({ ref, onClick, expanded }) => (
                            <Button
                                ref={ref}
                                type="button"
                                variant="ghost"
                                aria-label={group.name}
                                aria-haspopup="menu"
                                aria-expanded={expanded}
                                data-active={parentActive}
                                onClick={onClick}
                                className={cn(NAV_BUTTON, "justify-center px-0")}
                            >
                                {iconWrap(group.icon, badge)}
                            </Button>
                        )}
                    >
                        <SectionTitle as="p" className="px-2.5 pb-2 pt-1.5">{group.name}</SectionTitle>
                        {group.items.map((kid) => {
                            const count = kidCount(group.name, kid.name)
                            return (
                                <Link
                                    key={kid.name}
                                    href={kid.href}
                                    role="menuitem"
                                    className={cn(
                                        "flex min-h-10 w-full items-center justify-between rounded-lg px-2.5 text-sm outline-none hover:bg-accent focus-visible:bg-accent",
                                        kid.href === activeKid && "font-semibold text-brand-fg",
                                    )}
                                >
                                    <span>{kid.name}</span>
                                    {count && <Badge variant="secondary">{count}</Badge>}
                                </Link>
                            )
                        })}
                    </RailFlyout>
                </li>
            )
        }

        return (
            <li key={group.name}>
                <Button
                    type="button"
                    variant="ghost"
                    aria-expanded={expanded}
                    aria-label={group.name}
                    data-parent-active={parentActive}
                    onClick={() => setOpen((o) => ({ ...o, [group.name]: !expanded }))}
                    className={NAV_BUTTON}
                >
                    {iconWrap(group.icon, badge)}
                    <span className="flex-1 whitespace-nowrap">{group.name}</span>
                    {badge > 0 && <NavBadge>{badge}</NavBadge>}
                    <ChevronRight
                        className={cn("size-4 flex-none transition-transform duration-200", expanded && "rotate-90")}
                        aria-hidden
                    />
                </Button>
                {expanded && (
                    <ul className="ml-[22px] mt-0.5 mb-1.5 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                        {group.items.map((kid) => {
                            const count = kidCount(group.name, kid.name)
                            return (
                                <li key={kid.name}>
                                    <Link href={kid.href} data-active={kid.href === activeKid} className="nav-sub">
                                        <span>{kid.name}</span>
                                        {count && <span className="nav-count">{count}</span>}
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </li>
        )
    }

    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader className="p-0">
                {/* Brand lockup: gradient tile + product name + workspace role */}
                <div className={cn("flex items-center gap-3 pb-2 pt-5", collapsed ? "justify-center px-0" : "px-6")}>
                    <div className="nav-logo flex size-9 flex-none items-center justify-center rounded-xl">
                        <Box className="size-5 text-white" strokeWidth={2} aria-hidden />
                    </div>
                    {!collapsed && (
                        <div className="flex min-w-0 flex-col leading-tight">
                            <span className="max-w-[150px] truncate whitespace-nowrap font-dash-display text-base font-bold text-white"title={businessName}>{businessName}</span>
                            {userRole && <span className="text-xs text-[var(--nav-muted)]">{userRole} workspace</span>}
                        </div>
                    )}
                </div>
            </SidebarHeader>

            <SidebarContent className={cn("nav-scroll gap-[18px] pt-3", collapsed ? "px-3" : "px-4")}>
                {SECTIONS.map((section) => {
                    const entries = visibleNav.filter((i) => i.section === section)
                    const showNotif = section === "Workspace" && showNotifications
                    if (entries.length === 0 && !showNotif) return null
                    return (
                        <div key={section} className="flex flex-col gap-0.5">
                            {collapsed ? (
                                <Separator className="mx-2.5 mb-2 mt-0.5 bg-white/10 data-[orientation=horizontal]:w-auto" />
                            ) : (
                                <span className="nav-section px-3 pb-1.5">{section}</span>
                            )}
                            <ul className="flex flex-col gap-0.5">
                                {entries.map((entry) => ("items" in entry ? renderGroup(entry) : renderLeaf(entry)))}

                                {/* Notifications pinned at the end of Workspace */}
                                {showNotif && (
                                    <li>
                                        <WithTooltip content={collapsed ? "Notifications" : undefined} side="right">
                                            <Link
                                                href="/dashboard/notifications"
                                                aria-label="Notifications"
                                                data-active={matches(pathname, "/dashboard/notifications")}
                                                className={cn("nav-btn", collapsed && "justify-center px-0")}
                                            >
                                                {iconWrap(Bell, unreadCount)}
                                                {!collapsed && <span className="flex-1 whitespace-nowrap">Notifications</span>}
                                                {!collapsed && unreadCount > 0 && <NavBadge>{unreadCount > 99 ? "99+" : unreadCount}</NavBadge>}
                                            </Link>
                                        </WithTooltip>
                                    </li>
                                )}
                            </ul>
                        </div>
                    )
                })}
            </SidebarContent>

            <SidebarFooter className="gap-2 p-4 pt-2">
                {/* Trial / upgrade card (hides itself on the icon rail) */}
                <TrialCard />

                <DropdownMenu>
                    <WithTooltip content={collapsed ? `${userName} · ${userEmail}` : undefined} side="right">
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            aria-label="Account menu"
                            className={cn(
                                "nav-user h-auto w-full justify-start gap-2.5 rounded-[14px] p-3 text-left hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--brand-ring)] dark:hover:bg-white/10",
                                collapsed && "justify-center p-1.5",
                            )}
                        >
                            <span className="nav-logo flex size-[34px] flex-none items-center justify-center rounded-full text-sm font-bold text-white">
                                {initials}
                            </span>
                            {!collapsed && (
                                <>
                                    <span className="grid min-w-0 flex-1 leading-tight">
                                        <span className="truncate text-[13px] font-semibold text-white">{userName}</span>
                                        <span className="truncate text-xs text-[var(--nav-muted)]">{userEmail}</span>
                                    </span>
                                    <ChevronRight className="size-4 flex-none text-[var(--nav-muted)]" aria-hidden />
                                </>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    </WithTooltip>
                    <DropdownMenuContent side={collapsed ? "right" : "top"} align="start" className="w-56">
                        <DropdownMenuLabel>My account</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/edit-profile" className="cursor-pointer">
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Edit profile</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
