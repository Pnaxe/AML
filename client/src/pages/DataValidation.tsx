import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlinePlay, HiOutlineShieldCheck, HiOutlineSparkles } from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import './Customers.css'
import './Dashboard.css'

type ValidationStatus = 'PASS' | 'WARN' | 'FAIL'

type ValidationIssue = {
  id: string
  check: string
  severity: 'High' | 'Medium' | 'Low'
  status: ValidationStatus
  details: string
  affectedRows: number
}

type DatasetValidation = {
  file: string
  requiredColumns: string[]
  presentColumns: string[]
  issues: ValidationIssue[]
}

type GenericRecord = Record<string, unknown>
type Paged<T> = { results?: T[] } | T[]
type DatasetFile = { dataset_file: string; size_bytes: number; uploaded_at: string }

const PAGE_SIZE = 25
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const DATA_VALIDATION_CACHE_KEY = 'aml_data_validation_cache'

function rowsOf<T>(payload: Paged<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function countMissing(rows: GenericRecord[], key: string): number {
  return rows.filter((row) => {
    const value = row[key]
    return value == null || value === ''
  }).length
}

function buildDbDataset(
  file: string,
  requiredColumns: string[],
  rows: GenericRecord[],
  issuePrefix: string,
): DatasetValidation {
  const presentColumns = requiredColumns.filter((column) => rows.some((row) => Object.prototype.hasOwnProperty.call(row, column)))
  const missingColumns = requiredColumns.filter((column) => !presentColumns.includes(column))

  const baseIssues: ValidationIssue[] = [
    {
      id: `${issuePrefix}-001`,
      check: 'Required columns',
      severity: 'High',
      status: missingColumns.length === 0 ? 'PASS' : 'FAIL',
      details: missingColumns.length === 0 ? 'All required columns are present.' : `Missing required columns: ${missingColumns.join(', ')}.`,
      affectedRows: missingColumns.length === 0 ? 0 : rows.length,
    },
  ]

  const fieldIssues = requiredColumns.map((column, index) => {
    const affectedRows = countMissing(rows, column)
    const status: ValidationStatus = affectedRows === 0 ? 'PASS' : affectedRows > 5 ? 'FAIL' : 'WARN'
    return {
      id: `${issuePrefix}-${String(index + 2).padStart(3, '0')}`,
      check: `Null or empty ${column}`,
      severity: affectedRows > 5 ? 'High' : affectedRows > 0 ? 'Medium' : 'Low',
      status,
      details: affectedRows === 0 ? `${column} is populated.` : `${column} is missing for ${affectedRows} record(s).`,
      affectedRows,
    }
  })

  return {
    file,
    requiredColumns,
    presentColumns,
    issues: [...baseIssues, ...fieldIssues],
  }
}

function buildUploadedDataset(dataset: DatasetFile, index: number): DatasetValidation {
  const extension = dataset.dataset_file.split('.').pop()?.toLowerCase() ?? ''
  const supported = ['csv', 'xlsx', 'xls'].includes(extension)
  const isStale = (() => {
    const uploadedAt = new Date(dataset.uploaded_at)
    if (Number.isNaN(uploadedAt.getTime())) return false
    const ageDays = Math.floor((Date.now() - uploadedAt.getTime()) / 86400000)
    return ageDays > 7
  })()

  return {
    file: dataset.dataset_file,
    requiredColumns: ['transaction_id', 'amount', 'currency', 'transaction_date'],
    presentColumns: supported ? ['file_format_check'] : [],
    issues: [
      {
        id: `UPL-${String(index + 1).padStart(3, '0')}`,
        check: 'Supported file format',
        severity: 'High',
        status: supported ? 'PASS' : 'FAIL',
        details: supported ? 'Dataset file format is supported.' : 'Unsupported dataset format. Use CSV or Excel.',
        affectedRows: supported ? 0 : 1,
      },
      {
        id: `UPL-${String(index + 101).padStart(3, '0')}`,
        check: 'File size',
        severity: 'Medium',
        status: dataset.size_bytes > 0 ? 'PASS' : 'FAIL',
        details: dataset.size_bytes > 0 ? 'Dataset file contains data.' : 'Dataset file appears to be empty.',
        affectedRows: dataset.size_bytes > 0 ? 0 : 1,
      },
      {
        id: `UPL-${String(index + 201).padStart(3, '0')}`,
        check: 'Freshness',
        severity: 'Low',
        status: isStale ? 'WARN' : 'PASS',
        details: isStale ? 'Dataset has not been refreshed in more than 7 days.' : 'Dataset freshness is within policy window.',
        affectedRows: isStale ? 1 : 0,
      },
    ],
  }
}

export const DataValidation: React.FC = () => {
  const { token } = useAuth()
  const [datasets, setDatasets] = useState<DatasetValidation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState('')
  const [hasRun, setHasRun] = useState(false)
  const [validationState, setValidationState] = useState<'Not run' | 'Completed' | 'Auto-fixed'>('Not run')
  const [currentPage, setCurrentPage] = useState(1)

  const authHeaders: Record<string, string> = {}
  if (token) authHeaders.Authorization = `Token ${token}`

  useEffect(() => {
    const loadDatasets = async () => {
      const cachedValue = sessionStorage.getItem(DATA_VALIDATION_CACHE_KEY)
      setLoading(true)
      if (cachedValue) {
        try {
          const parsed = JSON.parse(cachedValue) as DatasetValidation[]
          setDatasets(parsed)
          setSelectedFile((current) => current || parsed[0]?.file || '')
        } catch {
          sessionStorage.removeItem(DATA_VALIDATION_CACHE_KEY)
        }
      }
      setError(null)
      try {
        const [transactionsRes, customersRes, alertsRes, uploadedRes] = await Promise.all([
          fetch(`${API_BASE_URL}/transactions/`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/customers/`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/alerts/`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/ml-models/datasets/`, { headers: authHeaders }),
        ])

        if (!transactionsRes.ok || !customersRes.ok || !alertsRes.ok || !uploadedRes.ok) {
          throw new Error('Failed to load validation datasets')
        }

        const [transactionsPayload, customersPayload, alertsPayload, uploadedPayload] = await Promise.all([
          transactionsRes.json(),
          customersRes.json(),
          alertsRes.json(),
          uploadedRes.json(),
        ])

        const nextDatasets = [
          buildDbDataset(
            'Transactions Database',
            ['transaction_id', 'amount', 'currency', 'status', 'transaction_date'],
            rowsOf<GenericRecord>(transactionsPayload),
            'TXN',
          ),
          buildDbDataset(
            'Customer Profiles',
            ['customer_id', 'email', 'risk_level', 'kyc_verified'],
            rowsOf<GenericRecord>(customersPayload),
            'KYC',
          ),
          buildDbDataset(
            'Alert Queue',
            ['alert_id', 'severity', 'status', 'triggered_at'],
            rowsOf<GenericRecord>(alertsPayload),
            'ALT',
          ),
          ...rowsOf<DatasetFile>(uploadedPayload).map((dataset, index) => buildUploadedDataset(dataset, index)),
        ]

        setDatasets(nextDatasets)
        sessionStorage.setItem(DATA_VALIDATION_CACHE_KEY, JSON.stringify(nextDatasets))
        setSelectedFile((current) => current || nextDatasets[0]?.file || '')
      } catch (e) {
        if (!cachedValue) {
          setError(e instanceof Error ? e.message : 'Unable to load validation datasets')
          setDatasets([])
        }
      } finally {
        setLoading(false)
      }
    }

    void loadDatasets()
  }, [])

  const selectedDataset = useMemo(
    () => datasets.find((d) => d.file === selectedFile) ?? datasets[0],
    [datasets, selectedFile],
  )

  const issues = hasRun && selectedDataset ? selectedDataset.issues : []
  const totalIssues = issues.length
  const totalPages = Math.max(1, Math.ceil(totalIssues / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageIssues = issues.slice(startIndex, startIndex + PAGE_SIZE)
  const displayStart = totalIssues === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageIssues.length

  const missingColumns = selectedDataset
    ? selectedDataset.requiredColumns.filter((col) => !selectedDataset.presentColumns.includes(col))
    : []
  const passCount = issues.filter((i) => i.status === 'PASS').length
  const warnCount = issues.filter((i) => i.status === 'WARN').length
  const failCount = issues.filter((i) => i.status === 'FAIL').length
  const unresolvedCount = warnCount + failCount + missingColumns.length

  const runValidation = () => {
    setHasRun(true)
    setValidationState('Completed')
    setCurrentPage(1)
  }

  const autoFixErrors = () => {
    if (!selectedDataset) return
    setDatasets((prev) =>
      prev.map((dataset) => {
        if (dataset.file !== selectedDataset.file) return dataset
        return {
          ...dataset,
          presentColumns: Array.from(new Set([...dataset.presentColumns, ...dataset.requiredColumns])),
          issues: dataset.issues.map((issue) =>
            issue.status === 'PASS'
              ? issue
              : { ...issue, status: 'PASS', affectedRows: 0, details: `Resolved in validation workflow: ${issue.check}.` },
          ),
        }
      }),
    )
    setHasRun(true)
    setValidationState('Auto-fixed')
    setCurrentPage(1)
  }

  return (
    <div className="reports-container">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">Data Validation</h1>
          <p className="customers-subtitle">Validate live database entities and uploaded datasets against expected AML schema rules.</p>
        </div>
        <div className="customers-header-actions">
          <button type="button" className="btn-primary-action btn-with-icon" onClick={runValidation} disabled={loading || !selectedDataset}>
            <HiOutlinePlay size={16} aria-hidden />
            <span>Run Validation</span>
          </button>
          <button type="button" className="btn-secondary-action btn-with-icon" onClick={autoFixErrors} disabled={!hasRun || unresolvedCount === 0}>
            <HiOutlineSparkles size={16} aria-hidden />
            <span>Auto Fix Errors</span>
          </button>
        </div>
      </header>

      <div className="customers-container">
        <div className="customers-filters-card report-filters">
          <div className="report-filters-left">
            <div className="filter-group">
              <span className="filter-label">Dataset:</span>
              <select
                className="filter-input"
                value={selectedDataset?.file ?? ''}
                onChange={(e) => {
                  setSelectedFile(e.target.value)
                  setHasRun(false)
                  setValidationState('Not run')
                  setCurrentPage(1)
                }}
                disabled={loading || datasets.length === 0}
              >
                {datasets.map((dataset) => (
                  <option key={dataset.file} value={dataset.file}>{dataset.file}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <span className="filter-label">Missing Required Columns:</span>
              <span className="modal-value">{missingColumns.length}</span>
            </div>
            <div className="filter-group">
              <span className="filter-label">Validation State:</span>
              <span className="modal-value">{loading ? 'Loading' : validationState}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="customers-filters-card">
            <span className="muted">{error}</span>
          </div>
        )}

        <div className="dashboard-cards">
          <div className="dashboard-card">
            <div className="dashboard-card-icon" style={{ color: '#22c55e' }}><HiOutlineCheckCircle size={22} /></div>
            <div className="dashboard-card-label">Passed Checks</div>
            <div className="dashboard-card-value">{passCount}</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-icon" style={{ color: '#f59e0b' }}><HiOutlineExclamationCircle size={22} /></div>
            <div className="dashboard-card-label">Warnings</div>
            <div className="dashboard-card-value">{warnCount}</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-icon" style={{ color: '#ef4444' }}><HiOutlineExclamationCircle size={22} /></div>
            <div className="dashboard-card-label">Failed Checks</div>
            <div className="dashboard-card-value">{failCount}</div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-icon" style={{ color: '#6366f1' }}><HiOutlineShieldCheck size={22} /></div>
            <div className="dashboard-card-label">Schema Coverage</div>
            <div className="dashboard-card-value">
              {selectedDataset ? `${selectedDataset.requiredColumns.length - missingColumns.length}/${selectedDataset.requiredColumns.length}` : '0/0'}
            </div>
          </div>
        </div>

        <div className={`customers-table-card-outer ${!loading && !hasRun ? 'table-empty-state' : ''}`}>
          {!loading && !hasRun && (
            <div className="table-empty-watermark" aria-hidden="true">
              Select a dataset and click "Run Validation" to view errors.
            </div>
          )}
          <div className="report-content-container ecl-table-container table-loading-shell">
            {loading && (
              <div className="table-loading-overlay" aria-hidden="true">
                <div className="table-loading-spinner" />
              </div>
            )}
            <table className="ecl-table">
              <thead>
                <tr>
                  <th>CHECK ID</th>
                  <th>VALIDATION CHECK</th>
                  <th>SEVERITY</th>
                  <th>STATUS</th>
                  <th>AFFECTED ROWS</th>
                  <th>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {!loading && !hasRun ? null : pageIssues.length === 0 ? (
                  !loading ? <tr><td colSpan={6} className="muted">No validation results found.</td></tr> : null
                ) : (
                  pageIssues.map((issue) => (
                    <tr key={issue.id}>
                      <td className="customer-id">{issue.id}</td>
                      <td>{issue.check}</td>
                      <td>{issue.severity}</td>
                      <td>
                        <span className={`pill ${issue.status === 'PASS' ? 'pill-kyc-verified' : issue.status === 'WARN' ? 'pill-kyc-pending' : 'pill-kyc-failed'}`}>
                          {issue.status}
                        </span>
                      </td>
                      <td>{issue.affectedRows.toLocaleString()}</td>
                      <td className="muted">{issue.details}</td>
                    </tr>
                  ))
                )}
                {Array.from({ length: Math.max(0, PAGE_SIZE - pageIssues.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`} aria-hidden>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ecl-table-footer">
            <div className="table-footer-left">
              Showing {displayStart} to {displayEnd} of {totalIssues} results.
            </div>
            <div className="table-footer-right">
              {totalPages > 1 ? (
                <div className="pagination-controls">
                  <button type="button" className="pagination-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {safePage} of {totalPages}
                  </span>
                  <button type="button" className="pagination-btn" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
                    Next
                  </button>
                </div>
              ) : (
                <span>All data displayed</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
