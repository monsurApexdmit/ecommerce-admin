"use client"

import type React from "react"

import { useState } from "react"
import { Search, Download, Upload, Trash2, Edit2, Plus, FilePen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { exportToCSV, parseCSV, generateId } from "@/lib/export-import-utils"

interface Attribute {
  id: string
  name: string
  displayName: string
  option: "dropdown" | "radio"
  published: boolean
  values: string[]
}

export default function AttributesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([])
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState("")

  const [attributes, setAttributes] = useState<Attribute[]>([
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
  ])

  const filteredAttributes = attributes.filter(
    (attr) =>
      attr.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attr.displayName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAttributes(filteredAttributes.map((a) => a.id))
    } else {
      setSelectedAttributes([])
    }
  }

  const handleSelectAttribute = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedAttributes([...selectedAttributes, id])
    } else {
      setSelectedAttributes(selectedAttributes.filter((sid) => sid !== id))
    }
  }

  const handleTogglePublished = (id: string) => {
    setAttributes(attributes.map((attr) => (attr.id === id ? { ...attr, published: !attr.published } : attr)))
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this attribute?")) {
      setAttributes(attributes.filter((attr) => attr.id !== id))
      setSelectedAttributes(selectedAttributes.filter((sid) => sid !== id))
    }
  }

  const handleBulkDelete = () => {
    if (selectedAttributes.length === 0) {
      alert("Please select attributes to delete")
      return
    }
    if (confirm(`Delete ${selectedAttributes.length} selected attribute(s)?`)) {
      setAttributes(attributes.filter((attr) => !selectedAttributes.includes(attr.id)))
      setSelectedAttributes([])
    }
  }

  const handleExport = () => {
    const exportData = filteredAttributes.map((attr) => ({
      id: attr.id,
      name: attr.name,
      display_name: attr.displayName,
      option: attr.option,
      published: attr.published ? "Yes" : "No",
      values: attr.values.join(";"),
    }))

    const headers = ["ID", "Name", "Display Name", "Option", "Published", "Values"]
    exportToCSV(exportData, "attributes", headers)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const importedData = parseCSV(text)

      const newAttributes = importedData.map((item) => ({
        id: item.id || generateId(),
        name: item.name,
        displayName: item.display_name,
        option: item.option || "dropdown",
        published: item.published === "Yes",
        values: item.values ? item.values.split(";") : [],
      }))

      setAttributes([...attributes, ...newAttributes])
      setIsImportDialogOpen(false)
    }
    reader.readAsText(file)
  }

  const handleBulkActionSubmit = () => {
    if (!bulkAction || selectedAttributes.length === 0) return

    if (bulkAction === "delete") {
      handleBulkDelete()
    } else if (bulkAction === "publish") {
      setAttributes(attributes.map((a) => (selectedAttributes.includes(a.id) ? { ...a, published: true } : a)))
      setSelectedAttributes([])
    } else if (bulkAction === "unpublish") {
      setAttributes(attributes.map((a) => (selectedAttributes.includes(a.id) ? { ...a, published: false } : a)))
      setSelectedAttributes([])
    }

    setIsBulkActionDialogOpen(false)
    setBulkAction("")
  }

  const allSelected =
    filteredAttributes.length > 0 && filteredAttributes.every((attr) => selectedAttributes.includes(attr.id))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Attributes</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-transparent"
            onClick={() => setIsImportDialogOpen(true)}
          >
            <Upload className="w-4 h-4" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-orange-600 border-orange-200 hover:bg-orange-50 bg-transparent"
            onClick={() => setIsBulkActionDialogOpen(true)}
            disabled={selectedAttributes.length === 0}
          >
            <FilePen className="w-4 h-4" />
            Bulk Action
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-red-600 border-red-200 hover:bg-red-50 bg-transparent"
            onClick={handleBulkDelete}
            disabled={selectedAttributes.length === 0}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
          <Button size="sm" className="gap-2 bg-emerald-500 hover:bg-emerald-600">
            <Plus className="w-4 h-4" />
            Add Attribute
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by attribute name"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button className="bg-emerald-500 hover:bg-emerald-600">Filter</Button>
            <Button variant="outline">Reset</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left p-4 font-medium text-gray-700 w-12">
                  <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                </th>
                <th className="text-left p-4 font-medium text-gray-700">ID</th>
                <th className="text-left p-4 font-medium text-gray-700">NAME</th>
                <th className="text-left p-4 font-medium text-gray-700">DISPLAY NAME</th>
                <th className="text-left p-4 font-medium text-gray-700">OPTION</th>
                <th className="text-left p-4 font-medium text-gray-700">PUBLISHED</th>
                <th className="text-left p-4 font-medium text-gray-700">VALUES</th>
                <th className="text-left p-4 font-medium text-gray-700">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttributes.map((attribute) => (
                <tr key={attribute.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <Checkbox
                      checked={selectedAttributes.includes(attribute.id)}
                      onCheckedChange={(checked) => handleSelectAttribute(attribute.id, checked as boolean)}
                    />
                  </td>
                  <td className="p-4 text-gray-900 font-medium">{attribute.id}</td>
                  <td className="p-4 text-gray-900">{attribute.name}</td>
                  <td className="p-4 text-gray-900">{attribute.displayName}</td>
                  <td className="p-4 text-gray-600">{attribute.option}</td>
                  <td className="p-4">
                    <button
                      onClick={() => handleTogglePublished(attribute.id)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        attribute.published ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          attribute.published ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/dashboard/attributes/${attribute.id}`}
                      className="p-2 hover:bg-gray-100 rounded inline-block"
                    >
                      <Edit2 className="w-4 h-4 text-gray-600" />
                    </Link>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/attributes/${attribute.id}`}
                        className="p-2 hover:bg-gray-100 rounded inline-block"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </Link>
                      <button onClick={() => handleDelete(attribute.id)} className="p-2 hover:bg-gray-100 rounded">
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

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Attributes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>CSV File</Label>
              <Input type="file" accept=".csv" onChange={handleImport} />
              <p className="text-sm text-gray-500">
                Upload a CSV file with columns: ID, Name, Display Name, Option, Published, Values (semicolon-separated)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Dialog */}
      <Dialog open={isBulkActionDialogOpen} onOpenChange={setIsBulkActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Actions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publish">Publish</SelectItem>
                  <SelectItem value="unpublish">Unpublish</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkActionSubmit}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!bulkAction}
            >
              Apply Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
