"use client"

import type React from "react"

import { useState } from "react"
import { ChevronRight, Edit2, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useParams } from "next/navigation"

interface AttributeValue {
  id: string
  name: string
  type: "dropdown" | "radio"
  status: boolean
}

export default function AttributeValuesPage() {
  const params = useParams()
  const attributeId = params.id as string

  // Mock data based on attribute ID
  const attributeData: Record<string, { name: string; values: AttributeValue[] }> = {
    "81B2": {
      name: "Color",
      values: [
        { id: "81B3", name: "Red", type: "dropdown", status: true },
        { id: "81B4", name: "Green", type: "dropdown", status: true },
        { id: "81B5", name: "Blue", type: "dropdown", status: true },
      ],
    },
    "81B6": {
      name: "Size",
      values: [
        { id: "81B7", name: "Small", type: "radio", status: true },
        { id: "81B8", name: "Medium", type: "radio", status: true },
        { id: "81B9", name: "Large", type: "radio", status: true },
        { id: "81BA", name: "XL", type: "radio", status: true },
      ],
    },
  }

  const currentAttribute = attributeData[attributeId] || {
    name: "Unknown",
    values: [],
  }

  const [values, setValues] = useState<AttributeValue[]>(currentAttribute.values)
  const [selectedValues, setSelectedValues] = useState<string[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingValue, setEditingValue] = useState<AttributeValue | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "dropdown" as "dropdown" | "radio",
    status: true,
  })

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedValues(values.map((v) => v.id))
    } else {
      setSelectedValues([])
    }
  }

  const handleSelectValue = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedValues([...selectedValues, id])
    } else {
      setSelectedValues(selectedValues.filter((sid) => sid !== id))
    }
  }

  const handleToggleStatus = (id: string) => {
    setValues(values.map((val) => (val.id === id ? { ...val, status: !val.status } : val)))
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this value?")) {
      setValues(values.filter((val) => val.id !== id))
      setSelectedValues(selectedValues.filter((sid) => sid !== id))
    }
  }

  const handleBulkDelete = () => {
    if (selectedValues.length === 0) {
      alert("Please select values to delete")
      return
    }
    if (confirm(`Delete ${selectedValues.length} selected value(s)?`)) {
      setValues(values.filter((val) => !selectedValues.includes(val.id)))
      setSelectedValues([])
    }
  }

  const handleOpenAddDialog = () => {
    setEditingValue(null)
    setFormData({ name: "", type: "dropdown", status: true })
    setIsDialogOpen(true)
  }

  const handleOpenEditDialog = (value: AttributeValue) => {
    setEditingValue(value)
    setFormData({ name: value.name, type: value.type, status: value.status })
    setIsDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingValue(null)
    setFormData({ name: "", type: "dropdown", status: true })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      alert("Please enter a value name")
      return
    }

    if (editingValue) {
      // Update existing value
      setValues(
        values.map((val) =>
          val.id === editingValue.id
            ? { ...val, name: formData.name, type: formData.type, status: formData.status }
            : val,
        ),
      )
    } else {
      // Add new value
      const newValue: AttributeValue = {
        id: `81B${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        name: formData.name,
        type: formData.type,
        status: formData.status,
      }
      setValues([...values, newValue])
    }
    handleCloseDialog()
  }

  const allSelected = values.length > 0 && values.every((val) => selectedValues.includes(val.id))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Attributes Values</h1>
          <div className="flex items-center gap-2 text-sm">
            <Link href="/dashboard/attributes" className="text-blue-600 hover:underline">
              Attributes
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">{currentAttribute.name}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="gap-2 bg-emerald-500 hover:bg-emerald-600" onClick={handleOpenAddDialog}>
            <Plus className="w-4 h-4" />
            Add Value
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 bg-transparent"
          >
            Bulk Action
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-red-600 border-red-200 hover:bg-red-50 bg-transparent"
            onClick={handleBulkDelete}
            disabled={selectedValues.length === 0}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-700 w-12">
                  <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                </th>
                <th className="text-left p-4 font-medium text-gray-700">ID</th>
                <th className="text-left p-4 font-medium text-gray-700">NAME</th>
                <th className="text-left p-4 font-medium text-gray-700">TYPE</th>
                <th className="text-left p-4 font-medium text-gray-700">STATUS</th>
                <th className="text-left p-4 font-medium text-gray-700">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {values.map((value) => (
                <tr key={value.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <Checkbox
                      checked={selectedValues.includes(value.id)}
                      onCheckedChange={(checked) => handleSelectValue(value.id, checked as boolean)}
                    />
                  </td>
                  <td className="p-4 text-gray-900 font-medium">{value.id}</td>
                  <td className="p-4 text-gray-900">{value.name}</td>
                  <td className="p-4 text-gray-600">{value.type}</td>
                  <td className="p-4">
                    <button
                      onClick={() => handleToggleStatus(value.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        value.status ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          value.status ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleOpenEditDialog(value)} className="p-2 hover:bg-gray-100 rounded">
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button onClick={() => handleDelete(value.id)} className="p-2 hover:bg-gray-100 rounded">
                        <Trash2 className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">{editingValue ? "Edit Value" : "Add Value"}</h2>
              <button onClick={handleCloseDialog} className="p-2 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Value Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter value name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as "dropdown" | "radio" })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="dropdown">Dropdown</option>
                  <option value="radio">Radio</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Status</label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: !formData.status })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.status ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.status ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1 bg-transparent">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-emerald-500 hover:bg-emerald-600">
                  {editingValue ? "Update" : "Add"} Value
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
