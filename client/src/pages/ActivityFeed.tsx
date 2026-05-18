import React, { useEffect, useMemo, useState } from 'react'
import {
  HiOutlineArrowRight,
  HiOutlineChatAlt2,
  HiOutlineChip,
  HiOutlineFire,
  HiOutlineUser,
} from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import { fetchJsonWithRetry, isAbortError } from '../contexts/fetchUtils'
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const ACTIVITY_FEED_CACHE_KEY = 'aml_activity_feed_cache'

function iconForType(type: ActivityType): React.ReactNode {
  if (type === 'takeover') return <HiOutlineUser size={16} />
  if (type === 'hot-lead') return <HiOutlineFire size={16} />
  if (type === 'bot-replied') return <HiOutlineChip size={16} />
  return <HiOutlineChatAlt2 size={16} />
}

export const ActivityFeed: React.FC = () => {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ActivityItem[]>([])

  useEffect(() => {
    const controller = new AbortController()

    const loadFeed = async () => {
      setLoading(true)
      const cachedValue = sessionStorage.getItem(ACTIVITY_FEED_CACHE_KEY)
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
        const payload = await fetchJsonWithRetry<{ results?: ActivityItem[] }>(
          `${API_BASE_URL}/analytics/activity-feed/`,
          { headers: authHeaders, signal: controller.signal }
        )
        const nextItems = payload.results ?? []
        setItems(nextItems)
        sessionStorage.setItem(ACTIVITY_FEED_CACHE_KEY, JSON.stringify(nextItems))
      } catch (e) {
        if (isAbortError(e)) return
        if (!cachedValue) {
          setError(e instanceof Error ? e.message : 'Unable to load activity feed')
          setItems([])
        }
      } finally {
        setLoading(false)
      }
    }

    void loadFeed()
    return () => controller.abort()
  }, [token])

  const visibleItems = useMemo(() => items, [items])
  const skeletonRows = Array.from({ length: 8 })

  return (
    <div className="activity-feed-page">
      <h2 className="activity-feed-title">Recent activity</h2>
      {error && <div className="activity-item-detail">{error}</div>}
      <div className="activity-feed-list">
        {loading &&
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
        {!loading && visibleItems.map((item) => (
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
