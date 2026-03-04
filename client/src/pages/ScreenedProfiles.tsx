import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineSearch, HiOutlineX, HiOutlineArrowLeft } from 'react-icons/hi'
import './Customers.css'

type ScreenedProfileItem = {
  id: number
  customer_id: string
  customer_name: string
  email: string
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  screening_status: string
  source_database: string
  last_screened: string
}

type ScreenedProfilesResponse = {
  count: number
  results: ScreenedProfileItem[]
}

const PAGE_SIZE = 25
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

function formatDate(value: string): string {
  if (!value) return '-'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return value
  return dt.toLocaleDateString('en-US')
}

type ScreenedProfilesProps = {
  onBack?: () => void
}

export const ScreenedProfiles: React.FC<ScreenedProfilesProps> = ({ onBack }) => {
  const [records, setRecords] = useState<ScreenedProfileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const loadProfiles = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/screening/screened_profiles/`)
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
      }
      const payload = (await res.json()) as ScreenedProfilesResponse
      setRecords(Array.isArray(payload.results) ? payload.results : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load screened profiles')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfiles()
  }, [])

  const sourceOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.source_database))).sort(),
    [records]
  )

  const filteredRecords = useMemo(() => {
    const term = activeSearchTerm.toLowerCase()
    return records.filter((r) => {
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
      if (sourceFilter && r.source_database !== sourceFilter) return false
      return true
    })
  }, [records, activeSearchTerm, riskFilter, sourceFilter])

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

  return (
    <div className="reports-container screened-profiles-page">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">Screened Profiles</h1>
          <p className="customers-subtitle">Profiles that have completed screening, shown at a customer profile level.</p>
        </div>
        {onBack && (
          <div className="customers-header-actions">
            <button
              type="button"
              className="btn-secondary-action btn-with-icon"
              onClick={onBack}
            >
              <HiOutlineArrowLeft size={16} aria-hidden />
              <span>Back to screening queue</span>
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
                  <th>CUSTOMER ID</th>
                  <th>NAME</th>
                  <th>EMAIL</th>
                  <th>RISK LEVEL</th>
                  <th>SCREENING STATUS</th>
                  <th>SOURCE DB</th>
                  <th>LAST SCREENED</th>
                </tr>
              </thead>
              <tbody>
                {error ? (
                  <tr>
                    <td colSpan={7} className="muted">{error}</td>
                  </tr>
                ) : (
                  pageRecords.map((r) => (
                    <tr key={`${r.source_database}-${r.customer_id}`}>
                      <td className="customer-id">{r.customer_id}</td>
                      <td>{r.customer_name || '-'}</td>
                      <td className="muted">{r.email || '-'}</td>
                      <td>
                        <span className={`pill pill-${r.risk_level.toLowerCase()}`}>{r.risk_level}</span>
                      </td>
                      <td><span className="pill pill-kyc-verified">{r.screening_status}</span></td>
                      <td className="muted">{r.source_database}</td>
                      <td className="muted">{formatDate(r.last_screened)}</td>
                    </tr>
                  ))
                )}
                {!error && Array.from({ length: Math.max(0, PAGE_SIZE - pageRecords.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>
                    {Array.from({ length: 7 }).map((__, cellIdx) => (
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

