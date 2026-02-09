"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useShippingAddress, ShippingAddress } from "@/contexts/shipping-address-context"
import { Search, Plus, Trash2, Edit, MapPin, Star, Home, Briefcase, MoreVertical } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { usePagination } from "@/hooks/use-pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function ShippingAddressesPage() {
  const {
    addresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setAsDefault,
  } = useShippingAddress()

  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [addressTypeFilter, setAddressTypeFilter] = useState("all")
  const [selectedAddressIds, setSelectedAddressIds] = useState<string[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    customerId: "",
    customerName: "",
    fullName: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Bangladesh",
    isDefault: false,
    addressType: "home" as "home" | "office" | "other",
  })

  // Simulated loading
  useEffect(() => {
    setTimeout(() => setIsLoading(false), 800)
  }, [])

  // Filter addresses
  const filteredAddresses = addresses.filter((address) => {
    const matchesSearch =
      searchQuery === "" ||
      address.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      address.addressLine1.toLowerCase().includes(searchQuery.toLowerCase()) ||
      address.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      address.phone.includes(searchQuery)

    const matchesType = addressTypeFilter === "all" || address.addressType === addressTypeFilter

    return matchesSearch && matchesType
  })

  const {
    currentItems,
    currentPage,
    totalPages,
    itemsPerPage,
    goToPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredAddresses, 10)

  const handleSelectAll = () => {
    if (selectedAddressIds.length === currentItems.length) {
      setSelectedAddressIds([])
    } else {
      setSelectedAddressIds(currentItems.map((address) => address.id))
    }
  }

  const handleSelectAddress = (id: string) => {
    setSelectedAddressIds((prev) =>
      prev.includes(id) ? prev.filter((addressId) => addressId !== id) : [...prev, id]
    )
  }

  const handleAddEditOpen = (address?: ShippingAddress) => {
    if (address) {
      setEditingAddress(address)
      setFormData({
        customerId: address.customerId || "",
        customerName: address.customerName || "",
        fullName: address.fullName,
        phone: address.phone,
        email: address.email || "",
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2 || "",
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        isDefault: address.isDefault,
        addressType: address.addressType,
      })
    } else {
      setEditingAddress(null)
      setFormData({
        customerId: "",
        customerName: "",
        fullName: "",
        phone: "",
        email: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
        country: "Bangladesh",
        isDefault: false,
        addressType: "home",
      })
    }
    setIsAddDialogOpen(true)
  }

  const handleSaveAddress = () => {
    if (editingAddress) {
      updateAddress(editingAddress.id, formData)
    } else {
      addAddress(formData)
    }
    setIsAddDialogOpen(false)
    setEditingAddress(null)
  }

  const handleDeleteClick = (id: string) => {
    setDeletingId(id)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (deletingId) {
      deleteAddress(deletingId)
    }
    setIsDeleteDialogOpen(false)
    setDeletingId(null)
  }

  const handleBulkDelete = () => {
    selectedAddressIds.forEach((id) => deleteAddress(id))
    setSelectedAddressIds([])
  }

  const handleSetDefault = (id: string, customerId?: string) => {
    setAsDefault(id, customerId)
  }

  const getAddressTypeIcon = (type: string) => {
    switch (type) {
      case "home":
        return <Home className="h-4 w-4" />
      case "office":
        return <Briefcase className="h-4 w-4" />
      default:
        return <MapPin className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Shipping Addresses</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage customer shipping addresses for order fulfillment
          </p>
        </div>
        <Button onClick={() => handleAddEditOpen()} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Address
        </Button>
      </div>

      {/* Filters and Actions */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by name, address, city, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Address Type Filter */}
          <Select value={addressTypeFilter} onValueChange={setAddressTypeFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Address Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="home">Home</SelectItem>
              <SelectItem value="office">Office</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          {/* Bulk Delete */}
          {selectedAddressIds.length > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete ({selectedAddressIds.length})
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-12 py-3 px-4">
                  <Checkbox
                    checked={selectedAddressIds.length === currentItems.length && currentItems.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Customer / Full Name
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Address
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Phone
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Type
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Status
                </th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-4" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-48" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-6 w-16" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-6 w-16" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-8 w-20" />
                      </td>
                    </tr>
                  ))
                : currentItems.map((address) => (
                    <tr
                      key={address.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4">
                        <Checkbox
                          checked={selectedAddressIds.includes(address.id)}
                          onCheckedChange={() => handleSelectAddress(address.id)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium">{address.fullName}</div>
                          {address.customerName && (
                            <div className="text-xs text-gray-500">{address.customerName}</div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">
                          <div>{address.addressLine1}</div>
                          {address.addressLine2 && (
                            <div className="text-gray-500">{address.addressLine2}</div>
                          )}
                          <div className="text-gray-500 text-xs mt-1">
                            {address.city}, {address.state} {address.postalCode}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm">{address.phone}</div>
                        {address.email && (
                          <div className="text-xs text-gray-500">{address.email}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {getAddressTypeIcon(address.addressType)}
                          <span className="capitalize">{address.addressType}</span>
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {address.isDefault ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 w-fit">
                            <Star className="h-3 w-3 fill-current" />
                            Default
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Standard</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddEditOpen(address)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!address.isDefault && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleSetDefault(address.id, address.customerId)
                                  }
                                >
                                  <Star className="mr-2 h-4 w-4" />
                                  Set as Default
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteClick(address.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {!isLoading && filteredAddresses.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No addresses found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchQuery || addressTypeFilter !== "all"
                  ? "Try adjusting your search or filter"
                  : "Get started by adding a new shipping address"}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredAddresses.length > 0 && (
          <div className="border-t px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Rows per page:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => handleItemsPerPageChange(Number(value))}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? "Edit Shipping Address" : "Add Shipping Address"}
            </DialogTitle>
            <DialogDescription>
              {editingAddress
                ? "Update the address details below"
                : "Enter the address details below"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+8801712345678"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="addressLine1">Address Line 1 *</Label>
              <Input
                id="addressLine1"
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                placeholder="123 Main Street"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                value={formData.addressLine2}
                onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                placeholder="Apartment, suite, etc. (optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Dhaka"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State/Division *</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="Dhaka Division"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal Code *</Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                placeholder="1205"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="addressType">Address Type</Label>
              <Select
                value={formData.addressType}
                onValueChange={(value: "home" | "office" | "other") =>
                  setFormData({ ...formData, addressType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isDefault: checked as boolean })
                  }
                />
                <Label htmlFor="isDefault" className="cursor-pointer">
                  Set as default address
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAddress}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={
                !formData.fullName ||
                !formData.phone ||
                !formData.addressLine1 ||
                !formData.city ||
                !formData.state ||
                !formData.postalCode
              }
            >
              {editingAddress ? "Update" : "Add"} Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Address</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this shipping address? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
