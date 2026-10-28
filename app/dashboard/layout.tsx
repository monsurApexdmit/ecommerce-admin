"use client"

import { cn } from "@/lib/utils"
import type React from "react"
import { Suspense } from "react"
import { usePathname } from "next/navigation"
import { StaffProvider } from "@/contexts/staff-context"
import { VendorProvider } from "@/contexts/vendor-context"
import { ExpenseProvider } from "@/contexts/expense-context"
import { ExpenseCategoryProvider } from "@/contexts/expense-category-context"
import { DueProvider } from "@/contexts/due-context"
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
import { NotificationProvider } from "@/contexts/notification-context"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "sonner"
import { CustomerSupportMessenger } from "@/components/customer-support-messenger"
import { CompanySettingsProvider } from "@/contexts/company-settings-context"
import { AppHeader } from "@/components/shell/app-header"
import { PointerEventsGuard } from "@/components/shell/pointer-events-guard"
import { DashboardProvider } from "@/components/dashboard/dashboard-context"
import { displayFont, bodyFont } from "@/components/dashboard/fonts"



export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <CompanySettingsProvider>
    <NotificationProvider>
    <VendorProvider>
      <ExpenseCategoryProvider>
      <ExpenseProvider>
      <DueProvider>
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
                      <SidebarProvider
                        data-app-shell=""
                        className={cn(displayFont.variable, bodyFont.variable, "font-dash-body")}
                      >
                        <AppSidebar />
                        <DashboardProvider>
                        <SidebarInset className="min-w-0">
                          {/* POS draws its own top bar to maximise selling space */}
                          {pathname !== "/dashboard/pos" && <AppHeader />}
                          <main className="app-canvas flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                            <div className="page-in flex-1 min-h-0 overflow-auto p-4 lg:p-8 has-[[data-pos-page]]:p-0 has-[[data-pos-page]]:overflow-hidden">
                              {children}
                            </div>
                          </main>
                        </SidebarInset>
                        </DashboardProvider>
                      </SidebarProvider>
                        </Suspense>
                        <Toaster />
                        <PointerEventsGuard />
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
      </DueProvider>
      </ExpenseProvider>
      </ExpenseCategoryProvider>
    </VendorProvider>
    </NotificationProvider>
    </CompanySettingsProvider>
  )
}
