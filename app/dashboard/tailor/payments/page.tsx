"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Wallet, Plus, Printer } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { tailorApi, TailorPayment, TailorOrder } from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { saasCompanyApi, CompanyProfile } from "@/lib/saasCompanyApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { toast } from "sonner"

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Mobile Banking", "Card"]

const EMPTY_FORM = {
  order_id: "",
  amount: "",
  payment_method: "Cash",
  payment_date: new Date().toISOString().slice(0, 10),
  reference: "",
  notes: "",
}

export default function TailorPaymentsPage() {
  const { canRead, canWrite } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)

  const [payments, setPayments] = useState<TailorPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [methodFilter, setMethodFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [unpaidOrders, setUnpaidOrders] = useState<TailorOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  if (!canRead("TailorPayments")) return <AccessDenied />

  const load = () => {
    setLoading(true)
    tailorApi.getPayments({ limit: 100 })
      .then(r => setPayments(r.data?.data ?? r.data ?? []))
      .catch(() => toast.error("Failed to load payments"))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    saasCompanyApi.getProfile().then(r => setCompanyProfile(r.data)).catch(() => {})
  }, [])

  const handlePrintReceipt = (p: TailorPayment) => {
    const companyName = companyProfile?.name ?? "Tailor Shop"
    const companyPhone = companyProfile?.phone ?? ""
    const companyAddress = companyProfile?.address ?? ""
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow.document.write(`
      <html><head>
        <title>Receipt - ${p.order?.orderNumber ?? p.orderId}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:Arial,sans-serif; padding:40px; color:#374151; line-height:1.6; }
          .container { max-width:480px; margin:0 auto; background:white; }
          .header { text-align:center; border-bottom:2px solid #7c3aed; padding-bottom:20px; margin-bottom:24px; }
          .company-name { font-size:22px; font-weight:800; color:#7c3aed; }
          .company-meta { font-size:12px; color:#6b7280; margin-top:4px; line-height:1.8; }
          .receipt-title { font-size:14px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:1px; margin-top:8px; }
          .row { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f3f4f6; font-size:13px; }
          .row:last-child { border-bottom:none; }
          .label { color:#6b7280; }
          .value { font-weight:600; color:#111; }
          .amount-row { display:flex; justify-content:space-between; padding:14px 0; margin-top:8px; border-top:2px solid #7c3aed; }
          .amount-label { font-size:15px; font-weight:700; color:#111; }
          .amount-value { font-size:20px; font-weight:900; color:#16a34a; }
          .footer { margin-top:32px; text-align:center; font-size:11px; color:#9ca3af; border-top:1px solid #e5e7eb; padding-top:16px; }
          @media print { body { padding:20px; } @page { margin:12mm; size:A5; } }
        </style>
      </head><body>
        <div class="container">
          <div class="header">
            <div class="company-name">${companyName}</div>
            <div class="company-meta">
              ${companyPhone ? `<div>${companyPhone}</div>` : ""}
              ${companyAddress ? `<div>${companyAddress}</div>` : ""}
            </div>
            <div class="receipt-title">Payment Receipt</div>
          </div>
          <div class="row"><span class="label">Order #</span><span class="value">${p.order?.orderNumber ?? p.orderId}</span></div>
          <div class="row"><span class="label">Customer</span><span class="value">${p.order?.customer?.name ?? "—"}</span></div>
          <div class="row"><span class="label">Payment Date</span><span class="value">${p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "—"}</span></div>
          <div class="row"><span class="label">Method</span><span class="value">${p.paymentMethod}</span></div>
          ${p.reference ? `<div class="row"><span class="label">Reference</span><span class="value">${p.reference}</span></div>` : ""}
          ${p.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${p.notes}</span></div>` : ""}
          <div class="amount-row">
            <span class="amount-label">Amount Paid</span>
            <span class="amount-value">${formatCurrency(p.amount)}</span>
          </div>
          <div class="footer">Thank you · ${companyName}</div>
        </div>
      </body></html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const openModal = () => {
    setForm(EMPTY_FORM)
    setModalOpen(true)
    setLoadingOrders(true)
    tailorApi.getOrders({ limit: 200 })
      .then(r => setUnpaidOrders(r.data?.data ?? r.data ?? []))
      .catch(() => toast.error("Failed to load orders"))
      .finally(() => setLoadingOrders(false))
  }

  const handleSave = async () => {
    if (!form.order_id) { toast.error("Select an order"); return }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("Enter a valid amount"); return }
    setSaving(true)
    try {
      await tailorApi.createPayment({
        orderId: parseInt(form.order_id),
        amount: parseFloat(form.amount),
        paymentMethod: form.payment_method,
        paymentDate: form.payment_date,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      })
      toast.success("Payment recorded")
      setModalOpen(false)
      load()
    } catch {
      toast.error("Failed to record payment")
    } finally {
      setSaving(false)
    }
  }

  const setField = <K extends keyof typeof EMPTY_FORM>(k: K, v: string) =>
    setForm(f => ({ ...f, [k]: v }))

  const filtered = payments.filter(p => {
    if (methodFilter !== "all" && p.paymentMethod !== methodFilter) return false
    if (dateFrom && p.paymentDate < dateFrom) return false
    if (dateTo && p.paymentDate > dateTo) return false
    return true
  })

  const totalCollected = filtered.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500">{payments.length} total</p>
        </div>
        {canWrite("TailorPayments") && (
          <Button className="bg-purple-600 hover:bg-purple-700 gap-2" onClick={openModal}>
            <Plus className="w-4 h-4" /> Record Payment
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 max-w-sm">
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Total Collected</p>
          <p className="text-xl font-black text-green-700">{formatCurrency(totalCollected)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 mb-1">Transactions</p>
          <p className="text-xl font-black text-gray-900">{filtered.length}</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={methodFilter} onValueChange={setMethodFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All methods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Methods</SelectItem>
            {PAYMENT_METHODS.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">From</Label>
          <Input type="date" className="h-9 w-36 text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-gray-500">To</Label>
          <Input type="date" className="h-9 w-36 text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {(methodFilter !== "all" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setMethodFilter("all"); setDateFrom(""); setDateTo("") }}>
            Clear
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Wallet className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-gray-400">No payments found</p>
                  </td>
                </tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/dashboard/tailor/orders/${p.orderId}`}
                      className="text-purple-600 hover:underline"
                    >
                      {p.order?.orderNumber ?? `#${p.orderId}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{p.order?.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-gray-600">{p.paymentMethod}</td>
                  <td className="px-4 py-3 text-gray-500">{p.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-40 truncate">{p.notes ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-purple-600" title="Print Receipt" onClick={() => handlePrintReceipt(p)}>
                      <Printer className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Record Payment Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Order *</Label>
              {loadingOrders ? (
                <Skeleton className="h-9" />
              ) : (
                <Select
                  value={form.order_id}
                  onValueChange={v => {
                    const o = unpaidOrders.find(x => String(x.id) === v)
                    setForm(f => ({ ...f, order_id: v, amount: o && o.dueAmount > 0 ? String(o.dueAmount) : f.amount }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an order..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {unpaidOrders.map(o => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.orderNumber} — {o.customer?.name ?? "Unknown"} · Due: {formatCurrency(o.dueAmount)} [{o.paymentStatus}]
                      </SelectItem>
                    ))}
                    {unpaidOrders.length === 0 && (
                      <SelectItem value="__none" disabled>No orders found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Amount *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setField("amount", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Payment Date *</Label>
                <Input
                  type="date"
                  value={form.payment_date}
                  onChange={e => setField("payment_date", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Payment Method</Label>
              <Select value={form.payment_method} onValueChange={v => setField("payment_method", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Reference</Label>
              <Input
                placeholder="Transaction ID / ref (optional)"
                value={form.reference}
                onChange={e => setField("reference", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Notes</Label>
              <Input
                placeholder="Optional notes..."
                value={form.notes}
                onChange={e => setField("notes", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
