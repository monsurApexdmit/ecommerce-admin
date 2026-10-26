"use client"

import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, Clock, Search, Ticket } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { subscribeToSupportCompany, subscribeToSupportTicket } from "@/lib/reverb"
import supportApi, {
  type SupportTicket, type TicketStats, type TicketStatus, type TicketPriority, type TicketCategory,
  type SupportMessage,
} from "@/lib/supportApi"
import { getCompanyId } from "@/lib/utils/apiInterceptor"
import { useModuleGuard } from "@/hooks/use-module-guard"

const STATUS_LABEL: Record<TicketStatus, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" }
const STATUS_STYLE: Record<TicketStatus, string> = {
  open: "bg-dash-accent-soft text-dash-accent-fg",
  in_progress: "bg-dash-warn-soft text-dash-warn-fg",
  resolved: "bg-dash-success-soft text-dash-success-fg",
  closed: "bg-dash-neutral-soft text-dash-neutral-fg",
}
const PRIORITY_LABEL: Record<TicketPriority, string> = { high: "High", medium: "Medium", low: "Low" }
const PRIORITY_DOT: Record<TicketPriority, string> = { high: "bg-dash-danger-fg", medium: "bg-amber-500", low: "bg-slate-300" }
const CATEGORY_LABEL: Record<TicketCategory, string> = { order: "Order", product: "Product", payment: "Payment", shipping: "Shipping", general: "General" }

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const selectCls = "h-10 min-w-0 flex-1 rounded-[10px] border border-dash-border bg-dash-card px-2.5 text-[13px] outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft disabled:opacity-60"
const primaryBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"

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
        <div key={a.id} className="overflow-hidden rounded-[10px] border border-dash-border bg-dash-card text-dash-ink">
          {a.isImage ? (
            <a href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.name} className="max-h-48 w-full object-cover" /></a>
          ) : a.isAudio ? (
            <div className="p-3">
              <p className="mb-2 text-xs font-semibold">{a.name}</p>
              <audio controls className="w-full"><source src={a.url} type={a.mimeType} /></audio>
            </div>
          ) : (
            <a href={a.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 p-3 text-xs hover:bg-dash-neutral-soft">
              <span className="min-w-0"><span className="block truncate font-semibold">{a.name}</span><span className="text-dash-muted">{formatFileSize(a.sizeBytes)}</span></span>
              <span className="font-semibold text-dash-accent">Open</span>
            </a>
          )}
        </div>
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
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-3/4" style={{ marginLeft: i % 2 ? "auto" : undefined }} />)}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-dash-border-soft p-4">
        <div className="min-w-0 flex-1 basis-60">
          <div className="text-xs text-dash-muted">{ticket.ticketNumber} · {CATEGORY_LABEL[ticket.category]} · opened {fmtDate(ticket.createdAt)}</div>
          <h2 className="mt-0.5 break-words font-dash-display text-lg font-bold">{ticket.subject}</h2>
          <div className="mt-0.5 text-[13px] text-dash-muted">{ticket.customerName ?? "Customer"}{ticket.customerEmail ? ` · ${ticket.customerEmail}` : ""}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Ticket status" value={ticket.status} onChange={(e) => changeStatus(e.target.value as TicketStatus)} className={selectCls}>
            {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
          </select>
          <select aria-label="Ticket priority" value={ticket.priority} onChange={(e) => changePriority(e.target.value as TicketPriority)} className={selectCls}>
            {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((k) => <option key={k} value={k}>{PRIORITY_LABEL[k]}</option>)}
          </select>
          <button type="button" onClick={remove} className={`${outlineBtn} text-dash-danger-fg`}>Delete</button>
        </div>
      </div>

      <div className="flex max-h-[480px] flex-1 flex-col gap-2.5 overflow-y-auto bg-dash-bg p-4">
        {ticket.messages.length === 0 && <p className="my-6 text-center text-sm text-dash-muted">No messages yet</p>}
        {ticket.messages.map((m) => {
          const mine = m.senderType === "staff"
          return (
            <div key={m.id} className={`flex flex-col gap-0.5 ${mine ? "items-end" : "items-start"}`}>
              <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-xl border px-3 py-2.5 text-sm ${mine ? "border-dash-accent bg-dash-accent text-white" : "border-dash-border bg-dash-card text-dash-ink"}`}>
                {m.body}
                <AttachmentList attachments={m.attachments} />
              </div>
              <div className="text-[11px] text-dash-muted">{mine ? (m.senderName || "Support Team") : (ticket.customerName || "Customer")} · {stamp(m.createdAt)}</div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <div className="flex flex-col gap-2 border-t border-dash-border-soft p-3.5">
        {closed ? (
          <p className="text-[13px] text-dash-muted">This ticket is closed. Change the status to reply.</p>
        ) : (
          <>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-bg px-2 py-1 text-xs">
                    {f.name}
                    <button type="button" aria-label="Remove attachment" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="text-dash-danger-fg">×</button>
                  </span>
                ))}
              </div>
            )}
            <textarea rows={2} value={reply} aria-label="Reply" placeholder="Reply to customer… (Ctrl+Enter to send)"
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send() } }}
              className="w-full resize-y rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm outline-none focus-visible:border-dash-accent" />
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" multiple hidden onChange={pickFiles} />
              <button type="button" onClick={() => fileRef.current?.click()} className={outlineBtn}>Attach file</button>
              <button type="button" onClick={toggleRecording} className={`${outlineBtn} ${recording ? "!border-dash-danger-fg !bg-dash-danger-fg text-white hover:!bg-dash-danger-fg" : ""}`}>{recording ? "Stop recording" : "Voice note"}</button>
              <span className="flex-1" />
              <button type="button" onClick={send} disabled={sending} className={primaryBtn}>{sending ? "Sending…" : "Send"}</button>
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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Customer Support</h1>
          <p className="mt-1 text-sm text-dash-muted">Manage and respond to customer tickets</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refresh} className={outlineBtn}>Refresh</button>
          <button type="button" onClick={() => { setShowNew(true); setForm(blankForm()); setErr("") }} className={`${primaryBtn} !h-10 text-[13px]`}>+ New ticket</button>
        </div>
      </div>

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[92px] rounded-[14px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: "Open", value: stats.open, icon: <AlertCircle className="size-4" />, color: "blue", onClick: () => { setFStatus("open"); setPage(1) }, active: fStatus === "open" },
          { label: "In Progress", value: stats.in_progress, icon: <Clock className="size-4" />, color: "yellow", onClick: () => { setFStatus("in_progress"); setPage(1) }, active: fStatus === "in_progress" },
          { label: "Resolved", value: stats.resolved, icon: <CheckCircle2 className="size-4" />, color: "green", onClick: () => { setFStatus("resolved"); setPage(1) }, active: fStatus === "resolved" },
          { label: "Total", value: stats.total, icon: <Ticket className="size-4" />, color: "purple", onClick: () => { setFStatus("all"); setPage(1) }, active: fStatus === "all" },
        ]} />
      )}

      {showNew && (
        <section aria-label="New ticket" className="flex flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-dash-display text-lg font-bold">New ticket</h2>
            <button type="button" aria-label="Close" onClick={() => setShowNew(false)} className={outlineBtn}>Close</button>
          </div>
          {err && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Customer name *
              <input className={input} value={form.customer} onChange={(e) => setF("customer", e.target.value)} placeholder="e.g. Rahim Uddin" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Subject *
              <input className={input} value={form.subject} onChange={(e) => setF("subject", e.target.value)} placeholder="Short summary of the issue" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Category
              <select className={input} value={form.category} onChange={(e) => setF("category", e.target.value as TicketCategory)}>
                {(Object.keys(CATEGORY_LABEL) as TicketCategory[]).map((k) => <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>)}
              </select></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Priority
              <select className={input} value={form.priority} onChange={(e) => setF("priority", e.target.value as TicketPriority)}>
                {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((k) => <option key={k} value={k}>{PRIORITY_LABEL[k]}</option>)}
              </select></label>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Description
            <textarea rows={3} value={form.desc} onChange={(e) => setF("desc", e.target.value)} placeholder="Describe the problem"
              className="resize-y rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm font-normal outline-none focus-visible:border-dash-accent" /></label>
          <div className="flex justify-end">
            <button type="button" onClick={create} disabled={creating} className={primaryBtn}>{creating ? "Creating…" : "Create ticket"}</button>
          </div>
        </section>
      )}

      <div className="flex flex-col items-start gap-4 lg:flex-row">
        <section aria-label="Tickets" className="w-full min-w-0 rounded-[14px] border border-dash-border bg-dash-card lg:w-[380px] lg:shrink-0 xl:w-[420px]">
          <div className="flex flex-col gap-2.5 border-b border-dash-border-soft p-3.5">
            <div role="tablist" aria-label="Ticket filter" className="flex gap-1.5">
              {([[false, "All"], [true, "Unread"]] as const).map(([v, label]) => (
                <button key={label} type="button" role="tab" aria-selected={fUnread === v} onClick={() => { setFUnread(v); setPage(1) }}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold ${fUnread === v ? "bg-dash-accent text-white" : "border border-dash-border bg-dash-card hover:bg-dash-neutral-soft"}`}>
                  {label}
                  {v && (stats?.unread ?? 0) > 0 && <span className={`rounded-full px-1.5 text-[11px] ${fUnread === v ? "bg-white/25" : "bg-dash-accent-soft text-dash-accent-fg"}`}>{stats?.unread}</span>}
                </button>
              ))}
            </div>
            <label className="flex h-[42px] items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3 text-dash-muted">
              <Search className="size-4" aria-hidden /><span className="sr-only">Search tickets</span>
              <input type="search" placeholder="Search subject, customer or message…" value={q} onChange={(e) => setQ(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
            </label>
            <div className="flex gap-2">
              <select aria-label="Status" value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(1) }} className={selectCls}>
                <option value="all">All Status</option>
                {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
              </select>
              <select aria-label="Priority" value={fPriority} onChange={(e) => { setFPriority(e.target.value); setPage(1) }} className={selectCls}>
                <option value="all">All Priority</option>
                {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((k) => <option key={k} value={k}>{PRIORITY_LABEL[k]}</option>)}
              </select>
            </div>
          </div>
          <div className="flex max-h-[640px] flex-col overflow-y-auto">
            {loading ? (
              [1, 2, 3, 4].map((i) => <div key={i} className="border-b border-dash-border-soft p-3.5"><Skeleton className="h-16 w-full" /></div>)
            ) : tickets.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-dash-muted">No tickets found</div>
            ) : tickets.map((t) => {
              const cur = t.id === selectedId
              return (
                <button key={t.id} type="button" aria-current={cur} onClick={() => select(t.id)}
                  className={`flex w-full flex-col gap-1.5 border-b border-l-[3px] border-b-dash-border-soft px-3.5 py-3 text-left ${cur ? "border-l-dash-accent bg-dash-accent-soft" : "border-l-transparent bg-dash-card hover:bg-dash-neutral-soft"}`}>
                  <span className="flex justify-between gap-2 text-xs text-dash-muted"><span className="flex items-center gap-1.5">{t.adminUnread && <span aria-label="Unread" className="size-2 rounded-full bg-dash-accent" />}{t.ticketNumber}</span><span>{rel(t.updatedAt || t.createdAt)}</span></span>
                  <span className={`break-words text-sm ${t.adminUnread ? "font-extrabold" : "font-bold"}`}>{t.subject}</span>
                  <span className="text-xs text-dash-muted">{t.customerName || "Customer"} · {CATEGORY_LABEL[t.category]}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-dash-muted"><span className={`size-2 rounded-full ${PRIORITY_DOT[t.priority]}`} />{PRIORITY_LABEL[t.priority]}</span>
                    <span className="text-[11px] text-dash-muted">{t.messageCount ?? t.messages.length} msg</span>
                    {t.adminUnread && <span className="rounded-full bg-dash-accent px-2 py-0.5 text-[11px] font-bold text-white">New</span>}
                  </span>
                </button>
              )
            })}
          </div>
          {total > 0 && (
            <div className="px-3 pb-3">
              <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            </div>
          )}
        </section>

        <section aria-label="Conversation" className="flex min-h-[420px] w-full min-w-0 flex-1 flex-col rounded-[14px] border border-dash-border bg-dash-card">
          {selectedId === null ? (
            <div className="m-auto px-4 py-10 text-center text-sm text-dash-muted">Select a ticket to start chatting</div>
          ) : (
            <ConversationPanel ticketId={selectedId} onChanged={handleChanged}
              onDeleted={() => { select(null); fetchTickets(true); fetchStats() }} />
          )}
        </section>
      </div>
    </div>
  )
}
