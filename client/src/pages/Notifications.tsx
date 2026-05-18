import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineBell, HiOutlineExclamationCircle } from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import './Notifications.css'

type GenericRecord = Record<string, unknown>
type Paged<T> = { results?: T[] } | T[]

type NotificationItem = {
  id: string
  title: string
  message: string
  severity: string
  status: string
  createdAt: Date | null
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const DISMISSED_NOTIFICATIONS_STORAGE_KEY = 'aml_notifications_dismissed_ids'
const NOTIFICATIONS_CACHE_KEY = 'aml_notifications_cache'

function rowsOf<T>(payload: Paged<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatTimestamp(value: Date | null): string {
  if (!value) return '-'
  return value.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function mapAlertsToNotifications(rows: GenericRecord[]): NotificationItem[] {
  return rows
    .map((row, index) => {
      const severity = String(row.severity ?? 'LOW').toUpperCase()
      const createdAt = toDate(row.triggered_at ?? row.created_at)
      return {
        id: String(row.id ?? index),
        title: String(row.title ?? row.alert_id ?? 'AML notification'),
        message: String(row.description ?? 'New AML event requires review.'),
        severity,
        status: String(row.status ?? 'NEW').toUpperCase(),
        createdAt,
      }
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

function getDismissedIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((item) => String(item)))
  } catch {
    return new Set()
  }
}

function saveDismissedIds(ids: Set<string>): void {
  window.localStorage.setItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(Array.from(ids)))
}

type NotificationsProps = {
  onClose?: () => void
  onOpenSettings?: () => void
  onNotificationsChange?: () => void
}

export const Notifications: React.FC<NotificationsProps> = ({
  onClose,
  onOpenSettings,
  onNotificationsChange,
}) => {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadNotifications = async () => {
      const cachedValue = sessionStorage.getItem(NOTIFICATIONS_CACHE_KEY)
      let hasCachedData = false
      if (cachedValue) {
        try {
          const parsed = JSON.parse(cachedValue) as NotificationItem[]
          setNotifications(parsed)
          hasCachedData = true
        } catch {
          sessionStorage.removeItem(NOTIFICATIONS_CACHE_KEY)
        }
      }
      setLoading(!hasCachedData)
      setError(null)
      try {
        const headers: Record<string, string> = {}
        if (token) headers.Authorization = `Token ${token}`
        const response = await fetch(`${API_BASE_URL}/alerts/`, { headers })
        if (!response.ok) throw new Error('Failed to load notifications')
        const payload = (await response.json()) as Paged<GenericRecord>
        const dismissedIds = getDismissedIds()
        const visibleNotifications = mapAlertsToNotifications(rowsOf(payload)).filter(
          (item) => !dismissedIds.has(item.id)
        )
        setNotifications(visibleNotifications)
        sessionStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(visibleNotifications))
        setSelectedIds((prev) => {
          const next = new Set<string>()
          visibleNotifications.forEach((item) => {
            if (prev.has(item.id)) next.add(item.id)
          })
          return next
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load notifications')
        setNotifications([])
        setSelectedIds(new Set())
      } finally {
        setLoading(false)
      }
    }

    void loadNotifications()
  }, [token])

  const hasNotifications = useMemo(() => notifications.length > 0, [notifications])
  const selectedCount = selectedIds.size

  const dismissNotifications = React.useCallback((ids: string[]) => {
    if (ids.length === 0) return
    const dismissedIds = getDismissedIds()
    ids.forEach((id) => dismissedIds.add(id))
    saveDismissedIds(dismissedIds)
    setNotifications((prev) => {
      const nextNotifications = prev.filter((item) => !dismissedIds.has(item.id))
      sessionStorage.setItem(NOTIFICATIONS_CACHE_KEY, JSON.stringify(nextNotifications))
      return nextNotifications
    })
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
    onNotificationsChange?.()
  }, [onNotificationsChange])

  const handleClearOne = (id: string) => {
    dismissNotifications([id])
  }

  const handleClearSelected = () => {
    dismissNotifications(Array.from(selectedIds))
  }

  const handleClearAll = () => {
    dismissNotifications(notifications.map((item) => item.id))
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <div>
          <h1 className="notifications-title">Notifications</h1>
          <p className="notifications-subtitle">All AML notifications in one place.</p>
        </div>
        <div className="notifications-actions">
          <button type="button" className="notifications-btn" onClick={onOpenSettings}>
            Notification Settings
          </button>
          <button
            type="button"
            className="notifications-btn"
            onClick={handleClearSelected}
            disabled={selectedCount === 0}
          >
            Clear Selected
          </button>
          <button
            type="button"
            className="notifications-btn notifications-btn-danger"
            onClick={handleClearAll}
            disabled={!hasNotifications}
          >
            Clear All
          </button>
          <button type="button" className="notifications-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </header>

      <section className="notifications-list-wrap">
        {loading && <div className="notifications-state">Loading notifications...</div>}
        {!loading && error && <div className="notifications-state notifications-error">{error}</div>}
        {!loading && !error && !hasNotifications && (
          <div className="notifications-empty">
            <HiOutlineBell size={30} />
            <span>No notifications yet.</span>
          </div>
        )}
        {!loading && !error && hasNotifications && (
          <div className="notifications-list">
            {notifications.map((item) => (
              <article key={item.id} className="notification-card">
                <label className="notification-select-wrap">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelected(item.id)}
                    aria-label={`Select notification ${item.title}`}
                  />
                </label>
                <div className={`notification-severity severity-${item.severity.toLowerCase()}`}>
                  <HiOutlineExclamationCircle size={16} />
                  {item.severity}
                </div>
                <div className="notification-main">
                  <h2 className="notification-title">{item.title}</h2>
                  <p className="notification-message">{item.message}</p>
                </div>
                <div className="notification-meta">
                  <span className="notification-status">{item.status}</span>
                  <span className="notification-time">{formatTimestamp(item.createdAt)}</span>
                  <button
                    type="button"
                    className="notification-clear-btn"
                    onClick={() => handleClearOne(item.id)}
                  >
                    Clear
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
