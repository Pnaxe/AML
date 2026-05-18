import React, { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { HiOutlineDownload, HiOutlineRefresh, HiOutlineSearch, HiOutlineX } from 'react-icons/hi'
import logoSrc from '../images/AS logo.png'
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

type ApiSourceCheck = {
  id: string
  name: string
  type: 'BUILT_IN' | 'CUSTOM' | 'EXTERNAL'
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'SEARCHED' | 'ERROR'
  used_for: string
  last_four: string
  error?: string
  total_hits?: number
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
    apis_checked?: number
    total_api_sources?: number
  }
  api_sources?: ApiSourceCheck[]
  matches: ManualScreeningMatch[]
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

const DETAIL_LABELS: Record<string, string> = {
  id: 'Dilisense Record ID',
  source_id: 'Source ID',
  source_type: 'Source Type',
  name: 'Name',
  entity_type: 'Entity Type',
  pep_type: 'PEP Type',
  date_of_birth: 'Date of Birth',
  place_of_birth: 'Place of Birth',
  citizenship: 'Citizenship',
  nationality: 'Nationality',
  address: 'Address',
  sanction_details: 'Sanction Details',
  positions: 'Positions',
  description: 'Description',
  links: 'Links',
  gender: 'Gender',
  listed_on: 'Listed On',
  last_updated: 'Last Updated',
}

function formatDateTime(value: string): string {
  if (!value) return '-'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  return dt.toLocaleString('en-US')
}

function labelForDetail(key: string): string {
  return DETAIL_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function detailEntries(details: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(details)
    .map(([key, value]) => {
      if (value == null) return [key, ''] as [string, string]
      if (Array.isArray(value)) return [key, value.join(', ')] as [string, string]
      if (typeof value === 'object') return [key, JSON.stringify(value)] as [string, string]
      return [key, String(value)] as [string, string]
    })
    .filter(([, value]) => value.trim().length > 0)
}

function loadImageDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Unable to render logo'))
        return
      }
      ctx.drawImage(image, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = reject
    image.src = src
  })
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

  const downloadReport = async () => {
    if (!report) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 14
    const lineHeight = 7
    let y = 18

    const addFooter = () => {
      const pageCount = doc.getNumberOfPages()
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page)
        doc.setDrawColor(226, 232, 240)
        doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14)
        doc.setFontSize(8)
        doc.setTextColor(100, 116, 139)
        doc.text('AfriSentry AML Screening Report', margin, pageHeight - 8)
        doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
      }
    }

    const ensureSpace = (needed = lineHeight) => {
      if (y + needed > pageHeight - 18) {
        doc.addPage()
        y = 18
      }
    }

    const sectionTitle = (title: string) => {
      ensureSpace(14)
      y += 6
      doc.setFillColor(248, 250, 252)
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(margin, y - 5, pageWidth - margin * 2, 10, 2, 2, 'FD')
      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text(title, margin + 4, y + 2)
      y += 12
    }

    try {
      const logoData = await loadImageDataUrl(logoSrc)
      doc.addImage(logoData, 'PNG', margin, 12, 36, 14)
    } catch {
      doc.setFontSize(14)
      doc.setTextColor(15, 23, 42)
      doc.text('AfriSentry', margin, 20)
    }

    doc.setFillColor(15, 23, 42)
    doc.roundedRect(pageWidth - 58, 12, 44, 12, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(report.summary.overall_status, pageWidth - 36, 20, { align: 'center' })

    y = 34
    doc.setFontSize(18)
    doc.setTextColor(15, 23, 42)
    doc.text('Manual Screening Report', margin, y)
    y += 8
    doc.setFontSize(11)
    doc.setTextColor(71, 85, 105)
    doc.text(`Subject: ${report.query.name}`, margin, y)
    y += lineHeight
    doc.text(`Entity Type: ${report.query.entity_type}`, margin, y)
    y += lineHeight
    doc.text(`Generated: ${formatDateTime(report.summary.screening_date)}`, margin, y)
    y += lineHeight
    doc.text(`Matches Found: ${report.summary.total_matches} | APIs Checked: ${report.summary.apis_checked ?? 0} of ${report.summary.total_api_sources ?? report.api_sources?.length ?? 0}`, margin, y)
    y += lineHeight

    sectionTitle('API Coverage')
    doc.setFontSize(11)
    doc.setTextColor(51, 65, 85)
    ;(report.api_sources ?? []).forEach((source) => {
      ensureSpace(lineHeight)
      doc.text(`${source.name} | ${source.status}${source.last_four ? ` | ending ${source.last_four}` : ''}`, margin + 2, y)
      y += lineHeight
    })

    sectionTitle('Matches And Provider Details')
    doc.setFontSize(11)

    if (report.matches.length === 0) {
      doc.text('No matches found for this subject.', margin + 2, y)
    } else {
      report.matches.forEach((match, index) => {
        ensureSpace(16)
        const score = match.match_score == null ? '-' : `${(match.match_score * 100).toFixed(1)}%`
        doc.setFontSize(11)
        doc.setTextColor(15, 23, 42)
        doc.text(
          `${index + 1}. ${match.watchlist_name || '-'} | ${match.match_type} | ${match.status} | ${score}`,
          margin + 2,
          y,
        )
        y += lineHeight
        doc.setFontSize(9)
        doc.setTextColor(71, 85, 105)
        detailEntries(match.details).forEach(([key, value]) => {
          const wrapped = doc.splitTextToSize(`${labelForDetail(key)}: ${value}`, 178)
          wrapped.forEach((line: string) => {
            ensureSpace(lineHeight)
            doc.text(line, margin + 6, y)
            y += lineHeight
          })
        })
        y += 3
      })
    }

    addFooter()

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
          <div className="customers-filters-card manual-screening-summary-card manual-screening-report-hero">
            <div className="bulk-import-card manual-screening-report-hero-inner">
              {report ? (
                <>
                  <div className="manual-screening-report-brand">
                    <img src={logoSrc} alt="AfriSentry Logo" className="manual-screening-report-logo" />
                    <span className={`pill ${riskTone}`}>{report.summary.overall_status}</span>
                  </div>
                  <div className="manual-screening-report-title-block">
                    <span className="view-profile-label">Screening Report</span>
                    <h2 className="manual-screening-report-title">{report.query.name}</h2>
                    <p className="manual-screening-report-subtitle">
                      Generated {formatDateTime(report.summary.screening_date)} for {report.query.entity_type.toLowerCase()} screening.
                    </p>
                  </div>
                  <div className="manual-screening-report-metrics">
                    <div className="manual-screening-report-metric">
                      <span>{report.summary.total_matches}</span>
                      <small>Matches</small>
                    </div>
                    <div className="manual-screening-report-metric">
                      <span>{report.summary.apis_checked ?? 0}/{report.summary.total_api_sources ?? report.api_sources?.length ?? 0}</span>
                      <small>APIs Checked</small>
                    </div>
                    <div className="manual-screening-report-metric">
                      <span>{report.summary.risk_flags.length}</span>
                      <small>Risk Flags</small>
                    </div>
                  </div>
                  <div className="view-profile-field view-profile-field-full manual-screening-report-flags">
                    <span className="view-profile-label">Risk Flags</span>
                    <span className="view-profile-value view-profile-value-block">
                      {report.summary.risk_flags.length ? report.summary.risk_flags.join(', ') : 'None'}
                    </span>
                  </div>
                </>
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
                    <th>API SOURCE</th>
                    <th>TYPE</th>
                    <th>STATUS</th>
                    <th>KEY</th>
                    <th>USED FOR</th>
                  </tr>
                </thead>
                <tbody>
                  {!report ? (
                    <tr>
                      <td colSpan={5} className="muted">No API coverage yet. Run a manual search to see connected sources.</td>
                    </tr>
                  ) : (report.api_sources ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">No screening API keys are configured.</td>
                    </tr>
                  ) : (
                    (report.api_sources ?? []).map((source) => (
                      <tr key={source.id}>
                        <td className="customer-id">{source.name}</td>
                        <td>{source.type === 'EXTERNAL' ? 'External' : source.type === 'CUSTOM' ? 'Custom' : 'Built-in'}</td>
                        <td>
                          <span className={`pill ${source.status === 'ERROR' ? 'pill-high' : source.status === 'NOT_CONFIGURED' ? 'pill-kyc-pending' : 'pill-low'}`}>
                            {source.status === 'SEARCHED'
                              ? 'Searched'
                              : source.status === 'CONNECTED'
                                ? 'Connected'
                                : source.status === 'ERROR'
                                  ? 'Error'
                                  : 'Not configured'}
                          </span>
                        </td>
                        <td className="muted">{source.last_four ? `Ending ${source.last_four}` : '-'}</td>
                        <td className="muted">{source.error || (typeof source.total_hits === 'number' ? `${source.used_for} (${source.total_hits} hits)` : source.used_for)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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

          {report && report.matches.length > 0 && (
            <div className="customers-filters-card manual-screening-summary-card">
              <div className="bulk-import-card">
                <div className="config-section-header">
                  <h2 className="config-section-title">Detailed Match Report</h2>
                  <p className="config-section-description">
                    Full provider details returned for each match.
                  </p>
                </div>
                <div className="manual-screening-detail-list">
                  {report.matches.map((match, index) => {
                    const entries = detailEntries(match.details)
                    return (
                      <article key={`${match.match_id}-${match.source}-detail`} className="manual-screening-detail-card">
                        <div className="manual-screening-detail-header">
                          <span className="customer-id">{index + 1}. {match.watchlist_name || 'Unnamed match'}</span>
                          <span className="pill pill-kyc-pending">{match.source}</span>
                        </div>
                        <div className="view-profile-grid">
                          <div className="view-profile-field">
                            <span className="view-profile-label">Match ID</span>
                            <span className="view-profile-value">{match.match_id}</span>
                          </div>
                          <div className="view-profile-field">
                            <span className="view-profile-label">Match Type</span>
                            <span className="view-profile-value">{match.match_type}</span>
                          </div>
                          <div className="view-profile-field">
                            <span className="view-profile-label">Status</span>
                            <span className="view-profile-value">{match.status}</span>
                          </div>
                          <div className="view-profile-field">
                            <span className="view-profile-label">Score</span>
                            <span className="view-profile-value">{match.match_score == null ? '-' : `${(match.match_score * 100).toFixed(1)}%`}</span>
                          </div>
                          {entries.length === 0 ? (
                            <div className="view-profile-field view-profile-field-full">
                              <span className="view-profile-label">Provider Details</span>
                              <span className="view-profile-value view-profile-value-block">No additional details returned.</span>
                            </div>
                          ) : entries.map(([key, value]) => (
                            <div key={`${match.match_id}-${key}`} className="view-profile-field view-profile-field-full">
                              <span className="view-profile-label">{labelForDetail(key)}</span>
                              <span className="view-profile-value view-profile-value-block">{value}</span>
                            </div>
                          ))}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
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
