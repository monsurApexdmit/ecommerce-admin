"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { attributeApi, type AttributeResponse } from "@/lib/attributeApi"

export interface Attribute {
  id: string
  name: string
  displayName: string
  option: "dropdown" | "radio" | "button" | "swatch"
  published: boolean
  values: string[]
  /** label -> #RRGGBB, only for swatch attributes */
  valueColors?: Record<string, string>
  /** number of products using this attribute */
  usedInProducts: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface AttributeContextType {
  attributes: Attribute[]
  isLoading: boolean
  error: string | null
  addAttribute: (attribute: Omit<Attribute, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'usedInProducts'>) => Promise<void>
  updateAttribute: (id: string, updates: Partial<Attribute>) => Promise<void>
  deleteAttribute: (id: string) => Promise<void>
  refreshAttributes: () => Promise<void>
}

const AttributeContext = createContext<AttributeContextType | undefined>(undefined)

// Convert backend response to frontend Attribute interface
function convertToAttribute(backendAttribute: any): Attribute {
  return {
    id: backendAttribute.id.toString(),
    name: backendAttribute.name,
    displayName: backendAttribute.displayName || backendAttribute.display_name,
    option: (backendAttribute.optionType || backendAttribute.option_type) as Attribute["option"],
    published: backendAttribute.status,
    values: Array.isArray(backendAttribute.values)
      ? backendAttribute.values.map((v: any) => (typeof v === 'string' ? v : v.label)).filter(Boolean)
      : backendAttribute.values ? String(backendAttribute.values).split(',').map(v => v.trim()).filter(v => v !== '') : [],
    valueColors: Array.isArray(backendAttribute.values)
      ? Object.fromEntries(backendAttribute.values.filter((v: any) => v && typeof v === 'object' && v.color).map((v: any) => [v.label, v.color]))
      : undefined,
    usedInProducts: Number(backendAttribute.usedInProducts ?? 0),
    created_at: backendAttribute.created_at,
    updated_at: backendAttribute.updated_at,
    deleted_at: backendAttribute.deleted_at || null,
  }
}

// Swatch attributes carry a colour per value; everything else stays a comma list.
function serializeValues(option: string, values: string[] | string, colors?: Record<string, string>) {
  const list = typeof values === 'string' ? values.split(',').map((v) => v.trim()).filter(Boolean) : values
  if (option === 'swatch' || (colors && Object.keys(colors).length)) return list.map((label) => ({ label, color: colors?.[label] ?? null }))
  return list.join(',')
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
      if (err.response?.status !== 403) {
        console.error('Error fetching attributes:', err)
        setError(err.response?.data?.message || err.response?.data?.error || 'Failed to fetch attributes')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Load attributes on mount
  useEffect(() => {
    refreshAttributes()
  }, [])

  const addAttribute = async (attribute: Omit<Attribute, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'usedInProducts'>) => {
    try {
      await attributeApi.create({
        name: attribute.name,
        displayName: attribute.displayName,
        optionType: attribute.option,
        values: serializeValues(attribute.option, attribute.values, attribute.valueColors),
        status: attribute.published,
      })

      // Refresh attributes to get updated list
      await refreshAttributes()
    } catch (err: any) {
      console.error('Error creating attribute:', err)
      throw new Error(err.response?.data?.message || err.response?.data?.error || 'Failed to create attribute')
    }
  }

  const updateAttribute = async (id: string, updates: Partial<Attribute>) => {
    try {
      const updateData: any = {}

      if (updates.name !== undefined) {
        updateData.name = updates.name
      }
      if (updates.displayName !== undefined) {
        updateData.displayName = updates.displayName
      }
      if (updates.option !== undefined) {
        updateData.optionType = updates.option
      }
      if (updates.values !== undefined) {
        updateData.values = serializeValues(updates.option ?? (updates.valueColors ? 'swatch' : 'dropdown'), updates.values, updates.valueColors)
      }
      if (updates.published !== undefined) {
        updateData.status = updates.published
      }

      await attributeApi.update(parseInt(id), updateData)

      // Refresh attributes to get updated list
      await refreshAttributes()
    } catch (err: any) {
      console.error('Error updating attribute:', err)
      throw new Error(err.response?.data?.message || err.response?.data?.error || 'Failed to update attribute')
    }
  }

  const deleteAttribute = async (id: string) => {
    try {
      await attributeApi.delete(parseInt(id))

      // Refresh attributes to get updated list
      await refreshAttributes()
    } catch (err: any) {
      console.error('Error deleting attribute:', err)
      throw new Error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete attribute')
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
