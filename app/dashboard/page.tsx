"use client"

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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

const stats = [
  {
    name: "Total Revenue",
    value: "$45,231",
    change: "+12.5%",
    changeType: "positive",
    icon: DollarSign,
    bgColor: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    name: "Total Orders",
    value: "1,234",
    change: "+8.2%",
    changeType: "positive",
    icon: ShoppingBag,
    bgColor: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    name: "Total Customers",
    value: "3,456",
    change: "+5.7%",
    changeType: "positive",
    icon: Users,
    bgColor: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  {
    name: "Total Products",
    value: "789",
    change: "-2.3%",
    changeType: "negative",
    icon: Package,
    bgColor: "bg-orange-50",
    iconColor: "text-orange-600",
  },
]

const recentOrders = [
  { id: "#ORD-001", customer: "John Doe", amount: "$125.00", status: "Completed", date: "2024-01-15" },
  { id: "#ORD-002", customer: "Jane Smith", amount: "$89.50", status: "Processing", date: "2024-01-15" },
  { id: "#ORD-003", customer: "Bob Johnson", amount: "$234.00", status: "Pending", date: "2024-01-14" },
  { id: "#ORD-004", customer: "Alice Brown", amount: "$156.75", status: "Completed", date: "2024-01-14" },
  { id: "#ORD-005", customer: "Charlie Wilson", amount: "$92.00", status: "Cancelled", date: "2024-01-13" },
]

const topProducts = [
  { name: "Wireless Headphones", sales: 245, revenue: "$12,250" },
  { name: "Smart Watch", sales: 189, revenue: "$18,900" },
  { name: "Laptop Stand", sales: 156, revenue: "$4,680" },
  { name: "USB-C Cable", sales: 423, revenue: "$6,345" },
  { name: "Phone Case", sales: 312, revenue: "$3,120" },
]

export default function DashboardPage() {
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
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
      },
      y: {
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          callback: (value: number | string) => "$" + value + "k",
        },
      },
    },
  }

  // Vendor statistics
  const { vendors } = useVendor()
  const { products } = useProduct()
  const { staff, salaryPayments } = useStaff()

  const totalVendors = vendors.length
  const totalPaid = vendors.reduce((sum, vendor) => sum + vendor.totalPaid, 0)

  // Calculate total inventory value across all vendors
  const totalInventoryValue = products.reduce((sum, product) => {
    if (product.vendorId) {
      return sum + (product.salePrice * product.stock)
    }
    return sum
  }, 0)

  const totalDue = totalInventoryValue - totalPaid

  // Staff salary statistics
  const now = new Date()
  const currentMonth = `${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`
  const totalSalaryBudget = staff.reduce((sum, s) => sum + s.salary, 0)
  const monthSalaryPayments = salaryPayments.filter(p => p.month === currentMonth)
  const totalSalaryPaid = monthSalaryPayments
    .filter(p => p.status === "Paid")
    .reduce((sum, p) => sum + p.paidAmount, 0)
  const totalSalaryPending = staff
    .filter(s => !monthSalaryPayments.find(p => p.staffId === s.id && p.status === "Paid"))
    .reduce((sum, s) => sum + s.salary, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your store today.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {stat.changeType === "positive" ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-600" />
                  )}
                  <span
                    className={`text-sm font-medium ${stat.changeType === "positive" ? "text-emerald-600" : "text-red-600"}`}
                  >
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500">vs last month</span>
                </div>
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
            <p className="text-2xl font-bold text-emerald-600">${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Due</p>
            <p className="text-2xl font-bold text-orange-600">${totalDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
            <p className="text-2xl font-bold text-gray-900">${totalSalaryBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-4 bg-emerald-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Paid This Month</p>
            <p className="text-2xl font-bold text-emerald-600">${totalSalaryPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Pending</p>
            <p className="text-2xl font-bold text-orange-600">${totalSalaryPending.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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

      {/* Recent Orders & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Order ID</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Customer</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Amount</th>
                  <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-2 text-sm font-medium">{order.id}</td>
                    <td className="py-3 px-2 text-sm">{order.customer}</td>
                    <td className="py-3 px-2 text-sm font-medium">{order.amount}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${order.status === "Completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : order.status === "Processing"
                            ? "bg-blue-50 text-blue-700"
                            : order.status === "Pending"
                              ? "bg-yellow-50 text-yellow-700"
                              : "bg-red-50 text-red-700"
                          }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Top Products</h2>
          <div className="space-y-4">
            {topProducts.map((product, index) => (
              <div key={product.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-sm font-medium text-emerald-600">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.sales} sales</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-900">{product.revenue}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
