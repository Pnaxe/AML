export type ApiRequestOptions = {
  token: string | null
}

type PagedResponse<T> = {
  count?: number
  results?: T[]
} | T[]

function extractResults<T>(payload: PagedResponse<T>): T[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray((payload as any).results)) return (payload as any).results as T[]
  return []
}

function extractCount<T>(payload: PagedResponse<T>): number {
  if (Array.isArray(payload)) return payload.length
  if (typeof (payload as any).count === 'number') return (payload as any).count as number
  return extractResults(payload).length
}

// API base URL for the Django AML backend.
// Configure via Vite env, falling back to a sensible local default.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

// Helper to call the real AML backend and compose dashboard data
export async function apiRequest<T>(path: string, opts: ApiRequestOptions): Promise<T> {
  if (path === '/analytics/overview') {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (opts.token) {
        headers.Authorization = `Token ${opts.token}`
      }

      // Fetch core AML resources in parallel
      const [transactionsRes, alertsRes, customersRes, investigationsRes, mlModelsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/transactions/`, { headers }),
        fetch(`${API_BASE_URL}/alerts/`, { headers }),
        fetch(`${API_BASE_URL}/customers/`, { headers }),
        fetch(`${API_BASE_URL}/investigations/`, { headers }),
        fetch(`${API_BASE_URL}/ml-models/`, { headers }),
      ])

      const [transactionsJson, alertsJson, customersJson, investigationsJson, mlModelsJson] = await Promise.all([
        transactionsRes.json(),
        alertsRes.json(),
        customersRes.json(),
        investigationsRes.json(),
        mlModelsRes.json(),
      ])

      const totalTransactions = extractCount(transactionsJson)
      const alerts = extractResults<any>(alertsJson)
      const totalCustomers = extractCount(customersJson)
      const totalInvestigations = extractCount(investigationsJson)
      const totalMlModels = extractCount(mlModelsJson)

      const highRiskAlerts = alerts.filter(
        (a) => a.severity === 'HIGH' || a.severity === 'CRITICAL'
      ).length

      // Compose data to match the Dashboard.tsx layout.
      // KPI values are real AML counts; charts use simple synthesized series for now.
      const overview = {
        kpis: {
          totalTransactions: {
            value: totalTransactions,
            change: '—',
            trend: 'up' as const,
          },
          highRiskAlerts: {
            value: highRiskAlerts,
            change: '—',
            trend: 'up' as const,
          },
          openCases: {
            value: totalInvestigations,
            change: '—',
            trend: 'up' as const,
          },
          mlModels: {
            value: totalMlModels,
            change: '—',
            trend: 'up' as const,
          },
        },
        quickStats: {
          totalCustomers,
          totalAlerts: alerts.length,
          highRiskAlerts,
        },
        // Simple synthetic series so the layout renders;
        // you can replace these with real time‑series from your AML backend later.
        conversationsByDay: [
          { day: 'Tue', incoming: totalTransactions * 0.1, outgoing: totalTransactions * 0.05 },
          { day: 'Wed', incoming: totalTransactions * 0.15, outgoing: totalTransactions * 0.07 },
          { day: 'Thu', incoming: totalTransactions * 0.2, outgoing: totalTransactions * 0.1 },
          { day: 'Fri', incoming: totalTransactions * 0.25, outgoing: totalTransactions * 0.12 },
          { day: 'Sat', incoming: totalTransactions * 0.18, outgoing: totalTransactions * 0.09 },
          { day: 'Sun', incoming: totalTransactions * 0.12, outgoing: totalTransactions * 0.06 },
          { day: 'Mon', incoming: totalTransactions * 0.2, outgoing: totalTransactions * 0.11 },
        ].map((d) => ({
          ...d,
          incoming: Math.round(d.incoming),
          outgoing: Math.round(d.outgoing),
        })),
        leadSources: [
          { name: 'High‑risk alerts', value: highRiskAlerts, color: '#ef4444' },
          { name: 'Other alerts', value: Math.max(alerts.length - highRiskAlerts, 0), color: '#6366f1' },
        ],
        weeklyTrends: [
          { week: 'Week 1', conversations: Math.round(totalTransactions * 0.2), hotLeads: Math.round(highRiskAlerts * 0.2) },
          { week: 'Week 2', conversations: Math.round(totalTransactions * 0.25), hotLeads: Math.round(highRiskAlerts * 0.25) },
          { week: 'Week 3', conversations: Math.round(totalTransactions * 0.25), hotLeads: Math.round(highRiskAlerts * 0.25) },
          { week: 'Week 4', conversations: Math.round(totalTransactions * 0.3), hotLeads: Math.round(highRiskAlerts * 0.3) },
        ],
        botVsHuman: [
          { day: 'Tue', bot: Math.round(totalTransactions * 0.4), human: Math.round(totalTransactions * 0.6) },
          { day: 'Wed', bot: Math.round(totalTransactions * 0.45), human: Math.round(totalTransactions * 0.55) },
          { day: 'Thu', bot: Math.round(totalTransactions * 0.5), human: Math.round(totalTransactions * 0.5) },
          { day: 'Fri', bot: Math.round(totalTransactions * 0.55), human: Math.round(totalTransactions * 0.45) },
          { day: 'Sat', bot: Math.round(totalTransactions * 0.6), human: Math.round(totalTransactions * 0.4) },
        ],
        leadsByStatus: [
          { day: 'Tue', hot: Math.round(highRiskAlerts * 0.4), warm: Math.round(highRiskAlerts * 0.35), cold: Math.round(highRiskAlerts * 0.25) },
          { day: 'Wed', hot: Math.round(highRiskAlerts * 0.35), warm: Math.round(highRiskAlerts * 0.4), cold: Math.round(highRiskAlerts * 0.25) },
          { day: 'Thu', hot: Math.round(highRiskAlerts * 0.3), warm: Math.round(highRiskAlerts * 0.4), cold: Math.round(highRiskAlerts * 0.3) },
          { day: 'Fri', hot: Math.round(highRiskAlerts * 0.45), warm: Math.round(highRiskAlerts * 0.35), cold: Math.round(highRiskAlerts * 0.2) },
        ],
        responseTimeDist: [
          { name: '0‑5 min', value: 0, fill: '#22c55e' },
          { name: '5‑15 min', value: 0, fill: '#f97316' },
          { name: '15‑60 min', value: 0, fill: '#eab308' },
          { name: '60+ min', value: 0, fill: '#ef4444' },
        ],
      }

      return overview as T
    } catch (e) {
      // If the API is unreachable (e.g. CORS during dev), fall back to zeros
      console.error('Failed to load overview data', e)
      const emptyOverview = {
        kpis: {
          totalTransactions: { value: 0, change: '—', trend: 'up' as const },
          highRiskAlerts: { value: 0, change: '—', trend: 'up' as const },
          openCases: { value: 0, change: '—', trend: 'up' as const },
          mlModels: { value: 0, change: '—', trend: 'up' as const },
        },
        quickStats: {
          totalCustomers: 0,
          totalAlerts: 0,
          highRiskAlerts: 0,
        },
        conversationsByDay: [],
        leadSources: [],
        weeklyTrends: [],
        botVsHuman: [],
        leadsByStatus: [],
        responseTimeDist: [],
      }
      return emptyOverview as T
    }
  }

  // Fallback: raw GET to other paths if needed
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: opts.token ? { Authorization: `Token ${opts.token}` } : undefined,
  })

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

