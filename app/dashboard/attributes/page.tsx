"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Search, Download, Upload, Trash2, Edit2, Plus, FilePen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { exportToCSV, parseCSV, generateId } from "@/lib/export-import-utils"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { useAttribute, type Attribute } from "@/contexts/attribute-context"

export default function AttributesPage() {
  const { attributes, addAttribute, updateAttribute, deleteAttribute } = useAttribute()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([])
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [editingAttribute, setEditingAttribute] = useState<Attribute | null>(null)
  
  // Form state
  const [formData, setFormData] = useState<{
    name: string
    displayName: string
    option: "dropdown" | "radio"
    values: string
  }>({
    name: "",
    displayName: "",
    option: "dropdown",
    values: "",
  })

  // Filter attributes
  const filteredAttributes = attributes.filter(
    (attr) =>
      attr.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      attr.displayName.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const {
    currentItems: currentAttributes,
    currentPage,
    totalPages,
    itemsPerPage,
    goToPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredAttributes, 10)

  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

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
    const attr = attributes.find((a) => a.id === id)
    if (attr) {
      updateAttribute({ ...attr, published: !attr.published })
    }
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this attribute?")) {
      deleteAttribute(id)
      setSelectedAttributes(selectedAttributes.filter((sid) => sid !== id))
    }
  }

  const handleBulkDelete = () => {
    if (selectedAttributes.length === 0) {
      alert("Please select attributes to delete")
      return
    }
    if (confirm(`Delete ${selectedAttributes.length} selected attribute(s)?`)) {
        selectedAttributes.forEach(id => deleteAttribute(id))
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
        option: (item.option as "dropdown" | "radio") || "dropdown",
        published: item.published === "Yes",
        values: item.values ? item.values.split(";") : [],
      }))
      
      newAttributes.forEach(attr => addAttribute(attr))
      setIsImportDialogOpen(false)
    }
    reader.readAsText(file)
  }

  const handleBulkActionSubmit = () => {
    if (!bulkAction || selectedAttributes.length === 0) return

    if (bulkAction === "delete") {
      handleBulkDelete()
    } else if (bulkAction === "publish") {
        selectedAttributes.forEach(id => {
            const attr = attributes.find(a => a.id === id)
            if (attr) updateAttribute({ ...attr, published: true })
        })
      setSelectedAttributes([])
    } else if (bulkAction === "unpublish") {
        selectedAttributes.forEach(id => {
            const attr = attributes.find(a => a.id === id)
            if (attr) updateAttribute({ ...attr, published: false })
        })
      setSelectedAttributes([])
    }

    setIsBulkActionDialogOpen(false)
    setBulkAction("")
  }
  
  const openAddDialog = () => {
      setEditingAttribute(null)
      setFormData({ name: "", displayName: "", option: "dropdown", values: "" })
      setIsAddDialogOpen(true)
  }
  
  const openEditDialog = (attr: Attribute) => {
      setEditingAttribute(attr)
      setFormData({
          name: attr.name,
          displayName: attr.displayName,
          option: attr.option,
          values: attr.values.join(", ")
      })
      setIsAddDialogOpen(true)
  }
  
  const handleSaveAttribute = () => {
      if (!formData.name || !formData.displayName) return
      
      const valuesArray = formData.values.split(",").map(v => v.trim()).filter(v => v !== "")
      
      if (editingAttribute) {
          updateAttribute({
              ...editingAttribute,
              name: formData.name,
              displayName: formData.displayName,
              option: formData.option,
              values: valuesArray
          })
      } else {
          addAttribute({
              id: generateId(),
              name: formData.name,
              displayName: formData.displayName,
              option: formData.option,
              published: true,
              values: valuesArray
          })
      }
      setIsAddDialogOpen(false)
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
          <Button size="sm" className="gap-2 bg-emerald-500 hover:bg-emerald-600" onClick={openAddDialog}>
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
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  handleFilterChange()
                }}
                className="pl-10"
              />
            </div>
            <Button className="bg-emerald-500 hover:bg-emerald-600">Filter</Button>
            <Button variant="outline" onClick={() => {
              setSearchTerm("")
              handleFilterChange()
            }}>Reset</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider w-12">
                  <Checkbox checked={allSelected} onCheckedChange={handleSelectAll} />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">ID</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">NAME</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">DISPLAY NAME</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">OPTION</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">PUBLISHED</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">VALUES</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-4 rounded" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-12" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-4 w-20" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-6 w-11 rounded-full" />
                      </td>
                      <td className="py-3 px-4">
                        <Skeleton className="h-8 w-8 rounded" />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
                      </td>
                    </tr>
                  ))
                : currentAttributes.map((attribute) => (
                    <tr key={attribute.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Checkbox
                          checked={selectedAttributes.includes(attribute.id)}
                          onCheckedChange={(checked) => handleSelectAttribute(attribute.id, checked as boolean)}
                        />
                      </td>
                      <td className="py-3 px-4 text-gray-900 font-medium">{attribute.id}</td>
                      <td className="py-3 px-4 text-gray-900">{attribute.name}</td>
                      <td className="py-3 px-4 text-gray-900">{attribute.displayName}</td>
                      <td className="py-3 px-4 text-gray-600 capitalize">{attribute.option}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleTogglePublished(attribute.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${attribute.published ? "bg-emerald-500" : "bg-gray-300"
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${attribute.published ? "translate-x-6" : "translate-x-1"
                              }`}
                          />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                         <div className="flex flex-wrap gap-1">
                            {attribute.values.slice(0, 3).map((val, i) => (
                                <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">{val}</span>
                            ))}
                            {attribute.values.length > 3 && <span className="text-xs text-gray-500">+{attribute.values.length - 3}</span>}
                         </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditDialog(attribute)}
                            className="p-2 hover:bg-gray-100 rounded inline-block"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600" />
                          </button>
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
        <div className="mx-4 pb-4">
          <PaginationControl
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            totalItems={filteredAttributes.length}
          />
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
      
      {/* Add/Edit Attribute Dialog */}
       <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAttribute ? "Edit Attribute" : "Add Attribute"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Attribute Name (e.g. Color)" 
               />
            </div>
             <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input 
                id="displayName" 
                value={formData.displayName} 
                onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                placeholder="Display Name (e.g. Color)" 
               />
            </div>
            <div className="space-y-2">
              <Label htmlFor="option">Option Type</Label>
              <Select 
                value={formData.option} 
                onValueChange={(value: "dropdown" | "radio") => setFormData({...formData, option: value})}
              >
                  <SelectTrigger>
                      <SelectValue placeholder="Select Option Type" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                      <SelectItem value="radio">Radio</SelectItem>
                  </SelectContent>
              </Select>
            </div>
             <div className="space-y-2">
              <Label htmlFor="values">Values (comma separated)</Label>
              <Input 
                id="values" 
                value={formData.values} 
                onChange={(e) => setFormData({...formData, values: e.target.value})}
                placeholder="Red, Blue, Green" 
               />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAttribute}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {editingAttribute ? "Update Attribute" : "Add Attribute"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
