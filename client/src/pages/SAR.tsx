import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineSearch, HiOutlineX, HiOutlineEye, HiOutlineDownload, HiOutlineArrowLeft } from 'react-icons/hi'
import './Customers.css'
import './KYC.css'

type SarRow = {
  id: number
  alert_id: string
  sar_reference: string
  customer_id: string
  customer_name: string
  alert_type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  risk_score: number
  title: string
  description: string
  report_text: string
  submitted_at: string
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

export const SAR: React.FC = () => {
  const [rows, setRows] = useState<SarRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selected, setSelected] = useState<SarRow | null>(null)

  const loadReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/sar_reports/`)
      if (!res.ok) throw new Error(`Failed to load SAR reports (${res.status})`)
      const payload = await res.json()
      setRows(rowsOf<SarRow>(payload))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load SAR reports')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReports()
  }, [])

  const filtered = useMemo(() => {
    const term = activeSearchTerm.toLowerCase()
    return rows.filter((r) => {
      if (term) {
        const hay = [r.alert_id, r.sar_reference, r.customer_name, r.customer_id, r.title].join(' ').toLowerCase()
        if (!hay.includes(term)) return false
      }
      if (severityFilter && r.severity !== severityFilter) return false
      return true
    })
  }, [rows, activeSearchTerm, severityFilter])

  const totalRecords = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(startIndex, startIndex + PAGE_SIZE)
  const displayStart = totalRecords === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageRows.length

  const downloadPdf = async (id: number, fallbackName: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${id}/sar_report_pdf/`)
      if (!res.ok) throw new Error(`Failed to download PDF (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fallbackName || 'sar_report'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to download PDF')
    }
  }

  if (selected) {
    const V = (v?: string | null) => (v && String(v).trim() !== '' ? v : '-')
    return (
      <div className="reports-container">
        <div className="view-profile-page screening-report">
          <header className="customers-header">
            <div>
              <h1 className="customers-title">Screened Profile Report</h1>
              <p className="customers-subtitle">
                {selected.customer_name} ({selected.customer_id}) ·{' '}
                <span className={`pill pill-${selected.severity.toLowerCase()}`}>{selected.severity}</span>{' '}
                <span className="pill pill-kyc-verified">SAR SUBMITTED</span>
              </p>
            </div>
            <div className="customers-header-actions">
              <button type="button" className="btn-secondary-action btn-with-icon" onClick={() => setSelected(null)}>
                <HiOutlineArrowLeft size={16} aria-hidden />
                <span>Back to SAR list</span>
              </button>
              <button type="button" className="btn-primary-action btn-with-icon" onClick={() => void downloadPdf(selected.id, selected.sar_reference || selected.alert_id)}>
                <HiOutlineDownload size={16} aria-hidden />
                <span>Download PDF</span>
              </button>
            </div>
          </header>

          <div className="view-profile-card-outer">
            <div className="view-profile-card-inner">
              <div className="view-profile-body">
                <section className="view-profile-section">
                  <h2 className="view-profile-section-title">1. SAR Submission Overview</h2>
                  <div className="view-profile-grid">
                    <div className="view-profile-field"><span className="view-profile-label">SAR Reference</span><span className="view-profile-value">{V(selected.sar_reference)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Alert ID</span><span className="view-profile-value">{V(selected.alert_id)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Customer</span><span className="view-profile-value">{V(selected.customer_name)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Customer ID</span><span className="view-profile-value">{V(selected.customer_id)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Alert Type</span><span className="view-profile-value">{V(selected.alert_type)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Submitted At</span><span className="view-profile-value">{fmtDate(selected.submitted_at)}</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Risk score</span><span className="view-profile-value">{(selected.risk_score * 100).toFixed(1)}%</span></div>
                    <div className="view-profile-field"><span className="view-profile-label">Severity</span><span className="view-profile-value">{selected.severity}</span></div>
                  </div>
                </section>
                <section className="view-profile-section">
                  <h2 className="view-profile-section-title">2. Report Content</h2>
                  <div className="view-profile-grid">
                    <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Title</span><span className="view-profile-value view-profile-value-block">{V(selected.title)}</span></div>
                    <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Description</span><span className="view-profile-value view-profile-value-block">{V(selected.description)}</span></div>
                    <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Detailed report submitted to regulator</span><span className="view-profile-value view-profile-value-block">{V(selected.report_text)}</span></div>
                  </div>
                </section>
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
          <h1 className="customers-title">SAR</h1>
          <p className="customers-subtitle">Reports submitted to the regulator, with downloadable PDF copies.</p>
        </div>
      </header>

      <div className="customers-container">
        <div className="customers-filters-card report-filters">
          <div className="report-filters-left">
            <form onSubmit={(e) => { e.preventDefault(); setActiveSearchTerm(searchTerm.trim()); setCurrentPage(1) }} className="filter-group filter-group-search">
              <div className="search-input-wrapper">
                <span className="search-icon" aria-hidden><HiOutlineSearch size={18} /></span>
                <input type="text" className="filter-input search-input" placeholder="Search by SAR ref, alert ID, customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
                  <th>SAR REFERENCE</th>
                  <th>ALERT ID</th>
                  <th>CUSTOMER</th>
                  <th>TYPE</th>
                  <th>SEVERITY</th>
                  <th>SUBMITTED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {error ? (
                  <tr><td colSpan={7} className="muted">{error}</td></tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r.id}>
                      <td className="customer-id">{r.sar_reference || '-'}</td>
                      <td>{r.alert_id}</td>
                      <td>{r.customer_name} <span className="muted">({r.customer_id})</span></td>
                      <td>{r.alert_type}</td>
                      <td><span className={`pill pill-${r.severity.toLowerCase()}`}>{r.severity}</span></td>
                      <td className="muted">{fmtDate(r.submitted_at)}</td>
                      <td>
                        <div className="customers-actions">
                          <HiOutlineEye size={18} className="action-icon action-icon-view" onClick={() => setSelected(r)} title="View SAR report" />
                          <HiOutlineDownload size={18} className="action-icon action-icon-edit" onClick={() => void downloadPdf(r.id, r.sar_reference || r.alert_id)} title="Download PDF" />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {!error && Array.from({ length: Math.max(0, PAGE_SIZE - pageRows.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>{Array.from({ length: 7 }).map((__, i) => <td key={i}>&nbsp;</td>)}</tr>
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
