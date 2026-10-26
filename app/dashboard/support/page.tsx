"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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

const STATUS_LABEL: Record<TicketStatus, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" }
const PRIORITY_LABEL: Record<TicketPriority, string> = { high: "High", medium: "Medium", low: "Low" }
const PRIORITY_VARIANT: Record<TicketPriority, "destructive" | "secondary" | "outline"> = { high: "destructive", medium: "secondary", low: "outline" }
const CATEGORY_LABEL: Record<TicketCategory, string> = { order: "Order", product: "Product", payment: "Payment", shipping: "Shipping", general: "General" }

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

function rel(iso?: string | null): string {
  if (!iso) return ""
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "Just now"
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  const d = Math.floor(s / 86400)
  return d === 1 ? "Yesterday" : d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function stamp(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? "" : `${rel(iso)} (${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})`
}
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

function formatFileSize(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1048576).toFixed(1)} MB`
}

function AttachmentList({ attachments }: { attachments: SupportMessage["attachments"] }) {
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
                <ItemActions className="text-xs font-semibold text-primary">Open</ItemActions>
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
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()) }, [])

  useEffect(() => {
    let cancelled = false
    setTicket(null); setReply(""); setAttachments([])
    supportApi.get(ticketId).then((t) => {
      if (cancelled) return
      setTicket(t)
      setTimeout(() => scrollDown("instant"), 50)
    }).catch(() => toast.error("Failed to load ticket"))
    return () => { cancelled = true }
  }, [ticketId, scrollDown])

  useEffect(() => subscribeToSupportTicket(ticketId, {
    onMessageSent: (id, message) => {
      const cur = ticketRef.current
      if (id !== ticketId || !cur || cur.messages.some((m) => m.id === message.id)) return
      const next = { ...cur, messages: [...cur.messages, message] }
      setTicket(next); onChanged(next)
      if (message.senderType === "customer") {
        playNotificationSound(); toast("Customer replied")
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
  }), [ticketId, onChanged, scrollDown])

  useEffect(() => { scrollDown() }, [ticket?.messages.length, scrollDown])

  const send = async () => {
    const body = reply.trim()
    if (!ticket || closed) return
    if (!body && attachments.length === 0) { toast.error("Type a message or attach a file"); return }
    setSending(true)
    try {
      const updated = await supportApi.reply(ticket.id, { body, attachments })
      setTicket(updated); onChanged(updated)
      setReply(""); setAttachments([])
      toast.success("Reply sent")
    } catch {
      toast.error("Failed to send reply")
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
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
      rec.start()
      setRecording(true)
    } catch {
      toast.error("Microphone access failed")
    }
  }

  const changeStatus = async (status: TicketStatus) => {
    if (!ticket) return
    try {
      const u = await supportApi.updateStatus(ticket.id, status)
      setTicket(u); onChanged(u)
      toast.success(`Status changed to ${STATUS_LABEL[status]}`)
    } catch { toast.error("Failed to update status") }
  }
  const changePriority = async (priority: TicketPriority) => {
    if (!ticket) return
    try {
      const u = await supportApi.updatePriority(ticket.id, priority)
      setTicket(u); onChanged(u)
      toast.success("Priority updated")
    } catch { toast.error("Failed to update priority") }
  }
  const remove = async () => {
    if (!ticket || !window.confirm(`Delete ticket ${ticket.ticketNumber}? This cannot be undone.`)) return
    try {
      await supportApi.delete(ticket.id)
      toast.success("Ticket deleted")
      onDeleted()
    } catch { toast.error("Failed to delete ticket") }
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
          <div className="text-xs text-muted-foreground">{ticket.ticketNumber} · {CATEGORY_LABEL[ticket.category]} · opened {fmtDate(ticket.createdAt)}</div>
          <h2 className="mt-0.5 break-words text-lg font-semibold">{ticket.subject}</h2>
          <div className="mt-0.5 text-sm text-muted-foreground">{ticket.customerName ?? "Customer"}{ticket.customerEmail ? ` · ${ticket.customerEmail}` : ""}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={ticket.status} onValueChange={(v) => changeStatus(v as TicketStatus)}>
            <SelectTrigger aria-label="Ticket status" className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(STATUS_LABEL) as TicketStatus[]).map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={ticket.priority} onValueChange={(v) => changePriority(v as TicketPriority)}>
            <SelectTrigger aria-label="Ticket priority" className={selectCls}><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((k) => <SelectItem key={k} value={k}>{PRIORITY_LABEL[k]}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="destructive" onClick={remove}>Delete</Button>
        </div>
      </div>
      <Separator />

      <div className="flex max-h-[480px] flex-1 flex-col gap-2.5 overflow-y-auto bg-muted/50 p-4">
        {ticket.messages.length === 0 && <EmptyState title="No messages yet" className="p-4 md:p-6" />}
        {ticket.messages.map((m) => {
          const mine = m.senderType === "staff"
          return (
            <div key={m.id} className={cn("flex flex-col gap-0.5", mine ? "items-end" : "items-start")}>
              <Card className={cn("max-w-[80%] gap-0 whitespace-pre-wrap break-words px-3 py-2.5 text-sm shadow-none", mine && "border-primary bg-primary text-primary-foreground")}>
                {m.body}
                <AttachmentList attachments={m.attachments} />
              </Card>
              <div className="text-xs text-muted-foreground">{mine ? (m.senderName || "Support Team") : (ticket.customerName || "Customer")} · {stamp(m.createdAt)}</div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <Separator />

      <div className="flex flex-col gap-2 p-3.5">
        {closed ? (
          <p className="text-sm text-muted-foreground">This ticket is closed. Change the status to reply.</p>
        ) : (
          <>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((f, i) => (
                  <Badge key={i} variant="outline" className="gap-1.5 pr-0.5">
                    {f.name}
                    <WithTooltip content="Remove attachment"><Button type="button" variant="ghost" size="icon-sm" className="size-5" aria-label="Remove attachment" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>×</Button></WithTooltip>
                  </Badge>
                ))}
              </div>
            )}
            <Textarea rows={2} value={reply} aria-label="Reply" placeholder="Reply to customer… (Ctrl+Enter to send)"
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send() } }}
              />
            <div className="flex flex-wrap items-center gap-2">
              <Input ref={fileRef} type="file" multiple hidden className="hidden" onChange={pickFiles} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>Attach file</Button>
              <Button type="button" variant={recording ? "destructive" : "outline"} onClick={toggleRecording}>{recording ? "Stop recording" : "Voice note"}</Button>
              <span className="flex-1" />
              <Button type="button" onClick={send} disabled={sending}>{sending ? "Sending…" : "Send"}</Button>
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

  useEffect(() => { const t = setTimeout(() => { setQD(q.trim()); setPage(1) }, 250); return () => clearTimeout(t) }, [q])

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
      setTickets(res.data.map((t) => (t.id === selectedRef.current ? { ...t, adminUnread: false } : t)))
      setTotal(res.meta?.total ?? res.data.length)
    } catch {
      if (!silent) toast.error("Failed to load tickets")
    } finally {
      if (!silent) setLoading(false)
    }
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

  const handleChanged = useCallback((t: SupportTicket) => {
    setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, adminUnread: false, status: t.status, priority: t.priority, messageCount: t.messages.length, updatedAt: t.updatedAt ?? x.updatedAt } : x)))
    fetchStats()
  }, [fetchStats])

  const refresh = async () => { await Promise.all([fetchTickets(), fetchStats()]); toast.success("Tickets refreshed") }

  const setF = <K extends keyof NewForm>(k: K, v: NewForm[K]) => { setForm((f) => ({ ...f, [k]: v })); setErr("") }

  const create = async () => {
    if (!form.customer.trim()) { setErr("Customer name is required."); return }
    if (!form.subject.trim()) { setErr("Subject is required."); return }
    setCreating(true)
    try {
      const t = await supportApi.create({
        customer_name: form.customer.trim(), subject: form.subject.trim(),
        category: form.category, priority: form.priority, description: form.desc.trim() || undefined,
      })
      toast.success("Ticket created")
      setShowNew(false); setForm(blankForm())
      setQ(""); setQD(""); setFStatus("all"); setFPriority("all"); setFUnread(false); setPage(1)
      select(t.id)
      fetchTickets(true); fetchStats()
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Failed to create ticket.")
    } finally {
      setCreating(false)
    }
  }

  if (blocked) return blocked

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Customer Support"
        description="Manage and respond to customer tickets"
        actions={<>
          <Button type="button" variant="outline" onClick={refresh}>Refresh</Button>
          <Button type="button" onClick={() => { setShowNew(true); setForm(blankForm()); setErr("") }}>+ New ticket</Button>
        </>}
      />

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[92px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: "Open", value: stats.open, icon: <AlertCircle className="size-4" />, color: "blue", onClick: () => { setFStatus("open"); setPage(1) }, active: fStatus === "open" },
          { label: "In Progress", value: stats.in_progress, icon: <Clock className="size-4" />, color: "yellow", onClick: () => { setFStatus("in_progress"); setPage(1) }, active: fStatus === "in_progress" },
          { label: "Resolved", value: stats.resolved, icon: <CheckCircle2 className="size-4" />, color: "green", onClick: () => { setFStatus("resolved"); setPage(1) }, active: fStatus === "resolved" },
          { label: "Total", value: stats.total, icon: <Ticket className="size-4" />, color: "purple", onClick: () => { setFStatus("all"); setPage(1) }, active: fStatus === "all" },
        ]} />
      )}

      {showNew && (
        <SectionCard
          role="region"
          aria-label="New ticket"
          title="New ticket"
          actions={<Button type="button" variant="outline" aria-label="Close" onClick={() => setShowNew(false)}>Close</Button>}
          contentClassName="flex flex-col gap-3.5"
        >
          {err && <Alert variant="destructive" role="alert"><AlertDescription>{err}</AlertDescription></Alert>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label="Customer name" required htmlFor="new-ticket-customer">
              <Input id="new-ticket-customer" value={form.customer} onChange={(e) => setF("customer", e.target.value)} placeholder="e.g. Rahim Uddin" /></FormField>
            <FormField label="Subject" required htmlFor="new-ticket-subject">
              <Input id="new-ticket-subject" value={form.subject} onChange={(e) => setF("subject", e.target.value)} placeholder="Short summary of the issue" /></FormField>
            <FormField label="Category" htmlFor="new-ticket-category">
              <Select value={form.category} onValueChange={(v) => setF("category", v as TicketCategory)}>
                <SelectTrigger id="new-ticket-category" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(CATEGORY_LABEL) as TicketCategory[]).map((k) => <SelectItem key={k} value={k}>{CATEGORY_LABEL[k]}</SelectItem>)}</SelectContent>
              </Select></FormField>
            <FormField label="Priority" htmlFor="new-ticket-priority">
              <Select value={form.priority} onValueChange={(v) => setF("priority", v as TicketPriority)}>
                <SelectTrigger id="new-ticket-priority" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((k) => <SelectItem key={k} value={k}>{PRIORITY_LABEL[k]}</SelectItem>)}</SelectContent>
              </Select></FormField>
          </div>
          <FormField label="Description" htmlFor="new-ticket-desc">
            <Textarea id="new-ticket-desc" rows={3} value={form.desc} onChange={(e) => setF("desc", e.target.value)} placeholder="Describe the problem" /></FormField>
          <div className="flex justify-end">
            <Button type="button" onClick={create} disabled={creating}>{creating ? "Creating…" : "Create ticket"}</Button>
          </div>
        </SectionCard>
      )}

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <Card role="region" aria-label="Tickets" className="w-full min-w-0 gap-0 py-0 lg:w-[380px] lg:shrink-0 xl:w-[420px]">
          <div className="flex flex-col gap-2.5 p-3.5">
            <div role="tablist" aria-label="Ticket filter" className="flex gap-1.5">
              {([[false, "All"], [true, "Unread"]] as const).map(([v, label]) => (
                <Button key={label} type="button" size="sm" variant={fUnread === v ? "default" : "outline"} role="tab" aria-selected={fUnread === v} onClick={() => { setFUnread(v); setPage(1) }}>
                  {label}
                  {v && (stats?.unread ?? 0) > 0 && <Badge variant="secondary" className="h-5 min-w-5 rounded-full px-1">{stats?.unread}</Badge>}
                </Button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="search" aria-label="Search tickets" placeholder="Search subject, customer or message…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
            </div>
            <div className="flex gap-2">
              <Select value={fStatus} onValueChange={(v) => { setFStatus(v); setPage(1) }}>
                <SelectTrigger aria-label="Status" className={selectCls}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Status</SelectItem>{(Object.keys(STATUS_LABEL) as TicketStatus[]).map((k) => <SelectItem key={k} value={k}>{STATUS_LABEL[k]}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={fPriority} onValueChange={(v) => { setFPriority(v); setPage(1) }}>
                <SelectTrigger aria-label="Priority" className={selectCls}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Priority</SelectItem>{(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((k) => <SelectItem key={k} value={k}>{PRIORITY_LABEL[k]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="flex max-h-[640px] flex-col overflow-y-auto">
            {loading ? (
              [1, 2, 3, 4].map((i) => <div key={i} className="p-3.5"><Skeleton className="h-16 w-full" /></div>)
            ) : tickets.length === 0 ? (
              <EmptyState title="No tickets found" className="p-4 md:p-6" />
            ) : tickets.map((t) => {
              const cur = t.id === selectedId
              return (
                <Button key={t.id} type="button" variant={cur ? "secondary" : "ghost"} aria-current={cur} onClick={() => select(t.id)}
                  className="h-auto w-full flex-col items-stretch gap-1.5 whitespace-normal text-left font-normal">
                  <span className="flex justify-between gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1.5">{t.adminUnread && <><Circle className="size-2 fill-primary text-primary" aria-hidden /><span className="sr-only">Unread</span></>}{t.ticketNumber}</span><span>{rel(t.updatedAt || t.createdAt)}</span></span>
                  <span className={cn("break-words text-sm", t.adminUnread ? "font-extrabold" : "font-bold")}>{t.subject}</span>
                  <span className="text-xs text-muted-foreground">{t.customerName || "Customer"} · {CATEGORY_LABEL[t.category]}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={t.status} label={STATUS_LABEL[t.status]} />
                    <Badge variant={PRIORITY_VARIANT[t.priority]}>{PRIORITY_LABEL[t.priority]}</Badge>
                    <span className="text-xs text-muted-foreground">{t.messageCount ?? t.messages.length} msg</span>
                    {t.adminUnread && <Badge>New</Badge>}
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

        <Card role="region" aria-label="Conversation" className="min-h-[420px] w-full min-w-0 flex-1 gap-0 py-0">
          {selectedId === null ? (
            <EmptyState icon={MessageSquare} title="Select a ticket to start chatting" />
          ) : (
            <ConversationPanel ticketId={selectedId} onChanged={handleChanged}
              onDeleted={() => { select(null); fetchTickets(true); fetchStats() }} />
          )}
        </Card>
      </div>
    </div>
  )
}
