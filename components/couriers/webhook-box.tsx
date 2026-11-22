"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { FormField } from "@/components/common/FormField"
import { SectionTitle } from "@/components/common/SectionTitle"
import { useToast } from "@/hooks/use-toast"
import { courierAccountApi, courierError, type CourierWebhookInfo } from "@/lib/courierApi"
import { COURIER_NS } from "./i18n"
import { CopyButton } from "./courier-ui"

function CopyInput({ id, label, value }: { id: string; label: string; value: string }) {
  const { t } = useTranslation(COURIER_NS)
  return (
    <FormField label={label} htmlFor={id}>
      <InputGroup>
        <InputGroupInput id={id} readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <InputGroupAddon align="inline-end">
          <CopyButton value={value} label={t("courier:webhook.copy", { label })} className="size-6" />
        </InputGroupAddon>
      </InputGroup>
    </FormField>
  )
}

/** Callback URL (and Steadfast auth header) the owner pastes into the courier's merchant panel; status updates then arrive instantly. */
export function WebhookBox({ accountId, provider }: { accountId: number; provider: string }) {
  const { t } = useTranslation(COURIER_NS)
  const { toast } = useToast()
  const [info, setInfo] = useState<CourierWebhookInfo | null>(null)
  const [error, setError] = useState("")
  const [rotating, setRotating] = useState(false)

  const load = useCallback(async () => {
    setError("")
    try { setInfo(await courierAccountApi.webhook(accountId)) }
    catch (e) { setError(courierError(e, t("common:extra.couldNotLoad"))) }
  }, [accountId, t])

  useEffect(() => { setInfo(null); load() }, [load])

  const rotate = async () => {
    if (!window.confirm(t("courier:webhook.rotateConfirm"))) return
    setRotating(true)
    try {
      setInfo(await courierAccountApi.rotateWebhook(accountId))
      toast({ title: t("courier:webhook.rotated") })
    } catch (e) {
      toast({ variant: "destructive", title: t("courier:webhook.rotateFailed"), description: courierError(e, t("common:extra.tryAgain")) })
    } finally {
      setRotating(false)
    }
  }

  const steadfast = provider === "steadfast"
  return (
    <section className="space-y-3">
      <SectionTitle action={info && (
        <Button type="button" variant="ghost" size="sm" disabled={rotating} onClick={rotate}>
          <RefreshCw className={rotating ? "size-4 animate-spin" : "size-4"} aria-hidden /> {t("courier:webhook.rotate")}
        </Button>
      )}>{t("courier:webhook.title")}</SectionTitle>
      <p className="text-sm text-muted-foreground">{steadfast ? t("courier:webhook.steadfastHow") : t("courier:webhook.pathaoHow")}</p>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !info ? (
        <Skeleton className="h-16" />
      ) : (
        <div className="space-y-3">
          <CopyInput id={`wh-url-${accountId}`} label={t("courier:webhook.url")} value={info.url} />
          {info.authHeader ? <CopyInput id={`wh-auth-${accountId}`} label={t("courier:webhook.authHeader")} value={info.authHeader} />
            : info.token && <CopyInput id={`wh-token-${accountId}`} label={t("courier:webhook.secret")} value={info.token} />}
          <p className="text-xs text-muted-foreground">{t("courier:webhook.pollingNote")}</p>
        </div>
      )}
    </section>
  )
}
