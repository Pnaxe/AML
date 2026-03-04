import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineSearch, HiOutlineX, HiOutlineEye, HiOutlineArrowLeft } from 'react-icons/hi'
import './Customers.css'
import './KYC.css'

type CaseItem = {
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
  triggered_at: string
  sar_reference?: string
  sar_filing_date?: string
}

type CustomerDetail = {
  customer_type: string
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

function fmtDate(v?: string): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-US')
}

export const Cases: React.FC = () => {
  const [cases, setCases] = useState<CaseItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null)
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null)
  const [sarReference, setSarReference] = useState('')
  const [filingNotes, setFilingNotes] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadCases = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/cases_for_sar/`)
      if (!res.ok) throw new Error(`Failed to load cases (${res.status})`)
      const payload = await res.json()
      setCases(rowsOf<CaseItem>(payload))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load cases')
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCases()
  }, [])

  const filtered = useMemo(() => {
    const term = activeSearchTerm.toLowerCase()
    return cases.filter((c) => {
      if (term) {
        const v = [c.alert_id, c.customer_name, c.customer_id, c.title, c.description].join(' ').toLowerCase()
        if (!v.includes(term)) return false
      }
      if (severityFilter && c.severity !== severityFilter) return false
      return true
    })
  }, [cases, activeSearchTerm, severityFilter])

  const totalRecords = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(startIndex, startIndex + PAGE_SIZE)
  const displayStart = totalRecords === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageRows.length

  const openCase = async (item: CaseItem) => {
    setSelectedCase(item)
    setSarReference(`SAR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(item.id).padStart(6, '0')}`)
    setFilingNotes(item.investigation_notes || '')
    setCustomerDetail(null)
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${item.customer}/`)
      if (res.ok) setCustomerDetail(await res.json())
    } catch {
      // best effort
    }
  }

  const handleFileSar = async () => {
    if (!selectedCase) return
    setActionLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${selectedCase.id}/file_sar/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sar_reference: sarReference.trim(),
          resolution_notes: filingNotes,
        }),
      })
      if (!res.ok) throw new Error(`Failed to file SAR (${res.status})`)
      await loadCases()
      setSelectedCase(null)
      setCustomerDetail(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to file SAR')
    } finally {
      setActionLoading(false)
    }
  }

  if (selectedCase) {
    const d = customerDetail
    const V = (v?: string | null) => (v && String(v).trim() !== '' ? v : '-')
    return (
      <div className="reports-container">
        <div className="view-profile-page screening-report">
          <header className="customers-header">
            <div>
              <h1 className="customers-title">Screened Profile Report</h1>
              <p className="customers-subtitle">
                {selectedCase.customer_name} ({selectedCase.customer_id}) ·{' '}
                <span className={`pill pill-${selectedCase.severity.toLowerCase()}`}>{selectedCase.severity}</span>{' '}
                <span className="pill pill-kyc-pending">{selectedCase.status}</span>
              </p>
            </div>
            <div className="customers-header-actions">
              <button type="button" className="btn-secondary-action btn-with-icon" onClick={() => setSelectedCase(null)} disabled={actionLoading}>
                <HiOutlineArrowLeft size={16} aria-hidden />
                <span>Back to cases</span>
              </button>
            </div>
          </header>

          <div className="view-profile-card-outer">
            <div className="view-profile-card-inner">
              <div className="view-profile-body">
                <section className="view-profile-section">
                  <h2 className="view-profile-section-title">1. Customer Overview</h2>
                  <div className="view-profile-grid">
                    <div className="view-profile-field"><span className="view-profile-label">Name</span><span className="view-profile-value">{V(selectedCase.customer_name)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Customer ID</span><span className="view-profile-value">{V(selectedCase.customer_id)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Email</span><span className="view-profile-value">{V(d?.email)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Customer type</span><span className="view-profile-value">{V(d?.customer_type)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Risk level</span><span className="view-profile-value">{V(d?.risk_level)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Risk score</span><span className="view-profile-value">{(selectedCase.risk_score * 100).toFixed(1)}%</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">PEP flag</span><span className="view-profile-value">{d?.is_pep ? 'Yes' : 'No'}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Sanctions flag</span><span className="view-profile-value">{d?.is_sanctioned ? 'Yes' : 'No'}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">KYC verified</span><span className="view-profile-value">{d?.kyc_verified ? 'Yes' : 'No'}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Last updated</span><span className="view-profile-value">{fmtDate(selectedCase.triggered_at)}</span></div>
                  </div>
                </section>

                <section className="view-profile-section">
                  <h2 className="view-profile-section-title">2. Escalated Alert Summary</h2>
                  <div className="view-profile-grid">
                    <div className="view-profile-field"><span className="view-profile-label">Case ID</span><span className="view-profile-value">{V(selectedCase.alert_id)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Alert type</span><span className="view-profile-value">{V(selectedCase.alert_type)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Status</span><span className="view-profile-value">{V(selectedCase.status)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Triggered</span><span className="view-profile-value">{fmtDate(selectedCase.triggered_at)}</span></div>
                    <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Title</span><span className="view-profile-value view-profile-value-block">{V(selectedCase.title)}</span></div>
                    <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Description</span><span className="view-profile-value view-profile-value-block">{V(selectedCase.description)}</span></div>
                    <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Suspicious transactions</span><span className="view-profile-value view-profile-value-block">{selectedCase.transaction_ids?.length ? selectedCase.transaction_ids.join(', ') : '-'}</span></div>
                  </div>
                </section>

                <section className="view-profile-section view-profile-documents">
                  <h2 className="view-profile-section-title">3. SAR Filing Details</h2>
                  <div className="view-profile-grid">
                    <div className="view-profile-field">
                      <span className="view-profile-label">SAR Reference</span>
                      <input className="modal-input" value={sarReference} onChange={(e) => setSarReference(e.target.value)} />
                    </div>
                    <div className="view-profile-field view-profile-field-full">
                      <span className="view-profile-label">Detailed report for SAR</span>
                      <textarea className="modal-input modal-textarea" rows={5} value={filingNotes} onChange={(e) => setFilingNotes(e.target.value)} placeholder="Add detailed case report for SAR filing..." />
                    </div>
                  </div>
                </section>
              </div>

              <div className="screening-report-footer">
                <div className="table-footer-left">This escalated case will be filed to SAR with the detailed report above.</div>
                <div className="table-footer-right">
                  <div className="pagination-controls">
                    <button type="button" className="btn-primary-action" onClick={handleFileSar} disabled={actionLoading}>
                      {actionLoading ? 'Filing...' : 'File to SAR'}
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
          <h1 className="customers-title">Cases</h1>
          <p className="customers-subtitle">Escalated alerts after review, ready for SAR filing with detailed reporting.</p>
        </div>
      </header>

      <div className="customers-container">
        <div className="customers-filters-card report-filters">
          <div className="report-filters-left">
            <form onSubmit={(e) => { e.preventDefault(); setActiveSearchTerm(searchTerm.trim()); setCurrentPage(1) }} className="filter-group filter-group-search">
              <div className="search-input-wrapper">
                <span className="search-icon" aria-hidden><HiOutlineSearch size={18} /></span>
                <input type="text" className="filter-input search-input" placeholder="Search by case ID, customer, title..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
          </div>
        </div>

        <div className="customers-table-card-outer">
          <div className="report-content-container ecl-table-container">
            <table className="ecl-table">
              <thead>
                <tr>
                  <th>CASE ID</th>
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
                  pageRows.map((c) => (
                    <tr key={c.id}>
                      <td className="customer-id">{c.alert_id}</td>
                      <td>{c.customer_name} <span className="muted">({c.customer_id})</span></td>
                      <td>{c.alert_type}</td>
                      <td><span className={`pill pill-${c.severity.toLowerCase()}`}>{c.severity}</span></td>
                      <td><span className="pill pill-kyc-pending">{c.status}</span></td>
                      <td className="muted">{(c.risk_score * 100).toFixed(1)}%</td>
                      <td className="muted">{fmtDate(c.triggered_at)}</td>
                      <td>
                        <div className="customers-actions">
                          <HiOutlineEye size={18} className="action-icon action-icon-view" onClick={() => void openCase(c)} title="Open case report" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {!error && Array.from({ length: Math.max(0, PAGE_SIZE - pageRows.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>{Array.from({ length: 8 }).map((__, i) => <td key={i}>&nbsp;</td>)}</tr>
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
