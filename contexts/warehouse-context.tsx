"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { locationApi, type LocationResponse } from "@/lib/locationApi"

export interface Warehouse {
  id: number
  name: string
  address: string
  contact: string
  isDefault: boolean
}

interface WarehouseContextType {
  warehouses: Warehouse[]
  loading: boolean
  addWarehouse: (warehouse: Omit<Warehouse, "id">) => Promise<void>
  updateWarehouse: (warehouse: Warehouse) => Promise<void>
  deleteWarehouse: (id: number) => Promise<void>
  defaultWarehouse: Warehouse | undefined
  refreshLocations: () => Promise<void>
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined)

function toWarehouse(loc: LocationResponse): Warehouse {
  return {
    id: loc.id,
    name: loc.name,
    address: loc.address,
    contact: loc.contact_person,
    isDefault: loc.is_default,
  }
}

export function WarehouseProvider({ children }: { children: React.ReactNode }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLocations = async () => {
    try {
      setLoading(true)
      const res = await locationApi.getAll()
      setWarehouses((res.data ?? []).map(toWarehouse))
    } catch (err) {
      console.error("Failed to fetch locations:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLocations()
  }, [])

  const addWarehouse = async (warehouseData: Omit<Warehouse, "id">) => {
    const res = await locationApi.create({
      name: warehouseData.name,
      address: warehouseData.address,
      contact_person: warehouseData.contact,
      is_default: warehouseData.isDefault,
    })
    setWarehouses(prev => [...prev, toWarehouse(res.data)])
  }

  const updateWarehouse = async (warehouse: Warehouse) => {
    await locationApi.update(warehouse.id, {
      name: warehouse.name,
      address: warehouse.address,
      contact_person: warehouse.contact,
      is_default: warehouse.isDefault,
    })
    // Refresh to get accurate is_default state from backend
    await fetchLocations()
  }

  const deleteWarehouse = async (id: number) => {
    await locationApi.delete(id)
    setWarehouses(prev => prev.filter(w => w.id !== id))
  }

  const defaultWarehouse = warehouses.find(w => w.isDefault) || warehouses[0]

  return (
    <WarehouseContext.Provider
      value={{
        warehouses,
        loading,
        addWarehouse,
        updateWarehouse,
        deleteWarehouse,
        defaultWarehouse,
        refreshLocations: fetchLocations,
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
