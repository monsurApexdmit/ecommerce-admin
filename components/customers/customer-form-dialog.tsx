"use client"

import { useEffect, useState } from "react"
import { Briefcase, User, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { customerApi, type CustomerResponse } from "@/lib/customerApi"
import { useCustomer } from "@/contexts/customer-context"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Field, FieldLabel } from "@/components/ui/field"
import { FormField } from "@/components/common/FormField"
import { SectionTitle } from "@/components/common/SectionTitle"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type Group = "retail" | "wholesale" | "vip"
type Kind = "individual" | "business"

const empty = {
  type: "individual" as Kind,
  customerGroup: "retail" as Group,
  name: "", businessName: "", licenceBin: "",
  phone: "", email: "", birthday: "",
  address: "", district: "Dhaka", area: "", zipCode: "", country: "Bangladesh",
  creditLimit: "", openingBalance: "", storeCredit: "", notes: "",
  smsOptIn: true,
  status: "active" as "active" | "inactive",
}


interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Pass a customer to edit it; omit to add a new one */
  customer?: CustomerResponse | null
  prefillPhone?: string
  onSaved: (saved?: { id?: number }) => void
  onOpenExisting?: (phone: string) => void
}

export function CustomerFormDialog({ open, onOpenChange, customer, prefillPhone, onSaved, onOpenExisting }: Props) {
  const { refreshCustomers } = useCustomer()
  const { toast } = useToast()
  const [form, setForm] = useState(empty)
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dupe, setDupe] = useState<{ name: string; others: number } | null>(null)

  const editing = !!customer

  useEffect(() => {
    if (!open) return
    if (customer) {
      setForm({
        type: customer.type ?? "individual",
        customerGroup: customer.customerGroup ?? customer.customerType ?? "retail",
        name: customer.name ?? "", businessName: customer.businessName ?? "", licenceBin: customer.licenceBin ?? "",
        phone: customer.phone ?? "", email: customer.email ?? "", birthday: customer.birthday ? customer.birthday.slice(0, 10) : "",
        address: customer.address ?? "", district: customer.district ?? customer.city ?? "", area: customer.area ?? customer.state ?? "",
        zipCode: customer.zipCode ?? "", country: customer.country ?? "Bangladesh",
        creditLimit: customer.creditLimit ? String(customer.creditLimit) : "",
        openingBalance: customer.openingBalance ? String(customer.openingBalance) : "",
        storeCredit: customer.storeCredit ? String(customer.storeCredit) : "", notes: customer.notes ?? "",
        smsOptIn: customer.smsOptIn ?? true,
        status: customer.status ?? "active",
      })
      setTags(customer.tags ?? [])
      setShowMore(!!(customer.storeCredit || customer.notes || customer.openingBalance))
    } else {
      setForm({ ...empty, phone: prefillPhone ?? "" })
      setTags([])
      setShowMore(false)
    }
    setTagDraft("")
    setErrors({})
    setDupe(null)
  }, [open, customer, prefillPhone])

  // Warn when the phone number is already used by someone else
  useEffect(() => {
    const digits = form.phone.replace(/\D/g, "")
    if (!open || digits.length < 6) { setDupe(null); return }
    const t = setTimeout(() => {
      customerApi
        .getAll({ search: form.phone.trim(), limit: 5 })
        .then((res) => {
          const others = res.data.filter((c) => c.id !== customer?.id && (c.phone ?? "").replace(/\D/g, "") === digits)
          setDupe(others.length ? { name: others[0].name, others: others.length - 1 } : null)
        })
        .catch(() => setDupe(null))
    }, 350)
    return () => clearTimeout(t)
  }, [form.phone, open, customer?.id])

  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const addTag = (raw: string) => {
    const parts = raw.split(",").map((t) => t.trim()).filter(Boolean)
    if (!parts.length) return
    setTags((prev) => [...prev, ...parts.filter((t) => !prev.some((p) => p.toLowerCase() === t.toLowerCase()))])
    setTagDraft("")
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = "Name is required"
    if (form.type === "business" && !form.businessName.trim()) e.businessName = "Business name is required"
    const digits = form.phone.replace(/[\s+\-()]/g, "")
    if (!form.phone.trim()) e.phone = "Phone is required"
    else if (!/^\d{7,15}$/.test(digits)) e.phone = "Phone must be 7 to 15 digits"
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Enter a valid email"
    if (form.creditLimit && !(Number(form.creditLimit) >= 0)) e.creditLimit = "Must be 0 or more"
    if (form.openingBalance && !(Number(form.openingBalance) >= 0)) e.openingBalance = "Must be 0 or more"
    if (form.storeCredit && !(Number(form.storeCredit) >= 0)) e.storeCredit = "Must be 0 or more"
    if (form.birthday && form.birthday > new Date().toISOString().slice(0, 10)) e.birthday = "Birthday can't be in the future"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const save = async (addAnother: boolean) => {
    if (!validate()) {
      toast({ variant: "destructive", title: "Check the form", description: "Fix the highlighted fields" })
      return
    }
    setSaving(true)
    try {
      const biz = form.type === "business"
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        type: form.type,
        businessName: biz ? form.businessName.trim() : "",
        licenceBin: biz ? form.licenceBin.trim() : "",
        customerGroup: form.customerGroup,
        customerType: form.customerGroup,
        address: form.address.trim(), district: form.district.trim(), area: form.area.trim(),
        city: form.district.trim(), state: form.area.trim(),
        zipCode: form.zipCode.trim(), country: form.country.trim() || "Bangladesh",
        creditLimit: Number(form.creditLimit) || 0,
        openingBalance: Number(form.openingBalance) || 0,
        storeCredit: Number(form.storeCredit) || 0,
        birthday: form.birthday || null,
        tags,
        smsOptIn: form.smsOptIn,
        status: form.status,
        notes: form.notes.trim(),
      }
      let savedId: number | undefined
      if (customer) {
        await customerApi.update(customer.id, payload)
        savedId = customer.id
        toast({ title: "Customer updated", description: payload.name })
      } else {
        const res = await customerApi.create(payload)
        savedId = res.data?.id
        toast({ title: "Customer added", description: payload.name })
      }
      refreshCustomers().catch(() => {})
      onSaved({ id: savedId })
      if (addAnother && !customer) { setForm({ ...empty, type: form.type, customerGroup: form.customerGroup }); setTags([]); setErrors({}) }
      else onOpenChange(false)
    } catch (err: any) {
      const errs = err?.response?.data?.errors
      const first = errs ? (Object.values(errs)[0] as string[] | undefined)?.[0] : undefined
      toast({ variant: "destructive", title: "Could not save", description: first || err?.response?.data?.message || err?.message || "Please try again" })
    } finally {
      setSaving(false)
    }
  }

  const types: { value: Kind; title: string; sub: string; icon: typeof User }[] = [
    { value: "individual", title: "Individual", sub: "A person buying for themselves", icon: User },
    { value: "business", title: "Business", sub: "Shop, reseller or company", icon: Briefcase },
  ]
  const groups: { value: Group; label: string; note?: string }[] = [
    { value: "retail", label: "Retail" },
    { value: "wholesale", label: "Wholesale" },
    { value: "vip", label: "VIP", note: "5% auto discount" },
  ]
  const err = (k: string) => errors[k] || undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[720px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="px-6 py-4 text-left">
          <DialogTitle>{editing ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription>
            Only name and phone are required. You can fill in the rest later.
          </DialogDescription>
        </DialogHeader>
        <Separator />

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <ChoiceCardGroup value={form.type} onValueChange={(v) => set("type", v as Kind)} aria-label="Customer type" className="grid-cols-2 gap-2.5">
            {types.map((t) => (
              <ChoiceCard key={t.value} value={t.value} icon={<t.icon className="size-[18px]" aria-hidden />} title={t.title} description={t.sub} />
            ))}
          </ChoiceCardGroup>

          <fieldset>
            <SectionTitle as="legend" className="mb-2.5">Basic info</SectionTitle>
            <div className="grid grid-cols-2 gap-2.5">
              <FormField label={form.type === "business" ? "Contact person *" : "Full name *"} htmlFor="cf-name" error={err("name")}
                className={cn("min-w-0", form.type !== "business" && "col-span-2")}>
                <Input id="cf-name" aria-invalid={!!errors.name} placeholder="e.g. Rahima Akter" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
              </FormField>
              {form.type === "business" && (
                <FormField label="Business name *" htmlFor="cf-business" error={err("businessName")} className="min-w-0">
                  <Input id="cf-business" aria-invalid={!!errors.businessName} placeholder="e.g. Akter Traders" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
                </FormField>
              )}
              {form.type === "business" && (
                <FormField label="Trade licence / BIN" htmlFor="cf-bin" className="col-span-2 min-w-0">
                  <Input id="cf-bin" value={form.licenceBin} onChange={(e) => set("licenceBin", e.target.value)} />
                </FormField>
              )}
              <FormField
                label="Phone *" htmlFor="cf-phone" error={err("phone")} className="min-w-0"
                description={dupe ? (
                  <>
                    Already used by <strong>{dupe.name}</strong>{dupe.others > 0 ? ` and ${dupe.others} other${dupe.others === 1 ? "" : "s"}` : ""}.{" "}
                    {onOpenExisting && (
                      <Button type="button" variant="link" className="h-auto p-0" onClick={() => { onOpenChange(false); onOpenExisting(form.phone.trim()) }}>
                        Open existing customer
                      </Button>
                    )}
                  </>
                ) : undefined}
              >
                <Input id="cf-phone" aria-invalid={!!errors.phone} type="tel" placeholder="e.g. 01712-345678" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </FormField>
              <FormField label="Email" htmlFor="cf-email" error={err("email")} className="min-w-0">
                <Input id="cf-email" aria-invalid={!!errors.email} type="email" placeholder="name@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </FormField>
              <FormField label="Birthday" htmlFor="cf-birthday" error={err("birthday")} className="min-w-0">
                <Input id="cf-birthday" aria-invalid={!!errors.birthday} type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthday} onChange={(e) => set("birthday", e.target.value)} />
              </FormField>
              <FormField label="Status" htmlFor="cf-status" className="min-w-0">
                <Select value={form.status} onValueChange={(v) => set("status", v as "active" | "inactive")}>
                  <SelectTrigger id="cf-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive (kept for history)</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </fieldset>

          <fieldset>
            <SectionTitle as="legend" className="mb-2.5">Group, credit &amp; tags</SectionTitle>
            <ChoiceCardGroup value={form.customerGroup} onValueChange={(v) => set("customerGroup", v as Group)} aria-label="Customer group" className="grid-cols-3 gap-2.5">
              {groups.map((g) => (
                <ChoiceCard key={g.value} value={g.value} title={g.label} description={g.note} />
              ))}
            </ChoiceCardGroup>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <FormField label="Credit limit" htmlFor="cf-credit" error={err("creditLimit")} className="min-w-0">
                <Input id="cf-credit" aria-invalid={!!errors.creditLimit} type="number" min={0} step="0.01" placeholder="0.00" value={form.creditLimit} onChange={(e) => set("creditLimit", e.target.value)} />
              </FormField>
              <FormField label="Opening balance" htmlFor="cf-opening" error={err("openingBalance")} className="min-w-0">
                <Input id="cf-opening" aria-invalid={!!errors.openingBalance} type="number" min={0} step="0.01" placeholder="0.00" value={form.openingBalance} onChange={(e) => set("openingBalance", e.target.value)} />
              </FormField>
              <FormField label="Tags" htmlFor="cf-tags" className="col-span-2 min-w-0">
                <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5 shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1 pr-0.5">
                      {t}
                      <Button type="button" variant="ghost" size="icon" className="size-4" aria-label={`Remove tag ${t}`} onClick={() => setTags((p) => p.filter((x) => x !== t))}><X className="size-3" /></Button>
                    </Badge>
                  ))}
                  <Input id="cf-tags" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder={tags.length ? "" : "Type a tag, press Enter"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagDraft) }
                      else if (e.key === "Backspace" && !tagDraft && tags.length) setTags((p) => p.slice(0, -1))
                    }}
                    onBlur={() => addTag(tagDraft)}
                    className="h-auto min-w-[120px] flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 dark:bg-transparent" />
                </div>
              </FormField>
              <Field orientation="horizontal" className="col-span-2">
                <Checkbox id="cf-sms" checked={form.smsOptIn} onCheckedChange={(v) => set("smsOptIn", v === true)} />
                <FieldLabel htmlFor="cf-sms">Agreed to receive SMS offers</FieldLabel>
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <SectionTitle as="legend" className="mb-2.5">Address</SectionTitle>
            <div className="grid grid-cols-2 gap-2.5">
              <FormField label="Street address" htmlFor="cf-address" className="col-span-2 min-w-0">
                <Input id="cf-address" placeholder="House, road" value={form.address} onChange={(e) => set("address", e.target.value)} />
              </FormField>
              <FormField label="District" htmlFor="cf-district" className="min-w-0">
                <Input id="cf-district" value={form.district} onChange={(e) => set("district", e.target.value)} />
              </FormField>
              <FormField label="Area" htmlFor="cf-area" className="min-w-0">
                <Input id="cf-area" value={form.area} onChange={(e) => set("area", e.target.value)} />
              </FormField>
              <FormField label="Postcode" htmlFor="cf-zip" className="min-w-0">
                <Input id="cf-zip" placeholder="1209" value={form.zipCode} onChange={(e) => set("zipCode", e.target.value)} />
              </FormField>
              <FormField label="Country" htmlFor="cf-country" className="min-w-0">
                <Input id="cf-country" value={form.country} onChange={(e) => set("country", e.target.value)} />
              </FormField>
            </div>
          </fieldset>

          <div>
            <Button type="button" variant="link" className="h-auto p-0" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}>
              {showMore ? "Hide" : "More options"} — store credit and notes
            </Button>
            {showMore && (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <FormField label="Store credit" htmlFor="cf-store-credit" error={err("storeCredit")} className="min-w-0">
                  <Input id="cf-store-credit" aria-invalid={!!errors.storeCredit} type="number" min={0} step="0.01" placeholder="0.00" value={form.storeCredit} onChange={(e) => set("storeCredit", e.target.value)} />
                </FormField>
                <FormField label="Notes" htmlFor="cf-notes" className="col-span-2 min-w-0">
                  <Textarea id="cf-notes" rows={2} placeholder="Measurements, preferences…" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
                </FormField>
              </div>
            )}
          </div>
        </div>

        <Separator />
        <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!editing && (
            <Button type="button" variant="outline" onClick={() => save(true)} disabled={saving}>
              Save &amp; add another
            </Button>
          )}
          <Button type="button" onClick={() => save(false)} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Save customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
