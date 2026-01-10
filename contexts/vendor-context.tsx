"use client"

import React, { createContext, useContext, useState } from "react"

export interface Vendor {
    id: string
    name: string
    email: string
    phone: string
    address: string
    logo: string
    status: "Active" | "Inactive" | "Blocked"
    description?: string
    totalPaid: number // Amount paid to the vendor manually tracked
}

interface VendorContextType {
    vendors: Vendor[]
    addVendor: (vendor: Vendor) => void
    updateVendor: (vendor: Vendor) => void
    deleteVendor: (id: string) => void
    getVendorById: (id: string) => Vendor | undefined
}

const VendorContext = createContext<VendorContextType | undefined>(undefined)

const initialVendors: Vendor[] = [
    {
        id: "1",
        name: "Fresh Farms Ltd.",
        email: "contact@freshfarms.com",
        phone: "+1 234 567 890",
        address: "123 Farm Road, Countryside",
        logo: "/placeholder.svg?height=40&width=40",
        status: "Active",
        description: "Supplier of fresh organic vegetables and fruits.",
        totalPaid: 5000,
    },
    {
        id: "2",
        name: "Best Electronics",
        email: "sales@bestelectronics.com",
        phone: "+1 987 654 321",
        address: "45 Tech Park, Silicon Valley",
        logo: "/placeholder.svg?height=40&width=40",
        status: "Active",
        description: "Premium electronic goods supplier.",
        totalPaid: 12500,
    },
    {
        id: "3",
        name: "Global Imports",
        email: "info@globalimports.com",
        phone: "+1 555 123 4567",
        address: "789 Harbor View, Port City",
        logo: "/placeholder.svg?height=40&width=40",
        status: "Inactive",
        description: "Imported goods distributor.",
        totalPaid: 0,
    },
]

export function VendorProvider({ children }: { children: React.ReactNode }) {
    const [vendors, setVendors] = useState<Vendor[]>(initialVendors)

    const addVendor = (vendor: Vendor) => {
        setVendors((prev) => [...prev, vendor])
    }

    const updateVendor = (vendor: Vendor) => {
        setVendors((prev) => prev.map((v) => (v.id === vendor.id ? vendor : v)))
    }

    const deleteVendor = (id: string) => {
        setVendors((prev) => prev.filter((v) => v.id !== id))
    }

    const getVendorById = (id: string) => {
        return vendors.find((v) => v.id === id)
    }

    return (
        <VendorContext.Provider
            value={{
                vendors,
                addVendor,
                updateVendor,
                deleteVendor,
                getVendorById,
            }}
        >
            {children}
        </VendorContext.Provider>
    )
}

export function useVendor() {
    const context = useContext(VendorContext)
    if (context === undefined) {
        throw new Error("useVendor must be used within a VendorProvider")
    }
    return context
}
