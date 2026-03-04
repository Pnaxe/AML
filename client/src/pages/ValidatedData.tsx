import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineArrowLeft, HiOutlineEye, HiOutlineX } from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import './Customers.css'

type FixType = 'AUTO' | 'MANUAL'
type RowStatus = 'Needs Fix' | 'Partially Fixed' | 'Fixed'

type CorrectionRow = {
  id: string
  dataset: string
  entity: string
  field: string
  currentValue: string
  suggestedValue: string
  fixType: FixType
  status: RowStatus
  detectedAt: string
  notes: string
}

type DatasetTable = {
  columns: string[]
  rows: Array<Record<string, string>>
}

type ValidatedDataProps = {
  selectedDataset?: string | null
}

type GenericRecord = Record<string, unknown>
type Paged<T> = { results?: T[] } | T[]

const PAGE_SIZE = 25
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

function rowsOf<T>(payload: Paged<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function stringValue(value: unknown): string {
  if (value == null) return ''
  return String(value)
}

function fmtDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return new Date().toLocaleString('en-US')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US')
}

function buildDatasetTables(
  transactions: GenericRecord[],
  customers: GenericRecord[],
  alerts: GenericRecord[],
): Record<string, DatasetTable> {
  return {
    'Transactions Database': {
      columns: ['transaction_id', 'amount', 'currency', 'status', 'transaction_date'],
      rows: transactions.slice(0, 25).map((row) => ({
        transaction_id: stringValue(row.transaction_id),
        amount: stringValue(row.amount),
        currency: stringValue(row.currency),
        status: stringValue(row.status),
        transaction_date: stringValue(row.transaction_date),
      })),
    },
    'Customer Profiles': {
      columns: ['customer_id', 'email', 'risk_level', 'kyc_verified'],
      rows: customers.slice(0, 25).map((row) => ({
        customer_id: stringValue(row.customer_id),
        email: stringValue(row.email),
        risk_level: stringValue(row.risk_level),
        kyc_verified: stringValue(row.kyc_verified),
      })),
    },
    'Alert Queue': {
      columns: ['alert_id', 'severity', 'status', 'triggered_at'],
      rows: alerts.slice(0, 25).map((row) => ({
        alert_id: stringValue(row.alert_id),
        severity: stringValue(row.severity),
        status: stringValue(row.status),
        triggered_at: stringValue(row.triggered_at),
      })),
    },
  }
}

function buildCorrectionRows(
  transactions: GenericRecord[],
  customers: GenericRecord[],
  alerts: GenericRecord[],
): CorrectionRow[] {
  const transactionRows = transactions.flatMap((row, index) => {
    const issues: CorrectionRow[] = []
    const transactionId = stringValue(row.transaction_id) || `TXN-ROW-${index + 1}`

    if (!stringValue(row.amount)) {
      issues.push({
        id: `ERR-TXN-${String(index + 1).padStart(4, '0')}`,
        dataset: 'Transactions Database',
        entity: transactionId,
        field: 'amount',
        currentValue: '',
        suggestedValue: '0.00',
        fixType: 'MANUAL',
        status: 'Needs Fix',
        detectedAt: fmtDate(row.transaction_date ?? row.created_at),
        notes: 'Missing amount value.',
      })
    }

    if (!stringValue(row.currency)) {
      issues.push({
        id: `ERR-TXN-CUR-${String(index + 1).padStart(4, '0')}`,
        dataset: 'Transactions Database',
        entity: transactionId,
        field: 'currency',
        currentValue: '',
        suggestedValue: 'USD',
        fixType: 'AUTO',
        status: 'Needs Fix',
        detectedAt: fmtDate(row.transaction_date ?? row.created_at),
        notes: 'Missing transaction currency.',
      })
    }

    return issues
  })

  const customerRows = customers.flatMap((row, index) => {
    const issues: CorrectionRow[] = []
    const customerId = stringValue(row.customer_id) || `CUST-ROW-${index + 1}`

    if (!stringValue(row.email)) {
      issues.push({
        id: `ERR-KYC-${String(index + 1).padStart(4, '0')}`,
        dataset: 'Customer Profiles',
        entity: customerId,
        field: 'email',
        currentValue: '',
        suggestedValue: 'pending@example.com',
        fixType: 'MANUAL',
        status: 'Needs Fix',
        detectedAt: fmtDate(row.updated_at ?? row.created_at),
        notes: 'Missing customer email.',
      })
    }

    if (!stringValue(row.risk_level)) {
      issues.push({
        id: `ERR-KYC-RISK-${String(index + 1).padStart(4, '0')}`,
        dataset: 'Customer Profiles',
        entity: customerId,
        field: 'risk_level',
        currentValue: '',
        suggestedValue: 'LOW',
        fixType: 'AUTO',
        status: 'Needs Fix',
        detectedAt: fmtDate(row.updated_at ?? row.created_at),
        notes: 'Missing risk level.',
      })
    }

    return issues
  })

  const alertRows = alerts.flatMap((row, index) => {
    const issues: CorrectionRow[] = []
    const alertId = stringValue(row.alert_id) || `ALT-ROW-${index + 1}`

    if (!stringValue(row.severity)) {
      issues.push({
        id: `ERR-ALT-${String(index + 1).padStart(4, '0')}`,
        dataset: 'Alert Queue',
        entity: alertId,
        field: 'severity',
        currentValue: '',
        suggestedValue: 'LOW',
        fixType: 'AUTO',
        status: 'Needs Fix',
        detectedAt: fmtDate(row.triggered_at ?? row.created_at),
        notes: 'Missing alert severity.',
      })
    }

    if (!stringValue(row.status)) {
      issues.push({
        id: `ERR-ALT-STS-${String(index + 1).padStart(4, '0')}`,
        dataset: 'Alert Queue',
        entity: alertId,
        field: 'status',
        currentValue: '',
        suggestedValue: 'OPEN',
        fixType: 'MANUAL',
        status: 'Needs Fix',
        detectedAt: fmtDate(row.triggered_at ?? row.created_at),
        notes: 'Missing alert status.',
      })
    }

    return issues
  })

  return [...transactionRows, ...customerRows, ...alertRows]
}

export const ValidatedData: React.FC<ValidatedDataProps> = ({ selectedDataset }) => {
  const { token } = useAuth()
  const [rows, setRows] = useState<CorrectionRow[]>([])
  const [datasetTables, setDatasetTables] = useState<Record<string, DatasetTable>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datasetFilter, setDatasetFilter] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewedErrorId, setViewedErrorId] = useState<string | null>(null)

  const authHeaders: Record<string, string> = {}
  if (token) authHeaders.Authorization = `Token ${token}`

  useEffect(() => {
    const loadCorrections = async () => {
      setLoading(true)
      setError(null)
      try {
        const [transactionsRes, customersRes, alertsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/transactions/`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/customers/`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/alerts/`, { headers: authHeaders }),
        ])

        if (!transactionsRes.ok || !customersRes.ok || !alertsRes.ok) {
          throw new Error('Failed to load correction datasets')
        }

        const [transactionsPayload, customersPayload, alertsPayload] = await Promise.all([
          transactionsRes.json(),
          customersRes.json(),
          alertsRes.json(),
        ])

        const transactions = rowsOf<GenericRecord>(transactionsPayload)
        const customers = rowsOf<GenericRecord>(customersPayload)
        const alerts = rowsOf<GenericRecord>(alertsPayload)

        setDatasetTables(buildDatasetTables(transactions, customers, alerts))
        setRows(buildCorrectionRows(transactions, customers, alerts))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load correction data')
        setDatasetTables({})
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    void loadCorrections()
  }, [])

  const datasets = useMemo(() => Array.from(new Set(rows.map((r) => r.dataset))), [rows])

  useEffect(() => {
    if (selectedDataset) {
      setDatasetFilter(selectedDataset)
      setCurrentPage(1)
    }
  }, [selectedDataset])

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (datasetFilter !== 'ALL' && row.dataset !== datasetFilter) return false
        const term = activeSearchTerm.toLowerCase()
        if (!term) return true
        return row.id.toLowerCase().includes(term) || row.entity.toLowerCase().includes(term) || row.field.toLowerCase().includes(term)
      }),
    [rows, datasetFilter, activeSearchTerm],
  )

  const total = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageRows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE)
  const displayStart = total === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageRows.length

  const viewedIssue = rows.find((r) => r.id === viewedErrorId) ?? null
  const viewedDatasetTable = viewedIssue ? datasetTables[viewedIssue.dataset] : null
  const canAutoFix = filteredRows.some((r) => r.fixType === 'AUTO' && r.status !== 'Fixed')

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setActiveSearchTerm(searchTerm.trim())
    setCurrentPage(1)
  }

  const clearSearch = () => {
    setSearchTerm('')
    setActiveSearchTerm('')
    setCurrentPage(1)
  }

  const autoFixByPredicate = (predicate: (row: CorrectionRow) => boolean) => {
    const rowsToFix = rows.filter((row) => predicate(row) && row.fixType === 'AUTO' && row.status !== 'Fixed')
    if (rowsToFix.length === 0) return

    setRows((prev) =>
      prev.map((row) =>
        predicate(row) && row.fixType === 'AUTO' && row.status !== 'Fixed'
          ? { ...row, currentValue: row.suggestedValue, status: 'Fixed', notes: `Auto-fixed: ${row.notes}` }
          : row,
      ),
    )

    setDatasetTables((prev) => {
      const next = { ...prev }
      rowsToFix.forEach((issue) => {
        const datasetTable = next[issue.dataset]
        if (!datasetTable) return
        next[issue.dataset] = {
          ...datasetTable,
          rows: datasetTable.rows.map((tableRow) => {
            const rowKey = Object.values(tableRow)[0]
            return rowKey === issue.entity ? { ...tableRow, [issue.field]: issue.suggestedValue } : tableRow
          }),
        }
      })
      return next
    })
  }

  const autoFixSmallErrors = () => {
    autoFixByPredicate((row) => datasetFilter === 'ALL' || row.dataset === datasetFilter)
  }

  const saveManualFixOnViewed = () => {
    if (!viewedIssue) return
    setRows((prev) =>
      prev.map((row) =>
        row.id === viewedIssue.id ? { ...row, status: 'Fixed', notes: `Manually fixed: ${row.notes}` } : row,
      ),
    )
  }

  const updateErrorCell = (rowIndex: number, col: string, value: string) => {
    if (!viewedIssue) return
    setDatasetTables((prev) => {
      const table = prev[viewedIssue.dataset]
      if (!table) return prev
      return {
        ...prev,
        [viewedIssue.dataset]: {
          ...table,
          rows: table.rows.map((row, idx) => (idx === rowIndex ? { ...row, [col]: value } : row)),
        },
      }
    })

    setRows((prev) =>
      prev.map((row) =>
        row.id === viewedIssue.id
          ? { ...row, currentValue: value, status: row.status === 'Fixed' ? 'Partially Fixed' : row.status }
          : row,
      ),
    )
  }

  const isErrorCell = (row: Record<string, string>, col: string): boolean => {
    if (!viewedIssue) return false
    if (col !== viewedIssue.field) return false
    const rowKey = Object.values(row)[0]
    return rowKey === viewedIssue.entity
  }

  if (viewedIssue && viewedDatasetTable) {
    const canAutoFixViewedDataset = rows.some((row) => row.dataset === viewedIssue.dataset && row.fixType === 'AUTO' && row.status !== 'Fixed')

    return (
      <div className="reports-container">
        <header className="customers-header">
          <div>
            <h1 className="customers-title">Data Correction</h1>
            <p className="customers-subtitle">Dataset-wide view with highlighted error cells.</p>
          </div>
          <div className="customers-header-actions">
            <button type="button" className="btn-secondary-action btn-with-icon" onClick={() => setViewedErrorId(null)}>
              <HiOutlineArrowLeft size={16} aria-hidden />
              <span>Back to Correction List</span>
            </button>
            <button type="button" className="btn-primary-action" onClick={() => autoFixByPredicate((row) => row.dataset === viewedIssue.dataset)} disabled={!canAutoFixViewedDataset}>
              Auto Fix Small Errors
            </button>
            <button type="button" className="btn-primary-action" onClick={saveManualFixOnViewed}>
              Mark as Fixed
            </button>
          </div>
        </header>

        <div className="customers-container">
          <div className="customers-filters-card report-filters">
            <div className="report-filters-left">
              <div className="filter-group"><span className="filter-label">Error ID:</span><span className="modal-value">{viewedIssue.id}</span></div>
              <div className="filter-group"><span className="filter-label">Dataset:</span><span className="modal-value">{viewedIssue.dataset}</span></div>
              <div className="filter-group"><span className="filter-label">Problem Field:</span><span className="modal-value">{viewedIssue.field}</span></div>
            </div>
          </div>

          <div className="customers-table-card-outer">
            <div className="report-content-container ecl-table-container">
              <table className="ecl-table">
                <thead>
                  <tr>
                    {viewedDatasetTable.columns.map((col) => (
                      <th key={col}>{col.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(PAGE_SIZE, viewedDatasetTable.rows.length) }).map((_, rowIdx) => {
                    const row = viewedDatasetTable.rows[rowIdx]
                    if (!row) {
                      return (
                        <tr key={`${viewedIssue.id}-empty-${rowIdx}`} aria-hidden>
                          {viewedDatasetTable.columns.map((col) => (
                            <td key={`${viewedIssue.id}-empty-${rowIdx}-col-${col}`}>&nbsp;</td>
                          ))}
                        </tr>
                      )
                    }
                    return (
                      <tr key={`${viewedIssue.id}-row-${rowIdx}`}>
                        {viewedDatasetTable.columns.map((col) => (
                          <td key={`${viewedIssue.id}-row-${rowIdx}-col-${col}`} className={isErrorCell(row, col) ? 'error-highlight-cell' : 'muted'}>
                            {isErrorCell(row, col) ? (
                              <input
                                type="text"
                                className="error-cell-input"
                                value={row[col] || ''}
                                onChange={(e) => updateErrorCell(rowIdx, col, e.target.value)}
                                aria-label={`Edit ${col}`}
                              />
                            ) : (
                              row[col] || '-'
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
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
          <h1 className="customers-title">Data Correction</h1>
          <p className="customers-subtitle">Review and correct live data-quality issues detected from the backend datasets.</p>
        </div>
        <div className="customers-header-actions">
          <button type="button" className="btn-primary-action" onClick={autoFixSmallErrors} disabled={!canAutoFix}>
            Auto Fix Small Errors
          </button>
        </div>
      </header>

      <div className="customers-container">
        <div className="customers-filters-card report-filters">
          <div className="report-filters-left">
            <div className="filter-group">
              <span className="filter-label">Dataset:</span>
              <select className="filter-input" value={datasetFilter} onChange={(e) => { setDatasetFilter(e.target.value); setCurrentPage(1) }}>
                <option value="ALL">All datasets</option>
                {datasets.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <form onSubmit={runSearch} className="filter-group filter-group-search">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  className="filter-input search-input"
                  placeholder="Search by error ID, entity, field..."
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
          </div>
        </div>

        {error && (
          <div className="customers-filters-card">
            <span className="muted">{error}</span>
          </div>
        )}

        <div className="customers-table-card-outer">
          <div className="report-content-container ecl-table-container table-loading-shell">
            {loading && (
              <div className="table-loading-overlay" aria-hidden="true">
                <div className="table-loading-spinner" />
              </div>
            )}
            <table className="ecl-table">
              <thead>
                <tr>
                  <th>ERROR ID</th>
                  <th>DATASET</th>
                  <th>ENTITY</th>
                  <th>FIELD</th>
                  <th>CURRENT VALUE</th>
                  <th>SUGGESTED VALUE</th>
                  <th>FIX TYPE</th>
                  <th>STATUS</th>
                  <th>DETECTED AT</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {!loading && pageRows.map((row) => (
                  <tr key={row.id}>
                    <td className="customer-id">{row.id}</td>
                    <td>
                      <button
                        type="button"
                        className="table-link-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDatasetFilter(row.dataset)
                          setCurrentPage(1)
                        }}
                      >
                        {row.dataset}
                      </button>
                    </td>
                    <td>{row.entity}</td>
                    <td>{row.field}</td>
                    <td className="muted">{row.currentValue || '-'}</td>
                    <td>{row.suggestedValue || '-'}</td>
                    <td className="muted">{row.fixType === 'AUTO' ? 'Auto' : 'Manual'}</td>
                    <td>
                      <span className={`pill ${row.status === 'Fixed' ? 'pill-kyc-verified' : row.status === 'Partially Fixed' ? 'pill-kyc-pending' : 'pill-kyc-failed'}`}>
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="muted">{row.detectedAt}</td>
                    <td>
                      <div className="customers-actions">
                        <HiOutlineEye size={18} className="action-icon action-icon-view" title="View full dataset with highlighted errors" onClick={() => setViewedErrorId(row.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, PAGE_SIZE - pageRows.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`} aria-hidden>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
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
              Showing {displayStart} to {displayEnd} of {total} results.
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