'use client'

// components/layout/NotificationBell.tsx
// Real-time notification bell with polling, mark-as-read, and delete.

import { useState, useEffect, useCallback } from 'react'
import { applyRecentlyRead, recentlyRead, rememberRead, useNotificationRefresh } from '@/lib/notification-client'
import {
  Bell, X, Trash2, CheckCheck, ShoppingCart, Bike, Package, Truck,
  CheckCircle2, Star, AlertTriangle, MessageCircle, Ban, Banknote, Gift,
  type LucideIcon,
} from 'lucide-react'
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
  ACCOUNT_SUSPENDED: { icon: Ban, tone: 'danger' },
  ACCOUNT_UNSUSPENDED: { icon: CheckCircle2, tone: 'success' },
  REFERRAL_REWARD: { icon: Gift, tone: 'primary' },
}

const DEFAULT_NOTIFICATION_ICON: { icon: LucideIcon; tone: 'primary' | 'success' | 'warning' | 'danger' } = { icon: Bell, tone: 'primary' }

const toneClasses: Record<'primary' | 'success' | 'warning' | 'danger', string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
}

// Deep-links each notification to the exact screen it's about — the same
// idea as Jumia/most e-commerce apps: an order update opens that order, a
// dispute message opens that dispute, a payout opens the wallet, etc.,
// rather than dropping everything on the generic notifications list.
function getNotificationLink(notification: Notification, currentUserId: string | null): string {
  const tourUrl = notification.metadata?.tourUrl as string | undefined
  if (tourUrl) return tourUrl

  const sellerOrderUrl = notification.metadata?.orderUrl as string | undefined
  const sellerId = notification.metadata?.sellerId as string | undefined
  if (notification.type === 'ORDER_PLACED' && sellerOrderUrl && sellerId && currentUserId && sellerId === currentUserId) {
    return sellerOrderUrl
  }

  // Type-specific destinations that aren't just "the order/dispute/product
  // this notification points at" — checked first since some types (e.g.
  // WITHDRAWAL_PROCESSED) can carry an orderId-less context.
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
        const merged = applyRecentlyRead<Notification>(data.notifications || [])
        // Items the server still lists as unread but we just marked read.
        const staleReads = (data.notifications || []).filter(
          (n: Notification) => !n.isRead && recentlyRead.has(n.id),
        ).length
        setNotifications(merged)
        setUnreadCount(Math.max(0, (data.unreadCount || 0) - staleReads))
        setLastFetched(Date.now())
      }
    } catch (err) {
      console.error('[NotificationBell] Fetch error:', err)
    }
  }, [lastFetched])

  // Fetch immediately on mount (polling is handled by useNotificationRefresh below)
  useEffect(() => {
    fetchNotifications(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // And whenever a push arrives or the tab comes back into view
  useNotificationRefresh(() => fetchNotifications(true), 30_000)

  // Fetch fresh when opening the dropdown
  useEffect(() => {
    if (isOpen) fetchNotifications(true)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mark as read ─────────────────────────────────────────────────────────
  const markAsRead = async (ids: string[]) => {
    rememberRead(ids)
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
    rememberRead(notifications.map(n => n.id))
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
        className="relative p-2 text-ink-secondary hover:text-ink hover:bg-surface rounded-full transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-6 h-6" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 min-w-[20px] h-5 bg-danger text-white text-[10px] font-medium rounded-full flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-[384px] bg-card rounded-2xl shadow-soft border border-border z-50 flex flex-col overflow-hidden"
            style={{ maxHeight: '75vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h3 className="font-semibold text-ink text-base">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-xs font-medium text-white bg-danger px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:brightness-90 px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                    All read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-surface rounded-full transition-colors"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4 text-ink-secondary" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="w-12 h-12 bg-surface border border-border rounded-full flex items-center justify-center mb-3">
                    <Bell className="w-6 h-6 text-ink-muted" strokeWidth={1.75} />
                  </div>
                  <p className="font-medium text-ink text-sm">No notifications yet</p>
                  <p className="text-xs text-ink-muted mt-1">You&apos;re all caught up</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => {
                    const { icon: Icon, tone } = NOTIFICATION_ICONS[notification.type] || DEFAULT_NOTIFICATION_ICON
                    return (
                    <Link
                      key={notification.id}
                      href={getNotificationLink(notification, currentUserId)}
                      onClick={() => handleClick(notification)}
                      className={`flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface group ${
                        !notification.isRead ? 'bg-primary/5' : ''
                      }`}
                    >
                      {/* Icon */}
                      <span className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${toneClasses[tone]}`}>
                        <Icon className="w-4 h-4" strokeWidth={1.75} />
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!notification.isRead ? 'font-semibold text-ink' : 'font-medium text-ink-secondary'}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-ink-secondary mt-0.5 line-clamp-2 leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="text-[10px] text-ink-muted mt-1 font-medium">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </div>

                      {/* Unread dot + delete */}
                      <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        {!notification.isRead && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        <button
                          onClick={(e) => deleteNotification(notification.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-border rounded-full transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-ink-muted" strokeWidth={1.75} />
                        </button>
                      </div>
                    </Link>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-border flex-shrink-0 text-center">
                <Link
                  href="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-sm font-medium text-primary hover:brightness-90 transition-colors"
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