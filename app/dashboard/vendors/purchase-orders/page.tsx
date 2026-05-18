"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Plus, Loader2, Search, Eye, Trash2, CheckCircle, Send,
  XCircle, Package, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useWarehouse } from "@/contexts/warehouse-context"
import purchaseOrderApi, { type PurchaseOrder, type PurchaseOrderItem } from "@/lib/purchaseOrderApi"
import vendorApi from "@/lib/vendorApi"
import productApi from "@/lib/productApi"
import { toast } from "sonner"

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-700",
  sent:      "bg-blue-100 text-blue-700",
  partial:   "bg-yellow-100 text-yellow-700",
  received:  "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  )
}

interface FormItem {
  productId: string
  variantId: string
  quantityOrdered: number
  unitCost: number
  productName: string
}

const emptyItem = (): FormItem => ({
  productId: "", variantId: "", quantityOrdered: 1, unitCost: 0, productName: ""
})

export default function PurchaseOrdersPage() {
  const blocked = useModuleGuard("Vendors")
  if (blocked) return blocked

  const { warehouses } = useWarehouse()
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [stats, setStats] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)

  // Vendors & products for form
  const [vendors, setVendors] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [vendorId, setVendorId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [expectedDate, setExpectedDate] = useState("")
  const [notes, setNotes] = useState("")
  const [formItems, setFormItems] = useState<FormItem[]>([emptyItem()])

  // View dialog
  const [viewPo, setViewPo] = useState<PurchaseOrder | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  // Receive dialog
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receivingPo, setReceivingPo] = useState<PurchaseOrder | null>(null)
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({})
  const [receiving, setReceiving] = useState(false)

  const fetchPos = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { page, per_page: 15 }
      if (search) params.search = search
      if (statusFilter !== "all") params.status = statusFilter
      const res = await purchaseOrderApi.getAll(params)
      const d = res.data?.data
      setPos(d?.data ?? [])
      setTotal(d?.total ?? 0)
      setLastPage(d?.last_page ?? 1)
    } catch {
      toast.error("Failed to load purchase orders")
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { fetchPos() }, [fetchPos])

  useEffect(() => {
    purchaseOrderApi.getStats().then(r => setStats(r.data?.data ?? {})).catch(() => {})
    vendorApi.getAll({ per_page: 200 }).then(r => setVendors(r.data?.data?.data ?? [])).catch(() => {})
    productApi.getAll({ per_page: 500 }).then(r => setProducts(r.data?.data?.data ?? [])).catch(() => {})
  }, [])

  const resetCreate = () => {
    setVendorId(""); setLocationId(""); setExpectedDate(""); setNotes("")
    setFormItems([emptyItem()])
  }

  const handleCreate = async () => {
    if (!vendorId || formItems.some(i => !i.productId || i.quantityOrdered < 1)) {
      toast.error("Fill in vendor and all item fields")
      return
    }
    setSaving(true)
    try {
      await purchaseOrderApi.create({
        vendorId: Number(vendorId),
        locationId: locationId ? Number(locationId) : undefined,
        expectedDate: expectedDate || undefined,
        notes: notes || undefined,
        items: formItems.map(i => ({
          productId: Number(i.productId),
          variantId: i.variantId ? Number(i.variantId) : undefined,
          quantityOrdered: i.quantityOrdered,
          unitCost: i.unitCost,
        })),
      })
      toast.success("Purchase order created")
      setCreateOpen(false)
      resetCreate()
      fetchPos()
      purchaseOrderApi.getStats().then(r => setStats(r.data?.data ?? {})).catch(() => {})
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to create purchase order")
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (po: PurchaseOrder, status: string) => {
    try {
      await purchaseOrderApi.updateStatus(po.id, status)
      toast.success(`Status updated to ${status}`)
      fetchPos()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to update status")
    }
  }

  const handleDelete = async (po: PurchaseOrder) => {
    if (!confirm(`Delete ${po.poNumber}?`)) return
    try {
      await purchaseOrderApi.delete(po.id)
      toast.success("Purchase order deleted")
      fetchPos()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Cannot delete this purchase order")
    }
  }

  const openReceive = (po: PurchaseOrder) => {
    setReceivingPo(po)
    const qtys: Record<number, number> = {}
    po.items.forEach(item => {
      const remaining = item.quantityOrdered - item.quantityReceived
      qtys[item.id] = remaining > 0 ? remaining : 0
    })
    setReceiveQtys(qtys)
    setReceiveOpen(true)
  }

  const handleReceive = async () => {
    if (!receivingPo) return
    setReceiving(true)
    try {
      await purchaseOrderApi.receive(receivingPo.id, {
        items: Object.entries(receiveQtys)
          .filter(([, qty]) => qty > 0)
          .map(([itemId, quantityReceiving]) => ({ itemId: Number(itemId), quantityReceiving })),
      })
      toast.success("Stock received and inventory updated")
      setReceiveOpen(false)
      fetchPos()
      purchaseOrderApi.getStats().then(r => setStats(r.data?.data ?? {})).catch(() => {})
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Failed to receive stock")
    } finally {
      setReceiving(false)
    }
  }

  const updateFormItem = (idx: number, field: keyof FormItem, value: any) => {
    setFormItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      if (field === "productId") {
        const product = products.find(p => String(p.id) === value)
        next[idx].productName = product?.name ?? ""
        next[idx].unitCost = product?.costPrice ?? 0
        next[idx].variantId = ""
      }
      return next
    })
  }

  const getVariants = (productId: string) => {
    const p = products.find(pr => String(pr.id) === productId)
    return p?.variants ?? []
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-600 mt-1">Order stock from vendors and receive it into inventory</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" /> New Purchase Order
        </Button>
      </div>

      {/* Stats */}
      {Object.keys(stats).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {["total", "draft", "sent", "partial", "received", "cancelled"].map(key => (
            <Card key={key} className="p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{stats[key] ?? 0}</div>
              <div className="text-xs text-gray-500 capitalize mt-0.5">{key}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search PO number or vendor..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
      ) : pos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg font-medium">No purchase orders yet</p>
            <p className="text-gray-400 mt-1">Create your first PO to order stock from vendors</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-4 font-medium text-gray-600">PO Number</th>
                  <th className="text-left p-4 font-medium text-gray-600">Vendor</th>
                  <th className="text-left p-4 font-medium text-gray-600">Location</th>
                  <th className="text-left p-4 font-medium text-gray-600">Status</th>
                  <th className="text-left p-4 font-medium text-gray-600">Expected</th>
                  <th className="text-right p-4 font-medium text-gray-600">Total</th>
                  <th className="text-center p-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pos.map(po => (
                  <tr key={po.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900">{po.poNumber}</td>
                    <td className="p-4 text-gray-700">{po.vendorName}</td>
                    <td className="p-4 text-gray-500">{po.locationName ?? "—"}</td>
                    <td className="p-4"><StatusBadge status={po.status} /></td>
                    <td className="p-4 text-gray-500">{po.expectedDate ?? "—"}</td>
                    <td className="p-4 text-right font-medium">${po.totalAmount.toFixed(2)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setViewPo(po); setViewOpen(true) }} title="View">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {["draft", "sent", "partial"].includes(po.status) && (
                          <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => openReceive(po)} title="Receive Stock">
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {po.status === "draft" && (
                          <Button variant="ghost" size="sm" className="text-blue-600" onClick={() => handleStatusChange(po, "sent")} title="Mark as Sent">
                            <Send className="w-4 h-4" />
                          </Button>
                        )}
                        {["draft", "sent"].includes(po.status) && (
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleStatusChange(po, "cancelled")} title="Cancel">
                            <XCircle className="w-4 h-4" />
                          </Button>
                        )}
                        {["draft", "cancelled"].includes(po.status) && (
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(po)} title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lastPage > 1 && (
            <div className="flex justify-center gap-2 p-4">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-sm text-gray-500 self-center">Page {page} of {lastPage} ({total} total)</span>
              <Button variant="outline" size="sm" disabled={page === lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={open => { if (!open) resetCreate(); setCreateOpen(open) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>Order stock from a vendor</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor *</Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Receive at Location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expected Date</Label>
                <Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Order Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setFormItems(p => [...p, emptyItem()])}>
                  <Plus className="w-3 h-3 mr-1" /> Add Item
                </Button>
              </div>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2 font-medium">Product</th>
                      <th className="text-left p-2 font-medium">Variant</th>
                      <th className="text-left p-2 font-medium w-24">Qty</th>
                      <th className="text-left p-2 font-medium w-28">Unit Cost</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formItems.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">
                          <Select value={item.productId} onValueChange={v => updateFormItem(idx, "productId", v)}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Select product" /></SelectTrigger>
                            <SelectContent>
                              {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          {getVariants(item.productId).length > 0 ? (
                            <Select value={item.variantId} onValueChange={v => updateFormItem(idx, "variantId", v)}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Variant" /></SelectTrigger>
                              <SelectContent>
                                {getVariants(item.productId).map((v: any) => (
                                  <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : <span className="text-gray-400 text-xs px-2">No variants</span>}
                        </td>
                        <td className="p-2">
                          <Input type="number" className="h-8 w-20" min={1} value={item.quantityOrdered}
                            onChange={e => updateFormItem(idx, "quantityOrdered", Number(e.target.value))} />
                        </td>
                        <td className="p-2">
                          <Input type="number" className="h-8 w-24" min={0} step="0.01" value={item.unitCost}
                            onChange={e => updateFormItem(idx, "unitCost", Number(e.target.value))} />
                        </td>
                        <td className="p-2">
                          {formItems.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500"
                              onClick={() => setFormItems(p => p.filter((_, i) => i !== idx))}>
                              ×
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={3} className="p-2 text-right font-medium text-gray-600">Total:</td>
                      <td className="p-2 font-bold">
                        ${formItems.reduce((s, i) => s + i.quantityOrdered * i.unitCost, 0).toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreate() }}>Cancel</Button>
            <Button onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Purchase Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewPo?.poNumber}</DialogTitle>
            <DialogDescription>
              <StatusBadge status={viewPo?.status ?? ""} />
            </DialogDescription>
          </DialogHeader>
          {viewPo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Vendor:</span> <strong>{viewPo.vendorName}</strong></div>
                <div><span className="text-gray-500">Location:</span> <strong>{viewPo.locationName ?? "—"}</strong></div>
                <div><span className="text-gray-500">Expected:</span> <strong>{viewPo.expectedDate ?? "—"}</strong></div>
                <div><span className="text-gray-500">Total:</span> <strong>${viewPo.totalAmount.toFixed(2)}</strong></div>
                {viewPo.notes && <div className="col-span-2"><span className="text-gray-500">Notes:</span> {viewPo.notes}</div>}
              </div>
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium">Product</th>
                    <th className="text-center p-3 font-medium">Ordered</th>
                    <th className="text-center p-3 font-medium">Received</th>
                    <th className="text-right p-3 font-medium">Unit Cost</th>
                    <th className="text-right p-3 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {viewPo.items.map(item => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3">
                        <div>{item.productName}</div>
                        {item.variantName && <div className="text-xs text-gray-500">{item.variantName}</div>}
                        {item.productSku && <div className="text-xs text-gray-400">{item.productSku}</div>}
                      </td>
                      <td className="p-3 text-center">{item.quantityOrdered}</td>
                      <td className="p-3 text-center">
                        <span className={item.quantityReceived >= item.quantityOrdered ? "text-green-600 font-medium" : "text-gray-700"}>
                          {item.quantityReceived}
                        </span>
                      </td>
                      <td className="p-3 text-right">${item.unitCost.toFixed(2)}</td>
                      <td className="p-3 text-right font-medium">${item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            {viewPo && ["draft", "sent", "partial"].includes(viewPo.status) && (
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setViewOpen(false); openReceive(viewPo) }}>
                <CheckCircle className="w-4 h-4 mr-2" /> Receive Stock
              </Button>
            )}
            <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Stock Dialog */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive Stock — {receivingPo?.poNumber}</DialogTitle>
            <DialogDescription>Enter quantities received. Stock will be added to inventory.</DialogDescription>
          </DialogHeader>
          {receivingPo && (
            <div className="space-y-3">
              {receivingPo.items.map(item => {
                const remaining = item.quantityOrdered - item.quantityReceived
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.productName}</div>
                      {item.variantName && <div className="text-xs text-gray-500">{item.variantName}</div>}
                      <div className="text-xs text-gray-400">
                        Ordered: {item.quantityOrdered} · Received: {item.quantityReceived} · Remaining: {remaining}
                      </div>
                    </div>
                    <Input
                      type="number"
                      className="w-24"
                      min={0}
                      max={remaining}
                      value={receiveQtys[item.id] ?? 0}
                      disabled={remaining <= 0}
                      onChange={e => setReceiveQtys(p => ({ ...p, [item.id]: Math.min(Number(e.target.value), remaining) }))}
                    />
                  </div>
                )
              })}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleReceive} disabled={receiving}>
              {receiving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
