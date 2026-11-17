"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import type { ParseKeys, TFunction } from "i18next"
import { localeTag } from "@/lib/i18n"
import { AlertCircle, CheckCircle2, Circle, Clock, MessageSquare, Search, Ticket } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { PaginationControl } from "@/components/ui/pagination-control"
import { subscribeToSupportCompany, subscribeToSupportTicket } from "@/lib/reverb"
import supportApi, {
  type SupportTicket, type TicketStats, type TicketStatus, type TicketPriority, type TicketCategory,
  type SupportMessage,
} from "@/lib/supportApi"
import { getCompanyId } from "@/lib/utils/apiInterceptor"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WithTooltip } from "@/components/common/WithTooltip"

const NS = ["commerce", "common"] as const
type Key = ParseKeys<typeof NS>
type T = TFunction<typeof NS>

const STATUS_LABEL: Record<TicketStatus, Key> = {
  open: "commerce:support.status.open", in_progress: "commerce:support.status.inProgress",
  resolved: "commerce:support.status.resolved", closed: "commerce:support.status.closed",
}
const PRIORITY_LABEL: Record<TicketPriority, Key> = { high: "commerce:support.priority.high", medium: "commerce:support.priority.medium", low: "commerce:support.priority.low" }
const PRIORITY_VARIANT: Record<TicketPriority, "destructive" | "secondary" | "outline"> = { high: "destructive", medium: "secondary", low: "outline" }
const CATEGORY_LABEL: Record<TicketCategory, Key> = {
  order: "commerce:support.category.order", product: "commerce:support.category.product", payment: "commerce:support.category.payment",
  shipping: "commerce:support.category.shipping", general: "commerce:support.category.general",
}
/** Translated label from a code map; unknown codes show as sent. */
const lbl = (t: T, map: Record<string, Key>, code: string) => (map[code] ? t(map[code]) : code)

const selectCls = "min-w-0 flex-1"

function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.35)
  } catch {}
}

function rel(t: T, tag: string, iso?: string | null): string {
  if (!iso) return ""
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return t("commerce:support.rel.justNow")
  if (s < 3600) return t("commerce:support.rel.minutes", { count: Math.floor(s / 60) })
  if (s < 86400) return t("commerce:support.rel.hours", { count: Math.floor(s / 3600) })
  const d = Math.floor(s / 86400)
  return d === 1 ? t("common:time.yesterday") : d < 30 ? t("commerce:support.rel.days", { count: d }) : new Date(iso).toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" })
}
function stamp(t: T, tag: string, iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? "" : `${rel(t, tag, iso)} (${d.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" })})`
}
const fmtDate = (tag: string, iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" }) : "—")

function formatFileSize(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function AttachmentList({ attachments }: { attachments: SupportMessage["attachments"] }) {
  const { t } = useTranslation(NS)
  if (!attachments?.length) return null
  return (
    <div className="mt-2 space-y-2">
      {attachments.map((a) => (
        <Card key={a.id} className="gap-0 overflow-hidden py-0 shadow-none">
          {a.isImage ? (
            <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.name} className="max-h-48 w-full object-cover" /></a>
          ) : a.isAudio ? (
            <div className="p-3">
              <p className="mb-2 text-xs font-semibold">{a.name}</p>
              <audio controls className="w-full"><source src={a.url} type={a.mimeType} /></audio>
            </div>
          ) : (
            <Item asChild size="sm" className="rounded-none">
              <a href={a.url} target="_blank" rel="noreferrer">
                <ItemContent className="min-w-0 gap-0"><ItemTitle className="w-full truncate text-xs">{a.name}</ItemTitle><ItemDescription className="text-xs">{formatFileSize(a.sizeBytes)}</ItemDescription></ItemContent>
                <ItemActions className="text-xs font-semibold text-primary">{t("commerce:support.open")}</ItemActions>
              </a>
            </Item>
          )}
        </Card>
      ))}
    </div>
  )
}

function ConversationPanel({ ticketId, onChanged, onDeleted }: {
  ticketId: number
  onChanged: (t: SupportTicket) => void
  onDeleted: () => void
}) {
  const { t, i18n } = useTranslation(NS)
  const tag = localeTag(i18n.language)
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [reply, setReply] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const ticketRef = useRef<SupportTicket | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const closed = ticket?.status === "closed"

  const scrollDown = useCallback((behavior: ScrollBehavior = "smooth") => { endRef.current?.scrollIntoView({ behavior }) }, [])
  useEffect(() => { ticketRef.current = ticket }, [ticket])
  useEffect(() => () => { streamRef.current?.getTracks().forEach((tr) => tr.stop()) }, [])

  useEffect(() => {
    let cancelled = false
    setTicket(null); setReply(""); setAttachments([])
    supportApi.get(ticketId).then((tk) => {
      if (cancelled) return
      setTicket(tk)
      setTimeout(() => scrollDown("instant"), 50)
    }).catch(() => toast.error(t("commerce:support.toast.loadTicketFailed")))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, scrollDown])

  useEffect(() => subscribeToSupportTicket(ticketId, {
    onMessageSent: (id, message) => {
      const cur = ticketRef.current
      if (id !== ticketId || !cur || cur.messages.some((m) => m.id === message.id)) return
      const next = { ...cur, messages: [...cur.messages, message] }
      setTicket(next); onChanged(next)
      if (message.senderType === "customer") {
        playNotificationSound(); toast(t("commerce:support.toast.customerReplied"))
        // The ticket is open on screen: re-fetching marks it read again on the server.
        void supportApi.get(ticketId).catch(() => {})
      }
      scrollDown()
    },
    onStatusUpdated: (id, status) => {
      const cur = ticketRef.current
      if (id !== ticketId || !cur) return
      const next = { ...cur, status }
      setTicket(next); onChanged(next)
    },
    onPriorityUpdated: (id, priority) => {
      const cur = ticketRef.current
      if (id !== ticketId || !cur) return
      const next = { ...cur, priority }
      setTicket(next); onChanged(next)
    },
  }), [ticketId, onChanged, scrollDown, t])

  useEffect(() => { scrollDown() }, [ticket?.messages.length, scrollDown])

  const send = async () => {
    const body = reply.trim()
    if (!ticket || closed) return
    if (!body && attachments.length === 0) { toast.error(t("commerce:support.toast.typeOrAttach")); return }
    setSending(true)
    try {
      const updated = await supportApi.reply(ticket.id, { body, attachments })
      setTicket(updated); onChanged(updated)
      setReply(""); setAttachments([])
      toast.success(t("commerce:support.toast.replySent"))
    } catch {
      toast.error(t("commerce:support.toast.replyFailed"))
    } finally {
      setSending(false)
    }
  }

  const pickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length) setAttachments((p) => [...p, ...files].slice(0, 5))
    e.target.value = ""
  }

  const toggleRecording = async () => {
    if (recording) { recorderRef.current?.stop(); recorderRef.current = null; setRecording(false); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      recorderRef.current = rec
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" })
        const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "m4a" : "webm"
        setAttachments((p) => [...p, new File([blob], `voice-message-${Date.now()}.${ext}`, { type: blob.type || "audio/webm" })].slice(0, 5))
        stream.getTracks().forEach((tr) => tr.stop())
        streamRef.current = null
      }
      rec.start()
      setRecording(true)
    } catch {
      toast.error(t("commerce:support.toast.micFailed"))
    }
  }

  const changeStatus = async (status: TicketStatus) => {
    if (!ticket) return
    try {
      const u = await supportApi.updateStatus(ticket.id, status)
      setTicket(u); onChanged(u)
      toast.success(t("commerce:support.toast.statusChanged", { status: t(STATUS_LABEL[status]) }))
    } catch { toast.error(t("commerce:support.toast.statusFailed")) }
  }
  const changePriority = async (priority: TicketPriority) => {
    if (!ticket) return
    try {
      const u = await supportApi.updatePriority(ticket.id, priority)
      setTicket(u); onChanged(u)
      toast.success(t("commerce:support.toast.priorityUpdated"))
    } catch { toast.error(t("commerce:support.toast.priorityFailed")) }
  }
  const remove = async () => {
    if (!ticket || !window.confirm(t("commerce:support.confirmDelete", { number: ticket.ticketNumber }))) return
    try {
      await supportApi.delete(ticket.id)
      toast.success(t("commerce:support.toast.deleted"))
      onDeleted()
    } catch { toast.error(t("commerce:support.toast.deleteFailed")) }
  }

  if (!ticket) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-6 w-56" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className={cn("h-12 w-3/4", i % 2 && "ml-auto")} />)}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1 basis-60">
          <div className="text-xs text-muted-foreground">{t("commerce:support.meta", { number: ticket.ticketNumber, category: lbl(t, CATEGORY_LABEL, ticket.category), date: fmtDate(tag, ticket.createdAt) })}</div>
          <h2 className="mt-0.5 break-words text-lg font-semibold">{ticket.subject}</h2>
          <div className="mt-0.5 text-sm text-muted-foreground">{ticket.customerName ?? t("common:fields.customer")}{ticket.customerEmail ? ` · ${ticket.customerEmail}` : ""}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={ticket.status} onValueChange={(v) => changeStatus(v as TicketStatus)}>
            <SelectTrigger aria-label={t("commerce:support.statusLabel")} className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(STATUS_LABEL) as TicketStatus[]).map((k) => <SelectItem key={k} value={k}>{t(STATUS_LABEL[k])}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ticket.priority} onValueChange={(v) => changePriority(v as TicketPriority)}>
            <SelectTrigger aria-label={t("commerce:support.priorityLabel")} className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((k) => <SelectItem key={k} value={k}>{t(PRIORITY_LABEL[k])}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="destructive" onClick={remove}>{t("common:actions.delete")}</Button>
        </div>
      </div>
      <Separator />

      <div className="flex max-h-[480px] flex-1 flex-col gap-2.5 overflow-y-auto bg-muted/50 p-4">
        {ticket.messages.length === 0 && <EmptyState title={t("commerce:support.noMessages")} className="p-4 md:p-6" />}
        {ticket.messages.map((m) => {
          const mine = m.senderType === "staff"
          return (
            <div key={m.id} className={cn("flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
              <Card className={cn("max-w-[80%] gap-0 whitespace-pre-wrap break-words px-3 py-2.5 text-sm shadow-none", mine && "border-primary bg-primary text-primary-foreground")}>
                {m.body}
                <AttachmentList attachments={m.attachments} />
              </Card>
              <div className="text-xs text-muted-foreground">{mine ? (m.senderName || t("commerce:support.supportTeam")) : (ticket.customerName || t("common:fields.customer"))} · {stamp(t, tag, m.createdAt)}</div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <Separator />

      <div className="flex flex-col gap-2 p-3.5">
        {closed ? (
          <p className="text-sm text-muted-foreground">{t("commerce:support.closedNote")}</p>
        ) : (
          <>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((f, i) => (
                  <Badge key={i} variant="outline" className="gap-1.5 pr-0.5">
                    {f.name}
                    <WithTooltip content={t("commerce:support.removeAttachment")}><Button type="button" variant="ghost" size="icon-sm" className="size-5" aria-label={t("commerce:support.removeAttachment")} onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>×</Button></WithTooltip>
                  </Badge>
                ))}
              </div>
            )}
            <Textarea rows={2} value={reply} aria-label={t("commerce:support.reply")} placeholder={t("commerce:support.replyPlaceholder")}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send() } }}
              />
            <div className="flex flex-wrap items-center gap-2">
              <Input ref={fileRef} type="file" multiple hidden className="hidden" onChange={pickFiles} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>{t("commerce:support.attachFile")}</Button>
              <Button type="button" variant={recording ? "destructive" : "outline"} onClick={toggleRecording}>{recording ? t("commerce:support.stopRecording") : t("commerce:support.voiceNote")}</Button>
              <span className="flex-1" />
              <Button type="button" onClick={send} disabled={sending}>{sending ? t("commerce:support.sending") : t("commerce:support.send")}</Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

interface NewForm { customer: string; subject: string; category: TicketCategory; priority: TicketPriority; desc: string }
const blankForm = (): NewForm => ({ customer: "", subject: "", category: "general", priority: "medium", desc: "" })

export default function SupportPage() {
  const { t, i18n } = useTranslation(NS)
  const tag = localeTag(i18n.language)
  const blocked = useModuleGuard("Support")
  const router = useRouter()
  const searchParams = useSearchParams()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [fStatus, setFStatus] = useState("all")
  const [fPriority, setFPriority] = useState("all")
  const [fUnread, setFUnread] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const n = Number(searchParams.get("ticket"))
    return Number.isFinite(n) && n > 0 ? n : null
  })

  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState<NewForm>(blankForm())
  const [err, setErr] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => { const timer = setTimeout(() => { setQD(q.trim()); setPage(1) }, 250); return () => clearTimeout(timer) }, [q])

  const selectedRef = useRef<number | null>(null)
  useEffect(() => { selectedRef.current = selectedId }, [selectedId])

  const fetchTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await supportApi.getAll({
        status: fStatus as TicketStatus | "all", priority: fPriority as TicketPriority | "all",
        search: qD || undefined, unread: fUnread || undefined, per_page: perPage, page,
      })
      // The ticket being read is never shown as unread (the server clears it on open).
      setTickets(res.data.map((tk) => (tk.id === selectedRef.current ? { ...tk, adminUnread: false } : tk)))
      setTotal(res.meta?.total ?? res.data.length)
    } catch {
      if (!silent) toast.error(t("commerce:support.toast.loadFailed"))
    } finally {
      if (!silent) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fStatus, fPriority, fUnread, qD, perPage, page])

  const fetchStats = useCallback(async () => {
    try { setStats(await supportApi.getStats()) } catch {}
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])
  useEffect(() => { fetchStats() }, [fetchStats])

  useEffect(() => {
    const companyId = getCompanyId()
    if (!companyId) return
    return subscribeToSupportCompany(companyId, {
      onTicketCreated: () => { fetchTickets(true); fetchStats() },
      onMessageSent: (_id, message) => {
        if (message.senderType === "customer") playNotificationSound()
        fetchTickets(true)
      },
      onStatusUpdated: () => { fetchTickets(true); fetchStats() },
      onPriorityUpdated: () => { fetchTickets(true) },
    })
  }, [fetchTickets, fetchStats])

  const select = (id: number | null) => {
    setSelectedId(id)
    if (id) {
      // Opening the ticket clears its unread marker on the server; mirror it locally.
      setTickets((prev) => prev.map((x) => (x.id === id ? { ...x, adminUnread: false } : x)))
      setStats((s) => (s && tickets.find((x) => x.id === id)?.adminUnread ? { ...s, unread: Math.max(0, (s.unread ?? 1) - 1) } : s))
    }
    const params = new URLSearchParams(searchParams.toString())
    if (id) params.set("ticket", String(id)); else params.delete("ticket")
    const qs = params.toString()
    router.replace(qs ? `/dashboard/support?${qs}` : "/dashboard/support", { scroll: false })
  }

  const handleChanged = useCallback((tk: SupportTicket) => {
    setTickets((prev) => prev.map((x) => (x.id === tk.id ? { ...x, adminUnread: false, status: tk.status, priority: tk.priority, messageCount: tk.messages.length, updatedAt: tk.updatedAt ?? x.updatedAt } : x)))
    fetchStats()
  }, [fetchStats])

  const refresh = async () => { await Promise.all([fetchTickets(), fetchStats()]); toast.success(t("commerce:support.toast.refreshed")) }

  const setF = <K extends keyof NewForm>(k: K, v: NewForm[K]) => { setForm((f) => ({ ...f, [k]: v })); setErr("") }

  const create = async () => {
    if (!form.customer.trim()) { setErr(t("commerce:support.customerRequired")); return }
    if (!form.subject.trim()) { setErr(t("commerce:support.subjectRequired")); return }
    setCreating(true)
    try {
      const created = await supportApi.create({
        customer_name: form.customer.trim(), subject: form.subject.trim(),
        category: form.category, priority: form.priority, description: form.desc.trim() || undefined,
      })
      toast.success(t("commerce:support.toast.created"))
      setShowNew(false); setForm(blankForm())
      setQ(""); setQD(""); setFStatus("all"); setFPriority("all"); setFUnread(false); setPage(1)
      select(created.id)
      fetchTickets(true); fetchStats()
    } catch (e: any) {
      setErr(e?.response?.data?.message || t("commerce:support.createFailed"))
    } finally {
      setCreating(false)
    }
  }

  if (blocked) return blocked

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("commerce:support.title")}
        description={t("commerce:support.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={refresh}>{t("common:actions.refresh")}</Button>
          <Button type="button" onClick={() => { setShowNew(true); setForm(blankForm()); setErr("") }}>{t("commerce:support.newTicket")}</Button>
        </>}
      />

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[92px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: t("commerce:support.status.open"), value: stats.open, icon: <AlertCircle className="size-4" />, color: "blue", onClick: () => { setFStatus("open"); setPage(1) }, active: fStatus === "open" },
          { label: t("commerce:support.status.inProgress"), value: stats.in_progress, icon: <Clock className="size-4" />, color: "yellow", onClick: () => { setFStatus("in_progress"); setPage(1) }, active: fStatus === "in_progress" },
          { label: t("commerce:support.status.resolved"), value: stats.resolved, icon: <CheckCircle2 className="size-4" />, color: "green", onClick: () => { setFStatus("resolved"); setPage(1) }, active: fStatus === "resolved" },
          { label: t("commerce:support.total"), value: stats.total, icon: <Ticket className="size-4" />, color: "purple", onClick: () => { setFStatus("all"); setPage(1) }, active: fStatus === "all" },
        ]} />
      )}

      {showNew && (
        <SectionCard
          role="region"
          aria-label={t("commerce:support.newTitle")}
          title={t("commerce:support.newTitle")}
          actions={<Button type="button" variant="outline" onClick={() => setShowNew(false)}>{t("common:actions.close")}</Button>}
          contentClassName="flex flex-col gap-3.5"
        >
          {err && <Alert variant="destructive" role="alert"><AlertDescription>{err}</AlertDescription></Alert>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label={t("commerce:support.customerName")} required htmlFor="new-ticket-customer">
              <Input id="new-ticket-customer" value={form.customer} onChange={(e) => setF("customer", e.target.value)} placeholder={t("commerce:support.customerPlaceholder")} /></FormField>
            <FormField label={t("commerce:support.subject")} required htmlFor="new-ticket-subject">
              <Input id="new-ticket-subject" value={form.subject} onChange={(e) => setF("subject", e.target.value)} placeholder={t("commerce:support.subjectPlaceholder")} /></FormField>
            <FormField label={t("common:fields.category")} htmlFor="new-ticket-category">
              <Select value={form.category} onValueChange={(v) => setF("category", v as TicketCategory)}>
                <SelectTrigger id="new-ticket-category" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(CATEGORY_LABEL) as TicketCategory[]).map((k) => <SelectItem key={k} value={k}>{t(CATEGORY_LABEL[k])}</SelectItem>)}</SelectContent>
              </Select></FormField>
            <FormField label={t("commerce:support.priorityField")} htmlFor="new-ticket-priority">
              <Select value={form.priority} onValueChange={(v) => setF("priority", v as TicketPriority)}>
                <SelectTrigger id="new-ticket-priority" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((k) => <SelectItem key={k} value={k}>{t(PRIORITY_LABEL[k])}</SelectItem>)}</SelectContent>
              </Select></FormField>
          </div>
          <FormField label={t("common:fields.description")} htmlFor="new-ticket-desc">
            <Textarea id="new-ticket-desc" rows={3} value={form.desc} onChange={(e) => setF("desc", e.target.value)} placeholder={t("commerce:support.descPlaceholder")} /></FormField>
          <div className="flex justify-end">
            <Button type="button" onClick={create} disabled={creating}>{creating ? t("commerce:support.creating") : t("commerce:support.create")}</Button>
          </div>
        </SectionCard>
      )}

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <Card role="region" aria-label={t("commerce:support.tickets")} className="w-full min-w-0 gap-0 py-0 lg:w-[380px] lg:shrink-0 xl:w-[420px]">
          <div className="flex flex-col gap-2.5 p-3.5">
            <div role="tablist" aria-label={t("commerce:support.filterLabel")} className="flex gap-1.5">
              {([[false, t("common:status.all")], [true, t("commerce:support.unread")]] as const).map(([v, label]) => (
                <Button key={String(v)} type="button" size="sm" variant={fUnread === v ? "default" : "outline"} role="tab" aria-selected={fUnread === v} onClick={() => { setFUnread(v); setPage(1) }}>
                  {label}
                  {v && (stats?.unread ?? 0) > 0 && <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1">{stats?.unread}</Badge>}
                </Button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="search" aria-label={t("commerce:support.searchLabel")} placeholder={t("commerce:support.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
            </div>
            <div className="flex gap-2">
              <Select value={fStatus} onValueChange={(v) => { setFStatus(v); setPage(1) }}>
                <SelectTrigger aria-label={t("common:fields.status")} className={selectCls}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("commerce:support.allStatus")}</SelectItem>{(Object.keys(STATUS_LABEL) as TicketStatus[]).map((k) => <SelectItem key={k} value={k}>{t(STATUS_LABEL[k])}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={fPriority} onValueChange={(v) => { setFPriority(v); setPage(1) }}>
                <SelectTrigger aria-label={t("commerce:support.priorityField")} className={selectCls}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("commerce:support.allPriority")}</SelectItem>{(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((k) => <SelectItem key={k} value={k}>{t(PRIORITY_LABEL[k])}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="flex max-h-[640px] flex-col overflow-y-auto">
            {loading ? (
              [1, 2, 3, 4].map((i) => <div key={i} className="p-3.5"><Skeleton className="h-16 w-full" /></div>)
            ) : tickets.length === 0 ? (
              <EmptyState title={t("commerce:support.noTickets")} className="p-4 md:p-6" />
            ) : tickets.map((tk) => {
              const cur = tk.id === selectedId
              return (
                <Button key={tk.id} type="button" variant={cur ? "secondary" : "ghost"} aria-current={cur} onClick={() => select(tk.id)}
                  className="h-auto w-full flex-col items-stretch gap-1.5 whitespace-normal text-left font-normal">
                  <span className="flex justify-between gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5">{tk.adminUnread && <><Circle className="size-2 fill-primary text-primary" aria-hidden /><span className="sr-only">{t("commerce:support.unread")}</span></>}{tk.ticketNumber}</span><span>{rel(t, tag, tk.updatedAt || tk.createdAt)}</span></span>
                  <span className={cn("break-words text-sm", tk.adminUnread ? "font-extrabold" : "font-bold")}>{tk.subject}</span>
                  <span className="text-xs text-muted-foreground">{tk.customerName || t("common:fields.customer")} · {lbl(t, CATEGORY_LABEL, tk.category)}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={tk.status} label={lbl(t, STATUS_LABEL, tk.status)} />
                    <Badge variant={PRIORITY_VARIANT[tk.priority]}>{lbl(t, PRIORITY_LABEL, tk.priority)}</Badge>
                    <span className="text-xs text-muted-foreground">{t("commerce:support.msgCount", { count: tk.messageCount ?? tk.messages.length })}</span>
                    {tk.adminUnread && <Badge>{t("commerce:support.newBadge")}</Badge>}
                  </span>
                </Button>
              )
            })}
          </div>
          {total > 0 && (
            <div className="px-3 pb-3">
              <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            </div>
          )}
        </Card>

        <Card role="region" aria-label={t("commerce:support.conversation")} className="min-h-[420px] w-full min-w-0 flex-1 gap-0 py-0">
          {selectedId === null ? (
            <EmptyState icon={MessageSquare} title={t("commerce:support.selectTicket")} />
          ) : (
            <ConversationPanel ticketId={selectedId} onChanged={handleChanged}
              onDeleted={() => { select(null); fetchTickets(true); fetchStats() }} />
          )}
        </Card>
      </div>
    </div>
  )
}
