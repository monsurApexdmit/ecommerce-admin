"use client"

import type React from "react"

import { useState } from "react"
import { Search, Filter, Eye, Edit, Trash2, Plus, ChevronDown } from "lucide-react"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { useStaff, type Staff } from "@/contexts/staff-context"

export default function StaffPage() {
  const { staff, roles, addStaff, updateStaff, deleteStaff } = useStaff()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRole, setSelectedRole] = useState("All Roles")
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState<Staff | null>(null)

  const filteredStaff = staff.filter((member) => {
    const matchesSearch =
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.contact.includes(searchQuery)
    const matchesRole = selectedRole === "All Roles" || member.role === selectedRole
    return matchesSearch && matchesRole
  })

  const {
    currentItems: currentStaff,
    currentPage,
    totalPages,
    itemsPerPage,
    goToPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredStaff, 10)

  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  const handleTogglePublished = (id: string) => {
    const member = staff.find((s) => s.id === id)
    if (member) {
      updateStaff({ ...member, published: !member.published })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this staff member?")) {
      deleteStaff(id)
    }
  }

  const handleView = (member: Staff) => {
    setSelectedStaff(member)
    setIsViewDialogOpen(true)
  }

  const handleEdit = (member: Staff) => {
    setEditFormData(member)
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (editFormData) {
      updateStaff(editFormData)
      setIsEditDialogOpen(false)
      setEditFormData(null)
    }
  }

  const handleAddStaff = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    // Safety check for role, though required should handle it
    const roleIdOrName = formData.get("role") as string

    const newStaff: Staff = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      contact: formData.get("contact") as string,
      joiningDate: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      role: roleIdOrName,
      status: "Active",
      published: true,
      avatar: "/placeholder.svg?height=40&width=40",
      salary: parseFloat(formData.get("salary") as string) || 0,
      bankAccount: formData.get("bankAccount") as string,
      paymentMethod: (formData.get("paymentMethod") as "Bank Transfer" | "Cash" | "Check") || "Bank Transfer",
    }

    addStaff(newStaff)
    setIsAddDialogOpen(false)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">All Staff</h1>
        <Button onClick={() => setIsAddDialogOpen(true)} className="bg-emerald-500 hover:bg-emerald-600">
          <Plus className="w-4 h-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border mb-6">
        <div className="p-4 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search by name/email/phone"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleFilterChange()
              }}
              className="pl-10"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50 flex items-center gap-2 min-w-[180px] justify-between"
            >
              <span className="text-sm text-gray-700">{selectedRole}</span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showRoleDropdown && (
              <div className="absolute top-full mt-1 w-full bg-white border rounded-lg shadow-lg z-10">
                <button
                  onClick={() => {
                    setSelectedRole("All Roles")
                    setShowRoleDropdown(false)
                    handleFilterChange()
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg"
                >
                  All Roles
                </button>
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => {
                      setSelectedRole(role.name)
                      setShowRoleDropdown(false)
                      handleFilterChange()
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 last:rounded-b-lg"
                  >
                    {role.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button className="bg-emerald-500 hover:bg-emerald-600">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("")
              setSelectedRole("All Roles")
              handleFilterChange()
            }}
          >
            Reset
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-y">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Contact</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Joining Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Salary</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Published</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {currentStaff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Image
                        src={member.avatar || "/placeholder.svg"}
                        alt={member.name}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                      <span className="font-medium text-gray-900">{member.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-blue-600">{member.email}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{member.contact}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{member.joiningDate}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-gray-900">{member.role}</span>
                  </td>
                  <td className="py-3 px-4 text-sm font-semibold text-emerald-600">
                    ${member.salary.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      {member.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleTogglePublished(member.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${member.published ? "bg-emerald-500" : "bg-gray-200"
                        }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${member.published ? "translate-x-6" : "translate-x-1"
                          }`}
                      />
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleView(member)} className="p-1 hover:bg-gray-100 rounded">
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button onClick={() => handleEdit(member)} className="p-1 hover:bg-gray-100 rounded">
                        <Edit className="w-4 h-4 text-gray-600" />
                      </button>
                      <button onClick={() => handleDelete(member.id)} className="p-1 hover:bg-gray-100 rounded">
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

      <PaginationControl
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={filteredStaff.length}
      />

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Staff Details</DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Image
                  src={selectedStaff.avatar || "/placeholder.svg"}
                  alt={selectedStaff.name}
                  width={80}
                  height={80}
                  className="rounded-full"
                />
                <div>
                  <h3 className="text-xl font-bold">{selectedStaff.name}</h3>
                  <p className="text-gray-600">{selectedStaff.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{selectedStaff.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contact</p>
                  <p className="font-medium">{selectedStaff.contact}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Joining Date</p>
                  <p className="font-medium">{selectedStaff.joiningDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                    {selectedStaff.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          {editFormData && (
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>
              <div>
                <Label>Contact</Label>
                <Input
                  value={editFormData.contact}
                  onChange={(e) => setEditFormData({ ...editFormData, contact: e.target.value })}
                />
              </div>
              <div>
                <Label>Role</Label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.name}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Monthly Salary</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editFormData.salary}
                  onChange={(e) => setEditFormData({ ...editFormData, salary: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Bank Account</Label>
                <Input
                  value={editFormData.bankAccount || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, bankAccount: e.target.value })}
                />
              </div>
              <div>
                <Label>Payment Method</Label>
                <select
                  value={editFormData.paymentMethod || "Bank Transfer"}
                  onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} className="bg-emerald-500 hover:bg-emerald-600">
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Staff Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input name="name" required />
            </div>
            <div>
              <Label>Email</Label>
              <Input name="email" type="email" required />
            </div>
            <div>
              <Label>Contact</Label>
              <Input name="contact" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Monthly Salary</Label>
                <Input name="salary" type="number" step="0.01" required placeholder="0.00" />
              </div>
              <div>
                <Label>Payment Method</Label>
                <select name="paymentMethod" className="w-full px-3 py-2 border rounded-lg">
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Bank Account (Optional)</Label>
              <Input name="bankAccount" placeholder="Account number" />
            </div>
            <div>
              <Label>Role</Label>
              <select name="role" required className="w-full px-3 py-2 border rounded-lg">
                {roles.map(role => (
                  <option key={role.id} value={role.name}>{role.name}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600">
                Add Staff
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
