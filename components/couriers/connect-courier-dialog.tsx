"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { FormField } from "@/components/common/FormField"
import { SectionTitle } from "@/components/common/SectionTitle"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import {
  courierAccountApi, courierError, type CourierAccount, type CourierAccountPayload, type CourierEnvironment,
  type CourierProvider, type CourierTestResult, type DeliveryType, type ItemType, type PathaoStore,
} from "@/lib/courierApi"
import { COURIER_NS } from "./i18n"
import { providerName } from "./courier-ui"
import { WebhookBox } from "./webhook-box"

interface Form {
  environment: CourierEnvironment
  apiKey: string
  secretKey: string
  clientId: string
  clientSecret: string
  username: string
  password: string
  storeId: string
  weight: string
  deliveryType: DeliveryType
  itemType: ItemType
  note: string
  itemDescription: string
  isActive: boolean
  isDefault: boolean
}

const formOf = (a: CourierAccount | null, firstAccount: boolean): Form => ({
  environment: (a?.environment as CourierEnvironment) || "live",
  apiKey: "", secretKey: "", clientId: "", clientSecret: "", password: "",
  username: a?.credentials?.username ?? "",
  storeId: a?.credentials?.storeId != null ? String(a.credentials.storeId) : "",
  weight: String(a?.settings?.weightKg ?? 0.5),
  deliveryType: (a?.settings?.deliveryType ?? 48) as DeliveryType,
  itemType: (a?.settings?.itemType ?? 2) as ItemType,
  note: a?.settings?.note ?? "",
  itemDescription: a?.settings?.itemDescription ?? "",
  isActive: a?.isActive ?? true,
  isDefault: a?.isDefault ?? firstAccount,
})

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: CourierProvider
  /** Existing account to edit, or null to connect a new one */
  account: CourierAccount | null
  /** True when no other courier account exists (new one becomes the default) */
  firstAccount?: boolean
  onSaved: (account: CourierAccount) => void
}

/** Connect / edit a Pathao or Steadfast merchant account: credentials, test connection, Pathao store, booking defaults, webhook URL. */
export function ConnectCourierDialog({ open, onOpenChange, provider, account: initial, firstAccount = false, onSaved }: Props) {
  const { t } = useTranslation(COURIER_NS)
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const [account, setAccount] = useState<CourierAccount | null>(initial)
  const [form, setForm] = useState<Form>(() => formOf(initial, firstAccount))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<CourierTestResult | null>(null)
  const [stores, setStores] = useState<PathaoStore[]>([])
  const [storesLoading, setStoresLoading] = useState(false)

  const isPathao = provider === "pathao"
  const name = providerName(provider)
  const editing = !!account

  useEffect(() => {
    if (!open) return
    setAccount(initial); setForm(formOf(initial, firstAccount)); setErrors({}); setTest(null); setStores([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id])

  // Pathao: load the merchant's stores for a saved, configured account
  const loadStores = async (id: number) => {
    setStoresLoading(true)
    try { setStores(await courierAccountApi.stores(id)) }
    catch (e) { setErrors((x) => ({ ...x, storeId: courierError(e, t("courier:connect.storesFailed")) })) }
    finally { setStoresLoading(false) }
  }
  useEffect(() => {
    if (open && isPathao && initial?.id && initial.isConfigured) loadStores(initial.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isPathao, initial?.id])

  const patch = (p: Partial<Form>) => { setForm((f) => ({ ...f, ...p })); setErrors({}) }

  const validate = () => {
    const e: Record<string, string> = {}
    const need = (k: keyof Form, has?: boolean) => { if (!String(form[k]).trim() && !(editing && has)) e[k] = t("courier:connect.required") }
    if (isPathao) {
      need("clientId", !!account?.credentials?.clientId)
      need("clientSecret", account?.hasClientSecret)
      need("username", !!account?.credentials?.username)
      need("password", account?.hasPassword)
      if (form.username.trim() && !/^\S+@\S+\.\S+$/.test(form.username.trim())) e.username = t("courier:connect.emailInvalid")
    } else {
      need("apiKey", account?.hasApiKey)
      need("secretKey", account?.hasSecretKey)
    }
    const w = Number(form.weight)
    if (!Number.isFinite(w) || w <= 0) e.weight = t("courier:book.err.weight")
    return e
  }

  const payload = (): CourierAccountPayload => {
    const keep = (v: string) => v.trim() || undefined
    const credentials = isPathao
      ? { clientId: keep(form.clientId), clientSecret: keep(form.clientSecret), username: keep(form.username), password: keep(form.password), storeId: form.storeId ? Number(form.storeId) : undefined }
      : { apiKey: keep(form.apiKey), secretKey: keep(form.secretKey) }
    return {
      ...(editing ? {} : { provider }),
      isActive: form.isActive,
      isDefault: form.isDefault,
      ...(isPathao ? { environment: form.environment } : {}),
      credentials,
      settings: {
        weightKg: Number(form.weight),
        note: form.note.trim() || null,
        itemDescription: form.itemDescription.trim() || null,
        ...(isPathao ? { deliveryType: form.deliveryType, itemType: form.itemType } : {}),
      },
    }
  }

  const runTest = async (id: number) => {
    setTesting(true); setTest(null)
    try {
      const r = await courierAccountApi.test(id)
      setTest(r)
      if (r.account) { setAccount(r.account); onSaved(r.account) }
      if (r.ok && isPathao) {
        const list = r.stores ?? []
        if (list.length) setStores(list)
        else await loadStores(id)
        const saved = r.account ?? account
        if (!form.storeId && !saved?.credentials?.storeId && list.length) {
          // No pickup store yet: save the merchant's default store so the account can book right away
          const storeId = (list.find((s) => s.isDefault) ?? list[0]).id
          patch({ storeId: String(storeId) })
          const updated = await courierAccountApi.update(id, { credentials: { storeId } }).catch(() => null)
          if (updated) { setAccount(updated); onSaved(updated) }
        }
      }
      return r
    } catch (e) {
      const r = { ok: false, message: courierError(e, t("common:extra.tryAgain")) }
      setTest(r)
      return r
    } finally {
      setTesting(false)
    }
  }

  const save = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      const saved = account ? await courierAccountApi.update(account.id, payload()) : await courierAccountApi.create(payload())
      setAccount(saved)
      setForm((f) => ({ ...f, apiKey: "", secretKey: "", clientId: "", clientSecret: "", password: "" }))
      onSaved(saved)
      if (!editing) {
        // A new account: check the credentials right away (Pathao then lists its stores to pick from)
        toast({ title: t("courier:connect.toast.connected", { courier: name }) })
        const r = await runTest(saved.id)
        if (r.ok && !isPathao) onOpenChange(false)
      } else {
        toast({ title: t("courier:connect.toast.saved", { courier: name }) })
        onOpenChange(false)
      }
    } catch (err: any) {
      const fe = err?.response?.data?.errors
      if (fe && typeof fe === "object") {
        const out: Record<string, string> = {}
        Object.entries(fe).forEach(([k, v]) => { out[k.replace(/^credentials\./, "").replace(/^settings\.weightKg$/, "weight")] = Array.isArray(v) ? String(v[0]) : String(v) })
        setErrors(out)
      }
      toast({ variant: "destructive", title: t("courier:connect.toast.saveFailed"), description: courierError(err, t("common:extra.tryAgain")) })
    } finally {
      setSaving(false)
    }
  }

  const secretPh = (has?: boolean) => (editing && has ? t("courier:connect.keepSecret") : "")
  const field = (k: keyof Form, label: string, opts: { secret?: boolean; has?: boolean; ph?: string; type?: string; autoComplete?: string } = {}) => (
    <FormField label={label} htmlFor={`cc-${k}`} required={!(editing && opts.has)} error={errors[k]}>
      <Input id={`cc-${k}`} type={opts.secret ? "password" : opts.type ?? "text"} autoComplete={opts.secret ? "new-password" : opts.autoComplete ?? "off"}
        value={String(form[k])} placeholder={opts.secret ? secretPh(opts.has) : opts.ph} aria-invalid={!!errors[k]}
        onChange={(e) => patch({ [k]: e.target.value } as Partial<Form>)} />
    </FormField>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle>{editing ? t("courier:connect.editTitle", { courier: name }) : t("courier:connect.title", { courier: name })}</DialogTitle>
          <DialogDescription>{isPathao ? t("courier:connect.pathaoDesc") : t("courier:connect.steadfastDesc")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5">
          <section className="space-y-3">
            <SectionTitle>{t("courier:connect.credentials")}</SectionTitle>
            {isPathao ? (
              <>
                <FormField label={t("courier:connect.environment")} description={form.environment === "sandbox" ? t("courier:connect.sandboxHint") : t("courier:connect.liveHint")}>
                  <SegmentedControl aria-label={t("courier:connect.environment")} value={form.environment} onValueChange={(v) => patch({ environment: v as CourierEnvironment })}
                    options={[{ value: "live", label: t("courier:connect.live") }, { value: "sandbox", label: t("courier:integrations.sandbox") }]} />
                </FormField>
                <div className="grid gap-3 sm:grid-cols-2">
                  {field("clientId", t("courier:connect.clientId"), { has: !!account?.credentials?.clientId, ph: account?.credentials?.clientId ?? undefined })}
                  {field("clientSecret", t("courier:connect.clientSecret"), { secret: true, has: account?.hasClientSecret })}
                  {field("username", t("courier:connect.username"), { has: !!account?.credentials?.username, type: "email", autoComplete: "off" })}
                  {field("password", t("courier:connect.password"), { secret: true, has: account?.hasPassword })}
                </div>
                <p className="text-xs text-muted-foreground">{t("courier:connect.pathaoWhere")}</p>
              </>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {field("apiKey", t("courier:connect.apiKey"), { secret: true, has: account?.hasApiKey })}
                  {field("secretKey", t("courier:connect.secretKey"), { secret: true, has: account?.hasSecretKey })}
                </div>
                <p className="text-xs text-muted-foreground">{t("courier:connect.steadfastWhere")}</p>
              </>
            )}
          </section>

          {account && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={testing || saving} onClick={() => runTest(account.id)}>
                  <RefreshCw className={testing ? "size-4 animate-spin" : "size-4"} aria-hidden /> {testing ? t("courier:integrations.testing") : t("courier:integrations.test")}
                </Button>
                <span className="text-xs text-muted-foreground">{t("courier:connect.testHint")}</span>
              </div>
              {test && (
                <Alert variant={test.ok ? "default" : "destructive"}>
                  {test.ok ? <CheckCircle2 aria-hidden /> : <XCircle aria-hidden />}
                  <AlertTitle>{test.ok ? t("courier:integrations.connected") : t("courier:integrations.testFailed")}</AlertTitle>
                  <AlertDescription>
                    {test.ok && test.balance != null ? t("courier:integrations.balance", { amount: formatCurrency(Number(test.balance)) }) : test.message}
                  </AlertDescription>
                </Alert>
              )}
            </section>
          )}

          {isPathao && account && (
            <FormField label={t("courier:connect.store")} htmlFor="cc-store" error={errors.storeId}
              description={stores.length === 0 && !storesLoading ? t("courier:connect.storeHint") : undefined}>
              <Select value={form.storeId} onValueChange={(v) => patch({ storeId: v })} disabled={storesLoading || stores.length === 0}>
                <SelectTrigger id="cc-store" className="w-full">
                  <SelectValue placeholder={storesLoading ? t("common:status.loading") : t("courier:book.pickStore")} />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{[s.name, s.address].filter(Boolean).join(" · ")}</SelectItem>
                  ))}
                  {form.storeId && !stores.some((s) => String(s.id) === form.storeId) && <SelectItem value={form.storeId}>#{form.storeId}</SelectItem>}
                </SelectContent>
              </Select>
            </FormField>
          )}

          <Separator />

          <section className="space-y-3">
            <SectionTitle>{t("courier:connect.defaults")}</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("courier:book.weight")} htmlFor="cc-weight" error={errors.weight}>
                <Input id="cc-weight" type="number" min={0.1} step="0.1" value={form.weight} onChange={(e) => patch({ weight: e.target.value })} />
              </FormField>
              <FormField label={t("courier:book.itemDescription")} htmlFor="cc-items" description={t("courier:connect.itemsHint")}>
                <Input id="cc-items" value={form.itemDescription} maxLength={255} onChange={(e) => patch({ itemDescription: e.target.value })} />
              </FormField>
              {isPathao && (
                <>
                  <FormField label={t("courier:book.deliveryType")}>
                    <SegmentedControl aria-label={t("courier:book.deliveryType")} value={String(form.deliveryType)} onValueChange={(v) => patch({ deliveryType: Number(v) as DeliveryType })}
                      options={[{ value: "48", label: t("courier:deliveryType.normal") }, { value: "12", label: t("courier:deliveryType.onDemand") }]} />
                  </FormField>
                  <FormField label={t("courier:book.itemType")}>
                    <SegmentedControl aria-label={t("courier:book.itemType")} value={String(form.itemType)} onValueChange={(v) => patch({ itemType: Number(v) as ItemType })}
                      options={[{ value: "2", label: t("courier:itemType.parcel") }, { value: "1", label: t("courier:itemType.document") }]} />
                  </FormField>
                </>
              )}
              <FormField label={t("courier:book.note")} htmlFor="cc-note" className="sm:col-span-2">
                <Input id="cc-note" value={form.note} maxLength={500} placeholder={t("courier:book.notePh")} onChange={(e) => patch({ note: e.target.value })} />
              </FormField>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Label className="flex items-center gap-2.5">
                <Switch checked={form.isActive} onCheckedChange={(v) => patch({ isActive: v })} />
                {t("courier:connect.active")}
              </Label>
              <Label className="flex items-center gap-2.5">
                <Switch checked={form.isDefault} onCheckedChange={(v) => patch({ isDefault: v })} />
                {t("courier:connect.useAsDefault")}
              </Label>
            </div>
          </section>

          {account && (
            <>
              <Separator />
              <WebhookBox accountId={account.id} provider={provider} />
            </>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            {editing ? t("common:actions.close") : t("common:actions.cancel")}
          </Button>
          <Button type="button" disabled={saving || testing} onClick={save}>
            {saving ? t("common:actions.saving") : editing ? t("common:actions.saveChanges") : t("courier:connect.connect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
