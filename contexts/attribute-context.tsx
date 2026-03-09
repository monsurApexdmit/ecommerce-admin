"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { attributeApi, type AttributeResponse } from "@/lib/attributeApi"

export interface Attribute {
  id: string
  name: string
  displayName: string
  option: "dropdown" | "radio"
  published: boolean
  values: string[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface AttributeContextType {
  attributes: Attribute[]
  isLoading: boolean
  error: string | null
  addAttribute: (attribute: Omit<Attribute, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) => Promise<void>
  updateAttribute: (id: string, updates: Partial<Attribute>) => Promise<void>
  deleteAttribute: (id: string) => Promise<void>
  refreshAttributes: () => Promise<void>
}

const AttributeContext = createContext<AttributeContextType | undefined>(undefined)

// Convert backend response to frontend Attribute interface
function convertToAttribute(backendAttribute: AttributeResponse): Attribute {
  return {
    id: backendAttribute.id.toString(),
    name: backendAttribute.name,
    displayName: backendAttribute.display_name,
    option: backendAttribute.option_type as "dropdown" | "radio",
    published: backendAttribute.status,
    values: backendAttribute.values ? backendAttribute.values.split(',').map(v => v.trim()).filter(v => v !== '') : [],
    created_at: backendAttribute.created_at,
    updated_at: backendAttribute.updated_at,
    deleted_at: backendAttribute.deleted_at || null,
  }
}

export function AttributeProvider({ children }: { children: React.ReactNode }) {
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch full attributes including values field (needed for product modal value badges)
  const refreshAttributes = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await attributeApi.getAll({ limit: 200 })
      const convertedAttributes = response.data.map(convertToAttribute)
      setAttributes(convertedAttributes)
    } catch (err: any) {
      console.error('Error fetching attributes:', err)
      setError(err.response?.data?.error || 'Failed to fetch attributes')
    } finally {
      setIsLoading(false)
    }
  }

  // Load attributes on mount
  useEffect(() => {
    refreshAttributes()
  }, [])

  const addAttribute = async (attribute: Omit<Attribute, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
    try {
      await attributeApi.create({
        name: attribute.name,
        display_name: attribute.displayName,
        option_type: attribute.option,
        values: attribute.values.join(','),
        status: attribute.published,
      })

      // Refresh attributes to get updated list
      await refreshAttributes()
    } catch (err: any) {
      console.error('Error creating attribute:', err)
      throw new Error(err.response?.data?.error || 'Failed to create attribute')
    }
  }

  const updateAttribute = async (id: string, updates: Partial<Attribute>) => {
    try {
      const updateData: any = {}

      if (updates.name !== undefined) {
        updateData.name = updates.name
      }
      if (updates.displayName !== undefined) {
        updateData.display_name = updates.displayName
      }
      if (updates.option !== undefined) {
        updateData.option_type = updates.option
      }
      if (updates.values !== undefined) {
        updateData.values = updates.values.join(',')
      }
      if (updates.published !== undefined) {
        updateData.status = updates.published
      }

      await attributeApi.update(parseInt(id), updateData)

      // Refresh attributes to get updated list
      await refreshAttributes()
    } catch (err: any) {
      console.error('Error updating attribute:', err)
      throw new Error(err.response?.data?.error || 'Failed to update attribute')
    }
  }

  const deleteAttribute = async (id: string) => {
    try {
      await attributeApi.delete(parseInt(id))

      // Refresh attributes to get updated list
      await refreshAttributes()
    } catch (err: any) {
      console.error('Error deleting attribute:', err)
      throw new Error(err.response?.data?.error || 'Failed to delete attribute')
    }
  }

  return (
    <AttributeContext.Provider
      value={{
        attributes,
        isLoading,
        error,
        addAttribute,
        updateAttribute,
        deleteAttribute,
        refreshAttributes,
      }}
    >
      {children}
    </AttributeContext.Provider>
  )
}

export function useAttribute() {
  const context = useContext(AttributeContext)
  if (context === undefined) {
    throw new Error("useAttribute must be used within an AttributeProvider")
  }
  return context
}
