"use client"

import React, { createContext, useContext, useState } from "react"
import { generateId } from "@/lib/export-import-utils"

export interface StockTransfer {
    id: string
    productId: string
    productName: string
    variantId?: string
    fromWarehouseId: string
    toWarehouseId: string
    quantity: number
    date: string
    status: 'Pending' | 'Completed' | 'Cancelled'
    notes?: string
}

interface TransferContextType {
    transfers: StockTransfer[]
    addTransfer: (transfer: Omit<StockTransfer, "id" | "date" | "status">) => void
    completeTransfer: (id: string) => void
    cancelTransfer: (id: string) => void
}

const TransferContext = createContext<TransferContextType | undefined>(undefined)

export function TransferProvider({ children }: { children: React.ReactNode }) {
    const [transfers, setTransfers] = useState<StockTransfer[]>([])

    const addTransfer = (transferData: Omit<StockTransfer, "id" | "date" | "status">) => {
        const newTransfer: StockTransfer = {
            ...transferData,
            id: generateId(),
            date: new Date().toISOString(),
            status: 'Completed', // For MVP, auto-complete transfers
        }
        setTransfers(prev => [newTransfer, ...prev])
    }

    const completeTransfer = (id: string) => {
        setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'Completed' } : t))
    }

    const cancelTransfer = (id: string) => {
        setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'Cancelled' } : t))
    }

    return (
        <TransferContext.Provider
            value={{
                transfers,
                addTransfer,
                completeTransfer,
                cancelTransfer,
            }}
        >
            {children}
        </TransferContext.Provider>
    )
}

export function useTransfer() {
    const context = useContext(TransferContext)
    if (context === undefined) {
        throw new Error("useTransfer must be used within a TransferProvider")
    }
    return context
}
