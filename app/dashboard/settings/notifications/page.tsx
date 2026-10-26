"use client"

import { useEffect, useMemo, useState } from "react"
import { Check } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { notificationPreferencesApi, type NotifChannel, type NotifPreferences, type NotifPreferencesResponse } from "@/lib/notificationPreferencesApi"
import { cn } from "@/lib/utils"

const CHANNELS: { key: NotifChannel; label: string }[] = [
  { key: "app", label: "You · app" },
  { key: "email", label: "You · email" },
  { key: "sms", label: "You · SMS" },
  { key: "cust", label: "Customer · SMS" },
]

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const card = "rounded-[14px] border border-dash-border bg-dash-card"
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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div>
        <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-dash-muted">Get told about what matters — and keep customers in the loop automatically.</p>
      </div>

      {loading || !data || !draft ? (
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-[480px] min-w-0 flex-[999_1_640px] rounded-[14px]" />
          <Skeleton className="h-[480px] flex-[1_1_340px] rounded-[14px]" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-4">
            <section className={cn(card, "min-w-0 flex-[999_1_640px]")}>
              <div className="border-b border-dash-border px-5 py-[18px]">
                <h2 className="font-dash-display text-lg font-bold">Who gets told what</h2>
                <p className="mt-1 text-[13px] text-dash-muted">Tick how each event reaches you, your staff and your customers.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-dash-neutral-soft text-center text-xs text-dash-muted">
                      <th className="px-5 py-2.5 text-left font-semibold">Event</th>
                      {CHANNELS.map((c) => <th key={c.key} className="px-2 py-2.5 font-semibold">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <GroupRows key={g.name} name={g.name}>
                        {g.rows.map((r) => (
                          <tr key={r.key}>
                            <td className="border-t border-dash-border px-5 py-2.5">
                              <div className="font-semibold">{r.name}</div>
                              <div className="text-xs text-dash-muted">{r.sub}</div>
                            </td>
                            {CHANNELS.map((c) => {
                              const na = r.na.includes(c.key)
                              const on = !na && !!draft.events[r.key]?.[c.key]
                              return (
                                <td key={c.key} className="border-t border-dash-border px-2 py-2.5 text-center">
                                  {na ? <span className="text-dash-border">—</span> : (
                                    <button type="button" role="checkbox" aria-checked={on} aria-label={`${r.name} ${c.label}`} onClick={() => flip(r.key, c.key)}
                                      className={cn("inline-flex size-[30px] items-center justify-center rounded-lg border-2 text-white", on ? "border-dash-accent bg-dash-accent" : "border-dash-border bg-dash-card")}>
                                      {on && <Check className="size-4" strokeWidth={3} />}
                                    </button>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </GroupRows>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="flex max-w-full flex-[1_1_340px] flex-col gap-4">
              <section className={cn(card, "flex flex-col gap-4 p-[22px]")}>
                <div>
                  <h2 className="font-dash-display text-lg font-bold">SMS balance</h2>
                  <p className="mt-1 text-[13px] text-dash-muted">Used for customer and owner SMS.</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="font-dash-display text-[30px] font-bold tabular-nums">{balance.toLocaleString("en-US")}</span>
                  <span className="text-dash-muted">SMS left</span>
                </div>
                <div className="h-2 rounded-full bg-dash-neutral-soft">
                  <div className="h-full rounded-full bg-dash-success-fg" style={{ width: `${Math.max(0, Math.min(100, Math.round(balance / 10)))}%` }} />
                </div>
                {!data.smsProviderConnected && (
                  <p className="text-xs text-dash-muted">No SMS gateway is connected yet, so this is your stored balance and no text messages are sent.</p>
                )}
                <button type="button" onClick={() => toast({ variant: "destructive", title: "SMS top-up isn't connected yet" })}
                  className="h-11 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">
                  Buy more SMS
                </button>
              </section>

              <section className={cn(card, "flex flex-col gap-4 p-[22px]")}>
                <div>
                  <h2 className="font-dash-display text-lg font-bold">Customer SMS preview</h2>
                  <p className="mt-1 text-[13px] text-dash-muted">Order confirmed</p>
                </div>
                <div className="whitespace-pre-wrap rounded-[14px] rounded-bl-[4px] bg-dash-neutral-soft px-3.5 py-3 text-sm leading-normal">{message}</div>
                <span className="text-xs text-dash-muted">{message.length} characters · {segs} SMS · {sale ? "from your latest sale" : "template preview"}</span>
                <button type="button" onClick={() => setTplOpen((v) => !v)}
                  className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft">
                  {tplOpen ? "Hide template" : "Edit templates"}
                </button>
                {tplOpen && (
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Message template
                    <textarea rows={4} maxLength={500} value={draft.smsTemplate} onChange={(e) => patch({ smsTemplate: e.target.value })}
                      className="resize-y rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm font-normal outline-none focus-visible:border-dash-accent" />
                    <span className="text-xs font-normal text-dash-muted">Use {"{customer}"}, {"{no}"}, {"{total}"} and {"{business}"}.</span>
                  </label>
                )}
              </section>

              <section className={cn(card, "flex flex-col gap-4 p-[22px]")}>
                <div>
                  <h2 className="font-dash-display text-lg font-bold">Quiet hours</h2>
                  <p className="mt-1 text-[13px] text-dash-muted">No app or SMS alerts to you during these hours.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">From
                    <input type="time" className={input} value={draft.quietFrom} onChange={(e) => patch({ quietFrom: e.target.value })} />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">To
                    <input type="time" className={input} value={draft.quietTo} onChange={(e) => patch({ quietTo: e.target.value })} />
                  </label>
                </div>
              </section>
            </aside>
          </div>

          <div className={cn(card, "sticky bottom-0 z-10 flex flex-wrap items-center gap-2.5 px-[18px] py-3.5 shadow-[0_-6px_20px_rgba(14,21,37,0.06)]")}>
            <span className={cn("text-[13px]", err ? "text-dash-danger-fg" : "text-dash-muted")}>
              {err || (dirty ? "You have unsaved changes." : "All changes saved.")}
            </span>
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={discard} className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft">Discard</button>
              <button type="button" onClick={save} disabled={saving || !dirty} className="h-11 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function GroupRows({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="border-t border-dash-border bg-dash-neutral-soft/50 px-5 pb-1.5 pt-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-dash-muted">{name}</td>
      </tr>
      {children}
    </>
  )
}
