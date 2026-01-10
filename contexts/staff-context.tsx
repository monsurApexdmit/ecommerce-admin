"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

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
    | "Online Store"
    | "Pages"

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
    addStaff: (member: Staff) => void
    updateStaff: (member: Staff) => void
    deleteStaff: (id: string) => void
    addRole: (role: Role) => void
    updateRole: (role: Role) => void
    deleteRole: (id: string) => void
    getRoleByName: (name: string) => Role | undefined
    addSalaryPayment: (payment: SalaryPayment) => void
    updateSalaryPayment: (payment: SalaryPayment) => void
    getSalaryPaymentsByStaff: (staffId: string) => SalaryPayment[]
    getSalaryPaymentsByMonth: (month: string) => SalaryPayment[]
}

const StaffContext = createContext<StaffContextType | undefined>(undefined)

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
        salary: 5000,
        bankAccount: "1234567890",
        paymentMethod: "Bank Transfer",
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
        salary: 3500,
        bankAccount: "0987654321",
        paymentMethod: "Bank Transfer",
    },
    {
        id: "3",
        name: "Stacey J. Meikle",
        email: "stacey@gmail.com",
        contact: "616-738-0407",
        joiningDate: "31 Dec, 2025",
        role: "CEO",
        status: "Active",
        published: true,
        avatar: "/stacey-avatar.jpg",
        salary: 8000,
        bankAccount: "1122334455",
        paymentMethod: "Bank Transfer",
    },
]

const initialRoles: Role[] = [
    {
        id: "1",
        name: "Super Admin",
        permissions: [], // Super admin usually implies all, but we'll leave empty to signify 'all' or fill logically later
    },
    {
        id: "2",
        name: "Admin",
        permissions: [],
    },
    {
        id: "3",
        name: "CEO",
        permissions: [],
    },
    {
        id: "4",
        name: "Manager",
        permissions: [],
    },
    {
        id: "5",
        name: "Accountant",
        permissions: [],
    },
    {
        id: "6",
        name: "Cashier",
        permissions: [],
    },
    {
        id: "7",
        name: "Security Guard",
        permissions: [],
    }
]

export function StaffProvider({ children }: { children: React.ReactNode }) {
    const [staff, setStaff] = useState<Staff[]>(initialStaff)
    const [roles, setRoles] = useState<Role[]>(initialRoles)
    const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([])

    const addStaff = (member: Staff) => {
        setStaff((prev) => [...prev, member])
    }

    const updateStaff = (member: Staff) => {
        setStaff((prev) => prev.map((s) => (s.id === member.id ? member : s)))
    }

    const deleteStaff = (id: string) => {
        setStaff((prev) => prev.filter((s) => s.id !== id))
    }

    const addRole = (role: Role) => {
        setRoles((prev) => [...prev, role])
    }

    const updateRole = (role: Role) => {
        setRoles((prev) => prev.map((r) => (r.id === role.id ? role : r)))
    }

    const deleteRole = (id: string) => {
        setRoles((prev) => prev.filter((r) => r.id !== id))
    }

    const getRoleByName = (name: string) => {
        return roles.find(r => r.name === name)
    }

    const addSalaryPayment = (payment: SalaryPayment) => {
        setSalaryPayments((prev) => [...prev, payment])
    }

    const updateSalaryPayment = (payment: SalaryPayment) => {
        setSalaryPayments((prev) => prev.map((p) => (p.id === payment.id ? payment : p)))
    }

    const getSalaryPaymentsByStaff = (staffId: string) => {
        return salaryPayments.filter(p => p.staffId === staffId)
    }

    const getSalaryPaymentsByMonth = (month: string) => {
        return salaryPayments.filter(p => p.month === month)
    }

    return (
        <StaffContext.Provider
            value={{
                staff,
                roles,
                salaryPayments,
                addStaff,
                updateStaff,
                deleteStaff,
                addRole,
                updateRole,
                deleteRole,
                getRoleByName,
                addSalaryPayment,
                updateSalaryPayment,
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
