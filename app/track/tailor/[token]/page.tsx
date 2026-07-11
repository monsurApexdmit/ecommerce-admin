"use client"

import { useEffect, useState } from "react"
import { use } from "react"
import { CheckCircle, Clock, Truck, Package, Scissors, AlertCircle, XCircle } from "lucide-react"

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; step: number }> = {
  pending:          { label: "Order Received",    icon: Clock,         color: "#d97706", bg: "#fef3c7", step: 1 },
  measurement_taken:{ label: "Measurements Taken",icon: Scissors,      color: "#2563eb", bg: "#dbeafe", step: 2 },
  assigned:         { label: "Assigned to Tailor",icon: Package,       color: "#7c3aed", bg: "#ede9fe", step: 3 },
  cutting:          { label: "Cutting",           icon: Scissors,      color: "#0891b2", bg: "#e0f2fe", step: 4 },
  stitching:        { label: "Stitching",         icon: Scissors,      color: "#7c3aed", bg: "#ede9fe", step: 5 },
  ready:            { label: "Ready for Pickup",  icon: CheckCircle,   color: "#16a34a", bg: "#dcfce7", step: 6 },
  delivered:        { label: "Delivered",         icon: Truck,         color: "#059669", bg: "#d1fae5", step: 7 },
  cancelled:        { label: "Cancelled",         icon: XCircle,       color: "#dc2626", bg: "#fee2e2", step: 0 },
}

const STEPS = ["pending","measurement_taken","assigned","cutting","stitching","ready","delivered"]

interface TrackingData {
  order_number: string
  order_status: string
  payment_status: string
  order_date?: string
  delivery_date?: string
  total_amount: number
  paid_amount: number
  due_amount: number
  customer_name?: string
  notes?: string
  status_logs: { from?: string; to: string; note?: string; date: string }[]
}

export default function TailorTrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/proxy/tailor/track/${token}`)
      .then(r => r.json())
      .then(r => {
        if (r.success) setData(r.data)
        else setError("Order not found")
      })
      .catch(() => setError("Failed to load order"))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">Loading order status…</p>
      </div>
    </div>
  )

  if (error || !data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Order Not Found</h1>
        <p className="text-gray-500 text-sm">{error ?? "This tracking link is invalid or expired."}</p>
      </div>
    </div>
  )

  const cfg = STATUS_CONFIG[data.order_status] ?? STATUS_CONFIG.pending
  const StatusIcon = cfg.icon
  const currentStep = cfg.step
  const cancelled = data.order_status === "cancelled"

  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(n)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Scissors className="w-6 h-6 text-purple-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Order Tracking</h1>
          <p className="text-gray-500 text-sm mt-1">{data.order_number}</p>
          {data.customer_name && <p className="text-gray-700 font-semibold mt-1">{data.customer_name}</p>}
        </div>

        {/* Status card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: cfg.bg }}>
            <StatusIcon className="w-8 h-8" style={{ color: cfg.color }} />
          </div>
          <p className="text-xs font-700 uppercase tracking-wider text-gray-400 mb-1">Current Status</p>
          <p className="text-2xl font-black" style={{ color: cfg.color }}>{cfg.label}</p>

          {data.delivery_date && !cancelled && (
            <p className="text-sm text-gray-500 mt-3">
              Estimated delivery: <strong>{new Date(data.delivery_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong>
            </p>
          )}
        </div>

        {/* Progress bar */}
        {!cancelled && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Progress</p>
            <div className="relative">
              <div className="flex justify-between mb-2">
                {STEPS.map((s, i) => {
                  const done = i + 1 <= currentStep
                  const active = i + 1 === currentStep
                  return (
                    <div key={s} className="flex flex-col items-center gap-1 flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                        done ? "bg-purple-600 border-purple-600 text-white" :
                        active ? "border-purple-600 text-purple-600 bg-white" :
                        "border-gray-200 text-gray-300 bg-white"
                      }`}>
                        {done && !active ? "✓" : i + 1}
                      </div>
                      <span className={`text-[9px] font-semibold text-center leading-tight ${done ? "text-purple-600" : "text-gray-300"}`}>
                        {STATUS_CONFIG[s]?.label.split(" ")[0]}
                      </span>
                    </div>
                  )
                })}
              </div>
              {/* connector line */}
              <div className="absolute top-3.5 left-3 right-3 h-0.5 bg-gray-200 -z-10">
                <div
                  className="h-full bg-purple-600 transition-all"
                  style={{ width: `${Math.max(0, ((currentStep - 1) / (STEPS.length - 1)) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Payment summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Payment</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total</span>
              <span className="font-bold text-gray-900">{fmt(data.total_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Paid</span>
              <span className="font-bold text-green-600">{fmt(data.paid_amount)}</span>
            </div>
            {data.due_amount > 0 && (
              <div className="flex justify-between text-sm border-t pt-2 mt-2">
                <span className="text-gray-500 font-semibold">Due</span>
                <span className="font-black text-red-600">{fmt(data.due_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Payment Status</span>
              <span className={`font-bold capitalize ${
                data.payment_status === "paid" ? "text-green-600" :
                data.payment_status === "partial" ? "text-yellow-600" : "text-red-600"
              }`}>{data.payment_status}</span>
            </div>
          </div>
        </div>

        {/* Status history */}
        {data.status_logs.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">History</p>
            <div className="space-y-3">
              {[...data.status_logs].reverse().map((log, i) => {
                const lcfg = STATUS_CONFIG[log.to]
                return (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: lcfg?.bg ?? "#f3f4f6" }}>
                      {lcfg?.icon && <lcfg.icon className="w-4 h-4" style={{ color: lcfg.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{lcfg?.label ?? log.to}</p>
                      {log.note && <p className="text-xs text-gray-500 mt-0.5">{log.note}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(log.date).toLocaleString()}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">Powered by Tailor Shop Management</p>
      </div>
    </div>
  )
}
