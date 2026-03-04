import React, { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { HiOutlineDownload, HiOutlineEye, HiOutlineSearch, HiOutlineX } from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import './Customers.css'

type SarReportRow = {
  id: number
  alert_id: string
  sar_reference: string
  customer_id: string
  customer_name: string
  severity: string
  submitted_at: string | null
}

type ReportVariant = 'operational' | 'sar' | 'exports'
type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'
type PreviewTarget =
  | { type: 'sar'; row: SarReportRow }
  | { type: 'definition'; definition: ExportDefinition }

type ExportDefinition = {
  key: string
  name: string
  description: string
  endpoint: string
  filePrefix: string
  columns: string[]
}

type Paged<T> = { results?: T[] } | T[]
type CountedPaged<T> = { count?: number; results?: T[] } | T[]

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const PAGE_SIZE = 25

const EXPORT_DEFINITIONS: ExportDefinition[] = [
  {
    key: 'customers',
    name: 'Customers Register',
    description: 'Customer onboarding, KYC, and risk-level records in CSV format.',
    endpoint: '/customers/',
    filePrefix: 'customers_report',
    columns: ['id', 'customer_id', 'customer_type', 'first_name', 'last_name', 'company_name', 'email', 'risk_level', 'kyc_verified'],
  },
  {
    key: 'transactions',
    name: 'Transactions Register',
    description: 'Transaction monitoring feed including status, risk score, and suspicious flags.',
    endpoint: '/transactions/',
    filePrefix: 'transactions_report',
    columns: ['id', 'transaction_id', 'transaction_type', 'amount', 'currency', 'status', 'risk_score', 'is_suspicious', 'transaction_date'],
  },
  {
    key: 'alerts',
    name: 'Alerts Register',
    description: 'Alert queue with severity, workflow status, trigger details, and scores.',
    endpoint: '/alerts/',
    filePrefix: 'alerts_report',
    columns: ['id', 'alert_id', 'alert_type', 'severity', 'status', 'title', 'description', 'risk_score', 'triggered_at'],
  },
  {
    key: 'investigations',
    name: 'Investigations Register',
    description: 'Case investigation output, reviewer activity, and SAR decision tracking.',
    endpoint: '/investigations/',
    filePrefix: 'investigations_report',
    columns: ['id', 'alert', 'investigator', 'is_suspicious', 'sar_required', 'sar_filed', 'started_at', 'completed_at'],
  },
  {
    key: 'screening',
    name: 'Screening Queue',
    description: 'Pending watchlist screening queue with source databases and profile status.',
    endpoint: '/screening/pending_queue/',
    filePrefix: 'screening_queue',
    columns: ['id', 'customer_id', 'customer_name', 'email', 'risk_level', 'screening_status', 'source_database', 'last_updated'],
  },
  {
    key: 'sar',
    name: 'SAR Register',
    description: 'Suspicious activity report register for regulatory filing and audit.',
    endpoint: '/alerts/sar_reports/',
    filePrefix: 'sar_register',
    columns: ['id', 'alert_id', 'sar_reference', 'customer_id', 'customer_name', 'alert_type', 'severity', 'risk_score', 'submitted_at'],
  },
]

const OPERATIONAL_REPORT_KEYS = ['transactions', 'alerts', 'investigations', 'screening'] as const

function rowsOf<T>(payload: Paged<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function countOf<T>(payload: CountedPaged<T>): number {
  if (Array.isArray(payload)) return payload.length
  if (typeof payload.count === 'number') return payload.count
  return Array.isArray(payload.results) ? payload.results.length : 0
}

function formatDate(value?: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US')
}

function formatCellValue(value: unknown): string {
  if (value == null) return '-'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

const VARIANT_COPY: Record<ReportVariant, { title: string; subtitle: string }> = {
  operational: {
    title: 'Operational Reports',
    subtitle: 'Review report volumes and filed SAR records from the current operating queue.',
  },
  sar: {
    title: 'SAR Reports',
    subtitle: 'Search, review, and download filed suspicious activity reports.',
  },
  exports: {
    title: 'Data Exports',
    subtitle: 'Download structured registers for customers, transactions, alerts, investigations, and screening.',
  },
}

type ReportsProps = {
  variant?: ReportVariant
}

export const Reports: React.FC<ReportsProps> = ({ variant = 'operational' }) => {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null)
  const [sarReports, setSarReports] = useState<SarReportRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedReportKey, setSelectedReportKey] = useState('sar')
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('monthly')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [summary, setSummary] = useState({
    customers: 0,
    transactions: 0,
    alerts: 0,
    investigations: 0,
    sarFiled: 0,
  })

  const authHeaders: Record<string, string> = {}
  if (token) authHeaders.Authorization = `Token ${token}`

  const loadSarReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/sar_reports/`, { headers: authHeaders })
      if (!res.ok) throw new Error(`Failed to load SAR reports (${res.status})`)
      const payload = await res.json()
      setSarReports(rowsOf<SarReportRow>(payload))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load reports')
      setSarReports([])
    } finally {
      setLoading(false)
    }
  }

  const loadSummary = async () => {
    try {
      const [customersRes, transactionsRes, alertsRes, investigationsRes, sarRes] = await Promise.all([
        fetch(`${API_BASE_URL}/customers/`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/transactions/`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/alerts/`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/investigations/`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/alerts/sar_reports/`, { headers: authHeaders }),
      ])
      if (!customersRes.ok || !transactionsRes.ok || !alertsRes.ok || !investigationsRes.ok || !sarRes.ok) {
        throw new Error('Failed to load report summary')
      }
      const [customersPayload, transactionsPayload, alertsPayload, investigationsPayload, sarPayload] = await Promise.all([
        customersRes.json(),
        transactionsRes.json(),
        alertsRes.json(),
        investigationsRes.json(),
        sarRes.json(),
      ])
      setSummary({
        customers: countOf(customersPayload),
        transactions: countOf(transactionsPayload),
        alerts: countOf(alertsPayload),
        investigations: countOf(investigationsPayload),
        sarFiled: countOf(sarPayload),
      })
    } catch {
      setSummary({
        customers: 0,
        transactions: 0,
        alerts: 0,
        investigations: 0,
        sarFiled: 0,
      })
    }
  }

  const loadPageData = async () => {
    await Promise.all([loadSarReports(), loadSummary()])
  }

  useEffect(() => {
    void loadPageData()
  }, [])

  const filteredSarReports = useMemo(() => {
    const term = activeSearchTerm.toLowerCase()
    return sarReports.filter((row) => {
      if (term) {
        const hay = [row.sar_reference, row.alert_id, row.customer_name, row.customer_id].join(' ').toLowerCase()
        if (!hay.includes(term)) return false
      }
      if (severityFilter && row.severity !== severityFilter) return false
      return true
    })
  }, [sarReports, activeSearchTerm, severityFilter])

  const filteredExports = useMemo(() => {
    const term = activeSearchTerm.toLowerCase()
    const sourceDefinitions =
      variant === 'operational'
        ? EXPORT_DEFINITIONS.filter((row) => OPERATIONAL_REPORT_KEYS.includes(row.key as (typeof OPERATIONAL_REPORT_KEYS)[number]))
        : EXPORT_DEFINITIONS
    if (!term) return sourceDefinitions
    return sourceDefinitions.filter((row) =>
      [row.name, row.description, row.filePrefix].join(' ').toLowerCase().includes(term)
    )
  }, [activeSearchTerm, variant])

  const isSarTable = variant === 'sar'
  const sarTotalRecords = filteredSarReports.length
  const exportTotalRecords = filteredExports.length
  const totalRecords = isSarTable ? sarTotalRecords : exportTotalRecords
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageSarRows = filteredSarReports.slice(startIndex, startIndex + PAGE_SIZE)
  const pageExportRows = filteredExports.slice(startIndex, startIndex + PAGE_SIZE)
  const displayStart = totalRecords === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + (isSarTable ? pageSarRows.length : pageExportRows.length)

  const downloadPdfFromEndpoint = async (definition: ExportDefinition) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}${definition.endpoint}`, { headers: authHeaders })
      if (!res.ok) throw new Error(`Download failed (${res.status})`)
      const payload = await res.json()
      const rows = rowsOf<Record<string, unknown>>(payload)
      const doc = new jsPDF()
      const generatedAt = new Date().toLocaleString('en-US')
      const previewRows = rows.slice(0, 12)

      doc.setFontSize(16)
      doc.text(definition.name, 14, 18)
      doc.setFontSize(10)
      doc.text(`Generated: ${generatedAt}`, 14, 26)
      doc.text(`Records: ${rows.length}`, 14, 32)

      let y = 42
      definition.columns.slice(0, 4).forEach((column, index) => {
        const x = 14 + index * 46
        doc.setFont(undefined, 'bold')
        doc.text(column.replace(/_/g, ' ').toUpperCase(), x, y)
      })

      y += 8
      previewRows.forEach((row) => {
        definition.columns.slice(0, 4).forEach((column, index) => {
          const x = 14 + index * 46
          const value = formatCellValue(row[column]).slice(0, 22)
          doc.setFont(undefined, 'normal')
          doc.text(value, x, y)
        })
        y += 8
        if (y > 270) {
          doc.addPage()
          y = 20
        }
      })

      if (rows.length > previewRows.length) {
        y += 4
        doc.setFont(undefined, 'italic')
        doc.text(`Preview limited to first ${previewRows.length} records.`, 14, Math.min(y, 285))
      }

      doc.save(`${definition.filePrefix}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to download report')
    } finally {
      setLoading(false)
    }
  }

  const downloadSarPdf = async (id: number, baseName: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${id}/sar_report_pdf/`, { headers: authHeaders })
      if (!res.ok) throw new Error(`Failed to download SAR PDF (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(baseName || 'sar_report').replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to download SAR PDF')
    } finally {
      setLoading(false)
    }
  }

  const variantCopy = VARIANT_COPY[variant]
  const availableGenerateReports = useMemo(() => {
    if (variant === 'sar') {
      return EXPORT_DEFINITIONS.filter((definition) => definition.key === 'sar')
    }
    if (variant === 'exports') {
      return EXPORT_DEFINITIONS
    }
    return EXPORT_DEFINITIONS.filter((definition) =>
      OPERATIONAL_REPORT_KEYS.includes(definition.key as (typeof OPERATIONAL_REPORT_KEYS)[number])
    )
  }, [variant])

  const selectedGenerateReport =
    availableGenerateReports.find((definition) => definition.key === selectedReportKey) ?? availableGenerateReports[0]

  const openGenerateModal = () => {
    setSelectedReportKey((current) => {
      const matching = availableGenerateReports.find((definition) => definition.key === current)
      return matching?.key ?? availableGenerateReports[0]?.key ?? 'sar'
    })
    setReportPeriod('monthly')
    setCustomDateFrom('')
    setCustomDateTo('')
    setShowGenerateModal(true)
  }

  const activePeriodLabel =
    reportPeriod === 'custom'
      ? customDateFrom && customDateTo
        ? `${customDateFrom} to ${customDateTo}`
        : 'Custom date range'
      : reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)

  const buildDefinitionSummary = (definition: ExportDefinition): string => {
    const totalMap: Record<string, number> = {
      customers: summary.customers,
      transactions: summary.transactions,
      alerts: summary.alerts,
      investigations: summary.investigations,
      screening: summary.alerts,
      sar: summary.sarFiled,
    }
    const total = totalMap[definition.key] ?? 0
    return `AI summary: ${definition.name} consolidates ${total} tracked records for the ${activePeriodLabel.toLowerCase()} period. This report is intended to support operational review, identify volume shifts, and highlight activity that may require follow-up across ${definition.description.toLowerCase()}`
  }

  const buildSarSummary = (row: SarReportRow): string =>
    `AI summary: SAR ${row.sar_reference || row.alert_id} relates to ${row.customer_name} (${row.customer_id}) and is currently classified as ${row.severity.toLowerCase()} severity. This filing should be reviewed for escalation readiness, supporting evidence quality, and submission completeness before distribution or archival.`

  const handleRowDownload = async (definition: ExportDefinition) => {
    await downloadPdfFromEndpoint(definition)
  }

  const handlePreviewDownload = async () => {
    if (!previewTarget) return
    if (previewTarget.type === 'sar') {
      await downloadSarPdf(previewTarget.row.id, previewTarget.row.sar_reference || previewTarget.row.alert_id)
    } else {
      await handleRowDownload(previewTarget.definition)
    }
    setPreviewTarget(null)
  }

  const handleGenerateReport = async () => {
    if (!selectedGenerateReport) return
    await downloadPdfFromEndpoint(selectedGenerateReport)
    setShowGenerateModal(false)
  }

  return (
    <div className="reports-container">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">{variantCopy.title}</h1>
          <p className="customers-subtitle">{variantCopy.subtitle}</p>
        </div>
        <div className="customers-header-actions">
          <button type="button" className="btn-primary-action btn-with-icon" onClick={openGenerateModal} disabled={loading}>
            <HiOutlineDownload size={16} aria-hidden />
            <span>Generate Report</span>
          </button>
        </div>
      </header>

      <div className="customers-container">
        <div className="customers-filters-card report-filters">
          <div className="report-filters-left">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setActiveSearchTerm(searchTerm.trim())
                setCurrentPage(1)
              }}
              className="filter-group filter-group-search"
            >
              <div className="search-input-wrapper">
                <span className="search-icon" aria-hidden><HiOutlineSearch size={18} /></span>
                <input
                  type="text"
                  className="filter-input search-input"
                  placeholder={
                    isSarTable
                      ? 'Search SAR by reference, alert ID, or customer...'
                      : variant === 'operational'
                        ? 'Search operational reports by name or description...'
                        : 'Search export registers by name or description...'
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => {
                      setSearchTerm('')
                      setActiveSearchTerm('')
                      setCurrentPage(1)
                    }}
                  >
                    <HiOutlineX size={18} />
                  </button>
                )}
              </div>
            </form>

            {isSarTable ? (
              <>
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
                  <span className="filter-label">SAR Filed:</span>
                  <span className="modal-value">{summary.sarFiled}</span>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Alerts:</span>
                  <span className="modal-value">{summary.alerts}</span>
                </div>
              </>
            ) : (
              <>
                <div className="filter-group">
                  <span className="filter-label">{variant === 'operational' ? 'Reports:' : 'Exports:'}</span>
                  <span className="modal-value">{filteredExports.length}</span>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Transactions:</span>
                  <span className="modal-value">{summary.transactions}</span>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Customers:</span>
                  <span className="modal-value">{summary.customers}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="customers-table-card-outer">
          <div className="report-content-container ecl-table-container table-loading-shell">
            {loading && (
              <div className="table-loading-overlay" aria-hidden="true">
                <div className="table-loading-spinner" />
              </div>
            )}
            <table className="ecl-table">
              <thead>
                {isSarTable ? (
                  <tr>
                    <th>SAR REFERENCE</th>
                    <th>ALERT ID</th>
                    <th>CUSTOMER</th>
                    <th>SEVERITY</th>
                    <th>SUBMITTED</th>
                    <th>ACTIONS</th>
                  </tr>
                ) : (
                  <tr>
                    <th>REPORT</th>
                    <th>DESCRIPTION</th>
                    <th>FORMAT</th>
                    <th>ACTIONS</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {error ? (
                  <tr><td colSpan={isSarTable ? 6 : 4} className="muted">{error}</td></tr>
                ) : isSarTable ? (
                  pageSarRows.length === 0 ? (
                    !loading ? <tr><td colSpan={6} className="muted">No SAR reports available.</td></tr> : null
                  ) : (
                    pageSarRows.map((row) => (
                      <tr key={row.id}>
                        <td className="customer-id">{row.sar_reference || '-'}</td>
                        <td>{row.alert_id}</td>
                        <td>{row.customer_name} <span className="muted">({row.customer_id})</span></td>
                        <td>{row.severity}</td>
                        <td className="muted">{formatDate(row.submitted_at)}</td>
                        <td>
                          <div className="customers-actions">
                            <HiOutlineEye
                              size={18}
                              className="action-icon action-icon-view"
                              onClick={() => setPreviewTarget({ type: 'sar', row })}
                              title="View SAR summary"
                            />
                            <HiOutlineDownload
                              size={18}
                              className="action-icon action-icon-view"
                              onClick={() => {
                                if (!loading) {
                                  setPreviewTarget({ type: 'sar', row })
                                }
                              }}
                              title="Review before download"
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )
                ) : pageExportRows.length === 0 ? (
                  !loading ? <tr><td colSpan={4} className="muted">No exports available.</td></tr> : null
                ) : (
                  pageExportRows.map((row) => (
                    <tr key={row.key}>
                      <td className="customer-id">{row.name}</td>
                      <td>{row.description}</td>
                      <td>PDF</td>
                      <td>
                        <div className="customers-actions">
                          <HiOutlineEye
                            size={18}
                            className="action-icon action-icon-view"
                            onClick={() => setPreviewTarget({ type: 'definition', definition: row })}
                            title={`View ${row.name}`}
                          />
                          <HiOutlineDownload
                            size={18}
                            className="action-icon action-icon-view"
                            onClick={() => {
                              if (!loading) {
                                setPreviewTarget({ type: 'definition', definition: row })
                              }
                            }}
                            title={`Review before download`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}

                {!error && Array.from({ length: Math.max(0, PAGE_SIZE - (isSarTable ? pageSarRows.length : pageExportRows.length)) }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>
                    {Array.from({ length: isSarTable ? 6 : 4 }).map((__, c) => <td key={c}>&nbsp;</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ecl-table-footer">
            <div className="table-footer-left">
              {isSarTable
                ? `Showing ${displayStart} to ${displayEnd} of ${totalRecords} SAR reports.`
                : `Showing ${displayStart} to ${displayEnd} of ${totalRecords} ${variant === 'operational' ? 'operational reports' : 'export definitions'}.`}
            </div>
            <div className="table-footer-right">
              {totalPages > 1 ? (
                <div className="pagination-controls">
                  <button type="button" className="pagination-btn" disabled={safePage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button>
                  <span className="pagination-info">Page {safePage} of {totalPages}</span>
                  <button type="button" className="pagination-btn" disabled={safePage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next</button>
                </div>
              ) : (
                <span>{loading ? 'Working...' : 'All data displayed'}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {showGenerateModal && (
        <div className="modal-backdrop" onClick={() => setShowGenerateModal(false)}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Generate Report</h2>
              <button className="modal-close-btn" onClick={() => setShowGenerateModal(false)} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label" htmlFor="reportDefinition">
                    Report Type
                  </label>
                  <select
                    id="reportDefinition"
                    className="modal-input"
                    value={selectedGenerateReport?.key ?? ''}
                    onChange={(e) => setSelectedReportKey(e.target.value)}
                  >
                    {availableGenerateReports.map((definition) => (
                      <option key={definition.key} value={definition.key}>
                        {definition.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="reportPeriod">
                    Period
                  </label>
                  <select
                    id="reportPeriod"
                    className="modal-input"
                    value={reportPeriod}
                    onChange={(e) => setReportPeriod(e.target.value as ReportPeriod)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>
                {reportPeriod === 'custom' && (
                  <div className="modal-two-column">
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="reportDateFrom">
                        From
                      </label>
                      <input
                        id="reportDateFrom"
                        type="date"
                        className="modal-input"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                      />
                    </div>
                    <div className="modal-field">
                      <label className="modal-label" htmlFor="reportDateTo">
                        To
                      </label>
                      <input
                        id="reportDateTo"
                        type="date"
                        className="modal-input"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                {selectedGenerateReport && (
                  <>
                    <div className="modal-field">
                      <span className="modal-label">Description</span>
                      <span className="modal-value">{selectedGenerateReport.description}</span>
                    </div>
                    <div className="modal-field">
                      <span className="modal-label">AI Summary</span>
                      <span className="modal-value">{buildDefinitionSummary(selectedGenerateReport)}</span>
                    </div>
                    <div className="modal-field">
                      <span className="modal-label">Applied Period</span>
                      <span className="modal-value">
                        {reportPeriod === 'custom'
                          ? customDateFrom && customDateTo
                            ? `${customDateFrom} to ${customDateTo}`
                            : 'Choose a start and end date'
                          : reportPeriod.charAt(0).toUpperCase() + reportPeriod.slice(1)}
                      </span>
                    </div>
                    <div className="modal-field">
                      <span className="modal-label">Export Format</span>
                      <span className="modal-value">PDF</span>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowGenerateModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => void handleGenerateReport()}
                  disabled={
                    loading ||
                    !selectedGenerateReport ||
                    (reportPeriod === 'custom' && (!customDateFrom || !customDateTo))
                  }
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewTarget && (
        <div className="modal-backdrop" onClick={() => setPreviewTarget(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Report Preview</h2>
              <button className="modal-close-btn" onClick={() => setPreviewTarget(null)} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                {previewTarget.type === 'sar' ? (
                  <>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <span className="modal-label">Report</span>
                        <span className="modal-value">{previewTarget.row.sar_reference || '-'}</span>
                      </div>
                      <div className="modal-field">
                        <span className="modal-label">Format</span>
                        <span className="modal-value">PDF</span>
                      </div>
                    </div>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <span className="modal-label">Customer</span>
                        <span className="modal-value">{previewTarget.row.customer_name}</span>
                      </div>
                      <div className="modal-field">
                        <span className="modal-label">Severity</span>
                        <span className="modal-value">{previewTarget.row.severity}</span>
                      </div>
                    </div>
                    <div className="modal-field">
                      <span className="modal-label">AI Summary</span>
                      <span className="modal-value">{buildSarSummary(previewTarget.row)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="modal-two-column">
                      <div className="modal-field">
                        <span className="modal-label">Report</span>
                        <span className="modal-value">{previewTarget.definition.name}</span>
                      </div>
                      <div className="modal-field">
                        <span className="modal-label">Format</span>
                        <span className="modal-value">PDF</span>
                      </div>
                    </div>
                    <div className="modal-field">
                      <span className="modal-label">Description</span>
                      <span className="modal-value">{previewTarget.definition.description}</span>
                    </div>
                    <div className="modal-field">
                      <span className="modal-label">Applied Period</span>
                      <span className="modal-value">{activePeriodLabel}</span>
                    </div>
                    <div className="modal-field">
                      <span className="modal-label">AI Summary</span>
                      <span className="modal-value">{buildDefinitionSummary(previewTarget.definition)}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setPreviewTarget(null)}>
                  Close
                </button>
                <button type="button" className="btn-primary-action" onClick={() => void handlePreviewDownload()} disabled={loading}>
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
