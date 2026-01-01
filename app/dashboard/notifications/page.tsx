"use client"

import { useState } from "react"
import { Mail, Trash2 } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

interface Notification {
  id: number
  user: string
  amount: number
  avatar: string
  time: string
  read: boolean
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      user: "Nevil Nevil",
      amount: 253.26,
      avatar: "/admin-avatar.jpg",
      time: "26 Dec, 2025 11:29 AM",
      read: false,
    },
    {
      id: 2,
      user: "Nevil Nevil",
      amount: 121.56,
      avatar: "/admin-avatar.jpg",
      time: "26 Dec, 2025 10:57 AM",
      read: false,
    },
    {
      id: 3,
      user: "TEJPAL SONI",
      amount: 166.49,
      avatar: "/marion-avatar.jpg",
      time: "25 Dec, 2025 1:17 PM",
      read: false,
    },
    {
      id: 4,
      user: "Nevil Nevil",
      amount: 660.0,
      avatar: "/admin-avatar.jpg",
      time: "25 Dec, 2025 12:26 PM",
      read: false,
    },
    {
      id: 5,
      user: "Justinn Luish",
      amount: 265.01,
      avatar: "/stacey-avatar.jpg",
      time: "23 Dec, 2025 8:37 PM",
      read: false,
    },
  ])

  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleSelectAll = () => {
    if (selectedNotifications.length === notifications.length) {
      setSelectedNotifications([])
    } else {
      setSelectedNotifications(notifications.map((n) => n.id))
    }
  }

  const handleSelectNotification = (id: number) => {
    setSelectedNotifications((prev) => (prev.includes(id) ? prev.filter((nId) => nId !== id) : [...prev, id]))
  }

  const handleMarkAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleDeleteNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    setSelectedNotifications((prev) => prev.filter((nId) => nId !== id))
  }

  const handleBulkDelete = () => {
    if (selectedNotifications.length === 0) return
    setNotifications((prev) => prev.filter((n) => !selectedNotifications.includes(n.id)))
    setSelectedNotifications([])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <Button onClick={handleMarkAsRead} variant="default" className="bg-emerald-500 hover:bg-emerald-600">
            <Mail className="w-4 h-4 mr-2" />
            Mark is read
          </Button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Unread Notification ({unreadCount})</h2>
            {selectedNotifications.length > 0 && (
              <Button onClick={handleBulkDelete} variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-12 px-4 py-3 text-left">
                    <Checkbox
                      checked={selectedNotifications.length === notifications.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    NOTIFICATION
                  </th>
                  <th className="w-32 px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <tr key={notification.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <Checkbox
                        checked={selectedNotifications.includes(notification.id)}
                        onCheckedChange={() => handleSelectNotification(notification.id)}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <Image
                          src={notification.avatar || "/placeholder.svg"}
                          alt={notification.user}
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                        <div>
                          <p className="text-sm text-gray-900 mb-1">
                            <span className="font-medium">{notification.user}</span> placed an order of{" "}
                            {notification.amount.toFixed(2)}!
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500 text-white">
                              New Order
                            </span>
                            <span className="text-xs text-gray-500">{notification.time}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleDeleteNotification(notification.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
