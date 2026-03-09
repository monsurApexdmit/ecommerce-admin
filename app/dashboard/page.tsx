"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownRight, DollarSign, ShoppingBag, Users, Package, Truck } from "lucide-react"
import { useVendor } from "@/contexts/vendor-context"
import { useProduct } from "@/contexts/product-context"
import { useStaff } from "@/contexts/staff-context"
import { Line, Bar } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"
import { sellsApi, SellResponse } from "@/lib/sellsApi"
import { StatusBadge } from "@/components/ui/status-badge"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

export default function DashboardPage() {
  const { vendors } = useVendor()
  const { products } = useProduct()
  const { staff, salaryPayments } = useStaff()

  const [recentOrders, setRecentOrders] = useState<SellResponse[]>([])
  const [sellStats, setSellStats] = useState<{
    totalRevenue: number
    totalOrders: number
    pendingCount: number
    processingCount: number
    deliveredCount: number
  } | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [listRes, statsRes] = await Promise.all([
          sellsApi.getAll({ limit: 5 }),
          sellsApi.getStats(),
        ])
        setRecentOrders(listRes.data ?? [])

        const s = statsRes.data
        setSellStats({
          totalRevenue: Number(s?.total_revenue ?? 0),
          totalOrders: Number(s?.total_sells ?? listRes.total ?? listRes.data?.length ?? 0),
          pendingCount: Number(s?.pending_count ?? 0),
          processingCount: Number(s?.processing_count ?? 0),
          deliveredCount: Number(s?.delivered_count ?? 0),
        })
      } catch {
        // fallback: just use list length
        try {
          const listRes = await sellsApi.getAll({ limit: 5 })
          setRecentOrders(listRes.data ?? [])
          const revenue = (listRes.data ?? []).reduce((sum, o) => sum + Number(o.amount ?? 0), 0)
          setSellStats({
            totalRevenue: revenue,
            totalOrders: listRes.total ?? listRes.data?.length ?? 0,
            pendingCount: 0,
            processingCount: 0,
            deliveredCount: 0,
          })
        } catch {
          setRecentOrders([])
        }
      } finally {
        setOrdersLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  // Vendor statistics
  const totalVendors = vendors.length
  const totalPaid = vendors.reduce((sum, vendor) => sum + vendor.totalPaid, 0)
  const totalInventoryValue = products.reduce((sum, product) => {
    if (product.vendorId) return sum + product.salePrice * product.stock
    return sum
  }, 0)
  const totalDue = totalInventoryValue - totalPaid

  // Staff salary statistics
  const now = new Date()
  const currentMonth = `${now.toLocaleString("en-US", { month: "short" })} ${now.getFullYear()}`
  const totalSalaryBudget = staff.reduce((sum, s) => sum + s.salary, 0)
  const monthSalaryPayments = salaryPayments.filter((p) => p.month === currentMonth)
  const totalSalaryPaid = monthSalaryPayments
    .filter((p) => p.status === "Paid")
    .reduce((sum, p) => sum + p.paidAmount, 0)
  const totalSalaryPending = staff
    .filter((s) => !monthSalaryPayments.find((p) => p.staffId === s.id && p.status === "Paid"))
    .reduce((sum, s) => sum + s.salary, 0)

  const statsCards = [
    {
      name: "Total Revenue",
      value: sellStats ? `$${sellStats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
      icon: DollarSign,
      bgColor: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      name: "Total Orders",
      value: sellStats ? sellStats.totalOrders.toLocaleString() : "—",
      icon: ShoppingBag,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      name: "Delivered",
      value: sellStats ? sellStats.deliveredCount.toLocaleString() : "—",
      icon: Package,
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      name: "Pending / Processing",
      value: sellStats ? (sellStats.pendingCount + sellStats.processingCount).toLocaleString() : "—",
      icon: Truck,
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
    },
  ]

  const salesData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets: [
      {
        label: "Sales",
        data: [12, 19, 15, 25, 22, 30, 28, 35, 32, 38, 40, 45],
        borderColor: "rgb(16, 185, 129)",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const ordersData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "Orders",
        data: [45, 52, 38, 65, 59, 80, 71],
        backgroundColor: "rgba(16, 185, 129, 0.8)",
        borderRadius: 6,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: {
        grid: { color: "rgba(0, 0, 0, 0.05)" },
        ticks: { callback: (value: number | string) => "$" + value + "k" },
      },
    },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your store today.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => (
          <Card key={stat.name} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {ordersLoading ? <span className="text-gray-300 animate-pulse">—</span> : stat.value}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Vendor Statistics Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Vendor Overview</h2>
            <p className="text-sm text-gray-600 mt-1">Summary of vendor payments and obligations</p>
          </div>
          <div className="p-3 rounded-lg bg-indigo-50">
            <Truck className="w-6 h-6 text-indigo-600" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Vendors</p>
            <p className="text-2xl font-bold text-gray-900">{totalVendors}</p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-emerald-600">${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Due</p>
            <p className="text-2xl font-bold text-orange-600">${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </Card>

      {/* Staff Salary Overview Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Staff Salary Overview</h2>
            <p className="text-sm text-gray-600 mt-1">Current month salary status ({currentMonth})</p>
          </div>
          <div className="p-3 rounded-lg bg-purple-50">
            <Users className="w-6 h-6 text-purple-600" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Monthly Budget</p>
            <p className="text-2xl font-bold text-gray-900">${totalSalaryBudget.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Paid This Month</p>
            <p className="text-2xl font-bold text-emerald-600">${totalSalaryPaid.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Pending</p>
            <p className="text-2xl font-bold text-orange-600">${totalSalaryPending.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Sales Overview</h2>
          <div className="h-80">
            <Line data={salesData} options={chartOptions} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Weekly Orders</h2>
          <div className="h-80">
            <Bar data={ordersData} options={chartOptions} />
          </div>
        </Card>
      </div>

      {/* Recent Orders & Order Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Invoice</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Customer</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Amount</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {ordersLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-3 px-2"><div className="h-4 w-24 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="py-3 px-2"><div className="h-4 w-28 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="py-3 px-2"><div className="h-4 w-16 bg-gray-100 rounded animate-pulse" /></td>
                      <td className="py-3 px-2"><div className="h-5 w-20 bg-gray-100 rounded animate-pulse" /></td>
                    </tr>
                  ))
                ) : recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-gray-500">No orders yet</td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 px-2 text-sm font-medium text-gray-900">#{order.invoiceNo}</td>
                      <td className="py-3 px-2 text-sm text-gray-700">{order.customerName}</td>
                      <td className="py-3 px-2 text-sm font-medium text-gray-900">${Number(order.amount ?? 0).toFixed(2)}</td>
                      <td className="py-3 px-2">
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Order Status Breakdown</h2>
          {ordersLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : sellStats ? (
            <div className="space-y-4">
              {[
                { label: "Delivered", count: sellStats.deliveredCount, color: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
                { label: "Processing", count: sellStats.processingCount, color: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700" },
                { label: "Pending", count: sellStats.pendingCount, color: "bg-red-400", bg: "bg-red-50", text: "text-red-700" },
              ].map((item) => {
                const total = sellStats.totalOrders || 1
                const pct = Math.round((item.count / total) * 100)
                return (
                  <div key={item.label} className={`p-4 rounded-lg ${item.bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-medium ${item.text}`}>{item.label}</span>
                      <span className={`text-sm font-bold ${item.text}`}>{item.count} orders</span>
                    </div>
                    <div className="w-full bg-white rounded-full h-2">
                      <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className={`text-xs mt-1 ${item.text} opacity-70`}>{pct}% of total</p>
                  </div>
                )
              })}
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Revenue</span>
                  <span className="font-bold text-gray-900">${sellStats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No data available</p>
          )}
        </Card>
      </div>
    </div>
  )
}
