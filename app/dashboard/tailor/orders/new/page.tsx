"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, User, Ruler, Package, ChevronRight, Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { tailorApi, TailorFabric, TailorMeasurement, TailorCustomer, PRODUCT_TYPES } from "@/lib/tailorApi"
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

export default function NewTailorOrderPage() {
  const { canWrite } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const router = useRouter()

  if (!canWrite("TailorOrders")) return <AccessDenied />

  // Fabrics
  const [fabrics, setFabrics] = useState<TailorFabric[]>([])
  const [fabricSearch, setFabricSearch] = useState<string[]>([])

  // Customer section
  const [phoneSearch, setPhoneSearch] = useState("")
  const [searchingPhone, setSearchingPhone] = useState(false)
  const [foundCustomer, setFoundCustomer] = useState<TailorCustomer | null>(null)
  const [customerNotFound, setCustomerNotFound] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<TailorCustomer | null>(null)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [newCustomerAddress, setNewCustomerAddress] = useState("")
  const [measurements, setMeasurements] = useState<TailorMeasurement[]>([])

  // Items
  const [items, setItems] = useState<OrderItem[]>([emptyItem()])

  // Charges & dates
  const [orderDate, setOrderDate] = useState(TODAY_STR)
  const [deliveryDate, setDeliveryDate] = useState("")
  const [stitchingCharge, setStitchingCharge] = useState(0)
  const [extraCharge, setExtraCharge] = useState(0)
  const [discount, setDiscount] = useState(0)

  // Advance payment
  const [advancePayment, setAdvancePayment] = useState(0)
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState("Cash")

  // Notes
  const [notes, setNotes] = useState("")

  // Submission
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    tailorApi.getFabrics({ limit: 200, status: "active" })
      .then(r => {
        const list: TailorFabric[] = r.data?.data?.data ?? r.data?.data ?? []
        setFabrics(list)
        setFabricSearch(Array(items.length).fill(""))
      })
      .catch(() => toast.error("Failed to load fabrics"))
  }, [])

  const handlePhoneSearch = async () => {
    if (!phoneSearch.trim()) return
    setSearchingPhone(true)
    setFoundCustomer(null)
    setCustomerNotFound(false)
    setSelectedCustomer(null)
    setMeasurements([])
    try {
      const r = await tailorApi.findCustomerByPhone(phoneSearch.trim())
      const customer: TailorCustomer | null = r.data?.data ?? r.data ?? null
      if (customer && customer.id) {
        setFoundCustomer(customer)
        setCustomerNotFound(false)
        // Load measurements
        tailorApi.getMeasurementsByCustomer(customer.id)
          .then(mr => setMeasurements(mr.data?.data ?? mr.data ?? []))
          .catch(() => {})
      } else {
        setCustomerNotFound(true)
        setNewCustomerPhone(phoneSearch.trim())
      }
    } catch {
      setCustomerNotFound(true)
      setNewCustomerPhone(phoneSearch.trim())
    } finally {
      setSearchingPhone(false)
    }
  }

  const useFoundCustomer = () => {
    if (!foundCustomer) return
    setSelectedCustomer(foundCustomer)
  }

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
  const dueAfterAdvance = grandTotal - advancePayment

  const handleSubmit = async () => {
    const custName = selectedCustomer?.name || newCustomerName.trim()
    const custPhone = selectedCustomer?.phone || newCustomerPhone.trim()
    const custAddress = selectedCustomer?.address || newCustomerAddress.trim()

    if (!custPhone) { toast.error("Customer phone required"); return }
    if (!custName) { toast.error("Customer name required"); return }
    if (items.some(it => !it.productType)) { toast.error("All items need a product type"); return }

    setSubmitting(true)
    try {
      const payload = {
        customer_name: custName,
        customer_phone: custPhone,
        customer_address: custAddress,
        order_date: orderDate,
        delivery_date: deliveryDate || undefined,
        stitching_charge: stitchingCharge,
        extra_charge: extraCharge,
        discount,
        advance_payment: advancePayment,
        advance_payment_method: advancePayment > 0 ? advancePaymentMethod : undefined,
        notes: notes || undefined,
        items: items.map(it => ({
          product_type: it.productType,
          fabric_id: it.fabricId && it.fabricId !== "none" ? Number(it.fabricId) : undefined,
          fabric_quantity: it.fabricQuantity,
          fabric_unit_price: it.fabricUnitPrice,
          measurement_id: it.measurementId && it.measurementId !== "none" ? Number(it.measurementId) : undefined,
          notes: it.notes || undefined,
        })),
      }
      const r = await tailorApi.createOrder(payload)
      const created = r.data?.data ?? r.data
      toast.success("Order created successfully")
      if (created?.id) router.push(`/dashboard/tailor/orders/${created.id}`)
      else router.push("/dashboard/tailor/orders")
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to create order")
    } finally {
      setSubmitting(false)
    }
  }

  const customerResolved = selectedCustomer !== null
  const effectiveMeasurements = measurements

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/tailor/orders")}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-black text-gray-900">New Tailor Order</h1>
          <p className="text-sm text-gray-500">Fill in details below</p>
        </div>
      </div>

      {/* SECTION 1 — Customer */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Customer</h2>
        </div>

        {/* Phone search */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs text-gray-500 mb-1 block">Search by phone</Label>
            <Input
              placeholder="Enter phone number..."
              value={phoneSearch}
              onChange={e => setPhoneSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePhoneSearch()}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              className="gap-2 border-purple-300 text-purple-700 hover:bg-purple-50"
              onClick={handlePhoneSearch}
              disabled={searchingPhone}
            >
              <Search className="w-4 h-4" />
              {searchingPhone ? "Searching..." : "Search"}
            </Button>
          </div>
        </div>

        {/* Found customer */}
        {foundCustomer && !customerResolved && (
          <div className="border border-green-200 bg-green-50 rounded-lg p-4 flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-semibold text-gray-900">{foundCustomer.name}</p>
              <p className="text-sm text-gray-500">{foundCustomer.phone}</p>
              {foundCustomer.address && <p className="text-sm text-gray-500">{foundCustomer.address}</p>}
            </div>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 shrink-0"
              onClick={useFoundCustomer}
            >
              Use this customer
            </Button>
          </div>
        )}

        {/* Selected customer */}
        {customerResolved && (
          <div className="border border-purple-200 bg-purple-50 rounded-lg p-4 flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <Badge className="bg-purple-100 text-purple-700 mb-1">Selected</Badge>
              <p className="font-semibold text-gray-900">{selectedCustomer.name}</p>
              <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>
              {selectedCustomer.address && <p className="text-sm text-gray-500">{selectedCustomer.address}</p>}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => { setSelectedCustomer(null); setFoundCustomer(null); setCustomerNotFound(false) }}
            >
              Change
            </Button>
          </div>
        )}

        {/* New customer mini form */}
        {customerNotFound && !customerResolved && (
          <div className="border border-orange-200 bg-orange-50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-orange-700">Customer not found — enter details to create</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Name *</Label>
                <Input
                  placeholder="Full name"
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Phone *</Label>
                <Input
                  placeholder="Phone"
                  value={newCustomerPhone}
                  onChange={e => setNewCustomerPhone(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Address</Label>
              <Input
                placeholder="Address (optional)"
                value={newCustomerAddress}
                onChange={e => setNewCustomerAddress(e.target.value)}
              />
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
            <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
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

      {/* SECTION 4 — Advance Payment */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <ChevronRight className="w-4 h-4 text-purple-600" />
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Advance Payment</h2>
          <Badge className="bg-gray-100 text-gray-500 text-xs">optional</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Advance Amount</Label>
            <Input
              type="number"
              min={0}
              value={advancePayment}
              onChange={e => setAdvancePayment(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Payment Method</Label>
            <Select value={advancePaymentMethod} onValueChange={setAdvancePaymentMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="Mobile Banking">Mobile Banking</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-between text-sm font-semibold bg-red-50 rounded-lg p-3">
          <span className="text-gray-700">Due after advance</span>
          <span className={dueAfterAdvance > 0 ? "text-red-600" : "text-green-600"}>
            {formatCurrency(Math.max(0, dueAfterAdvance))}
          </span>
        </div>
      </Card>

      {/* SECTION 5 — Notes */}
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
          onClick={() => router.push("/dashboard/tailor/orders")}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          className="bg-purple-600 hover:bg-purple-700 min-w-36 gap-2"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Creating..." : "Create Order"}
        </Button>
      </div>
    </div>
  )
}
