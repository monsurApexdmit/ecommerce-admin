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
    ShieldCheck,
    ChevronRight,
    RotateCcw,
    Package,
    Bell,
    Headphones,
    Scissors,
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
    useSidebar,
} from "@/components/ui/sidebar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"
import { useNotifications } from "@/contexts/notification-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { TrialCard } from "@/components/trial-card"

// Each item declares which permission module controls its visibility.
// module: null = always visible (no permission gate)
// Sentence-case section labels group the nav into scannable blocks. Order here
// is the render order; each item carries its `section` so we can split them.
const SECTIONS = ["Overview", "Sell", "Catalog", "Operations", "Workspace"] as const
type Section = typeof SECTIONS[number]

const NAV_CONFIG = [
    { section: "Overview", name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "Dashboard" },

    { section: "Sell", name: "POS",       href: "/dashboard/pos",       icon: CreditCard, module: "POS" },
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
            { name: "Attributes",    href: "/dashboard/attributes",             module: "Attributes" },
            { name: "Coupons",       href: "/dashboard/coupons",                module: "Coupons" },
            { name: "Print barcode", href: "/dashboard/products/print-barcode", module: "Print Barcode" },
        ],
    },

    {
        section: "Operations",
        name: "Vendors",
        icon: Truck,
        items: [
            { name: "All vendors",      href: "/dashboard/vendors",                  module: "Vendors" },
            { name: "Purchase orders",  href: "/dashboard/vendors/purchase-orders",  module: "Vendors" },
        ],
    },
    {
        section: "Operations",
        name: "Inventory",
        icon: Package,
        items: [
            { name: "Stock overview", href: "/dashboard/inventory",                module: "Inventory" },
            { name: "Transfers",      href: "/dashboard/inventory/transfer",      module: "Transfers" },
            { name: "Serial & batch", href: "/dashboard/inventory/serial-batch",  module: "Inventory" },
        ],
    },
    {
        section: "Operations",
        name: "Returns",
        icon: RotateCcw,
        items: [
            { name: "Customer returns", href: "/dashboard/returns/customer", module: "Customer Returns" },
            { name: "Vendor returns",   href: "/dashboard/returns/vendor",   module: "Vendor Returns" },
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
            { name: "Company settings",   href: "/dashboard/company/settings",          module: "Company Settings" },
            { name: "Billing contact",    href: "/dashboard/company/billing-contact",   module: "Billing Contact" },
            { name: "Team members",       href: "/dashboard/team/users",                module: "Team Members" },
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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const pathname = usePathname()
    const { logout } = useAuth()
    const { state } = useSidebar()
    const { unreadCount } = useNotifications()
    const { canRead, isPlanModule, user } = useSaasAuth()

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
    // (subscription tier) AND readable by the user's role (RBAC). Plan gating
    // hides modules the trial/plan doesn't include (e.g. Salary, Tailor).
    const canSee = (module: string | null) =>
        module === null || (isPlanModule(module) && canRead(module))

    // Filter navigation: remove items (and group sub-items) the user can't see
    const visibleNav = NAV_CONFIG.map((item) => {
        if ("items" in item) {
            const visibleItems = item.items.filter((sub) => canSee(sub.module))
            if (visibleItems.length === 0) return null
            return { ...item, items: visibleItems }
        }
        if (!canSee(item.module)) return null
        return item
    }).filter(Boolean) as typeof NAV_CONFIG[number][]

    const showNotifications = canSee("Notifications")

    // Shared item renderer so the section loop stays readable.
    const renderItem = (item: typeof NAV_CONFIG[number]) => {
        const isActive = "href" in item && item.href ? pathname === item.href : false
        const isSubActive = "items" in item && item.items?.some((sub) => pathname === sub.href)

        if ("items" in item) {
            if (state === "collapsed") {
                return (
                    <SidebarMenuItem key={item.name}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton
                                    tooltip={item.name}
                                    isActive={isSubActive}
                                    className="text-muted-foreground hover:bg-accent hover:text-foreground data-[active=true]:bg-brand-soft data-[active=true]:text-brand-fg"
                                >
                                    {item.icon && <item.icon />}
                                    <span>{item.name}</span>
                                    <ChevronRight className="ml-auto size-4" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start" className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg">
                                <DropdownMenuLabel>{item.name}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {item.items.map((subItem) => (
                                    <DropdownMenuItem key={subItem.name} asChild>
                                        <Link href={subItem.href} className="cursor-pointer">
                                            {subItem.name}
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                )
            }

            return (
                <Collapsible
                    key={item.name}
                    asChild
                    defaultOpen={isSubActive}
                    className="group/collapsible"
                >
                    <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                            <SidebarMenuButton
                                tooltip={item.name}
                                // Highlight the active *path*: parent of the open page reads
                                // primary + medium, without the full pill tint (that's the leaf's).
                                className={`text-muted-foreground hover:bg-accent hover:text-foreground ${isSubActive ? "text-foreground font-medium" : ""}`}
                            >
                                {item.icon && <item.icon />}
                                <span>{item.name}</span>
                                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <SidebarMenuSub className="border-l border-border">
                                {item.items.map((subItem) => (
                                    <SidebarMenuSubItem key={subItem.name}>
                                        <SidebarMenuSubButton
                                            asChild
                                            isActive={pathname === subItem.href}
                                            className="text-muted-foreground hover:text-foreground data-[active=true]:bg-brand-soft data-[active=true]:text-brand-fg data-[active=true]:font-medium"
                                        >
                                            <Link href={subItem.href}>
                                                <span>{subItem.name}</span>
                                            </Link>
                                        </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                ))}
                            </SidebarMenuSub>
                        </CollapsibleContent>
                    </SidebarMenuItem>
                </Collapsible>
            )
        }

        return (
            <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                    asChild
                    tooltip={item.name}
                    isActive={isActive}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground data-[active=true]:bg-brand-soft data-[active=true]:text-brand-fg data-[active=true]:font-medium"
                >
                    <Link href={"href" in item ? item.href : "#"}>
                        {"icon" in item && item.icon && <item.icon />}
                        <span>{item.name}</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        )
    }

    return (
        <Sidebar collapsible="icon" {...props} className="border-r border-border">
            <SidebarHeader>
                {/* Brand lockup: brand-filled rounded tile + product name + static
                    company subtitle (no workspace switcher — single workspace per login). */}
                <div className="flex items-center gap-2.5 p-3 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center">
                    <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                        <ShieldCheck className="size-5" />
                    </div>
                    <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="text-sm font-medium text-foreground">SAAS Inventory</span>
                        {userRole && (
                            <span className="text-xs text-muted-foreground">{userRole} workspace</span>
                        )}
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                {SECTIONS.map((section) => {
                    const items = visibleNav.filter((i) => i.section === section)
                    if (items.length === 0) return null
                    return (
                        <SidebarGroup key={section} className="group-data-[collapsible=icon]:py-0">
                            {/* Hide the section label entirely in the icon rail so all
                                icons keep an even vertical rhythm (no per-section gap). */}
                            <SidebarGroupLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden">
                                {section}
                            </SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {items.map(renderItem)}

                                    {/* Notifications pinned at the end of Workspace */}
                                    {section === "Workspace" && showNotifications && (
                                        <SidebarMenuItem>
                                            <SidebarMenuButton
                                                asChild
                                                tooltip="Notifications"
                                                isActive={pathname === "/dashboard/notifications"}
                                                className="text-muted-foreground hover:bg-accent hover:text-foreground data-[active=true]:bg-brand-soft data-[active=true]:text-brand-fg data-[active=true]:font-medium"
                                            >
                                                <Link href="/dashboard/notifications" className="flex items-center gap-2">
                                                    <Bell />
                                                    <span>Notifications</span>
                                                    {unreadCount > 0 && (
                                                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-medium text-brand-foreground">
                                                            {unreadCount > 99 ? "99+" : unreadCount}
                                                        </span>
                                                    )}
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    )
                })}
            </SidebarContent>

            <SidebarFooter className="gap-2">
                {/* Trial / upgrade card — replaces the old top banner. */}
                <TrialCard />

                {/* Profile row — moved here from the top-right corner. */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand group-data-[collapsible=icon]:justify-center">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-medium text-brand-fg">
                                {initials}
                            </span>
                            <span className="grid flex-1 leading-tight group-data-[collapsible=icon]:hidden">
                                <span className="truncate text-[13px] font-medium text-foreground">{userName}</span>
                                <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                            </span>
                            <ChevronRight className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="top" align="start" className="w-56">
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
