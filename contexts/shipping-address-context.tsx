"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

export interface ShippingAddress {
  id: string
  customerId?: string
  customerName?: string
  fullName: string
  phone: string
  email?: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
  addressType: "home" | "office" | "other"
  createdAt: string
  updatedAt: string
}

interface ShippingAddressContextType {
  addresses: ShippingAddress[]
  addAddress: (address: Omit<ShippingAddress, "id" | "createdAt" | "updatedAt">) => void
  updateAddress: (id: string, updates: Partial<ShippingAddress>) => void
  deleteAddress: (id: string) => void
  getAddressById: (id: string) => ShippingAddress | undefined
  getAddressesByCustomer: (customerId: string) => ShippingAddress[]
  setAsDefault: (id: string, customerId?: string) => void
  getDefaultAddress: (customerId?: string) => ShippingAddress | undefined
}

const ShippingAddressContext = createContext<ShippingAddressContextType | undefined>(undefined)

const initialAddresses: ShippingAddress[] = [
  {
    id: "1",
    customerId: "1",
    customerName: "John Doe",
    fullName: "John Doe",
    phone: "+8801712345678",
    email: "john.doe@example.com",
    addressLine1: "123 Main Street",
    addressLine2: "Apartment 4B",
    city: "Dhaka",
    state: "Dhaka Division",
    postalCode: "1205",
    country: "Bangladesh",
    isDefault: true,
    addressType: "home",
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "2",
    customerId: "1",
    customerName: "John Doe",
    fullName: "John Doe",
    phone: "+8801712345678",
    email: "john.doe@example.com",
    addressLine1: "456 Business Ave",
    addressLine2: "Suite 200",
    city: "Dhaka",
    state: "Dhaka Division",
    postalCode: "1206",
    country: "Bangladesh",
    isDefault: false,
    addressType: "office",
    createdAt: "2026-01-20T14:30:00Z",
    updatedAt: "2026-01-20T14:30:00Z",
  },
  {
    id: "3",
    customerId: "2",
    customerName: "Jane Smith",
    fullName: "Jane Smith",
    phone: "+8801812345678",
    email: "jane.smith@example.com",
    addressLine1: "789 Commerce Road",
    addressLine2: "",
    city: "Chittagong",
    state: "Chittagong Division",
    postalCode: "4000",
    country: "Bangladesh",
    isDefault: true,
    addressType: "office",
    createdAt: "2026-01-18T09:15:00Z",
    updatedAt: "2026-01-18T09:15:00Z",
  },
  {
    id: "4",
    fullName: "Guest Customer",
    phone: "+8801912345678",
    email: "guest@example.com",
    addressLine1: "321 Guest Street",
    addressLine2: "",
    city: "Sylhet",
    state: "Sylhet Division",
    postalCode: "3100",
    country: "Bangladesh",
    isDefault: false,
    addressType: "home",
    createdAt: "2026-02-01T16:45:00Z",
    updatedAt: "2026-02-01T16:45:00Z",
  },
  {
    id: "5",
    customerId: "3",
    customerName: "Mike Johnson",
    fullName: "Mike Johnson",
    phone: "+8801612345678",
    email: "mike.j@example.com",
    addressLine1: "555 Market Place",
    addressLine2: "Building C",
    city: "Khulna",
    state: "Khulna Division",
    postalCode: "9000",
    country: "Bangladesh",
    isDefault: true,
    addressType: "home",
    createdAt: "2026-01-25T11:20:00Z",
    updatedAt: "2026-01-25T11:20:00Z",
  },
]

export function ShippingAddressProvider({ children }: { children: ReactNode }) {
  const [addresses, setAddresses] = useState<ShippingAddress[]>(initialAddresses)

  const addAddress = (address: Omit<ShippingAddress, "id" | "createdAt" | "updatedAt">) => {
    const newAddress: ShippingAddress = {
      ...address,
      id: `addr_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // If this is set as default, unset other defaults for the same customer
    if (newAddress.isDefault && newAddress.customerId) {
      setAddresses((prev) =>
        prev.map((addr) =>
          addr.customerId === newAddress.customerId && addr.isDefault
            ? { ...addr, isDefault: false }
            : addr
        )
      )
    }

    setAddresses((prev) => [newAddress, ...prev])
  }

  const updateAddress = (id: string, updates: Partial<ShippingAddress>) => {
    setAddresses((prev) =>
      prev.map((address) => {
        if (address.id === id) {
          const updated = {
            ...address,
            ...updates,
            updatedAt: new Date().toISOString(),
          }

          // If setting as default, unset other defaults for same customer
          if (updates.isDefault && updated.customerId) {
            setAddresses((all) =>
              all.map((addr) =>
                addr.customerId === updated.customerId && addr.id !== id && addr.isDefault
                  ? { ...addr, isDefault: false }
                  : addr
              )
            )
          }

          return updated
        }
        return address
      })
    )
  }

  const deleteAddress = (id: string) => {
    setAddresses((prev) => prev.filter((address) => address.id !== id))
  }

  const getAddressById = (id: string) => {
    return addresses.find((address) => address.id === id)
  }

  const getAddressesByCustomer = (customerId: string) => {
    return addresses.filter((address) => address.customerId === customerId)
  }

  const setAsDefault = (id: string, customerId?: string) => {
    const address = getAddressById(id)
    if (!address) return

    const targetCustomerId = customerId || address.customerId

    if (targetCustomerId) {
      setAddresses((prev) =>
        prev.map((addr) => {
          if (addr.customerId === targetCustomerId) {
            return {
              ...addr,
              isDefault: addr.id === id,
              updatedAt: new Date().toISOString(),
            }
          }
          return addr
        })
      )
    } else {
      updateAddress(id, { isDefault: true })
    }
  }

  const getDefaultAddress = (customerId?: string) => {
    if (customerId) {
      return addresses.find((addr) => addr.customerId === customerId && addr.isDefault)
    }
    return addresses.find((addr) => addr.isDefault)
  }

  return (
    <ShippingAddressContext.Provider
      value={{
        addresses,
        addAddress,
        updateAddress,
        deleteAddress,
        getAddressById,
        getAddressesByCustomer,
        setAsDefault,
        getDefaultAddress,
      }}
    >
      {children}
    </ShippingAddressContext.Provider>
  )
}

export function useShippingAddress() {
  const context = useContext(ShippingAddressContext)
  if (!context) {
    throw new Error("useShippingAddress must be used within ShippingAddressProvider")
  }
  return context
}
