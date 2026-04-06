"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { transferApi, type TransferResponse, type CreateTransferData } from "@/lib/transferApi"

export type { TransferResponse as StockTransfer }

interface TransferContextType {
    transfers: TransferResponse[]
    loading: boolean
    addTransfer: (data: CreateTransferData) => Promise<void>
    cancelTransfer: (id: number) => Promise<void>
    refreshTransfers: () => Promise<void>
}

const TransferContext = createContext<TransferContextType | undefined>(undefined)

export function TransferProvider({ children }: { children: React.ReactNode }) {
    const [transfers, setTransfers] = useState<TransferResponse[]>([])
    const [loading, setLoading] = useState(true)

    const fetchTransfers = useCallback(async () => {
        try {
            setLoading(true)
            const res = await transferApi.getAll()
            setTransfers(res.data ?? [])
        } catch (err: any) {
            console.error("Failed to fetch transfers:", err)
            throw err
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchTransfers()
    }, [fetchTransfers])

    const addTransfer = async (data: CreateTransferData) => {
        try {
            const res = await transferApi.create(data)
            setTransfers(prev => [res.data, ...prev])
        } catch (err: any) {
            throw new Error(err.response?.data?.message || err.response?.data?.error || 'Failed to create transfer')
        }
    }

    const cancelTransfer = async (id: number) => {
        try {
            const res = await transferApi.cancel(id)
            setTransfers(prev => prev.map(t => t.id === id ? res.data : t))
        } catch (err: any) {
            throw new Error(err.response?.data?.message || err.response?.data?.error || 'Failed to cancel transfer')
        }
    }

    return (
        <TransferContext.Provider value={{ transfers, loading, addTransfer, cancelTransfer, refreshTransfers: fetchTransfers }}>
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
