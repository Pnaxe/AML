import React, { useEffect, useMemo, useState } from 'react'
import {
  HiOutlineArrowRight,
  HiOutlineChatAlt2,
  HiOutlineChip,
  HiOutlineFire,
  HiOutlineUser,
} from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import './ActivityFeed.css'

type ActivityType = 'takeover' | 'hot-lead' | 'bot-replied' | 'new-conversation'

type ActivityItem = {
  id: string
  type: ActivityType
  title: string
  actor: string
  detail: string
  ago: string
  sortTime: number
}

type GenericRecord = Record<string, unknown>
type Paged<T> = { results?: T[] } | T[]

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const ACTIVITY_FEED_CACHE_KEY = 'aml_activity_feed_cache'

function rowsOf<T>(payload: Paged<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function dateOf(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatAgo(value: Date): string {
  const diffMs = Date.now() - value.getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function iconForType(type: ActivityType): React.ReactNode {
  if (type === 'takeover') return <HiOutlineUser size={16} />
  if (type === 'hot-lead') return <HiOutlineFire size={16} />
  if (type === 'bot-replied') return <HiOutlineChip size={16} />
  return <HiOutlineChatAlt2 size={16} />
}

function buildActivityFeed(
  alerts: GenericRecord[],
  cases: GenericRecord[],
  models: GenericRecord[],
  transactions: GenericRecord[]
): ActivityItem[] {
  const alertItems = alerts.slice(0, 4).map((row, index) => {
    const severity = String(row.severity ?? 'LOW').toUpperCase()
    const title = severity === 'HIGH' || severity === 'CRITICAL' ? 'High-risk alert raised' : 'Alert generated'
    const triggeredAt = dateOf(row.triggered_at ?? row.created_at) ?? new Date()
    return {
      id: `alert-${row.id ?? index}`,
      type: severity === 'HIGH' || severity === 'CRITICAL' ? 'hot-lead' : 'new-conversation',
      title,
      actor: 'Alert Engine',
      detail: `${String(row.alert_id ?? 'Alert')} ${String(row.title ?? row.description ?? '').slice(0, 72)}`.trim(),
      ago: formatAgo(triggeredAt),
      sortTime: triggeredAt.getTime(),
    }
  })

  const caseItems = cases.slice(0, 3).map((row, index) => {
    const createdAt = dateOf(row.triggered_at ?? row.created_at) ?? new Date()
    return {
      id: `case-${row.id ?? index}`,
      type: 'takeover' as const,
      title: 'Case moved to analyst review',
      actor: String(row.investigator_name ?? 'Case Management'),
      detail: `${String(row.alert_id ?? 'Case')} ${String(row.title ?? row.description ?? '').slice(0, 72)}`.trim(),
      ago: formatAgo(createdAt),
      sortTime: createdAt.getTime(),
    }
  })

  const modelItems = models.slice(0, 2).map((row, index) => {
    const updatedAt = dateOf(row.updated_at ?? row.created_at) ?? new Date()
    return {
      id: `model-${row.id ?? index}`,
      type: 'bot-replied' as const,
      title: 'Model status updated',
      actor: String(row.name ?? 'ML Engine'),
      detail: `${String(row.status ?? 'UNKNOWN')} ${String(row.version ?? '')}`.trim(),
      ago: formatAgo(updatedAt),
      sortTime: updatedAt.getTime(),
    }
  })

  const transactionItems = transactions
    .filter((row) => Boolean(row.is_suspicious))
    .slice(0, 3)
    .map((row, index) => {
      const transactionAt = dateOf(row.transaction_date ?? row.created_at) ?? new Date()
      return {
        id: `txn-${row.id ?? index}`,
        type: 'hot-lead' as const,
        title: 'Suspicious transaction flagged',
        actor: 'Transaction Monitoring',
        detail: `${String(row.transaction_id ?? 'Transaction')} scored ${String(row.risk_score ?? '-')}`,
        ago: formatAgo(transactionAt),
        sortTime: transactionAt.getTime(),
      }
    })

  return [...alertItems, ...caseItems, ...modelItems, ...transactionItems]
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 10)
}

export const ActivityFeed: React.FC = () => {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ActivityItem[]>([])

  useEffect(() => {
    const loadFeed = async () => {
      const cachedValue = sessionStorage.getItem(ACTIVITY_FEED_CACHE_KEY)
      setLoading(true)
      if (cachedValue) {
        try {
          const parsed = JSON.parse(cachedValue) as ActivityItem[]
          setItems(parsed)
        } catch {
          sessionStorage.removeItem(ACTIVITY_FEED_CACHE_KEY)
        }
      }
      setError(null)

      const authHeaders: Record<string, string> = {}
      if (token) authHeaders.Authorization = `Token ${token}`

      try {
        const [alertsRes, casesRes, modelsRes, transactionsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/alerts/`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/alerts/cases_for_sar/`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/ml-models/?model_type=TRANSACTION_RISK`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/transactions/`, { headers: authHeaders }),
        ])

        if (!alertsRes.ok || !casesRes.ok || !modelsRes.ok || !transactionsRes.ok) {
          throw new Error('Failed to load activity feed')
        }

        const [alertsPayload, casesPayload, modelsPayload, transactionsPayload] = await Promise.all([
          alertsRes.json(),
          casesRes.json(),
          modelsRes.json(),
          transactionsRes.json(),
        ])

        const nextItems = buildActivityFeed(
          rowsOf<GenericRecord>(alertsPayload),
          rowsOf<GenericRecord>(casesPayload),
          rowsOf<GenericRecord>(modelsPayload),
          rowsOf<GenericRecord>(transactionsPayload)
        )
        setItems(nextItems)
        sessionStorage.setItem(ACTIVITY_FEED_CACHE_KEY, JSON.stringify(nextItems))
      } catch (e) {
        if (!cachedValue) {
          setError(e instanceof Error ? e.message : 'Unable to load activity feed')
          setItems([])
        }
      } finally {
        setLoading(false)
      }
    }

    void loadFeed()
  }, [token])

  const visibleItems = useMemo(() => items, [items])
  const skeletonRows = Array.from({ length: 8 })

  return (
    <div className="activity-feed-page">
      <h2 className="activity-feed-title">Recent activity</h2>
      {error && <div className="activity-item-detail">{error}</div>}
      <div className="activity-feed-list">
        {loading && visibleItems.length === 0 &&
          skeletonRows.map((_, index) => (
            <div className="activity-feed-card activity-feed-card-skeleton" key={`skeleton-${index}`}>
              <div className="activity-icon-skeleton activity-skeleton-block" />
              <div className="activity-main">
                <div className="activity-line-skeleton activity-line-skeleton-title activity-skeleton-block" />
                <div className="activity-line-skeleton activity-line-skeleton-actor activity-skeleton-block" />
                <div className="activity-line-skeleton activity-line-skeleton-detail activity-skeleton-block" />
              </div>
              <div className="activity-right">
                <div className="activity-time-skeleton activity-skeleton-block" />
              </div>
            </div>
          ))}
        {visibleItems.map((item) => (
          <button type="button" className="activity-feed-card" key={item.id}>
            <div className={`activity-icon activity-icon-${item.type}`}>
              {iconForType(item.type)}
            </div>
            <div className="activity-main">
              <div className="activity-item-title">{item.title}</div>
              <div className="activity-item-actor">{item.actor}</div>
              <div className="activity-item-detail">{item.detail}</div>
            </div>
            <div className="activity-right">
              <span className="activity-time">{item.ago}</span>
              <HiOutlineArrowRight size={18} className="activity-arrow" />
            </div>
          </button>
        ))}
        {!loading && visibleItems.length === 0 && !error && (
          <div className="activity-feed-card">
            <div className="activity-main">
              <div className="activity-item-title">No recent activity</div>
              <div className="activity-item-detail">New alerts, cases, model updates, and flagged transactions will appear here.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
