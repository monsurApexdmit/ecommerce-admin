"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Printer, Eye, Download, Mail, ShoppingBag, Trash2 } from "lucide-react"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusBadge } from "@/components/ui/status-badge"
import { sellsApi, SellResponse, SellItem } from "@/lib/sellsApi"

const fmt = (val: unknown) => Number(val ?? 0).toFixed(2)
const itemPrice = (item: SellItem) => item.unit_price ?? item.unitPrice ?? item.price ?? 0
const itemTotal = (item: SellItem) => item.total_price ?? item.totalPrice ?? (itemPrice(item) * item.quantity)

export default function OrdersPage() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<SellResponse[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<SellResponse | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    const customerParam = searchParams.get("customer")
    if (customerParam) setSearchQuery(customerParam)
  }, [searchParams])

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: itemsPerPage,
      }
      if (searchQuery) params.search = searchQuery
      if (statusFilter !== "all") params.status = statusFilter
      if (methodFilter !== "all") params.method = methodFilter
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate

      const res = await sellsApi.getAll(params)
      setOrders(res.data ?? [])
      setTotal(res.total ?? res.data?.length ?? 0)
    } catch (err) {
      console.error("Failed to fetch orders:", err)
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, itemsPerPage, searchQuery, statusFilter, methodFilter, startDate, endDate])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const handleStatusChange = async (id: number, newStatus: SellResponse["status"]) => {
    setUpdatingStatus(id)
    try {
      await sellsApi.updateStatus(id, newStatus)
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o)))
      if (selectedOrder?.id === id) setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : prev)
    } catch (err) {
      console.error("Failed to update status:", err)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this order?")) return
    setDeletingId(id)
    try {
      await sellsApi.delete(id)
      setOrders((prev) => prev.filter((o) => o.id !== id))
      setTotal((prev) => prev - 1)
      if (selectedOrder?.id === id) setIsDetailsOpen(false)
    } catch (err) {
      console.error("Failed to delete order:", err)
    } finally {
      setDeletingId(null)
    }
  }

  const fetchFullOrder = async (id: number): Promise<SellResponse | null> => {
    try {
      const res = await sellsApi.getById(id)
      // Backend may return { data: order } or the order directly
      return (res.data ?? res) as SellResponse
    } catch (err) {
      console.error("Failed to fetch order details:", err)
      return null
    }
  }

  const handleViewDetails = async (order: SellResponse) => {
    setSelectedOrder(order)
    setIsDetailsOpen(true)
    const full = await fetchFullOrder(order.id)
    if (full) setSelectedOrder(full)
  }

  const handlePrintFromTable = async (order: SellResponse) => {
    // If items already loaded (from list response), print immediately
    if (order.items?.length) {
      handlePrintInvoice(order)
      return
    }
    // Otherwise fetch full order first
    const full = await fetchFullOrder(order.id)
    handlePrintInvoice(full ?? order)
  }

  const handleReset = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setMethodFilter("all")
    setStartDate("")
    setEndDate("")
    setCurrentPage(1)
  }

  const handleDownloadAllOrders = () => {
    const csvContent = [
      ["Invoice No", "Order Time", "Customer Name", "Method", "Amount", "Status"],
      ...orders.map((o) => [
        o.invoiceNo,
        o.orderTime,
        o.customerName,
        o.method,
        fmt(o.amount),
        o.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "orders.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handlePrintInvoice = (order: SellResponse) => {
    const shipTo = order.shippingFullName
      ? `<p style="font-weight:600;">${order.shippingFullName}</p>
         ${order.shippingEmail ? `<p style="font-size:13px;color:#6b7280;">${order.shippingEmail}</p>` : ""}
         <p style="font-size:13px;color:#6b7280;">${order.shippingPhone ?? ""}</p>
         <p style="font-size:13px;color:#6b7280;">${order.shippingAddressLine1 ?? ""}${order.shippingAddressLine2 ? ", " + order.shippingAddressLine2 : ""}</p>
         <p style="font-size:13px;color:#6b7280;">${[order.shippingCity, order.shippingState, order.shippingPostalCode].filter(Boolean).join(", ")}</p>
         <p style="font-size:13px;color:#6b7280;">${order.shippingCountry ?? ""}</p>`
      : `<p style="font-weight:600;">${order.customerName}</p>`

    const itemsHtml = order.items?.length
      ? order.items.map((item, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${item.productName}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">$${fmt(itemPrice(item))}</td>
            <td class="amount-red">$${fmt(itemTotal(item))}</td>
          </tr>`).join("")
      : `<tr>
           <td>1</td>
           <td>${order.customerName}</td>
           <td style="text-align:center;">1</td>
           <td style="text-align:right;">$${fmt(order.amount)}</td>
           <td class="amount-red">$${fmt(order.amount)}</td>
         </tr>`

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice ${order.invoiceNo}</title>
            <style>
              * { margin:0; padding:0; box-sizing:border-box; }
              body { font-family:Arial,sans-serif; padding:40px; color:#374151; line-height:1.6; }
              .invoice-container { max-width:900px; margin:0 auto; }
              .header { display:flex; justify-content:space-between; align-items:start; margin-bottom:40px; }
              .company-info { text-align:right; }
              .logo { font-size:24px; font-weight:bold; color:#10b981; }
              .company-info p { font-size:14px; color:#6b7280; margin-top:4px; }
              .invoice-title { font-size:32px; font-weight:bold; margin-bottom:12px; }
              .status-badge { display:inline-block; padding:6px 16px; background:#10b981; color:white; border-radius:4px; font-size:14px; font-weight:600; }
              .invoice-meta { display:grid; grid-template-columns:repeat(3,1fr); gap:40px; margin:40px 0; }
              .meta-item h3 { font-size:12px; color:#6b7280; text-transform:uppercase; margin-bottom:8px; font-weight:600; }
              .meta-item p { font-size:14px; color:#374151; }
              .invoice-to { text-align:right; }
              table { width:100%; border-collapse:collapse; margin:40px 0; }
              thead { background:#f9fafb; }
              th { padding:16px; text-align:left; font-size:12px; font-weight:600; text-transform:uppercase; color:#374151; border-bottom:2px solid #e5e7eb; }
              th:last-child { text-align:right; }
              td { padding:20px 16px; border-bottom:1px solid #f3f4f6; font-size:14px; }
              td:last-child { text-align:right; font-weight:600; }
              .amount-red { color:#ef4444; }
              .summary { background:#f9fafb; padding:32px; display:grid; grid-template-columns:repeat(4,1fr); gap:32px; margin:40px 0; }
              .summary-item h3 { font-size:12px; color:#6b7280; text-transform:uppercase; margin-bottom:8px; font-weight:600; }
              .summary-item p { font-size:16px; color:#374151; font-weight:600; }
              .total-amount { font-size:24px !important; color:#ef4444 !important; font-weight:bold !important; }
              @media print { body { padding:20px; } }
            </style>
          </head>
          <body>
            <div class="invoice-container">
              <div class="header">
                <div>
                  <h1 class="invoice-title">INVOICE</h1>
                  <div>
                    <span style="font-weight:600;margin-right:8px;">STATUS</span>
                    <span class="status-badge">${order.status}</span>
                  </div>
                </div>
                <div class="company-info">
                  <div class="logo">Admin</div>
                  <p>59 Station Rd, Purls Bridge, United Kingdom</p>
                  <p>019579034</p>
                </div>
              </div>
              <div class="invoice-meta">
                <div class="meta-item">
                  <h3>Date</h3>
                  <p>${new Date(order.orderTime).toLocaleDateString()}</p>
                </div>
                <div class="meta-item">
                  <h3>Invoice No</h3>
                  <p>#${order.invoiceNo}</p>
                </div>
                <div class="meta-item invoice-to">
                  <h3>${order.shippingFullName ? "Ship To" : "Invoice To"}</h3>
                  ${shipTo}
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th style="width:80px;">SR.</th>
                    <th>PRODUCT TITLE</th>
                    <th style="text-align:center;width:120px;">QUANTITY</th>
                    <th style="text-align:right;width:120px;">ITEM PRICE</th>
                    <th style="width:120px;">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
              </table>
              <div class="summary">
                <div class="summary-item">
                  <h3>Payment Method</h3>
                  <p>${order.method}</p>
                </div>
                <div class="summary-item">
                  <h3>Shipping Cost</h3>
                  <p style="color:#6b7280;">$${fmt(order.shippingCost)}</p>
                </div>
                <div class="summary-item">
                  <h3>Discount</h3>
                  <p style="color:#6b7280;">$${fmt(order.discount)}</p>
                </div>
                <div class="summary-item">
                  <h3>Total Amount</h3>
                  <p class="total-amount">$${fmt(order.amount)}</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const handleEmailInvoice = (order: SellResponse) => {
    alert(`Email invoice #${order.invoiceNo} functionality would be implemented here`)
  }

  const totalPages = Math.ceil(total / itemsPerPage)

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
      </div>

      <Card className="p-6">
        <div className="space-y-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Input
                type="text"
                placeholder="Search by Customer Name"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Delivered">Delivered</SelectItem>
                <SelectItem value="Processing">Processing</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v); setCurrentPage(1) }}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
                <SelectItem value="Online">Online</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={handleDownloadAllOrders} className="bg-emerald-600 hover:bg-emerald-700 whitespace-nowrap">
              <Download className="w-4 h-4 mr-2" />
              Download All Orders
            </Button>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1) }} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1) }} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={fetchOrders} className="bg-emerald-600 hover:bg-emerald-700">Filter</Button>
              <Button onClick={handleReset} variant="outline">Reset</Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Invoice No</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Order Time</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Customer Name</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Method</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Amount</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-8 w-32" /></td>
                    <td className="py-3 px-4"><div className="flex gap-2"><Skeleton className="h-8 w-8 rounded" /><Skeleton className="h-8 w-8 rounded" /></div></td>
                  </tr>
                ))
                : orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-gray-900">#{order.invoiceNo}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(order.orderTime).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{order.customerName}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{order.method}</td>
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">${fmt(order.amount)}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4">
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusChange(order.id, value as SellResponse["status"])}
                        disabled={updatingStatus === order.id}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Delivered">Delivered</SelectItem>
                          <SelectItem value="Processing">Processing</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handlePrintFromTable(order)} className="p-2 h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600" title="Print">
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(order)} className="p-2 h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600" title="View">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(order.id)}
                          disabled={deletingId === order.id}
                          className="p-2 h-8 w-8 hover:bg-red-50 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {!isLoading && orders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No orders found</p>
          </div>
        )}
      </Card>

      <PaginationControl
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={total}
      />

      {/* Order Detail Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Invoice</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-8 py-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <h1 className="text-4xl font-bold mb-3">INVOICE</h1>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-700">STATUS</span>
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-2">
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-emerald-600">Admin</span>
                  </div>
                  <p className="text-sm text-gray-600">59 Station Rd, Purls Bridge, United Kingdom</p>
                  <p className="text-sm text-gray-600">019579034</p>
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Date</h3>
                  <p className="text-sm text-gray-900">{new Date(selectedOrder.orderTime).toLocaleDateString()}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Invoice No</h3>
                  <p className="text-sm text-gray-900">#{selectedOrder.invoiceNo}</p>
                </div>
                <div className="sm:text-right">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">
                    {selectedOrder.shippingFullName ? "Ship To" : "Invoice To"}
                  </h3>
                  {selectedOrder.shippingFullName ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900">{selectedOrder.shippingFullName}</p>
                      {selectedOrder.shippingEmail && <p className="text-xs text-gray-600">{selectedOrder.shippingEmail}</p>}
                      {selectedOrder.shippingPhone && <p className="text-xs text-gray-600">{selectedOrder.shippingPhone}</p>}
                      {selectedOrder.shippingAddressLine1 && <p className="text-xs text-gray-600">{selectedOrder.shippingAddressLine1}{selectedOrder.shippingAddressLine2 ? `, ${selectedOrder.shippingAddressLine2}` : ""}</p>}
                      <p className="text-xs text-gray-600">{[selectedOrder.shippingCity, selectedOrder.shippingState, selectedOrder.shippingPostalCode].filter(Boolean).join(", ")}</p>
                      {selectedOrder.shippingCountry && <p className="text-xs text-gray-600">{selectedOrder.shippingCountry}</p>}
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-gray-900">{selectedOrder.customerName}</p>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-900 uppercase">SR.</th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-900 uppercase">Product Title</th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-900 uppercase">Quantity</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-900 uppercase">Item Price</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-900 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.length ? (
                      selectedOrder.items.map((item, i) => (
                        <tr key={item.id ?? i} className="border-t">
                          <td className="py-5 px-4 text-sm text-gray-900">{i + 1}</td>
                          <td className="py-5 px-4 text-sm text-gray-900">{item.productName}</td>
                          <td className="py-5 px-4 text-sm text-center text-gray-900">{item.quantity}</td>
                          <td className="py-5 px-4 text-sm text-right text-gray-900">${fmt(itemPrice(item))}</td>
                          <td className="py-5 px-4 text-sm text-right font-semibold text-red-600">${fmt(itemTotal(item))}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t">
                        <td colSpan={5} className="py-8 text-center text-sm text-gray-500">No items available</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Payment Method</h3>
                    <p className="text-base font-semibold text-gray-900">{selectedOrder.method}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Shipping Cost</h3>
                    <p className="text-base font-semibold text-gray-600">${fmt(selectedOrder.shippingCost)}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Discount</h3>
                    <p className="text-base font-semibold text-gray-600">${fmt(selectedOrder.discount)}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Total Amount</h3>
                    <p className="text-2xl font-bold text-red-600">${fmt(selectedOrder.amount)}</p>
                  </div>
                </div>
              </div>

              {/* Update Status */}
              <div className="border rounded-lg p-6 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 uppercase">Update Status</h3>
                <Select
                  value={selectedOrder.status}
                  onValueChange={(value) => handleStatusChange(selectedOrder.id, value as SellResponse["status"])}
                  disabled={updatingStatus === selectedOrder.id}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                    <SelectItem value="Processing">Processing</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Order Notes */}
              <div className="border rounded-lg p-6 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase">Order Note</h3>
                <Input
                  placeholder="Add a note to this order..."
                  defaultValue={selectedOrder.notes || ""}
                  onBlur={async (e) => {
                    const notes = e.target.value
                    if (notes !== selectedOrder.notes) {
                      try {
                        await sellsApi.update(selectedOrder.id, { notes })
                        setOrders((prev) => prev.map((o) => o.id === selectedOrder.id ? { ...o, notes } : o))
                        setSelectedOrder((prev) => prev ? { ...prev, notes } : prev)
                      } catch (err) {
                        console.error("Failed to save note:", err)
                      }
                    }
                  }}
                  className="flex-1"
                />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={() => handlePrintInvoice(selectedOrder)} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white">
                  <Download className="w-4 h-4 mr-2" />
                  Download Invoice
                </Button>
                <Button onClick={() => handleEmailInvoice(selectedOrder)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Mail className="w-4 h-4 mr-2" />
                  Email Invoice
                </Button>
                <Button onClick={() => handlePrintInvoice(selectedOrder)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  <Printer className="w-4 h-4 mr-2" />
                  Print Invoice
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
