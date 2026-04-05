"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { staffApi, staffRoleApi, salaryPaymentApi, type StaffResponse, type SalaryPaymentResponse, type StaffRoleResponse } from "@/lib/staffApi"

export type Module =
    | "Dashboard"
    | "Products"
    | "Categories"
    | "Attributes"
    | "Coupons"
    | "Customers"
    | "Orders"
    | "POS"
    | "Sells"
    | "Staff"
    | "Settings"
    | "International"
    | "Store"
    | "Pages"
    | "Vendors"
    | "Inventory"
    | "Billing"
    | "Reports"

export type Action = "read" | "write" | "delete"

export interface Permission {
    name: Module
    read: boolean
    write: boolean
    delete: boolean
}

export interface Role {
    id: string
    name: string
    permissions: Permission[]
}

export interface Staff {
    id: string
    name: string
    email: string
    contact: string
    joiningDate: string
    role: string
    status: "Active" | "Inactive"
    published: boolean
    avatar: string
    salary: number
    bankAccount?: string
    paymentMethod?: "Bank Transfer" | "Cash" | "Check"
}

export interface SalaryPayment {
    id: string
    staffId: string
    month: string // Format: "Jan 2026"
    amount: number
    paidAmount: number
    status: "Paid" | "Pending" | "Partial"
    paymentDate?: string
    paymentMethod?: string
    notes?: string
}

interface StaffContextType {
    staff: Staff[]
    roles: Role[]
    salaryPayments: SalaryPayment[]
    isLoading: boolean
    rolesLoading: boolean
    error: string | null
    addStaff: (member: Omit<Staff, 'id'>) => Promise<void>
    updateStaff: (member: Staff) => Promise<void>
    deleteStaff: (id: string) => Promise<void>
    refreshStaff: () => Promise<void>
    addRole: (role: Omit<Role, 'id'>) => Promise<void>
    updateRole: (role: Role) => Promise<void>
    deleteRole: (id: string) => Promise<void>
    refreshRoles: () => Promise<void>
    getRoleByName: (name: string) => Role | undefined
    salaryPaymentsLoading: boolean
    addSalaryPayment: (payment: Omit<SalaryPayment, 'id'>) => Promise<void>
    updateSalaryPayment: (payment: SalaryPayment) => Promise<void>
    deleteSalaryPayment: (id: string) => Promise<void>
    refreshSalaryPayments: () => Promise<void>
    getSalaryPaymentsByStaff: (staffId: string) => SalaryPayment[]
    getSalaryPaymentsByMonth: (month: string) => SalaryPayment[]
}

const StaffContext = createContext<StaffContextType | undefined>(undefined)

function convertToStaff(s: StaffResponse): Staff {
    return {
        id: s.id.toString(),
        name: s.name,
        email: s.email,
        contact: s.contact || '',
        joiningDate: s.joiningDate
            ? new Date(s.joiningDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
            : '',
        role: s.role || '',
        status: s.status || 'Active',
        published: s.published ?? true,
        avatar: s.avatar || '/placeholder.svg',
        salary: s.salary || 0,
        bankAccount: s.bankAccount || '',
        paymentMethod: (s.paymentMethod as Staff['paymentMethod']) || 'Bank Transfer',
    }
}

function convertToRole(r: StaffRoleResponse): Role {
    // Map backend permission names to frontend Module names
    // Use 1:1 mapping now since we added new Module types
    const permissionToModule: Record<string, Module> = {
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

    return {
        id: r.id.toString(),
        name: r.name,
        permissions: (r.permissions || []).map(p => ({
            name: permissionToModule[p.name] || (p.name as Module),
            read: p.read,
            write: p.write,
            delete: p.delete,
        })),
    }
}

function convertToSalaryPayment(p: SalaryPaymentResponse): SalaryPayment {
    return {
        id: p.id.toString(),
        staffId: p.staffId.toString(),
        month: p.month,
        amount: p.amount,
        paidAmount: p.paidAmount,
        status: p.status,
        paymentDate: p.paymentDate,
        paymentMethod: p.paymentMethod,
        notes: p.notes,
    }
}

export function StaffProvider({ children }: { children: React.ReactNode }) {
    const [staff, setStaff] = useState<Staff[]>([])
    const [roles, setRoles] = useState<Role[]>([])
    const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [rolesLoading, setRolesLoading] = useState(true)
    const [salaryPaymentsLoading, setSalaryPaymentsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const refreshStaff = async () => {
        try {
            setIsLoading(true)
            setError(null)
            const response = await staffApi.getAll({ limit: 100 })
            setStaff(response.data.map(convertToStaff))
        } catch (err: any) {
            console.error('Error fetching staff:', err)
            setError(err.response?.data?.error || 'Failed to fetch staff')
        } finally {
            setIsLoading(false)
        }
    }

    const refreshRoles = async () => {
        try {
            setRolesLoading(true)
            const response = await staffRoleApi.getAll({ limit: 100 })
            setRoles(response.data.map(convertToRole))
        } catch (err: any) {
            console.error('Error fetching staff roles:', err)
        } finally {
            setRolesLoading(false)
        }
    }

    const refreshSalaryPayments = async () => {
        try {
            setSalaryPaymentsLoading(true)
            const response = await salaryPaymentApi.getAll({ limit: 1000 })
            setSalaryPayments(response.data.map(convertToSalaryPayment))
        } catch (err: any) {
            console.error('Error fetching salary payments:', err)
        } finally {
            setSalaryPaymentsLoading(false)
        }
    }

    useEffect(() => {
        refreshStaff()
        refreshRoles()
        refreshSalaryPayments()
    }, [])

    const addStaff = async (member: Omit<Staff, 'id'>) => {
        try {
            await staffApi.create({
                name: member.name,
                email: member.email,
                contact: member.contact,
                joiningDate: member.joiningDate,
                role: member.role,
                status: member.status,
                published: member.published,
                avatar: member.avatar,
                salary: member.salary,
                bankAccount: member.bankAccount,
                paymentMethod: member.paymentMethod,
            })
            await refreshStaff()
        } catch (err: any) {
            console.error('Error creating staff:', err)
            throw new Error(err.response?.data?.error || 'Failed to create staff')
        }
    }

    const updateStaff = async (member: Staff) => {
        try {
            await staffApi.update(parseInt(member.id), {
                name: member.name,
                email: member.email,
                contact: member.contact,
                joiningDate: member.joiningDate,
                role: member.role,
                status: member.status,
                published: member.published,
                avatar: member.avatar,
                salary: member.salary,
                bankAccount: member.bankAccount,
                paymentMethod: member.paymentMethod,
            })
            await refreshStaff()
        } catch (err: any) {
            console.error('Error updating staff:', err)
            throw new Error(err.response?.data?.error || 'Failed to update staff')
        }
    }

    const deleteStaff = async (id: string) => {
        try {
            await staffApi.delete(parseInt(id))
            await refreshStaff()
        } catch (err: any) {
            console.error('Error deleting staff:', err)
            throw new Error(err.response?.data?.error || 'Failed to delete staff')
        }
    }

    const addRole = async (role: Omit<Role, 'id'>) => {
        try {
            // Get all permissions from backend to map names to IDs
            const permissions = await staffRoleApi.getPermissions()

            // Ensure permissions is an array
            const permArray = Array.isArray(permissions) ? permissions : []

            // Create map of backend permission names to IDs
            const permissionMap = new Map(
                permArray.map((p: any) => [p.name, p.id])
            )

            // Map frontend module names to backend permission names
            const moduleToPermission: Record<string, string> = {
                'Dashboard': 'products',
                'Products': 'products',
                'Categories': 'categories',
                'Attributes': 'categories',
                'Coupons': 'products',
                'Customers': 'customers',
                'Orders': 'orders',
                'POS': 'orders',
                'Sells': 'orders',
                'Staff': 'staff',
                'Settings': 'settings',
                'International': 'settings',
                'Store': 'products',
                'Pages': 'products',
                'Vendors': 'vendors',
                'Inventory': 'inventory',
                'Billing': 'billing',
                'Reports': 'reports',
            }

            // Build permissions for ALL backend permissions
            const permissionsMap = new Map<number, any>()

            // First, initialize all backend permissions as false
            permArray.forEach((p: any) => {
                permissionsMap.set(p.id, {
                    permissionId: p.id,
                    read: false,
                    write: false,
                    delete: false,
                })
            })

            // Then, override with form permissions using merge logic
            role.permissions.forEach(p => {
                const backendName = moduleToPermission[p.name]
                const id = permissionMap.get(backendName)
                if (id && permissionsMap.has(id)) {
                    const existing = permissionsMap.get(id)!
                    permissionsMap.set(id, {
                        permissionId: id,
                        read: existing.read || p.read,
                        write: existing.write || p.write,
                        delete: existing.delete || p.delete,
                    })
                }
            })

            const permissionsWithIds = Array.from(permissionsMap.values())

            await staffRoleApi.create({
                name: role.name,
                permissions: permissionsWithIds,
            })
            await refreshRoles()
        } catch (err: any) {
            console.error('Error creating role:', err)
            throw new Error(err.response?.data?.error || 'Failed to create role')
        }
    }

    const updateRole = async (role: Role) => {
        try {
            // Get all permissions from backend to map names to IDs
            const permissions = await staffRoleApi.getPermissions()

            // Ensure permissions is an array
            const permArray = Array.isArray(permissions) ? permissions : []

            // Create map of backend permission names to IDs
            const permissionMap = new Map(
                permArray.map((p: any) => [p.name, p.id])
            )

            // Map frontend module names to backend permission names
            const moduleToPermission: Record<string, string> = {
                'Dashboard': 'products',
                'Products': 'products',
                'Categories': 'categories',
                'Attributes': 'categories',
                'Coupons': 'products',
                'Customers': 'customers',
                'Orders': 'orders',
                'POS': 'orders',
                'Sells': 'orders',
                'Staff': 'staff',
                'Settings': 'settings',
                'International': 'settings',
                'Store': 'products',
                'Pages': 'products',
                'Vendors': 'vendors',
                'Inventory': 'inventory',
                'Billing': 'billing',
                'Reports': 'reports',
            }

            // Build permissions for ALL backend permissions
            const permissionsMap = new Map<number, any>()

            // First, initialize all backend permissions as false
            permArray.forEach((p: any) => {
                permissionsMap.set(p.id, {
                    permissionId: p.id,
                    read: false,
                    write: false,
                    delete: false,
                })
            })

            // Then, override with form permissions using merge logic
            role.permissions.forEach(p => {
                const backendName = moduleToPermission[p.name]
                const id = permissionMap.get(backendName)
                if (id && permissionsMap.has(id)) {
                    const existing = permissionsMap.get(id)!
                    permissionsMap.set(id, {
                        permissionId: id,
                        read: existing.read || p.read,
                        write: existing.write || p.write,
                        delete: existing.delete || p.delete,
                    })
                }
            })

            const permissionsWithIds = Array.from(permissionsMap.values())

            await staffRoleApi.update(parseInt(role.id), {
                name: role.name,
                permissions: permissionsWithIds,
            })
            await refreshRoles()
        } catch (err: any) {
            console.error('Error updating role:', err)
            throw new Error(err.response?.data?.error || 'Failed to update role')
        }
    }

    const deleteRole = async (id: string) => {
        try {
            await staffRoleApi.delete(parseInt(id))
            await refreshRoles()
        } catch (err: any) {
            console.error('Error deleting role:', err)
            throw new Error(err.response?.data?.error || 'Failed to delete role')
        }
    }

    const getRoleByName = (name: string) => roles.find((r) => r.name === name)

    const addSalaryPayment = async (payment: Omit<SalaryPayment, 'id'>) => {
        try {
            await salaryPaymentApi.create({
                staffId: parseInt(payment.staffId),
                month: payment.month,
                amount: payment.amount,
                paidAmount: payment.paidAmount,
                status: payment.status,
                paymentDate: payment.paymentDate,
                paymentMethod: payment.paymentMethod,
                notes: payment.notes,
            })
            await refreshSalaryPayments()
        } catch (err: any) {
            console.error('Error creating salary payment:', err)
            throw new Error(err.response?.data?.error || 'Failed to create salary payment')
        }
    }

    const updateSalaryPayment = async (payment: SalaryPayment) => {
        try {
            await salaryPaymentApi.update(parseInt(payment.id), {
                staffId: parseInt(payment.staffId),
                month: payment.month,
                amount: payment.amount,
                paidAmount: payment.paidAmount,
                status: payment.status,
                paymentDate: payment.paymentDate,
                paymentMethod: payment.paymentMethod,
                notes: payment.notes,
            })
            await refreshSalaryPayments()
        } catch (err: any) {
            console.error('Error updating salary payment:', err)
            throw new Error(err.response?.data?.error || 'Failed to update salary payment')
        }
    }

    const deleteSalaryPayment = async (id: string) => {
        try {
            await salaryPaymentApi.delete(parseInt(id))
            await refreshSalaryPayments()
        } catch (err: any) {
            console.error('Error deleting salary payment:', err)
            throw new Error(err.response?.data?.error || 'Failed to delete salary payment')
        }
    }

    const getSalaryPaymentsByStaff = (staffId: string) => salaryPayments.filter((p) => p.staffId === staffId)
    const getSalaryPaymentsByMonth = (month: string) => salaryPayments.filter((p) => p.month === month)

    return (
        <StaffContext.Provider
            value={{
                staff,
                roles,
                salaryPayments,
                isLoading,
                rolesLoading,
                salaryPaymentsLoading,
                error,
                addStaff,
                updateStaff,
                deleteStaff,
                refreshStaff,
                addRole,
                updateRole,
                deleteRole,
                refreshRoles,
                getRoleByName,
                addSalaryPayment,
                updateSalaryPayment,
                deleteSalaryPayment,
                refreshSalaryPayments,
                getSalaryPaymentsByStaff,
                getSalaryPaymentsByMonth,
            }}
        >
            {children}
        </StaffContext.Provider>
    )
}

export function useStaff() {
    const context = useContext(StaffContext)
    if (context === undefined) {
        throw new Error("useStaff must be used within a StaffProvider")
    }
    return context
}
