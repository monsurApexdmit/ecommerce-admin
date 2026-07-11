"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Plus, Edit2, Trash2, X, UserCheck } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { tailorApi, TailorDorji } from "@/lib/tailorApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { toast } from "sonner"

const EMPTY_FORM = {
  name: "", phone: "", address: "",
  commission_type: "fixed" as "fixed" | "percentage",
  commission_value: 0, status: "active" as "active" | "inactive", notes: "",
}
type DorjiForm = typeof EMPTY_FORM

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (val: string) => {
    const trimmed = val.trim().replace(/,$/, "").trim()
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed])
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  const removeTag = (tag: string) => onChange(tags.filter(t => t !== tag))

  return (
    <div
      className="min-h-9 flex flex-wrap gap-1.5 border border-gray-200 rounded-md px-2 py-1.5 cursor-text focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full"
        >
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="hover:text-purple-900">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input) }}
        placeholder={tags.length === 0 ? "Type and press Enter or comma..." : ""}
        className="text-sm outline-none flex-1 min-w-20 bg-transparent"
      />
    </div>
  )
}

export default function TailorDorjisPage() {
  const { canRead, canWrite, canDelete } = useSaasAuth()

  const [dorjis, setDorjis] = useState<TailorDorji[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [modalOpen, setModalOpen] = useState(false)
  const [editingDorji, setEditingDorji] = useState<TailorDorji | null>(null)
  const [form, setForm] = useState<DorjiForm>(EMPTY_FORM)
  const [speciality, setSpeciality] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<TailorDorji | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (!canRead("TailorDorji")) return <AccessDenied />

  const load = () => {
    setLoading(true)
    tailorApi.getDorjis({ limit: 100 })
      .then(r => setDorjis(r.data?.data ?? r.data ?? []))
      .catch(() => toast.error("Failed to load dorjis"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditingDorji(null)
    setForm(EMPTY_FORM)
    setSpeciality([])
    setModalOpen(true)
  }

  const openEdit = (d: TailorDorji) => {
    setEditingDorji(d)
    setForm({
      name: d.name,
      phone: d.phone,
      address: d.address ?? "",
      commission_type: d.commissionType,
      commission_value: d.commissionValue,
      status: d.status,
      notes: d.notes ?? "",
    })
    setSpeciality(d.speciality ?? [])
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name required"); return }
    if (!form.phone.trim()) { toast.error("Phone required"); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address || undefined,
        speciality,
        commissionType: form.commission_type,
        commissionValue: form.commission_value,
        status: form.status,
        notes: form.notes || undefined,
      }
      if (editingDorji) {
        await tailorApi.updateDorji(editingDorji.id, payload)
        toast.success("Dorji updated")
      } else {
        await tailorApi.createDorji(payload)
        toast.success("Dorji created")
      }
      setModalOpen(false)
      load()
    } catch {
      toast.error("Failed to save dorji")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await tailorApi.deleteDorji(deleteTarget.id)
      toast.success("Dorji deleted")
      setDeleteTarget(null)
      load()
    } catch {
      toast.error("Failed to delete dorji")
    } finally {
      setDeleting(false)
    }
  }

  const setField = <K extends keyof DorjiForm>(k: K, v: DorjiForm[K]) => setForm(f => ({ ...f, [k]: v }))

  const filtered = dorjis.filter(d =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.phone.includes(search)
  )

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Dorjis</h1>
          <p className="text-sm text-gray-500">{dorjis.length} total</p>
        </div>
        {canWrite("TailorDorji") && (
          <Button className="bg-purple-600 hover:bg-purple-700 gap-2" onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add Dorji
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name or phone..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Speciality</th>
                <th className="px-4 py-3">Commission</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Active Orders</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <UserCheck className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-gray-400">No dorjis found</p>
                  </td>
                </tr>
              ) : filtered.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{d.name}</td>
                  <td className="px-4 py-3 text-gray-500">{d.phone}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-32 truncate">{d.address ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(d.speciality ?? []).length === 0 ? (
                        <span className="text-gray-400">—</span>
                      ) : (d.speciality ?? []).map(s => (
                        <Badge key={s} className="bg-purple-100 text-purple-700 text-xs">{s}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {d.commissionType === "percentage" ? `${d.commissionValue}%` : `৳${d.commissionValue}`}
                    <span className="text-gray-400 ml-1 text-xs">({d.commissionType})</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={d.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                      {d.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {d.activeOrders != null ? (
                      <Badge className={d.activeOrders > 0 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-400"}>
                        {d.activeOrders}
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {canWrite("TailorDorji") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {canDelete("TailorDorji") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(d)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── ADD / EDIT MODAL ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDorji ? "Edit Dorji" : "Add Dorji"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Name *</Label>
                <Input placeholder="Full name" value={form.name} onChange={e => setField("name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Phone *</Label>
                <Input placeholder="Phone number" value={form.phone} onChange={e => setField("phone", e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Address</Label>
              <Input placeholder="Address (optional)" value={form.address} onChange={e => setField("address", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Speciality</Label>
              <TagInput tags={speciality} onChange={setSpeciality} />
              <p className="text-[10px] text-gray-400 mt-1">Press Enter or comma to add a tag</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Commission Type</Label>
                <Select value={form.commission_type} onValueChange={v => setField("commission_type", v as "fixed" | "percentage")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">
                  Commission Value {form.commission_type === "percentage" ? "(%)" : "(amount)"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.commission_value}
                  onChange={e => setField("commission_value", parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
              <Select value={form.status} onValueChange={v => setField("status", v as "active" | "inactive")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Notes</Label>
              <Input placeholder="Optional notes..." value={form.notes} onChange={e => setField("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingDorji ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE CONFIRM ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dorji</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
