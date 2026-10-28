'use client'

import { useState, useEffect } from 'react'
import { applyRecentlyRead, rememberRead, useNotificationRefresh } from '@/lib/notification-client'
import {
  Bell, Trash2, Check, Filter, ShoppingCart, Bike, Package, Truck,
  CheckCircle2, Star, AlertTriangle, MessageCircle, Ban, Banknote,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

// Design bible section 6 — lucide-react only, no emoji. Status-colored icons
// use the matching status token; everything else inherits ink-secondary.
const NOTIFICATION_ICONS: Record<string, { icon: LucideIcon; tone: 'primary' | 'success' | 'warning' | 'danger' }> = {
  ORDER_PLACED: { icon: ShoppingCart, tone: 'primary' },
  RIDER_ASSIGNED: { icon: Bike, tone: 'primary' },
  ORDER_PICKED_UP: { icon: Package, tone: 'primary' },
  ORDER_ON_THE_WAY: { icon: Truck, tone: 'primary' },
  ORDER_DELIVERED: { icon: CheckCircle2, tone: 'success' },
  ORDER_COMPLETED: { icon: CheckCircle2, tone: 'success' },
  PRODUCT_REVIEWED: { icon: Star, tone: 'warning' },
  SELLER_REVIEWED: { icon: Star, tone: 'warning' },
  RIDER_REVIEWED: { icon: Star, tone: 'warning' },
  DISPUTE_OPENED: { icon: AlertTriangle, tone: 'warning' },
  DISPUTE_MESSAGE: { icon: MessageCircle, tone: 'primary' },
  DISPUTE_RESOLVED: { icon: CheckCircle2, tone: 'success' },
  REPORT_SUBMITTED: { icon: AlertTriangle, tone: 'warning' },
  REPORT_RESOLVED: { icon: CheckCircle2, tone: 'success' },
  PENALTY_ISSUED: { icon: Ban, tone: 'danger' },
  PAYMENT_RECEIVED: { icon: Banknote, tone: 'success' },
  WITHDRAWAL_PROCESSED: { icon: Banknote, tone: 'primary' },
}
const DEFAULT_NOTIFICATION_ICON: { icon: LucideIcon; tone: 'primary' | 'success' | 'warning' | 'danger' } = { icon: Bell, tone: 'primary' }
const toneClasses: Record<'primary' | 'success' | 'warning' | 'danger', string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
}

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
  metadata?: any
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')

  // Fetch notifications
  const fetchNotifications = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(applyRecentlyRead<Notification>(data.notifications))
      }
    } catch (error) {
      console.error('Fetch notifications error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Mark as read
  const markAsRead = async (notificationIds: string[]) => {
    rememberRead(notificationIds)
    try {
      const token = localStorage.getItem('token')
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notificationIds })
      })

      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.id) ? { ...n, isRead: true } : n
        )
      )
    } catch (error) {
      console.error('Mark as read error:', error)
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    rememberRead(notifications.map(n => n.id))
    try {
      const token = localStorage.getItem('token')
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ markAllAsRead: true })
      })

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    } catch (error) {
      console.error('Mark all as read error:', error)
    }
  }

  // Delete notification
  const deleteNotification = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch (error) {
      console.error('Delete notification error:', error)
    }
  }

  // Delete all read notifications
  const deleteAllRead = async () => {
    const readNotifications = notifications.filter(n => n.isRead)
    for (const notification of readNotifications) {
      await deleteNotification(notification.id)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  // New pushes appear here by themselves: on a push, when you come back to the
  // tab, and every 20 seconds while it is open.
  useNotificationRefresh(() => fetchNotifications(true), 20_000)

  // Get link for notification — deep-links to the exact screen it's about
  // (same logic as components/layout/NotificationBell.tsx; kept in sync
  // manually since this page renders its own list independently of the bell).
  const getNotificationLink = (notification: Notification) => {
    const tourUrl = notification.metadata?.tourUrl as string | undefined
    if (tourUrl) return tourUrl

    const sellerOrderUrl = notification.metadata?.orderUrl as string | undefined
    const sellerId = notification.metadata?.sellerId as string | undefined
    const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null
    if (notification.type === 'ORDER_PLACED' && sellerOrderUrl && sellerId && currentUserId && sellerId === currentUserId) {
      return sellerOrderUrl
    }

    switch (notification.type) {
      case 'PAYMENT_RECEIVED':
      case 'WITHDRAWAL_PROCESSED':
        return '/wallet'
      case 'ACCOUNT_SUSPENDED':
      case 'ACCOUNT_UNSUSPENDED':
      case 'PENALTY_ISSUED':
      case 'SELLER_STRIKE_ISSUED':
        return '/myprofile'
      case 'REFERRAL_REWARD':
        return '/referrals'
      case 'DISPUTE_OPENED':
      case 'DISPUTE_MESSAGE':
      case 'DISPUTE_RESOLVED':
        if (notification.disputeId) return `/disputes/${notification.disputeId}`
        break
      case 'PRODUCT_UNDER_REVIEW':
      case 'STOCK_ALERT':
        if (notification.productId) return `/product/${notification.productId}`
        return '/my-shop'
    }

    if (notification.orderId) return `/orders/${notification.orderId}`
    if (notification.disputeId) return `/disputes/${notification.disputeId}`
    if (notification.productId) return `/product/${notification.productId}`
    return '/notifications'
  }

  // Format time ago
  const timeAgo = (dateString: string) => {
    const now = new Date().getTime()
    const created = new Date(dateString).getTime()
    const diff = now - created

    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(dateString).toLocaleDateString()
  }

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead
    if (filter === 'read') return n.isRead
    return true
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="min-h-screen bg-surface dark:bg-[#000000] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 border-b border-border pb-6">
          <div className="mb-4 flex items-end justify-between gap-6">
            <div>
              <p className="ui-eyebrow mb-2 max-w-[12rem]">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
              <h1 className="text-[clamp(1.6rem,3.4vw,2.4rem)] text-ink">Notifications</h1>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="rounded-lg border border-border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-secondary transition-colors duration-300 hover:border-ink/25 hover:text-ink"
                >
                  Mark all read
                </button>
              )}
              {notifications.some(n => n.isRead) && (
                <button
                  onClick={deleteAllRead}
                  className="px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear read
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 border-t pt-4">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all'
                  ? 'bg-primary text-white'
                  : 'text-ink-secondary hover:bg-surface'
                }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'unread'
                  ? 'bg-primary text-white'
                  : 'text-ink-secondary hover:bg-surface'
                }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'read'
                  ? 'bg-primary text-white'
                  : 'text-ink-secondary hover:bg-surface'
                }`}
            >
              Read ({notifications.length - unreadCount})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-card rounded-xl shadow-soft overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-ink-secondary">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-ink-muted" />
              <h3 className="text-lg font-semibold text-ink mb-2">
                {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
              </h3>
              <p className="text-ink-secondary">
                {filter === 'all'
                  ? "We'll notify you when something important happens"
                  : `You don't have any ${filter} notifications`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredNotifications.map((notification) => {
                const { icon: NotifIcon, tone } = NOTIFICATION_ICONS[notification.type] || DEFAULT_NOTIFICATION_ICON
                return (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-surface transition-colors ${!notification.isRead ? 'bg-primary/5' : ''
                    }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center ${toneClasses[tone]}`}>
                        <NotifIcon className="w-5 h-5" strokeWidth={1.75} />
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={getNotificationLink(notification)}
                        onClick={() => {
                          if (!notification.isRead) {
                            markAsRead([notification.id])
                          }
                        }}
                        className="block"
                      >
                        <div className="flex items-start justify-between gap-4 mb-1">
                          <h3 className="font-semibold text-ink">
                            {notification.title}
                          </h3>
                          {!notification.isRead && (
                            <span className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-2"></span>
                          )}
                        </div>
                        <p className="text-sm text-ink-secondary mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </Link>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead([notification.id])}
                          className="p-2 hover:bg-border rounded-full transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4 text-ink-secondary" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-2 hover:bg-danger/10 rounded-full transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-danger" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
