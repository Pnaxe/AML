import React, { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { HiOutlineCash, HiOutlineFire, HiOutlineBriefcase, HiOutlineChip } from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import './Dashboard.css'

type Trend = 'up' | 'down'

type OverviewResponse = {
  kpis: {
    totalTransactions: { value: number; change: string; trend: Trend }
    highRiskAlerts: { value: number; change: string; trend: Trend }
    openCases: { value: number; change: string; trend: Trend }
    mlModels: { value: number; change: string; trend: Trend }
  }
  quickStats: {
    totalCustomers: number
    totalAlerts: number
    highRiskAlerts: number
  }
  transactionFlowByDay: Array<{ day: string; debits: number; credits: number }>
  alertSeverityMix: Array<{ name: string; value: number; color: string }>
  weeklyTrends: Array<{ week: string; transactions: number; alerts: number }>
  alertsCreatedByDay: Array<{ day: string; total: number; highRisk: number }>
  caseAging: Array<{ bucket: string; count: number; fill: string }>
  customerRiskLevels: Array<{ tier: string; count: number; fill: string }>
}

type GenericRecord = Record<string, unknown>
type Paged<T> = { count?: number; results?: T[] } | T[]

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const DASHBOARD_CACHE_KEY = 'aml_dashboard_overview_cache'

const OUTGOING_TYPES = new Set(['WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'WIRE', 'ATM', 'CHECK', 'CARD', 'CRYPTO'])
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
}
const RISK_COLORS: Record<string, string> = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#22c55e',
}

function rowsOf<T>(payload: Paged<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function dateOf(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function countTrend(current: number, previous: number): { change: string; trend: Trend } {
  const delta = current - previous
  if (delta === 0) {
    return { change: 'No change', trend: 'up' }
  }
  const sign = delta > 0 ? '+' : ''
  return {
    change: `${sign}${delta.toLocaleString()}`,
    trend: delta >= 0 ? 'up' : 'down',
  }
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

function formatWeekLabel(date: Date): string {
  return `Wk ${Math.ceil(date.getDate() / 7)}`
}

function buildOverviewData(
  customers: GenericRecord[],
  transactions: GenericRecord[],
  alerts: GenericRecord[],
  cases: GenericRecord[],
  models: GenericRecord[]
): OverviewResponse {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const recentTransactionDates = transactions
    .map((row) => dateOf(row.transaction_date ?? row.created_at))
    .filter((value): value is Date => value instanceof Date)

  const recentAlertDates = alerts
    .map((row) => dateOf(row.triggered_at ?? row.created_at))
    .filter((value): value is Date => value instanceof Date)

  const transactionFlowByDay = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(startOfToday)
    day.setDate(startOfToday.getDate() - (6 - index))
    const dayKey = day.toDateString()

    const dayTransactions = transactions.filter((row) => {
      const rowDate = dateOf(row.transaction_date ?? row.created_at)
      return rowDate?.toDateString() === dayKey
    })

    const debits = dayTransactions.filter((row) =>
      OUTGOING_TYPES.has(String(row.transaction_type ?? '').toUpperCase())
    ).length
    const credits = Math.max(0, dayTransactions.length - debits)

    return {
      day: formatDayLabel(day),
      debits,
      credits,
    }
  })

  const alertSeverityCounts = alerts.reduce<Record<string, number>>((acc, row) => {
    const severity = String(row.severity ?? 'LOW').toUpperCase()
    acc[severity] = (acc[severity] ?? 0) + 1
    return acc
  }, {})

  const alertSeverityMix = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    .map((severity) => ({
      name: severity,
      value: alertSeverityCounts[severity] ?? 0,
      color: SEVERITY_COLORS[severity],
    }))
    .filter((item) => item.value > 0)

  const weeklyTrends = Array.from({ length: 4 }, (_, index) => {
    const weekStart = new Date(startOfToday)
    weekStart.setDate(startOfToday.getDate() - (27 - index * 7))
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)

    const transactionsCount = recentTransactionDates.filter((value) => value >= weekStart && value <= weekEnd).length
    const alertsCount = recentAlertDates.filter((value) => value >= weekStart && value <= weekEnd).length

    return {
      week: formatWeekLabel(weekStart),
      transactions: transactionsCount,
      alerts: alertsCount,
    }
  })

  const alertsCreatedByDay = Array.from({ length: 5 }, (_, index) => {
    const day = new Date(startOfToday)
    day.setDate(startOfToday.getDate() - (4 - index))
    const dayKey = day.toDateString()

    const dayAlerts = alerts.filter((row) => {
      const rowDate = dateOf(row.triggered_at ?? row.created_at)
      return rowDate?.toDateString() === dayKey
    })

    const highRisk = dayAlerts.filter((row) => {
      const severity = String(row.severity ?? '').toUpperCase()
      return severity === 'HIGH' || severity === 'CRITICAL'
    }).length

    return {
      day: formatDayLabel(day),
      total: dayAlerts.length,
      highRisk,
    }
  })

  const caseAgingBuckets = [
    { label: '0-7 days', min: 0, max: 7, fill: '#22c55e' },
    { label: '8-30 days', min: 8, max: 30, fill: '#f97316' },
    { label: '31-90 days', min: 31, max: 90, fill: '#eab308' },
    { label: '90+ days', min: 91, max: Number.POSITIVE_INFINITY, fill: '#ef4444' },
  ]

  const caseAging = caseAgingBuckets.map((bucket) => {
    const count = cases.filter((row) => {
      const rowDate = dateOf(row.triggered_at ?? row.created_at)
      if (!rowDate) return false
      const ageDays = Math.floor((now.getTime() - rowDate.getTime()) / 86400000)
      return ageDays >= bucket.min && ageDays <= bucket.max
    }).length

    return {
      bucket: bucket.label,
      count,
      fill: bucket.fill,
    }
  })

  const customerRiskCounts = customers.reduce<Record<string, number>>((acc, row) => {
    const risk = String(row.risk_level ?? 'LOW').toUpperCase()
    acc[risk] = (acc[risk] ?? 0) + 1
    return acc
  }, {})

  const customerRiskLevels = ['HIGH', 'MEDIUM', 'LOW'].map((tier) => ({
    tier,
    count: customerRiskCounts[tier] ?? 0,
    fill: RISK_COLORS[tier],
  }))

  const highRiskAlerts = alerts.filter((row) => {
    const severity = String(row.severity ?? '').toUpperCase()
    return severity === 'HIGH' || severity === 'CRITICAL'
  }).length

  const todayTransactions = recentTransactionDates.filter((value) => value >= startOfToday).length
  const yesterdayStart = new Date(startOfToday)
  yesterdayStart.setDate(startOfToday.getDate() - 1)
  const yesterdayTransactions = recentTransactionDates.filter((value) => value >= yesterdayStart && value < startOfToday).length

  const todayHighRiskAlerts = alerts.filter((row) => {
    const rowDate = dateOf(row.triggered_at ?? row.created_at)
    const severity = String(row.severity ?? '').toUpperCase()
    return rowDate && rowDate >= startOfToday && (severity === 'HIGH' || severity === 'CRITICAL')
  }).length
  const yesterdayHighRiskAlerts = alerts.filter((row) => {
    const rowDate = dateOf(row.triggered_at ?? row.created_at)
    const severity = String(row.severity ?? '').toUpperCase()
    return rowDate && rowDate >= yesterdayStart && rowDate < startOfToday && (severity === 'HIGH' || severity === 'CRITICAL')
  }).length

  const openCases = cases.filter((row) => {
    const status = String(row.status ?? '').toUpperCase()
    return status !== 'CLOSED' && status !== 'RESOLVED'
  }).length
  const activeModels = models.filter((row) => String(row.status ?? '').toUpperCase() === 'ACTIVE').length
  const testingModels = models.filter((row) => {
    const status = String(row.status ?? '').toUpperCase()
    return status === 'TRAINING' || status === 'TESTING'
  }).length

  const transactionTrend = countTrend(todayTransactions, yesterdayTransactions)
  const highRiskTrend = countTrend(todayHighRiskAlerts, yesterdayHighRiskAlerts)

  return {
    kpis: {
      totalTransactions: {
        value: transactions.length,
        change: `${transactionTrend.change} today`,
        trend: transactionTrend.trend,
      },
      highRiskAlerts: {
        value: highRiskAlerts,
        change: `${highRiskTrend.change} today`,
        trend: highRiskTrend.trend,
      },
      openCases: {
        value: openCases,
        change: `${cases.length.toLocaleString()} queued`,
        trend: 'up',
      },
      mlModels: {
        value: activeModels,
        change: `${testingModels.toLocaleString()} in training/testing`,
        trend: 'up',
      },
    },
    quickStats: {
      totalCustomers: customers.length,
      totalAlerts: alerts.length,
      highRiskAlerts,
    },
    transactionFlowByDay,
    alertSeverityMix,
    weeklyTrends,
    alertsCreatedByDay,
    caseAging,
    customerRiskLevels,
  }
}

export const Dashboard: React.FC = () => {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<OverviewResponse | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      const cachedValue = sessionStorage.getItem(DASHBOARD_CACHE_KEY)
      setLoading(true)
      if (cachedValue) {
        try {
          const parsed = JSON.parse(cachedValue) as OverviewResponse
          setData(parsed)
        } catch {
          sessionStorage.removeItem(DASHBOARD_CACHE_KEY)
        }
      }
      setError(null)

      const authHeaders: Record<string, string> = {}
      if (token) authHeaders.Authorization = `Token ${token}`

      try {
        const [customersRes, transactionsRes, alertsRes, casesRes, modelsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/customers/`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/transactions/`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/alerts/`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/alerts/cases_for_sar/`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/ml-models/?model_type=TRANSACTION_RISK`, { headers: authHeaders }),
        ])

        if (!customersRes.ok || !transactionsRes.ok || !alertsRes.ok || !casesRes.ok || !modelsRes.ok) {
          throw new Error('Failed to load dashboard metrics')
        }

        const [customersPayload, transactionsPayload, alertsPayload, casesPayload, modelsPayload] = await Promise.all([
          customersRes.json(),
          transactionsRes.json(),
          alertsRes.json(),
          casesRes.json(),
          modelsRes.json(),
        ])

        const nextData = buildOverviewData(
          rowsOf<GenericRecord>(customersPayload),
          rowsOf<GenericRecord>(transactionsPayload),
          rowsOf<GenericRecord>(alertsPayload),
          rowsOf<GenericRecord>(casesPayload),
          rowsOf<GenericRecord>(modelsPayload)
        )
        setData(nextData)
        sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(nextData))
      } catch (e) {
        if (!cachedValue) {
          setError(e instanceof Error ? e.message : 'Unable to load dashboard')
          setData(null)
        }
      } finally {
        setLoading(false)
      }
    }

    void loadDashboard()
  }, [token])

  const kpiCards = useMemo(() => {
    if (!data) return []
    return [
      { label: 'Total Transactions', value: data.kpis.totalTransactions.value.toLocaleString(), change: data.kpis.totalTransactions.change, trend: data.kpis.totalTransactions.trend, icon: HiOutlineCash, iconColor: '#22c55e' },
      { label: 'High Risk Alerts', value: data.kpis.highRiskAlerts.value.toLocaleString(), change: data.kpis.highRiskAlerts.change, trend: data.kpis.highRiskAlerts.trend, icon: HiOutlineFire, iconColor: '#ef4444' },
      { label: 'Open Cases', value: data.kpis.openCases.value.toLocaleString(), change: data.kpis.openCases.change, trend: data.kpis.openCases.trend, icon: HiOutlineBriefcase, iconColor: '#f97316' },
      { label: 'Active ML Models', value: data.kpis.mlModels.value.toLocaleString(), change: data.kpis.mlModels.change, trend: data.kpis.mlModels.trend, icon: HiOutlineChip, iconColor: '#6366f1' },
    ]
  }, [data])

  const skeletonCards = Array.from({ length: 4 })
  const renderChartSkeleton = (key: string, wide = false, full = false, summary = false) => (
    <div
      key={key}
      className={`chart-card ${wide ? 'chart-wide' : ''} ${full ? 'chart-full' : ''} ${summary ? 'chart-summary' : ''}`}
    >
      <div className="chart-title dashboard-skeleton dashboard-title-skeleton" />
      <div className="dashboard-skeleton dashboard-chart-skeleton" />
    </div>
  )

  return (
    <div className="dashboard-overview">
      <div className="dashboard-header">
        {loading ? (
          <>
            <div className="dashboard-title-skeleton dashboard-skeleton" />
            <div className="dashboard-desc-skeleton dashboard-skeleton" />
          </>
        ) : (
          <>
            <h1 className="dashboard-title">AfriSentry Dashboard</h1>
            <p className="dashboard-desc">Live overview of transactions, alerts, cases, customers, and deployed AML models.</p>
          </>
        )}
      </div>

      {error && (
        <div className="customers-filters-card">
          <span className="muted">{error}</span>
        </div>
      )}

      <div className="dashboard-cards">
        {loading && !data
          ? skeletonCards.map((_, index) => (
              <div key={`kpi-skeleton-${index}`} className="dashboard-card dashboard-card-skeleton">
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

      {loading && !data ? (
        <>
          <div className="dashboard-charts">
            {renderChartSkeleton('s1', true)}
            {renderChartSkeleton('s2')}
          </div>
          <div className="dashboard-charts">
            {renderChartSkeleton('s3', true)}
            {renderChartSkeleton('s4', false, false, true)}
          </div>
          <div className="dashboard-charts dashboard-charts-three">
            {renderChartSkeleton('s5', true)}
            {renderChartSkeleton('s6')}
          </div>
          <div className="dashboard-charts">
            {renderChartSkeleton('s7', false, true)}
          </div>
        </>
      ) : data && (
        <>
          <div className="dashboard-charts">
            <div className="chart-card chart-wide">
              <div className="chart-title">Transaction Flow (Debits vs Credits)</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.transactionFlowByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="debits" name="Debits" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="credits" name="Credits" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <div className="chart-title">Alert Severity Mix</div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={data.alertSeverityMix}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {data.alertSeverityMix.map((entry, index) => (
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
              <div className="chart-title">Weekly Transactions vs Alerts</div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.weeklyTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="week" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Line type="monotone" dataKey="transactions" name="Transactions" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed', r: 4 }} />
                  <Line type="monotone" dataKey="alerts" name="Alerts" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card chart-summary">
              <div className="chart-title">Quick Stats</div>
              <div className="quick-stats">
                <div className="quick-stat">
                  <span className="quick-stat-value">{data.quickStats.totalCustomers.toLocaleString()}</span>
                  <span className="quick-stat-label">Total customers</span>
                </div>
                <div className="quick-stat">
                  <span className="quick-stat-value">{data.quickStats.totalAlerts.toLocaleString()}</span>
                  <span className="quick-stat-label">Total alerts</span>
                </div>
                <div className="quick-stat">
                  <span className="quick-stat-value">{data.quickStats.highRiskAlerts.toLocaleString()}</span>
                  <span className="quick-stat-label">High-risk alerts</span>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-charts dashboard-charts-three">
            <div className="chart-card chart-wide">
              <div className="chart-title">Alerts Created vs High-Risk Alerts</div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.alertsCreatedByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Area type="monotone" dataKey="total" name="Alerts created" stackId="1" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="highRisk" name="High-risk" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <div className="chart-title">Open Cases by Age</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.caseAging} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" fontSize={12} />
                  <YAxis dataKey="bucket" type="category" stroke="#64748b" fontSize={12} width={80} />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="count" name="Open cases" fill="#7c3aed" radius={[0, 4, 4, 0]}>
                    {data.caseAging.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="dashboard-charts">
            <div className="chart-card chart-full">
              <div className="chart-title">Customer Risk Levels</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.customerRiskLevels}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="tier" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                  <Legend />
                  <Bar dataKey="count" name="Customers" radius={[4, 4, 0, 0]}>
                    {data.customerRiskLevels.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
