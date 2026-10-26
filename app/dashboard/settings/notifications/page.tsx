"use client"

import { useEffect, useMemo, useState } from "react"
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

const CHANNELS: { key: NotifChannel; label: string }[] = [
  { key: "app", label: "You · app" },
  { key: "email", label: "You · email" },
  { key: "sms", label: "You · SMS" },
  { key: "cust", label: "Customer · SMS" },
]

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export default function NotificationSettingsPage() {
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
      .catch(() => toast({ variant: "destructive", title: "Could not load notification settings" }))
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
    if (!draft || !dirty) return toast({ title: "No changes to save" })
    const f = draft.quietFrom, t = draft.quietTo
    if ((f && !TIME.test(f)) || (t && !TIME.test(t))) return setErr("Quiet hours must be valid times.")
    if ((f && !t) || (!f && t)) return setErr("Set both start and end of quiet hours, or clear both.")
    if (f && f === t) return setErr("Quiet hours start and end must be different.")
    if (!draft.smsTemplate.trim()) return setErr("The SMS template cannot be empty.")
    setSaving(true)
    try {
      const r = await notificationPreferencesApi.save({ ...draft, smsTemplate: draft.smsTemplate.trim() })
      setData(r); setDraft(r.preferences); setErr("")
      toast({ title: "Notification settings saved" })
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not save notification settings")
    } finally {
      setSaving(false)
    }
  }

  const discard = () => { if (!dirty || !data) return; setDraft(data.preferences); setErr(""); toast({ title: "Changes discarded" }) }

  const balance = data?.smsBalance ?? 0

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Notifications" description="Get told about what matters — and keep customers in the loop automatically." />

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
              title="Who gets told what"
              description="Tick how each event reaches you, your staff and your customers."
              contentClassName="px-0"
            >
              <div className="overflow-x-auto">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      {CHANNELS.map((c) => <TableHead key={c.key} className="text-center">{c.label}</TableHead>)}
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
                                    <Checkbox checked={on} aria-label={`${r.name} ${c.label}`} onCheckedChange={() => flip(r.key, c.key)} />
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
              <SectionCard title="SMS balance" description="Used for customer and owner SMS." contentClassName="flex flex-col gap-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums">{balance.toLocaleString("en-US")}</span>
                  <span className="text-muted-foreground">SMS left</span>
                </div>
                <Progress value={Math.max(0, Math.min(100, Math.round(balance / 10)))} aria-label="SMS balance" />
                {!data.smsProviderConnected && (
                  <p className="text-xs text-muted-foreground">No SMS gateway is connected yet, so this is your stored balance and no text messages are sent.</p>
                )}
                <Button type="button" onClick={() => toast({ variant: "destructive", title: "SMS top-up isn't connected yet" })}>
                  Buy more SMS
                </Button>
              </SectionCard>

              <SectionCard title="Customer SMS preview" description="Order confirmed" contentClassName="flex flex-col gap-4">
                <Card className="gap-0 whitespace-pre-wrap bg-muted px-3.5 py-3 text-sm shadow-none">{message}</Card>
                <span className="text-xs text-muted-foreground">{message.length} characters · {segs} SMS · {sale ? "from your latest sale" : "template preview"}</span>
                <Button type="button" variant="outline" onClick={() => setTplOpen((v) => !v)}>
                  {tplOpen ? "Hide template" : "Edit templates"}
                </Button>
                {tplOpen && (
                  <FormField label="Message template" htmlFor="notif-sms-template" description={<>Use {"{customer}"}, {"{no}"}, {"{total}"} and {"{business}"}.</>}>
                    <Textarea id="notif-sms-template" rows={4} maxLength={500} value={draft.smsTemplate} onChange={(e) => patch({ smsTemplate: e.target.value })} />
                  </FormField>
                )}
              </SectionCard>

              <SectionCard title="Quiet hours" description="No app or SMS alerts to you during these hours.">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="From" htmlFor="notif-quiet-from" className="min-w-0">
                    <Input id="notif-quiet-from" type="time" value={draft.quietFrom} onChange={(e) => patch({ quietFrom: e.target.value })} />
                  </FormField>
                  <FormField label="To" htmlFor="notif-quiet-to" className="min-w-0">
                    <Input id="notif-quiet-to" type="time" value={draft.quietTo} onChange={(e) => patch({ quietTo: e.target.value })} />
                  </FormField>
                </div>
              </SectionCard>
            </aside>
          </div>

          <Card className="sticky bottom-0 z-10 flex-row flex-wrap items-center gap-2.5 px-4 py-3">
            <span className={cn("text-sm", err ? "text-destructive" : "text-muted-foreground")}>
              {err || (dirty ? "You have unsaved changes." : "All changes saved.")}
            </span>
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={discard}>Discard</Button>
              <Button type="button" onClick={save} disabled={saving || !dirty}>
                {saving ? "Saving…" : "Save changes"}
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
