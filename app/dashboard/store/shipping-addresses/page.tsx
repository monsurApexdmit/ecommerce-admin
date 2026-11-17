"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ParseKeys, TFunction } from "i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import shippingAddressApi, { type AddressType, type ShippingAddressResponse } from "@/lib/shippingAddressApi"
import { customerApi, type CustomerResponse } from "@/lib/customerApi"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/common/PageHeader"
import { FormField } from "@/components/common/FormField"
import { Toolbar } from "@/components/common/Toolbar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { EmptyState } from "@/components/common/EmptyState"
import { WithTooltip } from "@/components/common/WithTooltip"

const TYPE_LABEL: Record<string, ParseKeys<["store"]>> = { home: "store:addresses.types.home", office: "store:addresses.types.office", other: "store:addresses.types.other" }

interface Form {
  customerId: string
  fullName: string
  phone: string
  email: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
  addressType: AddressType
}
const blank: Form = { customerId: "", fullName: "", phone: "", email: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", country: "Bangladesh", isDefault: false, addressType: "home" }

const toForm = (a: ShippingAddressResponse): Form => ({
  customerId: a.customerId ? String(a.customerId) : "",
  fullName: a.fullName || "", phone: a.phone || "", email: a.email || "",
  addressLine1: a.addressLine1 || "", addressLine2: a.addressLine2 || "",
  city: a.city || "", state: a.state || "", postalCode: a.postalCode || "",
  country: a.country || "Bangladesh", isDefault: !!a.isDefault, addressType: (a.addressType as AddressType) || "home",
})

function validate(f: Form, t: TFunction<["store", "common"]>) {
  const e: Partial<Record<keyof Form, string>> = {}
  if (!f.fullName.trim()) e.fullName = t("store:addresses.errors.fullName")
  const ph = f.phone.trim()
  const digits = ph.replace(/\D/g, "")
  if (!ph) e.phone = t("store:addresses.errors.phone")
  else if (!/^\+?[0-9][0-9\s\-]{6,18}$/.test(ph) || digits.length < 7 || digits.length > 15) e.phone = t("store:addresses.errors.phoneFormat")
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = t("store:addresses.errors.email")
  if (!f.addressLine1.trim()) e.addressLine1 = t("store:addresses.errors.line1")
  if (!f.city.trim()) e.city = t("store:addresses.errors.city")
  if (!f.state.trim()) e.state = t("store:addresses.errors.state")
  const pc = f.postalCode.trim()
  if (!pc) e.postalCode = t("store:addresses.errors.postal")
  else if (!/^[A-Za-z0-9][A-Za-z0-9\- ]{2,9}$/.test(pc)) e.postalCode = t("store:addresses.errors.postalFormat")
  return e
}

export default function ShippingAddressesPage() {
  const { t } = useTranslation(["store", "common"])
  const blocked = useModuleGuard("Shipping Addresses")
  const { toast } = useToast()

  const [rows, setRows] = useState<ShippingAddressResponse[]>([])
  const [customers, setCustomers] = useState<CustomerResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [typeF, setTypeF] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [sel, setSel] = useState<Record<number, boolean>>({})

  const [dlg, setDlg] = useState<{ id: number | null } | null>(null)
  const [form, setForm] = useState<Form>(blank)
  const [errs, setErrs] = useState<Partial<Record<keyof Form, string>>>({})
  const [saving, setSaving] = useState(false)
  const [deleteIds, setDeleteIds] = useState<number[] | null>(null)

  const load = useCallback(async () => {
    try {
      setRows(await shippingAddressApi.getAll())
    } catch (e: any) {
      toast({ variant: "destructive", title: t("store:addresses.toast.loadFailed"), description: e?.response?.data?.message })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
    customerApi.getAll({ limit: 200 }).then((r) => setCustomers(r.data)).catch(() => {})
  }, [load])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((a) => {
      const hit = !ql || [a.fullName, a.addressLine1, a.city, a.customerName].some((v) => String(v || "").toLowerCase().includes(ql)) || String(a.phone || "").includes(q.trim())
      return hit && (typeF === "all" || a.addressType === typeF)
    })
  }, [rows, q, typeF])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const cur = Math.min(page, totalPages)
  const pageRows = filtered.slice((cur - 1) * perPage, cur * perPage)
  const selIds = Object.keys(sel).map(Number).filter((id) => sel[id] && rows.some((r) => r.id === id))
  const allSel = pageRows.length > 0 && pageRows.every((a) => sel[a.id])

  if (blocked) return blocked

  const setF = (p: Partial<Form>) => {
    setForm((f) => ({ ...f, ...p }))
    setErrs((e) => ({ ...e, ...Object.fromEntries(Object.keys(p).map((k) => [k, ""])) }))
  }
  const openNew = () => { setDlg({ id: null }); setForm(blank); setErrs({}) }
  const openEdit = (a: ShippingAddressResponse) => { setDlg({ id: a.id }); setForm(toForm(a)); setErrs({}) }
  const closeDlg = () => { setDlg(null); setErrs({}) }

  const pickCustomer = (id: string) => {
    const c = customers.find((x) => String(x.id) === id)
    const p: Partial<Form> = { customerId: id }
    if (c) {
      if (!form.fullName.trim()) p.fullName = c.name || ""
      if (!form.phone.trim()) p.phone = c.phone || ""
      if (!form.email.trim()) p.email = c.email || ""
    }
    setF(p)
  }

  const save = async () => {
    const e = validate(form, t)
    if (Object.keys(e).length) {
      setErrs(e)
      toast({ variant: "destructive", title: t("store:addresses.toast.fixFields") })
      return
    }
    const body = {
      customerId: form.customerId ? Number(form.customerId) : null,
      fullName: form.fullName.trim(), phone: form.phone.trim(), email: form.email.trim(),
      addressLine1: form.addressLine1.trim(), addressLine2: form.addressLine2.trim(),
      city: form.city.trim(), state: form.state.trim(), postalCode: form.postalCode.trim(),
      country: form.country.trim() || "Bangladesh", isDefault: form.isDefault, addressType: form.addressType,
    }
    setSaving(true)
    try {
      if (dlg?.id) await shippingAddressApi.update(dlg.id, body)
      else await shippingAddressApi.create(body)
      toast({ title: dlg?.id ? t("store:addresses.toast.updated") : t("store:addresses.toast.added") })
      closeDlg()
      await load()
    } catch (err: any) {
      const fe = err?.response?.data?.errors
      if (fe) {
        const next: Partial<Record<keyof Form, string>> = {}
        for (const [k, v] of Object.entries(fe)) next[k as keyof Form] = (v as string[])[0]
        setErrs(next)
      }
      toast({ variant: "destructive", title: t("store:addresses.toast.saveFailed"), description: (fe && (Object.values(fe)[0] as string[])[0]) || err?.response?.data?.message })
    } finally {
      setSaving(false)
    }
  }

  const makeDefault = async (a: ShippingAddressResponse) => {
    try {
      await shippingAddressApi.setDefault(a.id)
      toast({ title: t("store:addresses.toast.defaultUpdated") })
      await load()
    } catch (e: any) {
      toast({ variant: "destructive", title: t("store:addresses.toast.defaultFailed"), description: e?.response?.data?.message })
    }
  }

  const confirmDelete = async () => {
    const ids = deleteIds ?? []
    setDeleteIds(null)
    const results = await Promise.allSettled(ids.map((id) => shippingAddressApi.delete(id)))
    const failed = results.filter((r) => r.status === "rejected").length
    setSel({})
    if (failed) toast({ variant: "destructive", title: t("store:addresses.toast.deleteFailed", { count: failed }) })
    else toast({ title: t("store:addresses.toast.deleted", { count: ids.length }) })
    await load()
  }

  const exportCsv = () => {
    if (!filtered.length) return toast({ variant: "destructive", title: t("common:extra.nothingToExport") })
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
    const head = [
      t("store:addresses.csv.fullName"), t("store:addresses.csv.customer"), t("store:addresses.csv.phone"), t("store:addresses.csv.email"),
      t("store:addresses.csv.line1"), t("store:addresses.csv.line2"), t("store:addresses.csv.city"), t("store:addresses.csv.state"),
      t("store:addresses.csv.postal"), t("store:addresses.csv.country"), t("store:addresses.csv.type"), t("store:addresses.csv.default"),
    ]
    const lines = [head.map(esc).join(",")].concat(
      filtered.map((a) => [a.fullName, a.customerName || "", a.phone, a.email || "", a.addressLine1, a.addressLine2 || "", a.city, a.state, a.postalCode, a.country, a.addressType, a.isDefault ? t("common:actions.yes") : t("common:actions.no")].map(esc).join(",")),
    )
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = "shipping-addresses.csv"
    link.click()
    URL.revokeObjectURL(url)
    toast({ title: t("store:addresses.toast.exported", { count: filtered.length }) })
  }

  const field = (lbl: string, key: keyof Omit<Form, "isDefault" | "addressType" | "customerId">, placeholder = "") => (
    <FormField label={lbl} htmlFor={`addr-${key}`} error={errs[key]} className="min-w-0">
      <Input id={`addr-${key}`} type="text" className="w-full" aria-invalid={!!errs[key] || undefined} value={form[key]} placeholder={placeholder} onChange={(e) => setF({ [key]: e.target.value })} />
    </FormField>
  )

  const td = "align-top"

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("store:addresses.title")}
        description={t("store:addresses.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={exportCsv}><Download className="size-4" />{t("store:addresses.exportCsv")}</Button>
          <Button type="button" onClick={openNew}><Plus className="size-4" />{t("store:addresses.add")}</Button>
        </>}
      />

      <Card className="gap-0 py-0">
        <Toolbar className="p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="addr-search" className="sr-only">{t("common:actions.search")}</Label>
            <Input id="addr-search" type="search" placeholder={t("store:addresses.searchPh")} value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              className="pl-9" />
          </div>
          <Select value={typeF} onValueChange={(v) => { setTypeF(v); setPage(1) }}>
            <SelectTrigger aria-label={t("store:addresses.typeFilter")} className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("store:addresses.allTypes")}</SelectItem>
              <SelectItem value="home">{t("store:addresses.types.home")}</SelectItem>
              <SelectItem value="office">{t("store:addresses.types.office")}</SelectItem>
              <SelectItem value="other">{t("store:addresses.types.other")}</SelectItem>
            </SelectContent>
          </Select>
          {selIds.length > 0 && (
            <Button type="button" variant="destructive" onClick={() => setDeleteIds(selIds)}><Trash2 className="size-4" />{t("store:addresses.deleteCount", { count: selIds.length })}</Button>
          )}
        </Toolbar>

        <div>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-10 pl-4">
                  <Checkbox aria-label={t("common:actions.selectAll")} checked={allSel}
                    onCheckedChange={() => setSel((s) => { const n = { ...s }; pageRows.forEach((a) => { if (allSel) delete n[a.id]; else n[a.id] = true }); return n })} />
                </TableHead>
                <TableHead scope="col">{t("store:addresses.colName")}</TableHead>
                <TableHead scope="col">{t("common:fields.address")}</TableHead>
                <TableHead scope="col">{t("common:fields.phone")}</TableHead>
                <TableHead scope="col">{t("common:fields.type")}</TableHead>
                <TableHead scope="col">{t("common:fields.status")}</TableHead>
                <TableHead scope="col" className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={7} className="px-4"><Skeleton className="h-10" /></TableCell></TableRow>)
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState
                      icon={MapPin}
                      title={t("store:addresses.empty")}
                      description={q || typeF !== "all" ? t("store:addresses.emptyFiltered") : t("store:addresses.emptyNew")}
                      className="p-4 md:p-6"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((a) => (
                  <TableRow key={a.id} data-state={sel[a.id] ? "selected" : undefined}>
                    <TableCell className="pl-4 align-top">
                      <Checkbox aria-label={t("common:extra.selectRow", { name: a.fullName })} checked={!!sel[a.id]} onCheckedChange={() => setSel((s) => ({ ...s, [a.id]: !s[a.id] }))} />
                    </TableCell>
                    <TableCell className={td}>
                      <div className="font-semibold">{a.fullName}</div>
                      <div className="text-xs text-muted-foreground">{a.customerName || ""}</div>
                    </TableCell>
                    <TableCell className={td}>
                      <div>{a.addressLine1}</div>
                      {a.addressLine2 && <div className="text-xs text-muted-foreground">{a.addressLine2}</div>}
                      <div className="text-xs text-muted-foreground">{[a.city, a.state].filter(Boolean).join(", ")} {a.postalCode || ""}</div>
                    </TableCell>
                    <TableCell className={td}>
                      <div>{a.phone}</div>
                      <div className="text-xs text-muted-foreground">{a.email || ""}</div>
                    </TableCell>
                    <TableCell className={td}>
                      <Badge variant="secondary">{t(TYPE_LABEL[a.addressType || "other"] ?? TYPE_LABEL.other)}</Badge>
                    </TableCell>
                    <TableCell className={td}>
                      <StatusBadge status={a.isDefault ? "default" : "standard"} variant={a.isDefault ? "default" : "secondary"} label={a.isDefault ? t("store:locations.default") : t("store:addresses.standard")} />
                    </TableCell>
                    <TableCell className="pr-4 align-top">
                      <div className="flex items-center justify-end gap-1">
                        {!a.isDefault && (
                          <Button type="button" variant="link" size="sm" className="mr-1" onClick={() => makeDefault(a)}>{t("store:addresses.setDefault")}</Button>
                        )}
                        <WithTooltip content={t("store:addresses.editName", { name: a.fullName })}><Button type="button" variant="outline" size="icon" aria-label={t("store:addresses.editName", { name: a.fullName })} onClick={() => openEdit(a)}><Pencil className="size-4" /></Button></WithTooltip>
                        <WithTooltip content={t("store:addresses.deleteName", { name: a.fullName })}><Button type="button" variant="outline" size="icon" aria-label={t("store:addresses.deleteName", { name: a.fullName })} onClick={() => setDeleteIds([a.id])}><Trash2 className="size-4" /></Button></WithTooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && filtered.length > 0 && (
          <>
          <Separator />
          <div className="p-4 pt-3">
            <PaginationControl currentPage={cur} totalPages={totalPages} itemsPerPage={perPage} totalItems={filtered.length}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
          </div>
          </>
        )}
      </Card>

      <Dialog open={!!dlg} onOpenChange={(o) => !o && closeDlg()}>
        <DialogContent className={cn(bricolage.variable, instrument.variable, "font-dash-body max-h-[92vh] overflow-y-auto text-dash-ink sm:max-w-[680px]")}>
          <DialogHeader>
            <DialogTitle>{dlg?.id ? t("store:addresses.editTitle") : t("store:addresses.addTitle")}</DialogTitle>
            <DialogDescription>{dlg?.id ? t("store:addresses.editDesc") : t("store:addresses.addDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField label={t("common:fields.customer")} htmlFor="addr-customer" className="min-w-0 sm:col-span-2">
              <Select value={form.customerId || "__none"} onValueChange={(v) => pickCustomer(v === "__none" ? "" : v)}>
                <SelectTrigger id="addr-customer" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t("store:addresses.noCustomer")}</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            {field(t("store:addresses.fullName"), "fullName", t("store:addresses.fullNamePh"))}
            {field(t("store:addresses.phone"), "phone", "+8801712345678")}
            <div className="sm:col-span-2">{field(t("store:addresses.email"), "email", "john@example.com")}</div>
            <div className="sm:col-span-2">{field(t("store:addresses.line1"), "addressLine1", t("store:addresses.line1Ph"))}</div>
            <div className="sm:col-span-2">{field(t("store:addresses.line2"), "addressLine2", t("store:addresses.line2Ph"))}</div>
            {field(t("store:addresses.city"), "city", t("store:addresses.cityPh"))}
            {field(t("store:addresses.state"), "state", t("store:addresses.statePh"))}
            {field(t("store:addresses.postal"), "postalCode", "1205")}
            {field(t("store:addresses.country"), "country")}
            <FormField label={t("store:addresses.type")} htmlFor="addr-type" className="min-w-0">
              <Select value={form.addressType} onValueChange={(v) => setF({ addressType: v as AddressType })}>
                <SelectTrigger id="addr-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">{t("store:addresses.types.home")}</SelectItem>
                  <SelectItem value="office">{t("store:addresses.types.office")}</SelectItem>
                  <SelectItem value="other">{t("store:addresses.types.other")}</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <Label className="flex items-center gap-2 self-end pb-2.5">
              <Checkbox checked={form.isDefault} onCheckedChange={(v) => setF({ isDefault: v === true })} />
              {t("store:addresses.makeDefault")}
            </Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeDlg}>{t("common:actions.cancel")}</Button>
            <Button type="button" disabled={saving} onClick={save}>
              {saving ? t("common:actions.saving") : dlg?.id ? t("store:addresses.updateBtn") : t("store:addresses.add")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteIds} onOpenChange={(o) => !o && setDeleteIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("store:addresses.confirmTitle", { count: deleteIds?.length ?? 1 })}</AlertDialogTitle>
            <AlertDialogDescription>{t("common:confirm.cannotUndo")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className={buttonVariants({ variant: "destructive" })}>{t("common:actions.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
