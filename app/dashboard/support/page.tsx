"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Headphones, Search, Trash2, MessageSquare,
  AlertCircle, Clock, CheckCircle2, XCircle,
  Loader2, Send, RefreshCw, Plus,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { useToast } from "@/hooks/use-toast"
import { subscribeToSupportCompany, subscribeToSupportTicket } from "@/lib/reverb"
import supportApi, {
  type SupportTicket, type TicketStats, type TicketStatus, type TicketPriority,
  type SupportMessage,
} from "@/lib/supportApi"
import { getCompanyId } from "@/lib/utils/apiInterceptor"

// ── Sound ─────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return "Just now"
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return "Yesterday"
  return new Date(dateStr).toLocaleDateString()
}

function hasNewIncomingMessage(previous: SupportTicket | null, next: SupportTicket): boolean {
  if (!previous) return false

  return next.messages.some((message) => {
    if (message.senderType !== "customer") return false
    return !previous.messages.some((existing) => existing.id === message.id)
  })
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: any }> = {
  open:        { label: "Open",        color: "bg-blue-100 text-blue-700",    icon: AlertCircle },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  resolved:    { label: "Resolved",    color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  closed:      { label: "Closed",      color: "bg-gray-100 text-gray-600",    icon: XCircle },
}

const PRIORITY_CONFIG: Record<TicketPriority, { label: string; dot: string }> = {
  high:   { label: "High",   dot: "bg-red-500" },
  medium: { label: "Medium", dot: "bg-orange-400" },
  low:    { label: "Low",    dot: "bg-gray-300" },
}

const CATEGORY_LABELS: Record<string, string> = {
  order: "Order", product: "Product", payment: "Payment",
  shipping: "Shipping", general: "General",
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  )
}

// ── Chat Panel ────────────────────────────────────────────────────
function ChatPanel({ ticketId, onTicketUpdate }: {
  ticketId: number
  onTicketUpdate: (t: SupportTicket) => void
}) {
  const { toast } = useToast()
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updatingPriority, setUpdatingPriority] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const optimisticIds = useRef<Set<number>>(new Set())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const ticketRef = useRef<SupportTicket | null>(null)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }, [])

  useEffect(() => {
    ticketRef.current = ticket
  }, [ticket])

  // Initial load
  useEffect(() => {
    let cancelled = false
    setTicket(null)
    supportApi.get(ticketId).then((t) => {
      if (cancelled) return
      setTicket(t)
      setTimeout(() => scrollToBottom("instant"), 50)
    }).catch(() => toast({ variant: "destructive", title: "Failed to load ticket" }))
    return () => { cancelled = true }
  }, [ticketId])

  useEffect(() => {
    return subscribeToSupportTicket(ticketId, {
      onMessageSent: (id, message) => {
        if (id !== ticketId || optimisticIds.current.has(message.id)) return

        const current = ticketRef.current
        if (!current || current.messages.some((existing) => existing.id === message.id)) return

        const next = { ...current, messages: [...current.messages, message] }
        setTicket(next)
        onTicketUpdate(next)

        if (message.senderType === "customer") {
          playNotificationSound()
          toast({ title: "Customer replied", description: "New message on ticket" })
        }

        scrollToBottom()
      },
      onStatusUpdated: (id, status) => {
        if (id !== ticketId) return

        const current = ticketRef.current
        if (!current) return

        const next = { ...current, status }
        setTicket(next)
        onTicketUpdate(next)
      },
      onPriorityUpdated: (id, priority) => {
        if (id !== ticketId) return

        const current = ticketRef.current
        if (!current) return

        const next = { ...current, priority }
        setTicket(next)
        onTicketUpdate(next)
      },
    })
  }, [ticketId, onTicketUpdate, scrollToBottom, toast])

  useEffect(() => {
    let cancelled = false

    const interval = setInterval(async () => {
      try {
        const latest = await supportApi.get(ticketId)
        if (cancelled) return

        if (hasNewIncomingMessage(ticketRef.current, latest)) {
          playNotificationSound()
          toast({ title: "Customer replied", description: "New message on ticket" })
        }

        setTicket(latest)
        onTicketUpdate(latest)
      } catch {}
    }, 60000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [ticketId, onTicketUpdate, toast])

  useEffect(() => { scrollToBottom() }, [ticket?.messages.length])

  const sendReply = async () => {
    if (!reply.trim() || !ticket) return
    setSending(true)
    const body = reply.trim()
    const optimisticId = Date.now()
    const optimistic: SupportMessage = {
      id: optimisticId,
      ticketId: ticket.id,
      customerId: null,
      body,
      senderType: "staff",
      senderName: "Support Team",
      createdAt: new Date().toISOString(),
    }
    optimisticIds.current.add(optimisticId)
    setTicket((prev) => prev ? { ...prev, messages: [...prev.messages, optimistic] } : prev)
    setReply("")
    scrollToBottom()

    try {
      const updated = await supportApi.reply(ticket.id, body)
      setTicket(updated)
      onTicketUpdate(updated)
    } catch {
      setTicket((prev) => prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimisticId) } : prev)
      setReply(body)
      toast({ variant: "destructive", title: "Failed to send reply" })
    } finally {
      optimisticIds.current.delete(optimisticId)
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  const changeStatus = async (status: TicketStatus) => {
    if (!ticket) return
    setUpdatingStatus(true)
    try {
      const updated = await supportApi.updateStatus(ticket.id, status)
      setTicket(updated)
      onTicketUpdate(updated)
    } catch {
      toast({ variant: "destructive", title: "Failed to update status" })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const changePriority = async (priority: TicketPriority) => {
    if (!ticket) return
    setUpdatingPriority(true)
    try {
      const updated = await supportApi.updatePriority(ticket.id, priority)
      setTicket(updated)
      onTicketUpdate(updated)
    } catch {
      toast({ variant: "destructive", title: "Failed to update priority" })
    } finally {
      setUpdatingPriority(false)
    }
  }

  if (!ticket) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b"><Skeleton className="h-5 w-48" /></div>
        <div className="flex-1 p-4 space-y-3">
          {[0,1,2].map(i => <Skeleton key={i} className="h-12 w-3/4" style={{ marginLeft: i % 2 !== 0 ? "auto" : undefined }} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with controls */}
      <div className="shrink-0 border-b bg-gray-50 px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-gray-400">{ticket.ticketNumber}</span>
              <StatusBadge status={ticket.status} />
              <span className={`w-2 h-2 rounded-full inline-block ${PRIORITY_CONFIG[ticket.priority].dot}`} title={PRIORITY_CONFIG[ticket.priority].label} />
              <Badge variant="outline" className="text-xs">{CATEGORY_LABELS[ticket.category]}</Badge>
            </div>
            <p className="font-semibold text-sm mt-1 truncate">{ticket.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 flex-wrap">
          <span className="font-medium text-gray-900">{ticket.customerName ?? "Guest"}</span>
          {ticket.customerEmail && <span className="text-gray-400 text-xs">{ticket.customerEmail}</span>}
          <span className="text-xs text-gray-400 ml-auto">{relativeTime(ticket.createdAt)}</span>
        </div>
        <div className="flex gap-2">
          <Select value={ticket.status} onValueChange={(v) => changeStatus(v as TicketStatus)} disabled={updatingStatus}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ticket.priority} onValueChange={(v) => changePriority(v as TicketPriority)} disabled={updatingPriority}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high" className="text-xs">High</SelectItem>
              <SelectItem value="medium" className="text-xs">Medium</SelectItem>
              <SelectItem value="low" className="text-xs">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {ticket.messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No messages yet</p>
        )}
        {ticket.messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1 ${msg.senderType === "staff" ? "items-end" : "items-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.senderType === "staff"
                ? "bg-emerald-600 text-white rounded-br-sm"
                : "bg-gray-100 text-gray-900 rounded-bl-sm"
            }`}>
              {msg.body}
            </div>
            <span className="text-xs text-gray-400 px-1">
              {msg.senderName ?? (msg.senderType === "staff" ? "Support Team" : "Customer")}
              {" · "}{relativeTime(msg.createdAt)}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply input */}
      <div className="shrink-0 border-t p-3 bg-gray-50">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply() } }}
            rows={1}
            placeholder="Reply to customer… (Enter to send)"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 max-h-28 overflow-y-auto"
            style={{ minHeight: "42px" }}
          />
          <Button
            onClick={sendReply}
            disabled={sending || !reply.trim()}
            className="shrink-0 w-10 h-10 p-0 bg-emerald-600 hover:bg-emerald-700"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-1 ml-1">Shift+Enter for new line</p>
      </div>
    </div>
  )
}

// ── Ticket List Sidebar ───────────────────────────────────────────
function TicketListSidebar({ tickets, selectedId, onSelect, loading, search, onSearch, statusFilter, onStatus, priorityFilter, onPriority, onDelete, deleting }: {
  tickets: SupportTicket[]
  selectedId: number | null
  onSelect: (t: SupportTicket) => void
  loading: boolean
  search: string
  onSearch: (v: string) => void
  statusFilter: string
  onStatus: (v: string) => void
  priorityFilter: string
  onPriority: (v: string) => void
  onDelete: (id: number) => void
  deleting: number | null
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="shrink-0 p-3 border-b space-y-2 bg-gray-50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input
            className="pl-8 h-8 text-xs"
            placeholder="Search tickets…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={onStatus}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Status</SelectItem>
              <SelectItem value="open" className="text-xs">Open</SelectItem>
              <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
              <SelectItem value="resolved" className="text-xs">Resolved</SelectItem>
              <SelectItem value="closed" className="text-xs">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={onPriority}>
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Priority</SelectItem>
              <SelectItem value="high" className="text-xs">High</SelectItem>
              <SelectItem value="medium" className="text-xs">Medium</SelectItem>
              <SelectItem value="low" className="text-xs">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-2">
            {[0,1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
            <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No tickets found</p>
          </div>
        ) : (
          <div className="divide-y">
            {tickets.map((ticket) => {
              const isActive = ticket.id === selectedId
              return (
                <div
                  key={ticket.id}
                  onClick={() => onSelect(ticket)}
                  className={`px-3 py-3 cursor-pointer group transition-colors ${
                    isActive ? "bg-emerald-50 border-l-2 border-emerald-500" : "hover:bg-gray-50 border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <StatusBadge status={ticket.status} />
                        <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_CONFIG[ticket.priority].dot}`} />
                      </div>
                      <p className={`text-xs font-medium truncate ${isActive ? "text-emerald-800" : "text-gray-900"}`}>
                        {ticket.subject}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ticket.customerName ?? "Guest"} · {relativeTime(ticket.createdAt)}
                      </p>
                      <p className="text-xs text-gray-400">{ticket.messages.length} messages</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(ticket.id) }}
                      disabled={deleting === ticket.id}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:text-red-500"
                    >
                      {deleting === ticket.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
export default function SupportPage() {
  const { toast } = useToast()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchTickets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await supportApi.getAll({
        status:   statusFilter !== "all" ? statusFilter as TicketStatus : undefined,
        priority: priorityFilter !== "all" ? priorityFilter as TicketPriority : undefined,
        search:   search || undefined,
        per_page: 100,
      })
      setTickets(res.data)
    } catch {
      if (!silent) toast({ variant: "destructive", title: "Failed to load tickets" })
    } finally {
      if (!silent) setLoading(false)
    }
  }, [statusFilter, priorityFilter, search])

  const fetchStats = useCallback(async () => {
    try { setStats(await supportApi.getStats()) } catch {}
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])
  useEffect(() => { fetchStats() }, [fetchStats])

  // Select first ticket automatically
  useEffect(() => {
    if (tickets.length > 0 && selectedId === null) {
      setSelectedId(tickets[0].id)
    }
  }, [tickets])

  useEffect(() => {
    const companyId = getCompanyId()
    if (!companyId) return

    return subscribeToSupportCompany(companyId, {
      onTicketCreated: (ticket) => {
        setTickets((prev) => prev.some((existing) => existing.id === ticket.id) ? prev : [ticket, ...prev])
        fetchStats()
      },
      onMessageSent: (ticketId, message) => {
        if (message.senderType === "customer") {
          playNotificationSound()
        }

        supportApi.get(ticketId).then((updated) => {
          setTickets((prev) => {
            const exists = prev.some((ticket) => ticket.id === updated.id)
            if (!exists) return [updated, ...prev]
            return prev.map((ticket) => ticket.id === updated.id ? updated : ticket)
          })
        }).catch(() => {})
      },
      onStatusUpdated: (ticketId, status) => {
        setTickets((prev) => prev.map((ticket) => ticket.id === ticketId ? { ...ticket, status } : ticket))
        fetchStats()
      },
      onPriorityUpdated: (ticketId, priority) => {
        setTickets((prev) => prev.map((ticket) => ticket.id === ticketId ? { ...ticket, priority } : ticket))
      },
    })
  }, [fetchStats])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchTickets(true)
      fetchStats()
    }, 60000)

    return () => clearInterval(interval)
  }, [fetchStats, fetchTickets])

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      await supportApi.delete(id)
      setTickets((prev) => prev.filter((t) => t.id !== id))
      if (selectedId === id) setSelectedId(tickets.find((t) => t.id !== id)?.id ?? null)
      fetchStats()
      toast({ title: "Ticket deleted" })
    } catch {
      toast({ variant: "destructive", title: "Failed to delete ticket" })
    } finally {
      setDeleting(null)
    }
  }

  const handleTicketUpdate = useCallback((updated: SupportTicket) => {
    setTickets((prev) => prev.map((t) => t.id === updated.id ? updated : t))
    fetchStats()
  }, [fetchStats])

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Support</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage and respond to customer tickets</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchTickets(); fetchStats() }}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="shrink-0">
          <StatsCards stats={[
            { label: "Open",        value: stats.open,        icon: <AlertCircle className="w-5 h-5" />,  color: "blue"   },
            { label: "In Progress", value: stats.in_progress, icon: <Clock className="w-5 h-5" />,        color: "yellow" },
            { label: "Resolved",    value: stats.resolved,    icon: <CheckCircle2 className="w-5 h-5" />, color: "green"  },
            { label: "Total",       value: stats.total,       icon: <Headphones className="w-5 h-5" />,   color: "purple" },
          ]} />
        </div>
      )}

      {/* Split pane */}
      <div className="flex-1 rounded-xl border border-gray-200 bg-white overflow-hidden" style={{ height: "calc(100vh - 340px)", minHeight: "480px" }}>
        <div className="flex h-full">
          {/* Left: ticket list */}
          <div className="w-72 shrink-0 border-r flex flex-col">
            <TicketListSidebar
              tickets={tickets}
              selectedId={selectedId}
              onSelect={(t) => setSelectedId(t.id)}
              loading={loading}
              search={search}
              onSearch={setSearch}
              statusFilter={statusFilter}
              onStatus={setStatusFilter}
              priorityFilter={priorityFilter}
              onPriority={setPriorityFilter}
              onDelete={handleDelete}
              deleting={deleting}
            />
          </div>

          {/* Right: chat */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedId !== null ? (
              <ChatPanel
                key={selectedId}
                ticketId={selectedId}
                onTicketUpdate={handleTicketUpdate}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm">Select a ticket to start chatting</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
