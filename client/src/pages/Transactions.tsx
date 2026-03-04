import React, { useEffect, useMemo, useState } from 'react'
import {
  HiOutlineSearch,
  HiOutlineX,
  HiOutlineUpload,
  HiOutlineRefresh,
  HiOutlineShieldExclamation,
} from 'react-icons/hi'
import './Customers.css'

type CustomerOption = { id: number; customer_id: string; first_name: string; last_name: string; company_name: string }

type TransactionRow = {
  id: number | string
  transaction_id: string
  transaction_type: string
  amount: string
  currency: string
  sender_name?: string
  receiver_name?: string
  status: string
  risk_score: number
  is_suspicious: boolean
  transaction_date: string
}

type TransactionResponse = { count?: number; results?: TransactionRow[] } | TransactionRow[]

type SourceConfig = {
  id?: number
  name: string
  source_type: 'CORE_BANKING' | 'API' | 'FILE' | 'MANUAL'
  base_url: string
  auth_type: 'NONE' | 'API_KEY' | 'BASIC' | 'BEARER'
  api_key: string
  is_active: boolean
  auto_monitor: boolean
  poll_interval_seconds: number
  notes: string
}

type SourceResponse = { count?: number; results?: SourceConfig[] } | SourceConfig[]
type StreamTransactionPayload = {
  id: string
  reference?: string
  account_number?: string
  customer_name?: string
  merchant_name?: string
  amount: string
  currency: string
  direction: 'DR' | 'CR'
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  workflow_status?: string
  created_at?: string | null
  transaction_id?: string
  transaction_type?: string
  sender_name?: string
  receiver_name?: string
  risk_score?: number
  is_suspicious?: boolean
}

const PAGE_SIZE = 25
const REALTIME_POLL_INTERVAL_MS = 3000
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? 'ws://localhost:8000'
const ENABLE_TRANSACTIONS_WS = import.meta.env.VITE_ENABLE_TRANSACTIONS_WS === 'true'
const SHOULD_USE_TRANSACTIONS_WS = !import.meta.env.DEV && ENABLE_TRANSACTIONS_WS
const EXECUTED_BATCHES_STORAGE_KEY = 'aml_transactions_executed_batches'
const ACTIVE_BATCH_STORAGE_KEY = 'aml_transactions_active_batch'

type TransactionsVariant = 'realtime' | 'upload' | 'upload-data'

type TransactionsProps = {
  variant?: TransactionsVariant
}

function resultsOf<T>(payload: { results?: T[] } | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function fmtDate(v: string): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-US')
}

function sortTransactionsNewestFirst(rows: TransactionRow[]): TransactionRow[] {
  return [...rows].sort((left, right) => {
    const leftTime = new Date(left.transaction_date).getTime()
    const rightTime = new Date(right.transaction_date).getTime()
    return rightTime - leftTime
  })
}

function isRealtimeLiveRow(row: TransactionRow): boolean {
  return !row.transaction_id.startsWith('TXN-IMPORT-')
}

function buildRealtimeDisplayRows(rows: TransactionRow[]): TransactionRow[] {
  const preferredRows = rows.filter((row) => isRealtimeLiveRow(row))
  const sourceRows = preferredRows.length > 0 ? preferredRows : rows
  return sortTransactionsNewestFirst(sourceRows)
}

function statusPillClass(status: string): string {
  if (status === 'BLOCKED' || status === 'FAILED') return 'pill-high'
  if (status === 'FLAGGED' || status === 'UNDER_REVIEW' || status === 'PENDING') return 'pill-medium'
  if (status === 'COMPLETED' || status === 'CLEARED') return 'pill-low'
  return 'pill-medium'
}

function mergeRealtimeRows(existingRows: TransactionRow[], incomingRow: TransactionRow): TransactionRow[] {
  const nextRows = [incomingRow, ...existingRows.filter((row) => row.transaction_id !== incomingRow.transaction_id)]
  return nextRows.slice(0, 250)
}

function mapStreamTransaction(payload: StreamTransactionPayload): TransactionRow {
  const workflowStatus = payload.workflow_status ?? ''
  const isSuspicious = Boolean(payload.is_suspicious)
  const normalizedStatus =
    workflowStatus ||
    (payload.status === 'SUCCESS'
      ? 'COMPLETED'
      : payload.status === 'FAILED'
        ? 'FAILED'
        : 'PENDING')

  return {
    id: payload.id,
    transaction_id: payload.transaction_id ?? payload.reference ?? `STREAM-${payload.id}`,
    transaction_type: payload.transaction_type ?? (payload.direction === 'DR' ? 'TRANSFER' : 'DEPOSIT'),
    amount: payload.amount,
    currency: payload.currency,
    sender_name: payload.sender_name ?? payload.customer_name ?? '',
    receiver_name: payload.receiver_name ?? payload.merchant_name ?? '',
    status: normalizedStatus,
    risk_score: typeof payload.risk_score === 'number' ? payload.risk_score : 0,
    is_suspicious: isSuspicious,
    transaction_date: payload.created_at ?? new Date().toISOString(),
  }
}

export const Transactions: React.FC<TransactionsProps> = ({ variant = 'realtime' }) => {
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedReviewRow, setSelectedReviewRow] = useState<TransactionRow | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const [showSourceModal, setShowSourceModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showExecuteModal, setShowExecuteModal] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [executedBatchId, setExecutedBatchId] = useState<string | null>(null)
  const [executedBatchIds, setExecutedBatchIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = window.localStorage.getItem(EXECUTED_BATCHES_STORAGE_KEY)
      const parsed = stored ? JSON.parse(stored) : []
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
    } catch {
      return []
    }
  })
  const [activeExecutedBatchId, setActiveExecutedBatchId] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(ACTIVE_BATCH_STORAGE_KEY) ?? ''
  })

  const [sources, setSources] = useState<SourceConfig[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [sourceForm, setSourceForm] = useState<SourceConfig>({
    name: '',
    source_type: 'CORE_BANKING',
    base_url: '',
    auth_type: 'API_KEY',
    api_key: '',
    is_active: true,
    auto_monitor: true,
    poll_interval_seconds: 60,
    notes: '',
  })

  const [bulkCount, setBulkCount] = useState(200)
  const [bulkFile, setBulkFile] = useState<File | null>(null)

  const [txForm, setTxForm] = useState({
    transaction_id: `TX-${Date.now()}`,
    transaction_type: 'TRANSFER',
    amount: '',
    currency: 'USD',
    sender: '',
    receiver: '',
    status: 'PENDING',
    transaction_date: new Date().toISOString().slice(0, 16),
    description: '',
  })
  const isBatchView = variant !== 'realtime'
  const isUploadDataView = variant === 'upload-data'
  const pageTitle = isUploadDataView ? 'Upload Data' : isBatchView ? 'Batch Monitoring' : 'Real Time Monitoring'
  const pageSubtitle = isUploadDataView
    ? 'Upload transaction data files and monitor the processing status of each batch.'
    : isBatchView
      ? 'Monitor file-based transaction ingestion batches and review imported records.'
      : 'Monitor incoming transactions and investigate risk signals in real time.'

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const requests: Promise<Response>[] = [
        fetch(`${API_BASE_URL}/transactions/sources/`),
        fetch(`${API_BASE_URL}/customers/`),
      ]

      requests.unshift(fetch(`${API_BASE_URL}/transactions/`))

      const responses = await Promise.all(requests)
      if (responses.some((response) => !response.ok)) throw new Error('Failed to load transactions data')

      const [txRes, srcRes, custRes] = responses
      const txPayload = (await txRes.json()) as TransactionResponse
      const srcPayload = (await srcRes.json()) as SourceResponse
      const custPayload = await custRes.json()

      const nextRows = resultsOf(txPayload)
      const normalizedRows =
        variant === 'realtime'
          ? buildRealtimeDisplayRows(nextRows)
          : nextRows

      setRows(normalizedRows)
      setSources(resultsOf(srcPayload))
      setCustomers(resultsOf(custPayload))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load transactions')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [variant])

  useEffect(() => {
    if (variant !== 'realtime') return
    const timer = window.setInterval(() => {
      void loadData()
    }, REALTIME_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [variant])

  useEffect(() => {
    if (variant !== 'realtime' || !SHOULD_USE_TRANSACTIONS_WS) return

    let socket: WebSocket | null = null
    let isDisposed = false
    const connectTimer = window.setTimeout(() => {
      if (isDisposed) return

      socket = new WebSocket(`${WS_BASE_URL.replace(/\/$/, '')}/ws/transactions/`)

      socket.onmessage = (event) => {
        try {
        const payload = JSON.parse(event.data) as StreamTransactionPayload
        const nextRow = mapStreamTransaction(payload)
        setRows((prev) => {
          const hasPreferredRows = prev.some((row) => isRealtimeLiveRow(row))
          if (hasPreferredRows && !isRealtimeLiveRow(nextRow)) {
            return prev
          }
          return mergeRealtimeRows(prev, nextRow)
        })
        setError(null)
      } catch {
          // Ignore malformed websocket payloads and keep the current table state.
        }
      }
    }, 0)

    return () => {
      isDisposed = true
      window.clearTimeout(connectTimer)
      if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close()
      }
    }
  }, [variant])

  const filtered = useMemo(() => {
    const term = activeSearchTerm.toLowerCase()
    return rows.filter((r) => {
      if (term) {
        const joined = [r.transaction_id, r.sender_name, r.receiver_name].join(' ').toLowerCase()
        if (!joined.includes(term)) return false
      }
      if (statusFilter && r.status !== statusFilter) return false
      if (typeFilter && r.transaction_type !== typeFilter) return false
      if (dateFilter && new Date(r.transaction_date).toISOString().slice(0, 10) !== dateFilter) return false
      return true
    })
  }, [rows, activeSearchTerm, statusFilter, typeFilter, dateFilter])

  const totalRecords = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageRows = filtered.slice(startIndex, startIndex + PAGE_SIZE)
  const displayStart = totalRecords === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageRows.length
  const suspiciousCount = useMemo(() => rows.filter((r) => r.is_suspicious).length, [rows])
  const fileSourcesCount = useMemo(() => sources.filter((s) => s.source_type === 'FILE').length, [sources])
  const completedCount = useMemo(() => rows.filter((r) => r.status === 'COMPLETED').length, [rows])
  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'PENDING').length, [rows])
  const batchGroups = useMemo(() => {
    const groups = new Map<string, TransactionRow[]>()
    rows.forEach((row, index) => {
      const batchNumber = String(Math.floor(index / 10) + 1).padStart(3, '0')
      const batchId = `BATCH-${batchNumber}`
      const current = groups.get(batchId) ?? []
      current.push(row)
      groups.set(batchId, current)
    })
    return groups
  }, [rows])
  const batchOptions = useMemo(() => Array.from(batchGroups.keys()), [batchGroups])
  const displayedBatchId = activeExecutedBatchId || executedBatchId || ''
  const executedBatchRows = displayedBatchId ? batchGroups.get(displayedBatchId) ?? [] : []
  const batchAlerts = useMemo(
    () => executedBatchRows.filter((row) => row.is_suspicious || row.status === 'FLAGGED' || row.status === 'BLOCKED'),
    [executedBatchRows],
  )
  const latestBatchId = batchOptions.length > 0 ? batchOptions[batchOptions.length - 1] : ''

  useEffect(() => {
    if (variant !== 'upload') return
    if (!selectedBatchId && latestBatchId) {
      setSelectedBatchId(latestBatchId)
    }
    if (batchOptions.length === 0) {
      setSelectedBatchId('')
      setExecutedBatchId(null)
      setExecutedBatchIds([])
      setActiveExecutedBatchId('')
      return
    }
    setExecutedBatchIds((prev) => prev.filter((batchId) => batchOptions.includes(batchId)))
    setActiveExecutedBatchId((prev) => (prev && batchOptions.includes(prev) ? prev : ''))
  }, [variant, batchOptions, selectedBatchId, latestBatchId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(EXECUTED_BATCHES_STORAGE_KEY, JSON.stringify(executedBatchIds))
  }, [executedBatchIds])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (activeExecutedBatchId) {
      window.localStorage.setItem(ACTIVE_BATCH_STORAGE_KEY, activeExecutedBatchId)
    } else {
      window.localStorage.removeItem(ACTIVE_BATCH_STORAGE_KEY)
    }
  }, [activeExecutedBatchId])

  const handleSaveSource = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/transactions/sources/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sourceForm),
      })
      if (!res.ok) throw new Error('Failed to save source config')
      setShowSourceModal(false)
      setSourceForm({
        name: '',
        source_type: 'CORE_BANKING',
        base_url: '',
        auth_type: 'API_KEY',
        api_key: '',
        is_active: true,
        auto_monitor: true,
        poll_interval_seconds: 60,
        notes: '',
      })
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save source')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkImport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/transactions/bulk_import/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: bulkCount }),
      })
      if (!res.ok) throw new Error('Failed bulk import')
      setShowBulkModal(false)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to bulk import')
    } finally {
      setLoading(false)
    }
  }

  const handleFileImport = async () => {
    if (!bulkFile) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', bulkFile)
      const res = await fetch(`${API_BASE_URL}/transactions/import_excel/`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Failed Excel import')
      setShowBulkModal(false)
      setBulkFile(null)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to import file')
    } finally {
      setLoading(false)
    }
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = {
        ...txForm,
        amount: Number(txForm.amount),
        sender: Number(txForm.sender),
        receiver: txForm.receiver ? Number(txForm.receiver) : null,
        transaction_date: new Date(txForm.transaction_date).toISOString(),
      }
      const res = await fetch(`${API_BASE_URL}/transactions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to create transaction')
      setShowAddModal(false)
      setTxForm({
        transaction_id: `TX-${Date.now()}`,
        transaction_type: 'TRANSFER',
        amount: '',
        currency: 'USD',
        sender: '',
        receiver: '',
        status: 'PENDING',
        transaction_date: new Date().toISOString().slice(0, 16),
        description: '',
      })
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create transaction')
    } finally {
      setLoading(false)
    }
  }

  const handleExecuteBatch = () => {
    if (!selectedBatchId) return
    setExecutedBatchId(selectedBatchId)
    setActiveExecutedBatchId(selectedBatchId)
    setExecutedBatchIds((prev) => (prev.includes(selectedBatchId) ? prev : [...prev, selectedBatchId]))
    setShowExecuteModal(false)
  }

  const openExecuteBatchModal = () => {
    if (latestBatchId) {
      setSelectedBatchId(latestBatchId)
    }
    setShowExecuteModal(true)
  }

  return (
    <div className="reports-container">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">{pageTitle}</h1>
          <p className="customers-subtitle">{pageSubtitle}</p>
        </div>
        <div className="customers-header-actions">
          {variant === 'upload' ? (
            <button type="button" className="btn-primary-action btn-with-icon" onClick={openExecuteBatchModal}>
              <HiOutlineRefresh size={16} aria-hidden />
              <span>Execute Batch</span>
            </button>
          ) : isUploadDataView ? (
            <button type="button" className="btn-import-action btn-with-icon" onClick={() => setShowBulkModal(true)}>
              <HiOutlineUpload size={16} aria-hidden />
              <span>Upload Data</span>
            </button>
          ) : null}
        </div>
      </header>

      <div className="customers-container">
        {isUploadDataView ? (
          <>
            <div className="customers-filters-card report-filters">
              <div className="bulk-import-card">
                <div className="bulk-import-body">
                  <div>
                    <h3 className="bulk-import-title">Upload Workspace</h3>
                    <p className="bulk-import-text">
                      Upload transaction files from source systems, then monitor each batch as it moves through ingestion,
                      validation, and AML review.
                    </p>
                  </div>
                  <div className="bulk-import-layout">
                    <div className="bulk-import-upload">
                      <div className="bulk-import-dropzone">
                        <div className="bulk-import-icon-circle">
                          <HiOutlineUpload size={20} aria-hidden />
                        </div>
                        <p className="bulk-import-drop-main">Drop an Excel file here or start a new upload</p>
                        <p className="bulk-import-drop-sub">Supported formats: `.xlsx` and `.xls`</p>
                        <button type="button" className="btn-primary-action btn-with-icon" onClick={() => setShowBulkModal(true)}>
                          <HiOutlineUpload size={16} aria-hidden />
                          <span>Start Upload</span>
                        </button>
                      </div>
                    </div>
                    <div className="bulk-import-sidebar">
                      <h4 className="bulk-import-sidebar-title">Batch Snapshot</h4>
                      <div className="view-profile-grid">
                        <div className="view-profile-field">
                          <span className="view-profile-label">Uploaded records</span>
                          <span className="view-profile-value">{rows.length}</span>
                        </div>
                        <div className="view-profile-field">
                          <span className="view-profile-label">Pending ingestion</span>
                          <span className="view-profile-value">{pendingCount}</span>
                        </div>
                        <div className="view-profile-field">
                          <span className="view-profile-label">Flagged records</span>
                          <span className="view-profile-value">{suspiciousCount}</span>
                        </div>
                        <div className="view-profile-field">
                          <span className="view-profile-label">File sources</span>
                          <span className="view-profile-value">{fileSourcesCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="customers-filters-card report-filters">
              <div className="bulk-import-card">
                <div className="view-profile-grid">
                  <div className="view-profile-field">
                    <span className="view-profile-label">Completed imports</span>
                    <span className="view-profile-value">{completedCount}</span>
                  </div>
                  <div className="view-profile-field">
                    <span className="view-profile-label">Upload status</span>
                    <span className="view-profile-value">{loading ? 'Processing' : 'Ready'}</span>
                  </div>
                  <div className="view-profile-field view-profile-field-full">
                    <span className="view-profile-label">Upload monitoring workflow</span>
                    <span className="view-profile-value view-profile-value-block">
                      Upload source transaction files, monitor batch creation, and review ingested records below as soon as processing completes.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : isBatchView ? (
          <>
            <div className="customers-filters-card report-filters">
              <div className="report-filters-left">
                <div className="filter-group">
                  <span className="filter-label">Executed Batch:</span>
                  <select
                    className="filter-input"
                    value={activeExecutedBatchId}
                    onChange={(e) => setActiveExecutedBatchId(e.target.value)}
                    disabled={executedBatchIds.length === 0}
                  >
                    {executedBatchIds.length === 0 ? (
                      <option value="">No executed batches</option>
                    ) : (
                      executedBatchIds.map((batchId) => (
                        <option key={batchId} value={batchId}>{batchId}</option>
                      ))
                    )}
                  </select>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Alerted Accounts:</span>
                  <span className="modal-value">{batchAlerts.length}</span>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Completed Imports:</span>
                  <span className="modal-value">{completedCount}</span>
                </div>
                <div className="filter-group">
                  <span className="filter-label">Status:</span>
                  <span className="modal-value">{displayedBatchId ? `Executed ${displayedBatchId}` : 'Waiting for execution'}</span>
                </div>
              </div>
            </div>

            <div className={`customers-table-card-outer ${!displayedBatchId ? 'batch-alerts-empty' : ''}`}>
              {!displayedBatchId && (
                <div className="batch-alerts-watermark" aria-hidden="true">
                  <HiOutlineShieldExclamation size={42} />
                  <span>No Executed Batch</span>
                </div>
              )}
              <div className="report-content-container ecl-table-container">
                <table className="ecl-table">
                  <thead>
                    <tr>
                      <th>ALERT ID</th>
                      <th>BATCH NUMBER</th>
                      <th>ALERTED ACCOUNT</th>
                      <th>STATUS</th>
                      <th>RISK SCORE</th>
                      <th>ALERT REASON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedBatchId && batchAlerts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="muted">No alerts were generated for {displayedBatchId}.</td>
                      </tr>
                    ) : (
                      batchAlerts.map((row, index) => (
                        <tr key={`${displayedBatchId}-${row.id}`}>
                          <td className="customer-id">ALT-{String(index + 1).padStart(3, '0')}</td>
                          <td>{displayedBatchId}</td>
                          <td>{row.sender_name || row.receiver_name || row.transaction_id}</td>
                          <td>
                            <span className={`pill ${statusPillClass(row.status)}`}>{row.status}</span>
                          </td>
                          <td className="muted">{(row.risk_score * 100).toFixed(1)}%</td>
                          <td>{row.is_suspicious ? 'Suspicious pattern detected' : 'Manual review required'}</td>
                        </tr>
                      ))
                    )}
                    {Array.from({
                      length: displayedBatchId
                        ? batchAlerts.length > 0
                          ? Math.max(0, PAGE_SIZE - batchAlerts.length)
                          : Math.max(0, PAGE_SIZE - 1)
                        : PAGE_SIZE,
                    }).map((_, idx) => (
                      <tr key={`alert-empty-${idx}`}>
                        {Array.from({ length: 6 }).map((__, cellIdx) => <td key={cellIdx}>&nbsp;</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ecl-table-footer">
                <div className="table-footer-left">
                  {displayedBatchId ? `Showing alerts for ${displayedBatchId}.` : 'No batch executed yet.'}
                </div>
                <div className="table-footer-right">
                  <span>{displayedBatchId ? `${batchAlerts.length} alert(s)` : 'Awaiting batch execution'}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
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
                    placeholder="Search by transaction ID or customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button type="button" className="search-clear-btn" onClick={() => { setSearchTerm(''); setActiveSearchTerm('') }}>
                      <HiOutlineX size={18} />
                    </button>
                  )}
                </div>
              </form>

              <div className="filter-group">
                <span className="filter-label">Status:</span>
                <select className="filter-input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}>
                  <option value="">All</option>
                  <option value="PENDING">PENDING</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="FLAGGED">FLAGGED</option>
                  <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                  <option value="CLEARED">CLEARED</option>
                  <option value="BLOCKED">BLOCKED</option>
                </select>
              </div>

              <div className="filter-group">
                <span className="filter-label">Type:</span>
                <select className="filter-input" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1) }}>
                  <option value="">All</option>
                  <option value="TRANSFER">TRANSFER</option>
                  <option value="DEPOSIT">DEPOSIT</option>
                  <option value="WITHDRAWAL">WITHDRAWAL</option>
                  <option value="WIRE">WIRE</option>
                  <option value="PAYMENT">PAYMENT</option>
                  <option value="CARD">CARD</option>
                  <option value="CRYPTO">CRYPTO</option>
                </select>
              </div>

              <div className="filter-group">
                <span className="filter-label">Date:</span>
                <input type="date" className="filter-input" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1) }} />
              </div>

              <div className="filter-group">
                <span className="filter-label">Sources:</span>
                <span className="modal-value">{sources.length}</span>
              </div>
            </div>
          </div>
        )}

        {variant !== 'upload' && (
          <div className={`customers-table-card-outer ${!error && pageRows.length === 0 ? 'table-empty-state' : ''}`}>
            {!error && pageRows.length === 0 && (
              <div className="table-empty-watermark" aria-hidden="true">
                <HiOutlineShieldExclamation size={42} />
                <span>No Transactions</span>
              </div>
            )}
            <div className="report-content-container ecl-table-container">
              <table className="ecl-table">
                  <thead>
                    <tr>
                      <th>{isUploadDataView ? 'RECORD ID' : 'TRANSACTION ID'}</th>
                      <th>{isBatchView ? 'BATCH TYPE' : 'TYPE'}</th>
                    <th>AMOUNT</th>
                    <th>{isBatchView ? 'ORIGINATOR' : 'SENDER'}</th>
                    <th>{isBatchView ? 'BENEFICIARY' : 'RECEIVER'}</th>
                      <th>{isBatchView ? 'IMPORT STATUS' : 'STATUS'}</th>
                      <th>{isBatchView ? 'RISK RESULT' : 'RISK SCORE'}</th>
                      <th>{isBatchView ? 'INGESTED DATE' : 'DATE'}</th>
                      {!isBatchView && <th>ACTION</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {error ? (
                      <tr><td colSpan={isBatchView ? 8 : 9} className="muted">{error}</td></tr>
                    ) : (
                      pageRows.map((r) => (
                      <tr key={r.id}>
                        <td className="customer-id">{r.transaction_id}</td>
                        <td>{r.transaction_type}</td>
                        <td>{r.currency} {Number(r.amount).toLocaleString()}</td>
                        <td>{r.sender_name || '-'}</td>
                        <td>{r.receiver_name || '-'}</td>
                        <td>
                          <span className={`pill ${statusPillClass(r.status)}`}>{r.status}</span>
                        </td>
                        <td className="muted">{(r.risk_score * 100).toFixed(1)}%</td>
                        <td className="muted">{fmtDate(r.transaction_date)}</td>
                        {!isBatchView && (
                          <td>
                            <button
                              type="button"
                              className="table-link-button"
                              onClick={() => setSelectedReviewRow(r)}
                            >
                              Review
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                  {!error && Array.from({ length: Math.max(0, PAGE_SIZE - pageRows.length) }).map((_, idx) => (
                    <tr key={`empty-${idx}`}>
                      {Array.from({ length: isBatchView ? 8 : 9 }).map((__, c) => <td key={c}>&nbsp;</td>)}
                    </tr>
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
        )}
      </div>

      {showSourceModal && (
        <div className="modal-backdrop" onClick={() => setShowSourceModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Configure Transaction Source</h2></div>
            <form className="modal-form" onSubmit={handleSaveSource}>
              <div className="modal-body">
                <div className="modal-two-column">
                  <div className="modal-field"><label className="modal-label">Name</label><input className="modal-input" value={sourceForm.name} onChange={(e) => setSourceForm((p) => ({ ...p, name: e.target.value }))} required /></div>
                  <div className="modal-field"><label className="modal-label">Source Type</label><select className="modal-input" value={sourceForm.source_type} onChange={(e) => setSourceForm((p) => ({ ...p, source_type: e.target.value as SourceConfig['source_type'] }))}><option value="CORE_BANKING">CORE_BANKING</option><option value="API">API</option><option value="FILE">FILE</option><option value="MANUAL">MANUAL</option></select></div>
                </div>
                <div className="modal-field"><label className="modal-label">Base URL</label><input className="modal-input" value={sourceForm.base_url} onChange={(e) => setSourceForm((p) => ({ ...p, base_url: e.target.value }))} placeholder="https://corebank/api/v1" /></div>
                <div className="modal-two-column">
                  <div className="modal-field"><label className="modal-label">Auth Type</label><select className="modal-input" value={sourceForm.auth_type} onChange={(e) => setSourceForm((p) => ({ ...p, auth_type: e.target.value as SourceConfig['auth_type'] }))}><option value="NONE">NONE</option><option value="API_KEY">API_KEY</option><option value="BASIC">BASIC</option><option value="BEARER">BEARER</option></select></div>
                  <div className="modal-field"><label className="modal-label">API Key / Token</label><input className="modal-input" value={sourceForm.api_key} onChange={(e) => setSourceForm((p) => ({ ...p, api_key: e.target.value }))} /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowSourceModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-action">Save Source</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="modal-backdrop" onClick={() => setShowBulkModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Bulk Import Transactions</h2></div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label">Generate sample count</label>
                  <input type="number" min={1} className="modal-input" value={bulkCount} onChange={(e) => setBulkCount(Number(e.target.value || 1))} />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Or upload Excel (.xlsx/.xls)</label>
                  <input type="file" className="modal-input" accept=".xlsx,.xls" onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowBulkModal(false)}>Cancel</button>
                <button type="button" className="btn-secondary-action" onClick={() => void handleBulkImport()}>Import Sample</button>
                <button type="button" className="btn-primary-action" onClick={() => void handleFileImport()} disabled={!bulkFile}>Upload File</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExecuteModal && variant === 'upload' && (
        <div className="modal-backdrop" onClick={() => setShowExecuteModal(false)}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Execute Batch</h2>
              <button className="modal-close-btn" onClick={() => setShowExecuteModal(false)} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label">Batch Number</label>
                  <select
                    className="modal-input"
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                  >
                    {batchOptions.length === 0 ? (
                      <option value="">No batches available</option>
                    ) : (
                      batchOptions.map((batchId) => (
                        <option key={batchId} value={batchId}>{batchId}</option>
                      ))
                    )}
                  </select>
                </div>
                <p className="bulk-import-text">
                  Select a batch number and execute it to generate alerts for suspicious transactions in that batch.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowExecuteModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary-action" onClick={handleExecuteBatch} disabled={!selectedBatchId}>
                  Execute
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2 className="modal-title">Add Transaction</h2></div>
            <form className="modal-form" onSubmit={handleAddTransaction}>
              <div className="modal-body">
                <div className="modal-two-column">
                  <div className="modal-field"><label className="modal-label">Transaction ID</label><input className="modal-input" value={txForm.transaction_id} onChange={(e) => setTxForm((p) => ({ ...p, transaction_id: e.target.value }))} required /></div>
                  <div className="modal-field"><label className="modal-label">Type</label><select className="modal-input" value={txForm.transaction_type} onChange={(e) => setTxForm((p) => ({ ...p, transaction_type: e.target.value }))}><option value="TRANSFER">TRANSFER</option><option value="DEPOSIT">DEPOSIT</option><option value="WITHDRAWAL">WITHDRAWAL</option><option value="WIRE">WIRE</option><option value="PAYMENT">PAYMENT</option></select></div>
                </div>
                <div className="modal-two-column">
                  <div className="modal-field"><label className="modal-label">Amount</label><input type="number" step="0.01" min="0.01" className="modal-input" value={txForm.amount} onChange={(e) => setTxForm((p) => ({ ...p, amount: e.target.value }))} required /></div>
                  <div className="modal-field"><label className="modal-label">Currency</label><input className="modal-input" value={txForm.currency} onChange={(e) => setTxForm((p) => ({ ...p, currency: e.target.value.toUpperCase().slice(0, 3) }))} required /></div>
                </div>
                <div className="modal-two-column">
                  <div className="modal-field">
                    <label className="modal-label">Sender</label>
                    <select className="modal-input" value={txForm.sender} onChange={(e) => setTxForm((p) => ({ ...p, sender: e.target.value }))} required>
                      <option value="">Select sender</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name || `${c.first_name} ${c.last_name}`} ({c.customer_id})</option>)}
                    </select>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Receiver (optional)</label>
                    <select className="modal-input" value={txForm.receiver} onChange={(e) => setTxForm((p) => ({ ...p, receiver: e.target.value }))}>
                      <option value="">Select receiver</option>
                      {customers.map((c) => <option key={c.id} value={c.id}>{c.company_name || `${c.first_name} ${c.last_name}`} ({c.customer_id})</option>)}
                    </select>
                  </div>
                </div>
                <div className="modal-two-column">
                  <div className="modal-field"><label className="modal-label">Status</label><select className="modal-input" value={txForm.status} onChange={(e) => setTxForm((p) => ({ ...p, status: e.target.value }))}><option value="PENDING">PENDING</option><option value="COMPLETED">COMPLETED</option></select></div>
                  <div className="modal-field"><label className="modal-label">Date</label><input type="datetime-local" className="modal-input" value={txForm.transaction_date} onChange={(e) => setTxForm((p) => ({ ...p, transaction_date: e.target.value }))} required /></div>
                </div>
                <div className="modal-field"><label className="modal-label">Description</label><textarea className="modal-input modal-textarea" rows={3} value={txForm.description} onChange={(e) => setTxForm((p) => ({ ...p, description: e.target.value }))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-action">Save Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedReviewRow && (
        <div className="modal-backdrop" onClick={() => setSelectedReviewRow(null)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Review Transaction</h2>
              <button className="modal-close-btn" onClick={() => setSelectedReviewRow(null)} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="view-profile-grid">
                  <div className="view-profile-field">
                    <span className="view-profile-label">Transaction ID</span>
                    <span className="view-profile-value">{selectedReviewRow.transaction_id}</span>
                  </div>
                  <div className="view-profile-field">
                    <span className="view-profile-label">Type</span>
                    <span className="view-profile-value">{selectedReviewRow.transaction_type}</span>
                  </div>
                  <div className="view-profile-field">
                    <span className="view-profile-label">Amount</span>
                    <span className="view-profile-value">
                      {selectedReviewRow.currency} {Number(selectedReviewRow.amount).toLocaleString()}
                    </span>
                  </div>
                  <div className="view-profile-field">
                    <span className="view-profile-label">Status</span>
                    <span className={`pill ${statusPillClass(selectedReviewRow.status)}`}>{selectedReviewRow.status}</span>
                  </div>
                  <div className="view-profile-field">
                    <span className="view-profile-label">Sender</span>
                    <span className="view-profile-value">{selectedReviewRow.sender_name || '-'}</span>
                  </div>
                  <div className="view-profile-field">
                    <span className="view-profile-label">Receiver</span>
                    <span className="view-profile-value">{selectedReviewRow.receiver_name || '-'}</span>
                  </div>
                  <div className="view-profile-field">
                    <span className="view-profile-label">Risk Score</span>
                    <span className="view-profile-value">{(selectedReviewRow.risk_score * 100).toFixed(1)}%</span>
                  </div>
                  <div className="view-profile-field">
                    <span className="view-profile-label">Date</span>
                    <span className="view-profile-value">{fmtDate(selectedReviewRow.transaction_date)}</span>
                  </div>
                  <div className="view-profile-field view-profile-field-full">
                    <span className="view-profile-label">Review Summary</span>
                    <span className="view-profile-value view-profile-value-block">
                      {selectedReviewRow.status === 'BLOCKED'
                        ? 'This transaction is blocked and requires escalation before release.'
                        : selectedReviewRow.status === 'UNDER_REVIEW'
                          ? 'This transaction is under active analyst review and should remain in the investigation queue.'
                          : 'This flagged transaction was identified by the monitoring model and should be reviewed for suspicious activity.'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setSelectedReviewRow(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
