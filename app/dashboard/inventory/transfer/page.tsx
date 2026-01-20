"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useProduct, type Product, type Variant } from "@/contexts/product-context"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useTransfer } from "@/contexts/transfer-context"
import { useRouter } from "next/navigation"

export default function StockTransferPage() {
  const router = useRouter()
  const { products, updateProduct } = useProduct()
  const { warehouses } = useWarehouse()
  const { addTransfer } = useTransfer()
  
  const [fromWarehouse, setFromWarehouse] = useState("")
  const [toWarehouse, setToWarehouse] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [selectedVariantId, setSelectedVariantId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [notes, setNotes] = useState("")

  const getAvailableStock = () => {
    if (!selectedProductId || !fromWarehouse) return 0
    
    const product = products.find(p => p.id === selectedProductId)
    if (!product) return 0
    
    if (selectedVariantId) {
        const variant = product.variants?.find(v => v.id === selectedVariantId)
        if (!variant) return 0
        const inv = variant.inventory?.find(i => i.warehouseId === fromWarehouse)
        // Fallback for default warehouse if inventory not explicitly set (legacy compat)
        if (!inv && warehouses.find(w => w.id === fromWarehouse)?.isDefault) return variant.stock
        return inv ? inv.quantity : 0
    } else {
        const inv = product.inventory?.find(i => i.warehouseId === fromWarehouse)
         if (!inv && warehouses.find(w => w.id === fromWarehouse)?.isDefault) return product.stock
        return inv ? inv.quantity : 0
    }
  }

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId || !fromWarehouse || !toWarehouse || !quantity) return
    
    const qtyNum = Number(quantity)
    if (qtyNum <= 0) return
    if (qtyNum > getAvailableStock()) {
        alert("Insufficient stock in source warehouse")
        return
    }

    const product = products.find(p => p.id === selectedProductId)
    if (!product) return

    // 1. Record Transfer
    addTransfer({
        productId: selectedProductId,
        productName: product.name,
        variantId: selectedVariantId,
        fromWarehouseId: fromWarehouse,
        toWarehouseId: toWarehouse,
        quantity: qtyNum,
        notes
    })

    // 2. Update Product Inventory
    // Deep copy product to avoid mutation issues
    const updatedProduct = JSON.parse(JSON.stringify(product)) as Product

    const updateInventory = (inventoryList: {warehouseId: string, quantity: number}[] = [], warehouseId: string, change: number) => {
        const index = inventoryList.findIndex(i => i.warehouseId === warehouseId)
        if (index >= 0) {
            inventoryList[index].quantity += change
        } else {
            // Initialize if not exists (should handle case where it's decreasing from default implicit stock)
            // Ideally we should have normalized this before.
            // For MVP: if source doesn't exist but has stock (default), we assume it exists. 
            // If dest doesn't exist, create it with 0 + change
            inventoryList.push({ warehouseId, quantity: change })
        }
    }

    if (selectedVariantId) {
        const variant = updatedProduct.variants?.find(v => v.id === selectedVariantId)
        if (variant) {
             if (!variant.inventory) variant.inventory = [] 
             // Logic to handle implicit default stock
             const defWarehouse = warehouses.find(w => w.isDefault)
             if (defWarehouse && !variant.inventory.find(i => i.warehouseId === defWarehouse.id)) {
                 variant.inventory.push({ warehouseId: defWarehouse.id, quantity: variant.stock })
             }

             updateInventory(variant.inventory, fromWarehouse, -qtyNum)
             updateInventory(variant.inventory, toWarehouse, qtyNum)
             
             // Update total stock? No, total stock remains same for transfer. 
             // But we should re-sum just in case? 
             // Wait, product.stock is sum of variants. Variant.stock is constant during transfer between locations? 
             // Yes, if I move 5 items from A to B, total stock is same.
             // BUT, if I treat `stock` as sum of `inventory`, I don't need to touch `stock`?
             // Actually, `Variant.stock` IS the total. So it doesn't change on transfer.
        }
    } else {
        if (!updatedProduct.inventory) updatedProduct.inventory = []
        
        const defWarehouse = warehouses.find(w => w.isDefault)
        if (defWarehouse && !updatedProduct.inventory.find(i => i.warehouseId === defWarehouse.id)) {
            updatedProduct.inventory.push({ warehouseId: defWarehouse.id, quantity: updatedProduct.stock })
        }

        updateInventory(updatedProduct.inventory, fromWarehouse, -qtyNum)
        updateInventory(updatedProduct.inventory, toWarehouse, qtyNum)
    }

    updateProduct(updatedProduct)
    alert("Transfer successful!")
    router.push("/dashboard/inventory")
  }

  const selectedProduct = products.find(p => p.id === selectedProductId)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">New Stock Transfer</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transfer Details</CardTitle>
          <CardDescription>Move stock between warehouses</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTransfer} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Source Warehouse</Label>
                    <Select value={fromWarehouse} onValueChange={setFromWarehouse}>
                        <SelectTrigger>
                            <SelectValue placeholder="From..." />
                        </SelectTrigger>
                        <SelectContent>
                            {warehouses.map(w => (
                                <SelectItem key={w.id} value={w.id} disabled={w.id === toWarehouse}>{w.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Destination Warehouse</Label>
                    <Select value={toWarehouse} onValueChange={setToWarehouse}>
                        <SelectTrigger>
                            <SelectValue placeholder="To..." />
                        </SelectTrigger>
                        <SelectContent>
                            {warehouses.map(w => (
                                <SelectItem key={w.id} value={w.id} disabled={w.id === fromWarehouse}>{w.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Select Product</Label>
                <Select value={selectedProductId} onValueChange={(val) => { setSelectedProductId(val); setSelectedVariantId(""); }}>
                    <SelectTrigger>
                        <SelectValue placeholder="Choose product..." />
                    </SelectTrigger>
                    <SelectContent>
                        {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0 && (
                <div className="space-y-2">
                    <Label>Select Variant</Label>
                    <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Choose variant..." />
                        </SelectTrigger>
                        <SelectContent>
                            {selectedProduct.variants.map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="space-y-2">
                <Label>Quantity (Available: {getAvailableStock()})</Label>
                <Input 
                    type="number" 
                    value={quantity} 
                    onChange={e => setQuantity(e.target.value)} 
                    max={getAvailableStock()}
                    min={1}
                />
            </div>

            <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for transfer..." />
            </div>

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={!selectedProductId || !fromWarehouse || !toWarehouse || !quantity}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Confirm Transfer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
