"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Scissors, ShoppingBag, Clock, CheckCircle, Truck, AlertTriangle, Users, TrendingUp, Plus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { tailorApi, TailorDashboardStats, TailorOrder, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_STATUS_COLORS } from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { toast } from "sonner"

function StatCard({ icon: Icon, label, value, color, href }: {
  icon: React.ElementType; label: string; value: string | number; color: string; href?: string
}) {
  const inner = (
    <Card className="p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-black text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </Card>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default function TailorDashboardPage() {
  const { canRead } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const [stats, setStats] = useState<TailorDashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  if (!canRead("TailorDashboard")) return <AccessDenied />

  useEffect(() => {
    tailorApi.getDashboard()
      .then(r => {
        const d = r.data?.data ?? r.data
        setStats({
          todayOrders:      d.today_orders      ?? d.todayOrders      ?? 0,
          pendingOrders:    d.pending_orders     ?? d.pendingOrders    ?? 0,
          readyForDelivery: d.ready_for_delivery ?? d.readyForDelivery ?? 0,
          deliveredOrders:  d.delivered_orders   ?? d.deliveredOrders  ?? 0,
          totalDue:         parseFloat(d.total_due ?? d.totalDue ?? 0) || 0,
          lowStockFabrics:  d.low_stock_fabrics  ?? d.lowStockFabrics  ?? 0,
          activeDorjis:     d.active_dorjis      ?? d.activeDorjis     ?? 0,
          recentOrders:     (d.recent_orders     ?? d.recentOrders     ?? []).map((o: any) => ({
            id:            o.id,
            orderNumber:   o.order_number   ?? o.orderNumber,
            customer:      o.customer ? { name: o.customer.name, phone: o.customer.phone } : undefined,
            totalAmount:   parseFloat(o.total_amount ?? o.totalAmount ?? 0) || 0,
            paidAmount:    parseFloat(o.paid_amount  ?? o.paidAmount  ?? 0) || 0,
            dueAmount:     parseFloat(o.due_amount   ?? o.dueAmount   ?? 0) || 0,
            orderStatus:   o.order_status   ?? o.orderStatus,
            paymentStatus: o.payment_status ?? o.paymentStatus,
            orderDate:     o.order_date     ?? o.orderDate,
            deliveryDate:  o.delivery_date  ?? o.deliveryDate,
          })),
        })
      })
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <Scissors className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Tailor Shop</h1>
            <p className="text-sm text-gray-500">Dashboard overview</p>
          </div>
        </div>
        <Link href="/dashboard/tailor/orders/new">
          <Button className="bg-purple-600 hover:bg-purple-700 gap-2">
            <Plus className="w-4 h-4" /> New Order
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={ShoppingBag}    label="Today's Orders"     value={stats?.todayOrders ?? 0}      color="bg-blue-100 text-blue-600"    href="/dashboard/tailor/orders" />
          <StatCard icon={Clock}          label="Pending Orders"     value={stats?.pendingOrders ?? 0}    color="bg-yellow-100 text-yellow-600" href="/dashboard/tailor/orders?order_status=pending" />
          <StatCard icon={CheckCircle}    label="Ready for Delivery" value={stats?.readyForDelivery ?? 0} color="bg-green-100 text-green-600"   href="/dashboard/tailor/orders?order_status=ready" />
          <StatCard icon={Truck}          label="Delivered"          value={stats?.deliveredOrders ?? 0}  color="bg-emerald-100 text-emerald-600" href="/dashboard/tailor/orders?order_status=delivered" />
          <StatCard icon={TrendingUp}     label="Total Due"          value={formatCurrency(stats?.totalDue ?? 0)} color="bg-red-100 text-red-600" href="/dashboard/tailor/payments" />
          <StatCard icon={AlertTriangle}  label="Low Stock Fabrics"  value={stats?.lowStockFabrics ?? 0}  color="bg-orange-100 text-orange-600" href="/dashboard/tailor/fabrics" />
          <StatCard icon={Users}          label="Active Dorjis"      value={stats?.activeDorjis ?? 0}     color="bg-purple-100 text-purple-600" href="/dashboard/tailor/dorjis" />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Fabric Inventory", href: "/dashboard/tailor/fabrics",      color: "border-blue-200 hover:bg-blue-50 text-blue-700" },
          { label: "Measurements",     href: "/dashboard/tailor/measurements", color: "border-green-200 hover:bg-green-50 text-green-700" },
          { label: "Dorji / Tailors",  href: "/dashboard/tailor/dorjis",       color: "border-purple-200 hover:bg-purple-50 text-purple-700" },
          { label: "Reports",          href: "/dashboard/tailor/reports",      color: "border-gray-200 hover:bg-gray-50 text-gray-700" },
        ].map(a => (
          <Link key={a.href} href={a.href}>
            <Card className={`p-4 text-center text-sm font-semibold border-2 cursor-pointer transition-colors ${a.color}`}>
              {a.label}
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Orders */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">Recent Orders</h2>
          <Link href="/dashboard/tailor/orders" className="text-sm text-purple-600 hover:underline">View all</Link>
        </div>
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !stats?.recentOrders?.length ? (
          <p className="text-sm text-gray-400 text-center py-8">No orders yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                  <th className="pb-2 pr-4">Order #</th>
                  <th className="pb-2 pr-4">Customer</th>
                  <th className="pb-2 pr-4">Total</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentOrders.map((order: TailorOrder) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="py-3 pr-4 font-mono text-xs">
                      <Link href={`/dashboard/tailor/orders/${order.id}`} className="text-purple-600 hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 font-medium">{order.customer?.name}</td>
                    <td className="py-3 pr-4">{formatCurrency(order.totalAmount)}</td>
                    <td className="py-3 pr-4">
                      <Badge className={`text-xs ${ORDER_STATUS_COLORS[order.orderStatus]}`}>
                        {ORDER_STATUS_LABELS[order.orderStatus]}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <Badge className={`text-xs ${PAYMENT_STATUS_COLORS[order.paymentStatus]}`}>
                        {order.paymentStatus}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
