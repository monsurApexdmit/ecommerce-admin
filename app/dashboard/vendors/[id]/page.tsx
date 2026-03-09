"use client"

import { useParams, useRouter } from "next/navigation"
import { useVendor } from "@/contexts/vendor-context"
import { useProduct } from "@/contexts/product-context"
import { ArrowLeft, Package, DollarSign, CreditCard, Wallet, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import Link from "next/link"

export default function VendorDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const vendorId = params.id as string

  const { getVendorById, updateVendor } = useVendor()
  const { getProductsByVendor } = useProduct()

  const vendor = getVendorById(vendorId)
  const vendorProducts = getProductsByVendor(vendorId)

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    description: "",
    status: "Active",
    totalPaid: 0,
    amountPayable: 0,
  })

  if (!vendor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Vendor Not Found</h2>
        <Button onClick={() => router.push("/dashboard/vendors")}>Back to Vendors</Button>
      </div>
    )
  }

  const totalProducts = vendorProducts.length
  const inventoryValue = vendorProducts.reduce((sum, p) => sum + p.salePrice * p.stock, 0)

  const openEditDialog = () => {
    setFormData({
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      description: vendor.description,
      status: vendor.status,
      totalPaid: vendor.totalPaid,
      amountPayable: vendor.amountPayable,
    })
    setIsEditDialogOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateVendor(vendor.id, formData)
      setIsEditDialogOpen(false)
    } catch (err: any) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  const statusColor = vendor.status === "Active"
    ? "bg-emerald-100 text-emerald-700"
    : vendor.status === "Blocked"
    ? "bg-red-100 text-red-700"
    : "bg-gray-100 text-gray-700"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/vendors")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Details</h1>
        </div>
        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openEditDialog}>
          <Edit2 className="w-4 h-4 mr-2" />
          Edit Vendor
        </Button>
      </div>

      {/* Profile card */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          {vendor.logo ? (
            <img
              src={vendor.logo}
              alt={vendor.name}
              className="w-20 h-20 rounded-full object-cover border"
              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }}
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-600 shrink-0">
              {vendor.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{vendor.name}</h2>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>{vendor.status}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm text-gray-600">
              <p><span className="font-medium text-gray-800">Email:</span> {vendor.email}</p>
              <p><span className="font-medium text-gray-800">Phone:</span> {vendor.phone}</p>
              {vendor.address && (
                <p className="sm:col-span-2"><span className="font-medium text-gray-800">Address:</span> {vendor.address}</p>
              )}
              {vendor.description && (
                <p className="sm:col-span-2"><span className="font-medium text-gray-800">Description:</span> {vendor.description}</p>
              )}
              <p><span className="font-medium text-gray-800">Member since:</span> {new Date(vendor.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Package className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Products</p>
              <p className="text-xl font-bold text-gray-900">{totalProducts}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><DollarSign className="w-5 h-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Inventory Value</p>
              <p className="text-xl font-bold text-gray-900">${inventoryValue.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg"><CreditCard className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <p className="text-xs text-gray-500">Total Paid</p>
              <p className="text-xl font-bold text-gray-900">${vendor.totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${vendor.amountPayable > 0 ? "bg-red-100" : "bg-emerald-100"}`}>
              <Wallet className={`w-5 h-5 ${vendor.amountPayable > 0 ? "text-red-600" : "text-emerald-600"}`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Amount Payable</p>
              <p className={`text-xl font-bold ${vendor.amountPayable > 0 ? "text-red-600" : "text-emerald-600"}`}>
                ${vendor.amountPayable.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Products table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Products ({totalProducts})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Product</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Category</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Price</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Stock</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Value</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {vendorProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">No products found for this vendor</td>
                </tr>
              ) : vendorProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.image || "/placeholder.svg"}
                        alt={product.name}
                        className="w-10 h-10 rounded object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }}
                      />
                      <span className="font-medium text-gray-900">{product.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">{product.category}</td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-900">${product.salePrice.toFixed(2)}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {product.stock < 5 ? (
                      <span className="text-red-600 font-semibold">{product.stock} <span className="text-xs">(Low)</span></span>
                    ) : product.stock}
                  </td>
                  <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                    ${(product.salePrice * product.stock).toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.status === "Selling" ? "bg-emerald-100 text-emerald-700"
                      : product.status === "Out of Stock" ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                    }`}>
                      {product.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-1">
              <Label>Vendor Name</Label>
              <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Address</Label>
              <Input value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Input value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Total Paid ($)</Label>
              <Input
                type="number" min={0} step="0.01"
                value={formData.totalPaid}
                onChange={e => setFormData(p => ({ ...p, totalPaid: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Amount Payable ($)</Label>
              <Input
                type="number" min={0} step="0.01"
                value={formData.amountPayable}
                onChange={e => setFormData(p => ({ ...p, amountPayable: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
