"use client"

import { useParams, useRouter } from "next/navigation"
import { useVendor } from "@/contexts/vendor-context"
import { useProduct } from "@/contexts/product-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { ArrowLeft, Package, DollarSign, CreditCard, Wallet, Edit2, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { StatTile } from "@/components/common/StatTile"
import { FormField } from "@/components/common/FormField"
import { EmptyState } from "@/components/common/EmptyState"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { UserAvatar } from "@/components/common/UserAvatar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState } from "react"
import Link from "next/link"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"

export default function VendorDetailsPage() {
  const { canRead } = useSaasAuth()
  const params = useParams()
  const router = useRouter()
  const vendorId = params.id as string

  const { getVendorById, updateVendor } = useVendor()
  const { getProductsByVendor } = useProduct()
  const { formatCurrency } = useCompanySettings()

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

  const blocked = useModuleGuard('Vendors')
  if (blocked) return blocked

  if (!vendor) {
    return (
      <EmptyState
        className="min-h-[400px]"
        title="Supplier Not Found"
        action={<Button onClick={() => router.push("/dashboard/vendors")}>Back to Suppliers</Button>}
      />
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

  const payableTone = vendor.amountPayable > 0 ? "text-destructive" : "text-emerald-600"
  const poDueTone = (vendor.poDueAmount ?? 0) > 0 ? "text-destructive" : "text-emerald-600"

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Supplier Details"
        actions={<>
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/vendors")}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button size="sm" onClick={openEditDialog}>
            <Edit2 className="w-4 h-4" />
            Edit Supplier
          </Button>
        </>}
      />

      {/* Profile card */}
      <Card className="p-6">
        <div className="flex items-start gap-6">
          <UserAvatar src={vendor.logo} name={vendor.name} fallback={vendor.name.charAt(0).toUpperCase()} className="size-20 shrink-0 text-2xl" />
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-semibold">{vendor.name}</h2>
              <StatusBadge status={vendor.status} />
            </div>
            <InfoList className="grid-cols-1 gap-1 sm:grid-cols-2">
              <InfoRow layout="stacked" label="Email" value={vendor.email} />
              <InfoRow layout="stacked" label="Phone" value={vendor.phone} />
              {vendor.address && <InfoRow layout="stacked" label="Address" value={vendor.address} className="sm:col-span-2" />}
              {vendor.description && <InfoRow layout="stacked" label="Description" value={vendor.description} className="sm:col-span-2" />}
              <InfoRow layout="stacked" label="Member since" value={new Date(vendor.created_at).toLocaleDateString()} />
            </InfoList>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatTile label="Total Products" value={totalProducts} icon={<Package />} />
        <StatTile label="Inventory Value" value={formatCurrency(inventoryValue)} icon={<DollarSign />} />
        <StatTile label="Total Paid" value={formatCurrency(vendor.totalPaid)} icon={<CreditCard />} />
        <StatTile label="Amount Payable" value={<span className={payableTone}>{formatCurrency(vendor.amountPayable)}</span>} icon={<Wallet className={payableTone} />} />
        <StatTile label="Purchase Order Due" value={<span className={poDueTone}>{formatCurrency(vendor.poDueAmount ?? 0)}</span>} icon={<Receipt className={poDueTone} />} />
      </div>

      {/* Products table */}
      <SectionCard title={`Products (${totalProducts})`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState icon={Package} title="No products found for this supplier" className="p-4 md:p-6" />
                  </TableCell>
                </TableRow>
              ) : vendorProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar src={product.image || "/placeholder.svg"} name={product.name} shape="square" className="size-10" />
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{formatCurrency(product.salePrice)}</TableCell>
                  <TableCell>
                    {product.stock < 5 ? (
                      <span className="text-destructive font-semibold">{product.stock} <span className="text-xs">(Low)</span></span>
                    ) : product.stock}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(product.salePrice * product.stock)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={product.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      {/* Edit dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <FormField label="Supplier Name" htmlFor="vd-name" className="col-span-2">
              <Input id="vd-name" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
            </FormField>
            <FormField label="Email" htmlFor="vd-email">
              <Input id="vd-email" type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} />
            </FormField>
            <FormField label="Phone" htmlFor="vd-phone">
              <Input id="vd-phone" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} />
            </FormField>
            <FormField label="Address" htmlFor="vd-address" className="col-span-2">
              <Input id="vd-address" value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} />
            </FormField>
            <FormField label="Description" htmlFor="vd-desc" className="col-span-2">
              <Input id="vd-desc" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
            </FormField>
            <FormField label="Total Paid ($)" htmlFor="vd-paid">
              <Input
                id="vd-paid"
                type="number" min={0} step="0.01"
                value={formData.totalPaid}
                onChange={e => setFormData(p => ({ ...p, totalPaid: parseFloat(e.target.value) || 0 }))}
              />
            </FormField>
            <FormField label="Amount Payable ($)" htmlFor="vd-payable">
              <Input
                id="vd-payable"
                type="number" min={0} step="0.01"
                value={formData.amountPayable}
                onChange={e => setFormData(p => ({ ...p, amountPayable: parseFloat(e.target.value) || 0 }))}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
