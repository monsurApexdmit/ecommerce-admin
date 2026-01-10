"use client"

import type React from "react"
import { useState } from "react"
import { Plus, Edit, Trash2, Search, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useVendor, type Vendor } from "@/contexts/vendor-context"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"

export default function VendorsPage() {
    const { vendors, addVendor, updateVendor, deleteVendor } = useVendor()
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)

    // Form State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        address: "",
        description: "",
        status: "Active" as "Active" | "Inactive" | "Blocked",
        totalPaid: 0,
    })

    const filteredVendors = vendors.filter((vendor) =>
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.phone.includes(searchQuery)
    )

    const {
        currentItems: currentVendors,
        currentPage,
        totalPages,
        itemsPerPage,
        setCurrentPage,
        handleItemsPerPageChange,
    } = usePagination(filteredVendors, 10)

    const handleOpenDialog = (vendor?: Vendor) => {
        if (vendor) {
            setEditingVendor(vendor)
            setFormData({
                name: vendor.name,
                email: vendor.email,
                phone: vendor.phone,
                address: vendor.address,
                description: vendor.description || "",
                status: vendor.status,
                totalPaid: vendor.totalPaid,
            })
        } else {
            setEditingVendor(null)
            setFormData({
                name: "",
                email: "",
                phone: "",
                address: "",
                description: "",
                status: "Active",
                totalPaid: 0,
            })
        }
        setIsDialogOpen(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (editingVendor) {
            updateVendor({
                ...editingVendor,
                ...formData,
            })
        } else {
            addVendor({
                id: Date.now().toString(),
                logo: "/placeholder.svg?height=40&width=40",
                ...formData,
            })
        }
        setIsDialogOpen(false)
    }

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this vendor?")) {
            deleteVendor(id)
        }
    }

    const handleViewDetails = (id: string) => {
        router.push(`/dashboard/vendors/${id}`)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Active":
                return "bg-emerald-100 text-emerald-700"
            case "Inactive":
                return "bg-gray-100 text-gray-700"
            case "Blocked":
                return "bg-red-100 text-red-700"
            default:
                return "bg-gray-100 text-gray-700"
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
                <Button onClick={() => handleOpenDialog()} className="bg-emerald-500 hover:bg-emerald-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vendor
                </Button>
            </div>

            {/* Search */}
            <div className="bg-white rounded-lg border mb-6 p-4">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        type="text"
                        placeholder="Search by name, email or phone"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Vendors Table */}
            <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Vendor
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Contact
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Address
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Total Paid
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {currentVendors.map((vendor) => (
                                <tr key={vendor.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <Image
                                                src={vendor.logo || "/placeholder.svg"}
                                                alt={vendor.name}
                                                width={40}
                                                height={40}
                                                className="rounded-full"
                                            />
                                            <div>
                                                <div className="font-medium text-gray-900">{vendor.name}</div>
                                                <div className="text-sm text-gray-500">{vendor.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-600">{vendor.phone}</td>
                                    <td className="py-3 px-4 text-sm text-gray-600">{vendor.address}</td>
                                    <td className="py-3 px-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(vendor.status)}`}>
                                            {vendor.status}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                                        ${vendor.totalPaid.toFixed(2)}
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleViewDetails(vendor.id)}
                                                className="p-1 hover:bg-gray-100 rounded"
                                            >
                                                <Eye className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <button onClick={() => handleOpenDialog(vendor)} className="p-1 hover:bg-gray-100 rounded">
                                                <Edit className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <button onClick={() => handleDelete(vendor.id)} className="p-1 hover:bg-gray-100 rounded">
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {currentVendors.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-500">
                                        No vendors found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-6">
                <PaginationControl
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    itemsPerPage={itemsPerPage}
                    onItemsPerPageChange={handleItemsPerPageChange}
                    totalItems={filteredVendors.length}
                />
            </div>

            {/* Add/Edit Vendor Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingVendor ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label>Vendor Name</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="e.g. Fresh Farms Ltd."
                                className="mt-1"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Email</Label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                    placeholder="vendor@example.com"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label>Phone</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    required
                                    placeholder="+1 234 567 890"
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        <div>
                            <Label>Address</Label>
                            <Input
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                required
                                placeholder="123 Business Street, City"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Brief description about the vendor..."
                                className="mt-1"
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Status</Label>
                                <Select
                                    value={formData.status}
                                    onValueChange={(value: "Active" | "Inactive" | "Blocked") =>
                                        setFormData({ ...formData, status: value })
                                    }
                                >
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="Inactive">Inactive</SelectItem>
                                        <SelectItem value="Blocked">Blocked</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Total Paid</Label>
                                <Input
                                    type="number"
                                    value={formData.totalPaid}
                                    onChange={(e) => setFormData({ ...formData, totalPaid: parseFloat(e.target.value) || 0 })}
                                    placeholder="0.00"
                                    className="mt-1"
                                    step="0.01"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600">
                                {editingVendor ? "Update Vendor" : "Add Vendor"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
