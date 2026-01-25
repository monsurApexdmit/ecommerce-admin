"use client"

import { useState, useMemo } from "react"
import { useCustomerReturn } from "@/contexts/customer-return-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { Textarea } from "@/components/ui/textarea"
import { Search, Check, X, Eye, Download, RotateCcw } from "lucide-react"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Skeleton } from "@/components/ui/skeleton"
import { useCustomer } from "@/contexts/customer-context"
import { useProduct } from "@/contexts/product-context"
import { Label } from "@/components/ui/label"
import { Plus, Trash2 } from "lucide-react"

// Status badge component
function ReturnStatusBadge({ status }: { status: string }) {
  const config = {
    pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pending' },
    approved: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Approved' },
    rejected: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Rejected' },
    completed: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Completed' },
  }

  const statusConfig = config[status as keyof typeof config] || config.pending

  return (
    <Badge variant="outline" className={statusConfig.color}>
      {statusConfig.label}
    </Badge>
  )
}

// Return reasons
const RETURN_REASONS = [
  "Size mismatch",
  "Defective product",
  "Not as described",
  "Changed my mind",
  "Package damaged",
  "Wrong item received",
  "Other"
]

// Format date helper
function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function CustomerReturnsPage() {
  const { returns, addReturn, approveReturn, rejectReturn, getReturnStats } = useCustomerReturn()
  const { customers } = useCustomer()
  const { products } = useProduct()
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState<any>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")

  // Create Return Dialog State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    customerId: "",
    orderNumber: "",
    refundMethod: "original_payment" as const,
    notes: "",
    items: [
      {
        productId: "",
        variantId: "",
        quantity: 1,
        reason: ""
      }
    ]
  })

  const stats = getReturnStats()

  // Filter returns
  const filteredReturns = useMemo(() => {
    return returns.filter((ret) => {
      const matchesSearch = 
        ret.returnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesStatus = statusFilter === "all" || ret.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [returns, searchQuery, statusFilter])

  const {
    currentItems: currentReturns,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredReturns, 10)

  const handleViewDetails = (returnItem: any) => {
    setSelectedReturn(returnItem)
    setIsDetailsOpen(true)
  }

  const handleApproveClick = (returnItem: any) => {
    setSelectedReturn(returnItem)
    setIsApproveDialogOpen(true)
  }

  const handleRejectClick = (returnItem: any) => {
    setSelectedReturn(returnItem)
    setRejectNotes("")
    setIsRejectDialogOpen(true)
  }

  const confirmApprove = () => {
    if (selectedReturn) {
      approveReturn(selectedReturn.id, "Admin")
      setIsApproveDialogOpen(false)
      setSelectedReturn(null)
    }
  }

  const confirmReject = () => {
    if (selectedReturn) {
      rejectReturn(selectedReturn.id, "Admin", rejectNotes)
      setIsRejectDialogOpen(false)
      setSelectedReturn(null)
      setRejectNotes("")
    }
  }

  const handleDownloadReport = () => {
    const csvContent = [
      ["Return #", "Customer", "Order #", "Items", "Amount", "Status", "Date"],
      ...filteredReturns.map((ret) => [
        ret.returnNumber,
        ret.customerName,
        ret.orderNumber || "N/A",
        ret.items.length.toString(),
        `$${ret.totalAmount.toFixed(2)}`,
        ret.status,
        formatDate(ret.requestDate),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `customer-returns-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Create Return Handlers
  const handleOpenCreateDialog = () => {
    setFormData({
      customerId: "",
      orderNumber: "",
      refundMethod: "original_payment",
      notes: "",
      items: [{
        productId: "",
        variantId: "",
        quantity: 1,
        reason: ""
      }]
    })
    setIsCreateDialogOpen(true)
  }

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { productId: "", variantId: "", quantity: 1, reason: "" }]
    }))
  }

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }))
  }

  const calculateTotal = () => {
    return formData.items.reduce((total, item) => {
      const product = products.find(p => p.id === item.productId)
      if (!product) return total
      
      const variant = item.variantId ? product.variants?.find(v => v.id === item.variantId) : null
      const priceToUse = variant?.salePrice || variant?.price || product.salePrice || product.price
      
      return total + (priceToUse * item.quantity)
    }, 0)
  }

  const handleCreateReturn = () => {
    // Validation
    if (!formData.customerId) {
      alert("Please select a customer")
      return
    }

    if (formData.items.some(item => !item.productId || !item.quantity || !item.reason)) {
      alert("Please fill in all item details")
      return
    }

    const customer = customers.find(c => c.id === formData.customerId)
    if (!customer) return

    const returnItems = formData.items.map(item => {
      const product = products.find(p => p.id === item.productId)
      const variant = item.variantId ? product?.variants?.find((v: any) => v.id === item.variantId) : null
      const priceToUse = variant?.salePrice || variant?.price || product?.salePrice || product?.price || 0

      return {
        productId: item.productId,
        productName: product?.name || "",
        variantId: item.variantId || undefined,
        variantName: variant?.name || undefined,
        quantity: item.quantity,
        price: priceToUse,
        reason: item.reason
      }
    })

    const totalAmount = returnItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

    addReturn({
      customerId: formData.customerId,
      customerName: customer.name,
      orderNumber: formData.orderNumber || undefined,
      items: returnItems,
      totalAmount,
      status: "pending",
      refundMethod: formData.refundMethod,
      notes: formData.notes
    })

    setIsCreateDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Returns</h1>
          <p className="text-gray-600 mt-1">Manage product returns from customers</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenCreateDialog} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            New Return
          </Button>
          <Button onClick={handleDownloadReport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Returns</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <RotateCcw className="w-8 h-8 text-gray-400" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Refunds</p>
              <p className="text-2xl font-bold text-blue-600">${stats.totalRefundAmount.toFixed(2)}</p>
            </div>
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by return #, customer, or order #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
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

        {/* Returns Table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Return #</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Customer</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Order #</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Items</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Amount</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Date</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-6 w-20 mx-auto" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-8 w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : currentReturns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500">
                    No returns found
                  </td>
                </tr>
              ) : (
                currentReturns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">{ret.returnNumber}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900">{ret.customerName}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{ret.orderNumber || "N/A"}</td>
                    <td className="py-3 px-4 text-center text-sm text-gray-900">{ret.items.length}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      ${ret.totalAmount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <ReturnStatusBadge status={ret.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {formatDate(ret.requestDate)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(ret)}
                        >
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

        {/* Pagination */}
        {!isLoading && filteredReturns.length > 0 && (
          <div className="mt-4">
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={handleItemsPerPageChange}
              totalItems={filteredReturns.length}
            />
          </div>
        )}
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return Details - {selectedReturn?.returnNumber}</DialogTitle>
            <DialogDescription>
              Complete information about this return request
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-6">
              {/* Customer & Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Customer</p>
                  <p className="text-sm text-gray-900">{selectedReturn.customerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Order Number</p>
                  <p className="text-sm text-gray-900">{selectedReturn.orderNumber || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <div className="mt-1">
                    <ReturnStatusBadge status={selectedReturn.status} />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Refund Method</p>
                  <p className="text-sm text-gray-900 capitalize">{selectedReturn.refundMethod.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Request Date</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedReturn.requestDate)}</p>
                </div>
                {selectedReturn.processedDate && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Processed Date</p>
                    <p className="text-sm text-gray-900">{formatDate(selectedReturn.processedDate)}</p>
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Return Items</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Product</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-gray-700">Qty</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Price</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedReturn.items.map((item: any, index: number) => (
                        <tr key={index}>
                          <td className="py-2 px-3 text-sm">
                            <div>
                              <p className="font-medium text-gray-900">{item.productName}</p>
                              {item.variantName && (
                                <p className="text-xs text-gray-500">{item.variantName}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center text-sm">{item.quantity}</td>
                          <td className="py-2 px-3 text-right text-sm font-medium">
                            ${(item.price * item.quantity).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-sm text-gray-600">{item.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Refund Amount</p>
                  <p className="text-2xl font-bold text-gray-900">${selectedReturn.totalAmount.toFixed(2)}</p>
                </div>
              </div>

              {/* Notes */}
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

      {/* Approve Confirmation Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Return?</DialogTitle>
            <DialogDescription>
              This will approve the return and process the refund. The items will be added back to inventory.
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Return #:</span> {selectedReturn.returnNumber}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Customer:</span> {selectedReturn.customerName}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Refund Amount:</span> ${selectedReturn.totalAmount.toFixed(2)}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmApprove} className="bg-green-600 hover:bg-green-700">
              Approve Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Return?</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this return request.
            </DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Return #:</span> {selectedReturn.returnNumber}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Customer:</span> {selectedReturn.customerName}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Rejection Reason
                </label>
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
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmReject} 
              className="bg-red-600 hover:bg-red-700"
              disabled={!rejectNotes.trim()}
            >
              Reject Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Return Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Customer Return</DialogTitle>
            <DialogDescription>
              Initiate a return of products from a customer for refund or store credit
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Customer Selection and Order Info */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Customer *</Label>
                <Select value={formData.customerId} onValueChange={(value) => setFormData({...formData, customerId: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Order Number (Optional)</Label>
                <Input
                  type="text"
                  placeholder="e.g. ORD-12345"
                  value={formData.orderNumber}
                  onChange={(e) => setFormData({...formData, orderNumber: e.target.value})}
                />
              </div>
              <div>
                <Label>Refund Method *</Label>
                <Select value={formData.refundMethod} onValueChange={(value: any) => setFormData({...formData, refundMethod: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original_payment">Original Payment</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="store_credit">Store Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Items */}
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
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-3">
                        <Label className="text-xs">Product</Label>
                        <Select 
                          value={item.productId} 
                          onValueChange={(value) => {
                            const product = products.find(p => p.id === value)
                            handleItemChange(index, 'productId', value)
                            // Reset variant if product changes
                            if (product && !product.variants?.length) {
                              handleItemChange(index, 'variantId', "")
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-3">
                        <Label className="text-xs">Variant</Label>
                        <Select
                          value={item.variantId}
                          onValueChange={(value) => handleItemChange(index, "variantId", value)}
                          disabled={!item.productId || !products.find((p) => p.id === item.productId)?.variants?.length}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select variant" />
                          </SelectTrigger>
                          <SelectContent>
                            {products
                              .find((p) => p.id === item.productId)
                              ?.variants?.map((variant) => (
                                <SelectItem key={variant.id} value={variant.id}>
                                  {variant.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="col-span-1">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      
                      <div className="col-span-3">
                        <Label className="text-xs">Reason</Label>
                        <Select 
                          value={item.reason} 
                          onValueChange={(value) => handleItemChange(index, 'reason', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            {RETURN_REASONS.map((reason) => (
                              <SelectItem key={reason} value={reason}>
                                {reason}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="col-span-1 flex items-end">
                        <div className="text-sm">
                          <div className="text-xs text-gray-500 mb-1">Total</div>
                          <div className="font-semibold">
                            ${(() => {
                              const product = products.find(p => p.id === item.productId)
                              if (!product) return "0.00"
                              const variant = item.variantId ? product.variants?.find(v => v.id === item.variantId) : null
                              const priceToUse = variant?.salePrice || variant?.price || product.salePrice || product.price
                              return (priceToUse * item.quantity).toFixed(2)
                            })()}
                          </div>
                        </div>
                      </div>
                      
                      <div className="col-span-1 flex items-end justify-end">
                        {formData.items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Add any additional notes about this return..."
                rows={3}
              />
            </div>

            {/* Total */}
            <div className="flex justify-end pt-4 border-t">
              <div className="text-right">
                <p className="text-sm text-gray-600">Total Refund Amount</p>
                <p className="text-2xl font-bold text-gray-900">${calculateTotal().toFixed(2)}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReturn} className="bg-emerald-600 hover:bg-emerald-700">
              Create Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
