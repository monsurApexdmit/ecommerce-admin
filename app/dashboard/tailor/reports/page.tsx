"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BarChart2, Package, Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  tailorApi,
  TailorOrder, TailorFabric, TailorDorji,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
} from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { toast } from "sonner"

type Tab = "orders" | "fabrics" | "dorjis"

function firstOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

// ── Orders Report ────────────────────────────────────────────────────────────

interface OrdersReportData {
  summary: {
    totalOrders: number
    totalAmount: number
    totalPaid: number
    totalDue: number
    byStatus: Record<string, number>
  }
  orders: TailorOrder[]
}

function OrdersReport({ formatCurrency }: { formatCurrency: (n: number) => string }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [data, setData] = useState<OrdersReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    tailorApi.getOrdersReport({ date_from: dateFrom, date_to: dateTo })
      .then(r => setData(r.data))
      .catch(() => toast.error("Failed to load orders report"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const byStatus = data?.summary?.byStatus ?? {}
  const maxByStatus = Math.max(...Object.values(byStatus), 1)

  return (
    <div className="space-y-5">
      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">From</Label>
          <Input type="date" className="h-9 w-36 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">To</Label>
          <Input type="date" className="h-9 w-36 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Apply"}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: data?.summary?.totalOrders ?? 0, fmt: false, color: "text-gray-900" },
          { label: "Total Revenue", value: data?.summary?.totalAmount ?? 0, fmt: true, color: "text-purple-700" },
          { label: "Total Collected", value: data?.summary?.totalPaid ?? 0, fmt: true, color: "text-green-700" },
          { label: "Total Due", value: data?.summary?.totalDue ?? 0, fmt: true, color: "text-red-600" },
        ].map(c => (
          <Card key={c.label} className="p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <div className={`text-xl font-black ${c.color}`}>
              {loading ? <Skeleton className="h-7 w-24" /> : c.fmt ? formatCurrency(c.value as number) : c.value}
            </div>
          </Card>
        ))}
      </div>

      {/* Orders by status — horizontal bar chart */}
      {!loading && data && Object.keys(byStatus).length > 0 && (
        <Card className="p-5">
          <p className="text-sm font-semibold text-gray-700 mb-4">Orders by Status</p>
          <div className="space-y-2">
            {Object.entries(byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-36 shrink-0">
                  {ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? status}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ width: `${(count / maxByStatus) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Orders table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : (data?.orders ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <BarChart2 className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-gray-400">No orders in this period</p>
                  </td>
                </tr>
              ) : (data?.orders ?? []).map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/dashboard/tailor/orders/${o.id}`} className="text-purple-600 hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(o.orderDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{o.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(o.totalAmount)}</td>
                  <td className="px-4 py-3 text-green-700">{formatCurrency(o.paidAmount)}</td>
                  <td className="px-4 py-3 text-red-600">{formatCurrency(o.dueAmount)}</td>
                  <td className="px-4 py-3">
                    <Badge className={ORDER_STATUS_COLORS[o.orderStatus]}>
                      {ORDER_STATUS_LABELS[o.orderStatus]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── Fabrics Report ────────────────────────────────────────────────────────────

interface FabricsReportData {
  fabrics: TailorFabric[]
  lowStockCount: number
  totalValue: number
}

function FabricsReport({ formatCurrency }: { formatCurrency: (n: number) => string }) {
  const [data, setData] = useState<FabricsReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tailorApi.getFabricsReport()
      .then(r => setData(r.data))
      .catch(() => toast.error("Failed to load fabrics report"))
      .finally(() => setLoading(false))
  }, [])

  const fabrics = data?.fabrics ?? []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4 max-w-xl">
        {[
          { label: "Total Fabrics", value: loading ? "…" : fabrics.length, color: "text-gray-900" },
          { label: "Low Stock (< 5)", value: loading ? "…" : data?.lowStockCount ?? 0, color: "text-orange-600" },
          { label: "Inventory Value", value: loading ? "…" : formatCurrency(data?.totalValue ?? 0), color: "text-green-700" },
        ].map(c => (
          <Card key={c.label} className="p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Purchase Price</th>
                <th className="px-4 py-3">Selling Price</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={9} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : fabrics.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Package className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-gray-400">No fabrics found</p>
                  </td>
                </tr>
              ) : fabrics.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{f.name}</td>
                  <td className="px-4 py-3 text-gray-500">{f.fabricType ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{f.color ?? "—"}</td>
                  <td className={`px-4 py-3 font-semibold ${f.stockQuantity < 5 ? "text-red-600" : "text-gray-700"}`}>
                    {f.stockQuantity}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{f.unit}</td>
                  <td className="px-4 py-3 text-gray-600">{formatCurrency(f.purchasePrice)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatCurrency(f.sellingPrice)}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">
                    {formatCurrency(f.stockQuantity * f.sellingPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={f.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                      {f.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── Dorjis Report ────────────────────────────────────────────────────────────

type DorjiReportRow = TailorDorji & {
  ordersCount: number
  totalEarned: number
  completedOrders: number
}

interface DorjisReportData {
  dorjis: DorjiReportRow[]
}

function DorjisReport({ formatCurrency }: { formatCurrency: (n: number) => string }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [data, setData] = useState<DorjisReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    tailorApi.getDorjisReport({ date_from: dateFrom, date_to: dateTo })
      .then(r => setData(r.data))
      .catch(() => toast.error("Failed to load dorjis report"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const dorjis = data?.dorjis ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">From</Label>
          <Input type="date" className="h-9 w-36 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">To</Label>
          <Input type="date" className="h-9 w-36 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Apply"}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Speciality</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Total Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : dorjis.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Users className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-gray-400">No dorji data for this period</p>
                  </td>
                </tr>
              ) : dorjis.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{d.name}</td>
                  <td className="px-4 py-3 text-gray-500">{d.phone}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(d.speciality ?? []).length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (d.speciality ?? []).map(s => (
                        <Badge key={s} className="bg-purple-100 text-purple-700 text-xs">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {d.commissionType === "percentage" ? `${d.commissionValue}%` : formatCurrency(d.commissionValue)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-semibold">{d.ordersCount}</td>
                  <td className="px-4 py-3 text-green-700 font-semibold">{d.completedOrders}</td>
                  <td className="px-4 py-3 font-bold text-purple-700">{formatCurrency(d.totalEarned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TailorReportsPage() {
  const { canRead } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const [tab, setTab] = useState<Tab>("orders")

  if (!canRead("TailorReports")) return <AccessDenied />

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "orders",  label: "Orders Report",  icon: <BarChart2 className="w-4 h-4" /> },
    { key: "fabrics", label: "Fabrics Report",  icon: <Package className="w-4 h-4" /> },
    { key: "dorjis",  label: "Dorjis Report",   icon: <Users className="w-4 h-4" /> },
  ]

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500">Analytics and summaries for your tailor shop</p>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "orders"  && <OrdersReport  formatCurrency={formatCurrency} />}
      {tab === "fabrics" && <FabricsReport formatCurrency={formatCurrency} />}
      {tab === "dorjis"  && <DorjisReport  formatCurrency={formatCurrency} />}
    </div>
  )
}
