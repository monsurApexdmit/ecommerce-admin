"use client"

import type React from "react"

import { useState } from "react"
import { Search, Filter, Eye, Edit, Trash2, Plus, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import Image from "next/image"

interface Staff {
  id: string
  name: string
  email: string
  contact: string
  joiningDate: string
  role: string
  status: "Active" | "Inactive"
  published: boolean
  avatar: string
}

const initialStaff: Staff[] = [
  {
    id: "1",
    name: "admin",
    email: "admin@gmail.com",
    contact: "360-943-7332",
    joiningDate: "31 Dec, 2025",
    role: "Super Admin",
    status: "Active",
    published: true,
    avatar: "/admin-avatar.jpg",
  },
  {
    id: "2",
    name: "Marion V. Parker",
    email: "marion@gmail.com",
    contact: "713-675-8813",
    joiningDate: "31 Dec, 2025",
    role: "Admin",
    status: "Active",
    published: true,
    avatar: "/marion-avatar.jpg",
  },
  {
    id: "3",
    name: "Stacey J. Meikle",
    email: "stacey@gmail.com",
    contact: "616-738-0407",
    joiningDate: "31 Dec, 2025",
    role: "Ceo",
    status: "Active",
    published: true,
    avatar: "/stacey-avatar.jpg",
  },
  {
    id: "4",
    name: "Shawn E. Palmer",
    email: "shawn@gmail.com",
    contact: "949-202-2913",
    joiningDate: "31 Dec, 2025",
    role: "Manager",
    status: "Active",
    published: true,
    avatar: "/shawn-avatar.jpg",
  },
  {
    id: "5",
    name: "Corrie H. Cates",
    email: "corrie@gmail.com",
    contact: "914-623-6873",
    joiningDate: "31 Dec, 2025",
    role: "Accountant",
    status: "Active",
    published: true,
    avatar: "/corrie-avatar.jpg",
  },
  {
    id: "6",
    name: "Alice B. Porter",
    email: "alice@gmail.com",
    contact: "708-488-9728",
    joiningDate: "31 Dec, 2025",
    role: "Cashier",
    status: "Active",
    published: true,
    avatar: "/alice-avatar.jpg",
  },
  {
    id: "7",
    name: "Dorothy R. Brown",
    email: "dorothy@gmail.com",
    contact: "708-628-3122",
    joiningDate: "31 Dec, 2025",
    role: "Security Guard",
    status: "Active",
    published: true,
    avatar: "/dorothy-avatar.jpg",
  },
]

const staffRoles = ["All Roles", "Super Admin", "Admin", "CEO", "Manager", "Accountant", "Cashier", "Security Guard"]

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>(initialStaff)
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

  const handleTogglePublished = (id: string) => {
    setStaff(staff.map((member) => (member.id === id ? { ...member, published: !member.published } : member)))
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this staff member?")) {
      setStaff(staff.filter((member) => member.id !== id))
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
      setStaff(staff.map((member) => (member.id === editFormData.id ? editFormData : member)))
      setIsEditDialogOpen(false)
      setEditFormData(null)
    }
  }

  const handleAddStaff = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const newStaff: Staff = {
      id: Date.now().toString(),
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      contact: formData.get("contact") as string,
      joiningDate: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      role: formData.get("role") as string,
      status: "Active",
      published: true,
      avatar: "/placeholder.svg?height=40&width=40",
    }
    setStaff([...staff, newStaff])
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
                {staffRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setSelectedRole(role)
                      setShowRoleDropdown(false)
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {role}
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
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Name</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Email</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Contact</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Joining Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Role</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Published</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredStaff.map((member) => (
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
                  <td className="py-3 px-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                      {member.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleTogglePublished(member.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        member.published ? "bg-emerald-500" : "bg-gray-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          member.published ? "translate-x-6" : "translate-x-1"
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
                  <option>Super Admin</option>
                  <option>Admin</option>
                  <option>CEO</option>
                  <option>Manager</option>
                  <option>Accountant</option>
                  <option>Cashier</option>
                  <option>Security Guard</option>
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
            <div>
              <Label>Role</Label>
              <select name="role" required className="w-full px-3 py-2 border rounded-lg">
                <option>Super Admin</option>
                <option>Admin</option>
                <option>CEO</option>
                <option>Manager</option>
                <option>Accountant</option>
                <option>Cashier</option>
                <option>Security Guard</option>
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
