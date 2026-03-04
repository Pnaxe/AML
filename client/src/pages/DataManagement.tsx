import React, { useEffect, useMemo, useState } from 'react'
import {
  HiOutlineSearch,
  HiOutlineX,
  HiOutlineEye,
  HiOutlineDownload,
  HiOutlineDatabase,
} from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import './Customers.css'

type DataAsset = {
  id: string
  name: string
  category: 'Transactions' | 'KYC' | 'Watchlist' | 'Alerts'
  source: string
  records: number
  status: 'Active' | 'Stale' | 'Pending'
  lastSync: string
}

type GenericRecord = Record<string, unknown>
type Paged<T> = { results?: T[] } | T[]
type DatasetFile = { dataset_file: string; size_bytes: number; uploaded_at: string }

const PAGE_SIZE = 25
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const DATA_MANAGEMENT_CACHE_KEY = 'aml_data_management_assets_cache'

type DataManagementProps = {
  onOpenDatasetForCorrection?: (datasetName: string) => void
}

function rowsOf<T>(payload: Paged<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function fmtDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return new Date().toLocaleDateString('en-US')
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toLocaleDateString('en-US')
  return parsed.toLocaleDateString('en-US')
}

function maxDateLabel(rows: GenericRecord[], ...keys: string[]): string {
  const values = rows
    .map((row) => keys.map((key) => row[key]).find(Boolean))
    .filter((value): value is string => typeof value === 'string' && Boolean(value))
  if (values.length === 0) return new Date().toLocaleDateString('en-US')
  const latest = values
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0]
  return latest ? latest.toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US')
}

function categoryForDatasetFile(fileName: string): DataAsset['category'] {
  const normalized = fileName.toLowerCase()
  if (normalized.includes('kyc')) return 'KYC'
  if (normalized.includes('watchlist') || normalized.includes('sanction') || normalized.includes('pep')) return 'Watchlist'
  if (normalized.includes('alert')) return 'Alerts'
  return 'Transactions'
}

function buildAssets(
  transactions: GenericRecord[],
  customers: GenericRecord[],
  alerts: GenericRecord[],
  sources: GenericRecord[],
  datasets: DatasetFile[],
): DataAsset[] {
  const baseAssets: DataAsset[] = [
    {
      id: 'DS-TXN-001',
      name: 'Transactions Database',
      category: 'Transactions',
      source: 'Core Transaction DB',
      records: transactions.length,
      status: transactions.length > 0 ? 'Active' : 'Pending',
      lastSync: maxDateLabel(transactions, 'transaction_date', 'created_at'),
    },
    {
      id: 'DS-KYC-001',
      name: 'Customer Profiles',
      category: 'KYC',
      source: 'Customer DB',
      records: customers.length,
      status: customers.length > 0 ? 'Active' : 'Pending',
      lastSync: maxDateLabel(customers, 'updated_at', 'created_at'),
    },
    {
      id: 'DS-ALT-001',
      name: 'Alert Queue',
      category: 'Alerts',
      source: 'Alert Engine',
      records: alerts.length,
      status: alerts.length > 0 ? 'Active' : 'Pending',
      lastSync: maxDateLabel(alerts, 'triggered_at', 'created_at'),
    },
    {
      id: 'DS-WTC-001',
      name: 'Monitoring Sources',
      category: 'Watchlist',
      source: 'Configured Sources',
      records: sources.length,
      status: sources.some((row) => Boolean(row.is_active)) ? 'Active' : 'Stale',
      lastSync: new Date().toLocaleDateString('en-US'),
    },
  ]

  const uploadedAssets = datasets.map((dataset, index) => ({
    id: `DS-UPL-${String(index + 1).padStart(3, '0')}`,
    name: dataset.dataset_file,
    category: categoryForDatasetFile(dataset.dataset_file),
    source: 'Uploaded Dataset',
    records: 0,
    status: dataset.size_bytes > 0 ? 'Active' : 'Pending',
    lastSync: fmtDate(dataset.uploaded_at),
  }))

  return [...baseAssets, ...uploadedAssets]
}

export const DataManagement: React.FC<DataManagementProps> = ({ onOpenDatasetForCorrection }) => {
  const { token } = useAuth()
  const [assets, setAssets] = useState<DataAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  const authHeaders: Record<string, string> = {}
  if (token) authHeaders.Authorization = `Token ${token}`

  const loadAssets = async () => {
    const cachedValue = sessionStorage.getItem(DATA_MANAGEMENT_CACHE_KEY)
    setLoading(true)
    if (cachedValue) {
      try {
        setAssets(JSON.parse(cachedValue) as DataAsset[])
      } catch {
        sessionStorage.removeItem(DATA_MANAGEMENT_CACHE_KEY)
      }
    }
    setError(null)
    try {
      const [transactionsRes, customersRes, alertsRes, sourcesRes, datasetsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/transactions/`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/customers/`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/alerts/`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/transactions/sources/`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/ml-models/datasets/`, { headers: authHeaders }),
      ])

      if (!transactionsRes.ok || !customersRes.ok || !alertsRes.ok || !sourcesRes.ok || !datasetsRes.ok) {
        throw new Error('Failed to load data assets')
      }

      const [transactionsPayload, customersPayload, alertsPayload, sourcesPayload, datasetsPayload] = await Promise.all([
        transactionsRes.json(),
        customersRes.json(),
        alertsRes.json(),
        sourcesRes.json(),
        datasetsRes.json(),
      ])

      const nextAssets = buildAssets(
        rowsOf<GenericRecord>(transactionsPayload),
        rowsOf<GenericRecord>(customersPayload),
        rowsOf<GenericRecord>(alertsPayload),
        rowsOf<GenericRecord>(sourcesPayload),
        rowsOf<DatasetFile>(datasetsPayload),
      )
      setAssets(nextAssets)
      sessionStorage.setItem(DATA_MANAGEMENT_CACHE_KEY, JSON.stringify(nextAssets))
    } catch (e) {
      if (!cachedValue) {
        setError(e instanceof Error ? e.message : 'Unable to load data assets')
        setAssets([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAssets()
  }, [])

  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) => {
        const term = activeSearchTerm.toLowerCase()
        if (
          term &&
          !(
            asset.name.toLowerCase().includes(term) ||
            asset.id.toLowerCase().includes(term) ||
            asset.source.toLowerCase().includes(term)
          )
        ) {
          return false
        }
        if (categoryFilter && asset.category !== categoryFilter) return false
        if (statusFilter && asset.status !== statusFilter) return false
        return true
      }),
    [assets, activeSearchTerm, categoryFilter, statusFilter],
  )

  const totalAssets = filteredAssets.length
  const totalPages = Math.max(1, Math.ceil(totalAssets / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageAssets = filteredAssets.slice(startIndex, startIndex + PAGE_SIZE)

  const displayStart = totalAssets === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageAssets.length

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

  const handleOpenAddModal = () => setShowAddModal(true)

  const handleCloseAddModal = () => {
    setShowAddModal(false)
    setNewName('')
    setUploadFile(null)
  }

  const handleUploadDataset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return

    const headers = { ...authHeaders }
    const formData = new FormData()
    formData.append('dataset_name', newName.trim() || uploadFile.name)
    formData.append('file', uploadFile)

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/ml-models/upload_dataset/`, {
        method: 'POST',
        headers,
        body: formData,
      })
      if (!res.ok) throw new Error('Failed to upload dataset')
      handleCloseAddModal()
      await loadAssets()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to upload dataset')
      setLoading(false)
    }
  }

  return (
    <div className="reports-container">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">Data Upload</h1>
          <p className="customers-subtitle">Manage live AML datasets, uploaded files, and sync status from the backend.</p>
        </div>
        <div className="customers-header-actions">
          <button className="btn-export-action btn-with-icon" type="button" onClick={() => void loadAssets()} disabled={loading}>
            <HiOutlineDownload size={16} aria-hidden />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <button className="btn-primary-action btn-with-icon" type="button" onClick={handleOpenAddModal}>
            <HiOutlineDatabase size={16} aria-hidden />
            <span>Add Dataset</span>
          </button>
        </div>
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
                  placeholder="Search by dataset name, ID, or source..."
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
              <span className="filter-label">Category:</span>
              <select
                className="filter-input"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="">All</option>
                <option value="Transactions">Transactions</option>
                <option value="KYC">KYC</option>
                <option value="Watchlist">Watchlist</option>
                <option value="Alerts">Alerts</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">Status:</span>
              <select
                className="filter-input"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setCurrentPage(1)
                }}
              >
                <option value="">All</option>
                <option value="Active">Active</option>
                <option value="Stale">Stale</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
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
                  <th>DATASET ID</th>
                  <th>NAME</th>
                  <th>CATEGORY</th>
                  <th>SOURCE</th>
                  <th>RECORDS</th>
                  <th>STATUS</th>
                  <th>LAST SYNC</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pageAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td className="customer-id">{asset.id}</td>
                    <td>
                      <button type="button" className="table-link-button" onClick={() => onOpenDatasetForCorrection?.(asset.name)}>
                        {asset.name}
                      </button>
                    </td>
                    <td>{asset.category}</td>
                    <td className="muted">{asset.source}</td>
                    <td>{asset.records.toLocaleString()}</td>
                    <td>
                      <span className={`pill ${asset.status === 'Active' ? 'pill-kyc-verified' : asset.status === 'Stale' ? 'pill-kyc-failed' : 'pill-kyc-pending'}`}>
                        {asset.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="muted">{asset.lastSync}</td>
                    <td>
                      <div className="customers-actions">
                        <HiOutlineEye
                          size={18}
                          className="action-icon action-icon-view"
                          title="View dataset in correction page"
                          onClick={() => onOpenDatasetForCorrection?.(asset.name)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, PAGE_SIZE - pageAssets.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>
                    {Array.from({ length: 8 }).map((_, cellIdx) => (
                      <td key={cellIdx}>&nbsp;</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ecl-table-footer">
            <div className="table-footer-left">
              Showing {displayStart} to {displayEnd} of {totalAssets} results.
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
                <span>{loading ? 'Working...' : 'All data displayed'}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-backdrop" onClick={handleCloseAddModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Dataset</h2>
              <button type="button" className="modal-close-btn" onClick={handleCloseAddModal} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleUploadDataset}>
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label" htmlFor="datasetName">Dataset Name</label>
                  <input
                    id="datasetName"
                    className="modal-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="transactions_daily_march"
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="datasetFile">Dataset File</label>
                  <input
                    id="datasetFile"
                    type="file"
                    className="modal-input"
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    accept=".csv,.xlsx,.xls"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={handleCloseAddModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action" disabled={loading || !uploadFile}>
                  Upload Dataset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
