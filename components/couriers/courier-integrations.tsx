"use client"

import { useCallback, useEffect, useState } from "react"
import { Pencil, RefreshCw, Star, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { SectionCard } from "@/components/common/SectionCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { localeTag } from "@/lib/i18n"
import { API_PROVIDERS, courierAccountApi, courierError, isApiProvider, type CourierAccount, type CourierProvider } from "@/lib/courierApi"
import { cn } from "@/lib/utils"
import { COURIER_NS, type CourierKey } from "./i18n"
import { PROVIDER_META, accountName, providerName } from "./courier-ui"
import { ConnectCourierDialog } from "./connect-courier-dialog"

const PROVIDER_DESC: Record<CourierProvider, CourierKey> = {
  pathao: "courier:integrations.pathaoDesc",
  steadfast: "courier:integrations.steadfastDesc",
}

const CONNECTION: Record<string, { key: CourierKey; variant: "default" | "destructive" | "outline" }> = {
  connected: { key: "courier:integrations.connected", variant: "default" },
  error: { key: "courier:integrations.error", variant: "destructive" },
  untested: { key: "courier:integrations.untested", variant: "outline" },
}

/** "Courier integrations" section of Shipping methods: connect Pathao / Steadfast, test, set default, webhook. */
export function CourierIntegrations() {
  const { t, i18n } = useTranslation(COURIER_NS)
  const tag = localeTag(i18n.language)
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<CourierAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [dialog, setDialog] = useState<{ provider: CourierProvider; account: CourierAccount | null } | null>(null)
  const [removing, setRemoving] = useState<CourierAccount | null>(null)

  const load = useCallback(async () => {
    try { setAccounts(await courierAccountApi.getAll()) }
    catch (e) { toast({ variant: "destructive", title: t("courier:integrations.loadFailed"), description: courierError(e, t("common:extra.tryAgain")) }) }
    finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const upsert = (a: CourierAccount) =>
    setAccounts((list) => {
      const next = list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a]
      return a.isDefault ? next.map((x) => (x.id === a.id ? x : { ...x, isDefault: false })) : next
    })

  const test = async (a: CourierAccount) => {
    setBusy(a.id)
    try {
      const r = await courierAccountApi.test(a.id)
      if (r.account) upsert(r.account)
      else await load()
      toast(r.ok
        ? { title: t("courier:integrations.testOk", { courier: accountName(a) }), description: r.balance != null ? t("courier:integrations.balance", { amount: formatCurrency(Number(r.balance)) }) : r.message ?? undefined }
        : { variant: "destructive", title: t("courier:integrations.testFailed"), description: r.message ?? undefined })
    } catch (e) {
      toast({ variant: "destructive", title: t("courier:integrations.testFailed"), description: courierError(e, t("common:extra.tryAgain")) })
    } finally {
      setBusy(null)
    }
  }

  const setDefault = async (a: CourierAccount) => {
    setBusy(a.id)
    try { upsert(await courierAccountApi.setDefault(a.id)); toast({ title: t("courier:integrations.defaultSet", { courier: accountName(a) }) }) }
    catch (e) { toast({ variant: "destructive", title: t("courier:integrations.updateFailed"), description: courierError(e, t("common:extra.tryAgain")) }) }
    finally { setBusy(null) }
  }

  const toggle = async (a: CourierAccount) => {
    setBusy(a.id)
    try { upsert(await courierAccountApi.update(a.id, { isActive: !a.isActive })) }
    catch (e) { toast({ variant: "destructive", title: t("courier:integrations.updateFailed"), description: courierError(e, t("common:extra.tryAgain")) }) }
    finally { setBusy(null) }
  }

  const remove = async () => {
    const a = removing
    if (!a) return
    setBusy(a.id)
    try {
      await courierAccountApi.delete(a.id)
      setAccounts((list) => list.filter((x) => x.id !== a.id))
      toast({ title: t("courier:integrations.removed", { courier: accountName(a) }) })
      setRemoving(null)
    } catch (e) {
      toast({ variant: "destructive", title: t("courier:integrations.removeFailed"), description: courierError(e, t("common:extra.tryAgain")) })
    } finally {
      setBusy(null)
    }
  }

  const integrated = (a: CourierAccount) => a.isIntegrated ?? isApiProvider(a.provider)
  const legacy = accounts.filter((a) => !integrated(a))

  const renderCard = (provider: CourierProvider) => {
    const a = accounts.find((x) => integrated(x) && x.provider.toLowerCase() === provider)
    const name = a ? accountName(a) : providerName(provider)
    const conn = a ? CONNECTION[a.connectionStatus ?? "untested"] ?? CONNECTION.untested : null
    return (
      <Card key={provider} className="gap-3 p-4 shadow-none">
        <div className="flex items-start gap-3">
          <UserAvatar shape="square" className={cn("size-10", a && !a.isActive && "opacity-60")} name={name} fallback={PROVIDER_META[provider].ini} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold">{name}</span>
              {a?.isDefault && <Badge variant="secondary" className="gap-1"><Star className="size-3" aria-hidden />{t("courier:integrations.default")}</Badge>}
              {a?.environment === "sandbox" && provider === "pathao" && <Badge variant="outline">{t("courier:integrations.sandbox")}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{t(PROVIDER_DESC[provider])}</p>
          </div>
          {a && (
            <Switch checked={a.isActive} disabled={busy === a.id} onCheckedChange={() => toggle(a)}
              aria-label={a.isActive ? t("courier:integrations.turnOff", { courier: name }) : t("courier:integrations.turnOn", { courier: name })} />
          )}
        </div>

        {a ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {!a.isActive ? <StatusBadge status="inactive" variant="outline" label={t("courier:integrations.off")} />
                : !a.isConfigured ? <StatusBadge status="incomplete" variant="destructive" label={t("courier:integrations.incomplete")} />
                : conn && <StatusBadge status={a.connectionStatus ?? "untested"} variant={conn.variant} label={t(conn.key)} />}
              {a.lastCheckedAt && <span className="text-muted-foreground">{t("courier:integrations.checked", { time: new Date(a.lastCheckedAt).toLocaleString(tag, { dateStyle: "medium", timeStyle: "short" }) })}</span>}
            </div>
            {a.connectionStatus === "error" && a.lastError && <p className="text-xs text-destructive">{a.lastError}</p>}
            {provider === "pathao" && a.isConfigured && (a.needsStore ?? !a.credentials?.storeId) && (
              <p className="text-xs text-destructive">{t("courier:integrations.noStore")}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="outline" size="sm" disabled={busy === a.id} onClick={() => test(a)}>
                <RefreshCw className={busy === a.id ? "size-4 animate-spin" : "size-4"} aria-hidden /> {t("courier:integrations.test")}
              </Button>
              {!a.isDefault && a.isActive && (
                <Button type="button" variant="outline" size="sm" disabled={busy === a.id} onClick={() => setDefault(a)}>{t("courier:integrations.setDefault")}</Button>
              )}
              <WithTooltip content={t("courier:integrations.edit", { courier: name })}>
                <Button type="button" variant="outline" size="icon" className="size-8" aria-label={t("courier:integrations.edit", { courier: name })} onClick={() => setDialog({ provider, account: a })}>
                  <Pencil className="size-4" />
                </Button>
              </WithTooltip>
              <WithTooltip content={t("courier:integrations.remove", { courier: name })}>
                <Button type="button" variant="outline" size="icon" className="size-8 text-destructive" aria-label={t("courier:integrations.remove", { courier: name })} disabled={busy === a.id} onClick={() => setRemoving(a)}>
                  <Trash2 className="size-4" />
                </Button>
              </WithTooltip>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDialog({ provider, account: null })}>{t("courier:integrations.connect")}</Button>
            <span className="text-xs text-muted-foreground">{t("courier:integrations.notConnected")}</span>
          </div>
        )}
      </Card>
    )
  }

  return (
    <SectionCard title={t("courier:integrations.title")} description={t("courier:integrations.description")}>
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[140px]" />)}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {API_PROVIDERS.map(renderCard)}
          <Card aria-disabled className="gap-3 p-4 opacity-70 shadow-none">
            <div className="flex items-start gap-3">
              <UserAvatar shape="square" className="size-10" name="RedX" fallback={PROVIDER_META.redx.ini} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-bold">RedX</span>
                  <Badge variant="outline">{t("courier:integrations.comingSoon")}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t("courier:integrations.redxDesc")}</p>
              </div>
            </div>
            <div><Button type="button" variant="outline" size="sm" disabled>{t("courier:integrations.connect")}</Button></div>
          </Card>
        </div>
      )}

      {legacy.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">{t("courier:integrations.legacyTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("courier:integrations.legacyDesc")}</p>
          <div className="flex flex-wrap gap-2">
            {legacy.map((a) => (
              <Badge key={a.id} variant="outline" className="h-8 gap-1.5 pr-1 text-sm">
                {a.label || a.provider}{a.accountId ? ` · ${a.accountId}` : ""}
                <WithTooltip content={t("courier:integrations.remove", { courier: a.label || a.provider })}>
                  <Button type="button" variant="ghost" size="icon" className="size-6" aria-label={t("courier:integrations.remove", { courier: a.label || a.provider })}
                    disabled={busy === a.id} onClick={() => setRemoving(a)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </WithTooltip>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {dialog && (
        <ConnectCourierDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          provider={dialog.provider}
          account={dialog.account}
          firstAccount={!accounts.some(integrated)}
          onSaved={upsert}
        />
      )}

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("courier:integrations.removeTitle", { courier: removing ? accountName(removing) : "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("courier:integrations.removeDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy === removing?.id} onClick={(e) => { e.preventDefault(); remove() }}>{t("common:actions.remove")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )
}
