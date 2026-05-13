"use client"

import { use, useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, User, Ruler, Package, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { tailorApi, TailorFabric, TailorMeasurement, TailorCustomer, TailorOrder, PRODUCT_TYPES } from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { toast } from "sonner"

interface OrderItem {
  productType: string
  fabricId: string
  fabricQuantity: number
  fabricUnitPrice: number
  measurementId: string
  notes: string
}

const emptyItem = (): OrderItem => ({
  productType: "",
  fabricId: "none",
  fabricQuantity: 1,
  fabricUnitPrice: 0,
  measurementId: "none",
  notes: "",
})

const TODAY_STR = new Date().toISOString().split("T")[0]

export default function EditTailorOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { canWrite } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const router = useRouter()

  if (!canWrite("TailorOrders")) return <AccessDenied />

  // Load state
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [order, setOrder] = useState<TailorOrder | null>(null)

  // Fabrics
  const [fabrics, setFabrics] = useState<TailorFabric[]>([])
  const [fabricSearch, setFabricSearch] = useState<string[]>([])

  // Customer section
  const [selectedCustomer, setSelectedCustomer] = useState<TailorCustomer | null>(null)
  const [measurements, setMeasurements] = useState<TailorMeasurement[]>([])

  // Items
  const [items, setItems] = useState<OrderItem[]>([emptyItem()])

  // Charges & dates
  const [orderDate, setOrderDate] = useState(TODAY_STR)
  const [deliveryDate, setDeliveryDate] = useState("")
  const [stitchingCharge, setStitchingCharge] = useState(0)
  const [extraCharge, setExtraCharge] = useState(0)
  const [discount, setDiscount] = useState(0)

  // Notes
  const [notes, setNotes] = useState("")

  // Submission
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      tailorApi.getOrder(+id),
      tailorApi.getFabrics({ limit: 200, status: "active" }),
    ])
      .then(([orderRes, fabricsRes]) => {
        const o: TailorOrder = orderRes.data?.data ?? orderRes.data
        const list: TailorFabric[] = fabricsRes.data?.data?.data ?? fabricsRes.data?.data ?? []

        setOrder(o)
        setFabrics(list)

        // Pre-populate customer
        if (o.customer) {
          setSelectedCustomer(o.customer)
        }

        // Load measurements for customer
        if (o.customerId) {
          tailorApi.getMeasurementsByCustomer(o.customerId)
            .then(mr => setMeasurements(mr.data?.data ?? mr.data ?? []))
            .catch(() => {})
        }

        // Pre-populate items
        const mappedItems: OrderItem[] = (o.items ?? []).map(i => ({
          productType: i.productType,
          fabricId: i.fabricId ? String(i.fabricId) : "none",
          fabricQuantity: i.fabricQuantity,
          fabricUnitPrice: i.fabricUnitPrice,
          measurementId: i.measurementId ? String(i.measurementId) : "none",
          notes: i.notes ?? "",
        }))
        const initialItems = mappedItems.length > 0 ? mappedItems : [emptyItem()]
        setItems(initialItems)
        setFabricSearch(Array(initialItems.length).fill(""))

        // Pre-populate header fields
        setOrderDate(o.orderDate ?? TODAY_STR)
        setDeliveryDate(o.deliveryDate ?? "")
        setStitchingCharge(o.stitchingCharge ?? 0)
        setExtraCharge(o.extraCharge ?? 0)
        setDiscount(o.discount ?? 0)
        setNotes(o.notes ?? "")
      })
      .catch(err => {
        setLoadError(err?.response?.data?.message ?? "Failed to load order")
      })
      .finally(() => setLoading(false))
  }, [id])

  const updateItem = useCallback((idx: number, field: keyof OrderItem, value: string | number) => {
    setItems(prev => {
      const next = [...prev]
      if (field === "fabricId") {
        const fab = fabrics.find(f => String(f.id) === value)
        next[idx] = {
          ...next[idx],
          fabricId: value as string,
          fabricUnitPrice: fab ? fab.sellingPrice : next[idx].fabricUnitPrice,
        }
      } else {
        next[idx] = { ...next[idx], [field]: value }
      }
      return next
    })
  }, [fabrics])

  const addItem = () => {
    setItems(prev => [...prev, emptyItem()])
    setFabricSearch(prev => [...prev, ""])
  }

  const removeItem = (idx: number) => {
    if (items.length === 1) return
    setItems(prev => prev.filter((_, i) => i !== idx))
    setFabricSearch(prev => prev.filter((_, i) => i !== idx))
  }

  const fabricTotal = items.reduce((sum, it) => sum + it.fabricQuantity * it.fabricUnitPrice, 0)
  const grandTotal = fabricTotal + stitchingCharge + extraCharge - discount

  const handleSubmit = async () => {
    if (items.some(it => !it.productType)) { toast.error("All items need a product type"); return }

    setSubmitting(true)
    try {
      const payload = {
        delivery_date: deliveryDate || undefined,
        stitching_charge: stitchingCharge,
        extra_charge: extraCharge,
        discount,
        notes: notes || undefined,
      }
      await tailorApi.updateOrder(+id, payload)
      toast.success("Order updated successfully")
      router.push(`/dashboard/tailor/orders/${id}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to update order")
    } finally {
      setSubmitting(false)
    }
  }

  const customerResolved = selectedCustomer !== null
  const effectiveMeasurements = measurements

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3].map(n => (
          <div key={n} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="border border-red-200 bg-red-50 rounded-xl p-6 text-center space-y-3">
          <p className="text-red-700 font-semibold">{loadError}</p>
          <Button variant="outline" onClick={() => router.push(`/dashboard/tailor/orders/${id}`)}>
            Back to Order
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/dashboard/tailor/orders/${id}`)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-black text-gray-900">Edit Order #{order?.orderNumber}</h1>
          <p className="text-sm text-gray-500">Update order details below</p>
        </div>
      </div>

      {/* SECTION 1 — Customer */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Customer</h2>
        </div>

        {/* Selected customer (read-only in edit mode) */}
        {customerResolved && (
          <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <Badge className="bg-purple-100 text-purple-700 mb-1">Selected</Badge>
              <p className="font-semibold text-gray-900">{selectedCustomer.name}</p>
              <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>
              {selectedCustomer.address && <p className="text-sm text-gray-500">{selectedCustomer.address}</p>}
            </div>
          </div>
        )}

        {/* Measurements */}
        {customerResolved && effectiveMeasurements.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5" /> Existing Measurements
            </p>
            <div className="grid grid-cols-2 gap-2">
              {effectiveMeasurements.map(m => (
                <div key={m.id} className="border rounded-lg p-3 bg-gray-50 text-xs space-y-0.5">
                  <p className="font-semibold text-gray-800 capitalize">{m.productType?.replace(/_/g, " ")}</p>
                  <p className="text-gray-400 text-[10px]">{new Date(m.measuredAt).toLocaleDateString()}</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-gray-600 mt-1">
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
                  {m.notes && <p className="text-gray-400 italic mt-1">{m.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* SECTION 2 — Order Items */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-600" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Order Items</h2>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50"
            onClick={addItem}
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </Button>
        </div>

        {items.map((item, idx) => {
          const filteredFabrics = fabrics.filter(f =>
            !fabricSearch[idx] || f.name.toLowerCase().includes(fabricSearch[idx].toLowerCase())
          )
          const subtotal = item.fabricQuantity * item.fabricUnitPrice
          const itemMeasurements = effectiveMeasurements.filter(
            m => !item.productType || m.productType === item.productType
          )

          return (
            <div key={idx} className="border rounded-lg p-4 space-y-3 bg-gray-50 relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500">Item {idx + 1}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-purple-700">{formatCurrency(subtotal)}</span>
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(idx)}
                      className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Product Type *</Label>
                  <Select value={item.productType} onValueChange={v => updateItem(idx, "productType", v)}>
                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Measurement (optional)</Label>
                  <Select
                    value={item.measurementId}
                    onValueChange={v => updateItem(idx, "measurementId", v)}
                    disabled={!customerResolved}
                  >
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {itemMeasurements.map(m => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.productType} — {new Date(m.measuredAt).toLocaleDateString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Fabric</Label>
                <Input
                  placeholder="Search fabric..."
                  value={fabricSearch[idx] ?? ""}
                  onChange={e => setFabricSearch(prev => {
                    const next = [...prev]
                    next[idx] = e.target.value
                    return next
                  })}
                  className="mb-1.5"
                />
                <Select value={item.fabricId} onValueChange={v => updateItem(idx, "fabricId", v)}>
                  <SelectTrigger><SelectValue placeholder="Select fabric..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No fabric</SelectItem>
                    {filteredFabrics.map(f => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name} — stock: {f.stockQuantity} {f.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Quantity</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={item.fabricQuantity}
                    onChange={e => updateItem(idx, "fabricQuantity", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Unit Price</Label>
                  <Input
                    type="number"
                    min={0}
                    value={item.fabricUnitPrice}
                    onChange={e => updateItem(idx, "fabricUnitPrice", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Item Notes</Label>
                <Input
                  placeholder="Optional notes for this item..."
                  value={item.notes}
                  onChange={e => updateItem(idx, "notes", e.target.value)}
                />
              </div>
            </div>
          )
        })}
      </Card>

      {/* SECTION 3 — Charges & Dates */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <ChevronRight className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Charges & Dates</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Order Date</Label>
            <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} disabled />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Delivery Date</Label>
            <Input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Stitching Charge</Label>
            <Input
              type="number"
              min={0}
              value={stitchingCharge}
              onChange={e => setStitchingCharge(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Extra Charge</Label>
            <Input
              type="number"
              min={0}
              value={extraCharge}
              onChange={e => setExtraCharge(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Discount</Label>
            <Input
              type="number"
              min={0}
              value={discount}
              onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Fabric Total</span>
            <span>{formatCurrency(fabricTotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Stitching</span>
            <span>+ {formatCurrency(stitchingCharge)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Extra</span>
            <span>+ {formatCurrency(extraCharge)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Discount</span>
            <span>− {formatCurrency(discount)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 border-t pt-2 mt-1">
            <span>Grand Total</span>
            <span className="text-purple-700">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </Card>

      {/* SECTION 4 — Notes */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <ChevronRight className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Notes</h2>
          <Badge className="bg-gray-100 text-gray-500 text-xs">optional</Badge>
        </div>
        <textarea
          placeholder="Order-level notes..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          onClick={() => router.push(`/dashboard/tailor/orders/${id}`)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          className="bg-purple-600 hover:bg-purple-700 min-w-36 gap-2"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  )
}
