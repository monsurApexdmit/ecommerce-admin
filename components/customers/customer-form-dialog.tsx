"use client"

import { useEffect, useState } from "react"
import { Briefcase, User, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { customerApi, type CustomerResponse } from "@/lib/customerApi"
import { useCustomer } from "@/contexts/customer-context"
import { Checkbox } from "@/components/ui/checkbox"
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

const legend = "mb-2.5 text-[13px] font-bold uppercase tracking-[0.06em] text-dash-muted"
const label = "flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold"
const input =
  "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal text-dash-ink outline-none placeholder:text-dash-muted focus-visible:border-dash-accent"

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
  const err = (k: string) => errors[k] ? <span className="text-xs font-normal text-dash-danger">{errors[k]}</span> : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[720px] flex-col gap-0 overflow-hidden rounded-[18px] border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[720px]">
        <DialogHeader className="border-b border-dash-border px-6 py-[18px] text-left">
          <DialogTitle className="font-dash-display text-[22px] font-bold">{editing ? "Edit customer" : "Add customer"}</DialogTitle>
          <DialogDescription className="text-[13px] text-dash-muted">
            Only name and phone are required. You can fill in the rest later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <div role="radiogroup" aria-label="Customer type" className="grid grid-cols-2 gap-2.5">
            {types.map((t) => {
              const on = form.type === t.value
              return (
                <button key={t.value} type="button" role="radio" aria-checked={on} onClick={() => set("type", t.value)}
                  className={cn("flex min-h-[64px] items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left",
                    on ? "border-dash-accent bg-dash-accent-soft/50" : "border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", on ? "bg-dash-accent text-white" : "bg-dash-neutral-soft text-dash-neutral-fg")}>
                    <t.icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{t.title}</span>
                    <span className="text-xs text-dash-muted">{t.sub}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <fieldset>
            <legend className={legend}>Basic info</legend>
            <div className="grid grid-cols-2 gap-2.5">
              <label className={cn(label, form.type === "business" ? "" : "col-span-2")}>{form.type === "business" ? "Contact person *" : "Full name *"}
                <input className={cn(input, errors.name && "border-dash-danger")} placeholder="e.g. Rahima Akter" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
                {err("name")}
              </label>
              {form.type === "business" && (
                <label className={label}>Business name *
                  <input className={cn(input, errors.businessName && "border-dash-danger")} placeholder="e.g. Akter Traders" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
                  {err("businessName")}
                </label>
              )}
              {form.type === "business" && (
                <label className={cn(label, "col-span-2")}>Trade licence / BIN
                  <input className={input} value={form.licenceBin} onChange={(e) => set("licenceBin", e.target.value)} />
                </label>
              )}
              <label className={label}>Phone *
                <input className={cn(input, (dupe || errors.phone) && "border-amber-500")} type="tel" placeholder="e.g. 01712-345678" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                {err("phone")}
                {dupe && (
                  <span className="text-xs font-normal text-dash-warn-fg">
                    Already used by <strong>{dupe.name}</strong>{dupe.others > 0 ? ` and ${dupe.others} other${dupe.others === 1 ? "" : "s"}` : ""}.{" "}
                    {onOpenExisting && (
                      <button type="button" className="font-semibold underline" onClick={() => { onOpenChange(false); onOpenExisting(form.phone.trim()) }}>
                        Open existing customer
                      </button>
                    )}
                  </span>
                )}
              </label>
              <label className={label}>Email
                <input className={cn(input, errors.email && "border-dash-danger")} type="email" placeholder="name@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
                {err("email")}
              </label>
              <label className={label}>Birthday
                <input className={cn(input, errors.birthday && "border-dash-danger")} type="date" max={new Date().toISOString().slice(0, 10)} value={form.birthday} onChange={(e) => set("birthday", e.target.value)} />
                {err("birthday")}
              </label>
              <label className={label}>Status
                <select className={input} value={form.status} onChange={(e) => set("status", e.target.value as "active" | "inactive")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive (kept for history)</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className={legend}>Group, credit &amp; tags</legend>
            <div role="radiogroup" aria-label="Customer group" className="grid grid-cols-3 gap-2.5">
              {groups.map((g) => {
                const on = form.customerGroup === g.value
                return (
                  <button key={g.value} type="button" role="radio" aria-checked={on} onClick={() => set("customerGroup", g.value)}
                    className={cn("flex min-h-[48px] flex-col items-start justify-center rounded-xl border-2 px-3 py-1.5 text-left",
                      on ? "border-dash-accent bg-dash-accent-soft/50" : "border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>
                    <span className="text-sm font-semibold">{g.label}</span>
                    {g.note && <span className="text-xs text-dash-muted">{g.note}</span>}
                  </button>
                )
              })}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <label className={label}>Credit limit
                <input className={cn(input, errors.creditLimit && "border-dash-danger")} type="number" min={0} step="0.01" placeholder="0.00" value={form.creditLimit} onChange={(e) => set("creditLimit", e.target.value)} />
                {err("creditLimit")}
              </label>
              <label className={label}>Opening balance
                <input className={cn(input, errors.openingBalance && "border-dash-danger")} type="number" min={0} step="0.01" placeholder="0.00" value={form.openingBalance} onChange={(e) => set("openingBalance", e.target.value)} />
                {err("openingBalance")}
              </label>
              <div className={cn(label, "col-span-2")}>
                Tags
                <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-[10px] border border-dash-border bg-dash-card px-2 py-1.5 focus-within:border-dash-accent">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-md bg-dash-accent-soft px-2 py-0.5 text-xs font-semibold text-dash-accent-fg">
                      {t}
                      <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags((p) => p.filter((x) => x !== t))}><X className="size-3" /></button>
                    </span>
                  ))}
                  <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder={tags.length ? "" : "Type a tag, press Enter"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagDraft) }
                      else if (e.key === "Backspace" && !tagDraft && tags.length) setTags((p) => p.slice(0, -1))
                    }}
                    onBlur={() => addTag(tagDraft)}
                    className="min-w-[120px] flex-1 border-0 bg-transparent text-sm font-normal outline-none placeholder:text-dash-muted" />
                </div>
              </div>
              <label className="col-span-2 flex items-center gap-2 text-[13px] font-semibold">
                <Checkbox checked={form.smsOptIn} onCheckedChange={(v) => set("smsOptIn", v === true)} />
                Agreed to receive SMS offers
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className={legend}>Address</legend>
            <div className="grid grid-cols-2 gap-2.5">
              <label className={cn(label, "col-span-2")}>Street address
                <input className={input} placeholder="House, road" value={form.address} onChange={(e) => set("address", e.target.value)} />
              </label>
              <label className={label}>District
                <input className={input} value={form.district} onChange={(e) => set("district", e.target.value)} />
              </label>
              <label className={label}>Area
                <input className={input} value={form.area} onChange={(e) => set("area", e.target.value)} />
              </label>
              <label className={label}>Postcode
                <input className={input} placeholder="1209" value={form.zipCode} onChange={(e) => set("zipCode", e.target.value)} />
              </label>
              <label className={label}>Country
                <input className={input} value={form.country} onChange={(e) => set("country", e.target.value)} />
              </label>
            </div>
          </fieldset>

          <div>
            <button type="button" aria-expanded={showMore} onClick={() => setShowMore((v) => !v)}
              className="text-[13px] font-semibold text-dash-accent hover:underline">
              {showMore ? "Hide" : "More options"} — store credit and notes
            </button>
            {showMore && (
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <label className={label}>Store credit
                  <input className={cn(input, errors.storeCredit && "border-dash-danger")} type="number" min={0} step="0.01" placeholder="0.00" value={form.storeCredit} onChange={(e) => set("storeCredit", e.target.value)} />
                  {err("storeCredit")}
                </label>
                <label className={cn(label, "col-span-2")}>Notes
                  <textarea rows={2} placeholder="Measurements, preferences…" value={form.notes} onChange={(e) => set("notes", e.target.value)}
                    className="resize-y rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm font-normal outline-none placeholder:text-dash-muted focus-visible:border-dash-accent" />
                </label>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 border-t border-dash-border px-6 py-4">
          <button type="button" onClick={() => onOpenChange(false)}
            className="h-12 rounded-xl border border-dash-border bg-dash-card px-[18px] text-sm font-semibold hover:bg-dash-neutral-soft">Cancel</button>
          {!editing && (
            <button type="button" onClick={() => save(true)} disabled={saving}
              className="h-12 rounded-xl border border-dash-border bg-dash-card px-[18px] text-sm font-semibold hover:bg-dash-neutral-soft disabled:opacity-40">
              Save &amp; add another
            </button>
          )}
          <button type="button" onClick={() => save(false)} disabled={saving}
            className="h-12 rounded-xl bg-dash-accent px-[22px] text-[15px] font-bold text-white disabled:opacity-40">
            {saving ? "Saving…" : editing ? "Save changes" : "Save customer"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
