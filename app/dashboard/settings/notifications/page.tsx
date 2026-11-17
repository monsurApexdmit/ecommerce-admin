"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { localeTag } from "@/lib/i18n"
import { Skeleton } from "@/components/ui/skeleton"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { notificationPreferencesApi, type NotifChannel, type NotifPreferences, type NotifPreferencesResponse } from "@/lib/notificationPreferencesApi"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const CHANNELS: { key: NotifChannel; label: ParseKeys<["store"]> }[] = [
  { key: "app", label: "store:settings.notifications.channels.app" },
  { key: "email", label: "store:settings.notifications.channels.email" },
  { key: "sms", label: "store:settings.notifications.channels.sms" },
  { key: "cust", label: "store:settings.notifications.channels.cust" },
]

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export default function NotificationSettingsPage() {
  const { t: tr, i18n } = useTranslation(["store", "common"])
  const blocked = useModuleGuard("Settings")
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()

  const [data, setData] = useState<NotifPreferencesResponse | null>(null)
  const [draft, setDraft] = useState<NotifPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")
  const [tplOpen, setTplOpen] = useState(false)

  useEffect(() => {
    notificationPreferencesApi.get()
      .then((r) => { setData(r); setDraft(r.preferences) })
      .catch(() => toast({ variant: "destructive", title: tr("store:settings.notifications.loadFailed") }))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dirty = !!data && !!draft && JSON.stringify(draft) !== JSON.stringify(data.preferences)

  const groups = useMemo(() => {
    const out: { name: string; rows: NonNullable<typeof data>["events"] }[] = []
    for (const ev of data?.events ?? []) {
      let g = out.find((x) => x.name === ev.group)
      if (!g) out.push((g = { name: ev.group, rows: [] }))
      g.rows.push(ev)
    }
    return out
  }, [data])

  const sale = data?.preview.sale ?? null
  const business = data?.preview.business ?? ""
  const message = useMemo(() => {
    const t = draft?.smsTemplate ?? ""
    const withBiz = (s: string) => s.replace(/\{business\}/g, business)
    if (!sale) return withBiz(t)
    return withBiz(t.replace(/\{customer\}/g, sale.customer || "Customer").replace(/\{no\}/g, sale.no).replace(/\{total\}/g, formatCurrency(sale.total)))
  }, [draft?.smsTemplate, sale, business, formatCurrency])
  const unicode = /[^\x00-\x7F]/.test(message)
  const segs = Math.max(1, Math.ceil(message.length / (unicode ? 70 : 160)))

  if (blocked) return blocked

  const patch = (p: Partial<NotifPreferences>) => { setDraft((d) => (d ? { ...d, ...p } : d)); setErr("") }
  const flip = (key: string, ch: NotifChannel) =>
    setDraft((d) => (d ? { ...d, events: { ...d.events, [key]: { ...d.events[key], [ch]: !d.events[key][ch] } } } : d))

  const save = async () => {
    if (!draft || !dirty) return toast({ title: tr("store:settings.notifications.noChanges") })
    const f = draft.quietFrom, t = draft.quietTo
    if ((f && !TIME.test(f)) || (t && !TIME.test(t))) return setErr(tr("store:settings.notifications.errors.quietInvalid"))
    if ((f && !t) || (!f && t)) return setErr(tr("store:settings.notifications.errors.quietBoth"))
    if (f && f === t) return setErr(tr("store:settings.notifications.errors.quietSame"))
    if (!draft.smsTemplate.trim()) return setErr(tr("store:settings.notifications.errors.templateEmpty"))
    setSaving(true)
    try {
      const r = await notificationPreferencesApi.save({ ...draft, smsTemplate: draft.smsTemplate.trim() })
      setData(r); setDraft(r.preferences); setErr("")
      toast({ title: tr("store:settings.notifications.saved") })
    } catch (e: any) {
      setErr(e?.response?.data?.message || tr("store:settings.notifications.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const discard = () => { if (!dirty || !data) return; setDraft(data.preferences); setErr(""); toast({ title: tr("store:shared.changesDiscarded") }) }

  const balance = data?.smsBalance ?? 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={tr("store:settings.notifications.title")} description={tr("store:settings.notifications.description")} />

      {loading || !data || !draft ? (
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-[480px] min-w-0 flex-[999_1_640px]" />
          <Skeleton className="h-[480px] flex-[1_1_340px]" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-4">
            <SectionCard
              className="min-w-0 flex-[999_1_640px]"
              title={tr("store:settings.notifications.who")}
              description={tr("store:settings.notifications.whoSub")}
              contentClassName="px-0"
            >
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tr("store:settings.notifications.event")}</TableHead>
                      {CHANNELS.map((c) => <TableHead key={c.key} className="text-center">{tr(c.label)}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((g) => (
                      <GroupRows key={g.name} name={g.name}>
                        {g.rows.map((r) => (
                          <TableRow key={r.key}>
                            <TableCell>
                              <div className="font-semibold">{r.name}</div>
                              <div className="text-xs text-muted-foreground">{r.sub}</div>
                            </TableCell>
                            {CHANNELS.map((c) => {
                              const na = r.na.includes(c.key)
                              const on = !na && !!draft.events[r.key]?.[c.key]
                              return (
                                <TableCell key={c.key} className="text-center">
                                  {na ? <span className="text-muted-foreground">—</span> : (
                                    <Checkbox checked={on} aria-label={tr("store:settings.notifications.eventChannel", { event: r.name, channel: tr(c.label) })} onCheckedChange={() => flip(r.key, c.key)} />
                                  )}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                      </GroupRows>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SectionCard>

            <aside className="flex max-w-full flex-[1_1_340px] flex-col gap-4">
              <SectionCard title={tr("store:settings.notifications.balance")} description={tr("store:settings.notifications.balanceSub")} contentClassName="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">{balance.toLocaleString(localeTag(i18n.language))}</span>
                  <span className="text-muted-foreground">{tr("store:settings.notifications.smsLeft")}</span>
                </div>
                <Progress value={Math.max(0, Math.min(100, Math.round(balance / 10)))} aria-label={tr("store:settings.notifications.balance")} />
                {!data.smsProviderConnected && (
                  <p className="text-xs text-muted-foreground">{tr("store:settings.notifications.noGateway")}</p>
                )}
                <Button type="button" onClick={() => toast({ variant: "destructive", title: tr("store:settings.notifications.topUpNotConnected") })}>
                  {tr("store:settings.notifications.buyMore")}
                </Button>
              </SectionCard>

              <SectionCard title={tr("store:settings.notifications.preview")} description={tr("store:settings.notifications.previewSub")} contentClassName="flex flex-col gap-4">
                <Card className="gap-0 whitespace-pre-wrap bg-muted px-3.5 py-3 text-sm shadow-none">{message}</Card>
                <span className="text-xs text-muted-foreground">{tr("store:settings.notifications.previewStats", { count: message.length, segs, source: sale ? tr("store:settings.notifications.fromSale") : tr("store:settings.notifications.templatePreview") })}</span>
                <Button type="button" variant="outline" onClick={() => setTplOpen((v) => !v)}>
                  {tplOpen ? tr("store:settings.notifications.hideTemplate") : tr("store:settings.notifications.editTemplates")}
                </Button>
                {tplOpen && (
                  <FormField label={tr("store:settings.notifications.template")} htmlFor="notif-sms-template" description={tr("store:settings.notifications.templateHelp")}>
                    <Textarea id="notif-sms-template" rows={4} maxLength={500} value={draft.smsTemplate} onChange={(e) => patch({ smsTemplate: e.target.value })} />
                  </FormField>
                )}
              </SectionCard>

              <SectionCard title={tr("store:settings.notifications.quiet")} description={tr("store:settings.notifications.quietSub")}>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={tr("common:extra.from")} htmlFor="notif-quiet-from" className="min-w-0">
                    <Input id="notif-quiet-from" type="time" value={draft.quietFrom} onChange={(e) => patch({ quietFrom: e.target.value })} />
                  </FormField>
                  <FormField label={tr("common:extra.to")} htmlFor="notif-quiet-to" className="min-w-0">
                    <Input id="notif-quiet-to" type="time" value={draft.quietTo} onChange={(e) => patch({ quietTo: e.target.value })} />
                  </FormField>
                </div>
              </SectionCard>
            </aside>
          </div>

          <Card className="sticky bottom-0 z-10 flex-row flex-wrap items-center gap-2.5 px-4 py-3">
            <span className={cn("text-sm", err ? "text-destructive" : "text-muted-foreground")}>
              {err || (dirty ? tr("store:shared.unsaved") : tr("store:shared.allSaved"))}
            </span>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={discard}>{tr("store:shared.discard")}</Button>
              <Button type="button" onClick={save} disabled={saving || !dirty}>
                {saving ? tr("common:actions.saving") : tr("common:actions.saveChanges")}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function GroupRows({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <>
      <TableRow>
        <TableCell colSpan={5} className="text-xs font-medium uppercase text-muted-foreground">{name}</TableCell>
      </TableRow>
      {children}
    </>
  )
}
