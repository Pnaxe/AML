import React, { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { HiOutlineSearch, HiOutlineX, HiOutlineRefresh, HiOutlineEye, HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineDownload } from 'react-icons/hi'
import logoSrc from '../images/AS logo.png'
import './Customers.css'
import './KYC.css'

type ScreeningQueueItem = {
  id: number
  customer_id: string
  customer_name: string
  email: string
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  screening_status: string
  screening_status_code?: 'SCREENED' | 'WAITING'
  source_database: string
  last_updated: string
}

type PendingQueueResponse = {
  count: number
  results: ScreeningQueueItem[]
}

type ScreeningMatch = {
  match_id: string
  status: string
  match_type: string
  match_score: number
  confidence_score: number | null
  watchlist_name: string
  source: string
  detected_at: string | null
  evidence_data?: Record<string, unknown>
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

type CustomerReportResponse = {
  customer: {
    id: number
    customer_id: string
    name: string
    email: string
    customer_type: string
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    risk_score: number | null
    is_pep: boolean
    is_sanctioned: boolean
    kyc_verified: boolean
    pep_details: string
    sanction_details: string
    last_updated: string | null
    source_database: string
  }
  summary: {
    total_matches: number
    open_matches: number
    confirmed_matches: number
    false_positive_matches: number
    apis_checked?: number
    total_api_sources?: number
    risk_flags?: string[]
    overall_status?: 'CLEAR' | 'REVIEW' | 'BLOCK'
    screening_date?: string
  }
  api_sources?: ApiSourceCheck[]
  matches: ScreeningMatch[]
}

const PAGE_SIZE = 25
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
type ScreeningViewVariant = 'screening' | 'approved' | 'declined'

type ScreeningProps = {
  variant?: ScreeningViewVariant
}

function formatDate(value: string): string {
  if (!value) return '-'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  return dt.toLocaleDateString('en-US')
}

function formatDateTime(value: string): string {
  if (!value) return '-'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  return dt.toLocaleString('en-US')
}

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
  listing_reason: 'Listing Reason',
  program: 'Program',
}

function labelForDetail(key: string): string {
  return DETAIL_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function detailEntries(details?: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(details ?? {})
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

function formatDateInputValue(value: string): string {
  if (!value) return ''
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toISOString().slice(0, 10)
}

export const Screening: React.FC<ScreeningProps> = ({ variant = 'screening' }) => {
  const [records, setRecords] = useState<ScreeningQueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [screeningStatusFilter, setScreeningStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({})
  const [selectedProfile, setSelectedProfile] = useState<ScreeningQueueItem | null>(null)
  const [profileReport, setProfileReport] = useState<CustomerReportResponse | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileActionLoading, setProfileActionLoading] = useState(false)
  const pageTitle =
    variant === 'approved' ? 'Approved Profiles' : variant === 'declined' ? 'Declined Profiles' : 'Screening'
  const pageSubtitle =
    variant === 'approved'
      ? 'Profiles that have been approved after screening.'
      : variant === 'declined'
        ? 'Profiles that have been declined after screening.'
        : 'Customers moved to screening and waiting to be screened.'
  const isQueueView = variant === 'screening'
  const decisionStatusValue =
    variant === 'approved' ? 'Approved' : variant === 'declined' ? 'Rejected' : null
  const statusColumnLabel =
    variant === 'approved' || variant === 'declined'
      ? 'DECISION STATUS'
      : 'SCREENING STATUS'
  const totalColumns = isQueueView ? 9 : 8

  const loadQueue = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/screening/pending_queue/`)
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
      }
      const payload = (await res.json()) as PendingQueueResponse
      setRecords(Array.isArray(payload.results) ? payload.results : [])
      setSelectedKeys({})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load pending queue')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadQueue()
  }, [])

  const loadProfileReport = async (item: ScreeningQueueItem) => {
    setProfileLoading(true)
    try {
      const params = new URLSearchParams({
        customer_id: String(item.id),
        source_db: item.source_database,
      })
      const res = await fetch(`${API_BASE_URL}/screening/customer_report/?${params.toString()}`)
      if (!res.ok) {
        throw new Error(`Failed to load report (${res.status})`)
      }
      const payload = (await res.json()) as CustomerReportResponse
      setProfileReport(payload)
    } catch (err) {
      setProfileReport(null)
      setError(err instanceof Error ? err.message : 'Unable to load customer report')
    } finally {
      setProfileLoading(false)
    }
  }

  const sourceOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.source_database))).sort(),
    [records]
  )

  const filteredRecords = useMemo(() => {
    const term = activeSearchTerm.toLowerCase()
    return records.filter((r) => {
      if (variant === 'approved' && r.screening_status !== 'Screened') return false
      if (variant === 'declined' && r.screening_status !== 'Declined') return false
      if (
        term &&
        !(
          r.customer_name.toLowerCase().includes(term) ||
          r.customer_id.toLowerCase().includes(term) ||
          r.email.toLowerCase().includes(term)
        )
      ) {
        return false
      }
      if (riskFilter && r.risk_level !== riskFilter) return false
      if (screeningStatusFilter && r.screening_status.toLowerCase() !== screeningStatusFilter.toLowerCase()) return false
      if (dateFilter && formatDateInputValue(r.last_updated) !== dateFilter) return false
      if (sourceFilter && r.source_database !== sourceFilter) return false
      return true
    })
  }, [records, activeSearchTerm, riskFilter, screeningStatusFilter, dateFilter, sourceFilter])

  const totalRecords = filteredRecords.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageRecords = filteredRecords.slice(startIndex, startIndex + PAGE_SIZE)

  const displayStart = totalRecords === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageRecords.length

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveSearchTerm(searchTerm.trim())
    setCurrentPage(1)
  }

  const clearSearch = () => {
    setSearchTerm('')
    setActiveSearchTerm('')
    setCurrentPage(1)
  }

  const handleOpenProfile = (item: ScreeningQueueItem) => {
    setSelectedProfile(item)
    void loadProfileReport(item)
  }

  const handleCloseProfile = () => {
    setSelectedProfile(null)
    setProfileReport(null)
  }

  const handleDownloadReport = async () => {
    if (!profileReport || !selectedProfile) return

    const customer = profileReport.customer
    const summary = profileReport.summary
    const matches = profileReport.matches
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

    const reportStatus = summary.overall_status ?? (summary.total_matches > 0 ? 'REVIEW' : 'CLEAR')
    doc.setFillColor(15, 23, 42)
    doc.roundedRect(pageWidth - 58, 12, 44, 12, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(reportStatus, pageWidth - 36, 20, { align: 'center' })

    y = 34
    doc.setFontSize(18)
    doc.setTextColor(15, 23, 42)
    doc.text('Screened Profile Report', margin, y)
    y += 8
    doc.setFontSize(11)
    doc.setTextColor(71, 85, 105)
    doc.text(`Subject: ${customer.name} (${customer.customer_id})`, margin, y)
    y += lineHeight
    doc.text(`Risk: ${customer.risk_level} | Source: ${customer.source_database}`, margin, y)
    y += lineHeight
    doc.text(`Generated: ${formatDateTime(summary.screening_date || customer.last_updated || '')}`, margin, y)
    y += lineHeight
    doc.text(`Matches Found: ${summary.total_matches} | APIs Checked: ${summary.apis_checked ?? 0} of ${summary.total_api_sources ?? profileReport.api_sources?.length ?? 0}`, margin, y)
    y += lineHeight

    sectionTitle('Customer Overview')
    ;[
      `Email: ${customer.email || '-'}`,
      `Customer type: ${customer.customer_type || '-'}`,
      `Risk score: ${customer.risk_score == null ? '-' : customer.risk_score.toFixed(2)}`,
      `PEP flag: ${customer.is_pep ? 'Yes' : 'No'}`,
      `Sanctions flag: ${customer.is_sanctioned ? 'Yes' : 'No'}`,
      `Risk flags: ${(summary.risk_flags ?? []).length ? (summary.risk_flags ?? []).join(', ') : 'None'}`,
    ].forEach((line) => {
      ensureSpace(lineHeight)
      doc.text(line, margin + 2, y)
      y += lineHeight
    })

    sectionTitle('API Coverage')
    doc.setFontSize(11)
    doc.setTextColor(51, 65, 85)
    ;(profileReport.api_sources ?? []).forEach((source) => {
      ensureSpace(lineHeight)
      doc.text(`${source.name} | ${source.status}${source.last_four ? ` | ending ${source.last_four}` : ''}`, margin + 2, y)
      y += lineHeight
    })

    sectionTitle('Matches And Provider Details')
    doc.setFontSize(11)
    if (!matches || matches.length === 0) {
      doc.text('No matches found for this profile.', margin + 2, y)
    } else {
      matches.forEach((m, idx) => {
        ensureSpace(16)
        const score = m.match_score == null ? '-' : `${(m.match_score * 100).toFixed(1)}%`
        doc.setFontSize(11)
        doc.setTextColor(15, 23, 42)
        doc.text(
          `${idx + 1}. ${m.watchlist_name || '-'} | ${m.match_type} | ${m.status} | ${score}`,
          margin + 2,
          y,
        )
        y += lineHeight
        doc.setFontSize(9)
        doc.setTextColor(71, 85, 105)
        detailEntries(m.evidence_data).forEach(([key, value]) => {
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
    const baseName = customer.customer_id || selectedProfile.customer_id || 'screened_profile'
    doc.save(`${baseName}_screening_report.pdf`)
  }

  const handleDownloadReportLegacy = () => {
    if (!profileReport || !selectedProfile) return

    const customer = profileReport.customer
    const summary = profileReport.summary
    const matches = profileReport.matches

    const doc = new jsPDF()

    let y = 14
    const lineHeight = 7

    doc.setFontSize(16)
    doc.text('Screened Profile Report', 14, y)

    y += lineHeight
    doc.setFontSize(11)
    doc.text(
      `${customer.name} (${customer.customer_id}) • Risk: ${customer.risk_level} • Source: ${customer.source_database}`,
      14,
      y,
    )

    // Section: Customer overview
    y += lineHeight * 2
    doc.setFontSize(13)
    doc.text('1. Customer overview', 14, y)

    doc.setFontSize(11)
    y += lineHeight
    doc.text(`Email: ${customer.email || '-'}`, 14, y)
    y += lineHeight
    doc.text(`Customer type: ${customer.customer_type || '-'}`, 14, y)
    y += lineHeight
    doc.text(`Risk level: ${customer.risk_level}`, 14, y)
    y += lineHeight
    doc.text(`Risk score: ${customer.risk_score == null ? '-' : customer.risk_score.toFixed(2)}`, 14, y)
    y += lineHeight
    doc.text(`PEP flag: ${customer.is_pep ? 'Yes' : 'No'}`, 14, y)
    y += lineHeight
    doc.text(`Sanctions flag: ${customer.is_sanctioned ? 'Yes' : 'No'}`, 14, y)

    // Section: Screening summary
    y += lineHeight * 2
    doc.setFontSize(13)
    doc.text('2. Screening summary', 14, y)

    doc.setFontSize(11)
    y += lineHeight
    doc.text(`Total matches: ${summary.total_matches}`, 14, y)
    y += lineHeight
    doc.text(`Open matches: ${summary.open_matches}`, 14, y)
    y += lineHeight
    doc.text(`Confirmed matches: ${summary.confirmed_matches}`, 14, y)
    y += lineHeight
    doc.text(`False positives: ${summary.false_positive_matches}`, 14, y)

    // Section: Detection details (compact)
    y += lineHeight * 2
    doc.setFontSize(13)
    doc.text('3. Detection details (summary)', 14, y)

    doc.setFontSize(11)
    if (!matches || matches.length === 0) {
      y += lineHeight
      doc.text('No matches found for this profile.', 14, y)
    } else {
      const maxLines = 15
      const limited = matches.slice(0, maxLines)

      limited.forEach((m, idx) => {
        y += lineHeight
        if (y > 280) {
          doc.addPage()
          y = 20
        }
        doc.text(
          `${idx + 1}. ${m.watchlist_name || 'Watchlist'} • ${m.match_type || 'Type'} • Score: ${(m.match_score * 100).toFixed(1)}%`,
          14,
          y,
        )
      })

      if (matches.length > maxLines) {
        y += lineHeight
        if (y > 280) {
          doc.addPage()
          y = 20
        }
        doc.text(`+ ${matches.length - maxLines} more matches not shown`, 14, y)
      }
    }

    const baseName = customer.customer_id || selectedProfile.customer_id || 'screened_profile'
    doc.save(`${baseName}_screening_report.pdf`)
  }

  const handleAccept = async () => {
    if (!selectedProfile) return
    setProfileActionLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/screening/accept_profile/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedProfile.id,
          source_db: selectedProfile.source_database,
        }),
      })
      if (!res.ok) {
        throw new Error(`Failed to accept profile (${res.status})`)
      }
      const key = rowKey(selectedProfile)
      setRecords((prev) => prev.filter((item) => rowKey(item) !== key))
      setSelectedKeys((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      handleCloseProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept profile')
    } finally {
      setProfileActionLoading(false)
    }
  }

  const handleDeny = async () => {
    if (!selectedProfile) return
    const reason = window.prompt('Reason for denying this profile (optional):', '') ?? ''
    setProfileActionLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/screening/deny_profile/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedProfile.id,
          source_db: selectedProfile.source_database,
          reason,
        }),
      })
      if (!res.ok) {
        throw new Error(`Failed to deny profile (${res.status})`)
      }
      const key = rowKey(selectedProfile)
      setRecords((prev) => prev.filter((item) => rowKey(item) !== key))
      setSelectedKeys((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      handleCloseProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to deny profile')
    } finally {
      setProfileActionLoading(false)
    }
  }

  const rowKey = (item: ScreeningQueueItem) => `${item.source_database}:${item.id}`
  const selectedProfiles = records.filter((r) => selectedKeys[rowKey(r)])
  const pageSelectedCount = pageRecords.filter((r) => selectedKeys[rowKey(r)]).length
  const pageAllSelected = pageRecords.length > 0 && pageSelectedCount === pageRecords.length

  const toggleRowSelection = (item: ScreeningQueueItem) => {
    const key = rowKey(item)
    setSelectedKeys((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const togglePageSelection = () => {
    setSelectedKeys((prev) => {
      const next = { ...prev }
      for (const item of pageRecords) {
        next[rowKey(item)] = !pageAllSelected
      }
      return next
    })
  }

  const handleScreenSelected = async () => {
    if (selectedProfiles.length === 0) {
      setError('Select at least one profile to screen.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/screening/run_selected/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profiles: selectedProfiles.map((p) => ({
            customer_id: p.id,
            source_db: p.source_database,
          })),
        }),
      })
      if (!res.ok) {
        throw new Error(`Screening request failed (${res.status})`)
      }
      await loadQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run screening')
    } finally {
      setLoading(false)
    }
  }

  if (selectedProfile) {
    const customer = profileReport?.customer
    const summary = profileReport?.summary
    const matches = profileReport?.matches ?? []
    const V = (v?: string | null) => (v && String(v).trim() !== '' ? v : '-')
    const reportStatus = summary?.overall_status ?? ((summary?.total_matches ?? 0) > 0 ? 'REVIEW' : 'CLEAR')
    const riskTone = reportStatus === 'BLOCK' || reportStatus === 'REVIEW' ? 'pill-high' : 'pill-low'

    return (
      <div className="reports-container">
      <div className="view-profile-page screening-report">
        <header className="customers-header">
          <div>
            <h1 className="customers-title">Screened Profile Report</h1>
            <p className="customers-subtitle">
              {selectedProfile.customer_name} ({selectedProfile.customer_id}) ·{' '}
              <span className={`pill pill-${selectedProfile.risk_level.toLowerCase()}`}>{selectedProfile.risk_level}</span>{' '}
              <span className="pill pill-kyc-verified">{selectedProfile.screening_status}</span>
            </p>
          </div>
          <div className="customers-header-actions">
            <button
              type="button"
              className="btn-secondary-action btn-with-icon"
              onClick={handleCloseProfile}
              disabled={profileActionLoading}
            >
              <HiOutlineArrowLeft size={16} aria-hidden />
              <span>
                {variant === 'approved' ? 'Back to approved profiles' : variant === 'declined' ? 'Back to declined profiles' : 'Back to screening queue'}
              </span>
            </button>
            {isQueueView && (
              <>
                <button
                  type="button"
                  className="btn-secondary-action btn-reject-profile btn-with-icon"
                  onClick={handleDeny}
                  disabled={profileActionLoading}
                >
                  <HiOutlineXCircle size={16} aria-hidden />
                  <span>{profileActionLoading ? 'Processing...' : 'Reject profile'}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary-action btn-approve-profile btn-with-icon"
                  onClick={handleAccept}
                  disabled={profileActionLoading}
                >
                  <HiOutlineCheckCircle size={16} aria-hidden />
                  <span>{profileActionLoading ? 'Processing...' : 'Approve profile'}</span>
                </button>
              </>
            )}
          </div>
        </header>

        <div className="customers-filters-card manual-screening-summary-card manual-screening-report-hero">
          <div className="bulk-import-card manual-screening-report-hero-inner">
            {profileLoading ? (
              <div className="manual-screening-empty-state">
                <span className="view-profile-label">Report Summary</span>
                <span className="bulk-import-text">Loading screened profile report...</span>
              </div>
            ) : customer ? (
              <>
                <div className="manual-screening-report-brand">
                  <img src={logoSrc} alt="AfriSentry Logo" className="manual-screening-report-logo" />
                  <span className={`pill ${riskTone}`}>{reportStatus}</span>
                </div>
                <div className="manual-screening-report-title-block">
                  <span className="view-profile-label">Screening Report</span>
                  <h2 className="manual-screening-report-title">{customer.name}</h2>
                  <p className="manual-screening-report-subtitle">
                    Generated {formatDateTime(summary?.screening_date || customer.last_updated || '')} for {customer.customer_type.toLowerCase()} screening.
                  </p>
                </div>
                <div className="manual-screening-report-metrics">
                  <div className="manual-screening-report-metric">
                    <span>{summary?.total_matches ?? 0}</span>
                    <small>Matches</small>
                  </div>
                  <div className="manual-screening-report-metric">
                    <span>{summary?.apis_checked ?? 0}/{summary?.total_api_sources ?? profileReport?.api_sources?.length ?? 0}</span>
                    <small>APIs Checked</small>
                  </div>
                  <div className="manual-screening-report-metric">
                    <span>{summary?.risk_flags?.length ?? 0}</span>
                    <small>Risk Flags</small>
                  </div>
                </div>
                <div className="view-profile-field view-profile-field-full manual-screening-report-flags">
                  <span className="view-profile-label">Risk Flags</span>
                  <span className="view-profile-value view-profile-value-block">
                    {summary?.risk_flags?.length ? summary.risk_flags.join(', ') : 'None'}
                  </span>
                </div>
              </>
            ) : (
              <div className="manual-screening-empty-state">
                <span className="view-profile-label">Report Summary</span>
                <span className="bulk-import-text">No report data available.</span>
              </div>
            )}
          </div>
        </div>

        <div className="view-profile-card-outer">
          <div className="view-profile-card-inner">
            <div className="view-profile-body">
              {profileLoading ? (
                <section className="view-profile-section">
                  <h2 className="view-profile-section-title">Loading report...</h2>
                </section>
              ) : customer ? (
                <>
                  <section className="view-profile-section">
                    <h2 className="view-profile-section-title">1. Customer Overview</h2>
                    <div className="view-profile-grid">
                      <div className="view-profile-field"><span className="view-profile-label">Name</span><span className="view-profile-value">{V(customer.name)}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">Customer ID</span><span className="view-profile-value">{V(customer.customer_id)}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">Email</span><span className="view-profile-value">{V(customer.email)}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">Customer type</span><span className="view-profile-value">{V(customer.customer_type)}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">Risk level</span><span className="view-profile-value">{V(customer.risk_level)}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">Risk score</span><span className="view-profile-value">{customer.risk_score == null ? '-' : customer.risk_score.toFixed(2)}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">PEP flag</span><span className="view-profile-value">{customer.is_pep ? 'Yes' : 'No'}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">Sanctions flag</span><span className="view-profile-value">{customer.is_sanctioned ? 'Yes' : 'No'}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">Source database</span><span className="view-profile-value">{V(customer.source_database)}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">Last updated</span><span className="view-profile-value">{formatDate(customer.last_updated || '')}</span></div>
                    </div>
                  </section>

                  <section className="view-profile-section">
                    <h2 className="view-profile-section-title">2. Screening Summary</h2>
                    <div className="view-profile-grid">
                      <div className="view-profile-field"><span className="view-profile-label">Total matches</span><span className="view-profile-value">{summary?.total_matches ?? 0}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">Open matches</span><span className="view-profile-value">{summary?.open_matches ?? 0}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">Confirmed matches</span><span className="view-profile-value">{summary?.confirmed_matches ?? 0}</span></div>
                      <div className="view-profile-field"><span className="view-profile-label">False positives</span><span className="view-profile-value">{summary?.false_positive_matches ?? 0}</span></div>
                      <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">PEP details</span><span className="view-profile-value view-profile-value-block">{V(customer.pep_details)}</span></div>
                      <div className="view-profile-field view-profile-field-full"><span className="view-profile-label">Sanctions details</span><span className="view-profile-value view-profile-value-block">{V(customer.sanction_details)}</span></div>
                    </div>
                  </section>

                  <section className="view-profile-section view-profile-documents">
                    <h2 className="view-profile-section-title">3. Detection Details</h2>
                    {matches.length === 0 ? (
                      <p className="view-profile-no-docs">No matches found for this profile.</p>
                    ) : (
                      <div className="view-profile-docs-grid">
                        {matches.map((m) => (
                          <div key={m.match_id} className="view-profile-doc-card">
                            <div className="view-profile-doc-info">
                              <span className="view-profile-doc-label">{V(m.watchlist_name)}</span>
                              <span className="view-profile-doc-filename">
                                {m.match_id} • {m.source || 'Unknown source'}
                              </span>
                            </div>
                            <div className="view-profile-grid" style={{ width: '100%' }}>
                              <div className="view-profile-field"><span className="view-profile-label">Status</span><span className="view-profile-value">{V(m.status)}</span></div>
                              <div className="view-profile-field"><span className="view-profile-label">Type</span><span className="view-profile-value">{V(m.match_type)}</span></div>
                              <div className="view-profile-field"><span className="view-profile-label">Match score</span><span className="view-profile-value">{(m.match_score * 100).toFixed(1)}%</span></div>
                              <div className="view-profile-field"><span className="view-profile-label">Detected</span><span className="view-profile-value">{formatDate(m.detected_at || '')}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="view-profile-section">
                    <h2 className="view-profile-section-title">4. API Coverage</h2>
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
                          {(profileReport?.api_sources ?? []).length === 0 ? (
                            <tr>
                              <td colSpan={5} className="muted">No screening API keys are configured.</td>
                            </tr>
                          ) : (
                            (profileReport?.api_sources ?? []).map((source) => (
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
                  </section>

                  {matches.length > 0 && (
                    <section className="view-profile-section">
                      <h2 className="view-profile-section-title">5. Detailed Match Report</h2>
                      <div className="manual-screening-detail-list">
                        {matches.map((match, index) => {
                          const entries = detailEntries(match.evidence_data)
                          return (
                            <article key={`${match.match_id}-${match.source}-detail`} className="manual-screening-detail-card">
                              <div className="manual-screening-detail-header">
                                <span className="customer-id">{index + 1}. {match.watchlist_name || 'Unnamed match'}</span>
                                <span className="pill pill-kyc-pending">{match.source}</span>
                              </div>
                              <div className="view-profile-grid">
                                <div className="view-profile-field"><span className="view-profile-label">Match ID</span><span className="view-profile-value">{match.match_id}</span></div>
                                <div className="view-profile-field"><span className="view-profile-label">Match Type</span><span className="view-profile-value">{match.match_type}</span></div>
                                <div className="view-profile-field"><span className="view-profile-label">Status</span><span className="view-profile-value">{match.status}</span></div>
                                <div className="view-profile-field"><span className="view-profile-label">Score</span><span className="view-profile-value">{match.match_score == null ? '-' : `${(match.match_score * 100).toFixed(1)}%`}</span></div>
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
                    </section>
                  )}
                </>
              ) : (
                <section className="view-profile-section">
                  <h2 className="view-profile-section-title">No report data available.</h2>
                </section>
              )}
            </div>
            <div className="screening-report-footer">
              <button
                type="button"
                className="btn-outline-action btn-with-icon"
                onClick={handleDownloadReport}
                disabled={profileLoading || !profileReport}
              >
                <HiOutlineDownload size={16} aria-hidden />
                <span>Download report</span>
              </button>
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
          <h1 className="customers-title">{pageTitle}</h1>
          <p className="customers-subtitle">{pageSubtitle}</p>
        </div>
        {isQueueView && (
          <div className="customers-header-actions">
            <button
              type="button"
              className="btn-primary-action btn-with-icon"
              onClick={() => void handleScreenSelected()}
              disabled={loading || selectedProfiles.length === 0}
            >
              <HiOutlineRefresh size={16} aria-hidden />
              <span>
                {loading
                  ? 'Screening...'
                  : `Screening${selectedProfiles.length ? ` (${selectedProfiles.length})` : ''}`}
              </span>
            </button>
          </div>
        )}
      </header>

      <div className="customers-container">
        <div className="customers-filters-card report-filters">
          <div className="report-filters-left">
            <form onSubmit={handleSearchSubmit} className="filter-group filter-group-search">
              <div className="search-input-wrapper">
                <span className="search-icon" aria-hidden>
                  <HiOutlineSearch size={18} />
                </span>
                <input
                  type="text"
                  className="filter-input search-input"
                  placeholder="Search by name, email, or customer ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button type="button" className="search-clear-btn" onClick={clearSearch} title="Clear search" aria-label="Clear search">
                    <HiOutlineX size={18} />
                  </button>
                )}
              </div>
            </form>

            <div className="filter-group">
              <span className="filter-label">Risk Level:</span>
              <select
                className="filter-input"
                value={riskFilter}
                onChange={(e) => {
                  setRiskFilter(e.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="">All Risk Levels</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>

            {isQueueView && (
              <div className="filter-group">
                <span className="filter-label">Screening Status:</span>
                <select
                  className="filter-input"
                  value={screeningStatusFilter}
                  onChange={(e) => {
                    setScreeningStatusFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="Screened">Screened</option>
                  <option value="Waiting for screening">Waiting for screening</option>
                </select>
              </div>
            )}

            <div className="filter-group">
              <span className="filter-label">Date:</span>
              <input
                type="date"
                className="filter-input"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>

            <div className="filter-group">
              <span className="filter-label">Source DB:</span>
              <select
                className="filter-input"
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="">All Databases</option>
                {sourceOptions.map((db) => (
                  <option key={db} value={db}>{db}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="customers-table-card-outer">
          <div className="report-content-container ecl-table-container">
            <table className="ecl-table">
              <thead>
                <tr>
                  {isQueueView && (
                    <th>
                      <input
                        type="checkbox"
                        checked={pageAllSelected}
                        onChange={togglePageSelection}
                        aria-label="Select all profiles on this page"
                      />
                    </th>
                  )}
                  <th>CUSTOMER ID</th>
                  <th>NAME</th>
                  <th>EMAIL</th>
                  <th>RISK LEVEL</th>
                  <th>{statusColumnLabel}</th>
                  <th>SOURCE DB</th>
                  <th>LAST UPDATED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {error ? (
                  <tr>
                    <td colSpan={totalColumns} className="muted">{error}</td>
                  </tr>
                ) : (
                  pageRecords.map((r) => {
                    const canView = isQueueView ? r.screening_status === 'Screened' : true
                    const isScreening = isQueueView && loading && !!selectedKeys[rowKey(r)]
                    const statusClass =
                      r.screening_status === 'Screened'
                        ? 'screening-status-screened'
                        : r.screening_status === 'Waiting for screening'
                        ? 'screening-status-waiting'
                        : 'screening-status-other'
                    return (
                  <tr key={`${r.source_database}-${r.customer_id}`}>
                    {isQueueView && (
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selectedKeys[rowKey(r)]}
                          onChange={() => toggleRowSelection(r)}
                          aria-label={`Select profile ${r.customer_name}`}
                        />
                      </td>
                    )}
                    <td className="customer-id">{r.customer_id}</td>
                    <td>{r.customer_name || '-'}</td>
                    <td className="muted">{r.email || '-'}</td>
                    <td>
                      <span className={`pill pill-${r.risk_level.toLowerCase()}`}>{r.risk_level}</span>
                    </td>
                    <td>
                      <span
                        className={`pill screening-status-pill ${statusClass} ${
                          isScreening ? 'screening-status-running' : ''
                        }`}
                      >
                        {isScreening && (
                          <HiOutlineRefresh
                            size={14}
                            className="screening-status-spinner"
                            aria-hidden
                          />
                        )}
                        <span>
                          {isScreening ? 'Screening…' : decisionStatusValue ?? r.screening_status}
                        </span>
                      </span>
                    </td>
                    <td className="muted">{r.source_database}</td>
                    <td className="muted">{formatDate(r.last_updated)}</td>
                    <td>
                      <div className="customers-actions">
                        <HiOutlineEye
                          size={18}
                          className={`action-icon action-icon-view ${canView ? '' : 'action-icon-disabled'}`}
                          onClick={canView ? () => handleOpenProfile(r) : undefined}
                          aria-disabled={!canView}
                          title={canView ? 'View screened profile report' : 'Run screening before viewing report'}
                        />
                      </div>
                    </td>
                  </tr>
                  )})
                )}
                {!error && Array.from({ length: Math.max(0, PAGE_SIZE - pageRecords.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>
                    {Array.from({ length: totalColumns }).map((__, cellIdx) => (
                      <td key={cellIdx}>&nbsp;</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ecl-table-footer">
            <div className="table-footer-left">
              Showing {displayStart} to {displayEnd} of {totalRecords} results.
            </div>
            <div className="table-footer-right">
              {totalPages > 1 ? (
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                  >
                    Next
                  </button>
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

