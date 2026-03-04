import React, { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { HiOutlineDownload, HiOutlineRefresh, HiOutlineSearch, HiOutlineX } from 'react-icons/hi'
import './Customers.css'
import './KYC.css'

type ManualScreeningMatch = {
  match_id: string
  status: string
  match_type: string
  match_score: number | null
  watchlist_name: string
  source: string
  details: Record<string, unknown>
}

type ManualScreeningResponse = {
  query: {
    name: string
    entity_type: 'INDIVIDUAL' | 'ORGANIZATION'
    country: string
    email: string
  }
  summary: {
    total_matches: number
    risk_flags: string[]
    overall_status: 'CLEAR' | 'REVIEW' | 'BLOCK'
    screening_date: string
  }
  matches: ManualScreeningMatch[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

function formatDateTime(value: string): string {
  if (!value) return '-'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  return dt.toLocaleString('en-US')
}

export const ScreeningManual: React.FC = () => {
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [name, setName] = useState('')
  const [entityType, setEntityType] = useState<'INDIVIDUAL' | 'ORGANIZATION'>('INDIVIDUAL')
  const [country, setCountry] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<ManualScreeningResponse | null>(null)

  const riskTone = useMemo(() => {
    const status = report?.summary.overall_status
    if (status === 'BLOCK') return 'pill-high'
    if (status === 'REVIEW') return 'pill-high'
    return 'pill-low'
  }, [report])

  const runManualScreening = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Enter a name to screen.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/screening/manual_screen/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          entity_type: entityType,
          country: country.trim(),
          email: email.trim(),
        }),
      })

      if (!res.ok) {
        throw new Error(`Manual screening failed (${res.status})`)
      }

      const payload = (await res.json()) as ManualScreeningResponse
      setReport(payload)
      setShowSearchModal(false)
    } catch (err) {
      setReport(null)
      setError(err instanceof Error ? err.message : 'Unable to run manual screening')
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = () => {
    if (!report) return

    const doc = new jsPDF()
    let y = 14
    const lineHeight = 7

    doc.setFontSize(16)
    doc.text('Manual Screening Report', 14, y)
    y += lineHeight
    doc.setFontSize(11)
    doc.text(`Subject: ${report.query.name}`, 14, y)
    y += lineHeight
    doc.text(`Entity Type: ${report.query.entity_type}`, 14, y)
    y += lineHeight
    doc.text(`Overall Status: ${report.summary.overall_status}`, 14, y)
    y += lineHeight
    doc.text(`Matches Found: ${report.summary.total_matches}`, 14, y)
    y += lineHeight
    doc.text(`Screened At: ${formatDateTime(report.summary.screening_date)}`, 14, y)

    y += lineHeight * 2
    doc.setFontSize(13)
    doc.text('Matches', 14, y)
    doc.setFontSize(11)

    if (report.matches.length === 0) {
      y += lineHeight
      doc.text('No matches found for this subject.', 14, y)
    } else {
      report.matches.slice(0, 18).forEach((match, index) => {
        y += lineHeight
        if (y > 280) {
          doc.addPage()
          y = 20
        }
        const score = match.match_score == null ? '-' : `${(match.match_score * 100).toFixed(1)}%`
        doc.text(
          `${index + 1}. ${match.watchlist_name || '-'} | ${match.match_type} | ${match.status} | ${score}`,
          14,
          y,
        )
      })
    }

    const baseName = report.query.name.trim().replace(/\s+/g, '_').toLowerCase() || 'manual_screening'
    doc.save(`${baseName}_manual_screening_report.pdf`)
  }

  return (
    <div className="reports-container manual-screening-page">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">Manual Screening</h1>
          <p className="customers-subtitle">Enter a subject name and generate an instant screening report.</p>
        </div>
        <div className="customers-header-actions">
          {report && (
            <button
              type="button"
              className="btn-outline-action btn-with-icon"
              onClick={downloadReport}
            >
              <HiOutlineDownload size={16} aria-hidden />
              <span>Download report</span>
            </button>
          )}
          <button
            type="button"
            className="btn-primary-action btn-with-icon"
            onClick={() => setShowSearchModal(true)}
          >
            <HiOutlineSearch size={16} aria-hidden />
            <span>Search</span>
          </button>
        </div>
      </header>

      <div className="customers-container manual-screening-container">
        {error && (
          <div className="customers-filters-card manual-screening-alert-card">
            <div className="bulk-import-card muted">{error}</div>
          </div>
        )}

        <div className="manual-screening-results">
          <div className="customers-filters-card manual-screening-summary-card">
            <div className="bulk-import-card">
              {report ? (
                <div className="view-profile-grid">
                  <div className="view-profile-field">
                    <span className="view-profile-label">Subject</span>
                    <span className="view-profile-value">{report.query.name}</span>
                  </div>
                  <div className="view-profile-field">
                    <span className="view-profile-label">Entity Type</span>
                    <span className="view-profile-value">{report.query.entity_type}</span>
                  </div>
                  <div className="view-profile-field">
                    <span className="view-profile-label">Matches Found</span>
                    <span className="view-profile-value">{report.summary.total_matches}</span>
                  </div>
                  <div className="view-profile-field">
                    <span className="view-profile-label">Overall Status</span>
                    <span className={`pill ${riskTone}`}>{report.summary.overall_status}</span>
                  </div>
                  <div className="view-profile-field view-profile-field-full">
                    <span className="view-profile-label">Risk Flags</span>
                    <span className="view-profile-value view-profile-value-block">
                      {report.summary.risk_flags.length ? report.summary.risk_flags.join(', ') : 'None'}
                    </span>
                  </div>
                  <div className="view-profile-field view-profile-field-full">
                    <span className="view-profile-label">Screened At</span>
                    <span className="view-profile-value view-profile-value-block">{formatDateTime(report.summary.screening_date)}</span>
                  </div>
                </div>
              ) : (
                <div className="manual-screening-empty-state">
                  <span className="view-profile-label">Report Summary</span>
                  <span className="bulk-import-text">No screening has been run yet. Use Search to generate a report.</span>
                </div>
              )}
            </div>
          </div>

          <div className="customers-table-card-outer manual-screening-table-card">
            <div className="report-content-container ecl-table-container">
              <table className="ecl-table">
                <thead>
                  <tr>
                    <th>MATCH ID</th>
                    <th>WATCHLIST NAME</th>
                    <th>MATCH TYPE</th>
                    <th>STATUS</th>
                    <th>MATCH SCORE</th>
                    <th>SOURCE</th>
                  </tr>
                </thead>
                <tbody>
                  {!report ? (
                    <tr>
                      <td colSpan={6} className="muted">No report yet. Run a manual search to see results.</td>
                    </tr>
                  ) : report.matches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="muted">No matches found for this subject.</td>
                    </tr>
                  ) : (
                    report.matches.map((match) => (
                      <tr key={`${match.match_id}-${match.source}`}>
                        <td className="customer-id">{match.match_id}</td>
                        <td>{match.watchlist_name || '-'}</td>
                        <td>{match.match_type}</td>
                        <td>{match.status}</td>
                        <td>{match.match_score == null ? '-' : `${(match.match_score * 100).toFixed(1)}%`}</td>
                        <td className="muted">{match.source}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showSearchModal && (
        <div className="modal-backdrop" onClick={() => setShowSearchModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Manual Screening Search</h2>
              <button className="modal-close-btn" onClick={() => setShowSearchModal(false)} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <form className="modal-form" onSubmit={runManualScreening}>
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label" htmlFor="manualScreeningName">Name</label>
                  <input
                    id="manualScreeningName"
                    type="text"
                    className="modal-input"
                    placeholder="Enter full name or company name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="manualScreeningEntityType">Entity Type</label>
                  <select
                    id="manualScreeningEntityType"
                    className="modal-input"
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value as 'INDIVIDUAL' | 'ORGANIZATION')}
                  >
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="ORGANIZATION">Organization</option>
                  </select>
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="manualScreeningCountry">Country</label>
                  <input
                    id="manualScreeningCountry"
                    type="text"
                    className="modal-input"
                    placeholder="Optional"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="manualScreeningEmail">Email</label>
                  <input
                    id="manualScreeningEmail"
                    type="email"
                    className="modal-input"
                    placeholder="Optional"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowSearchModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action" disabled={loading}>
                  {loading ? 'Running...' : 'Search'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
