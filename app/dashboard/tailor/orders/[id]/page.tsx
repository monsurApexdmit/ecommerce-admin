"use client"

import { useEffect, useState, useCallback, use } from "react"
import Link from "next/link"
import {
  ArrowLeft, Edit2, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Plus, CreditCard, User, Package, Ruler, ClipboardList, Users, Printer,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  tailorApi, TailorOrder, TailorDorji, TailorMeasurement, TailorOrderStatus, TailorWorkStatus,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_STATUS_COLORS, WORK_STATUS_LABELS,
} from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { saasCompanyApi, CompanyProfile } from "@/lib/saasCompanyApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { toast } from "sonner"

const ALL_STATUSES: TailorOrderStatus[] = [
  "pending", "measurement_taken", "assigned", "cutting", "stitching", "ready", "delivered", "cancelled",
]

const WORK_STATUSES: TailorWorkStatus[] = ["assigned", "in_progress", "completed", "returned"]
const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Mobile Banking", "Card"]

function isOverdue(deliveryDate?: string, status?: TailorOrderStatus) {
  if (!deliveryDate || status === "delivered" || status === "cancelled") return false
  return new Date(deliveryDate) < new Date()
}

export default function TailorOrderDetailPage({ params: paramsProp }: { params: Promise<{ id: string }> }) {
  const params = use(paramsProp)
  const { canRead, canWrite } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)

  const [order, setOrder] = useState<TailorOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [dorjis, setDorjis] = useState<TailorDorji[]>([])
  const [measurementsOpen, setMeasurementsOpen] = useState(false)
  const [customerMeasurements, setCustomerMeasurements] = useState<TailorMeasurement[]>([])

  // Status update dialog
  const [statusOpen, setStatusOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<TailorOrderStatus>("pending")
  const [statusNote, setStatusNote] = useState("")
  const [statusSaving, setStatusSaving] = useState(false)

  // Assign dorji modal
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignForm, setAssignForm] = useState({ dorji_id: "", assigned_date: "", expected_completion: "", dorji_charge: 0, work_status: "assigned" as TailorWorkStatus })
  const [assignSaving, setAssignSaving] = useState(false)

  // Record payment modal
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState({ amount: 0, payment_method: "Cash", payment_date: "", reference: "", notes: "" })
  const [paymentSaving, setPaymentSaving] = useState(false)

  // Inline work status update
  const [updatingAssignId, setUpdatingAssignId] = useState<number | null>(null)

  if (!canRead("TailorOrders")) return <AccessDenied />

  const load = useCallback(() => {
    setLoading(true)
    tailorApi.getOrder(+params.id)
      .then(r => {
        const o: TailorOrder = r.data?.data ?? r.data
        setOrder(o)
        setNewStatus(o.orderStatus)
        if (o.customerId) {
          tailorApi.getMeasurementsByCustomer(o.customerId)
            .then(mr => setCustomerMeasurements(mr.data?.data ?? mr.data ?? []))
            .catch(() => {})
        }
      })
      .catch(() => toast.error("Failed to load order"))
      .finally(() => setLoading(false))
  }, [params.id])

  useEffect(() => {
    load()
    tailorApi.getDorjis({ limit: 100, status: "active" })
      .then(r => setDorjis(r.data?.data ?? r.data ?? []))
      .catch(() => {})
    saasCompanyApi.getProfile().then(r => setCompanyProfile(r.data)).catch(() => {})
  }, [load])

  const handleStatusUpdate = async () => {
    if (!order) return
    setStatusSaving(true)
    try {
      await tailorApi.updateOrderStatus(order.id, newStatus, statusNote || undefined)
      toast.success("Status updated")
      setStatusOpen(false)
      setStatusNote("")
      load()
    } catch {
      toast.error("Failed to update status")
    } finally {
      setStatusSaving(false)
    }
  }

  const handleAssignSave = async () => {
    if (!order || !assignForm.dorji_id) { toast.error("Select a dorji"); return }
    setAssignSaving(true)
    try {
      await tailorApi.createAssignment({
        orderId: order.id,
        dorjiId: +assignForm.dorji_id,
        assignedDate: assignForm.assigned_date,
        expectedCompletion: assignForm.expected_completion || undefined,
        dorjiCharge: assignForm.dorji_charge,
        workStatus: assignForm.work_status,
      })
      toast.success("Dorji assigned")
      setAssignOpen(false)
      setAssignForm({ dorji_id: "", assigned_date: "", expected_completion: "", dorji_charge: 0, work_status: "assigned" })
      load()
    } catch {
      toast.error("Failed to assign dorji")
    } finally {
      setAssignSaving(false)
    }
  }

  const handleWorkStatusUpdate = async (assignId: number, ws: TailorWorkStatus) => {
    setUpdatingAssignId(assignId)
    try {
      await tailorApi.updateAssignment(assignId, { workStatus: ws })
      toast.success("Work status updated")
      load()
    } catch {
      toast.error("Failed to update work status")
    } finally {
      setUpdatingAssignId(null)
    }
  }

  const handlePaymentSave = async () => {
    if (!order) return
    if (!paymentForm.amount || paymentForm.amount <= 0) { toast.error("Enter a valid amount"); return }
    if (!paymentForm.payment_date) { toast.error("Payment date required"); return }
    setPaymentSaving(true)
    try {
      await tailorApi.createPayment({
        orderId: order.id,
        amount: paymentForm.amount,
        paymentMethod: paymentForm.payment_method,
        paymentDate: paymentForm.payment_date,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      })
      toast.success("Payment recorded")
      setPaymentOpen(false)
      setPaymentForm({ amount: 0, payment_method: "Cash", payment_date: "", reference: "", notes: "" })
      load()
    } catch {
      toast.error("Failed to record payment")
    } finally {
      setPaymentSaving(false)
    }
  }

  const handlePrintInvoice = () => {
    if (!order) return
    const companyName = companyProfile?.name ?? "Tailor Shop"
    const companyPhone = companyProfile?.phone ?? ""
    const companyAddress = companyProfile?.address ?? ""
    const fabricTotal = (order.items ?? []).reduce((s, i) => s + (i.fabricQuantity ?? 0) * (i.fabricUnitPrice ?? 0), 0)
    const itemsHtml = (order.items ?? []).map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="text-transform:capitalize">${(item.productType ?? "").replace(/_/g, " ")}</td>
        <td>${item.fabric?.name ?? "—"}</td>
        <td style="text-align:center">${item.fabricQuantity} ${item.fabric?.unit ?? ""}</td>
        <td style="text-align:right">${formatCurrency(item.fabricUnitPrice ?? 0)}</td>
        <td style="text-align:right;font-weight:600;color:#ef4444">${formatCurrency((item.fabricQuantity ?? 0) * (item.fabricUnitPrice ?? 0))}</td>
      </tr>`).join("")
    const paymentsHtml = (order.payments ?? []).length > 0 ? `
      <h3 style="font-size:12px;color:#6b7280;text-transform:uppercase;font-weight:600;margin:32px 0 12px">Payment History</h3>
      <table>
        <thead><tr>
          <th>Date</th><th>Method</th><th>Reference</th><th style="text-align:right">Amount</th>
        </tr></thead>
        <tbody>
          ${(order.payments ?? []).map(p => `<tr>
            <td>${p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "—"}</td>
            <td>${p.paymentMethod}</td>
            <td>${p.reference ?? "—"}</td>
            <td style="text-align:right;font-weight:600">${formatCurrency(p.amount)}</td>
          </tr>`).join("")}
        </tbody>
      </table>` : ""
    const payBadgeColor = order.paymentStatus === "paid" ? "#16a34a" : order.paymentStatus === "partial" ? "#ca8a04" : "#dc2626"
    const payBgColor = order.paymentStatus === "paid" ? "#dcfce7" : order.paymentStatus === "partial" ? "#fef9c3" : "#fee2e2"
    const trackingUrl = order.trackingToken ? `${window.location.origin}/track/tailor/${order.trackingToken}` : null
    const qrSection = trackingUrl ? `
      <div class="qr-section">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(trackingUrl)}" width="120" height="120" alt="QR Code" />
        <div class="qr-label">Scan to track your order</div>
        <div class="qr-url">${trackingUrl}</div>
      </div>` : ""
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow.document.write(`
      <html><head>
        <title>Invoice ${order.orderNumber}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:Arial,sans-serif; padding:40px; color:#374151; line-height:1.6; }
          .invoice-container { max-width:900px; margin:0 auto; background:white; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; border-bottom:2px solid #7c3aed; padding-bottom:24px; }
          .invoice-title { font-size:32px; font-weight:900; color:#111; letter-spacing:-1px; }
          .invoice-num { font-size:14px; color:#6b7280; margin-top:4px; }
          .company-info { text-align:right; }
          .company-name { font-size:20px; font-weight:800; color:#7c3aed; }
          .company-meta { font-size:12px; color:#6b7280; margin-top:4px; line-height:1.8; }
          .badge { display:inline-block; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; background:#ede9fe; color:#7c3aed; }
          .pay-badge { display:inline-block; padding:3px 10px; border-radius:99px; font-size:11px; font-weight:600; background:${payBgColor}; color:${payBadgeColor}; }
          .meta { display:grid; grid-template-columns:1fr 1fr 1fr; gap:24px; margin:32px 0; }
          .meta-box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px; }
          .meta-box h3 { font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px; }
          .meta-box p { font-size:13px; color:#111; }
          .meta-box .big { font-weight:700; font-size:14px; }
          table { width:100%; border-collapse:collapse; margin:24px 0; }
          thead { background:#7c3aed; }
          th { padding:12px 16px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; color:#fff; }
          td { padding:14px 16px; border-bottom:1px solid #f3f4f6; font-size:13px; }
          .totals { margin-left:auto; width:280px; margin-top:8px; }
          .trow { display:flex; justify-content:space-between; font-size:13px; padding:4px 0; }
          .trow.grand { font-size:16px; font-weight:800; color:#111; border-top:2px solid #7c3aed; margin-top:6px; padding-top:8px; }
          .trow.paid { color:#16a34a; }
          .trow.due { color:#dc2626; font-weight:700; }
          .footer { margin-top:40px; border-top:1px solid #e5e7eb; padding-top:16px; text-align:center; font-size:11px; color:#9ca3af; }
          .qr-section { display:flex; flex-direction:column; align-items:center; margin-top:32px; padding:20px; border:1px dashed #d8b4fe; border-radius:12px; background:#faf5ff; }
          .qr-label { margin-top:10px; font-size:12px; font-weight:700; color:#7c3aed; }
          .qr-url { margin-top:4px; font-size:10px; color:#9ca3af; word-break:break-all; text-align:center; }
          @media print { body { padding:20px; } @page { margin:12mm; size:A4; } }
        </style>
      </head><body>
        <div class="invoice-container">
          <div class="header">
            <div>
              <div class="invoice-title">INVOICE</div>
              <div class="invoice-num">${order.orderNumber}</div>
              <div style="margin-top:8px">
                <span class="badge">${ORDER_STATUS_LABELS[order.orderStatus]}</span>
                &nbsp;<span class="pay-badge">${order.paymentStatus}</span>
              </div>
            </div>
            <div class="company-info">
              <div class="company-name">${companyName}</div>
              <div class="company-meta">
                ${companyPhone ? `<div>${companyPhone}</div>` : ""}
                ${companyAddress ? `<div>${companyAddress}</div>` : ""}
              </div>
            </div>
          </div>
          <div class="meta">
            <div class="meta-box">
              <h3>Customer</h3>
              <p class="big">${order.customer?.name ?? "—"}</p>
              ${order.customer?.phone ? `<p>${order.customer.phone}</p>` : ""}
              ${order.customer?.address ? `<p>${order.customer.address}</p>` : ""}
            </div>
            <div class="meta-box">
              <h3>Order Date</h3>
              <p class="big">${order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "—"}</p>
            </div>
            <div class="meta-box">
              <h3>Delivery Date</h3>
              <p class="big">${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—"}</p>
              ${order.notes ? `<p style="color:#6b7280;font-size:12px;margin-top:4px">${order.notes}</p>` : ""}
            </div>
          </div>
          <table>
            <thead><tr>
              <th style="width:40px">SR.</th>
              <th>Product Type</th>
              <th>Fabric</th>
              <th style="text-align:center;width:110px">Qty / Unit</th>
              <th style="text-align:right;width:110px">Unit Price</th>
              <th style="text-align:right;width:110px">Amount</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="totals">
            <div class="trow"><span>Fabric Total</span><span>${formatCurrency(fabricTotal)}</span></div>
            <div class="trow"><span>Stitching</span><span>+ ${formatCurrency(order.stitchingCharge ?? 0)}</span></div>
            ${(order.extraCharge ?? 0) > 0 ? `<div class="trow"><span>Extra</span><span>+ ${formatCurrency(order.extraCharge ?? 0)}</span></div>` : ""}
            ${(order.discount ?? 0) > 0 ? `<div class="trow"><span>Discount</span><span>− ${formatCurrency(order.discount ?? 0)}</span></div>` : ""}
            <div class="trow grand"><span>Grand Total</span><span>${formatCurrency(order.totalAmount ?? 0)}</span></div>
            <div class="trow paid"><span>Paid</span><span>${formatCurrency(order.paidAmount ?? 0)}</span></div>
            ${(order.dueAmount ?? 0) > 0 ? `<div class="trow due"><span>Due</span><span>${formatCurrency(order.dueAmount ?? 0)}</span></div>` : ""}
          </div>
          ${paymentsHtml}
          ${qrSection}
          <div class="footer">Thank you for your business · ${companyName}</div>
        </div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const todayStr = new Date().toISOString().split("T")[0]
  const overdue = order ? isOverdue(order.deliveryDate, order.orderStatus) : false
  const currentStatusIdx = order ? ALL_STATUSES.indexOf(order.orderStatus) : -1

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    )
  }

  if (!order) {
    return <div className="p-6 text-center text-gray-400">Order not found.</div>
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-16">
      {/* ── HEADER ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/tailor/orders" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-black text-gray-900">{order.orderNumber}</span>
              <Badge className={ORDER_STATUS_COLORS[order.orderStatus]}>{ORDER_STATUS_LABELS[order.orderStatus]}</Badge>
            </div>
            <p className="text-sm text-gray-500">Created {new Date(order.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handlePrintInvoice}>
            <Printer className="w-4 h-4" /> Print Invoice
          </Button>
          {canWrite("TailorOrders") && (
            <>
              <Link href={`/dashboard/tailor/orders/${params.id}/edit`}>
                <Button variant="outline" className="gap-2">
                  <Edit2 className="w-4 h-4" /> Edit Order
                </Button>
              </Link>
              <Button
                className="bg-purple-600 hover:bg-purple-700 gap-2"
                onClick={() => { setNewStatus(order.orderStatus); setStatusOpen(true) }}
              >
                <CheckCircle2 className="w-4 h-4" /> Update Status
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── STATUS TIMELINE ── */}
      <Card className="p-5 overflow-x-auto">
        <div className="flex items-center min-w-max gap-0">
          {ALL_STATUSES.map((s, i) => {
            const done = i < currentStatusIdx
            const current = i === currentStatusIdx
            const last = i === ALL_STATUSES.length - 1
            return (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    current ? "bg-purple-600 border-purple-600 text-white" :
                    done ? "bg-purple-200 border-purple-300 text-purple-700" :
                    "bg-gray-100 border-gray-200 text-gray-400"
                  }`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`text-xs text-center max-w-16 leading-tight ${current ? "text-purple-700 font-semibold" : done ? "text-purple-500" : "text-gray-400"}`}>
                    {ORDER_STATUS_LABELS[s]}
                  </span>
                </div>
                {!last && (
                  <div className={`h-0.5 w-8 mx-1 mb-4 ${i < currentStatusIdx ? "bg-purple-300" : "bg-gray-200"}`} />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── CUSTOMER + SUMMARY ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Customer</h2>
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="font-semibold text-gray-900">{order.customer?.name ?? "—"}</p>
            <p className="text-gray-500">{order.customer?.phone ?? "—"}</p>
            {order.customer?.address && <p className="text-gray-500">{order.customer.address}</p>}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Summary</h2>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Order Date</span>
              <span>{new Date(order.orderDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Delivery Date</span>
              <span className={overdue ? "text-red-600 font-semibold" : ""}>
                {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—"}
                {overdue && " (Overdue)"}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Fabric Total</span><span>{formatCurrency(order.totalAmount - order.stitchingCharge - order.extraCharge + order.discount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Stitching</span><span>+ {formatCurrency(order.stitchingCharge)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Extra</span><span>+ {formatCurrency(order.extraCharge)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>− {formatCurrency(order.discount)}</span></div>
            <div className="flex justify-between font-bold border-t pt-1.5 mt-1 text-gray-900">
              <span>Grand Total</span><span className="text-purple-700">{formatCurrency(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-green-700"><span>Paid</span><span>{formatCurrency(order.paidAmount)}</span></div>
            <div className={`flex justify-between font-semibold ${order.dueAmount > 0 ? "text-red-600" : "text-gray-500"}`}>
              <span>Due</span><span>{formatCurrency(order.dueAmount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Payment</span>
              <Badge className={PAYMENT_STATUS_COLORS[order.paymentStatus]}>{order.paymentStatus}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* ── ORDER ITEMS ── */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b">
          <Package className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Order Items</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Product Type</th>
                <th className="px-4 py-3">Fabric</th>
                <th className="px-4 py-3">Qty / Unit</th>
                <th className="px-4 py-3">Unit Price</th>
                <th className="px-4 py-3">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(order.items ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No items</td></tr>
              ) : (order.items ?? []).map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{item.productType}</td>
                  <td className="px-4 py-3 text-gray-600">{item.fabric?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{item.fabricQuantity} {item.fabric?.unit ?? ""}</td>
                  <td className="px-4 py-3">{formatCurrency(item.fabricUnitPrice)}</td>
                  <td className="px-4 py-3 font-semibold text-purple-700">{formatCurrency(item.fabricQuantity * item.fabricUnitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── MEASUREMENTS ── */}
      <Card className="overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
          onClick={() => setMeasurementsOpen(v => !v)}
        >
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">Customer Measurements</span>
            <Badge className="bg-gray-100 text-gray-500">{customerMeasurements.length}</Badge>
          </div>
          {measurementsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {measurementsOpen && (
          <div className="border-t p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {customerMeasurements.length === 0 ? (
              <div className="col-span-2 text-center py-4">
                <p className="text-sm text-gray-400">No measurements recorded for this customer.</p>
                <Link href="/dashboard/tailor/measurements" className="text-xs text-purple-600 hover:underline mt-1 inline-block">
                  Add measurements →
                </Link>
              </div>
            ) : customerMeasurements.map(m => (
              <div key={m.id} className="border rounded-lg p-3 bg-gray-50 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-800 capitalize">{m.productType?.replace(/_/g, " ")}</p>
                  <p className="text-gray-400 text-[10px]">{new Date(m.measuredAt).toLocaleDateString()}</p>
                </div>
                <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-gray-600 mt-1">
                  {m.chest && <span>Chest: {m.chest}</span>}
                  {m.waist && <span>Waist: {m.waist}</span>}
                  {m.hip && <span>Hip: {m.hip}</span>}
                  {m.shoulder && <span>Shoulder: {m.shoulder}</span>}
                  {m.sleeve && <span>Sleeve: {m.sleeve}</span>}
                  {m.length && <span>Length: {m.length}</span>}
                  {m.neck && <span>Neck: {m.neck}</span>}
                  {m.inseam && <span>Inseam: {m.inseam}</span>}
                  {m.bottomLength && <span>Bottom L: {m.bottomLength}</span>}
                  {m.pajamaWaist && <span>Paj. Waist: {m.pajamaWaist}</span>}
                  {m.pajamaLength && <span>Paj. Length: {m.pajamaLength}</span>}
                </div>
                {m.notes && <p className="text-gray-400 italic">{m.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── ASSIGNMENTS ── */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Assignments</h2>
          </div>
          {canWrite("TailorOrders") && (
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 gap-1.5" onClick={() => setAssignOpen(true)}>
              <Plus className="w-3.5 h-3.5" /> Assign Dorji
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Dorji</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Expected</th>
                <th className="px-4 py-3">Charge</th>
                <th className="px-4 py-3">Work Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(order.assignments ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No dorji assigned</td></tr>
              ) : (order.assignments ?? []).map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{a.dorji?.name ?? `Dorji #${a.dorjiId}`}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(a.assignedDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-500">{a.expectedCompletion ? new Date(a.expectedCompletion).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">{formatCurrency(a.dorjiCharge)}</td>
                  <td className="px-4 py-3">
                    {canWrite("TailorOrders") ? (
                      <Select
                        value={a.workStatus}
                        onValueChange={v => handleWorkStatusUpdate(a.id, v as TailorWorkStatus)}
                        disabled={updatingAssignId === a.id}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_STATUSES.map(ws => (
                            <SelectItem key={ws} value={ws} className="text-xs">{WORK_STATUS_LABELS[ws]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-700">{WORK_STATUS_LABELS[a.workStatus]}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── PAYMENTS ── */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Payments</h2>
          </div>
          {canWrite("TailorOrders") && (
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 gap-1.5"
              onClick={() => { setPaymentForm(f => ({ ...f, payment_date: todayStr, amount: order.dueAmount })); setPaymentOpen(true) }}
            >
              <Plus className="w-3.5 h-3.5" /> Record Payment
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(order.payments ?? []).length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No payments recorded</td></tr>
              ) : (order.payments ?? []).map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{new Date(p.paymentDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-600">{p.paymentMethod}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-gray-500">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{p.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── STATUS LOG ── */}
      {(order.statusLogs ?? []).length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Status Log</h2>
          </div>
          <div className="space-y-3">
            {(order.statusLogs ?? []).map((log, i) => (
              <div key={log.id} className="flex gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                  {i < (order.statusLogs ?? []).length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                </div>
                <div className="pb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {log.fromStatus && (
                      <>
                        <span className="text-gray-500 text-xs">{ORDER_STATUS_LABELS[log.fromStatus as TailorOrderStatus] ?? log.fromStatus}</span>
                        <span className="text-gray-300">→</span>
                      </>
                    )}
                    <span className="font-medium text-gray-800 text-xs">{ORDER_STATUS_LABELS[log.toStatus as TailorOrderStatus] ?? log.toStatus}</span>
                  </div>
                  {log.note && <p className="text-gray-500 text-xs mt-0.5">{log.note}</p>}
                  <p className="text-gray-400 text-[10px] mt-0.5">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── UPDATE STATUS DIALOG ── */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Update Order Status</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">New Status</Label>
              <Select value={newStatus} onValueChange={v => setNewStatus(v as TailorOrderStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Note (optional)</Label>
              <Input placeholder="Add a note..." value={statusNote} onChange={e => setStatusNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)} disabled={statusSaving}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleStatusUpdate} disabled={statusSaving}>
              {statusSaving ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ASSIGN DORJI MODAL ── */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Dorji</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Dorji *</Label>
              <Select value={assignForm.dorji_id} onValueChange={v => setAssignForm(f => ({ ...f, dorji_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select dorji..." /></SelectTrigger>
                <SelectContent>
                  {dorjis.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.name} {d.phone ? `(${d.phone})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Assigned Date</Label>
                <Input type="date" value={assignForm.assigned_date} onChange={e => setAssignForm(f => ({ ...f, assigned_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Expected Completion</Label>
                <Input type="date" value={assignForm.expected_completion} onChange={e => setAssignForm(f => ({ ...f, expected_completion: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Dorji Charge</Label>
                <Input type="number" min={0} value={assignForm.dorji_charge} onChange={e => setAssignForm(f => ({ ...f, dorji_charge: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Work Status</Label>
                <Select value={assignForm.work_status} onValueChange={v => setAssignForm(f => ({ ...f, work_status: v as TailorWorkStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORK_STATUSES.map(ws => (
                      <SelectItem key={ws} value={ws}>{WORK_STATUS_LABELS[ws]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={assignSaving}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleAssignSave} disabled={assignSaving}>
              {assignSaving ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── RECORD PAYMENT MODAL ── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between text-sm bg-gray-50 rounded-lg p-3">
              <span className="text-gray-600">Due Amount</span>
              <span className="font-bold text-red-600">{formatCurrency(order.dueAmount)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Amount *</Label>
                <Input
                  type="number"
                  min={0}
                  max={order.dueAmount}
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Method *</Label>
                <Select value={paymentForm.payment_method} onValueChange={v => setPaymentForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Payment Date *</Label>
              <Input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Reference</Label>
              <Input placeholder="Transaction ref, cheque no..." value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Notes</Label>
              <Input placeholder="Optional notes..." value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)} disabled={paymentSaving}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handlePaymentSave} disabled={paymentSaving}>
              {paymentSaving ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
