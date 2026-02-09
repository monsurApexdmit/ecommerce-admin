"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"

export interface TrackingEvent {
  id: string
  status: string
  location?: string
  description: string
  eventTime: string
}

export interface Shipment {
  id: string
  orderId: string
  orderNumber: string
  customerName: string
  trackingNumber: string
  carrier: string
  shippingMethod?: string
  status: "pending" | "picked_up" | "in_transit" | "out_for_delivery" | "delivered" | "failed" | "returned"
  shippedAt?: string
  estimatedDelivery?: string
  deliveredAt?: string
  shippingCost: number
  weight?: number
  dimensions?: string
  notes?: string
  trackingHistory: TrackingEvent[]
  createdAt: string
  updatedAt: string
}

interface ShipmentContextType {
  shipments: Shipment[]
  addShipment: (shipment: Omit<Shipment, "id" | "createdAt" | "updatedAt" | "trackingHistory">) => void
  updateShipment: (id: string, updates: Partial<Shipment>) => void
  deleteShipment: (id: string) => void
  getShipmentById: (id: string) => Shipment | undefined
  getShipmentsByOrder: (orderId: string) => Shipment[]
  updateStatus: (id: string, status: Shipment["status"], location?: string, description?: string) => void
  addTrackingEvent: (shipmentId: string, event: Omit<TrackingEvent, "id">) => void
  getShipmentByTracking: (trackingNumber: string) => Shipment | undefined
  getStats: () => {
    total: number
    pending: number
    inTransit: number
    delivered: number
    failed: number
    totalShippingCost: number
  }
}

const ShipmentContext = createContext<ShipmentContextType | undefined>(undefined)

const initialShipments: Shipment[] = [
  {
    id: "1",
    orderId: "14",
    orderNumber: "INV-001",
    customerName: "John Doe",
    trackingNumber: "DHL-BD-123456789",
    carrier: "DHL Express",
    shippingMethod: "Express Delivery",
    status: "in_transit",
    shippedAt: "2026-02-08T10:00:00Z",
    estimatedDelivery: "2026-02-11T18:00:00Z",
    shippingCost: 150.0,
    weight: 2.5,
    dimensions: "30x20x15",
    notes: "Fragile items - handle with care",
    trackingHistory: [
      {
        id: "evt_2",
        status: "in_transit",
        location: "Dhaka Distribution Center",
        description: "Package in transit to destination",
        eventTime: "2026-02-09T08:00:00Z",
      },
      {
        id: "evt_1",
        status: "picked_up",
        location: "Origin Warehouse",
        description: "Package picked up by carrier",
        eventTime: "2026-02-08T10:00:00Z",
      },
    ],
    createdAt: "2026-02-08T09:00:00Z",
    updatedAt: "2026-02-09T08:00:00Z",
  },
  {
    id: "2",
    orderId: "15",
    orderNumber: "INV-002",
    customerName: "Jane Smith",
    trackingNumber: "FEDEX-987654321",
    carrier: "FedEx",
    shippingMethod: "Standard Delivery",
    status: "delivered",
    shippedAt: "2026-02-05T14:00:00Z",
    estimatedDelivery: "2026-02-08T18:00:00Z",
    deliveredAt: "2026-02-08T15:30:00Z",
    shippingCost: 100.0,
    weight: 1.8,
    dimensions: "25x15x10",
    trackingHistory: [
      {
        id: "evt_6",
        status: "delivered",
        location: "Customer Address",
        description: "Package delivered successfully",
        eventTime: "2026-02-08T15:30:00Z",
      },
      {
        id: "evt_5",
        status: "out_for_delivery",
        location: "Chittagong Delivery Hub",
        description: "Out for delivery",
        eventTime: "2026-02-08T09:00:00Z",
      },
      {
        id: "evt_4",
        status: "in_transit",
        location: "Dhaka Hub",
        description: "Package in transit",
        eventTime: "2026-02-06T16:00:00Z",
      },
      {
        id: "evt_3",
        status: "picked_up",
        location: "Warehouse B",
        description: "Picked up by FedEx",
        eventTime: "2026-02-05T14:00:00Z",
      },
    ],
    createdAt: "2026-02-05T13:00:00Z",
    updatedAt: "2026-02-08T15:30:00Z",
  },
  {
    id: "3",
    orderId: "16",
    orderNumber: "INV-003",
    customerName: "Mike Johnson",
    trackingNumber: "PATHAO-AAA111222",
    carrier: "Pathao Courier",
    shippingMethod: "Same Day Delivery",
    status: "out_for_delivery",
    shippedAt: "2026-02-09T08:00:00Z",
    estimatedDelivery: "2026-02-09T20:00:00Z",
    shippingCost: 80.0,
    weight: 0.5,
    dimensions: "20x10x8",
    trackingHistory: [
      {
        id: "evt_9",
        status: "out_for_delivery",
        location: "Gulshan Delivery Station",
        description: "Out for delivery - Expected by 8 PM",
        eventTime: "2026-02-09T14:00:00Z",
      },
      {
        id: "evt_8",
        status: "in_transit",
        location: "Dhaka Hub",
        description: "Arrived at local hub",
        eventTime: "2026-02-09T10:00:00Z",
      },
      {
        id: "evt_7",
        status: "picked_up",
        location: "Pickup Point",
        description: "Package picked up",
        eventTime: "2026-02-09T08:00:00Z",
      },
    ],
    createdAt: "2026-02-09T07:30:00Z",
    updatedAt: "2026-02-09T14:00:00Z",
  },
  {
    id: "4",
    orderId: "17",
    orderNumber: "INV-004",
    customerName: "Sarah Williams",
    trackingNumber: "DHL-BD-999888777",
    carrier: "DHL Express",
    shippingMethod: "Express Delivery",
    status: "pending",
    shippingCost: 150.0,
    weight: 3.2,
    dimensions: "35x25x20",
    notes: "Electronics - fragile",
    trackingHistory: [
      {
        id: "evt_10",
        status: "pending",
        description: "Shipment created - awaiting pickup",
        eventTime: "2026-02-09T16:00:00Z",
      },
    ],
    createdAt: "2026-02-09T16:00:00Z",
    updatedAt: "2026-02-09T16:00:00Z",
  },
  {
    id: "5",
    orderId: "18",
    orderNumber: "INV-005",
    customerName: "Ahmed Hassan",
    trackingNumber: "SUNDARBAN-555666",
    carrier: "Sundarban Courier",
    shippingMethod: "Standard Delivery",
    status: "failed",
    shippedAt: "2026-02-07T11:00:00Z",
    estimatedDelivery: "2026-02-10T18:00:00Z",
    shippingCost: 70.0,
    weight: 1.2,
    dimensions: "22x18x12",
    trackingHistory: [
      {
        id: "evt_13",
        status: "failed",
        location: "Customer Address",
        description: "Delivery failed - Customer not available. Will retry tomorrow",
        eventTime: "2026-02-09T17:00:00Z",
      },
      {
        id: "evt_12",
        status: "out_for_delivery",
        location: "Sylhet Delivery Hub",
        description: "Out for delivery",
        eventTime: "2026-02-09T09:00:00Z",
      },
      {
        id: "evt_11",
        status: "in_transit",
        location: "Sylhet Hub",
        description: "Package arrived at Sylhet",
        eventTime: "2026-02-08T14:00:00Z",
      },
    ],
    createdAt: "2026-02-07T10:30:00Z",
    updatedAt: "2026-02-09T17:00:00Z",
  },
]

export function ShipmentProvider({ children }: { children: ReactNode }) {
  const [shipments, setShipments] = useState<Shipment[]>(initialShipments)

  const addShipment = (
    shipment: Omit<Shipment, "id" | "createdAt" | "updatedAt" | "trackingHistory">
  ) => {
    const now = new Date().toISOString()
    const newShipment: Shipment = {
      ...shipment,
      id: `ship_${Date.now()}`,
      trackingHistory: [
        {
          id: `evt_${Date.now()}`,
          status: shipment.status || "pending",
          description: `Shipment created with ${shipment.carrier}`,
          eventTime: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }

    setShipments((prev) => [newShipment, ...prev])
  }

  const updateShipment = (id: string, updates: Partial<Shipment>) => {
    setShipments((prev) =>
      prev.map((shipment) =>
        shipment.id === id
          ? {
              ...shipment,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : shipment
      )
    )
  }

  const deleteShipment = (id: string) => {
    setShipments((prev) => prev.filter((shipment) => shipment.id !== id))
  }

  const getShipmentById = (id: string) => {
    return shipments.find((shipment) => shipment.id === id)
  }

  const getShipmentsByOrder = (orderId: string) => {
    return shipments.filter((shipment) => shipment.orderId === orderId)
  }

  const updateStatus = (
    id: string,
    status: Shipment["status"],
    location?: string,
    description?: string
  ) => {
    const shipment = getShipmentById(id)
    if (!shipment) return

    const now = new Date().toISOString()
    const newEvent: TrackingEvent = {
      id: `evt_${Date.now()}`,
      status,
      location,
      description: description || `Status changed to ${status}`,
      eventTime: now,
    }

    const updates: Partial<Shipment> = {
      status,
      trackingHistory: [newEvent, ...shipment.trackingHistory],
      updatedAt: now,
    }

    // Set timestamps based on status
    if (status === "picked_up" && !shipment.shippedAt) {
      updates.shippedAt = now
    }
    if (status === "delivered") {
      updates.deliveredAt = now
    }

    updateShipment(id, updates)
  }

  const addTrackingEvent = (shipmentId: string, event: Omit<TrackingEvent, "id">) => {
    const shipment = getShipmentById(shipmentId)
    if (!shipment) return

    const newEvent: TrackingEvent = {
      ...event,
      id: `evt_${Date.now()}`,
    }

    updateShipment(shipmentId, {
      trackingHistory: [newEvent, ...shipment.trackingHistory],
    })
  }

  const getShipmentByTracking = (trackingNumber: string) => {
    return shipments.find(
      (shipment) => shipment.trackingNumber.toLowerCase() === trackingNumber.toLowerCase()
    )
  }

  const getStats = () => {
    return {
      total: shipments.length,
      pending: shipments.filter((s) => s.status === "pending").length,
      inTransit: shipments.filter((s) => s.status === "in_transit").length,
      delivered: shipments.filter((s) => s.status === "delivered").length,
      failed: shipments.filter((s) => s.status === "failed").length,
      totalShippingCost: shipments.reduce((sum, s) => sum + s.shippingCost, 0),
    }
  }

  return (
    <ShipmentContext.Provider
      value={{
        shipments,
        addShipment,
        updateShipment,
        deleteShipment,
        getShipmentById,
        getShipmentsByOrder,
        updateStatus,
        addTrackingEvent,
        getShipmentByTracking,
        getStats,
      }}
    >
      {children}
    </ShipmentContext.Provider>
  )
}

export function useShipment() {
  const context = useContext(ShipmentContext)
  if (!context) {
    throw new Error("useShipment must be used within ShipmentProvider")
  }
  return context
}
