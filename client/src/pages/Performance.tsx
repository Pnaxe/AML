import React, { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { HiOutlineChartBar, HiOutlineChip, HiOutlineClock, HiOutlineLightningBolt } from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import { fetchJsonWithRetry, isAbortError } from '../contexts/fetchUtils'
import './Dashboard.css'

type Trend = 'up' | 'down'

type PerformanceResponse = {
  kpis: {
    activeModels: { value: string; change: string; trend: Trend }
    avgRiskScore: { value: string; change: string; trend: Trend }
    modelAccuracy: { value: string; change: string; trend: Trend }
    transactionThroughput: { value: string; change: string; trend: Trend }
  }
  dailyRiskVsVolume: Array<{ day: string; riskScore: number; transactions: number }>
  alertStatusMix: Array<{ name: string; value: number; color: string }>
  dailyOperations: Array<{ day: string; alerts: number; cases: number; sar: number }>
  modelQuality: Array<{ model: string; accuracy: number; precision: number; recall: number }>
  detectionBySource: Array<{ source: string; flagged: number; normal: number }>
  queueSla: Array<{ day: string; processed: number; withinSla: number }>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const PERFORMANCE_CACHE_KEY = 'aml_performance_cache'

const EMPTY_PERFORMANCE_DATA: PerformanceResponse = {
  kpis: {
    activeModels: { value: '0', change: 'No data yet', trend: 'up' },
    avgRiskScore: { value: '0%', change: 'No data yet', trend: 'up' },
    modelAccuracy: { value: '0%', change: 'No data yet', trend: 'up' },
    transactionThroughput: { value: '0/hr', change: 'No data yet', trend: 'up' },
  },
  dailyRiskVsVolume: [],
  alertStatusMix: [],
  dailyOperations: [],
  modelQuality: [],
  detectionBySource: [],
  queueSla: [],
}

export const Performance: React.FC = () => {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PerformanceResponse | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadPerformance = async () => {
      setLoading(true)
      const cachedValue = sessionStorage.getItem(PERFORMANCE_CACHE_KEY)
      let hasCachedData = false
      if (cachedValue) {
        try {
          const parsed = JSON.parse(cachedValue) as PerformanceResponse
          setData(parsed)
          hasCachedData = true
        } catch {
          sessionStorage.removeItem(PERFORMANCE_CACHE_KEY)
        }
      }
      setError(null)

      const authHeaders: Record<string, string> = {}
      if (token) authHeaders.Authorization = `Token ${token}`

      try {
        const nextData = await fetchJsonWithRetry<PerformanceResponse>(
          `${API_BASE_URL}/analytics/performance/`,
          { headers: authHeaders, signal: controller.signal }
        )
        setData(nextData)
        sessionStorage.setItem(PERFORMANCE_CACHE_KEY, JSON.stringify(nextData))
      } catch (e) {
        if (isAbortError(e)) return
        if (!hasCachedData) {
          setError(e instanceof Error ? e.message : 'Unable to load performance data')
          setData(EMPTY_PERFORMANCE_DATA)
        }
      } finally {
        setLoading(false)
      }
    }

    void loadPerformance()
    return () => controller.abort()
  }, [token])

  const kpiCards = useMemo(() => {
    if (!data) return []
    return [
      { label: 'Active Models', value: data.kpis.activeModels.value, change: data.kpis.activeModels.change, trend: data.kpis.activeModels.trend, icon: HiOutlineLightningBolt, iconColor: '#22c55e' },
      { label: 'Avg Risk Score', value: data.kpis.avgRiskScore.value, change: data.kpis.avgRiskScore.change, trend: data.kpis.avgRiskScore.trend, icon: HiOutlineClock, iconColor: '#6366f1' },
      { label: 'Model Accuracy', value: data.kpis.modelAccuracy.value, change: data.kpis.modelAccuracy.change, trend: data.kpis.modelAccuracy.trend, icon: HiOutlineChip, iconColor: '#7c3aed' },
      { label: 'Transaction Throughput', value: data.kpis.transactionThroughput.value, change: data.kpis.transactionThroughput.change, trend: data.kpis.transactionThroughput.trend, icon: HiOutlineChartBar, iconColor: '#f97316' },
    ]
  }, [data])

  const skeletonCards = Array.from({ length: 4 })
  const renderChartSkeleton = (key: string, wide = false, full = false, summary = false) => (
    <div
      key={key}
      className={`chart-card ${wide ? 'chart-wide' : ''} ${full ? 'chart-full' : ''} ${summary ? 'chart-summary' : ''}`}
    >
      <div className="chart-title dashboard-skeleton dashboard-title-skeleton" aria-hidden="true" />
      {summary ? (
        <div className="dashboard-summary-skeleton" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`perf-summary-skeleton-${key}-${index}`} className="dashboard-summary-skeleton-row">
              <div className="dashboard-skeleton dashboard-summary-value-skeleton" />
              <div className="dashboard-skeleton dashboard-summary-label-skeleton" />
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard-skeleton dashboard-chart-skeleton" aria-hidden="true" />
      )}
    </div>
  )
  const showSkeleton = loading || !data

  return (
    <div className="dashboard-overview" aria-busy={showSkeleton}>
      <div className="dashboard-header">
        {showSkeleton ? (
          <>
            <div className="dashboard-skeleton dashboard-title-skeleton" aria-hidden="true" />
            <div className="dashboard-skeleton dashboard-desc-skeleton" aria-hidden="true" />
          </>
        ) : (
          <>
            <h1 className="dashboard-title">AfriSentry Performance Overview</h1>
            <p className="dashboard-desc">Live operational performance across alerts, cases, transactions, SAR output, and model quality.</p>
          </>
        )}
      </div>

      {error && (
        <div className="customers-filters-card">
          <span className="muted">{error}</span>
        </div>
      )}

      <div className="dashboard-cards">
        {showSkeleton
          ? skeletonCards.map((_, index) => (
              <div key={`perf-kpi-skeleton-${index}`} className="dashboard-card dashboard-card-skeleton">
                <div className="dashboard-card-icon-skeleton dashboard-skeleton" />
                <div className="dashboard-card-label-skeleton dashboard-skeleton" />
                <div className="dashboard-card-value-skeleton dashboard-skeleton" />
                <div className="dashboard-card-label-skeleton dashboard-skeleton" style={{ marginTop: '12px', width: '50%' }} />
              </div>
            ))
          : kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="dashboard-card">
              <div className="dashboard-card-icon" style={{ color: card.iconColor }}>
                <Icon size={22} />
              </div>
              <div className="dashboard-card-label">{card.label}</div>
              <div className="dashboard-card-value">{card.value}</div>
              <div className={`dashboard-card-change ${card.trend}`}>{card.change}</div>
            </div>
          )
        })}
      </div>

      {showSkeleton ? (
        <>
          <div className="dashboard-charts">
            {renderChartSkeleton('p1', true)}
            {renderChartSkeleton('p2')}
          </div>
          <div className="dashboard-charts">
            {renderChartSkeleton('p3', true)}
            {renderChartSkeleton('p4', false, false, true)}
          </div>
          <div className="dashboard-charts dashboard-charts-three">
            {renderChartSkeleton('p5', true)}
            {renderChartSkeleton('p6')}
          </div>
          <div className="dashboard-charts">
            {renderChartSkeleton('p7', false, true)}
          </div>
        </>
      ) : data && (
        <>
          <div className="dashboard-charts">
            <div className="chart-card chart-wide">
              <div className="chart-title">Daily Risk Score vs Transaction Volume</div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.dailyRiskVsVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Line type="monotone" dataKey="riskScore" name="Avg risk %" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
                  <Line type="monotone" dataKey="transactions" name="Transactions" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <div className="chart-title">Alert Status Mix</div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={data.alertStatusMix}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${value}`}
                  >
                    {data.alertStatusMix.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dashboard-charts">
            <div className="chart-card chart-wide">
              <div className="chart-title">Alerts, Cases, and SAR Activity</div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data.dailyOperations}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Area type="monotone" dataKey="alerts" name="Alerts" stackId="1" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.55} />
                  <Area type="monotone" dataKey="cases" name="Cases" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.55} />
                  <Area type="monotone" dataKey="sar" name="SAR filed" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.55} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card chart-summary">
              <div className="chart-title">Quick Health</div>
              <div className="quick-stats">
                <div className="quick-stat">
                  <span className="quick-stat-value">{data.alertStatusMix.length}</span>
                  <span className="quick-stat-label">Alert statuses in queue</span>
                </div>
                <div className="quick-stat">
                  <span className="quick-stat-value">
                    {data.queueSla.reduce((sum, item) => sum + item.withinSla, 0)}
                  </span>
                  <span className="quick-stat-label">Within SLA</span>
                </div>
                <div className="quick-stat">
                  <span className="quick-stat-value">{data.modelQuality.length}</span>
                  <span className="quick-stat-label">Models measured</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-charts dashboard-charts-three">
            <div className="chart-card chart-wide">
              <div className="chart-title">Detection Mix by Source</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.detectionBySource}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="source" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="flagged" name="Flagged" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="normal" name="Normal/remaining" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <div className="chart-title">Model Quality</div>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.modelQuality}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="model" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Line type="monotone" dataKey="accuracy" name="Accuracy %" stroke="#22c55e" strokeWidth={2} />
                  <Line type="monotone" dataKey="precision" name="Precision %" stroke="#6366f1" strokeWidth={2} />
                  <Line type="monotone" dataKey="recall" name="Recall %" stroke="#f97316" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dashboard-charts">
            <div className="chart-card chart-full">
              <div className="chart-title">Queue Processing vs SLA</div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data.queueSla}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="processed" name="Processed" fill="#7c3aed" />
                  <Bar dataKey="withinSla" name="Within SLA" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
