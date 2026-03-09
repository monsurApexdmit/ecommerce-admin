"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControl } from "@/components/ui/pagination-control"
import {
  Search, Plus, Trash2, Edit, Eye, Package, Truck,
  CheckCircle, XCircle, Clock, MapPin, Calendar,
} from "lucide-react"
import { shipmentsApi, ShipmentResponse, ShipmentStatus, CreateShipmentData } from "@/lib/shipmentsApi"
import { sellsApi, SellResponse } from "@/lib/sellsApi"

// Ordered progression — status can only move forward
const STATUS_ORDER: ShipmentStatus[] = [
  'pending',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'returned',
]

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: 'Pending',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  failed: 'Failed',
  returned: 'Returned',
}

function allowedNextStatuses(current: ShipmentStatus): ShipmentStatus[] {
  const idx = STATUS_ORDER.indexOf(current)
  // Only statuses from current index onward (no going back)
  return STATUS_ORDER.slice(idx)
}

const STATUS_CONFIG: Record<ShipmentStatus, { color: string; icon: React.ElementType }> = {
  pending:           { color: "bg-gray-100 text-gray-700",    icon: Clock },
  picked_up:         { color: "bg-blue-100 text-blue-700",    icon: Package },
  in_transit:        { color: "bg-amber-100 text-amber-700",  icon: Truck },
  out_for_delivery:  { color: "bg-purple-100 text-purple-700",icon: Truck },
  delivered:         { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  failed:            { color: "bg-red-100 text-red-700",      icon: XCircle },
  returned:          { color: "bg-orange-100 text-orange-700",icon: Package },
}

function StatusBadge({ status }: { status: ShipmentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  const Icon = cfg.icon
  return (
    <Badge className={`${cfg.color} hover:${cfg.color} flex items-center gap-1 w-fit`}>
      <Icon className="h-3 w-3" />
      <span className="capitalize">{status.replace(/_/g, " ")}</span>
    </Badge>
  )
}

function formatDate(dateString?: string) {
  if (!dateString) return "N/A"
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

const EMPTY_FORM: CreateShipmentData = {
  sellId: 0,
  trackingNumber: "",
  carrier: "",
  shippingMethod: "",
  status: "pending",
  shippingCost: 0,
  weight: 0,
  dimensions: "",
  notes: "",
  estimatedDelivery: "",
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentResponse[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, inTransit: 0, delivered: 0, failed: 0 })
  const [orders, setOrders] = useState<SellResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isUpdateStatusDialogOpen, setIsUpdateStatusDialogOpen] = useState(false)

  const [viewingShipment, setViewingShipment] = useState<ShipmentResponse | null>(null)
  const [editingShipment, setEditingShipment] = useState<ShipmentResponse | null>(null)
  const [formData, setFormData] = useState<CreateShipmentData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [statusUpdateData, setStatusUpdateData] = useState({
    status: "pending" as ShipmentStatus,
    location: "",
    description: "",
  })

  // Load orders for the sell selector
  useEffect(() => {
    sellsApi.getAll({ limit: 100 }).then((res) => setOrders(res.data ?? [])).catch(() => {})
  }, [])

  const fetchShipments = useCallback(async () => {
    setIsLoading(true)
    try {
      const params: Record<string, string | number> = { page: currentPage, limit: itemsPerPage }
      if (searchQuery) params.search = searchQuery
      if (statusFilter !== "all") params.status = statusFilter

      const [listRes, statsRes] = await Promise.all([
        shipmentsApi.getAll(params),
        shipmentsApi.getStats(),
      ])

      setShipments(listRes.data ?? [])
      setTotal(listRes.pagination?.total ?? listRes.data?.length ?? 0)

      const s = statsRes.data
      setStats({
        total: Number(s?.total ?? 0),
        pending: Number(s?.pending ?? 0),
        inTransit: Number(s?.in_transit ?? 0),
        delivered: Number(s?.delivered ?? 0),
        failed: Number(s?.failed ?? 0),
      })
    } catch (err) {
      console.error("Failed to fetch shipments:", err)
      setShipments([])
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, itemsPerPage, searchQuery, statusFilter])

  useEffect(() => { fetchShipments() }, [fetchShipments])

  const handleViewShipment = async (shipment: ShipmentResponse) => {
    setViewingShipment(shipment)
    setIsViewDialogOpen(true)
    try {
      const res = await shipmentsApi.getById(shipment.id)
      setViewingShipment((res.data ?? res) as ShipmentResponse)
    } catch (err) {
      console.error("Failed to fetch shipment details:", err)
    }
  }

  const handleOpenCreate = () => {
    setEditingShipment(null)
    setFormData(EMPTY_FORM)
    setIsAddDialogOpen(true)
  }

  const handleSaveShipment = async () => {
    if (!formData.sellId) return
    setSaving(true)
    try {
      const payload = {
        ...formData,
        // Backend requires RFC3339 format; convert "YYYY-MM-DD" → "YYYY-MM-DDT00:00:00Z"
        estimatedDelivery: formData.estimatedDelivery
          ? `${formData.estimatedDelivery.split("T")[0]}T00:00:00Z`
          : undefined,
      }
      await shipmentsApi.create(payload)
      setIsAddDialogOpen(false)
      fetchShipments()
    } catch (err) {
      console.error("Failed to create shipment:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateStatusOpen = (shipment: ShipmentResponse) => {
    setEditingShipment(shipment)
    setStatusUpdateData({ status: shipment.status, location: "", description: "" })
    setIsUpdateStatusDialogOpen(true)
  }

  const handleUpdateStatusSave = async () => {
    if (!editingShipment) return
    setSaving(true)
    try {
      const updated = await shipmentsApi.updateStatus(editingShipment.id, statusUpdateData)
      const updatedShipment = (updated.data ?? updated) as ShipmentResponse
      setShipments((prev) => prev.map((s) => s.id === updatedShipment.id ? updatedShipment : s))
      if (viewingShipment?.id === updatedShipment.id) setViewingShipment(updatedShipment)
      setIsUpdateStatusDialogOpen(false)
    } catch (err) {
      console.error("Failed to update status:", err)
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / itemsPerPage)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Shipments</h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage order shipments</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          Create Shipment
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Total", value: stats.total, icon: Package, color: "text-gray-400" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "text-gray-400" },
          { label: "In Transit", value: stats.inTransit, icon: Truck, color: "text-amber-500" },
          { label: "Delivered", value: stats.delivered, icon: CheckCircle, color: "text-emerald-500" },
          { label: "Failed", value: stats.failed, icon: XCircle, color: "text-red-500" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold">{isLoading ? "—" : s.value}</p>
              </div>
              <s.icon className={`h-8 w-8 ${s.color}`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by tracking, order, or customer..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
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
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Tracking / Order</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Customer</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Carrier</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Dates</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
                : shipments.map((shipment) => (
                  <tr key={shipment.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => handleViewShipment(shipment)}>
                    <td className="py-3 px-4">
                      <div className="font-medium text-sm">{shipment.trackingNumber || "—"}</div>
                      <div className="text-xs text-gray-500">#{shipment.sell?.invoiceNo ?? shipment.sellId}</div>
                    </td>
                    <td className="py-3 px-4 text-sm">{shipment.sell?.customerName || "—"}</td>
                    <td className="py-3 px-4">
                      <div className="text-sm">{shipment.carrier || "—"}</div>
                      {shipment.shippingMethod && <div className="text-xs text-gray-500">{shipment.shippingMethod}</div>}
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={shipment.status} /></td>
                    <td className="py-3 px-4 text-xs">
                      {shipment.shippedAt && <div className="text-gray-600">Shipped: {new Date(shipment.shippedAt).toLocaleDateString()}</div>}
                      {shipment.estimatedDelivery && <div className="text-gray-500">Est: {new Date(shipment.estimatedDelivery).toLocaleDateString()}</div>}
                      {shipment.deliveredAt && <div className="text-emerald-600">Delivered: {new Date(shipment.deliveredAt).toLocaleDateString()}</div>}
                      {!shipment.shippedAt && !shipment.estimatedDelivery && !shipment.deliveredAt && (
                        <span className="text-gray-400">{new Date(shipment.createdAt).toLocaleDateString()}</span>
                      )}
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" className="p-2 h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600" onClick={() => handleViewShipment(shipment)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="p-2 h-8 w-8 hover:bg-blue-50 hover:text-blue-600" onClick={() => handleUpdateStatusOpen(shipment)} title="Update Status">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {!isLoading && shipments.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No shipments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by creating a new shipment"}
              </p>
            </div>
          )}
        </div>
      </Card>

      <PaginationControl
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1) }}
        totalItems={total}
      />

      {/* Create Shipment Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Shipment</DialogTitle>
            <DialogDescription>Enter shipment details below</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Order *</Label>
              <Select
                value={formData.sellId ? String(formData.sellId) : ""}
                onValueChange={(v) => setFormData({ ...formData, sellId: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an order..." />
                </SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      #{o.invoiceNo} — {o.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tracking Number</Label>
              <Input
                value={formData.trackingNumber}
                onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                placeholder="DHL-BD-123456789"
              />
            </div>

            <div className="space-y-2">
              <Label>Carrier</Label>
              <Input
                value={formData.carrier}
                onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                placeholder="DHL Express"
              />
            </div>

            <div className="space-y-2">
              <Label>Shipping Method</Label>
              <Input
                value={formData.shippingMethod}
                onChange={(e) => setFormData({ ...formData, shippingMethod: e.target.value })}
                placeholder="Express Delivery"
              />
            </div>

            <div className="space-y-2">
              <Label>Estimated Delivery</Label>
              <Input
                type="date"
                value={formData.estimatedDelivery?.split("T")[0] ?? ""}
                onChange={(e) => setFormData({ ...formData, estimatedDelivery: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Shipping Cost</Label>
              <Input
                type="number" min="0" step="0.01"
                value={formData.shippingCost}
                onChange={(e) => setFormData({ ...formData, shippingCost: parseFloat(e.target.value) || 0 })}
                placeholder="150.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input
                type="number" min="0" step="0.1"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
                placeholder="2.5"
              />
            </div>

            <div className="space-y-2">
              <Label>Dimensions (LxWxH cm)</Label>
              <Input
                value={formData.dimensions}
                onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                placeholder="30x20x15"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Special handling instructions..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSaveShipment}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!formData.sellId || saving}
            >
              {saving ? "Creating..." : "Create Shipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Shipment Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Shipment Details</DialogTitle>
            <DialogDescription>Track your package journey</DialogDescription>
          </DialogHeader>

          {viewingShipment && (
            <div className="space-y-5">
              {/* Header Card with Key Info */}
              <div className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-lg p-4 border border-blue-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase">Order Number</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">#{viewingShipment.sell?.invoiceNo ?? viewingShipment.sellId}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase">Tracking Number</p>
                    <p className="text-lg font-bold text-blue-600 mt-1 font-mono">{viewingShipment.trackingNumber || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Status Card - Prominent */}
              <div className="bg-white rounded-lg p-4 border-2 border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase mb-2">Current Status</p>
                    <StatusBadge status={viewingShipment.status} />
                  </div>
                  <Truck className="w-12 h-12 text-emerald-400 opacity-30" />
                </div>
              </div>

              {/* Main Info Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3 border-l-4 border-l-blue-500">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Customer</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{viewingShipment.sell?.customerName || "—"}</p>
                </Card>
                <Card className="p-3 border-l-4 border-l-purple-500">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Carrier</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{viewingShipment.carrier || "—"}</p>
                </Card>
                <Card className="p-3 border-l-4 border-l-amber-500">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Method</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{viewingShipment.shippingMethod || "—"}</p>
                </Card>
                <Card className="p-3 border-l-4 border-l-emerald-500">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Cost</p>
                  <p className="text-lg font-bold text-emerald-600 mt-1">${Number(viewingShipment.shippingCost ?? 0).toFixed(2)}</p>
                </Card>
              </div>

              {/* Timeline Cards */}
              <Card className="p-4 bg-gray-50">
                <p className="text-sm font-semibold text-gray-900 mb-3">Shipment Timeline</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2"><Package className="w-4 h-4" /> Shipped At</span>
                    <span className="font-medium">{formatDate(viewingShipment.shippedAt)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 flex items-center gap-2"><Truck className="w-4 h-4" /> Estimated Delivery</span>
                    <span className="font-medium">{formatDate(viewingShipment.estimatedDelivery)}</span>
                  </div>
                  {viewingShipment.deliveredAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-600" /> Delivered At</span>
                      <span className="font-medium text-emerald-600">{formatDate(viewingShipment.deliveredAt)}</span>
                    </div>
                  )}
                </div>
              </Card>

              {/* Package Details */}
              {(viewingShipment.weight || viewingShipment.dimensions) && (
                <Card className="p-4 bg-blue-50 border border-blue-200">
                  <p className="text-sm font-semibold text-gray-900 mb-3">Package Details</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {viewingShipment.weight && (
                      <div>
                        <p className="text-gray-600">Weight</p>
                        <p className="font-bold text-gray-900">{viewingShipment.weight} kg</p>
                      </div>
                    )}
                    {viewingShipment.dimensions && (
                      <div>
                        <p className="text-gray-600">Dimensions</p>
                        <p className="font-bold text-gray-900">{viewingShipment.dimensions} cm</p>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Notes Section */}
              {viewingShipment.notes && (
                <Card className="p-4 bg-amber-50 border border-amber-200">
                  <p className="text-sm font-semibold text-gray-900 mb-2">Notes</p>
                  <p className="text-sm text-gray-700">{viewingShipment.notes}</p>
                </Card>
              )}

              {/* Tracking History - Enhanced */}
              {viewingShipment.trackingHistory && viewingShipment.trackingHistory.length > 0 && (
                <Card className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-300">
                  <p className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-emerald-600" />
                    Tracking History
                  </p>
                  <div className="space-y-0">
                    {viewingShipment.trackingHistory.map((event, index) => {
                      const isLatest = index === 0
                      const isDelivered = event.status === 'delivered'
                      return (
                        <div key={event.id} className="relative">
                          {/* Timeline line */}
                          {index < viewingShipment.trackingHistory!.length - 1 && (
                            <div className="absolute left-6 top-12 w-0.5 h-12 bg-gradient-to-b from-emerald-300 to-gray-200" />
                          )}

                          {/* Event Card */}
                          <div className={`ml-0 p-3 rounded-lg transition-all ${
                            isLatest
                              ? 'bg-white border-2 border-emerald-500 shadow-md'
                              : isDelivered
                              ? 'bg-emerald-50 border border-emerald-200'
                              : 'bg-white border border-gray-200'
                          } mb-3`}>
                            <div className="flex gap-3">
                              {/* Timeline dot */}
                              <div className="flex flex-col items-center pt-1 flex-shrink-0">
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center border-2 ${
                                  isLatest
                                    ? 'bg-emerald-500 border-emerald-600'
                                    : isDelivered
                                    ? 'bg-emerald-400 border-emerald-500'
                                    : 'bg-gray-300 border-gray-400'
                                }`}>
                                  {isLatest && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <p className={`font-semibold capitalize text-sm ${
                                    isLatest ? 'text-emerald-700' : 'text-gray-900'
                                  }`}>
                                    {event.status.replace(/_/g, " ")}
                                  </p>
                                  <p className="text-xs font-medium text-gray-600 whitespace-nowrap flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(event.eventTime)}
                                  </p>
                                </div>

                                {event.location && (
                                  <p className="text-xs text-gray-700 flex items-center gap-1 mb-1">
                                    <MapPin className="w-3 h-3 text-blue-500 flex-shrink-0" />
                                    <span className="font-medium">{event.location}</span>
                                  </p>
                                )}

                                {event.description && (
                                  <p className="text-xs text-gray-600 leading-snug">{event.description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
            {viewingShipment && (
              <Button
                onClick={() => { setIsViewDialogOpen(false); handleUpdateStatusOpen(viewingShipment) }}
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
            <DialogDescription>Update the status and add tracking information</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status *</Label>
              <Select
                value={statusUpdateData.status}
                onValueChange={(v) => setStatusUpdateData({ ...statusUpdateData, status: v as ShipmentStatus })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedNextStatuses(editingShipment?.status ?? 'pending').map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={statusUpdateData.location}
                onChange={(e) => setStatusUpdateData({ ...statusUpdateData, location: e.target.value })}
                placeholder="Dhaka Distribution Center"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={statusUpdateData.description}
                onChange={(e) => setStatusUpdateData({ ...statusUpdateData, description: e.target.value })}
                placeholder="Package in transit to destination..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateStatusDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUpdateStatusSave}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={saving || statusUpdateData.status === editingShipment?.status}
            >
              {saving ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
