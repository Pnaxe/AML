import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  HiOutlineArrowLeft,
  HiOutlineDownload,
  HiOutlineEye,
  HiOutlinePencil,
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlineUpload,
  HiOutlineUserAdd,
  HiOutlineX,
} from 'react-icons/hi'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import './Customers.css'

const PAGE_SIZE = 25
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical'
type KycStatus = 'Verified' | 'Pending'
type ProfileType = 'Individual' | 'Business'

type BackendCustomer = {
  id: number
  customer_id: string
  customer_type: 'INDIVIDUAL' | 'CORPORATE' | 'GOVERNMENT' | 'NON_PROFIT'
  first_name: string
  last_name: string
  company_name: string
  email: string
  country: string
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  kyc_verified: boolean
  updated_at: string
  created_at: string
}

type PaginatedResponse<T> = {
  count?: number
  next?: string | null
  previous?: string | null
  results?: T[]
} | T[]

type Customer = {
  id: number
  displayId: string
  name: string
  email: string
  risk: RiskLevel
  kycStatus: KycStatus
  lastActivity: string
  profileType: ProfileType
  raw: BackendCustomer
}

function rowsOf<T>(payload: PaginatedResponse<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function totalCountOf<T>(payload: PaginatedResponse<T>): number {
  if (Array.isArray(payload)) return payload.length
  return typeof payload.count === 'number' ? payload.count : (payload.results ?? []).length
}

function formatDate(value: string): string {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-US')
}

function toRiskLevel(value: BackendCustomer['risk_level']): RiskLevel {
  if (value === 'CRITICAL') return 'Critical'
  if (value === 'HIGH') return 'High'
  if (value === 'MEDIUM') return 'Medium'
  return 'Low'
}

function toCustomer(row: BackendCustomer): Customer {
  const name =
    row.customer_type === 'INDIVIDUAL'
      ? `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim() || row.customer_id
      : row.company_name || row.customer_id

  return {
    id: row.id,
    displayId: row.customer_id,
    name,
    email: row.email || '-',
    risk: toRiskLevel(row.risk_level),
    kycStatus: row.kyc_verified ? 'Verified' : 'Pending',
    lastActivity: formatDate(row.updated_at || row.created_at),
    profileType: row.customer_type === 'INDIVIDUAL' ? 'Individual' : 'Business',
    raw: row,
  }
}

function normalizeRiskForApi(risk: RiskLevel): BackendCustomer['risk_level'] {
  if (risk === 'Critical') return 'CRITICAL'
  if (risk === 'High') return 'HIGH'
  if (risk === 'Medium') return 'MEDIUM'
  return 'LOW'
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

export const Customers: React.FC = () => {
  const { showToast } = useToast()
  const { token } = useAuth()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [kycFilter, setKycFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [deleteCustomer, setDeleteCustomer] = useState<Customer | null>(null)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRisk, setNewRisk] = useState<RiskLevel>('Low')
  const [newKycStatus, setNewKycStatus] = useState<KycStatus>('Pending')
  const [newProfileType, setNewProfileType] = useState<ProfileType>('Business')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRisk, setEditRisk] = useState<RiskLevel>('Low')
  const [editKycStatus, setEditKycStatus] = useState<KycStatus>('Pending')
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkImportFormat, setBulkImportFormat] = useState<'csv' | 'excel'>('csv')
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv')
  const [exportFileName, setExportFileName] = useState('customers_export')

  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Token ${token}`
    return headers
  }, [token])

  const loadCustomers = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        page_size: String(PAGE_SIZE),
      })
      if (activeSearchTerm) params.set('search', activeSearchTerm)
      if (kycFilter) params.set('kyc_verified', String(kycFilter === 'Verified'))
      if (riskFilter) params.set('risk_level', normalizeRiskForApi(riskFilter as RiskLevel))

      const response = await fetch(`${API_BASE_URL}/customers/?${params.toString()}`, { headers: authHeaders })
      if (!response.ok) throw new Error('Failed to load customers')
      const payload = (await response.json()) as PaginatedResponse<BackendCustomer>
      setCustomers(rowsOf(payload).map(toCustomer))
      setTotalCustomers(totalCountOf(payload))
    } catch (error) {
      console.error(error)
      showToast('Unable to load customers.')
    } finally {
      setIsLoading(false)
    }
  }, [activeSearchTerm, authHeaders, currentPage, kycFilter, riskFilter, showToast])

  useEffect(() => {
    void loadCustomers()
  }, [loadCustomers])

  const totalPages = Math.max(1, Math.ceil(totalCustomers / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pageCustomers = customers
  const displayStart = totalCustomers === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const displayEnd = displayStart === 0 ? 0 : displayStart + pageCustomers.length - 1

  const resetAddForm = () => {
    setShowAddModal(false)
    setNewName('')
    setNewEmail('')
    setNewRisk('Low')
    setNewKycStatus('Pending')
    setNewProfileType('Business')
  }

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

  const handleOpenEditModal = (cust: Customer) => {
    setEditCustomer(cust)
    setEditName(cust.name)
    setEditEmail(cust.email === '-' ? '' : cust.email)
    setEditRisk(cust.risk)
    setEditKycStatus(cust.kycStatus)
  }

  const handleCloseEditModal = () => {
    setEditCustomer(null)
    setEditName('')
    setEditEmail('')
    setEditRisk('Low')
    setEditKycStatus('Pending')
  }

  const submitKycStatus = async (customerId: number, status: KycStatus) => {
    if (status !== 'Verified') return
    await fetch(`${API_BASE_URL}/customers/${customerId}/accept/`, {
      method: 'POST',
      headers: authHeaders,
    })
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return

    const body =
      newProfileType === 'Individual'
        ? {
            customer_type: 'INDIVIDUAL',
            first_name: newName.trim().split(/\s+/).slice(0, -1).join(' ') || newName.trim(),
            last_name: newName.trim().split(/\s+/).slice(-1).join(' '),
            email: newEmail.trim(),
            risk_level: normalizeRiskForApi(newRisk),
          }
        : {
            customer_type: 'CORPORATE',
            company_name: newName.trim(),
            email: newEmail.trim(),
            risk_level: normalizeRiskForApi(newRisk),
          }

    try {
      const response = await fetch(`${API_BASE_URL}/customers/`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('Failed to create customer')
      const created = (await response.json()) as BackendCustomer
      await submitKycStatus(created.id, newKycStatus)
      await loadCustomers()
      setCurrentPage(1)
      resetAddForm()
      showToast(`Customer "${newName.trim()}" added successfully.`)
    } catch (error) {
      console.error(error)
      showToast('Unable to create customer.')
    }
  }

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editCustomer || !editName.trim()) return

    const body =
      editCustomer.profileType === 'Individual'
        ? {
            first_name: editName.trim().split(/\s+/).slice(0, -1).join(' ') || editName.trim(),
            last_name: editName.trim().split(/\s+/).slice(-1).join(' '),
            email: editEmail.trim(),
            risk_level: normalizeRiskForApi(editRisk),
          }
        : {
            company_name: editName.trim(),
            email: editEmail.trim(),
            risk_level: normalizeRiskForApi(editRisk),
          }

    try {
      const response = await fetch(`${API_BASE_URL}/customers/${editCustomer.id}/`, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('Failed to update customer')
      if (editKycStatus === 'Verified' && editCustomer.kycStatus !== 'Verified') {
        await submitKycStatus(editCustomer.id, editKycStatus)
      }
      await loadCustomers()
      handleCloseEditModal()
      showToast(`Customer "${editName.trim()}" updated successfully.`)
    } catch (error) {
      console.error(error)
      showToast('Unable to update customer.')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteCustomer) return
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${deleteCustomer.id}/`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (!response.ok && response.status !== 204) throw new Error('Failed to delete customer')
      const name = deleteCustomer.name
      setDeleteCustomer(null)
      await loadCustomers()
      setCurrentPage(1)
      showToast(`Customer "${name}" deleted successfully.`)
    } catch (error) {
      console.error(error)
      showToast('Unable to delete customer.')
    }
  }

  const handleDownloadBulkTemplate = () => {
    const header = ['Customer ID', 'Name', 'Email', 'Risk Level', 'KYC Status', 'Profile Type'].join(',')
    const sample = ['CUST-001999', 'Example Customer Ltd', 'customer@example.com', 'Low', 'Verified', 'Business'].join(',')
    const csvContent = `${header}\n${sample}\n`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'customers_bulk_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDownloadCustomersExport = () => {
    const safeBaseName = exportFileName.trim() || 'customers_export'
    const header = ['Customer ID', 'Name', 'Email', 'Risk Level', 'KYC Status', 'Last Activity'].join(',')
    const rows = pageCustomers.map((c) =>
      [
        c.displayId,
        csvEscape(c.name),
        csvEscape(c.email),
        c.risk,
        c.kycStatus,
        c.lastActivity,
      ].join(','),
    )
    const csvContent = `${header}\n${rows.join('\n')}\n`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${safeBaseName}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setShowExportModal(false)
  }

  const handleBulkFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (bulkImportFormat === 'excel') {
      showToast('Excel import is not available from this screen yet. Use CSV.')
      return
    }

    try {
      const content = await file.text()
      const lines = content.split(/\r?\n/).filter((line) => line.trim())
      if (lines.length <= 1) throw new Error('No data rows found')

      const rows = lines.slice(1).map((line) => parseCsvLine(line))
      let imported = 0

      for (const row of rows) {
        const [, name = '', email = '', risk = 'Low', kycStatus = 'Pending', profileType = 'Business'] = row
        if (!name.trim()) continue
        const body =
          profileType.toLowerCase() === 'individual'
            ? {
                customer_type: 'INDIVIDUAL',
                first_name: name.trim().split(/\s+/).slice(0, -1).join(' ') || name.trim(),
                last_name: name.trim().split(/\s+/).slice(-1).join(' '),
                email: email.trim(),
                risk_level: normalizeRiskForApi((risk || 'Low') as RiskLevel),
              }
            : {
                customer_type: 'CORPORATE',
                company_name: name.trim(),
                email: email.trim(),
                risk_level: normalizeRiskForApi((risk || 'Low') as RiskLevel),
              }

        const response = await fetch(`${API_BASE_URL}/customers/`, {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        if (!response.ok) continue
        const created = (await response.json()) as BackendCustomer
        if ((kycStatus || '').toLowerCase() === 'verified') {
          await submitKycStatus(created.id, 'Verified')
        }
        imported += 1
      }

      await loadCustomers()
      showToast(imported > 0 ? `${imported} customers imported.` : 'No customers were imported.')
    } catch (error) {
      console.error(error)
      showToast('Unable to import customers from that file.')
    }
  }

  return (
    <div className="reports-container">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">{showBulkImport ? 'Bulk Import Customers' : 'Customers'}</h1>
          <p className="customers-subtitle">
            {showBulkImport
              ? 'Upload and validate existing customers in bulk.'
              : 'Customer Management & KYC Verification.'}
          </p>
        </div>
        <div className="customers-header-actions">
          {showBulkImport ? (
            <button type="button" className="btn-secondary-action btn-with-icon" onClick={() => setShowBulkImport(false)}>
              <HiOutlineArrowLeft size={16} aria-hidden />
              <span>Back to customers</span>
            </button>
          ) : (
            <>
              <button
                className="btn-export-action btn-with-icon"
                type="button"
                onClick={() => {
                  setExportFormat('csv')
                  setShowExportModal(true)
                }}
              >
                <HiOutlineDownload size={16} aria-hidden />
                <span>Export</span>
              </button>
              <button className="btn-import-action btn-with-icon" type="button" onClick={() => setShowBulkImport(true)}>
                <HiOutlineUpload size={16} aria-hidden />
                <span>Bulk Import</span>
              </button>
              <button className="btn-primary-action btn-with-icon" onClick={() => setShowAddModal(true)}>
                <HiOutlineUserAdd size={16} aria-hidden />
                <span>Add Existing Customer</span>
              </button>
            </>
          )}
        </div>
      </header>
      {showBulkImport ? (
        <div className="customers-container">
          <div className="customers-table-card-outer bulk-import-card">
            <div className="bulk-import-body">
              <div className="bulk-import-intro">
                <h2 className="bulk-import-title">Import existing customers from CSV</h2>
                <p className="bulk-import-text">
                  Upload a CSV file and this page will create customer records through the backend API.
                </p>
              </div>
              <div className="bulk-import-layout">
                <div className="bulk-import-upload">
                  <div className="bulk-import-format">
                    <span className="bulk-import-format-label">File type</span>
                    <div className="bulk-import-format-toggle">
                      <button
                        type="button"
                        className={`bulk-import-format-btn ${bulkImportFormat === 'csv' ? 'is-active' : ''}`}
                        onClick={() => setBulkImportFormat('csv')}
                      >
                        CSV (.csv)
                      </button>
                      <button
                        type="button"
                        className={`bulk-import-format-btn ${bulkImportFormat === 'excel' ? 'is-active' : ''}`}
                        onClick={() => setBulkImportFormat('excel')}
                      >
                        Excel (.xlsx)
                      </button>
                    </div>
                  </div>
                  <div className="bulk-import-dropzone">
                    <div className="bulk-import-icon-circle">
                      <HiOutlineUpload size={28} aria-hidden />
                    </div>
                    <p className="bulk-import-drop-main">Drop your {bulkImportFormat === 'csv' ? 'CSV' : 'Excel'} file here</p>
                    <p className="bulk-import-drop-sub">or click to browse from your computer</p>
                    <button type="button" className="btn-primary-action" onClick={() => fileInputRef.current?.click()}>
                      Choose file
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={bulkImportFormat === 'csv' ? '.csv' : '.xlsx,.xls'}
                      style={{ display: 'none' }}
                      onChange={handleBulkFilePicked}
                    />
                  </div>
                  <p className="bulk-import-hint">
                    Supported here: <strong>.csv</strong>. Excel selection stays visible but is not processed yet.
                  </p>
                </div>
                <div className="bulk-import-sidebar">
                  <h3 className="bulk-import-sidebar-title">Template & mapping</h3>
                  <p className="bulk-import-text">
                    Start by downloading the sample template. The importer reads name, email, risk level, KYC status, and profile type.
                  </p>
                  <button type="button" className="btn-outline-action btn-with-icon" onClick={handleDownloadBulkTemplate}>
                    <HiOutlineDownload size={16} aria-hidden />
                    <span>Download template</span>
                  </button>
                  <ul className="bulk-import-list">
                    <li>Risk Level: Low, Medium, High, or Critical.</li>
                    <li>KYC Status: Verified or Pending.</li>
                    <li>Profile Type: Business or Individual.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
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
                <span className="filter-label">KYC Status:</span>
                <select className="filter-input" value={kycFilter} onChange={(e) => { setKycFilter(e.target.value); setCurrentPage(1) }}>
                  <option value="">All</option>
                  <option value="Verified">Verified</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>

              <div className="filter-group">
                <span className="filter-label">Risk Level:</span>
                <select className="filter-input" value={riskFilter} onChange={(e) => { setRiskFilter(e.target.value); setCurrentPage(1) }}>
                  <option value="">All Risk Levels</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          </div>

      <div className={`customers-table-card-outer ${!isLoading && pageCustomers.length === 0 ? 'table-empty-state' : ''}`}>
            <div className="report-content-container ecl-table-container table-loading-shell">
              {isLoading && (
                <div className="table-loading-overlay" aria-hidden="true">
                  <div className="table-loading-indicator">
                    <div className="table-loading-spinner" />
                    <span className="table-loading-text">Loading customers...</span>
                  </div>
                </div>
              )}
              <table className="ecl-table">
                <thead>
                  <tr>
                    <th>CUSTOMER ID</th>
                    <th>NAME</th>
                    <th>EMAIL</th>
                    <th>RISK LEVEL</th>
                    <th>KYC STATUS</th>
                    <th>LAST ACTIVITY</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {!isLoading && pageCustomers.map((cust) => (
                        <tr key={cust.id}>
                          <td className="customer-id">{cust.displayId}</td>
                          <td>{cust.name}</td>
                          <td className="muted">{cust.email}</td>
                          <td>
                            <span className={`pill pill-${cust.risk.toLowerCase()}`}>{cust.risk.toUpperCase()}</span>
                          </td>
                          <td>
                            <span className={`pill pill-kyc-${cust.kycStatus.toLowerCase()}`}>{cust.kycStatus}</span>
                          </td>
                          <td className="muted">{cust.lastActivity}</td>
                          <td>
                            <div className="customers-actions">
                              <HiOutlineEye size={18} className="action-icon action-icon-view" onClick={() => setViewCustomer(cust)} title="View customer" />
                              <HiOutlinePencil size={18} className="action-icon action-icon-edit" onClick={() => handleOpenEditModal(cust)} title="Edit customer" />
                              <HiOutlineTrash size={18} className="action-icon action-icon-delete" onClick={() => setDeleteCustomer(cust)} title="Delete customer" />
                            </div>
                          </td>
                        </tr>
                      ))}
                  {!isLoading &&
                    Array.from({ length: Math.max(0, PAGE_SIZE - pageCustomers.length) }).map((_, idx) => (
                      <tr key={`empty-${idx}`}>{Array.from({ length: 7 }).map((__, cellIdx) => <td key={cellIdx}>&nbsp;</td>)}</tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="ecl-table-footer">
              <div className="table-footer-left">
                Showing {displayStart} to {displayEnd} of {totalCustomers} results.
              </div>
              <div className="table-footer-right">
                {totalPages > 1 ? (
                  <div className="pagination-controls">
                    <button type="button" className="pagination-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                      Previous
                    </button>
                    <span className="pagination-info">Page {safePage} of {totalPages}</span>
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
      )}
      {showExportModal && (
        <div className="modal-backdrop" onClick={() => setShowExportModal(false)}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Export customers</h2>
              <button className="modal-close-btn" onClick={() => setShowExportModal(false)} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="modal-field">
                  <span className="modal-label">File format</span>
                  <div className="export-format-toggle">
                    <button type="button" className={`export-format-btn ${exportFormat === 'csv' ? 'is-active' : ''}`} onClick={() => setExportFormat('csv')}>
                      CSV (.csv)
                    </button>
                    <button type="button" className={`export-format-btn ${exportFormat === 'excel' ? 'is-active' : ''}`} onClick={() => setExportFormat('excel')}>
                      Excel (.xlsx)
                    </button>
                  </div>
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="exportFileName">File name</label>
                  <input id="exportFileName" type="text" className="modal-input" value={exportFileName} onChange={(e) => setExportFileName(e.target.value)} placeholder="customers_export" />
                </div>
                <p className="bulk-import-text">
                  This export is generated from the backend-backed customer list currently loaded in the page.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setShowExportModal(false)}>
                  Cancel
                </button>
                <button type="button" className="btn-primary-action" onClick={handleDownloadCustomersExport}>
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-backdrop" onClick={resetAddForm}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add New Customer</h2>
              <button className="modal-close-btn" onClick={resetAddForm} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleCreateCustomer}>
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label" htmlFor="newCustomerType">Profile Type</label>
                  <select id="newCustomerType" className="modal-input" value={newProfileType} onChange={(e) => setNewProfileType(e.target.value as ProfileType)}>
                    <option value="Business">Business</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="newCustomerName">Name</label>
                  <input id="newCustomerName" type="text" className="modal-input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Acme Trading Ltd" autoFocus />
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="newCustomerEmail">Email</label>
                  <input id="newCustomerEmail" type="email" className="modal-input" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="compliance@customer.com" />
                </div>
                <div className="modal-two-column">
                  <div className="modal-field">
                    <label className="modal-label" htmlFor="newCustomerRisk">Risk Level</label>
                    <select id="newCustomerRisk" className="modal-input" value={newRisk} onChange={(e) => setNewRisk(e.target.value as RiskLevel)}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label" htmlFor="newCustomerKyc">KYC Status</label>
                    <select id="newCustomerKyc" className="modal-input" value={newKycStatus} onChange={(e) => setNewKycStatus(e.target.value as KycStatus)}>
                      <option value="Verified">Verified</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={resetAddForm}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action">
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editCustomer && (
        <div className="modal-backdrop" onClick={handleCloseEditModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Customer</h2>
              <button className="modal-close-btn" onClick={handleCloseEditModal} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleUpdateCustomer}>
              <div className="modal-body">
                <div className="modal-field">
                  <span className="modal-label">Customer ID</span>
                  <span className="modal-value customer-id">{editCustomer.displayId}</span>
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="editCustomerName">Name</label>
                  <input id="editCustomerName" type="text" className="modal-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="editCustomerEmail">Email</label>
                  <input id="editCustomerEmail" type="email" className="modal-input" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                </div>
                <div className="modal-two-column">
                  <div className="modal-field">
                    <label className="modal-label" htmlFor="editCustomerRisk">Risk Level</label>
                    <select id="editCustomerRisk" className="modal-input" value={editRisk} onChange={(e) => setEditRisk(e.target.value as RiskLevel)}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label" htmlFor="editCustomerKyc">KYC Status</label>
                    <select id="editCustomerKyc" className="modal-input" value={editKycStatus} onChange={(e) => setEditKycStatus(e.target.value as KycStatus)}>
                      <option value="Verified">Verified</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={handleCloseEditModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-action">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteCustomer && (
        <div className="modal-backdrop" onClick={() => setDeleteCustomer(null)}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Customer</h2>
              <button className="modal-close-btn" onClick={() => setDeleteCustomer(null)} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <p className="modal-delete-message">
                  Are you sure you want to delete <strong>{deleteCustomer.name}</strong>? This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setDeleteCustomer(null)}>
                  Cancel
                </button>
                <button type="button" className="btn-danger-action" onClick={handleConfirmDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewCustomer && (
        <div className="modal-backdrop" onClick={() => setViewCustomer(null)}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">View Customer</h2>
              <button className="modal-close-btn" onClick={() => setViewCustomer(null)} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="modal-two-column">
                  <div className="modal-field">
                    <span className="modal-label">Customer ID</span>
                    <span className="modal-value customer-id">{viewCustomer.displayId}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-label">Name</span>
                    <span className="modal-value">{viewCustomer.name}</span>
                  </div>
                </div>
                <div className="modal-two-column">
                  <div className="modal-field">
                    <span className="modal-label">Email</span>
                    <span className="modal-value">{viewCustomer.email}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-label">Profile Type</span>
                    <span className="modal-value">{viewCustomer.profileType}</span>
                  </div>
                </div>
                <div className="modal-two-column">
                  <div className="modal-field">
                    <span className="modal-label">Risk Level</span>
                    <span className={`modal-value risk-text risk-text-${viewCustomer.risk.toLowerCase()}`}>{viewCustomer.risk}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-label">KYC Status</span>
                    <span className={`modal-value kyc-text kyc-text-${viewCustomer.kycStatus.toLowerCase()}`}>{viewCustomer.kycStatus}</span>
                  </div>
                </div>
                <div className="modal-two-column">
                  <div className="modal-field">
                    <span className="modal-label">Country</span>
                    <span className="modal-value">{viewCustomer.raw.country || '-'}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-label">Last Activity</span>
                    <span className="modal-value muted">{viewCustomer.lastActivity}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-primary-action" onClick={() => setViewCustomer(null)}>
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
