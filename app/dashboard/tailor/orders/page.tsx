"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Search, Plus, Filter, Eye, ChevronDown, Package, CreditCard, Printer } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  tailorApi, TailorOrder, TailorOrderStatus,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_STATUS_COLORS,
} from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { saasCompanyApi, CompanyProfile } from "@/lib/saasCompanyApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { toast } from "sonner"

const ORDER_STATUSES: TailorOrderStatus[] = [
  "pending", "measurement_taken", "assigned", "cutting", "stitching", "ready", "delivered", "cancelled",
]

const TODAY = new Date().toDateString()

function isOverdue(deliveryDate?: string, status?: TailorOrderStatus) {
  if (!deliveryDate) return false
  if (status === "delivered" || status === "cancelled") return false
  return new Date(deliveryDate) < new Date(TODAY)
}

export default function TailorOrdersPage() {
  const { canRead, canWrite } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)
  const router = useRouter()

  const [orders, setOrders] = useState<TailorOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [orderStatus, setOrderStatus] = useState("all")
  const [paymentStatus, setPaymentStatus] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, lastPage: 1, total: 0 })
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [paymentOrder, setPaymentOrder] = useState<TailorOrder | null>(null)
  const [paymentForm, setPaymentForm] = useState({ amount: 0, payment_method: "Cash", payment_date: new Date().toISOString().split("T")[0], reference: "", notes: "" })
  const [paymentSaving, setPaymentSaving] = useState(false)

  if (!canRead("TailorOrders")) return <AccessDenied />

  const load = (p = page) => {
    setLoading(true)
    tailorApi.getOrders({
      search: search || undefined,
      order_status: orderStatus !== "all" ? orderStatus : undefined,
      payment_status: paymentStatus !== "all" ? paymentStatus : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page: p,
      per_page: 20,
    })
      .then(r => {
        setOrders(r.data?.data ?? [])
        setPagination(r.data?.pagination ?? { page: 1, lastPage: 1, total: 0 })
      })
      .catch(() => toast.error("Failed to load orders"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setPage(1); load(1)
    saasCompanyApi.getProfile().then(r => setCompanyProfile(r.data)).catch(() => {})
  }, [search, orderStatus, paymentStatus, dateFrom, dateTo])
  useEffect(() => { load(page) }, [page])

  const handleStatusChange = async (order: TailorOrder, status: TailorOrderStatus) => {
    setUpdatingId(order.id)
    try {
      await tailorApi.updateOrderStatus(order.id, status)
      toast.success("Status updated")
      load(page)
    } catch {
      toast.error("Failed to update status")
    } finally {
      setUpdatingId(null)
    }
  }

  const openPayment = (o: TailorOrder) => {
    setPaymentOrder(o)
    setPaymentForm({ amount: o.dueAmount > 0 ? o.dueAmount : 0, payment_method: "Cash", payment_date: new Date().toISOString().split("T")[0], reference: "", notes: "" })
  }

  const handleRecordPayment = async () => {
    if (!paymentOrder) return
    if (!paymentForm.amount || paymentForm.amount <= 0) { toast.error("Enter a valid amount"); return }
    if (!paymentForm.payment_date) { toast.error("Payment date required"); return }
    setPaymentSaving(true)
    try {
      await tailorApi.createPayment({
        orderId: paymentOrder.id,
        amount: paymentForm.amount,
        paymentMethod: paymentForm.payment_method,
        paymentDate: paymentForm.payment_date,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
      })
      toast.success("Payment recorded")
      setPaymentOrder(null)
      load(page)
    } catch {
      toast.error("Failed to record payment")
    } finally {
      setPaymentSaving(false)
    }
  }

  const handlePrintInvoice = (o: TailorOrder) => {
    const companyName = companyProfile?.name ?? "Tailor Shop"
    const companyPhone = companyProfile?.phone ?? ""
    const companyAddress = companyProfile?.address ?? ""
    const fabricTotal = (o.items ?? []).reduce((s, i) => s + (i.fabricQuantity ?? 0) * (i.fabricUnitPrice ?? 0), 0)
    const itemsHtml = (o.items ?? []).map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td style="text-transform:capitalize">${(item.productType ?? "").replace(/_/g, " ")}</td>
        <td>${item.fabric?.name ?? "—"}</td>
        <td style="text-align:center">${item.fabricQuantity} ${item.fabric?.unit ?? ""}</td>
        <td style="text-align:right">${formatCurrency(item.fabricUnitPrice ?? 0)}</td>
        <td style="text-align:right;font-weight:600;color:#ef4444">${formatCurrency((item.fabricQuantity ?? 0) * (item.fabricUnitPrice ?? 0))}</td>
      </tr>`).join("")
    const payBadgeColor = o.paymentStatus === "paid" ? "#16a34a" : o.paymentStatus === "partial" ? "#ca8a04" : "#dc2626"
    const payBgColor = o.paymentStatus === "paid" ? "#dcfce7" : o.paymentStatus === "partial" ? "#fef9c3" : "#fee2e2"
    const trackingUrl = o.trackingToken ? `${window.location.origin}/track/tailor/${o.trackingToken}` : null
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
        <title>Invoice ${o.orderNumber}</title>
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
              <div class="invoice-num">${o.orderNumber}</div>
              <div style="margin-top:8px">
                <span class="badge">${ORDER_STATUS_LABELS[o.orderStatus]}</span>
                &nbsp;<span class="pay-badge">${o.paymentStatus}</span>
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
              <p class="big">${o.customer?.name ?? "—"}</p>
              ${o.customer?.phone ? `<p>${o.customer.phone}</p>` : ""}
              ${o.customer?.address ? `<p>${o.customer.address}</p>` : ""}
            </div>
            <div class="meta-box">
              <h3>Order Date</h3>
              <p class="big">${o.orderDate ? new Date(o.orderDate).toLocaleDateString() : "—"}</p>
            </div>
            <div class="meta-box">
              <h3>Delivery Date</h3>
              <p class="big">${o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : "—"}</p>
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
            <tbody>${itemsHtml || '<tr><td colspan="6" style="text-align:center;color:#9ca3af">No items</td></tr>'}</tbody>
          </table>
          <div class="totals">
            <div class="trow"><span>Fabric Total</span><span>${formatCurrency(fabricTotal)}</span></div>
            <div class="trow"><span>Stitching</span><span>+ ${formatCurrency(o.stitchingCharge ?? 0)}</span></div>
            ${(o.extraCharge ?? 0) > 0 ? `<div class="trow"><span>Extra</span><span>+ ${formatCurrency(o.extraCharge ?? 0)}</span></div>` : ""}
            ${(o.discount ?? 0) > 0 ? `<div class="trow"><span>Discount</span><span>− ${formatCurrency(o.discount ?? 0)}</span></div>` : ""}
            <div class="trow grand"><span>Grand Total</span><span>${formatCurrency(o.totalAmount ?? 0)}</span></div>
            <div class="trow paid"><span>Paid</span><span>${formatCurrency(o.paidAmount ?? 0)}</span></div>
            ${(o.dueAmount ?? 0) > 0 ? `<div class="trow due"><span>Due</span><span>${formatCurrency(o.dueAmount ?? 0)}</span></div>` : ""}
          </div>
          ${qrSection}
          <div class="footer">Thank you for your business · ${companyName}</div>
        </div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Tailor Orders</h1>
          <p className="text-sm text-gray-500">{pagination.total} orders</p>
        </div>
        {canWrite("TailorOrders") && (
          <Button className="bg-purple-600 hover:bg-purple-700 gap-2" onClick={() => router.push("/dashboard/tailor/orders/new")}>
            <Plus className="w-4 h-4" /> Add Order
          </Button>
        )}
      </div>

      {/* Search + status bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search by name or phone..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={orderStatus} onValueChange={setOrderStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ORDER_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={paymentStatus} onValueChange={setPaymentStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2" onClick={() => setFiltersOpen(v => !v)}>
          <Filter className="w-4 h-4" /> Filters <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {/* Collapsible date filters */}
      {filtersOpen && (
        <Card className="p-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Delivery Date From</p>
              <Input type="date" className="w-44" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Delivery Date To</p>
              <Input type="date" className="w-44" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => { setDateFrom(""); setDateTo("") }}>
                Clear dates
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Delivery</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={11} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : orders.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-16 text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  No orders found
                </td></tr>
              ) : orders.map(o => {
                const overdue = isOverdue(o.deliveryDate, o.orderStatus)
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/tailor/orders/${o.id}`} className="font-mono text-purple-600 hover:text-purple-800 text-xs font-semibold">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{o.customer?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{o.customer?.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{o.items?.length ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(o.totalAmount)}</td>
                    <td className="px-4 py-3 text-green-700">{formatCurrency(o.paidAmount)}</td>
                    <td className={`px-4 py-3 font-semibold ${o.dueAmount > 0 ? "text-red-600" : "text-gray-500"}`}>
                      {formatCurrency(o.dueAmount)}
                    </td>
                    <td className={`px-4 py-3 text-xs ${overdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                      {o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : "—"}
                      {overdue && <p className="text-red-500">Overdue</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={ORDER_STATUS_COLORS[o.orderStatus]}>
                        {ORDER_STATUS_LABELS[o.orderStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={PAYMENT_STATUS_COLORS[o.paymentStatus]}>
                        {o.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/tailor/orders/${o.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-purple-600" title="Print Invoice" onClick={() => handlePrintInvoice(o)}>
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                        {canWrite("TailorOrders") && o.paymentStatus !== "paid" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={() => openPayment(o)} title="Record Payment">
                            <CreditCard className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {canWrite("TailorOrders") && (
                          <Select
                            value={o.orderStatus}
                            onValueChange={(v) => handleStatusChange(o, v as TailorOrderStatus)}
                            disabled={updatingId === o.id}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs px-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ORDER_STATUSES.map(s => (
                                <SelectItem key={s} value={s} className="text-xs">{ORDER_STATUS_LABELS[s]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && orders.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-sm text-gray-500">Page {pagination.page} of {pagination.lastPage}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pagination.lastPage} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
      {/* ── RECORD PAYMENT MODAL ── */}
      <Dialog open={!!paymentOrder} onOpenChange={open => { if (!open) setPaymentOrder(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            {paymentOrder && (
              <p className="text-xs text-gray-500 mt-0.5">
                {paymentOrder.orderNumber} · Due: {formatCurrency(paymentOrder.dueAmount)}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Amount</Label>
              <Input type="number" min={0} value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Payment Method</Label>
              <Select value={paymentForm.payment_method} onValueChange={v => setPaymentForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Cash", "Bank Transfer", "Mobile Banking", "Card"].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Payment Date</Label>
              <Input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Reference (optional)</Label>
              <Input placeholder="Transaction ref, cheque no..." value={paymentForm.reference} onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOrder(null)} disabled={paymentSaving}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleRecordPayment} disabled={paymentSaving}>
              {paymentSaving ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
