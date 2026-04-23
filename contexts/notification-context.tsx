"use client"

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react"
import { notificationApi, type NotificationResponse } from "@/lib/notificationApi"

interface NotificationContextValue {
  notifications: NotificationResponse[]
  unreadCount: number
  loading: boolean
  fetchNotifications: (params?: { page?: number; limit?: number; type?: string; status?: 'read' | 'unread' }) => Promise<void>
  markAsRead: (id: number) => Promise<void>
  markAsUnread: (id: number) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: number) => Promise<void>
  bulkDelete: (ids: number[]) => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCountRef = useRef<number>(0)

  const fetchNotifications = useCallback(async (params?: { page?: number; limit?: number; type?: string; status?: 'read' | 'unread' }) => {
    setLoading(true)
    try {
      const res = await notificationApi.getAll({ limit: 50, ...params })
      setNotifications(res.data ?? [])
      const count = res.meta?.unreadCount ?? 0
      setUnreadCount(count)
      lastCountRef.current = count
    } catch {
      // keep previous state on error
    } finally {
      setLoading(false)
    }
  }, [])

  // Silent background poll — fetches full list so both bell and dropdown stay live
  const silentPoll = useCallback(async () => {
    try {
      const res = await notificationApi.getAll({ limit: 50 })
      const incoming = res.data ?? []
      const count = res.meta?.unreadCount ?? 0
      // Only update state if something actually changed
      if (count !== lastCountRef.current || incoming.length !== 0) {
        setNotifications(incoming)
        setUnreadCount(count)
        lastCountRef.current = count
      }
    } catch {
      // silent — polling must not disrupt the UI
    }
  }, [])

  const markAsRead = useCallback(async (id: number) => {
    await notificationApi.markAsRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    setUnreadCount(prev => {
      const next = Math.max(0, prev - 1)
      lastCountRef.current = next
      return next
    })
  }, [])

  const markAsUnread = useCallback(async (id: number) => {
    await notificationApi.markAsUnread(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: null } : n))
    setUnreadCount(prev => {
      const next = prev + 1
      lastCountRef.current = next
      return next
    })
  }, [])

  const markAllAsRead = useCallback(async () => {
    await notificationApi.markAllAsRead()
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    setUnreadCount(0)
    lastCountRef.current = 0
  }, [])

  const deleteNotification = useCallback(async (id: number) => {
    const target = notifications.find(n => n.id === id)
    await notificationApi.delete(id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (target && !target.readAt) {
      setUnreadCount(prev => {
        const next = Math.max(0, prev - 1)
        lastCountRef.current = next
        return next
      })
    }
  }, [notifications])

  const bulkDelete = useCallback(async (ids: number[]) => {
    await notificationApi.bulkDelete(ids)
    const deletedUnread = notifications.filter(n => ids.includes(n.id) && !n.readAt).length
    setNotifications(prev => prev.filter(n => !ids.includes(n.id)))
    setUnreadCount(prev => {
      const next = Math.max(0, prev - deletedUnread)
      lastCountRef.current = next
      return next
    })
  }, [notifications])

  // Initial fetch + poll every 10s for live updates
  useEffect(() => {
    fetchNotifications()
    pollRef.current = setInterval(silentPoll, 10000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, []) // eslint-disable-line

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, loading,
      fetchNotifications, markAsRead, markAsUnread,
      markAllAsRead, deleteNotification, bulkDelete,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider")
  return ctx
}
