"use client"

import { useEffect, useState } from "react"
import { platformApi, PlatformPlan } from "@/lib/platformApi"
import {
  Loader, AlertCircle, Plus, Check, X, Zap, ChevronDown, ChevronUp,
  Pencil, ToggleLeft, ToggleRight,
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type FormData = {
  name: string
  description: string
  price: string
  maxUsers: string
  maxProducts: string
  maxBranches: string
  features: string[]
  isFeatured: boolean
  isActive: boolean
}

const EMPTY_FORM: FormData = {
  name: "", description: "", price: "", maxUsers: "", maxProducts: "",
  maxBranches: "", features: [], isFeatured: false, isActive: true,
}

function planToForm(p: PlatformPlan): FormData {
  return {
    name: p.name,
    description: p.description ?? "",
    price: String(p.price),
    maxUsers: String(p.maxUsers),
    maxProducts: String(p.maxProducts),
    maxBranches: String(p.maxBranches),
    features: Array.isArray(p.features) ? p.features : [],
    isFeatured: p.isFeatured,
    isActive: p.isActive,
  }
}

function formToPayload(f: FormData) {
  return {
    name: f.name,
    description: f.description,
    price: parseFloat(f.price) || 0,
    maxUsers: parseInt(f.maxUsers) || 0,
    maxProducts: parseInt(f.maxProducts) || 0,
    maxBranches: parseInt(f.maxBranches) || 0,
    features: f.features,
    isFeatured: f.isFeatured,
    isActive: f.isActive,
  }
}

function PlanFormDialog({
  open, title, initial, saving, onSave, onClose,
}: {
  open: boolean
  title: string
  initial: FormData
  saving: boolean
  onSave: (d: FormData) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<FormData>(initial)
  const [newFeature, setNewFeature] = useState("")
  const set = (k: keyof FormData, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  useEffect(() => { setForm(initial); setNewFeature("") }, [open])

  const addFeature = () => {
    if (!newFeature.trim()) return
    set("features", [...form.features, newFeature.trim()])
    setNewFeature("")
  }

  const removeFeature = (i: number) =>
    set("features", form.features.filter((_, idx) => idx !== i))

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Update plan details, pricing, limits, and features</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g., Professional" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($/mo) *</label>
              <Input type="number" min="0" step="0.01" value={form.price} onChange={e => set("price", e.target.value)} placeholder="e.g., 49.00" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Short description of the plan"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Users</label>
              <Input type="number" min="1" value={form.maxUsers} onChange={e => set("maxUsers", e.target.value)} placeholder="999999 = Unlimited" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Products</label>
              <Input type="number" min="1" value={form.maxProducts} onChange={e => set("maxProducts", e.target.value)} placeholder="999999 = Unlimited" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Branches</label>
              <Input type="number" min="1" value={form.maxBranches} onChange={e => set("maxBranches", e.target.value)} placeholder="999999 = Unlimited" />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => set("isActive", e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
              Active (visible to users)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isFeatured} onChange={e => set("isFeatured", e.target.checked)} className="w-4 h-4 accent-emerald-600 rounded" />
              Featured (Most Popular badge)
            </label>
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
            <div className="space-y-2 mb-3">
              {form.features.map((f, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                  <span className="text-sm text-gray-700">{f}</span>
                  <button onClick={() => removeFeature(i)} className="text-red-500 hover:text-red-700">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newFeature}
                onChange={e => setNewFeature(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addFeature())}
                placeholder="Add feature…"
              />
              <Button onClick={addFeature} variant="outline" className="whitespace-nowrap">Add</Button>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              onClick={() => onSave(form)}
              disabled={saving || !form.name || !form.price}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <><Loader className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : <><Check className="w-4 h-4 mr-2" /> Save Plan</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PlatformPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expandedPlans, setExpandedPlans] = useState<Set<number>>(new Set())

  const [showCreate, setShowCreate] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PlatformPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  useEffect(() => {
    platformApi.listPlans()
      .then(setPlans)
      .catch(() => setError("Failed to load plans"))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (form: FormData) => {
    setSaving(true)
    try {
      const plan = await platformApi.createPlan(formToPayload(form) as any)
      setPlans(prev => [...prev, plan])
      setShowCreate(false)
    } catch {
      alert("Failed to create plan")
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (form: FormData) => {
    if (!editingPlan) return
    setSaving(true)
    try {
      const plan = await platformApi.updatePlan(editingPlan.id, formToPayload(form))
      setPlans(prev => prev.map(p => p.id === editingPlan.id ? plan : p))
      setEditingPlan(null)
    } catch {
      alert("Failed to update plan")
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (plan: PlatformPlan) => {
    setTogglingId(plan.id)
    try {
      await platformApi.togglePlanStatus(plan.id)
      setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, isActive: !p.isActive } : p))
    } catch {
      alert("Failed to toggle plan")
    } finally {
      setTogglingId(null)
    }
  }

  const toggleExpand = (id: number) => {
    setExpandedPlans(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader className="w-6 h-6 animate-spin text-emerald-600" />
    </div>
  )

  if (error) return (
    <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 rounded-xl">
      <AlertCircle className="w-5 h-5" /> {error}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 pb-20">
      {/* Hero */}
      <div className="relative overflow-hidden pt-12 pb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-teal-400/10 -z-10" />
        <div className="max-w-4xl mx-auto text-center px-4">
          <div className="inline-block px-4 py-2 bg-emerald-100 rounded-full mb-3">
            <p className="text-emerald-700 text-xs sm:text-sm font-semibold">💎 Subscription Plans</p>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-3">
            Manage Subscription Plans
          </h1>
          <p className="text-base sm:text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
            Create and manage the plans available to companies on signup.
          </p>
          <button
            onClick={() => { setShowCreate(true); setEditingPlan(null) }}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors shadow"
          >
            <Plus className="w-4 h-4" /> New Plan
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto px-4 space-y-4">
        {plans.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
            <p className="text-yellow-800 text-lg font-semibold">No plans yet</p>
            <p className="text-yellow-700 mt-2">Click "New Plan" to create the first one.</p>
          </div>
        )}

        {plans.map(plan => {
          const isExpanded = expandedPlans.has(plan.id)
          const features = Array.isArray(plan.features) ? plan.features : []
          const visibleFeatures = isExpanded ? features : features.slice(0, 5)

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-xl border p-6 transition-all ${
                plan.isFeatured ? "border-emerald-300 shadow-md" : "border-gray-200"
              } ${!plan.isActive ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  {/* Name + badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-gray-900 text-xl">{plan.name}</h3>
                    {plan.isFeatured && (
                      <span className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium">
                        <Zap className="w-3 h-3" /> Most Popular
                      </span>
                    )}
                    {!plan.isActive && (
                      <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>

                  {plan.description && (
                    <p className="text-sm text-gray-500 mb-3">{plan.description}</p>
                  )}

                  {/* Price + limits */}
                  <div className="flex flex-wrap gap-5 text-sm text-gray-600 mb-3 items-baseline">
                    <span className="font-bold text-2xl text-gray-900">
                      ${plan.price}<span className="text-sm font-normal text-gray-400">/mo</span>
                    </span>
                    <span>👥 {plan.maxUsers === 999999 || !plan.maxUsers ? "∞" : plan.maxUsers} users</span>
                    <span>📦 {plan.maxProducts === 999999 || !plan.maxProducts ? "∞" : plan.maxProducts?.toLocaleString()} products</span>
                    <span>🏪 {plan.maxBranches === 999999 || !plan.maxBranches ? "∞" : plan.maxBranches} branches</span>
                  </div>

                  {/* Features */}
                  {features.length > 0 && (
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        {visibleFeatures.map((f, i) => (
                          <span key={i} className="flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3 text-emerald-500" /> {f}
                          </span>
                        ))}
                      </div>
                      {features.length > 5 && (
                        <button
                          onClick={() => toggleExpand(plan.id)}
                          className="mt-2 text-emerald-600 text-xs font-medium flex items-center gap-1 hover:underline"
                        >
                          {isExpanded
                            ? <><ChevronUp size={12} /> Show less</>
                            : <><ChevronDown size={12} /> +{features.length - 5} more</>
                          }
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <button
                    onClick={() => setEditingPlan(plan)}
                    className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-400 px-3 py-2 rounded-lg transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleToggle(plan)}
                    disabled={togglingId === plan.id}
                    className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${
                      plan.isActive
                        ? "text-red-600 border-red-200 hover:bg-red-50"
                        : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    {togglingId === plan.id
                      ? <Loader className="w-3.5 h-3.5 animate-spin" />
                      : plan.isActive
                        ? <ToggleRight className="w-4 h-4" />
                        : <ToggleLeft className="w-4 h-4" />
                    }
                    {plan.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Create dialog */}
      <PlanFormDialog
        open={showCreate}
        title="Create New Plan"
        initial={EMPTY_FORM}
        saving={saving}
        onSave={handleCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* Edit dialog */}
      <PlanFormDialog
        open={!!editingPlan}
        title={`Edit Plan: ${editingPlan?.name ?? ""}`}
        initial={editingPlan ? planToForm(editingPlan) : EMPTY_FORM}
        saving={saving}
        onSave={handleUpdate}
        onClose={() => setEditingPlan(null)}
      />
    </div>
  )
}
