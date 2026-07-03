'use client'

// components/layout/NotificationBell.tsx
// Real-time notification bell with polling, mark-as-read, and delete.

import { useState, useEffect, useCallback } from 'react'
import { Bell, X, Trash2, CheckCheck } from 'lucide-react'
import Link from 'next/link'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
  orderId?: string | null
  productId?: string | null
  disputeId?: string | null
  reportId?: string | null
  url?: string | null
  metadata?: any
}

const NOTIFICATION_ICONS: Record<string, string> = {
  ORDER_PLACED: '🛒',
  RIDER_ASSIGNED: '🚴',
  ORDER_PICKED_UP: '📦',
  ORDER_ON_THE_WAY: '🛵',
  ORDER_DELIVERED: '✅',
  ORDER_COMPLETED: '🎉',
  PRODUCT_REVIEWED: '⭐',
  SELLER_REVIEWED: '⭐',
  RIDER_REVIEWED: '⭐',
  DISPUTE_OPENED: '⚠️',
  DISPUTE_MESSAGE: '💬',
  DISPUTE_RESOLVED: '✅',
  REPORT_SUBMITTED: '⚠️',
  REPORT_RESOLVED: '✅',
  PENALTY_ISSUED: '🚫',
  PAYMENT_RECEIVED: '💰',
  WITHDRAWAL_PROCESSED: '💸',
  ACCOUNT_SUSPENDED: '🚫',
  ACCOUNT_UNSUSPENDED: '✅',
  REFERRAL_REWARD: '🎁',
}

function getNotificationLink(notification: Notification, currentUserId: string | null): string {
  const sellerOrderUrl = notification.metadata?.orderUrl as string | undefined
  const sellerId = notification.metadata?.sellerId as string | undefined
  if (notification.type === 'ORDER_PLACED' && sellerOrderUrl && sellerId && currentUserId && sellerId === currentUserId) {
    return sellerOrderUrl
  }
  if (notification.orderId) return `/orders/${notification.orderId}`
  if (notification.disputeId) return `/disputes/${notification.disputeId}`
  if (notification.productId) return `/product/${notification.productId}`
  if (notification.type === 'PAYMENT_RECEIVED' || notification.type === 'WITHDRAWAL_PROCESSED') return '/wallet'
  if (notification.type === 'ACCOUNT_SUSPENDED' || notification.type === 'ACCOUNT_UNSUSPENDED') return '/myprofile'
  return '/notifications'
}

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [lastFetched, setLastFetched] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    setCurrentUserId(localStorage.getItem('userId'))
  }, [])

  // ── Fetch notifications ──────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (force = false) => {
    // Debounce: don't re-fetch if fetched within last 10s unless forced
    if (!force && Date.now() - lastFetched < 10_000) return

    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const res = await fetch('/api/notifications?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
        setLastFetched(Date.now())
      }
    } catch (err) {
      console.error('[NotificationBell] Fetch error:', err)
    }
  }, [lastFetched])

  // Poll every 30s; also fetch immediately on mount
  useEffect(() => {
    fetchNotifications(true)
    const interval = setInterval(() => fetchNotifications(true), 30_000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch fresh when opening the dropdown
  useEffect(() => {
    if (isOpen) fetchNotifications(true)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mark as read ─────────────────────────────────────────────────────────
  const markAsRead = async (ids: string[]) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, isRead: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - ids.filter((id) => {
      const n = notifications.find((n) => n.id === id)
      return n && !n.isRead
    }).length))

    try {
      const token = localStorage.getItem('token')
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notificationIds: ids }),
      })
    } catch (err) {
      console.error('[NotificationBell] markAsRead error:', err)
    }
  }

  const markAllAsRead = async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setUnreadCount(0)

    try {
      const token = localStorage.getItem('token')
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ markAllAsRead: true }),
      })
    } catch (err) {
      console.error('[NotificationBell] markAllAsRead error:', err)
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const notif = notifications.find((n) => n.id === id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (notif && !notif.isRead) setUnreadCount((prev) => Math.max(0, prev - 1))

    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      console.error('[NotificationBell] delete error:', err)
    }
  }

  // ── Notification click ────────────────────────────────────────────────────
  const handleClick = (notification: Notification) => {
    if (!notification.isRead) markAsRead([notification.id])
    setIsOpen(false)
  }

  return (
    <div className="relative">
      {/* ── Bell button ── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-[384px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 flex flex-col overflow-hidden"
            style={{ maxHeight: '75vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="font-black text-gray-900 text-base">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    All read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-3 ring-1 ring-gray-100">
                    <Bell className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="font-bold text-gray-700 text-sm">No notifications yet</p>
                  <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((notification) => (
                    <Link
                      key={notification.id}
                      href={getNotificationLink(notification, currentUserId)}
                      onClick={() => handleClick(notification)}
                      className={`flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 group ${
                        !notification.isRead ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      {/* Icon */}
                      <span className="text-xl flex-shrink-0 mt-0.5">
                        {NOTIFICATION_ICONS[notification.type] || '🔔'}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!notification.isRead ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1 font-medium">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </div>

                      {/* Unread dot + delete */}
                      <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        {!notification.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        <button
                          onClick={(e) => deleteNotification(notification.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded-full transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0 text-center">
                <Link
                  href="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
                >
                  View all notifications →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}