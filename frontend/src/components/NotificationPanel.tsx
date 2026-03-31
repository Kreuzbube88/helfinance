import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Notification } from '../types'
import { getNotifications, markNotificationRead, deleteNotification, markAllNotificationsRead } from '../api'
import { useToast } from '../contexts/ToastContext'
import { Modal } from './Modal'

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
      const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n)
      setNotifications(updated)
      onUnreadCountChange(updated.filter(n => !n.read).length)
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      const updated = notifications.map(n => ({ ...n, read: true }))
      setNotifications(updated)
      onUnreadCountChange(0)
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

  const typeColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'var(--color-success)'
      case 'error':   return 'var(--color-danger)'
      case 'warning': return 'var(--color-warning)'
      default:        return 'var(--color-primary)'
    }
  }

  const typeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return '✓'
      case 'error':   return '✕'
      case 'warning': return '⚠'
      default:        return 'ℹ'
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <Modal
      title={`${t('common.notifications')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
      onClose={onClose}
      size="md"
    >
      {unreadCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead}>
            ✓ {t('common.markAllRead')}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
        {loading && <p className="text-muted">{t('common.loading')}</p>}
        {!loading && notifications.length === 0 && (
          <p className="text-muted" style={{ textAlign: 'center', padding: '2rem 0' }}>
            {t('common.noNotifications')}
          </p>
        )}
        {notifications.map(n => (
          <div
            key={n.id}
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: n.read ? 'var(--color-surface)' : 'var(--color-surface-2)',
              borderLeft: `3px solid ${typeColor(n.type)}`,
              opacity: n.read ? 0.7 : 1,
            }}
          >
            <span style={{ color: typeColor(n.type), fontSize: '1rem', flexShrink: 0, marginTop: '0.1rem' }}>
              {typeIcon(n.type)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {n.title && (
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.2rem' }}>
                  {n.title}
                </div>
              )}
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0, wordBreak: 'break-word' }}>
                {n.message.replace(/\s*\[ref:[^\]]+\]/g, '').trim()}
              </p>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {new Date(n.created_at).toLocaleString('de-DE', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
              {!n.read && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleMarkRead(n.id)}
                  title={t('common.markAsRead')}
                >✓</button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleDelete(n.id)}
                title={t('common.delete')}
                style={{ color: 'var(--color-danger)' }}
              >✕</button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
