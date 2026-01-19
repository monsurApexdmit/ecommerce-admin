"use client"

import React, { createContext, useContext, useState } from "react"
import { generateId } from "@/lib/export-import-utils"

export interface Attribute {
  id: string
  name: string
  displayName: string
  option: "dropdown" | "radio"
  published: boolean
  values: string[]
}

interface AttributeContextType {
  attributes: Attribute[]
  addAttribute: (attribute: Attribute) => void
  updateAttribute: (attribute: Attribute) => void
  deleteAttribute: (id: string) => void
}

const AttributeContext = createContext<AttributeContextType | undefined>(undefined)

const initialAttributes: Attribute[] = [
  {
    id: "81B2",
    name: "Color",
    displayName: "Color",
    option: "dropdown",
    published: true,
    values: ["Red", "Blue", "Green", "Yellow", "Black", "White"],
  },
  {
    id: "81B6",
    name: "Size",
    displayName: "Size",
    option: "radio",
    published: true,
    values: ["Small", "Medium", "Large", "XL", "XXL"],
  },
  {
    id: "81B7",
    name: "Weight",
    displayName: "Weight",
    option: "dropdown",
    published: true,
    values: ["1kg", "2kg", "5kg", "10kg", "25kg"],
  },
    {
    id: "81B8",
    name: "Material",
    displayName: "Material",
    option: "dropdown",
    published: true,
    values: ["Cotton", "Polyester", "Silk", "Denim"],
  },
]

export function AttributeProvider({ children }: { children: React.ReactNode }) {
  const [attributes, setAttributes] = useState<Attribute[]>(initialAttributes)

  const addAttribute = (attribute: Attribute) => {
    setAttributes((prev) => [...prev, attribute])
  }

  const updateAttribute = (attribute: Attribute) => {
    setAttributes((prev) => prev.map((a) => (a.id === attribute.id ? attribute : a)))
  }

  const deleteAttribute = (id: string) => {
    setAttributes((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <AttributeContext.Provider value={{ attributes, addAttribute, updateAttribute, deleteAttribute }}>
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
