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

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
        name: "Catalog",
        icon: Grid3x3,
        items: [
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
        items: [
            { name: "Stock Overview", href: "/dashboard/inventory" },
            { name: "Transfers", href: "/dashboard/inventory/transfer" },
        ],
    },
    { name: "Sells", href: "/dashboard/sells", icon: ShoppingBag },
    {
        name: "Staff",
        icon: UserPlus,
        items: [
            { name: "All Staff", href: "/dashboard/staff" },
            { name: "Role & Permission", href: "/dashboard/staff/roles" },
            { name: "Salary Management", href: "/dashboard/staff/salary" },
        ],
    },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
    { name: "International", href: "/dashboard/international", icon: Globe },
    { name: "Online Store", href: "/dashboard/store", icon: Store },
    { name: "Pages", href: "/dashboard/pages", icon: FileText },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const pathname = usePathname()
    const { logout } = useAuth()
    const { state } = useSidebar()

    return (
        <Sidebar collapsible="icon" {...props} className="border-r border-border">
            <SidebarHeader>
                <div className="flex items-center gap-2 p-4 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                        <ShieldCheck className="size-5" />
                    </div>
                    <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                        <span className="font-bold text-xl">ADMIN</span>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarMenu>
                        {navigation.map((item) => {
                            const isActive = item.href ? pathname === item.href : false
                            const isSubActive = item.items?.some(sub => pathname === sub.href)

                            if (item.items) {
                                // If collapsed, show DropdownMenu
                                if (state === 'collapsed') {
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
                                        <Link href={item.href}>
                                            <item.icon />
                                            <span>{item.name}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            )
                        })}
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
