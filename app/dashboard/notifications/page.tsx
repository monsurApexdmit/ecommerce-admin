"use client"

import { useState, useMemo, useEffect } from "react"
import { Mail, Trash2, ShoppingCart, AlertTriangle, DollarSign, Settings, CheckCheck, Eye, ExternalLink, Bell, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useNotifications } from "@/contexts/notification-context"
import type { NotificationType, NotificationPriority } from "@/lib/notificationApi"

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

const notificationTypes: Record<NotificationType, { icon: any; color: string; label: string }> = {
  order: { icon: ShoppingCart, color: 'emerald', label: 'New Order' },
  stock_alert: { icon: AlertTriangle, color: 'orange', label: 'Stock Alert' },
  payment: { icon: DollarSign, color: 'blue', label: 'Payment' },
  system: { icon: Settings, color: 'gray', label: 'System' },
}

const priorityConfig: Record<NotificationPriority, { color: string; label: string }> = {
  high: { color: 'red', label: 'High Priority' },
  medium: { color: 'yellow', label: 'Medium' },
  low: { color: 'gray', label: 'Low' },
}

const badgeColorMap: Record<string, string> = {
  emerald: 'bg-emerald-500',
  orange: 'bg-orange-500',
  blue: 'bg-blue-500',
  gray: 'bg-gray-500',
}

export default function NotificationsPage() {
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAsUnread, markAllAsRead, deleteNotification, bulkDelete } = useNotifications()

  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [sortOrder, setSortOrder] = useState("newest")

  useEffect(() => {
    fetchNotifications()
  }, []) // eslint-disable-line

  const filtered = useMemo(() => {
    let list = [...notifications]
    if (filterStatus === "read") list = list.filter(n => !!n.readAt)
    else if (filterStatus === "unread") list = list.filter(n => !n.readAt)
    if (filterType !== "all") list = list.filter(n => n.type === filterType)
    list.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB
    })
    return list
  }, [notifications, filterStatus, filterType, sortOrder])

  const { currentItems, currentPage, totalPages, itemsPerPage, setCurrentPage, handleItemsPerPageChange } = usePagination(filtered, 10)

  const handleSelectAll = () => {
    if (selectedIds.length === currentItems.length && currentItems.length > 0) setSelectedIds([])
    else setSelectedIds(currentItems.map(n => n.id))
  }

  const handleMarkSelectedAsRead = async () => {
    await Promise.all(selectedIds.map(id => markAsRead(id)))
    setSelectedIds([])
  }

  const handleBulkDelete = async () => {
    await bulkDelete(selectedIds)
    setSelectedIds([])
  }

  const getPriorityBadge = (priority: NotificationPriority) => {
    if (priority === 'low') return null
    const config = priorityConfig[priority]
    const colorMap: Record<string, string> = {
      red: 'bg-red-100 text-red-800 border-red-200',
      yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    }
    return (
      <Badge variant="outline" className={`text-xs ${colorMap[config.color]}`}>
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className="w-8 h-8 text-emerald-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-600">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleMarkSelectedAsRead} variant="default" className="bg-emerald-500 hover:bg-emerald-600" disabled={selectedIds.length === 0}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark Selected as Read {selectedIds.length > 0 && `(${selectedIds.length})`}
            </Button>
            <Button onClick={markAllAsRead} variant="outline" disabled={unreadCount === 0}>
              <Mail className="w-4 h-4 mr-2" />
              Mark All as Read
            </Button>
            {selectedIds.length > 0 && (
              <Button onClick={handleBulkDelete} variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedIds.length})
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unread">Unread Only</SelectItem>
                <SelectItem value="read">Read Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="order">Orders</SelectItem>
                <SelectItem value="stock_alert">Stock Alerts</SelectItem>
                <SelectItem value="payment">Payments</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading notifications...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No notifications found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="w-12 px-4 py-3 text-left">
                        <Checkbox
                          checked={selectedIds.length === currentItems.length && currentItems.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Notification</th>
                      <th className="w-48 px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentItems.map((n) => {
                      const typeConfig = notificationTypes[n.type] ?? notificationTypes.system
                      const TypeIcon = typeConfig.icon
                      const isRead = !!n.readAt
                      return (
                        <tr key={n.id} className={`hover:bg-gray-50 transition-colors ${isRead ? 'bg-gray-50/50 opacity-75' : 'bg-white'}`}>
                          <td className="px-4 py-4">
                            <Checkbox
                              checked={selectedIds.includes(n.id)}
                              onCheckedChange={() => setSelectedIds(prev => prev.includes(n.id) ? prev.filter(id => id !== n.id) : [...prev, n.id])}
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-start gap-3">
                              {!isRead && <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 shrink-0" />}
                              <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${badgeColorMap[typeConfig.color]}`}>
                                <TypeIcon className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm mb-1 ${isRead ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                                  {n.title && <span className="font-semibold">{n.title} — </span>}
                                  {n.message}
                                </p>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className={`text-xs ${badgeColorMap[typeConfig.color]} text-white`}>
                                    {typeConfig.label}
                                  </Badge>
                                  {getPriorityBadge(n.priority)}
                                  <span className="text-xs text-gray-500">{getRelativeTime(n.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost" size="sm" className="h-8 w-8 p-0"
                                title={isRead ? "Mark as unread" : "Mark as read"}
                                onClick={() => isRead ? markAsUnread(n.id) : markAsRead(n.id)}
                              >
                                {isRead ? <Mail className="w-4 h-4 text-gray-500" /> : <Eye className="w-4 h-4 text-emerald-600" />}
                              </Button>
                              {n.actionUrl && (
                                <Link href={n.actionUrl}>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="View details">
                                    <ExternalLink className="w-4 h-4 text-blue-600" />
                                  </Button>
                                </Link>
                              )}
                              <Button
                                variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                title="Delete" onClick={() => deleteNotification(n.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <PaginationControl
                  currentPage={currentPage} totalPages={totalPages}
                  onPageChange={setCurrentPage} itemsPerPage={itemsPerPage}
                  onItemsPerPageChange={handleItemsPerPageChange} totalItems={filtered.length}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
