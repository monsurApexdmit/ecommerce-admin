"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { MessageCircle, X, Send, Minus, ExternalLink, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
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
    text: m.body,
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
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-xl flex items-center justify-center text-white transition-colors"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[520px] shadow-2xl rounded-2xl overflow-hidden bg-white border border-gray-200 flex flex-col">

      {/* Header */}
      <div className="bg-emerald-600 p-4 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <MessageCircle className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm leading-none">
            {activeTicket ? `#${activeTicket.ticketNumber}` : "Support Inbox"}
          </h3>
          <p className="text-white/70 text-[11px] mt-0.5 truncate">
            {activeTicket
              ? activeTicket.subject
              : `${recentTickets.filter(t => t.status === "open").length} open tickets`
            }
          </p>
        </div>
        <div className="flex items-center gap-1">
          {activeTicket && (
            <button
              onClick={() => { setActiveTicket(null); setMessages([]) }}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white text-xs"
              title="Back to inbox"
            >
              ←
            </button>
          )}
          <button
            onClick={() => { router.push("/dashboard/support"); setIsMinimized(true) }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white"
            title="Open full support page"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setIsMinimized(true); setActiveTicket(null) }}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/80 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Ticket list (inbox view) ── */}
      {!activeTicket && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent open tickets</span>
            <button onClick={loadRecentTickets} className="text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw className={cn("h-3.5 w-3.5", loadingTickets && "animate-spin")} />
            </button>
          </div>

          <ScrollArea className="flex-1">
            {loadingTickets ? (
              <div className="flex items-center justify-center h-24">
                <RefreshCw className="h-5 w-5 text-emerald-600 animate-spin" />
              </div>
            ) : recentTickets.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No open tickets</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recentTickets.map(ticket => (
                  <button
                    key={ticket.id}
                    onClick={() => openTicket(ticket)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{ticket.subject}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {ticket.customerName ?? "Guest"} · #{ticket.ticketNumber}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full font-medium",
                          ticket.status === "open"        && "bg-blue-100 text-blue-700",
                          ticket.status === "in_progress" && "bg-yellow-100 text-yellow-700",
                          ticket.status === "resolved"    && "bg-green-100 text-green-700",
                          ticket.status === "closed"      && "bg-gray-100 text-gray-500",
                        )}>
                          {ticket.status.replace("_", " ")}
                        </span>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-medium",
                          ticket.priority === "high"   && "bg-red-100 text-red-600",
                          ticket.priority === "medium" && "bg-orange-100 text-orange-600",
                          ticket.priority === "low"    && "bg-gray-100 text-gray-500",
                        )}>
                          {ticket.priority}
                        </span>
                      </div>
                    </div>
                    {ticket.messages?.length > 0 && (
                      <p className="text-xs text-gray-400 truncate mt-1">
                        {ticket.messages[ticket.messages.length - 1]?.body}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer: link to full page */}
          <div className="p-3 border-t border-gray-100 shrink-0">
            <button
              onClick={() => { router.push("/dashboard/support"); setIsMinimized(true) }}
              className="w-full text-center text-xs text-emerald-600 hover:text-emerald-700 font-medium py-1.5 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              View all tickets →
            </button>
          </div>
        </div>
      )}

      {/* ── Active ticket chat view ── */}
      {activeTicket && (
        <>
          {/* Customer info bar */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">
                {activeTicket.customerName ?? "Guest"}
                {activeTicket.customerEmail && (
                  <span className="font-normal text-gray-400 ml-1">· {activeTicket.customerEmail}</span>
                )}
              </p>
              <p className="text-[10px] text-gray-400">
                Category: {activeTicket.category} · Priority: {activeTicket.priority}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              {activeTicket.status !== "resolved" && activeTicket.status !== "closed" && (
                <button
                  onClick={async () => {
                    await supportApi.updateStatus(activeTicket.id, "resolved")
                    setActiveTicket(prev => prev ? { ...prev, status: "resolved" } : prev)
                    setMessages(prev => [...prev, systemMsg("Ticket marked as resolved.")])
                  }}
                  className="text-[10px] px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 transition-colors font-medium"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div ref={messagesBoxRef} className="flex-1 overflow-y-auto p-4">
            <div className="space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={cn("flex gap-2", msg.type === "staff" ? "justify-end" : msg.type === "system" ? "justify-center" : "justify-start")}
                >
                  {msg.type === "system" ? (
                    <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{msg.text}</span>
                  ) : (
                    <div className="max-w-[78%]">
                      {msg.type === "customer" && msg.senderName && (
                        <p className="text-[10px] text-gray-400 mb-0.5 ml-1">{msg.senderName}</p>
                      )}
                      <div className={cn(
                        "px-3.5 py-2.5 rounded-2xl text-sm",
                        msg.type === "staff"
                          ? "bg-emerald-600 text-white rounded-br-md"
                          : "bg-gray-100 text-gray-900 rounded-bl-md",
                      )}>
                        <p>{msg.text}</p>
                        <p className={cn("text-[10px] mt-1", msg.type === "staff" ? "text-white/60" : "text-gray-400")}>
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
            <div className="p-3 border-t border-gray-200 flex gap-2 shrink-0">
              <Input
                placeholder="Reply as staff…"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
                className="bg-gray-50 border-gray-200 text-sm rounded-xl"
                disabled={sending || !canReplyToActiveTicket}
              />
              <Button
                onClick={handleSend}
                size="icon"
                disabled={!inputValue.trim() || sending || !canReplyToActiveTicket}
                className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0 rounded-xl"
              >
                {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}

          {(activeTicket.status === "resolved" || activeTicket.status === "closed") && (
            <div className="p-3 border-t border-gray-100 text-center shrink-0">
              <p className="text-xs text-gray-400">This ticket is {activeTicket.status}.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
