"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Search, Plus, Edit2, Trash2, Eye } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useVendor, type Vendor } from "@/contexts/vendor-context"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"

export default function VendorsPage() {
  const { vendors, isLoading: contextLoading, addVendor, updateVendor, deleteVendor } = useVendor()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    logo: "",
    status: "Active",
    description: "",
    totalPaid: 0,
    amountPayable: 0,
  })

  // Filter vendors
  const filteredVendors = vendors.filter(
    (vendor) =>
      vendor?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor?.phone?.includes(searchTerm),
  )

  const {
    currentItems: currentVendors,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredVendors, 10)

  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  useEffect(() => {
    if (!contextLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [contextLoading])

  const openAddDialog = () => {
    setEditingVendor(null)
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      logo: "",
      status: "Active",
      description: "",
      totalPaid: 0,
      amountPayable: 0,
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      name: vendor.name,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      logo: vendor.logo,
      status: vendor.status,
      description: vendor.description,
      totalPaid: vendor.totalPaid,
      amountPayable: vendor.amountPayable,
    })
    setIsDialogOpen(true)
  }

  const handleSaveVendor = async () => {
    if (!formData.name || !formData.email || !formData.phone) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Vendor Name, Email, and Phone are required",
      })
      return
    }

    try {
      if (editingVendor) {
        await updateVendor(editingVendor.id, formData)
        toast({
          title: "Success",
          description: "Vendor updated successfully",
        })
      } else {
        await addVendor(formData)
        toast({
          title: "Success",
          description: "Vendor created successfully",
        })
      }
      setIsDialogOpen(false)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to ${editingVendor ? 'update' : 'create'} vendor`,
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this vendor?")) {
      try {
        await deleteVendor(id)
        toast({
          title: "Success",
          description: "Vendor deleted successfully",
        })
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || 'Failed to delete vendor',
        })
      }
    }
  }

  const handleToggleStatus = async (vendor: Vendor) => {
    const newStatus = vendor.status === 'Active' ? 'Inactive' : 'Active'
    try {
      await updateVendor(vendor.id, { status: newStatus })
      toast({
        title: "Success",
        description: `Vendor ${newStatus === 'Active' ? 'activated' : 'deactivated'} successfully`,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to update vendor status',
      })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
        <Button size="sm" className="gap-2 bg-emerald-500 hover:bg-emerald-600" onClick={openAddDialog}>
          <Plus className="w-4 h-4" />
          Add Vendor
        </Button>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, phone, or contact person"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  handleFilterChange()
                }}
                className="pl-10"
              />
            </div>
            <Button className="bg-emerald-500 hover:bg-emerald-600">Filter</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">VENDOR NAME</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">EMAIL</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">PHONE</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">ADDRESS</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">STATUS</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4"><Skeleton className="h-4 w-12" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-40" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-6 w-11 rounded-full" /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
                      </td>
                    </tr>
                  ))
                : currentVendors.map((vendor) => (
                    <tr key={vendor.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">{vendor.id}</td>
                      <td className="py-3 px-4">
                        <Link href={`/dashboard/vendors/${vendor.id}`} className="text-emerald-600 hover:underline font-medium">
                          {vendor.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{vendor.email}</td>
                      <td className="py-3 px-4 text-gray-600">{vendor.phone}</td>
                      <td className="py-3 px-4 text-gray-600">{vendor.address || '-'}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(vendor)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            vendor.status === 'Active' ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              vendor.status === 'Active' ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/vendors/${vendor.id}`} className="p-2 hover:bg-gray-100 rounded inline-block">
                            <Eye className="w-4 h-4 text-gray-600" />
                          </Link>
                          <button
                            onClick={() => openEditDialog(vendor)}
                            className="p-2 hover:bg-gray-100 rounded inline-block"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600" />
                          </button>
                          <button onClick={() => handleDelete(vendor.id)} className="p-2 hover:bg-gray-100 rounded">
                            <Trash2 className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="mx-4 pb-4">
          <PaginationControl
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            totalItems={filteredVendors.length}
          />
        </div>
      </div>

      {/* Add/Edit Vendor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="name">Vendor Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter vendor name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="vendor@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 234 567 890"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="456 Business Ave"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                value={formData.logo}
                onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="A reliable supplier"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVendor} className="bg-emerald-600 hover:bg-emerald-700">
              {editingVendor ? "Update Vendor" : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
