"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { generateId } from "@/lib/export-import-utils"

export interface Warehouse {
    id: string
    name: string
    address: string
    contact: string
    isDefault: boolean
}

interface WarehouseContextType {
    warehouses: Warehouse[]
    addWarehouse: (warehouse: Omit<Warehouse, "id">) => void
    updateWarehouse: (warehouse: Warehouse) => void
    deleteWarehouse: (id: string) => void
    defaultWarehouse: Warehouse | undefined
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined)

// Initial dummy data
const initialWarehouses: Warehouse[] = [
    {
        id: "wh_main",
        name: "Main Warehouse",
        address: "123 Commerce St, Business City",
        contact: "John Doe",
        isDefault: true
    },
    {
        id: "wh_downtown",
        name: "Downtown Store",
        address: "456 Market Ave, Downtown",
        contact: "Jane Smith",
        isDefault: false
    }
]

export function WarehouseProvider({ children }: { children: React.ReactNode }) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>(initialWarehouses)

    const addWarehouse = (warehouseData: Omit<Warehouse, "id">) => {
        const newWarehouse = {
            ...warehouseData,
            id: generateId(),
        }
        
        // If it's the first one or marked default, handle default logic
        if (newWarehouse.isDefault) {
            setWarehouses(prev => prev.map(w => ({ ...w, isDefault: false })).concat(newWarehouse))
        } else {
            setWarehouses(prev => [...prev, newWarehouse])
        }
    }

    const updateWarehouse = (warehouse: Warehouse) => {
        setWarehouses(prev => {
            let updatedList = prev.map(w => (w.id === warehouse.id ? warehouse : w))
            
            // Ensure only one default
            if (warehouse.isDefault) {
                updatedList = updatedList.map(w => 
                    w.id === warehouse.id ? w : { ...w, isDefault: false }
                )
            }
            return updatedList
        })
    }

    const deleteWarehouse = (id: string) => {
        setWarehouses(prev => {
            const warehouseToDelete = prev.find(w => w.id === id)
            if (warehouseToDelete?.isDefault) {
                // Prevent deleting default or reassign default?
                // For now, allow but warn (simulated) or just prevent
                if (prev.length > 1) {
                     alert("Cannot delete the default warehouse. Please set another as default first.")
                     return prev
                }
            }
            return prev.filter(w => w.id !== id)
        })
    }

    const defaultWarehouse = warehouses.find(w => w.isDefault) || warehouses[0]

    return (
        <WarehouseContext.Provider
            value={{
                warehouses,
                addWarehouse,
                updateWarehouse,
                deleteWarehouse,
                defaultWarehouse,
            }}
        >
            {children}
        </WarehouseContext.Provider>
    )
}

export function useWarehouse() {
    const context = useContext(WarehouseContext)
    if (context === undefined) {
        throw new Error("useWarehouse must be used within a WarehouseProvider")
    }
    return context
}
