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
import { fetchJsonWithRetry, isAbortError } from '../contexts/fetchUtils'
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
  highRiskWorkflow: Array<{ status: string; count: number; fill: string }>
  customerRiskLevels: Array<{ tier: string; count: number; fill: string }>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const DASHBOARD_CACHE_KEY = 'aml_dashboard_overview_cache'

const EMPTY_DASHBOARD_DATA: OverviewResponse = {
  kpis: {
    totalTransactions: { value: 0, change: 'No data yet', trend: 'up' },
    highRiskAlerts: { value: 0, change: 'No data yet', trend: 'up' },
    openCases: { value: 0, change: 'No data yet', trend: 'up' },
    mlModels: { value: 0, change: 'No data yet', trend: 'up' },
  },
  quickStats: {
    totalCustomers: 0,
    totalAlerts: 0,
    highRiskAlerts: 0,
  },
  transactionFlowByDay: [],
  alertSeverityMix: [],
  weeklyTrends: [],
  alertsCreatedByDay: [],
  highRiskWorkflow: [],
  customerRiskLevels: [],
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asText(value: unknown, fallback = 'No data yet'): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function asTrend(value: unknown): Trend {
  return value === 'down' ? 'down' : 'up'
}

function normalizeOverviewResponse(payload: unknown): OverviewResponse {
  const source = (payload && typeof payload === 'object' ? payload : {}) as Partial<OverviewResponse>
  const kpis = source.kpis ?? EMPTY_DASHBOARD_DATA.kpis
  const quickStats = source.quickStats ?? EMPTY_DASHBOARD_DATA.quickStats

  return {
    kpis: {
      totalTransactions: {
        value: asNumber(kpis.totalTransactions?.value),
        change: asText(kpis.totalTransactions?.change),
        trend: asTrend(kpis.totalTransactions?.trend),
      },
      highRiskAlerts: {
        value: asNumber(kpis.highRiskAlerts?.value),
        change: asText(kpis.highRiskAlerts?.change),
        trend: asTrend(kpis.highRiskAlerts?.trend),
      },
      openCases: {
        value: asNumber(kpis.openCases?.value),
        change: asText(kpis.openCases?.change),
        trend: asTrend(kpis.openCases?.trend),
      },
      mlModels: {
        value: asNumber(kpis.mlModels?.value),
        change: asText(kpis.mlModels?.change),
        trend: asTrend(kpis.mlModels?.trend),
      },
    },
    quickStats: {
      totalCustomers: asNumber(quickStats.totalCustomers),
      totalAlerts: asNumber(quickStats.totalAlerts),
      highRiskAlerts: asNumber(quickStats.highRiskAlerts),
    },
    transactionFlowByDay: Array.isArray(source.transactionFlowByDay) ? source.transactionFlowByDay : [],
    alertSeverityMix: Array.isArray(source.alertSeverityMix) ? source.alertSeverityMix : [],
    weeklyTrends: Array.isArray(source.weeklyTrends) ? source.weeklyTrends : [],
    alertsCreatedByDay: Array.isArray(source.alertsCreatedByDay) ? source.alertsCreatedByDay : [],
    highRiskWorkflow: Array.isArray(source.highRiskWorkflow) ? source.highRiskWorkflow : [],
    customerRiskLevels: Array.isArray(source.customerRiskLevels) ? source.customerRiskLevels : [],
  }
}

export const Dashboard: React.FC = () => {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<OverviewResponse | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadDashboard = async () => {
      setLoading(true)
      const cachedValue = sessionStorage.getItem(DASHBOARD_CACHE_KEY)
      let hasCachedData = false
      if (cachedValue) {
        try {
          const parsed = normalizeOverviewResponse(JSON.parse(cachedValue))
          setData(parsed)
          hasCachedData = true
        } catch {
          sessionStorage.removeItem(DASHBOARD_CACHE_KEY)
        }
      }
      setError(null)

      const authHeaders: Record<string, string> = {}
      if (token) authHeaders.Authorization = `Token ${token}`

      try {
        const nextData = normalizeOverviewResponse(await fetchJsonWithRetry<OverviewResponse>(
          `${API_BASE_URL}/analytics/overview/`,
          { headers: authHeaders, signal: controller.signal }
        ))
        setData(nextData)
        sessionStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(nextData))
      } catch (e) {
        if (isAbortError(e)) return
        if (!hasCachedData) {
          setError('Dashboard data is taking too long to load. Showing an empty overview for now.')
          setData(EMPTY_DASHBOARD_DATA)
        }
      } finally {
        setLoading(false)
      }
    }

    void loadDashboard()
    return () => controller.abort()
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
      <div className="chart-title dashboard-skeleton dashboard-title-skeleton" aria-hidden="true" />
      {summary ? (
        <div className="dashboard-summary-skeleton" aria-hidden="true">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`summary-skeleton-${key}-${index}`} className="dashboard-summary-skeleton-row">
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
        {showSkeleton
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

      {showSkeleton ? (
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
                    data={data.alertSeverityMix.length ? data.alertSeverityMix : [{ name: 'No alerts', value: 1, color: '#cbd5e1' }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {(data.alertSeverityMix.length ? data.alertSeverityMix : [{ name: 'No alerts', value: 1, color: '#cbd5e1' }]).map((entry, index) => (
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
              <div className="chart-title">High-Risk Alerts by Workflow Status</div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.highRiskWorkflow} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" fontSize={12} />
                  <YAxis dataKey="status" type="category" stroke="#64748b" fontSize={12} width={90} />
                  <Tooltip contentStyle={{ borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="count" name="High-risk alerts" fill="#7c3aed" radius={[0, 4, 4, 0]}>
                    {data.highRiskWorkflow.map((entry, index) => (
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
