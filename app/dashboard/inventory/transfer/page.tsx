"use client"

import { useState, useEffect, useMemo } from "react"
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useTransfer } from "@/contexts/transfer-context"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { transferApi, type LocationProduct, type LocationProductRaw } from "@/lib/transferApi"
import { useToast } from "@/hooks/use-toast"

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Completed: "bg-green-100 text-green-800",
  Cancelled: "bg-red-100 text-red-800",
}

function flattenLocationProducts(raw: LocationProductRaw[]): LocationProduct[] {
  const rows: LocationProduct[] = []
  for (const product of raw) {
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        rows.push({
          type: 'variant',
          id: variant.id,
          productId: product.id,
          productName: product.name,
          variantName: variant.name,
          sku: variant.sku,
          stock: variant.stock,
        })
      }
    } else {
      rows.push({
        type: 'product',
        id: product.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        stock: product.stock,
      })
    }
  }
  return rows
}

export default function StockTransferPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { warehouses } = useWarehouse()
  const { transfers, loading, addTransfer, cancelTransfer } = useTransfer()

  const [fromWarehouse, setFromWarehouse] = useState("")
  const [toWarehouse, setToWarehouse] = useState("")
  const [rawLocationProducts, setRawLocationProducts] = useState<LocationProductRaw[]>([])
  const [locationProductsLoading, setLocationProductsLoading] = useState(false)
  const [selectedRowKey, setSelectedRowKey] = useState("")
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState<number | null>(null)

  useEffect(() => {
    if (!fromWarehouse) {
      setRawLocationProducts([])
      setSelectedRowKey("")
      return
    }
    setLocationProductsLoading(true)
    setSelectedRowKey("")
    transferApi.getProductsByLocation(Number(fromWarehouse))
      .then(res => setRawLocationProducts(res.data ?? []))
      .catch(err => console.error("Failed to fetch location products:", err))
      .finally(() => setLocationProductsLoading(false))
  }, [fromWarehouse])

  const locationProducts = useMemo(() => flattenLocationProducts(rawLocationProducts), [rawLocationProducts])

  const selectedItem = locationProducts.find(p =>
    (p.type === 'variant' ? `v-${p.id}` : `p-${p.id}`) === selectedRowKey
  )

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedItem || !fromWarehouse || !toWarehouse || !quantity) return
    const qtyNum = Number(quantity)
    if (qtyNum <= 0) return
    if (qtyNum > selectedItem.stock) {
      alert(`Only ${selectedItem.stock} in stock at this location`)
      return
    }

    try {
      setSubmitting(true)
      await addTransfer({
        productId: selectedItem.productId,
        variantId: selectedItem.type === 'variant' ? selectedItem.id : undefined,
        fromLocationId: Number(fromWarehouse),
        toLocationId: Number(toWarehouse),
        quantity: qtyNum,
        notes: notes || undefined,
      })
      toast({ title: "Success", description: "Transfer created successfully" })
      setFromWarehouse("")
      setToWarehouse("")
      setRawLocationProducts([])
      setSelectedRowKey("")
      setQuantity("")
      setNotes("")
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Transfer failed" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (id: number) => {
    try {
      setCancelling(id)
      await cancelTransfer(id)
      toast({ title: "Success", description: "Transfer cancelled successfully" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "Failed to cancel transfer" })
    } finally {
      setCancelling(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">Stock Transfers</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* New Transfer Form */}
        <Card>
          <CardHeader>
            <CardTitle>New Transfer</CardTitle>
            <CardDescription>Move stock between warehouses</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Warehouse</Label>
                  <Select value={fromWarehouse} onValueChange={setFromWarehouse}>
                    <SelectTrigger><SelectValue placeholder="From..." /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => (
                        <SelectItem key={w.id} value={String(w.id)} disabled={String(w.id) === toWarehouse}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Destination Warehouse</Label>
                  <Select value={toWarehouse} onValueChange={setToWarehouse}>
                    <SelectTrigger><SelectValue placeholder="To..." /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => (
                        <SelectItem key={w.id} value={String(w.id)} disabled={String(w.id) === fromWarehouse}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Product / Variant</Label>
                <Select
                  value={selectedRowKey}
                  onValueChange={setSelectedRowKey}
                  disabled={!fromWarehouse || locationProductsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !fromWarehouse ? "Select source warehouse first" :
                      locationProductsLoading ? "Loading..." :
                      locationProducts.length === 0 ? "No stock at this location" :
                      "Choose product..."
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {locationProducts.map(p => {
                      const key = p.type === 'variant' ? `v-${p.id}` : `p-${p.id}`
                      const label = p.variantName ? `${p.productName} — ${p.variantName}` : p.productName
                      return (
                        <SelectItem key={key} value={key}>
                          {label}
                          <span className="ml-2 text-xs text-gray-400">({p.stock} in stock)</span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  Quantity
                  {selectedItem && (
                    <span className="text-gray-500 font-normal ml-1">(Available: {selectedItem.stock})</span>
                  )}
                </Label>
                <Input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  min={1}
                  max={selectedItem?.stock}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for transfer..." />
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!selectedRowKey || !fromWarehouse || !toWarehouse || !quantity || submitting}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {submitting ? "Processing..." : "Confirm Transfer"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Transfer History */}
        <Card>
          <CardHeader>
            <CardTitle>Transfer History</CardTitle>
            <CardDescription>Recent stock movements</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-y-auto max-h-[520px]">
              {loading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : transfers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No transfers yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Product</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Route</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Qty</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Status</th>
                      <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map(t => (
                      <tr key={t.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{t.product.name}</div>
                          {t.variant?.name && <div className="text-xs text-gray-500">{t.variant.name}</div>}
                          {t.notes && <div className="text-xs text-gray-400 mt-0.5 italic">{t.notes}</div>}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          <div className="font-medium">{t.fromLocation.name}</div>
                          <div className="text-gray-400 my-0.5">↓</div>
                          <div className="font-medium">{t.toLocation.name}</div>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-gray-900">{t.quantity}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || "bg-gray-100 text-gray-700"}`}>
                            {t.status === "Completed" && <CheckCircle2 className="w-3 h-3" />}
                            {t.status === "Pending" && <Clock className="w-3 h-3" />}
                            {t.status === "Cancelled" && <XCircle className="w-3 h-3" />}
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {t.status === "Pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700 text-xs"
                              onClick={() => handleCancel(t.id)}
                              disabled={cancelling === t.id}
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              {cancelling === t.id ? "..." : "Cancel"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
