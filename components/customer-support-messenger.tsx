"use client"

import { useState, useEffect } from "react"
import { X, Minus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  type: "user" | "support"
  text: string
  timestamp: string
}

interface SupportMessengerProps {
  isOpen?: boolean
  onClose?: () => void
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "1",
    type: "support",
    text: "Hi there! 👋 Welcome to our support team. How can I help you today?",
    timestamp: "06:50 PM"
  }
]

const QUICK_OPTIONS = [
  { label: "Track my order", icon: "📦" },
  { label: "Return policy", icon: "↩️" },
  { label: "Payment issues", icon: "💳" },
  { label: "Talk to agent", icon: "👤" }
]

export function CustomerSupportMessenger({ isOpen: initialIsOpen = true, onClose }: SupportMessengerProps) {
  const [isOpen, setIsOpen] = useState(initialIsOpen)
  const [isMinimized, setIsMinimized] = useState(true)
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [inputValue, setInputValue] = useState("")

  // Load minimized state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMinimized = localStorage.getItem("supportMessengerMinimized") === "true"
      setIsMinimized(isMinimized)
    }
  }, [])

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    // Add user message
    const newMessage: Message = {
      id: String(Date.now()),
      type: "user",
      text: inputValue,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    }

    setMessages(prev => [...prev, newMessage])
    setInputValue("")

    // Simulate support reply after 1 second
    setTimeout(() => {
      const supportReply: Message = {
        id: String(Date.now() + 1),
        type: "support",
        text: "Thanks for your message! Our support team will respond shortly.",
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
      }
      setMessages(prev => [...prev, supportReply])
    }, 1000)
  }

  const handleQuickOption = (option: string) => {
    const newMessage: Message = {
      id: String(Date.now()),
      type: "user",
      text: option,
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    }
    setMessages(prev => [...prev, newMessage])

    // Simulate support reply
    setTimeout(() => {
      const supportReply: Message = {
        id: String(Date.now() + 1),
        type: "support",
        text: `I'll help you with "${option}". Please provide more details.`,
        timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
      }
      setMessages(prev => [...prev, supportReply])
    }, 1000)
  }

  if (!initialIsOpen) return null

  // Show minimized floating button
  if (isMinimized) {
    return (
      <button
        onClick={() => {
          setIsMinimized(false)
          localStorage.setItem("supportMessengerMinimized", "false")
        }}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-emerald-600 hover:bg-emerald-700 rounded-full shadow-lg flex items-center justify-center text-white transition-colors"
      >
        <span className="text-2xl">💬</span>
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 shadow-lg rounded-lg overflow-hidden bg-white border border-gray-200">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="text-emerald-700">💬</span>
          </div>
          <div>
            <h3 className="text-gray-900 font-semibold text-sm">Customer Support</h3>
            <p className="text-gray-500 text-xs">We typically reply instantly</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => {
              setIsMinimized(!isMinimized)
              localStorage.setItem("supportMessengerMinimized", String(!isMinimized))
            }}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-900"
          >
            <Minus size={18} />
          </button>
          <button
            onClick={() => {
              setIsMinimized(true)
              localStorage.setItem("supportMessengerMinimized", "true")
            }}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600 hover:text-gray-900"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      {!isMinimized && (
        <>
          <ScrollArea className="h-80 p-4 space-y-4 bg-white">
            {messages.map(message => (
              <div key={message.id} className={cn("flex gap-3", message.type === "user" ? "justify-end" : "justify-start")}>
                {message.type === "support" && (
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex-shrink-0 flex items-center justify-center">
                    <span className="text-sm">💬</span>
                  </div>
                )}
                <div className={cn(
                  "max-w-xs px-4 py-2 rounded-lg",
                  message.type === "support"
                    ? "bg-gray-100 text-gray-900"
                    : "bg-emerald-500 text-white"
                )}>
                  <p className="text-sm">{message.text}</p>
                  <span className="text-xs opacity-70 mt-1 block">{message.timestamp}</span>
                </div>
              </div>
            ))}
          </ScrollArea>

          {/* Quick Options */}
          {messages.length === 1 && (
            <div className="px-4 py-3 border-t border-gray-200 space-y-2 bg-white">
              <div className="grid grid-cols-2 gap-2">
                {QUICK_OPTIONS.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQuickOption(option.label)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 hover:border-emerald-300 text-xs font-medium transition-colors text-left"
                  >
                    <span className="mr-1">{option.icon}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 flex gap-2 bg-white">
            <Input
              placeholder="Type a message..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSendMessage()}
              className="bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-500 rounded-lg"
            />
            <Button
              onClick={handleSendMessage}
              size="icon"
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
            >
              <Send size={18} />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
