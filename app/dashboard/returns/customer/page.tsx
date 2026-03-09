"use client"

import { useState, useEffect, useCallback } from "react"
import { customerReturnsApi, CustomerReturnResponse } from "@/lib/customerReturnsApi"
import { sellsApi } from "@/lib/sellsApi"
import { useCustomer } from "@/contexts/customer-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, Check, X, Eye, Download, RotateCcw, Plus, Trash2 } from "lucide-react"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

const fmt = (val: unknown) => Number(val ?? 0).toFixed(2)

function formatDate(dateString?: string) {
  if (!dateString) return "N/A"
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function ReturnStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Pending" },
    approved: { color: "bg-green-100 text-green-800 border-green-200", label: "Approved" },
    rejected: { color: "bg-red-100 text-red-800 border-red-200", label: "Rejected" },
    completed: { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Completed" },
  }
  const cfg = config[status] || config.pending
  return (
    <Badge variant="outline" className={cfg.color}>
      {cfg.label}
    </Badge>
  )
}

const RETURN_REASONS = [
  "Size mismatch",
  "Defective product",
  "Not as described",
  "Changed my mind",
  "Package damaged",
  "Wrong item received",
  "Other",
]

const ITEMS_PER_PAGE = 10

type ReturnFormItem = {
  productId: string
  productName?: string
  variantId?: number
  quantity: number
  reason: string
  unitPrice: string
}

const defaultFormData = {
  customerId: "",
  orderNumber: "",
  sellId: undefined as number | undefined,
  refundMethod: "original_payment",
  notes: "",
  items: [{ productId: "", quantity: 1, reason: "", unitPrice: "" }] as ReturnFormItem[],
}

export default function CustomerReturnsPage() {
  const { customers } = useCustomer()
  const { toast } = useToast()

  const [returns, setReturns] = useState<CustomerReturnResponse[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, completed: 0, total_refund_amount: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const [selectedReturn, setSelectedReturn] = useState<CustomerReturnResponse | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [orderLookupLoading, setOrderLookupLoading] = useState(false)
  const [formData, setFormData] = useState(defaultFormData)
  const [loadedOrder, setLoadedOrder] = useState<import("@/lib/sellsApi").SellResponse | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [listRes, statsRes] = await Promise.all([
        customerReturnsApi.getAll({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: searchQuery || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        }),
        customerReturnsApi.getStats(),
      ])
      setReturns(listRes.data ?? [])
      setTotalItems(listRes.pagination?.total ?? listRes.total ?? listRes.data?.length ?? 0)
      if (statsRes.data) setStats({ ...statsRes.data, total_refund_amount: statsRes.data.totalRefundAmount ?? statsRes.data.total_refund_amount ?? 0 })
    } catch {
      setReturns([])
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, searchQuery, statusFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleViewDetails = async (ret: CustomerReturnResponse) => {
    try {
      const res = await customerReturnsApi.getById(ret.id)
      setSelectedReturn(res.data)
    } catch {
      setSelectedReturn(ret)
    }
    setIsDetailsOpen(true)
  }

  const handleApproveClick = (ret: CustomerReturnResponse) => {
    setSelectedReturn(ret)
    setIsApproveDialogOpen(true)
  }

  const handleRejectClick = (ret: CustomerReturnResponse) => {
    setSelectedReturn(ret)
    setRejectNotes("")
    setIsRejectDialogOpen(true)
  }

  const confirmApprove = async () => {
    if (!selectedReturn) return
    setActionLoading(true)
    try {
      await customerReturnsApi.approve(selectedReturn.id)
      toast({ title: "Return approved successfully" })
      setIsApproveDialogOpen(false)
      setSelectedReturn(null)
      fetchData()
    } catch {
      toast({ title: "Failed to approve return", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const confirmReject = async () => {
    if (!selectedReturn) return
    setActionLoading(true)
    try {
      await customerReturnsApi.reject(selectedReturn.id, rejectNotes)
      toast({ title: "Return rejected" })
      setIsRejectDialogOpen(false)
      setSelectedReturn(null)
      setRejectNotes("")
      fetchData()
    } catch {
      toast({ title: "Failed to reject return", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDownloadReport = () => {
    const csvContent = [
      ["Return #", "Customer", "Order #", "Amount", "Status", "Date"],
      ...returns.map((ret) => [
        ret.returnNumber ?? ret.id,
        ret.customerName ?? ret.customerId,
        ret.orderNumber ?? "N/A",
        `$${fmt(ret.totalAmount)}`,
        ret.status,
        formatDate(ret.createdAt),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `customer-returns-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { productId: "", quantity: 1, reason: "", unitPrice: "" }],
    }))
  }

  const handleRemoveItem = (index: number) => {
    setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
  }

  const handleItemChange = (index: number, field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
  }

  const handleCreateReturn = async () => {
    if (formData.items.some((item) => !item.productId || !item.quantity || !item.reason)) {
      toast({ title: "Please fill in all item details", variant: "destructive" })
      return
    }

    const totalAmount = formData.items.reduce((sum, item) => {
      const price = item.unitPrice ? parseFloat(item.unitPrice) : 0
      return sum + (price * item.quantity)
    }, 0)

    setCreateLoading(true)
    try {
      await customerReturnsApi.create({
        ...(formData.customerId ? { customerId: Number(formData.customerId) } : {}),
        sellId: formData.sellId,
        orderNumber: formData.orderNumber || undefined,
        refundMethod: formData.refundMethod,
        notes: formData.notes || undefined,
        totalAmount: totalAmount > 0 ? totalAmount : undefined,
        items: formData.items.map((item) => ({
          productId: Number(item.productId),
          variantId: item.variantId,
          quantity: item.quantity,
          reason: item.reason,
          ...(item.unitPrice ? { price: parseFloat(item.unitPrice) } : {}),
        })),
      })
      toast({ title: "Return created successfully" })
      setIsCreateDialogOpen(false)
      fetchData()
    } catch {
      toast({ title: "Failed to create return", variant: "destructive" })
    } finally {
      setCreateLoading(false)
    }
  }

  const handleLoadOrderDetails = async () => {
    const orderNumber = formData.orderNumber.trim()
    if (!orderNumber) {
      toast({ title: "Please enter invoice number", variant: "destructive" })
      return
    }
    setOrderLookupLoading(true)
    setLoadedOrder(null)
    try {
      const detailsRes = await sellsApi.getByInvoice(orderNumber)
      const order = detailsRes.data
      const returnItems: ReturnFormItem[] = (order.items ?? []).map((item) => ({
        productId: String(item.productId ?? ""),
        productName: item.productName,
        variantId: item.variantId ?? item.variant_id,
        quantity: item.quantity || 1,
        reason: "",
        unitPrice: String(item.price ?? item.unitPrice ?? item.unit_price ?? ""),
      }))

      setLoadedOrder(order)
      setFormData((prev) => ({
        ...prev,
        customerId: order.customerId ? String(order.customerId) : prev.customerId,
        sellId: order.id,
        orderNumber: order.invoiceNo || order.invoice_no || orderNumber,
        items: returnItems.length > 0 ? returnItems : prev.items,
      }))
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        toast({ title: "Invoice not found", description: `No order found for "${orderNumber}"`, variant: "destructive" })
      } else {
        toast({ title: "Failed to load invoice details", variant: "destructive" })
      }
    } finally {
      setOrderLookupLoading(false)
    }
  }

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Returns</h1>
          <p className="text-gray-600 mt-1">Manage product returns from customers</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setFormData(defaultFormData)
              setLoadedOrder(null)
              setIsCreateDialogOpen(true)
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Return
          </Button>
          <Button onClick={handleDownloadReport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: "Total Returns", value: stats.total, color: "text-gray-900", icon: <RotateCcw className="w-8 h-8 text-gray-400" /> },
          { label: "Pending", value: stats.pending, color: "text-yellow-600" },
          { label: "Approved", value: stats.approved, color: "text-green-600" },
          { label: "Rejected", value: stats.rejected, color: "text-red-600" },
          { label: "Total Refunds", value: `$${fmt(stats.total_refund_amount)}`, color: "text-blue-600" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
              {s.icon}
            </div>
          </Card>
        ))}
      </div>

      {/* Filters + Table */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by return #, customer, or order #"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Return #</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Customer</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Order #</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Amount</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Date</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">No returns found</td>
                </tr>
              ) : (
                returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{ret.returnNumber ?? `#${ret.id}`}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{ret.customerName ?? ret.customerId}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{ret.orderNumber ?? "N/A"}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">${fmt(ret.totalAmount)}</td>
                    <td className="py-3 px-4 text-center"><ReturnStatusBadge status={ret.status} /></td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatDate(ret.createdAt)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(ret)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {ret.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApproveClick(ret)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRejectClick(ret)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && totalItems > 0 && (
          <div className="mt-4">
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              onItemsPerPageChange={() => {}}
              totalItems={totalItems}
            />
          </div>
        )}
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return Details — {selectedReturn?.returnNumber ?? `#${selectedReturn?.id}`}</DialogTitle>
            <DialogDescription>Complete information about this return request</DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm font-medium text-gray-700">Customer</p><p className="text-sm text-gray-900">{selectedReturn.customerName ?? selectedReturn.customerId}</p></div>
                <div><p className="text-sm font-medium text-gray-700">Order Number</p><p className="text-sm text-gray-900">{selectedReturn.orderNumber ?? "N/A"}</p></div>
                <div><p className="text-sm font-medium text-gray-700">Status</p><div className="mt-1"><ReturnStatusBadge status={selectedReturn.status} /></div></div>
                <div><p className="text-sm font-medium text-gray-700">Refund Method</p><p className="text-sm text-gray-900 capitalize">{(selectedReturn.refundMethod ?? "N/A").replace("_", " ")}</p></div>
                <div><p className="text-sm font-medium text-gray-700">Created</p><p className="text-sm text-gray-900">{formatDate(selectedReturn.createdAt)}</p></div>
                {selectedReturn.processedAt && (
                  <div><p className="text-sm font-medium text-gray-700">Processed</p><p className="text-sm text-gray-900">{formatDate(selectedReturn.processedAt)}</p></div>
                )}
                {selectedReturn.rejectionReason && (
                  <div className="col-span-2"><p className="text-sm font-medium text-gray-700">Rejection Reason</p><p className="text-sm text-red-600">{selectedReturn.rejectionReason}</p></div>
                )}
              </div>

              {selectedReturn.items && selectedReturn.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Return Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Product</th>
                          <th className="text-center py-2 px-3 text-xs font-semibold text-gray-700">Qty</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Unit Price</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Subtotal</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedReturn.items.map((item, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3 text-sm">
                              <p className="font-medium text-gray-900">{item.productName ?? `Product #${item.productId}`}</p>
                              {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                            </td>
                            <td className="py-2 px-3 text-center text-sm">{item.quantity}</td>
                            <td className="py-2 px-3 text-right text-sm font-medium">${fmt(item.price)}</td>
                            <td className="py-2 px-3 text-right text-sm font-medium">${fmt((item.price ?? 0) * item.quantity)}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Refund Amount</p>
                  <p className="text-2xl font-bold text-gray-900">${fmt(selectedReturn.totalAmount)}</p>
                </div>
              </div>

              {selectedReturn.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedReturn.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Return?</DialogTitle>
            <DialogDescription>This will approve the return and process the refund.</DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p className="text-sm"><span className="font-medium">Return:</span> {selectedReturn.returnNumber ?? `#${selectedReturn.id}`}</p>
              <p className="text-sm"><span className="font-medium">Customer:</span> {selectedReturn.customerName ?? selectedReturn.customerId}</p>
              <p className="text-sm"><span className="font-medium">Amount:</span> ${fmt(selectedReturn.totalAmount)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmApprove} disabled={actionLoading} className="bg-green-600 hover:bg-green-700">
              {actionLoading ? "Approving..." : "Approve Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Return?</DialogTitle>
            <DialogDescription>Please provide a reason for rejecting this return request.</DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className="text-sm"><span className="font-medium">Return:</span> {selectedReturn.returnNumber ?? `#${selectedReturn.id}`}</p>
                <p className="text-sm"><span className="font-medium">Customer:</span> {selectedReturn.customerName ?? selectedReturn.customerId}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Rejection Reason</label>
                <Textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmReject} disabled={actionLoading || !rejectNotes.trim()} className="bg-red-600 hover:bg-red-700">
              {actionLoading ? "Rejecting..." : "Reject Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) setLoadedOrder(null) }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Customer Return</DialogTitle>
            <DialogDescription>Enter the invoice number to load order details, then select items to return</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Invoice lookup */}
            <div>
              <Label>Invoice Number *</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="e.g. INV-12345"
                  value={formData.orderNumber}
                  onChange={(e) => {
                    setFormData({ ...formData, orderNumber: e.target.value, sellId: undefined })
                    setLoadedOrder(null)
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLoadOrderDetails() } }}
                />
                <Button type="button" variant="outline" onClick={handleLoadOrderDetails} disabled={orderLookupLoading || !formData.orderNumber.trim()}>
                  {orderLookupLoading ? "Loading..." : "Fetch"}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Press Enter or click Fetch to load order details</p>
            </div>

            {/* Order summary card */}
            {loadedOrder && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-emerald-800">Order Found</p>
                  <Badge variant="outline" className="text-emerald-700 border-emerald-300">{loadedOrder.invoiceNo || loadedOrder.invoice_no}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs text-gray-500">Customer</p><p className="font-medium text-gray-900">{loadedOrder.customerName}</p></div>
                  <div><p className="text-xs text-gray-500">Order Date</p><p className="font-medium text-gray-900">{formatDate(loadedOrder.orderTime || loadedOrder.createdAt)}</p></div>
                  <div><p className="text-xs text-gray-500">Order Total</p><p className="font-medium text-gray-900">${fmt(loadedOrder.amount)}</p></div>
                </div>
              </div>
            )}

            {/* Customer + Refund Method */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Customer *</Label>
                <Select value={formData.customerId} onValueChange={(v) => setFormData({ ...formData, customerId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Refund Method *</Label>
                <Select value={formData.refundMethod} onValueChange={(v) => setFormData({ ...formData, refundMethod: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original_payment">Original Payment</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="store_credit">Store Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Return Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Return Items *</Label>
                <Button type="button" onClick={handleAddItem} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <Card key={index} className="p-4">
                    <div className="grid grid-cols-12 gap-3 items-start">
                      {/* Product info */}
                      <div className="col-span-4">
                        <Label className="text-xs">Product</Label>
                        {item.productName ? (
                          <div className="mt-1">
                            <p className="text-sm font-medium text-gray-900 leading-tight">{item.productName}</p>
                            <p className="text-xs text-gray-500">ID: {item.productId}</p>
                          </div>
                        ) : (
                          <Input
                            type="number"
                            placeholder="Product ID"
                            value={item.productId}
                            onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                            className="mt-1"
                          />
                        )}
                      </div>
                      {/* Unit Price */}
                      <div className="col-span-2">
                        <Label className="text-xs">Unit Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      {/* Qty */}
                      <div className="col-span-2">
                        <Label className="text-xs">Return Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
                          className="mt-1"
                        />
                      </div>
                      {/* Reason */}
                      <div className="col-span-3">
                        <Label className="text-xs">Reason *</Label>
                        <Select value={item.reason} onValueChange={(v) => handleItemChange(index, "reason", v)}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                          <SelectContent>
                            {RETURN_REASONS.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Remove */}
                      <div className="col-span-1 flex justify-end pt-5">
                        {formData.items.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 px-2">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateReturn} disabled={createLoading} className="bg-emerald-600 hover:bg-emerald-700">
              {createLoading ? "Creating..." : "Create Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
