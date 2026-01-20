"use client"

import { useState } from "react"
import { Plus, Edit2, Trash2, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { useWarehouse, type Warehouse } from "@/contexts/warehouse-context"
import { Badge } from "@/components/ui/badge"

export default function LocationsPage() {
  const { warehouses, addWarehouse, updateWarehouse, deleteWarehouse } = useWarehouse()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contact: "",
    isDefault: false
  })

  const resetForm = () => {
    setFormData({ name: "", address: "", contact: "", isDefault: false })
    setEditingId(null)
  }

  const handleOpenDialog = (warehouse?: Warehouse) => {
    if (warehouse) {
      setEditingId(warehouse.id)
      setFormData({
        name: warehouse.name,
        address: warehouse.address,
        contact: warehouse.contact,
        isDefault: warehouse.isDefault
      })
    } else {
      resetForm()
    }
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (editingId) {
      updateWarehouse({
        id: editingId,
        ...formData
      })
    } else {
      addWarehouse(formData)
    }
    
    setIsDialogOpen(false)
    resetForm()
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
                  <p className="text-sm text-gray-400 mt-1">Contact: {warehouse.contact}</p>
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
                  onClick={() => deleteWarehouse(warehouse.id)}
                  disabled={warehouse.isDefault}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Location" : "Add Location"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update location details" : "Add a new warehouse or store location"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Location Name</Label>
              <Input 
                id="name" 
                required 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. Downtown Store" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input 
                id="address" 
                required 
                value={formData.address} 
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Full address" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact">Contact Person</Label>
              <Input 
                id="contact" 
                required 
                value={formData.contact} 
                onChange={(e) => setFormData({...formData, contact: e.target.value})}
                placeholder="Name or Phone" 
              />
            </div>
            
            <div className="flex items-center space-x-2 py-2">
              <Switch 
                id="default" 
                checked={formData.isDefault} 
                onCheckedChange={(checked) => setFormData({...formData, isDefault: checked})} 
              />
              <Label htmlFor="default">Set as default location</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">Save Location</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
