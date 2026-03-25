import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Notification } from '../types'
import { getNotifications, markNotificationRead, deleteNotification } from '../api'
import { useToast } from '../contexts/ToastContext'

interface NotificationPanelProps {
  onClose: () => void
  onUnreadCountChange: (count: number) => void
}

export function NotificationPanel({ onClose, onUnreadCountChange }: NotificationPanelProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNotifications()
      .then(data => {
        setNotifications(data)
        onUnreadCountChange(data.filter(n => !n.read).length)
      })
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }, [])

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      onUnreadCountChange(notifications.filter(n => !n.read && n.id !== id).length)
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteNotification(id)
      const updated = notifications.filter(n => n.id !== id)
      setNotifications(updated)
      onUnreadCountChange(updated.filter(n => !n.read).length)
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const typeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return '✓'
      case 'error': return '✕'
      case 'warning': return '⚠'
      default: return 'ℹ'
    }
  }

  return (
    <div className="notification-panel-overlay" onClick={onClose}>
      <div className="notification-panel" onClick={e => e.stopPropagation()}>
        <div className="notification-panel-header">
          <h3>Notifications</h3>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className="notification-panel-body">
          {loading && <p className="text-muted">{t('common.loading')}</p>}
          {!loading && notifications.length === 0 && (
            <p className="text-muted">{t('common.noData')}</p>
          )}
          {notifications.map(n => (
            <div
              key={n.id}
              className={`notification-item notification-${n.type} ${n.read ? 'read' : 'unread'}`}
            >
              <span className="notification-icon">{typeIcon(n.type)}</span>
              <div className="notification-content">
                <p className="notification-message">{n.message}</p>
                <span className="notification-time">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="notification-actions">
                {!n.read && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleMarkRead(n.id)}
                    title="Mark as read"
                  >
                    ✓
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDelete(n.id)}
                  title={t('common.delete')}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
