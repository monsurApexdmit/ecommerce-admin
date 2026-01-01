"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Printer, Eye, Download, Mail, ShoppingBag } from "lucide-react"

interface Order {
  invoiceNo: string
  orderTime: string
  customerName: string
  method: string
  amount: number
  status: "Delivered" | "Processing" | "Pending"
}

const initialOrders: Order[] = [
  {
    invoiceNo: "12301",
    orderTime: "31 Dec, 2025 5:01 PM",
    customerName: "sdfg Ram",
    method: "Cash",
    amount: 159.91,
    status: "Delivered",
  },
  {
    invoiceNo: "12309",
    orderTime: "31 Dec, 2025 4:52 AM",
    customerName: "Mydeen Bhatsha",
    method: "Cash",
    amount: 371.1,
    status: "Processing",
  },
  {
    invoiceNo: "12332",
    orderTime: "30 Dec, 2025 3:55 PM",
    customerName: "Justin Luis",
    method: "Cash",
    amount: 110.0,
    status: "Delivered",
  },
  {
    invoiceNo: "12342",
    orderTime: "30 Dec, 2025 3:55 PM",
    customerName: "Justin Luis",
    method: "Cash",
    amount: 677.91,
    status: "Delivered",
  },
  {
    invoiceNo: "12336",
    orderTime: "29 Dec, 2025 2:31 PM",
    customerName: "Justinn Luish",
    method: "Cash",
    amount: 265.01,
    status: "Delivered",
  },
  {
    invoiceNo: "12338",
    orderTime: "28 Dec, 2025 4:38 PM",
    customerName: "TEJPAL SONI",
    method: "Cash",
    amount: 166.49,
    status: "Delivered",
  },
  {
    invoiceNo: "12341",
    orderTime: "26 Dec, 2025 9:17 AM",
    customerName: "Justin Luis",
    method: "Cash",
    amount: 2810.13,
    status: "Pending",
  },
  {
    invoiceNo: "12340",
    orderTime: "26 Dec, 2025 8:29 AM",
    customerName: "Nevil Nevil",
    method: "Cash",
    amount: 253.26,
    status: "Pending",
  },
  {
    invoiceNo: "12339",
    orderTime: "26 Dec, 2025 7:57 AM",
    customerName: "Nevil Nevil",
    method: "Cash",
    amount: 121.56,
    status: "Pending",
  },
  {
    invoiceNo: "12321",
    orderTime: "26 Dec, 2025 2:49 AM",
    customerName: "Kazi Hasan",
    method: "Cash",
    amount: 68.12,
    status: "Pending",
  },
  {
    invoiceNo: "12337",
    orderTime: "26 Dec, 2025 2:49 AM",
    customerName: "Nevil Nevil",
    method: "Cash",
    amount: 660.0,
    status: "Pending",
  },
  {
    invoiceNo: "12335",
    orderTime: "23 Dec, 2025 4:28 PM",
    customerName: "Vikas WHITE",
    method: "Cash",
    amount: 825.74,
    status: "Pending",
  },
  {
    invoiceNo: "11140",
    orderTime: "23 Dec, 2025 12:55 PM",
    customerName: "fhg jk scsd",
    method: "Cash",
    amount: 108.12,
    status: "Processing",
  },
]

export default function OrdersPage() {
  const searchParams = useSearchParams()
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [limitFilter, setLimitFilter] = useState<string>("all")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  useEffect(() => {
    const customerParam = searchParams.get("customer")
    if (customerParam) {
      setSearchQuery(customerParam)
    }
  }, [searchParams])

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.customerName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    const matchesMethod = methodFilter === "all" || order.method === methodFilter

    let matchesDateRange = true
    if (startDate && endDate) {
      const orderDate = new Date(order.orderTime)
      const start = new Date(startDate)
      const end = new Date(endDate)
      matchesDateRange = orderDate >= start && orderDate <= end
    }

    return matchesSearch && matchesStatus && matchesMethod && matchesDateRange
  })

  const handleStatusChange = (invoiceNo: string, newStatus: Order["status"]) => {
    setOrders(orders.map((order) => (order.invoiceNo === invoiceNo ? { ...order, status: newStatus } : order)))
  }

  const handleDownloadAllOrders = () => {
    const csvContent = [
      ["Invoice No", "Order Time", "Customer Name", "Method", "Amount", "Status"],
      ...filteredOrders.map((order) => [
        order.invoiceNo,
        order.orderTime,
        order.customerName,
        order.method,
        order.amount.toString(),
        order.status,
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

  const handlePrintInvoice = (order: Order) => {
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Invoice ${order.invoiceNo}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: Arial, sans-serif; 
                padding: 40px; 
                color: #374151;
                line-height: 1.6;
              }
              .invoice-container {
                max-width: 900px;
                margin: 0 auto;
                background: white;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: start;
                margin-bottom: 40px;
              }
              .company-info {
                text-align: right;
              }
              .logo {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 24px;
                font-weight: bold;
                color: #10b981;
              }
              .logo-icon {
                width: 32px;
                height: 32px;
                background: #10b981;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
              }
              .company-info p {
                font-size: 14px;
                color: #6b7280;
                margin-top: 4px;
              }
              .invoice-title {
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 12px;
              }
              .status-badge {
                display: inline-block;
                padding: 6px 16px;
                background: #10b981;
                color: white;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 600;
                text-transform: capitalize;
              }
              .invoice-meta {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 40px;
                margin: 40px 0;
              }
              .meta-item h3 {
                font-size: 12px;
                color: #6b7280;
                text-transform: uppercase;
                margin-bottom: 8px;
                font-weight: 600;
              }
              .meta-item p {
                font-size: 14px;
                color: #374151;
              }
              .invoice-to {
                text-align: right;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 40px 0;
              }
              thead {
                background: #f9fafb;
              }
              th {
                padding: 16px;
                text-align: left;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                color: #374151;
                border-bottom: 2px solid #e5e7eb;
              }
              th:last-child {
                text-align: right;
              }
              td {
                padding: 20px 16px;
                border-bottom: 1px solid #f3f4f6;
                font-size: 14px;
              }
              td:last-child {
                text-align: right;
                font-weight: 600;
              }
              .amount-red {
                color: #ef4444;
              }
              .summary {
                background: #f9fafb;
                padding: 32px;
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 32px;
                margin: 40px 0;
              }
              .summary-item h3 {
                font-size: 12px;
                color: #6b7280;
                text-transform: uppercase;
                margin-bottom: 8px;
                font-weight: 600;
              }
              .summary-item p {
                font-size: 16px;
                color: #374151;
                font-weight: 600;
              }
              .total-amount {
                font-size: 24px !important;
                color: #ef4444 !important;
                font-weight: bold !important;
              }
              @media print {
                body { padding: 20px; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="invoice-container">
              <div class="header">
                <div>
                  <h1 class="invoice-title">INVOICE</h1>
                  <div>
                    <span style="font-weight: 600; margin-right: 8px;">STATUS</span>
                    <span class="status-badge">${order.status}</span>
                  </div>
                </div>
                <div class="company-info">
                  <div class="logo">
                    <div class="logo-icon">🛒</div>
                    <span>KACHA BAZAR</span>
                  </div>
                  <p>59 Station Rd, Purls Bridge, United Kingdom</p>
                  <p>019579034</p>
                  <p>kachabazar@gmail.com</p>
                  <p>kachabazar-admin.vercel.app</p>
                </div>
              </div>

              <div class="invoice-meta">
                <div class="meta-item">
                  <h3>Date</h3>
                  <p>${order.orderTime.split(" ")[0]} ${order.orderTime.split(" ")[1]} ${order.orderTime.split(" ")[2]}</p>
                </div>
                <div class="meta-item">
                  <h3>Invoice No</h3>
                  <p>#${order.invoiceNo}</p>
                </div>
                <div class="meta-item invoice-to">
                  <h3>Invoice To</h3>
                  <p style="font-weight: 600;">${order.customerName}</p>
                  <p style="font-size: 13px; color: #6b7280;">hram8251@gmail.com</p>
                  <p style="font-size: 13px; color: #6b7280;">123456789</p>
                  <p style="font-size: 13px; color: #6b7280;">state, cuntyre, 1235</p>
                </div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 80px;">SR.</th>
                    <th>PRODUCT TITLE</th>
                    <th style="text-align: center; width: 120px;">QUANTITY</th>
                    <th style="text-align: right; width: 120px;">ITEM PRICE</th>
                    <th style="width: 120px;">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>Fresh Mustard Oil</td>
                    <td style="text-align: center;">1</td>
                    <td style="text-align: right;">$${(order.amount - 60).toFixed(2)}</td>
                    <td class="amount-red">$${(order.amount - 60).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div class="summary">
                <div class="summary-item">
                  <h3>Payment Method</h3>
                  <p>${order.method}</p>
                </div>
                <div class="summary-item">
                  <h3>Shipping Cost</h3>
                  <p style="color: #6b7280;">$60.00</p>
                </div>
                <div class="summary-item">
                  <h3>Discount</h3>
                  <p style="color: #6b7280;">$0.00</p>
                </div>
                <div class="summary-item">
                  <h3>Total Amount</h3>
                  <p class="total-amount">$${order.amount.toFixed(2)}</p>
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

  const handleDownloadInvoice = (order: Order) => {
    handlePrintInvoice(order)
  }

  const handleEmailInvoice = (order: Order) => {
    alert(`Email invoice #${order.invoiceNo} functionality would be implemented here`)
  }

  const handleReset = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setLimitFilter("all")
    setMethodFilter("all")
    setStartDate("")
    setEndDate("")
  }

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order)
    setIsDetailsOpen(true)
  }

  const getStatusBadgeClass = (status: Order["status"]) => {
    switch (status) {
      case "Delivered":
        return "bg-emerald-500 text-white px-3 py-1 rounded text-sm font-medium"
      case "Processing":
        return "bg-pink-500 text-white px-3 py-1 rounded text-sm font-medium"
      case "Pending":
        return "bg-orange-500 text-white px-3 py-1 rounded text-sm font-medium"
      default:
        return "bg-gray-500 text-white px-3 py-1 rounded text-sm font-medium"
    }
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
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
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

            <Select value={limitFilter} onValueChange={setLimitFilter}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Order limits" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Limits</SelectItem>
                <SelectItem value="5">Last 5</SelectItem>
                <SelectItem value="10">Last 10</SelectItem>
                <SelectItem value="20">Last 20</SelectItem>
              </SelectContent>
            </Select>

            <Select value={methodFilter} onValueChange={setMethodFilter}>
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
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={() => {}} className="bg-emerald-600 hover:bg-emerald-700">
                Filter
              </Button>
              <Button onClick={handleReset} variant="outline">
                Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-900 uppercase">Invoice No</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-900 uppercase">Order Time</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-900 uppercase">Customer Name</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-900 uppercase">Method</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-900 uppercase">Amount</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-900 uppercase">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-900 uppercase">Action</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-900 uppercase">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.invoiceNo} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-4 px-4">
                    <span className="font-semibold text-gray-900">{order.invoiceNo}</span>
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-600">{order.orderTime}</td>
                  <td className="py-4 px-4 text-sm text-gray-900">{order.customerName}</td>
                  <td className="py-4 px-4 text-sm text-gray-900">{order.method}</td>
                  <td className="py-4 px-4 text-sm font-semibold text-gray-900">${order.amount.toFixed(2)}</td>
                  <td className="py-4 px-4">
                    <span className={getStatusBadgeClass(order.status)}>{order.status}</span>
                  </td>
                  <td className="py-4 px-4">
                    <Select
                      value={order.status}
                      onValueChange={(value) => handleStatusChange(order.invoiceNo, value as Order["status"])}
                    >
                      <SelectTrigger className="w-32 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                        <SelectItem value="Processing">Processing</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handlePrintInvoice(order)} className="p-2">
                        <Printer className="w-4 h-4 text-gray-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(order)} className="p-2">
                        <Eye className="w-4 h-4 text-gray-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No orders found</p>
          </div>
        )}
      </Card>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Invoice</DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-8 py-4">
              {/* Header Section */}
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-4xl font-bold mb-3">INVOICE</h1>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-700">STATUS</span>
                    <span className={getStatusBadgeClass(selectedOrder.status)}>{selectedOrder.status}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end mb-2">
                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-2xl font-bold text-emerald-600">KACHA BAZAR</span>
                  </div>
                  <p className="text-sm text-gray-600">59 Station Rd, Purls Bridge, United Kingdom</p>
                  <p className="text-sm text-gray-600">019579034</p>
                  <p className="text-sm text-gray-600">kachabazar@gmail.com</p>
                  <p className="text-sm text-gray-600">kachabazar-admin.vercel.app</p>
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="grid grid-cols-3 gap-8">
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Date</h3>
                  <p className="text-sm text-gray-900">
                    {selectedOrder.orderTime.split(" ")[0]} {selectedOrder.orderTime.split(" ")[1]}{" "}
                    {selectedOrder.orderTime.split(" ")[2]}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Invoice No</h3>
                  <p className="text-sm text-gray-900">#{selectedOrder.invoiceNo}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Invoice To</h3>
                  <p className="text-sm font-semibold text-gray-900">{selectedOrder.customerName}</p>
                  <p className="text-xs text-gray-600">hram8251@gmail.com</p>
                  <p className="text-xs text-gray-600">123456789</p>
                  <p className="text-xs text-gray-600">state, cuntyre, 1235</p>
                </div>
              </div>

              {/* Products Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-900 uppercase">SR.</th>
                      <th className="text-left py-4 px-4 text-xs font-semibold text-gray-900 uppercase">
                        Product Title
                      </th>
                      <th className="text-center py-4 px-4 text-xs font-semibold text-gray-900 uppercase">Quantity</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-900 uppercase">Item Price</th>
                      <th className="text-right py-4 px-4 text-xs font-semibold text-gray-900 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="py-5 px-4 text-sm text-gray-900">1</td>
                      <td className="py-5 px-4 text-sm text-gray-900">Fresh Mustard Oil</td>
                      <td className="py-5 px-4 text-sm text-center text-gray-900">1</td>
                      <td className="py-5 px-4 text-sm text-right text-gray-900">
                        ${(selectedOrder.amount - 60).toFixed(2)}
                      </td>
                      <td className="py-5 px-4 text-sm text-right font-semibold text-red-600">
                        ${(selectedOrder.amount - 60).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Summary Section */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="grid grid-cols-4 gap-8">
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Payment Method</h3>
                    <p className="text-base font-semibold text-gray-900">{selectedOrder.method}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Shipping Cost</h3>
                    <p className="text-base font-semibold text-gray-600">$60.00</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Discount</h3>
                    <p className="text-base font-semibold text-gray-600">$0.00</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Total Amount</h3>
                    <p className="text-2xl font-bold text-red-600">${selectedOrder.amount.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => handleDownloadInvoice(selectedOrder)}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Invoice
                </Button>
                <Button
                  onClick={() => handleEmailInvoice(selectedOrder)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email Invoice
                </Button>
                <Button
                  onClick={() => handlePrintInvoice(selectedOrder)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
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
