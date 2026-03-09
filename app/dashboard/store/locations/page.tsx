"use client"

import { useState } from "react"
import { Plus, Edit2, Trash2, MapPin, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useWarehouse, type Warehouse } from "@/contexts/warehouse-context"
import { Badge } from "@/components/ui/badge"

export default function LocationsPage() {
  const { warehouses, loading, addWarehouse, updateWarehouse, deleteWarehouse } = useWarehouse()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contact: "",
    isDefault: false,
  })

  const resetForm = () => {
    setFormData({ name: "", address: "", contact: "", isDefault: false })
    setEditingWarehouse(null)
  }

  const handleOpenDialog = (warehouse?: Warehouse) => {
    if (warehouse) {
      setEditingWarehouse(warehouse)
      setFormData({
        name: warehouse.name,
        address: warehouse.address,
        contact: warehouse.contact,
        isDefault: warehouse.isDefault,
      })
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editingWarehouse) {
        await updateWarehouse({ id: editingWarehouse.id, ...formData })
      } else {
        await addWarehouse(formData)
      }
      setIsDialogOpen(false)
      resetForm()
    } catch (err) {
      console.error("Failed to save location:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (warehouse: Warehouse) => {
    if (warehouse.isDefault) {
      alert("Cannot delete the default location. Please set another as default first.")
      return
    }
    setDeletingId(warehouse.id)
    try {
      await deleteWarehouse(warehouse.id)
    } catch (err) {
      console.error("Failed to delete location:", err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Locations</h1>
          <p className="text-gray-600 mt-1">Manage your warehouses and stores</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Location
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : warehouses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg font-medium">No locations yet</p>
            <p className="text-gray-400 mt-1">Add your first store or warehouse location</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {warehouses.map((warehouse) => (
            <Card key={warehouse.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mt-1">
                    <MapPin className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">{warehouse.name}</h3>
                      {warehouse.isDefault && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-500 mt-1">{warehouse.address}</p>
                    {warehouse.contact && (
                      <p className="text-sm text-gray-400 mt-1">Contact: {warehouse.contact}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenDialog(warehouse)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => handleDelete(warehouse)}
                    disabled={warehouse.isDefault || deletingId === warehouse.id}
                  >
                    {deletingId === warehouse.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? "Edit Location" : "Add Location"}</DialogTitle>
            <DialogDescription>
              {editingWarehouse ? "Update location details" : "Add a new warehouse or store location"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Location Name</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Downtown Store"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact Person</Label>
              <Input
                id="contact"
                value={formData.contact}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                placeholder="Name or Phone"
              />
            </div>

            <div className="flex items-center space-x-2 py-2">
              <Switch
                id="default"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
              />
              <Label htmlFor="default">Set as default location</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm() }}>
                Cancel
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Location
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
