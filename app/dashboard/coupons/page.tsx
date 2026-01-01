"use client"

import type React from "react"

import { useState } from "react"
import { Search, Upload, Download, Edit2, Trash2, FilePen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { exportToCSV, parseCSV, generateId } from "@/lib/export-import-utils"

type Coupon = {
  id: string
  campaignName: string
  code: string
  discount: string
  published: boolean
  startDate: string
  endDate: string
  status: "Active" | "Expired"
  image: string
}

const initialCoupons: Coupon[] = [
  {
    id: "1",
    campaignName: "August Gift Voucher",
    code: "AUGUST24",
    discount: "50%",
    published: true,
    startDate: "1 Jan, 2026",
    endDate: "31 Oct, 2024",
    status: "Expired",
    image: "/gift-box-august.jpg",
  },
  {
    id: "2",
    campaignName: "Summer Gift Voucher",
    code: "SUMMER24",
    discount: "10%",
    published: true,
    startDate: "1 Jan, 2026",
    endDate: "20 Dec, 2024",
    status: "Expired",
    image: "/gift-box-summer.jpg",
  },
  {
    id: "3",
    campaignName: "Winter Gift Voucher",
    code: "WINTER25",
    discount: "$100",
    published: true,
    startDate: "1 Jan, 2026",
    endDate: "3 Jan, 2026",
    status: "Active",
    image: "/gift-box-winter.jpg",
  },
  {
    id: "4",
    campaignName: "Summer Gift Voucher",
    code: "SUMMER26",
    discount: "10%",
    published: true,
    startDate: "1 Jan, 2026",
    endDate: "19 Oct, 2026",
    status: "Active",
    image: "/gift-box-summer2.jpg",
  },
]

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>(initialCoupons)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCoupons, setSelectedCoupons] = useState<string[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState("")
  const [currentCoupon, setCurrentCoupon] = useState<Coupon | null>(null)
  const [formData, setFormData] = useState({
    campaignName: "",
    code: "",
    discount: "",
    discountType: "percentage",
    startDate: "",
    endDate: "",
    published: true,
  })

  const filteredCoupons = coupons.filter(
    (coupon) =>
      coupon.campaignName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      coupon.code.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCoupons(filteredCoupons.map((c) => c.id))
    } else {
      setSelectedCoupons([])
    }
  }

  const handleSelectCoupon = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedCoupons([...selectedCoupons, id])
    } else {
      setSelectedCoupons(selectedCoupons.filter((cid) => cid !== id))
    }
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this coupon?")) {
      setCoupons(coupons.filter((c) => c.id !== id))
      setSelectedCoupons(selectedCoupons.filter((cid) => cid !== id))
    }
  }

  const handleBulkDelete = () => {
    if (selectedCoupons.length === 0) {
      alert("Please select coupons to delete")
      return
    }
    if (confirm(`Delete ${selectedCoupons.length} selected coupon(s)?`)) {
      setCoupons(coupons.filter((c) => !selectedCoupons.includes(c.id)))
      setSelectedCoupons([])
    }
  }

  const handleTogglePublished = (id: string) => {
    setCoupons(coupons.map((c) => (c.id === id ? { ...c, published: !c.published } : c)))
  }

  const handleEdit = (coupon: Coupon) => {
    setCurrentCoupon(coupon)
    const discountValue = coupon.discount.replace(/[$%]/g, "")
    const discountType = coupon.discount.includes("%") ? "percentage" : "fixed"
    setFormData({
      campaignName: coupon.campaignName,
      code: coupon.code.toUpperCase(),
      discount: discountValue,
      discountType,
      startDate: coupon.startDate,
      endDate: coupon.endDate,
      published: coupon.published,
    })
    setIsEditDialogOpen(true)
  }

  const handleAddCoupon = () => {
    const discount = formData.discountType === "percentage" ? `${formData.discount}%` : `$${formData.discount}`

    const newCoupon: Coupon = {
      id: Date.now().toString(),
      campaignName: formData.campaignName,
      code: formData.code.toUpperCase(),
      discount,
      published: formData.published,
      startDate: formData.startDate,
      endDate: formData.endDate,
      status: "Active",
      image: "/gift-box-default.jpg",
    }

    setCoupons([...coupons, newCoupon])
    setIsAddDialogOpen(false)
    setFormData({
      campaignName: "",
      code: "",
      discount: "",
      discountType: "percentage",
      startDate: "",
      endDate: "",
      published: true,
    })
  }

  const handleUpdateCoupon = () => {
    if (!currentCoupon) return

    const discount = formData.discountType === "percentage" ? `${formData.discount}%` : `$${formData.discount}`

    setCoupons(
      coupons.map((c) =>
        c.id === currentCoupon.id
          ? {
              ...c,
              campaignName: formData.campaignName,
              code: formData.code.toUpperCase(),
              discount,
              published: formData.published,
              startDate: formData.startDate,
              endDate: formData.endDate,
            }
          : c,
      ),
    )
    setIsEditDialogOpen(false)
    setCurrentCoupon(null)
  }

  const handleExport = () => {
    const exportData = filteredCoupons.map((coupon) => ({
      id: coupon.id,
      campaign_name: coupon.campaignName,
      code: coupon.code,
      discount: coupon.discount,
      published: coupon.published ? "Yes" : "No",
      start_date: coupon.startDate,
      end_date: coupon.endDate,
      status: coupon.status,
    }))

    const headers = ["ID", "Campaign Name", "Code", "Discount", "Published", "Start Date", "End Date", "Status"]
    exportToCSV(exportData, "coupons", headers)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const importedData = parseCSV(text)

      const newCoupons = importedData.map((item) => ({
        id: item.id || generateId(),
        campaignName: item.campaign_name,
        code: item.code,
        discount: item.discount,
        published: item.published === "Yes",
        startDate: item.start_date,
        endDate: item.end_date,
        status: item.status || "Active",
        image: "/gift-box-default.jpg",
      }))

      setCoupons([...coupons, ...newCoupons])
      setIsImportDialogOpen(false)
    }
    reader.readAsText(file)
  }

  const handleBulkActionSubmit = () => {
    if (!bulkAction || selectedCoupons.length === 0) return

    if (bulkAction === "delete") {
      handleBulkDelete()
    } else if (bulkAction === "publish") {
      setCoupons(coupons.map((c) => (selectedCoupons.includes(c.id) ? { ...c, published: true } : c)))
      setSelectedCoupons([])
    } else if (bulkAction === "unpublish") {
      setCoupons(coupons.map((c) => (selectedCoupons.includes(c.id) ? { ...c, published: false } : c)))
      setSelectedCoupons([])
    }

    setIsBulkActionDialogOpen(false)
    setBulkAction("")
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Coupon</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import
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
          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setIsAddDialogOpen(true)}>
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
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button className="bg-emerald-500 hover:bg-emerald-600">Filter</Button>
            <Button variant="outline">Reset</Button>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Campaign Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Discount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Published</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Start Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">End Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredCoupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedCoupons.includes(coupon.id)}
                      onChange={(e) => handleSelectCoupon(coupon.id, e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={coupon.image || "/placeholder.svg"}
                        alt={coupon.campaignName}
                        className="w-10 h-10 rounded object-cover"
                      />
                      <span className="font-medium text-gray-900">{coupon.campaignName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{coupon.code}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{coupon.discount}</td>
                  <td className="px-4 py-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={coupon.published}
                        onChange={() => handleTogglePublished(coupon.id)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{coupon.startDate}</td>
                  <td className="px-4 py-3 text-gray-700">{coupon.endDate}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${
                        coupon.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      }`}
                    >
                      {coupon.status}
                    </span>
                  </td>
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
      </div>

      {/* Add Coupon Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Coupon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="campaignName">Campaign Name</Label>
              <Input
                id="campaignName"
                value={formData.campaignName}
                onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
                placeholder="Enter campaign name"
              />
            </div>
            <div>
              <Label htmlFor="code">Coupon Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="SUMMER2024"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="discount">Discount</Label>
                <Input
                  id="discount"
                  type="number"
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                  placeholder="10"
                />
              </div>
              <div>
                <Label htmlFor="discountType">Type</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value) => setFormData({ ...formData, discountType: value })}
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
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  placeholder="1 Jan, 2026"
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  placeholder="31 Dec, 2026"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="published"
                checked={formData.published}
                onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="published" className="cursor-pointer">
                Published
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCoupon} className="bg-emerald-500 hover:bg-emerald-600">
              Add Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Coupon Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Coupon</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-campaignName">Campaign Name</Label>
              <Input
                id="edit-campaignName"
                value={formData.campaignName}
                onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
                placeholder="Enter campaign name"
              />
            </div>
            <div>
              <Label htmlFor="edit-code">Coupon Code</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="SUMMER2024"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-discount">Discount</Label>
                <Input
                  id="edit-discount"
                  type="number"
                  value={formData.discount}
                  onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                  placeholder="10"
                />
              </div>
              <div>
                <Label htmlFor="edit-discountType">Type</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value) => setFormData({ ...formData, discountType: value })}
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
                <Label htmlFor="edit-startDate">Start Date</Label>
                <Input
                  id="edit-startDate"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  placeholder="1 Jan, 2026"
                />
              </div>
              <div>
                <Label htmlFor="edit-endDate">End Date</Label>
                <Input
                  id="edit-endDate"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  placeholder="31 Dec, 2026"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-published"
                checked={formData.published}
                onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="edit-published" className="cursor-pointer">
                Published
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateCoupon} className="bg-emerald-500 hover:bg-emerald-600">
              Update Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Coupons</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>CSV File</Label>
              <Input type="file" accept=".csv" onChange={handleImport} />
              <p className="text-sm text-gray-500">
                Upload a CSV file with columns: Campaign Name, Code, Discount, Published, Start Date, End Date, Status
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
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
                  <SelectItem value="publish">Publish</SelectItem>
                  <SelectItem value="unpublish">Unpublish</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkActionSubmit}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!bulkAction}
            >
              Apply Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
