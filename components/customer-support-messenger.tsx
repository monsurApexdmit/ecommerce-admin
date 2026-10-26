"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageCircle, X, Send, Minus, ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { EmptyState } from "@/components/common/EmptyState"
import { SectionTitle } from "@/components/common/SectionTitle"
import { StatusBadge } from "@/components/common/StatusBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { useRouter } from "next/navigation"
import { getCompanyId } from "@/lib/utils/apiInterceptor"
import { subscribeToSupportCompany, subscribeToSupportTicket } from "@/lib/reverb"
import { supportApi } from "@/lib/supportApi"
import type { SupportTicket, SupportMessage, TicketStatus } from "@/lib/supportApi"

// ─── Notification beep via Web Audio API ─────────────────────────────────────
function playNotificationBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = "sine"
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.35)
    osc.onended = () => ctx.close()
  } catch { /* silent */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTime() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
}

let messageSequence = 0

function nextMessageId(prefix: "sys" | "opt") {
  messageSequence += 1

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${messageSequence}`
}

interface UiMessage {
  id: string
  type: "customer" | "staff" | "system"
  text: string
  senderName: string | null
  timestamp: string
}

function toUiMsg(m: SupportMessage): UiMessage {
  return {
    id: String(m.id),
    type: m.senderType === "staff" ? "staff" : "customer",
    text: m.body ?? "",
    senderName: m.senderName,
    timestamp: new Date(m.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }),
  }
}

function systemMsg(text: string): UiMessage {
  return { id: nextMessageId("sys"), type: "system", text, senderName: null, timestamp: getTime() }
}

// ─── Component ───────────────────────────────────────────────────────────────
export function CustomerSupportMessenger() {
  const router = useRouter()

  const [isMinimized, setIsMinimized] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  // Active ticket panel
  const [activeTicket,   setActiveTicket]   = useState<SupportTicket | null>(null)
  const [messages,       setMessages]       = useState<UiMessage[]>([])
  const [recentTickets,  setRecentTickets]  = useState<SupportTicket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [inputValue,     setInputValue]     = useState("")
  const [sending,        setSending]        = useState(false)

  const messagesBoxRef  = useRef<HTMLDivElement>(null)
  const unsubCompany    = useRef<(() => void) | null>(null)
  const unsubTicket     = useRef<(() => void) | null>(null)
  const canReplyToActiveTicket = activeTicket?.status === "open" || activeTicket?.status === "in_progress"

  // ── Scroll to bottom inside the messages div ──
  useEffect(() => {
    const box = messagesBoxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [messages])

  // ── Load recent open tickets ──
  const loadRecentTickets = useCallback(async () => {
    setLoadingTickets(true)
    try {
      const res = await supportApi.getAll({ status: "open", per_page: 5 })
      setRecentTickets(res.data ?? [])
    } catch {
      // silent
    } finally {
      setLoadingTickets(false)
    }
  }, [])

  // ── Subscribe to company-level channel ──
  useEffect(() => {
    const companyId = getCompanyId()
    if (!companyId) return

    unsubCompany.current = subscribeToSupportCompany(companyId, {
      onTicketCreated: (ticket) => {
        setUnreadCount(n => n + 1)
        setRecentTickets(prev => {
          const exists = prev.some(t => t.id === ticket.id)
          return exists ? prev : [ticket, ...prev].slice(0, 5)
        })
        playNotificationBeep()
      },
      onMessageSent: (ticketId, message) => {
        // Only count customer messages as unread
        if (message.senderType !== "customer") return
        setUnreadCount(n => n + 1)
        // If this ticket is currently open in the panel, append the message live
        setActiveTicket(prev => {
          if (prev?.id === ticketId) {
            const ui = toUiMsg(message)
            setMessages(msgs => msgs.some(m => m.id === ui.id) ? msgs : [...msgs, ui])
          }
          return prev
        })
        playNotificationBeep()
      },
      onStatusUpdated: (ticketId, status) => {
        setActiveTicket(prev => {
          if (prev?.id === ticketId) {
            return { ...prev, status: status as TicketStatus }
          }
          return prev
        })
        setRecentTickets(prev => prev.map(t =>
          t.id === ticketId ? { ...t, status: status as TicketStatus } : t
        ))
      },
    })

    return () => { unsubCompany.current?.() }
  }, [])

  // ── Subscribe to active ticket channel ──
  useEffect(() => {
    unsubTicket.current?.()
    if (!activeTicket) return

    unsubTicket.current = subscribeToSupportTicket(activeTicket.id, {
      onMessageSent: (_tid, message) => {
        if (message.senderType !== "customer") return
        const ui = toUiMsg(message)
        setMessages(prev => prev.some(m => m.id === ui.id) ? prev : [...prev, ui])
      },
      onStatusUpdated: (_tid, status) => {
        setActiveTicket(prev => prev ? { ...prev, status } : prev)
        if (status === "resolved" || status === "closed") {
          setInputValue("")
          setMessages(prev => [...prev, systemMsg("This ticket has been resolved.")])
        }
      },
    })

    return () => { unsubTicket.current?.() }
  }, [activeTicket?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Open widget ──
  const handleOpen = () => {
    setIsMinimized(false)
    setUnreadCount(0)
    loadRecentTickets()
  }

  // ── Open a specific ticket in the panel ──
  const openTicket = async (ticket: SupportTicket) => {
    try {
      const full = await supportApi.get(ticket.id)
      setActiveTicket(full)
      setMessages(full.messages.map(toUiMsg))
    } catch {
      setMessages([systemMsg("Failed to load ticket.")])
    }
  }

  // ── Send reply as staff ──
  const handleSend = async () => {
    if (!inputValue.trim() || !activeTicket || sending || !canReplyToActiveTicket) return
    const text = inputValue.trim()
    setSending(true)
    const optimistic: UiMessage = { id: nextMessageId("opt"), type: "staff", text, senderName: "You", timestamp: getTime() }
    setMessages(prev => [...prev, optimistic])
    setInputValue("")
    try {
      const updated = await supportApi.reply(activeTicket.id, text)
      setMessages(updated.messages.map(toUiMsg))
    } catch {
      setMessages(prev => [...prev, systemMsg("Failed to send. Please try again.")])
    } finally {
      setSending(false)
    }
  }

  // ── Minimized floating button ──
  if (isMinimized) {
    return (
      <WithTooltip content="Open support inbox"><Button
        size="icon"
        onClick={handleOpen}
        aria-label="Open support inbox"
        className="fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-xl"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </Button></WithTooltip>
    )
  }

  return (
    <Card className="fixed bottom-6 right-6 z-50 w-96 h-[520px] gap-0 overflow-hidden py-0 shadow-2xl">

      {/* Header */}
      <div className="p-4 flex items-center gap-3 shrink-0">
        <UserAvatar className="size-9" fallback={<MessageCircle className="h-4 w-4" />} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-none">
            {activeTicket ? `#${activeTicket.ticketNumber}` : "Support Inbox"}
          </h3>
          <p className="text-muted-foreground text-xs mt-0.5 truncate">
            {activeTicket
              ? activeTicket.subject
              : `${recentTickets.filter(t => t.status === "open").length} open tickets`
            }
          </p>
        </div>
        <div className="flex items-center gap-1">
          {activeTicket && (
            <WithTooltip content="Back to inbox">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => { setActiveTicket(null); setMessages([]) }}
                aria-label="Back to inbox"
              >
                ←
              </Button>
            </WithTooltip>
          )}
          <WithTooltip content="Open full support page">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => { router.push("/dashboard/support"); setIsMinimized(true) }}
              aria-label="Open full support page"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </WithTooltip>
          <WithTooltip content="Minimize"><Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsMinimized(true)}
            aria-label="Minimize"
          >
            <Minus className="h-4 w-4" />
          </Button></WithTooltip>
          <WithTooltip content="Close"><Button
            variant="ghost"
            size="icon-sm"
            onClick={() => { setIsMinimized(true); setActiveTicket(null) }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button></WithTooltip>
        </div>
      </div>
      <Separator />

      {/* ── Ticket list (inbox view) ── */}
      {!activeTicket && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <SectionTitle
            as="p"
            className="px-4 py-2"
            action={
              <WithTooltip content="Refresh tickets"><Button variant="ghost" size="icon-sm" onClick={loadRecentTickets} aria-label="Refresh tickets">
                <RefreshCw className={cn("h-3.5 w-3.5", loadingTickets && "animate-spin")} />
              </Button></WithTooltip>
            }
          >
            Recent open tickets
          </SectionTitle>
          <Separator />

          <ScrollArea className="flex-1">
            {loadingTickets ? (
              <div className="flex items-center justify-center h-24">
                <Spinner className="size-5" />
              </div>
            ) : recentTickets.length === 0 ? (
              <EmptyState icon={MessageCircle} title="No open tickets" />
            ) : (
              <div className="divide-y">
                {recentTickets.map(ticket => (
                  <Button
                    key={ticket.id}
                    variant="ghost"
                    onClick={() => openTicket(ticket)}
                    className="h-auto w-full flex-col items-stretch justify-start gap-0 whitespace-normal rounded-none px-4 py-3 text-left font-normal"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{ticket.subject}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {ticket.customerName ?? "Guest"} · #{ticket.ticketNumber}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={ticket.status} label={ticket.status.replace("_", " ")} />
                        <Badge variant={ticket.priority === "high" ? "destructive" : ticket.priority === "medium" ? "secondary" : "outline"}>
                          {ticket.priority}
                        </Badge>
                      </div>
                    </div>
                    {ticket.messages?.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {ticket.messages[ticket.messages.length - 1]?.body}
                      </p>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer: link to full page */}
          <Separator />
          <div className="p-3 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { router.push("/dashboard/support"); setIsMinimized(true) }}
              className="w-full"
            >
              View all tickets →
            </Button>
          </div>
        </div>
      )}

      {/* ── Active ticket chat view ── */}
      {activeTicket && (
        <>
          {/* Customer info bar */}
          <div className="px-4 py-2 bg-muted/50 flex items-center justify-between shrink-0">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">
                {activeTicket.customerName ?? "Guest"}
                {activeTicket.customerEmail && (
                  <span className="font-normal text-muted-foreground ml-1">· {activeTicket.customerEmail}</span>
                )}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Category: {activeTicket.category} · Priority: {activeTicket.priority}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              {activeTicket.status !== "resolved" && activeTicket.status !== "closed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await supportApi.updateStatus(activeTicket.id, "resolved")
                    setActiveTicket(prev => prev ? { ...prev, status: "resolved" } : prev)
                    setMessages(prev => [...prev, systemMsg("Ticket marked as resolved.")])
                  }}
                >
                  Resolve
                </Button>
              )}
            </div>
          </div>
          <Separator />

          {/* Messages */}
          <div ref={messagesBoxRef} className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={cn("flex gap-2", msg.type === "staff" ? "justify-end" : msg.type === "system" ? "justify-center" : "justify-start")}
                >
                  {msg.type === "system" ? (
                    <Badge variant="secondary" className="whitespace-normal font-normal">{msg.text}</Badge>
                  ) : (
                    <div className="max-w-[78%]">
                      {msg.type === "customer" && msg.senderName && (
                        <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">{msg.senderName}</p>
                      )}
                      <div className={cn(
                        "px-3.5 py-2.5 rounded-2xl text-sm",
                        msg.type === "staff"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md",
                      )}>
                        <p>{msg.text}</p>
                        <p className={cn("text-[10px] mt-1", msg.type === "staff" ? "text-primary-foreground/60" : "text-muted-foreground")}>
                          {msg.timestamp}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Input */}
          {(activeTicket.status === "open" || activeTicket.status === "in_progress") && (
            <>
            <Separator />
            <div className="p-3 flex gap-2 shrink-0">
              <Input
                placeholder="Reply as staff…"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                disabled={sending || !canReplyToActiveTicket}
              />
              <WithTooltip content="Send reply"><Button
                onClick={handleSend}
                size="icon"
                disabled={!inputValue.trim() || sending || !canReplyToActiveTicket}
                className="flex-shrink-0"
                aria-label="Send reply"
              >
                {sending ? <Spinner /> : <Send className="h-4 w-4" />}
              </Button></WithTooltip>
            </div>
            </>
          )}

          {(activeTicket.status === "resolved" || activeTicket.status === "closed") && (
            <>
            <Separator />
            <div className="p-3 text-center shrink-0">
              <p className="text-xs text-muted-foreground">This ticket is {activeTicket.status}.</p>
            </div>
            </>
          )}
        </>
      )}
    </Card>
  )
}
