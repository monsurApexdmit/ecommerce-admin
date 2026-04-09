"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Plus, Edit, Trash2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { useStaff, type Role, type Module, type Permission } from "@/contexts/staff-context"
import { staffRoleApi } from "@/lib/staffApi"

interface BackendPermission {
    id: number
    name: string
}

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
    "Store",
    "Pages",
]

export default function RolesPage() {
    const { roles, rolesLoading, addRole, updateRole, deleteRole } = useStaff()
    const [searchQuery, setSearchQuery] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingRole, setEditingRole] = useState<Role | null>(null)

    // Form State
    const [roleName, setRoleName] = useState("")
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [backendPermissions, setBackendPermissions] = useState<BackendPermission[]>([])
    const [loadingPermissions, setLoadingPermissions] = useState(false)

    // Load backend permissions when component mounts
    useEffect(() => {
        const loadPermissions = async () => {
            try {
                setLoadingPermissions(true)
                const perms = await staffRoleApi.getPermissions()
                setBackendPermissions(perms || [])
            } catch (err) {
                console.error('Failed to load permissions:', err)
            } finally {
                setLoadingPermissions(false)
            }
        }
        loadPermissions()
    }, [])

    const filteredRoles = roles.filter((role) =>
        role.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleOpenDialog = (role?: Role) => {
        if (role) {
            setEditingRole(role)
            setRoleName(role.name)

            // Map backend names to Module names
            const backendToModule: Record<string, Module> = {
                'products': 'Products',
                'categories': 'Categories',
                'customers': 'Customers',
                'orders': 'Orders',
                'staff': 'Staff',
                'settings': 'Settings',
                'vendors': 'Vendors',
                'inventory': 'Inventory',
                'billing': 'Billing',
                'reports': 'Reports',
            }

            // Create a permission map from the role (using Module names as keys, since that's what role.permissions contains)
            const permissionMap = new Map(role.permissions.map(p => [p.name, p]))

            // Build permission list directly from backend permissions
            const rolePermissions: Permission[] = backendPermissions.map(backendPerm => {
                const moduleName = (backendToModule[backendPerm.name] || backendPerm.name) as Module
                // Look up the permission by Module name, not backend name
                const existing = permissionMap.get(moduleName)
                return {
                    name: moduleName,
                    read: existing?.read || false,
                    write: existing?.write || false,
                    delete: existing?.delete || false,
                }
            })
            setPermissions(rolePermissions)
        } else {
            setEditingRole(null)
            setRoleName("")
            // Initialize with all backend permissions as unchecked
            const backendToModule: Record<string, string> = {
                'products': 'Products',
                'categories': 'Categories',
                'customers': 'Customers',
                'orders': 'Orders',
                'staff': 'Staff',
                'settings': 'Settings',
                'vendors': 'Vendors',
                'inventory': 'Inventory',
                'billing': 'Billing',
                'reports': 'Reports',
            }
            const rolePermissions: Permission[] = backendPermissions.map(backendPerm => ({
                name: (backendToModule[backendPerm.name] || backendPerm.name) as Module,
                read: false,
                write: false,
                delete: false,
            }))
            setPermissions(rolePermissions)
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

    const handleSelectAll = (type: "read" | "write" | "delete") => {
        const allChecked = permissions.every(p => p[type])
        setPermissions(prev => prev.map(p => ({ ...p, [type]: !allChecked })))
    }

    const handleSelectAllForModule = (moduleName: Module) => {
        const module = permissions.find(p => p.name === moduleName)
        if (module) {
            const allChecked = module.read && module.write && module.delete
            setPermissions(prev => prev.map(p => {
                if (p.name === moduleName) {
                    return { ...p, read: !allChecked, write: !allChecked, delete: !allChecked }
                }
                return p
            }))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (editingRole) {
            await updateRole({
                ...editingRole,
                name: roleName,
                permissions,
            })
        } else {
            await addRole({
                name: roleName,
                permissions,
            })
        }
        setIsDialogOpen(false)
    }

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this role?")) {
            await deleteRole(id)
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
                            {rolesLoading
                                ? Array.from({ length: 3 }).map((_, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="py-3 px-4">
                                            <Skeleton className="h-4 w-32" />
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-6 w-6 rounded" />
                                                <Skeleton className="h-6 w-6 rounded" />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                                : filteredRoles.map((role) => (
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
                            {!rolesLoading && filteredRoles.length === 0 && (
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
                            {loadingPermissions ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="text-left py-2 px-4 text-sm font-medium text-gray-700">Module</th>
                                                <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectAll("read")}
                                                        className="px-2 py-1 rounded text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold"
                                                    >
                                                        Read
                                                    </button>
                                                </th>
                                                <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectAll("write")}
                                                        className="px-2 py-1 rounded text-xs bg-green-100 hover:bg-green-200 text-green-700 font-semibold"
                                                    >
                                                        Write
                                                    </button>
                                                </th>
                                                <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectAll("delete")}
                                                        className="px-2 py-1 rounded text-xs bg-red-100 hover:bg-red-200 text-red-700 font-semibold"
                                                    >
                                                        Delete
                                                    </button>
                                                </th>
                                                <th className="text-center py-2 px-4 text-sm font-medium text-gray-700">All</th>
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
                                                    <td className="py-2 px-4 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSelectAllForModule(permission.name)}
                                                            className="px-2 py-1 rounded text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold"
                                                        >
                                                            All
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
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
