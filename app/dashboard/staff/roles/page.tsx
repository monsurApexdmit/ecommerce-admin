"use client"

import type React from "react"
import { useState } from "react"
import { Plus, Edit, Trash2, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useStaff, type Role, type Module, type Permission } from "@/contexts/staff-context"

const modules: Module[] = [
    "Dashboard",
    "Products",
    "Categories",
    "Attributes",
    "Coupons",
    "Customers",
    "Orders",
    "POS",
    "Sells",
    "Staff",
    "Settings",
    "International",
    "Online Store",
    "Pages",
]

export default function RolesPage() {
    const { roles, addRole, updateRole, deleteRole } = useStaff()
    const [searchQuery, setSearchQuery] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingRole, setEditingRole] = useState<Role | null>(null)

    // Form State
    const [roleName, setRoleName] = useState("")
    const [permissions, setPermissions] = useState<Permission[]>([])

    const filteredRoles = roles.filter((role) =>
        role.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleOpenDialog = (role?: Role) => {
        if (role) {
            setEditingRole(role)
            setRoleName(role.name)
            // Ensure all modules are present in permissions, defaulting to false if missing
            const rolePermissions = modules.map(moduleName => {
                const existing = role.permissions.find(p => p.name === moduleName)
                return existing || { name: moduleName, read: false, write: false, delete: false }
            })
            setPermissions(rolePermissions)
        } else {
            setEditingRole(null)
            setRoleName("")
            setPermissions(modules.map(moduleName => ({
                name: moduleName,
                read: false,
                write: false,
                delete: false
            })))
        }
        setIsDialogOpen(true)
    }

    const handlePermissionChange = (moduleName: Module, type: "read" | "write" | "delete", checked: boolean) => {
        setPermissions(prev => prev.map(p => {
            if (p.name === moduleName) {
                return { ...p, [type]: checked }
            }
            return p
        }))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (editingRole) {
            updateRole({
                ...editingRole,
                name: roleName,
                permissions: permissions
            })
        } else {
            addRole({
                id: Date.now().toString(),
                name: roleName,
                permissions: permissions
            })
        }
        setIsDialogOpen(false)
    }

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this role?")) {
            deleteRole(id)
        }
    }

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Role & Permission</h1>
                <Button onClick={() => handleOpenDialog()} className="bg-emerald-500 hover:bg-emerald-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Role
                </Button>
            </div>

            {/* Search */}
            <div className="bg-white rounded-lg border mb-6 p-4">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        type="text"
                        placeholder="Search by role name"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Roles Table */}
            <div className="bg-white rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Role Name</th>
                                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredRoles.map((role) => (
                                <tr key={role.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 font-medium text-gray-900">{role.name}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleOpenDialog(role)} className="p-1 hover:bg-gray-100 rounded">
                                                <Edit className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <button onClick={() => handleDelete(role.id)} className="p-1 hover:bg-gray-100 rounded">
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredRoles.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="py-8 text-center text-gray-500">No roles found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Role Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRole ? "Edit Role" : "Add Role"}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <Label>Role Name</Label>
                            <Input
                                value={roleName}
                                onChange={(e) => setRoleName(e.target.value)}
                                required
                                placeholder="e.g. Sales Manager"
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <h3 className="font-semibold mb-3">Permissions</h3>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Module</th>
                                            <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">Read</th>
                                            <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">Write</th>
                                            <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {permissions.map((permission) => (
                                            <tr key={permission.name} className="hover:bg-gray-50">
                                                <td className="py-2 px-4 text-sm font-medium text-gray-900">{permission.name}</td>
                                                <td className="py-2 px-4 text-center">
                                                    <Checkbox
                                                        checked={permission.read}
                                                        onCheckedChange={(checked) => handlePermissionChange(permission.name, "read", checked as boolean)}
                                                    />
                                                </td>
                                                <td className="py-2 px-4 text-center">
                                                    <Checkbox
                                                        checked={permission.write}
                                                        onCheckedChange={(checked) => handlePermissionChange(permission.name, "write", checked as boolean)}
                                                    />
                                                </td>
                                                <td className="py-2 px-4 text-center">
                                                    <Checkbox
                                                        checked={permission.delete}
                                                        onCheckedChange={(checked) => handlePermissionChange(permission.name, "delete", checked as boolean)}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-emerald-500 hover:bg-emerald-600">
                                {editingRole ? "Update Role" : "Add Role"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
