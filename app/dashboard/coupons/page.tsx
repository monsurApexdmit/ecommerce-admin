"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Search, Download, Edit2, Trash2, FilePen, ImagePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { exportToCSV } from "@/lib/export-import-utils"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { couponApi, type CouponResponse } from "@/lib/couponApi"

type FormData = {
  campaign_name: string
  code: string
  discount: string
  type: "percentage" | "fixed" | "free_shipping"
  start_date: string
  end_date: string
  status: boolean
  image: File | null
}

const emptyForm: FormData = {
  campaign_name: "",
  code: "",
  discount: "",
  type: "percentage",
  start_date: "",
  end_date: "",
  status: true,
  image: null,
}

function isExpired(endDate: string): boolean {
  if (!endDate) return false
  return new Date(endDate) < new Date()
}

function formatDiscount(coupon: CouponResponse): string {
  const val = coupon.discount ?? 0
  return coupon.type === "percentage" ? `${val}%` : `$${val}`
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ""
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return dateStr
  }
}

function toInputDate(dateStr: string): string {
  if (!dateStr) return ""
  try {
    return new Date(dateStr).toISOString().split("T")[0]
  } catch {
    return ""
  }
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<CouponResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCoupons, setSelectedCoupons] = useState<string[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState("")
  const [currentCoupon, setCurrentCoupon] = useState<CouponResponse | null>(null)
  const [formData, setFormData] = useState<FormData>(emptyForm)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refreshCoupons = async () => {
    try {
      setIsLoading(true)
      const response = await couponApi.getAll({ limit: 100 })
      setCoupons(response.data ?? [])
    } catch (err) {
      console.error("Error fetching coupons:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshCoupons()
  }, [])

  const filteredCoupons = coupons.filter(
    (coupon) =>
      (coupon.campaignName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (coupon.code ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const {
    currentItems: currentCoupons,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredCoupons, 10)

  const handleFilterChange = () => setCurrentPage(1)

  const handleSelectAll = (checked: boolean) => {
    setSelectedCoupons(checked ? filteredCoupons.map((c) => c.id.toString()) : [])
  }

  const handleSelectCoupon = (id: string, checked: boolean) => {
    setSelectedCoupons(checked ? [...selectedCoupons, id] : selectedCoupons.filter((cid) => cid !== id))
  }

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this coupon?")) {
      try {
        await couponApi.delete(id)
        setSelectedCoupons(selectedCoupons.filter((cid) => cid !== id.toString()))
        await refreshCoupons()
      } catch (err: any) {
        console.error('Error deleting coupon:', err)
        alert(err.message || 'Failed to delete coupon')
      }
    }
  }

  const handleBulkDelete = async () => {
    if (selectedCoupons.length === 0) {
      alert("Please select coupons to delete")
      return
    }
    if (confirm(`Delete ${selectedCoupons.length} selected coupon(s)?`)) {
      try {
        await Promise.all(selectedCoupons.map((id) => couponApi.delete(parseInt(id))))
        setSelectedCoupons([])
        await refreshCoupons()
      } catch (err: any) {
        console.error('Error deleting coupons:', err)
        alert(err.message || 'Failed to delete coupons')
      }
    }
  }

  const handleToggleStatus = async (coupon: CouponResponse) => {
    await couponApi.update(coupon.id, { status: !coupon.status })
    await refreshCoupons()
  }

  const handleEdit = (coupon: CouponResponse) => {
    setCurrentCoupon(coupon)
    setFormData({
      campaign_name: coupon.campaignName ?? "",
      code: coupon.code ?? "",
      discount: (coupon.discount ?? "").toString(),
      type: coupon.type ?? "percentage",
      start_date: toInputDate(coupon.startDate),
      end_date: toInputDate(coupon.endDate),
      status: coupon.status ?? true,
      image: null,
    })
    // Show current image as preview (read-only in edit mode)
    setImagePreview(coupon.image ? `http://localhost:8005/storage/${coupon.image}` : null)
    setIsEditDialogOpen(true)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFormData((prev) => ({ ...prev, image: file }))
    setImagePreview(URL.createObjectURL(file))
  }

const handleAddCoupon = async () => {
    try {
      if (!formData.start_date || !formData.end_date) {
        alert('Start Date and End Date are required')
        return
      }

      const payload: any = {
        campaign_name: formData.campaign_name,
        code: formData.code.toUpperCase(),
        type: formData.type,
        discount: parseFloat(formData.discount) || 0,
        status: formData.status,
        start_date: formData.start_date, // Y-m-d format from date input
        end_date: formData.end_date,
      }

      if (formData.image) {
        console.log('Creating coupon with image...')
        await couponApi.createWithImage({ ...payload, image: formData.image })
      } else {
        console.log('Creating coupon without image...')
        await couponApi.create(payload)
      }

      setIsAddDialogOpen(false)
      setFormData(emptyForm)
      setImagePreview(null)
      await refreshCoupons()
      alert('Coupon created successfully')
    } catch (err: any) {
      console.error('Error adding coupon:', err)
      alert(err.message || 'Failed to add coupon')
    }
  }

  const handleUpdateCoupon = async () => {
    if (!currentCoupon) return

    try {
      if (!formData.start_date || !formData.end_date) {
        alert('Start Date and End Date are required')
        return
      }

      const payload: any = {
        campaign_name: formData.campaign_name,
        code: formData.code.toUpperCase(),
        type: formData.type,
        discount: parseFloat(formData.discount) || 0,
        status: formData.status,
        start_date: formData.start_date, // Y-m-d format from date input
        end_date: formData.end_date,
      }

      console.log('Updating coupon:', currentCoupon.id, payload)

      if (formData.image) {
        console.log('Updating with new image...')
        console.log('Payload being sent with image:', payload)
        // Only send fields that have values to FormData
        const imagePayload: any = { ...payload, image: formData.image }
        await couponApi.updateWithImage(currentCoupon.id, imagePayload)
      } else {
        console.log('Updating without image change...')
        await couponApi.update(currentCoupon.id, payload)
      }

      console.log('Coupon updated successfully')
      setIsEditDialogOpen(false)
      setCurrentCoupon(null)
      setImagePreview(null)
      await refreshCoupons()
      alert('Coupon updated successfully')
    } catch (err: any) {
      console.error('Error updating coupon:', err)
      alert(err.message || 'Failed to update coupon')
    }
  }

  const handleExport = () => {
    const exportData = filteredCoupons.map((coupon) => ({
      id: coupon.id,
      campaign_name: coupon.campaignName,
      code: coupon.code,
      discount: formatDiscount(coupon),
      status: coupon.status ? "Active" : "Inactive",
      start_date: formatDate(coupon.startDate),
      end_date: formatDate(coupon.endDate),
    }))
    const headers = ["ID", "Campaign Name", "Code", "Discount", "Status", "Start Date", "End Date"]
    exportToCSV(exportData, "coupons", headers)
  }

  const handleBulkActionSubmit = async () => {
    if (!bulkAction || selectedCoupons.length === 0) return

    try {
      if (bulkAction === "delete") {
        await handleBulkDelete()
      } else {
        const status = bulkAction === "activate"
        await Promise.all(selectedCoupons.map((id) => couponApi.update(parseInt(id), { status })))
        setSelectedCoupons([])
        await refreshCoupons()
      }

      setIsBulkActionDialogOpen(false)
      setBulkAction("")
    } catch (err: any) {
      console.error('Error in bulk action:', err)
      alert(err.message || 'Failed to perform bulk action')
    }
  }

  const renderCouponForm = () => (
    <div className="space-y-4">
      <div>
        <Label>Campaign Name</Label>
        <Input
          value={formData.campaign_name}
          onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
          placeholder="Enter campaign name"
        />
      </div>
      <div>
        <Label>Coupon Code</Label>
        <Input
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
          placeholder="SUMMER2026"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Discount Value</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.discount}
            onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
            placeholder="10"
          />
        </div>
        <div>
          <Label>Type</Label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value as "percentage" | "fixed" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date <span className="text-red-500">*</span></Label>
          <Input
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
          />
        </div>
        <div>
          <Label>End Date <span className="text-red-500">*</span></Label>
          <Input
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            required
          />
        </div>
      </div>
      <div>
        <Label>Image (optional)</Label>
        <div className="mt-1 flex items-center gap-3">
          {imagePreview && (
            <img src={imagePreview} alt="preview" className="w-16 h-16 rounded object-cover border" />
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <ImagePlus className="w-4 h-4" />
            {imagePreview ? "Change Image" : "Upload Image"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="form-status"
          checked={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
          className="rounded border-gray-300"
        />
        <Label htmlFor="form-status" className="cursor-pointer">
          Active
        </Label>
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Coupon</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-orange-100 text-orange-600 border-orange-200 hover:bg-orange-200"
            onClick={() => setIsBulkActionDialogOpen(true)}
            disabled={selectedCoupons.length === 0}
          >
            <FilePen className="w-4 h-4 mr-2" />
            Bulk Action
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-red-100 text-red-600 border-red-200 hover:bg-red-200"
            onClick={handleBulkDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600"
            onClick={() => {
              setFormData(emptyForm)
              setImagePreview(null)
              setIsAddDialogOpen(true)
            }}
          >
            + Add Coupon
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by coupon code/name"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  handleFilterChange()
                }}
                className="pl-10"
              />
            </div>
            <Button className="bg-emerald-500 hover:bg-emerald-600">Filter</Button>
            <Button variant="outline" onClick={() => {
              setSearchQuery("")
              handleFilterChange()
            }}>Reset</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedCoupons.length === filteredCoupons.length && filteredCoupons.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Campaign Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Discount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Active</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">End Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-4 rounded" /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Skeleton className="w-10 h-10 rounded" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-6 w-11 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-6 w-16 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-6 rounded" />
                          <Skeleton className="h-6 w-6 rounded" />
                        </div>
                      </td>
                    </tr>
                  ))
                : currentCoupons.map((coupon) => (
                    <tr key={coupon.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedCoupons.includes(coupon.id.toString())}
                          onChange={(e) => handleSelectCoupon(coupon.id.toString(), e.target.checked)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={coupon.image ? `http://localhost:8005/storage/${coupon.image}` : "/placeholder.svg"}
                            alt={coupon.campaignName}
                            className="w-10 h-10 rounded object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg" }}
                          />
                          <span className="font-medium text-gray-900">{coupon.campaignName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{coupon.code}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{formatDiscount(coupon)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(coupon)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${coupon.status ? "bg-emerald-500" : "bg-gray-200"}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${coupon.status ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {isExpired(coupon.endDate) ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Expired</span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Valid</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(coupon.startDate)}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(coupon.endDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEdit(coupon)} className="p-1 hover:bg-gray-100 rounded">
                            <Edit2 className="w-4 h-4 text-gray-600" />
                          </button>
                          <button onClick={() => handleDelete(coupon.id)} className="p-1 hover:bg-gray-100 rounded">
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
            totalItems={filteredCoupons.length}
          />
        </div>
      </div>

      {/* Add Coupon Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Coupon</DialogTitle>
          </DialogHeader>
          {renderCouponForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCoupon} className="bg-emerald-500 hover:bg-emerald-600">Add Coupon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Coupon Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Coupon</DialogTitle>
          </DialogHeader>
          {renderCouponForm()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateCoupon} className="bg-emerald-500 hover:bg-emerald-600">Update Coupon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={isBulkActionDialogOpen} onOpenChange={setIsBulkActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Actions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activate">Activate</SelectItem>
                  <SelectItem value="deactivate">Deactivate</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkActionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkActionSubmit} className="bg-emerald-600 hover:bg-emerald-700" disabled={!bulkAction}>
              Apply Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
