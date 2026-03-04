import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineDownload, HiOutlineUpload, HiOutlineX } from 'react-icons/hi'
import './Customers.css'

type TransactionRow = {
  id: number
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

function resultsOf<T>(payload: { results?: T[] } | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

export const TransactionsUploadData: React.FC = () => {
  const [rows, setRows] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [bulkFile, setBulkFile] = useState<File | null>(null)

  const loadRows = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE_URL}/transactions/`)
      if (!res.ok) throw new Error('Failed to load uploaded transaction data')
      const payload = (await res.json()) as TransactionResponse
      setRows(resultsOf(payload))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load uploaded transaction data')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRows()
  }, [])

  const handleFileImport = async () => {
    if (!bulkFile) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', bulkFile)
      const res = await fetch(`${API_BASE_URL}/transactions/import_excel/`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Failed to upload transaction file')
      setShowUploadModal(false)
      setBulkFile(null)
      await loadRows()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to upload file')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const total = rows.length
    const pending = rows.filter((r) => r.status === 'PENDING').length
    const completed = rows.filter((r) => r.status === 'COMPLETED').length
    const flagged = rows.filter((r) => r.is_suspicious).length
    return { total, pending, completed, flagged }
  }, [rows])

  const downloadTemplate = () => {
    const header = [
      'transaction_id',
      'transaction_type',
      'amount',
      'currency',
      'sender_customer_id',
      'receiver_customer_id',
      'status',
      'transaction_date',
      'description',
    ].join(',')
    const sample = [
      'TX-100001',
      'TRANSFER',
      '1500.00',
      'USD',
      'CUST-000101',
      'CUST-000245',
      'PENDING',
      new Date().toISOString(),
      'Sample transaction import row',
    ].join(',')

    const blob = new Blob([`${header}\n${sample}\n`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'transactions_upload_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="reports-container upload-data-page">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">Upload Data</h1>
          <p className="customers-subtitle">Upload transaction files and monitor each imported batch from ingestion through review.</p>
        </div>
        <div className="customers-header-actions">
          <button type="button" className="btn-import-action btn-with-icon" onClick={() => setShowUploadModal(true)}>
            <HiOutlineUpload size={16} aria-hidden />
            <span>Upload Data</span>
          </button>
        </div>
      </header>

      <div className="customers-container upload-data-container">
        <div className="customers-filters-card report-filters upload-data-main-card">
          <div className="bulk-import-card">
            <div className="bulk-import-body">
              <div className="upload-data-intro">
                <h3 className="bulk-import-title">Upload Workspace</h3>
                <p className="bulk-import-text">
                  Use this workspace to upload batch files from external transaction sources. Each upload feeds the monitoring
                  queue and becomes available for downstream AML review.
                </p>
              </div>
              <div className="bulk-import-layout">
                <div className="bulk-import-upload">
                  <div className="bulk-import-dropzone">
                    <div className="bulk-import-icon-circle">
                      <HiOutlineUpload size={20} aria-hidden />
                    </div>
                    <p className="bulk-import-drop-main">Upload a transaction batch file</p>
                    <p className="bulk-import-drop-sub">Accepted formats: `.xlsx` and `.xls`</p>
                    <button type="button" className="btn-primary-action btn-with-icon" onClick={() => setShowUploadModal(true)}>
                      <HiOutlineUpload size={16} aria-hidden />
                      <span>Select File</span>
                    </button>
                  </div>
                </div>
                <div className="bulk-import-sidebar">
                  <div className="upload-data-side-header">
                    <h4 className="bulk-import-sidebar-title">Upload Toolkit</h4>
                    <button type="button" className="btn-upload-template btn-with-icon" onClick={downloadTemplate}>
                      <HiOutlineDownload size={16} aria-hidden />
                      <span>Download Template</span>
                    </button>
                  </div>
                  <p className="bulk-import-text upload-data-helper">
                    Use the template to match the required schema before uploading your batch file.
                  </p>
                  <div className="upload-data-checklist">
                    <span className="upload-data-check-item">Unique transaction ID per row</span>
                    <span className="upload-data-check-item">Amounts in numeric format</span>
                    <span className="upload-data-check-item">Valid sender and receiver customer IDs</span>
                    <span className="upload-data-check-item">ISO timestamp for transaction date</span>
                  </div>
                  <div className="view-profile-grid">
                    <div className="view-profile-field">
                      <span className="view-profile-label">Uploaded records</span>
                      <span className="view-profile-value">{stats.total}</span>
                    </div>
                    <div className="view-profile-field">
                      <span className="view-profile-label">Pending ingestion</span>
                      <span className="view-profile-value">{stats.pending}</span>
                    </div>
                    <div className="view-profile-field">
                      <span className="view-profile-label">Completed</span>
                      <span className="view-profile-value">{stats.completed}</span>
                    </div>
                    <div className="view-profile-field">
                      <span className="view-profile-label">Flagged</span>
                      <span className="view-profile-value">{stats.flagged}</span>
                    </div>
                    <div className="view-profile-field view-profile-field-full">
                      <span className="view-profile-label">Required columns</span>
                      <span className="view-profile-value view-profile-value-block">
                        transaction_id, transaction_type, amount, currency, sender_customer_id, receiver_customer_id, status, transaction_date, description
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {showUploadModal && (
        <div className="modal-backdrop" onClick={() => setShowUploadModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Upload Transaction Batch</h2>
              <button className="modal-close-btn" onClick={() => setShowUploadModal(false)} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label">Select Excel file</label>
                  <input
                    type="file"
                    className="modal-input"
                    accept=".xlsx,.xls"
                    onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                  />
                </div>
                <p className="bulk-import-text">
                  Upload a transaction export from your source system. The file will be imported and added to the batch monitoring queue.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary-action" onClick={() => void handleFileImport()} disabled={!bulkFile || loading}>
                  {loading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
