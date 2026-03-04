import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineSearch, HiOutlineX, HiOutlineEye, HiOutlineArrowLeft, HiOutlineBell } from 'react-icons/hi'
import './Customers.css'
import './KYC.css'

type AlertItem = {
  id: number
  alert_id: string
  alert_type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: string
  customer: number
  customer_id: string
  customer_name: string
  transaction_ids: string[]
  title: string
  description: string
  risk_score: number
  investigation_notes: string
  resolution_notes: string
  triggered_at: string
}

type TransactionAlertSource = {
  id: number
  transaction_id: string
  transaction_type: string
  amount: string
  currency: string
  sender?: number
  sender_id?: number
  sender_name?: string
  receiver_name?: string
  status: string
  risk_score: number
  is_suspicious: boolean
  transaction_date: string
}

type TransactionResponse = { results?: TransactionAlertSource[] } | TransactionAlertSource[]

type CustomerDetail = {
  id: number
  customer_id: string
  customer_type: string
  first_name: string
  last_name: string
  company_name: string
  email: string
  phone_number: string
  address: string
  city: string
  country: string
  risk_level: string
  is_pep: boolean
  is_sanctioned: boolean
  kyc_verified: boolean
}

const PAGE_SIZE = 25
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

function rowsOf<T>(payload: { results?: T[] } | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function fmtDate(v: string): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-US')
}

function flaggedTransactionsToAlerts(
  transactions: TransactionAlertSource[],
  existingAlerts: AlertItem[],
): AlertItem[] {
  const coveredTransactionIds = new Set(existingAlerts.flatMap((alert) => alert.transaction_ids ?? []))

  return transactions
    .filter((tx) => tx.is_suspicious || tx.status === 'BLOCKED' || tx.status === 'UNDER_REVIEW')
    .filter((tx) => !coveredTransactionIds.has(tx.transaction_id))
    .map((tx, index) => {
      const severity: AlertItem['severity'] =
        tx.status === 'BLOCKED' ? 'CRITICAL' : tx.risk_score >= 0.8 ? 'HIGH' : 'MEDIUM'

      return {
        id: -(index + 1),
        alert_id: `TX-${tx.transaction_id}`,
        alert_type: `${tx.transaction_type}_MONITORING`,
        severity,
        status: tx.status === 'UNDER_REVIEW' ? 'IN_PROGRESS' : tx.status === 'BLOCKED' ? 'ESCALATED' : 'NEW',
        customer: tx.sender_id ?? tx.sender ?? 0,
        customer_id: tx.sender_name || 'Transaction Review',
        customer_name: tx.sender_name || 'Unknown Sender',
        transaction_ids: [tx.transaction_id],
        title: `Flagged transaction ${tx.transaction_id}`,
        description: `${tx.transaction_type} ${tx.currency} ${Number(tx.amount).toLocaleString()} requires analyst review.`,
        risk_score: tx.risk_score,
        investigation_notes: '',
        resolution_notes: '',
        triggered_at: tx.transaction_date,
      }
    })
}

export const Alerts: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadAlerts = async () => {
    setLoading(true)
    setError(null)
    try {
      const [alertRes, transactionRes] = await Promise.all([
        fetch(`${API_BASE_URL}/alerts/flagged/`),
        fetch(`${API_BASE_URL}/transactions/`),
      ])
      if (!alertRes.ok || !transactionRes.ok) throw new Error('Failed to load alerts')

      const alertPayload = await alertRes.json()
      const transactionPayload = (await transactionRes.json()) as TransactionResponse
      const alertRows = rowsOf<AlertItem>(alertPayload)
      const syntheticAlerts = flaggedTransactionsToAlerts(rowsOf<TransactionAlertSource>(transactionPayload), alertRows)
      setAlerts([...syntheticAlerts, ...alertRows])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load alerts')
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAlerts()
  }, [])

  const filtered = useMemo(() => {
    const term = activeSearchTerm.toLowerCase()
    return alerts.filter((a) => {
      if (term) {
        const v = [a.alert_id, a.customer_name, a.customer_id, a.title, a.description].join(' ').toLowerCase()
        if (!v.includes(term)) return false
      }
      if (severityFilter && a.severity !== severityFilter) return false
      if (statusFilter && a.status !== statusFilter) return false
      return true
    })
  }, [alerts, activeSearchTerm, severityFilter, statusFilter])

  const totalRecords = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(startIndex, startIndex + PAGE_SIZE)
  const displayStart = totalRecords === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageRows.length

  const openReview = async (alert: AlertItem) => {
    setSelectedAlert(alert)
    setReviewNote(alert.investigation_notes || '')
    setCustomerDetail(null)
    if (!alert.customer) {
      return
    }
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${alert.customer}/`)
      if (res.ok) {
        const cust = (await res.json()) as CustomerDetail
        setCustomerDetail(cust)
      }
    } catch {
      // best-effort customer fetch
    }
  }

  const handleIgnore = async () => {
    if (!selectedAlert) return
    if (selectedAlert.id < 0) {
      setSelectedAlert(null)
      setCustomerDetail(null)
      setReviewNote('')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${selectedAlert.id}/ignore/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: reviewNote }),
      })
      if (!res.ok) throw new Error(`Failed to ignore alert (${res.status})`)
      await loadAlerts()
      setSelectedAlert(null)
      setCustomerDetail(null)
      setReviewNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to ignore alert')
    } finally {
      setActionLoading(false)
    }
  }

  const handleContinueReview = async () => {
    if (!selectedAlert) return
    if (selectedAlert.id < 0) {
      setSelectedAlert(null)
      setCustomerDetail(null)
      setReviewNote('')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${selectedAlert.id}/continue_review/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: reviewNote }),
      })
      if (!res.ok) throw new Error(`Failed to continue review (${res.status})`)
      await loadAlerts()
      setSelectedAlert(null)
      setCustomerDetail(null)
      setReviewNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to continue review')
    } finally {
      setActionLoading(false)
    }
  }

  if (selectedAlert) {
    const c = customerDetail
    const V = (v?: string | null) => (v && String(v).trim() !== '' ? v : '-')
    return (
      <div className="reports-container">
      <div className="view-profile-page screening-report">
        <header className="customers-header">
          <div>
            <h1 className="customers-title">Screened Profile Report</h1>
            <p className="customers-subtitle">
              {selectedAlert.customer_name} ({selectedAlert.customer_id}) ·{' '}
              <span className={`pill pill-${selectedAlert.severity.toLowerCase()}`}>{selectedAlert.severity}</span>{' '}
              <span className="pill pill-kyc-pending">{selectedAlert.status}</span>
            </p>
          </div>
          <div className="customers-header-actions">
            <button type="button" className="btn-secondary-action btn-with-icon" onClick={() => setSelectedAlert(null)} disabled={actionLoading}>
              <HiOutlineArrowLeft size={16} aria-hidden />
              <span>Back to screening queue</span>
            </button>
          </div>
        </header>

        <div className="view-profile-card-outer">
          <div className="view-profile-card-inner">
            <div className="view-profile-body">
              <section className="view-profile-section">
                <h2 className="view-profile-section-title">1. Customer Overview</h2>
                <div className="view-profile-grid">
                  <div className="view-profile-field"><span className="view-profile-label">Name</span><span className="view-profile-value">{V(selectedAlert.customer_name)}</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">Customer ID</span><span className="view-profile-value">{V(selectedAlert.customer_id)}</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">Email</span><span className="view-profile-value">{V(c?.email)}</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">Customer type</span><span className="view-profile-value">{V(c?.customer_type)}</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">Risk level</span><span className="view-profile-value">{V(c?.risk_level)}</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">Risk score</span><span className="view-profile-value">{(selectedAlert.risk_score * 100).toFixed(1)}%</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">PEP flag</span><span className="view-profile-value">{c?.is_pep ? 'Yes' : 'No'}</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">Sanctions flag</span><span className="view-profile-value">{c?.is_sanctioned ? 'Yes' : 'No'}</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">KYC verified</span><span className="view-profile-value">{c?.kyc_verified ? 'Yes' : 'No'}</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">Last updated</span><span className="view-profile-value">{fmtDate(selectedAlert.triggered_at)}</span></div>
                </div>
              </section>

              <section className="view-profile-section">
                <h2 className="view-profile-section-title">2. Screening Summary</h2>
                <div className="view-profile-grid">
                  <div className="view-profile-field"><span className="view-profile-label">Alert ID</span><span className="view-profile-value">{V(selectedAlert.alert_id)}</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">Alert type</span><span className="view-profile-value">{V(selectedAlert.alert_type)}</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">Status</span><span className="view-profile-value">{V(selectedAlert.status)}</span></div>
                  <div className="view-profile-field"><span className="view-profile-label">Triggered</span><span className="view-profile-value">{fmtDate(selectedAlert.triggered_at)}</span></div>
                  <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Title</span><span className="view-profile-value view-profile-value-block">{V(selectedAlert.title)}</span></div>
                  <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Description</span><span className="view-profile-value view-profile-value-block">{V(selectedAlert.description)}</span></div>
                  <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Flagged transactions</span><span className="view-profile-value view-profile-value-block">{selectedAlert.transaction_ids?.length ? selectedAlert.transaction_ids.join(', ') : '-'}</span></div>
                  <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Account details</span><span className="view-profile-value view-profile-value-block">{c ? [c.address, c.city, c.country, c.phone_number].filter(Boolean).join(' • ') : '-'}</span></div>
                </div>
              </section>

              <section className="view-profile-section view-profile-documents">
                <h2 className="view-profile-section-title">3. Detection Details</h2>
                <div className="modal-field">
                  <textarea
                    className="modal-input modal-textarea"
                    rows={4}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Add your review notes before deciding..."
                  />
                </div>
              </section>
            </div>
            <div className="screening-report-footer">
              <div className="table-footer-left">Review alert and decide whether to ignore or continue reviewing.</div>
              <div className="table-footer-right">
                <div className="pagination-controls">
                  <button type="button" className="btn-secondary-action" onClick={handleIgnore} disabled={actionLoading}>
                    {actionLoading ? 'Processing...' : 'Ignore Alert'}
                  </button>
                  <button type="button" className="btn-primary-action" onClick={handleContinueReview} disabled={actionLoading}>
                    {actionLoading ? 'Processing...' : 'Continue Reviewing'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    )
  }

  return (
    <div className="reports-container">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">Alerts</h1>
          <p className="customers-subtitle">Flagged alert notifications with manual analyst review workflow.</p>
        </div>
      </header>

      <div className="customers-container">
        <div className="customers-filters-card report-filters">
          <div className="report-filters-left">
            <form onSubmit={(e) => { e.preventDefault(); setActiveSearchTerm(searchTerm.trim()); setCurrentPage(1) }} className="filter-group filter-group-search">
              <div className="search-input-wrapper">
                <span className="search-icon" aria-hidden><HiOutlineSearch size={18} /></span>
                <input
                  type="text"
                  className="filter-input search-input"
                  placeholder="Search by alert ID, customer, title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && <button type="button" className="search-clear-btn" onClick={() => { setSearchTerm(''); setActiveSearchTerm('') }}><HiOutlineX size={18} /></button>}
              </div>
            </form>

            <div className="filter-group">
              <span className="filter-label">Severity:</span>
              <select className="filter-input" value={severityFilter} onChange={(e) => { setSeverityFilter(e.target.value); setCurrentPage(1) }}>
                <option value="">All</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">Status:</span>
              <select className="filter-input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}>
                <option value="">All</option>
                <option value="NEW">NEW</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="ESCALATED">ESCALATED</option>
              </select>
            </div>
          </div>
        </div>

        <div className={`customers-table-card-outer ${!error && pageRows.length === 0 ? 'table-empty-state' : ''}`}>
          {!error && pageRows.length === 0 && (
            <div className="table-empty-watermark" aria-hidden="true">
              <HiOutlineBell size={42} />
              <span>No Alerts</span>
            </div>
          )}
          <div className="report-content-container ecl-table-container">
            <table className="ecl-table">
              <thead>
                <tr>
                  <th>ALERT ID</th>
                  <th>CUSTOMER</th>
                  <th>TYPE</th>
                  <th>SEVERITY</th>
                  <th>STATUS</th>
                  <th>RISK SCORE</th>
                  <th>TRIGGERED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {error ? (
                  <tr><td colSpan={8} className="muted">{error}</td></tr>
                ) : (
                  pageRows.map((a) => (
                    <tr key={a.id}>
                      <td className="customer-id">{a.alert_id}</td>
                      <td>{a.customer_name} <span className="muted">({a.customer_id})</span></td>
                      <td>{a.alert_type}</td>
                      <td><span className={`pill pill-${a.severity.toLowerCase()}`}>{a.severity}</span></td>
                      <td><span className="pill pill-kyc-pending">{a.status}</span></td>
                      <td className="muted">{(a.risk_score * 100).toFixed(1)}%</td>
                      <td className="muted">{fmtDate(a.triggered_at)}</td>
                      <td>
                        <div className="customers-actions">
                          <HiOutlineEye size={18} className="action-icon action-icon-view" onClick={() => void openReview(a)} title="Review alert" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {!error && Array.from({ length: Math.max(0, PAGE_SIZE - pageRows.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>{Array.from({ length: 8 }).map((__, c) => <td key={c}>&nbsp;</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ecl-table-footer">
            <div className="table-footer-left">Showing {displayStart} to {displayEnd} of {totalRecords} results.</div>
            <div className="table-footer-right">
              {totalPages > 1 ? (
                <div className="pagination-controls">
                  <button type="button" className="pagination-btn" disabled={safePage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button>
                  <span className="pagination-info">Page {safePage} of {totalPages}</span>
                  <button type="button" className="pagination-btn" disabled={safePage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next</button>
                </div>
              ) : (
                <span>{loading ? 'Loading...' : 'All data displayed'}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
