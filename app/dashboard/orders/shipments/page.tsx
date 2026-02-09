"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { useShipment, Shipment, TrackingEvent } from "@/contexts/shipment-context"
import {
  Search,
  Plus,
  Trash2,
  Edit,
  Eye,
  Package,
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Calendar,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { usePagination } from "@/hooks/use-pagination"

export default function ShipmentsPage() {
  const {
    shipments,
    addShipment,
    updateShipment,
    updateStatus,
    deleteShipment,
    addTrackingEvent,
    getStats,
  } = useShipment()

  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [carrierFilter, setCarrierFilter] = useState("all")
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isUpdateStatusDialogOpen, setIsUpdateStatusDialogOpen] = useState(false)
  const [viewingShipment, setViewingShipment] = useState<Shipment | null>(null)
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    orderId: "",
    orderNumber: "",
    customerName: "",
    trackingNumber: "",
    carrier: "",
    shippingMethod: "",
    status: "pending" as Shipment["status"],
    shippingCost: 0,
    weight: 0,
    dimensions: "",
    notes: "",
  })

  const [statusUpdateData, setStatusUpdateData] = useState({
    status: "pending" as Shipment["status"],
    location: "",
    description: "",
  })

  const stats = getStats()

  // Simulated loading
  useEffect(() => {
    setTimeout(() => setIsLoading(false), 800)
  }, [])

  // Get unique carriers
  const uniqueCarriers = Array.from(new Set(shipments.map((s) => s.carrier)))

  // Filter shipments
  const filteredShipments = shipments.filter((shipment) => {
    const matchesSearch =
      searchQuery === "" ||
      shipment.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shipment.customerName.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || shipment.status === statusFilter
    const matchesCarrier = carrierFilter === "all" || shipment.carrier === carrierFilter

    return matchesSearch && matchesStatus && matchesCarrier
  })

  const {
    currentItems,
    currentPage,
    totalPages,
    itemsPerPage,
    goToPage,
    handleItemsPerPageChange,
  } = usePagination(filteredShipments, 10)

  const handleSelectAll = () => {
    if (selectedShipmentIds.length === currentItems.length) {
      setSelectedShipmentIds([])
    } else {
      setSelectedShipmentIds(currentItems.map((shipment) => shipment.id))
    }
  }

  const handleSelectShipment = (id: string) => {
    setSelectedShipmentIds((prev) =>
      prev.includes(id) ? prev.filter((shipmentId) => shipmentId !== id) : [...prev, id]
    )
  }

  const handleAddEditOpen = (shipment?: Shipment) => {
    if (shipment) {
      setEditingShipment(shipment)
      setFormData({
        orderId: shipment.orderId,
        orderNumber: shipment.orderNumber,
        customerName: shipment.customerName,
        trackingNumber: shipment.trackingNumber,
        carrier: shipment.carrier,
        shippingMethod: shipment.shippingMethod || "",
        status: shipment.status,
        shippingCost: shipment.shippingCost,
        weight: shipment.weight || 0,
        dimensions: shipment.dimensions || "",
        notes: shipment.notes || "",
      })
    } else {
      setEditingShipment(null)
      setFormData({
        orderId: "",
        orderNumber: "",
        customerName: "",
        trackingNumber: "",
        carrier: "",
        shippingMethod: "",
        status: "pending",
        shippingCost: 0,
        weight: 0,
        dimensions: "",
        notes: "",
      })
    }
    setIsAddDialogOpen(true)
  }

  const handleSaveShipment = () => {
    if (editingShipment) {
      updateShipment(editingShipment.id, formData)
    } else {
      addShipment(formData)
    }
    setIsAddDialogOpen(false)
    setEditingShipment(null)
  }

  const handleViewShipment = (shipment: Shipment) => {
    setViewingShipment(shipment)
    setIsViewDialogOpen(true)
  }

  const handleUpdateStatusOpen = (shipment: Shipment) => {
    setEditingShipment(shipment)
    setStatusUpdateData({
      status: shipment.status,
      location: "",
      description: "",
    })
    setIsUpdateStatusDialogOpen(true)
  }

  const handleUpdateStatusSave = () => {
    if (editingShipment) {
      updateStatus(
        editingShipment.id,
        statusUpdateData.status,
        statusUpdateData.location,
        statusUpdateData.description
      )
    }
    setIsUpdateStatusDialogOpen(false)
    setEditingShipment(null)
  }

  const handleDeleteClick = (id: string) => {
    setDeletingId(id)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (deletingId) {
      deleteShipment(deletingId)
    }
    setIsDeleteDialogOpen(false)
    setDeletingId(null)
  }

  const handleBulkDelete = () => {
    selectedShipmentIds.forEach((id) => deleteShipment(id))
    setSelectedShipmentIds([])
  }

  const getStatusBadge = (status: Shipment["status"]) => {
    const statusConfig = {
      pending: { color: "bg-gray-100 text-gray-700", icon: Clock },
      picked_up: { color: "bg-blue-100 text-blue-700", icon: Package },
      in_transit: { color: "bg-amber-100 text-amber-700", icon: Truck },
      out_for_delivery: { color: "bg-purple-100 text-purple-700", icon: Truck },
      delivered: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
      failed: { color: "bg-red-100 text-red-700", icon: XCircle },
      returned: { color: "bg-orange-100 text-orange-700", icon: Package },
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
      <Badge className={`${config.color} hover:${config.color} flex items-center gap-1 w-fit`}>
        <Icon className="h-3 w-3" />
        <span className="capitalize">{status.replace("_", " ")}</span>
      </Badge>
    )
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Shipments</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage order shipments</p>
        </div>
        <Button onClick={() => handleAddEditOpen()} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          Create Shipment
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Shipments</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <Package className="h-8 w-8 text-gray-400" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-gray-400" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">In Transit</p>
              <p className="text-2xl font-bold">{stats.inTransit}</p>
            </div>
            <Truck className="h-8 w-8 text-amber-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Delivered</p>
              <p className="text-2xl font-bold">{stats.delivered}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold">{stats.failed}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by tracking, order, or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="picked_up">Picked Up</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>

          {/* Carrier Filter */}
          <Select value={carrierFilter} onValueChange={setCarrierFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Carrier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Carriers</SelectItem>
              {uniqueCarriers.map((carrier) => (
                <SelectItem key={carrier} value={carrier}>
                  {carrier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Bulk Delete */}
          {selectedShipmentIds.length > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete ({selectedShipmentIds.length})
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-12 py-3 px-4">
                  <Checkbox
                    checked={selectedShipmentIds.length === currentItems.length && currentItems.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Tracking / Order
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Customer
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Carrier
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Status
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Dates
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-4" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-6 w-24" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-8 w-32" />
                      </td>
                    </tr>
                  ))
                : currentItems.map((shipment) => (
                    <tr
                      key={shipment.id}
                      className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleViewShipment(shipment)}
                    >
                      <td
                        className="py-3 px-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedShipmentIds.includes(shipment.id)}
                          onCheckedChange={() => handleSelectShipment(shipment.id)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-sm">{shipment.trackingNumber}</div>
                          <div className="text-xs text-gray-500">{shipment.orderNumber}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">{shipment.customerName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">{shipment.carrier}</div>
                        {shipment.shippingMethod && (
                          <div className="text-xs text-gray-500">{shipment.shippingMethod}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(shipment.status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs">
                          {shipment.shippedAt && (
                            <div className="text-gray-600">
                              Shipped: {new Date(shipment.shippedAt).toLocaleDateString()}
                            </div>
                          )}
                          {shipment.estimatedDelivery && (
                            <div className="text-gray-500">
                              Est: {new Date(shipment.estimatedDelivery).toLocaleDateString()}
                            </div>
                          )}
                          {shipment.deliveredAt && (
                            <div className="text-emerald-600">
                              Delivered: {new Date(shipment.deliveredAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td
                        className="py-3 px-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewShipment(shipment)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUpdateStatusOpen(shipment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(shipment.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {!isLoading && filteredShipments.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No shipments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || statusFilter !== "all" || carrierFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by creating a new shipment"}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredShipments.length > 0 && (
          <div className="border-t px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Rows per page:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => handleItemsPerPageChange(Number(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingShipment ? "Edit Shipment" : "Create New Shipment"}
            </DialogTitle>
            <DialogDescription>
              {editingShipment
                ? "Update shipment details below"
                : "Enter shipment details below"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderNumber">Order Number *</Label>
              <Input
                id="orderNumber"
                value={formData.orderNumber}
                onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                placeholder="INV-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name *</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trackingNumber">Tracking Number *</Label>
              <Input
                id="trackingNumber"
                value={formData.trackingNumber}
                onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                placeholder="DHL-BD-123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="carrier">Carrier *</Label>
              <Input
                id="carrier"
                value={formData.carrier}
                onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                placeholder="DHL Express"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shippingMethod">Shipping Method</Label>
              <Input
                id="shippingMethod"
                value={formData.shippingMethod}
                onChange={(e) => setFormData({ ...formData, shippingMethod: e.target.value })}
                placeholder="Express Delivery"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shippingCost">Shipping Cost *</Label>
              <Input
                id="shippingCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.shippingCost}
                onChange={(e) =>
                  setFormData({ ...formData, shippingCost: parseFloat(e.target.value) || 0 })
                }
                placeholder="150.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                min="0"
                step="0.1"
                value={formData.weight}
                onChange={(e) =>
                  setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })
                }
                placeholder="2.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dimensions">Dimensions (LxWxH cm)</Label>
              <Input
                id="dimensions"
                value={formData.dimensions}
                onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                placeholder="30x20x15"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Special handling instructions..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveShipment}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={
                !formData.orderNumber ||
                !formData.customerName ||
                !formData.trackingNumber ||
                !formData.carrier
              }
            >
              {editingShipment ? "Update" : "Create"} Shipment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Shipment Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Shipment Details</DialogTitle>
            <DialogDescription>
              Tracking Number: {viewingShipment?.trackingNumber}
            </DialogDescription>
          </DialogHeader>

          {viewingShipment && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Order Number</Label>
                  <p className="font-medium">{viewingShipment.orderNumber}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Customer</Label>
                  <p className="font-medium">{viewingShipment.customerName}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Carrier</Label>
                  <p className="font-medium">{viewingShipment.carrier}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Method</Label>
                  <p className="font-medium">{viewingShipment.shippingMethod || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Status</Label>
                  <div className="mt-1">{getStatusBadge(viewingShipment.status)}</div>
                </div>
                <div>
                  <Label className="text-gray-500">Shipping Cost</Label>
                  <p className="font-medium">${viewingShipment.shippingCost.toFixed(2)}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-500">Shipped At</Label>
                  <p className="text-sm">{formatDate(viewingShipment.shippedAt)}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Estimated Delivery</Label>
                  <p className="text-sm">{formatDate(viewingShipment.estimatedDelivery)}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Delivered At</Label>
                  <p className="text-sm">{formatDate(viewingShipment.deliveredAt)}</p>
                </div>
              </div>

              {/* Package Details */}
              {(viewingShipment.weight || viewingShipment.dimensions) && (
                <div className="grid grid-cols-2 gap-4">
                  {viewingShipment.weight && (
                    <div>
                      <Label className="text-gray-500">Weight</Label>
                      <p className="font-medium">{viewingShipment.weight} kg</p>
                    </div>
                  )}
                  {viewingShipment.dimensions && (
                    <div>
                      <Label className="text-gray-500">Dimensions</Label>
                      <p className="font-medium">{viewingShipment.dimensions} cm</p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {viewingShipment.notes && (
                <div>
                  <Label className="text-gray-500">Notes</Label>
                  <p className="text-sm mt-1">{viewingShipment.notes}</p>
                </div>
              )}

              {/* Tracking History */}
              <div>
                <Label className="text-lg font-semibold">Tracking History</Label>
                <div className="mt-4 space-y-4">
                  {viewingShipment.trackingHistory.map((event, index) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3 h-3 rounded-full ${
                            index === 0 ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                        />
                        {index < viewingShipment.trackingHistory.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium capitalize">
                              {event.status.replace("_", " ")}
                            </p>
                            {event.location && (
                              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </p>
                            )}
                            <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                          </div>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(event.eventTime)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            {viewingShipment && (
              <Button
                onClick={() => {
                  setIsViewDialogOpen(false)
                  handleUpdateStatusOpen(viewingShipment)
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Update Status
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={isUpdateStatusDialogOpen} onOpenChange={setIsUpdateStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Shipment Status</DialogTitle>
            <DialogDescription>
              Update the status and add tracking information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">New Status *</Label>
              <Select
                value={statusUpdateData.status}
                onValueChange={(value: Shipment["status"]) =>
                  setStatusUpdateData({ ...statusUpdateData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="picked_up">Picked Up</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={statusUpdateData.location}
                onChange={(e) =>
                  setStatusUpdateData({ ...statusUpdateData, location: e.target.value })
                }
                placeholder="Dhaka Distribution Center"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={statusUpdateData.description}
                onChange={(e) =>
                  setStatusUpdateData({ ...statusUpdateData, description: e.target.value })
                }
                placeholder="Package in transit to destination..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatusSave} className="bg-emerald-600 hover:bg-emerald-700">
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Shipment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this shipment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
