"use client"

import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { platformApi, PlatformPlan } from "@/lib/platformApi"
import {
  AlertCircle, Plus, Check, X, Zap, ChevronDown, ChevronUp,
  Pencil, ToggleLeft, ToggleRight,
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { WithTooltip } from "@/components/common/WithTooltip"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation(["auth", "common"])
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
          <DialogDescription>{t("auth:platform.plans.formDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t("auth:platform.plans.name")} htmlFor="plan-name">
              <Input id="plan-name" value={form.name} onChange={e => set("name", e.target.value)} placeholder={t("auth:platform.plans.namePlaceholder")} />
            </FormField>
            <FormField label={t("auth:platform.plans.price")} htmlFor="plan-price">
              <Input id="plan-price" type="number" min="0" step="0.01" value={form.price} onChange={e => set("price", e.target.value)} placeholder={t("auth:platform.plans.pricePlaceholder")} />
            </FormField>
            <FormField label={t("common:fields.description")} htmlFor="plan-description" className="sm:col-span-2">
              <Textarea
                id="plan-description"
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder={t("auth:platform.plans.descriptionPlaceholder")}
                rows={2}
                className="w-full"
              />
            </FormField>
            <FormField label={t("auth:platform.plans.maxUsers")} htmlFor="plan-max-users">
              <Input id="plan-max-users" type="number" min="1" value={form.maxUsers} onChange={e => set("maxUsers", e.target.value)} placeholder="999999 = Unlimited" />
            </FormField>
            <FormField label={t("auth:platform.plans.maxProducts")} htmlFor="plan-max-products">
              <Input id="plan-max-products" type="number" min="1" value={form.maxProducts} onChange={e => set("maxProducts", e.target.value)} placeholder="999999 = Unlimited" />
            </FormField>
            <FormField label={t("auth:platform.plans.maxBranches")} htmlFor="plan-max-branches">
              <Input id="plan-max-branches" type="number" min="1" value={form.maxBranches} onChange={e => set("maxBranches", e.target.value)} placeholder="999999 = Unlimited" />
            </FormField>
          </div>

          <div className="flex items-center gap-6">
            <Label className="cursor-pointer">
              <Checkbox checked={form.isActive} onCheckedChange={v => set("isActive", v === true)} />
              {t("auth:platform.plans.activeLabel")}
            </Label>
            <Label className="cursor-pointer">
              <Checkbox checked={form.isFeatured} onCheckedChange={v => set("isFeatured", v === true)} />
              {t("auth:platform.plans.featuredLabel")}
            </Label>
          </div>

          {/* Features */}
          <FormField label={t("auth:platform.plans.features")}>
            <div className="space-y-2 mb-1">
              {form.features.map((f, i) => (
                <Item key={i} variant="muted" size="sm" className="py-1 pr-1">
                  <ItemContent>
                    <ItemTitle className="font-normal">{f}</ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <WithTooltip content={t("auth:platform.plans.removeFeature")}><Button variant="ghost" size="icon-sm" onClick={() => removeFeature(i)} aria-label={t("auth:platform.plans.removeFeature")}>
                      <X size={15} />
                    </Button></WithTooltip>
                  </ItemActions>
                </Item>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newFeature}
                onChange={e => setNewFeature(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addFeature())}
                placeholder={t("auth:platform.plans.addFeature")}
              />
              <Button onClick={addFeature} variant="outline" className="whitespace-nowrap">{t("common:actions.add")}</Button>
            </div>
          </FormField>

          <Separator />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose} disabled={saving}>{t("common:actions.cancel")}</Button>
            <Button
              onClick={() => onSave(form)}
              disabled={saving || !form.name || !form.price}
            >
              {saving ? <><Spinner /> {t("common:actions.saving")}</> : <><Check className="w-4 h-4" /> {t("auth:platform.plans.save")}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function PlansPage() {
  const { t } = useTranslation(["auth", "common"])
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
      .catch(() => setError(t("auth:platform.plans.loadFailed")))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (form: FormData) => {
    setSaving(true)
    try {
      const plan = await platformApi.createPlan(formToPayload(form) as any)
      setPlans(prev => [...prev, plan])
      setShowCreate(false)
    } catch {
      alert(t("auth:platform.plans.createFailed"))
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
      alert(t("auth:platform.plans.updateFailed"))
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
      alert(t("auth:platform.plans.toggleFailed"))
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
      <Spinner className="size-6" />
    </div>
  )

  if (error) return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 pb-20">
      {/* Hero */}
      <div className="relative overflow-hidden pt-12 pb-8">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/10 to-teal-400/10 -z-10" />
        <div className="max-w-4xl mx-auto text-center px-4">
          <Badge variant="secondary" className="mb-3">💎 {t("auth:platform.plans.badge")}</Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3">
            {t("auth:platform.plans.title")}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            {t("auth:platform.plans.subtitle")}
          </p>
          <Button
            onClick={() => { setShowCreate(true); setEditingPlan(null) }}
          >
            <Plus className="w-4 h-4" /> {t("auth:platform.plans.newPlan")}
          </Button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto px-4 space-y-4">
        {plans.length === 0 && (
          <EmptyState bordered icon={AlertCircle} title={t("auth:platform.plans.emptyTitle")} description={t("auth:platform.plans.emptyDesc")} />
        )}

        {plans.map(plan => {
          const isExpanded = expandedPlans.has(plan.id)
          const features = Array.isArray(plan.features) ? plan.features : []
          const visibleFeatures = isExpanded ? features : features.slice(0, 5)

          return (
            <Card
              key={plan.id}
              className={cn("p-6", plan.isFeatured && "border-primary ring-1 ring-primary", !plan.isActive && "opacity-60")}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  {/* Name + badges */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-xl">{plan.name}</h3>
                    {plan.isFeatured && (
                      <Badge>
                        <Zap /> {t("auth:platform.plans.mostPopular")}
                      </Badge>
                    )}
                    {!plan.isActive && (
                      <Badge variant="outline">{t("common:status.inactive")}</Badge>
                    )}
                  </div>

                  {plan.description && (
                    <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>
                  )}

                  {/* Price + limits */}
                  <div className="flex flex-wrap gap-5 text-sm text-muted-foreground mb-3 items-baseline">
                    <span className="font-bold text-2xl text-foreground">
                      ${plan.price}<span className="text-sm font-normal text-muted-foreground">{t("auth:platform.plans.perMonth")}</span>
                    </span>
                    <span>👥 {plan.maxUsers === 999999 || !plan.maxUsers ? t("auth:platform.plans.unlimitedUsers") : t("auth:platform.plans.users", { count: plan.maxUsers })}</span>
                    <span>📦 {plan.maxProducts === 999999 || !plan.maxProducts ? t("auth:platform.plans.unlimitedProducts") : t("auth:platform.plans.products", { count: plan.maxProducts })}</span>
                    <span>🏪 {plan.maxBranches === 999999 || !plan.maxBranches ? t("auth:platform.plans.unlimitedBranches") : t("auth:platform.plans.branches", { count: plan.maxBranches })}</span>
                  </div>

                  {/* Features */}
                  {features.length > 0 && (
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        {visibleFeatures.map((f, i) => (
                          <Badge key={i} variant="outline">
                            <Check /> {f}
                          </Badge>
                        ))}
                      </div>
                      {features.length > 5 && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => toggleExpand(plan.id)}
                          className="mt-2"
                        >
                          {isExpanded
                            ? <><ChevronUp size={12} /> {t("auth:platform.plans.showLess")}</>
                            : <><ChevronDown size={12} /> {t("auth:platform.plans.more", { count: features.length - 5 })}</>
                          }
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => setEditingPlan(plan)}
                  >
                    <Pencil className="w-3.5 h-3.5" /> {t("common:actions.edit")}
                  </Button>
                  <Button
                    variant={plan.isActive ? "destructive" : "outline"}
                    onClick={() => handleToggle(plan)}
                    disabled={togglingId === plan.id}
                  >
                    {togglingId === plan.id
                      ? <Spinner />
                      : plan.isActive
                        ? <ToggleRight className="w-4 h-4" />
                        : <ToggleLeft className="w-4 h-4" />
                    }
                    {plan.isActive ? t("auth:platform.companies.deactivate") : t("auth:platform.companies.activate")}
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Create dialog */}
      <PlanFormDialog
        open={showCreate}
        title={t("auth:platform.plans.createTitle")}
        initial={EMPTY_FORM}
        saving={saving}
        onSave={handleCreate}
        onClose={() => setShowCreate(false)}
      />

      {/* Edit dialog */}
      <PlanFormDialog
        open={!!editingPlan}
        title={t("auth:platform.plans.editTitle", { name: editingPlan?.name ?? "" })}
        initial={editingPlan ? planToForm(editingPlan) : EMPTY_FORM}
        saving={saving}
        onSave={handleUpdate}
        onClose={() => setEditingPlan(null)}
      />
    </div>
  )
}
