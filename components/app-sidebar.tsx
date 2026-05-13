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
    ShoppingBag,
    CreditCard,
    Truck,
    Store,
    Grid3x3,
    UserPlus,
    Globe,
    FileText,
    ShieldCheck,
    ChevronRight,
    RotateCcw,
    MapPin,
    Package,
    Printer,
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

// Each item declares which permission module controls its visibility.
// module: null = always visible (no permission gate)
const NAV_CONFIG = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, module: "Dashboard" },
    {
        name: "Catalog",
        icon: Grid3x3,
        items: [
            { name: "Products",      href: "/dashboard/products",               module: "Products" },
            { name: "Categories",    href: "/dashboard/categories",             module: "Categories" },
            { name: "Attributes",    href: "/dashboard/attributes",             module: "Attributes" },
            { name: "Coupons",       href: "/dashboard/coupons",                module: "Coupons" },
            { name: "Print Barcode", href: "/dashboard/products/print-barcode", module: "Print Barcode" },
        ],
    },
    { name: "Customers", href: "/dashboard/customers", icon: Users,        module: "Customers" },
    {
        name: "Orders",
        icon: ShoppingCart,
        items: [
            { name: "All Orders", href: "/dashboard/orders",           module: "Orders" },
            { name: "Shipments",  href: "/dashboard/orders/shipments", module: "Shipments" },
        ],
    },
    { name: "Vendors", href: "/dashboard/vendors", icon: Truck, module: "Vendors" },
    { name: "POS",     href: "/dashboard/pos",     icon: CreditCard, module: "POS" },
    {
        name: "Inventory",
        icon: Package,
        items: [
            { name: "Stock Overview", href: "/dashboard/inventory",         module: "Inventory" },
            { name: "Transfers",      href: "/dashboard/inventory/transfer", module: "Transfers" },
        ],
    },
    {
        name: "Returns",
        icon: RotateCcw,
        items: [
            { name: "Customer Returns", href: "/dashboard/returns/customer", module: "Customer Returns" },
            { name: "Vendor Returns",   href: "/dashboard/returns/vendor",   module: "Vendor Returns" },
        ],
    },
    {
        name: "Staff",
        icon: UserPlus,
        items: [
            { name: "All Staff",         href: "/dashboard/staff",        module: "Staff" },
            { name: "Role & Permission", href: "/dashboard/staff/roles",  module: "Role & Permission" },
            { name: "Salary Management", href: "/dashboard/staff/salary", module: "Salary Management" },
        ],
    },
    {
        name: "Settings",
        icon: Settings,
        items: [
            { name: "Store Settings",     href: "/dashboard/settings",                  module: "Settings" },
            { name: "Aura Shop",          href: "/dashboard/settings/aura-shop",        module: "Aura Shop" },
            { name: "Company Profile",    href: "/dashboard/company/profile",           module: "Company Profile" },
            { name: "Company Settings",   href: "/dashboard/company/settings",          module: "Company Settings" },
            { name: "Billing Contact",    href: "/dashboard/company/billing-contact",   module: "Billing Contact" },
            { name: "Team Members",       href: "/dashboard/team/users",                module: "Team Members" },
            { name: "Subscriptions",      href: "/dashboard/billing/subscriptions",     module: "Subscriptions" },
            { name: "Billing Plans",      href: "/dashboard/billing/plans",             module: "Billing Plans" },
        ],
    },
    {
        name: "Store",
        icon: Store,
        items: [
            { name: "Store Settings",      href: "/dashboard/store",                      module: "Store" },
            { name: "Shipping Methods",    href: "/dashboard/shipping-methods",           module: "Shipping Methods" },
            { name: "Payment Methods",     href: "/dashboard/payment-methods",            module: "Payment Methods" },
            { name: "Shipping Addresses",  href: "/dashboard/store/shipping-addresses",   module: "Shipping Addresses" },
        ],
    },
    {
        name: "Tailor Shop",
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
    { name: "Support", href: "/dashboard/support", icon: Headphones, module: "Support" },
    { name: "Pages",   href: "/dashboard/pages",   icon: FileText,   module: "Pages" },
] as const

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const pathname = usePathname()
    const { logout } = useAuth()
    const { state } = useSidebar()
    const { unreadCount } = useNotifications()
    const { canRead } = useSaasAuth()

    // Filter navigation: remove items (and group sub-items) user cannot read
    const visibleNav = NAV_CONFIG.map((item) => {
        if ("items" in item) {
            const visibleItems = item.items.filter((sub) => canRead(sub.module))
            if (visibleItems.length === 0) return null
            return { ...item, items: visibleItems }
        }
        if (!canRead(item.module)) return null
        return item
    }).filter(Boolean) as typeof NAV_CONFIG[number][]

    const showNotifications = canRead("Notifications")

    return (
        <Sidebar collapsible="icon" {...props} className="border-r border-border">
            <SidebarHeader>
                <div className="flex items-center gap-2 p-4 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                        <ShieldCheck className="size-5" />
                    </div>
                    <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="font-bold text-xl">SAAS Inventory</span>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        {visibleNav.map((item) => {
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
                                                        className="text-gray-700 hover:bg-gray-100 hover:text-gray-900 data-[active=true]:text-gray-900"
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
                                                    isActive={isSubActive}
                                                    className="text-gray-700 hover:bg-gray-100 hover:text-gray-900 data-[active=true]:text-gray-900"
                                                >
                                                    {item.icon && <item.icon />}
                                                    <span>{item.name}</span>
                                                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                                </SidebarMenuButton>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <SidebarMenuSub>
                                                    {item.items.map((subItem) => (
                                                        <SidebarMenuSubItem key={subItem.name}>
                                                            <SidebarMenuSubButton
                                                                asChild
                                                                isActive={pathname === subItem.href}
                                                                className="text-gray-600 hover:text-gray-900 data-[active=true]:text-emerald-700 data-[active=true]:font-medium"
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
                                        className="text-gray-700 hover:bg-gray-100 hover:text-gray-900 data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-700"
                                    >
                                        <Link href={"href" in item ? item.href : "#"}>
                                            {"icon" in item && item.icon && <item.icon />}
                                            <span>{item.name}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )
                        })}

                        {/* Notifications — gated by Notifications permission */}
                        {showNotifications && (
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    tooltip="Notifications"
                                    isActive={pathname === "/dashboard/notifications"}
                                    className="text-gray-700 hover:bg-gray-100 hover:text-gray-900 data-[active=true]:bg-emerald-50 data-[active=true]:text-emerald-700"
                                >
                                    <Link href="/dashboard/notifications" className="flex items-center gap-2">
                                        <Bell />
                                        <span>Notifications</span>
                                        {unreadCount > 0 && (
                                            <span className="ml-auto min-w-5 h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                                {unreadCount > 99 ? "99+" : unreadCount}
                                            </span>
                                        )}
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={logout}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                            <LogOut />
                            <span>Log out</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}
