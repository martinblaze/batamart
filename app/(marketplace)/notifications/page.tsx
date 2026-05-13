'use client'

import { useState, useEffect } from 'react'
import { Bell, Trash2, Check, Filter } from 'lucide-react'
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
  metadata?: any
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications)
      }
    } catch (error) {
      console.error('Fetch notifications error:', error)
    } finally {
      setLoading(false)
    }
  }

  // Mark as read
  const markAsRead = async (notificationIds: string[]) => {
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

  // Get link for notification
  const getNotificationLink = (notification: Notification) => {
    if (notification.orderId) return `/orders/${notification.orderId}`
    if (notification.productId) return `/product/${notification.productId}`
    if (notification.disputeId) return `/disputes/${notification.disputeId}`
    return '#'
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

  // Get notification icon/emoji
  const getNotificationIcon = (type: string) => {
    const icons: Record<string, string> = {
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
      PENALTY_ISSUED: '⚠️',
      PAYMENT_RECEIVED: '💰',
      WITHDRAWAL_PROCESSED: '💸',
    }
    return icons[type] || '🔔'
  }

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead
    if (filter === 'read') return n.isRead
    return true
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#000000] py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-BATAMART-primary/10 rounded-full flex items-center justify-center">
                <Bell className="w-6 h-6 text-BATAMART-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
                <p className="text-sm text-gray-500">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-4 py-2 text-sm font-medium text-BATAMART-primary hover:bg-BATAMART-primary/10 rounded-lg transition-colors"
                >
                  Mark all read
                </button>
              )}
              {notifications.some(n => n.isRead) && (
                <button
                  onClick={deleteAllRead}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
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
                  ? 'bg-BATAMART-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'unread'
                  ? 'bg-BATAMART-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'read'
                  ? 'bg-BATAMART-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              Read ({notifications.length - unreadCount})
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-BATAMART-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-500">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
              </h3>
              <p className="text-gray-500">
                {filter === 'all'
                  ? "We'll notify you when something important happens"
                  : `You don't have any ${filter} notifications`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-gray-50 transition-colors ${!notification.isRead ? 'bg-blue-50/50' : ''
                    }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <span className="text-3xl">{getNotificationIcon(notification.type)}</span>
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
                          <h3 className="font-semibold text-gray-900">
                            {notification.title}
                          </h3>
                          {!notification.isRead && (
                            <span className="flex-shrink-0 w-2 h-2 bg-BATAMART-primary rounded-full mt-2"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400">
                          {timeAgo(notification.createdAt)}
                        </p>
                      </Link>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!notification.isRead && (
                        <button
                          onClick={() => markAsRead([notification.id])}
                          className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-4 h-4 text-gray-600" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-2 hover:bg-red-100 rounded-full transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
