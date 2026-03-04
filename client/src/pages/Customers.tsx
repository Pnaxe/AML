import React, { useMemo, useState } from 'react'
import { HiOutlineSearch, HiOutlineX, HiOutlineEye, HiOutlinePencil, HiOutlineTrash, HiOutlineUpload, HiOutlineDownload, HiOutlineUserAdd, HiOutlineArrowLeft } from 'react-icons/hi'
import { useToast } from '../contexts/ToastContext'
import './Customers.css'

const MOCK_CUSTOMERS = [
  {
    id: 'CUST-001234',
    name: 'Acme Trading Ltd',
    email: 'xavwe@mailinator.com',
    risk: 'Low',
    kycStatus: 'Verified',
    lastActivity: '11/21/2025',
  },
  {
    id: 'CUST-001235',
    name: 'Green Valley Foods',
    risk: 'Medium',
    kycStatus: 'Verified',
    email: 'contact@greenvalleyfoods.com',
    lastActivity: '11/21/2025',
  },
  {
    id: 'CUST-001236',
    name: 'Sunrise Remittances',
    risk: 'High',
    kycStatus: 'Verified',
    email: 'contact@sunriseremittances.com',
    lastActivity: '11/21/2025',
  },
  {
    id: 'CUST-001237',
    name: 'Nova Retail Bank',
    risk: 'Low',
    kycStatus: 'Verified',
    email: 'contact@novaretailbank.com',
    lastActivity: '11/21/2025',
  },
]

const PAGE_SIZE = 25

type Customer = (typeof MOCK_CUSTOMERS)[number]

export const Customers: React.FC = () => {
  const { showToast } = useToast()
  const [customers, setCustomers] = useState<Customer[]>(MOCK_CUSTOMERS)
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
  const [newRisk, setNewRisk] = useState<Customer['risk']>('Low')
  const [newKycStatus, setNewKycStatus] = useState<Customer['kycStatus']>('Verified')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRisk, setEditRisk] = useState<Customer['risk']>('Low')
  const [editKycStatus, setEditKycStatus] = useState<Customer['kycStatus']>('Verified')
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkImportFormat, setBulkImportFormat] = useState<'csv' | 'excel'>('csv')
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('csv')
  const [exportFileName, setExportFileName] = useState('customers_export')

  const filteredCustomers = useMemo(
    () =>
      customers.filter((cust) => {
        const term = activeSearchTerm.toLowerCase()
        if (
          term &&
          !(
            cust.name.toLowerCase().includes(term) ||
            cust.id.toLowerCase().includes(term) ||
            cust.email.toLowerCase().includes(term)
          )
        ) {
          return false
        }
        if (kycFilter && cust.kycStatus.toLowerCase() !== kycFilter.toLowerCase()) {
          return false
        }
        if (riskFilter && cust.risk.toLowerCase() !== riskFilter.toLowerCase()) {
          return false
        }
        return true
      }),
    [customers, activeSearchTerm, kycFilter, riskFilter]
  )

  const totalCustomers = filteredCustomers.length
  const totalPages = Math.max(1, Math.ceil(totalCustomers / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageCustomers = filteredCustomers.slice(startIndex, startIndex + PAGE_SIZE)

  const displayStart = totalCustomers === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageCustomers.length

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

  const handleOpenAddModal = () => {
    setShowAddModal(true)
  }

  const handleOpenViewModal = (cust: Customer) => setViewCustomer(cust)
  const handleCloseViewModal = () => setViewCustomer(null)

  const handleOpenEditModal = (cust: Customer) => {
    setEditCustomer(cust)
    setEditName(cust.name)
    setEditEmail(cust.email)
    setEditRisk(cust.risk)
    setEditKycStatus(cust.kycStatus)
  }
  const handleCloseEditModal = () => {
    setEditCustomer(null)
    setEditName('')
    setEditEmail('')
    setEditRisk('Low')
    setEditKycStatus('Verified')
  }

  const handleOpenDeleteModal = (cust: Customer) => setDeleteCustomer(cust)
  const handleCloseDeleteModal = () => setDeleteCustomer(null)

  const handleCloseAddModal = () => {
    setShowAddModal(false)
    setNewName('')
    setNewEmail('')
    setNewRisk('Low')
    setNewKycStatus('Verified')
  }

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newEmail.trim()) {
      return
    }

    const nextIndex = customers.length + 1
    const newId = `CUST-${(1234 + nextIndex).toString().padStart(6, '0')}`

    const today = new Date()
    const lastActivity = today.toLocaleDateString('en-US')

    const newCustomer: Customer = {
      id: newId,
      name: newName.trim(),
      email: newEmail.trim(),
      risk: newRisk,
      kycStatus: newKycStatus,
      lastActivity,
    }

    setCustomers((prev) => [newCustomer, ...prev])
    setCurrentPage(1)
    handleCloseAddModal()
    showToast(`Customer "${newCustomer.name}" added successfully.`)
  }

  const handleUpdateCustomer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editCustomer || !editName.trim() || !editEmail.trim()) return
    const today = new Date().toLocaleDateString('en-US')
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === editCustomer.id
          ? { ...c, name: editName.trim(), email: editEmail.trim(), risk: editRisk, kycStatus: editKycStatus, lastActivity: today }
          : c
      )
    )
    handleCloseEditModal()
    showToast(`Customer "${editName.trim()}" updated successfully.`)
  }

  const handleConfirmDelete = () => {
    if (!deleteCustomer) return
    const name = deleteCustomer.name
    setCustomers((prev) => prev.filter((c) => c.id !== deleteCustomer.id))
    handleCloseDeleteModal()
    setCurrentPage(1)
    showToast(`Customer "${name}" deleted successfully.`)
  }

  const handleDownloadBulkTemplate = () => {
    const header = ['Customer ID', 'Name', 'Email', 'Risk Level', 'KYC Status'].join(',')
    const sample = ['CUST-001999', 'Example Customer Ltd', 'customer@example.com', 'Low', 'Verified'].join(',')
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
    const rows = customers.map((c) =>
      [
        c.id,
        c.name,
        c.email,
        c.risk,
        c.kycStatus,
        c.lastActivity,
      ].join(',')
    )
    const csvContent = `${header}\n${rows.join('\n')}\n`
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    // We currently generate a CSV file; Excel can open CSV directly.
    // Always use .csv extension to avoid invalid .xlsx errors.
    link.download = `${safeBaseName}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setShowExportModal(false)
  }

  return (
    <div className="reports-container">
      {/* Page title + primary action on main background */}
      <header className="customers-header">
        <div>
          <h1 className="customers-title">{showBulkImport ? 'Bulk Import Customers' : 'Customers'}</h1>
          <p className="customers-subtitle">
            {showBulkImport
              ? 'Upload and validate existing customers in bulk.'
              : 'Customer Management &amp; KYC Verification.'}
          </p>
        </div>
        <div className="customers-header-actions">
          {showBulkImport ? (
            <button
              type="button"
              className="btn-secondary-action btn-with-icon"
              onClick={() => setShowBulkImport(false)}
            >
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
              <button
                className="btn-import-action btn-with-icon"
                type="button"
                onClick={() => {
                  setShowBulkImport(true)
                }}
              >
                <HiOutlineUpload size={16} aria-hidden />
                <span>Bulk Import</span>
              </button>
              <button className="btn-primary-action btn-with-icon" onClick={handleOpenAddModal}>
                <HiOutlineUserAdd size={16} aria-hidden />
                <span>Add Existing Customer</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Bulk Import page (shares container/card style with KYC) */}
      {showBulkImport ? (
        <div className="customers-container">
          <div className="customers-table-card-outer bulk-import-card">
            <div className="bulk-import-body">
              <div className="bulk-import-intro">
                <h2 className="bulk-import-title">Import existing customers from CSV</h2>
                <p className="bulk-import-text">
                  Upload a CSV file with your existing customers to quickly populate the Customers table.
                  Use the template to ensure column names and formats are correct.
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
                    <button
                      type="button"
                      className="btn-primary-action"
                    >
                      Choose file
                    </button>
                  </div>
                  <p className="bulk-import-hint">
                    Supported formats: <strong>.csv</strong> and <strong>.xlsx</strong>. Max 10,000 rows per upload.
                  </p>
                </div>
                <div className="bulk-import-sidebar">
                  <h3 className="bulk-import-sidebar-title">Template &amp; mapping</h3>
                  <p className="bulk-import-text">
                    Start by downloading a sample CSV template with the recommended columns:
                    <strong> Customer ID</strong>, <strong>Name</strong>, <strong>Email</strong>,{' '}
                    <strong>Risk Level</strong>, and <strong>KYC Status</strong>.
                  </p>
                  <button
                    type="button"
                    className="btn-outline-action btn-with-icon"
                    onClick={handleDownloadBulkTemplate}
                  >
                    <HiOutlineDownload size={16} aria-hidden />
                    <span>Download template</span>
                  </button>
                  <ul className="bulk-import-list">
                    <li>Risk Level: one of Low, Medium, High.</li>
                    <li>KYC Status: one of Verified, Pending, Failed.</li>
                    <li>Emails must be valid email addresses.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Filters + table containers with spacing below header */
        <div className="customers-container">

          {/* Filters container */}
          <div className="customers-filters-card report-filters">
            <div className="report-filters-left">
              {/* Search */}
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

              {/* KYC filter */}
              <div className="filter-group">
                <span className="filter-label">KYC Status:</span>
                <select
                  className="filter-input"
                  value={kycFilter}
                  onChange={(e) => {
                    setKycFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                >
                  <option value="">All</option>
                  <option value="Verified">Verified</option>
                  <option value="Pending">Pending</option>
                  <option value="Failed">Failed</option>
                </select>
              </div>

              {/* Risk filter */}
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
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table container */}
          <div className="customers-table-card-outer">
            <div className="report-content-container ecl-table-container">
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
                  {pageCustomers.map((cust) => (
                    <tr key={cust.id}>
                      <td className="customer-id">{cust.id}</td>
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
                          <HiOutlineEye
                            size={18}
                            className="action-icon action-icon-view"
                            onClick={() => handleOpenViewModal(cust)}
                            title="View customer"
                          />
                          <HiOutlinePencil
                            size={18}
                            className="action-icon action-icon-edit"
                            onClick={() => handleOpenEditModal(cust)}
                            title="Edit customer"
                          />
                          <HiOutlineTrash
                            size={18}
                            className="action-icon action-icon-delete"
                            onClick={() => handleOpenDeleteModal(cust)}
                            title="Delete customer"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* placeholder rows to keep table height consistent; 7 cells so vertical borders show */}
                  {Array.from({ length: Math.max(0, PAGE_SIZE - pageCustomers.length) }).map((_, idx) => (
                    <tr key={`empty-${idx}`}>
                      {Array.from({ length: 7 }).map((_, cellIdx) => (
                        <td key={cellIdx}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="ecl-table-footer">
              <div className="table-footer-left">
                Showing {displayStart} to {displayEnd} of {totalCustomers} results.
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
                    <button
                      type="button"
                      className={`export-format-btn ${exportFormat === 'csv' ? 'is-active' : ''}`}
                      onClick={() => setExportFormat('csv')}
                    >
                      CSV (.csv)
                    </button>
                    <button
                      type="button"
                      className={`export-format-btn ${exportFormat === 'excel' ? 'is-active' : ''}`}
                      onClick={() => setExportFormat('excel')}
                    >
                      Excel (.xlsx)
                    </button>
                  </div>
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="exportFileName">File name</label>
                  <input
                    id="exportFileName"
                    type="text"
                    className="modal-input"
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    placeholder="customers_export"
                  />
                </div>
                <p className="bulk-import-text">
                  All customers in the list will be exported with their ID, name, email, risk level, KYC status, and last activity date.
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
        <div className="modal-backdrop" onClick={handleCloseAddModal}>
          <div
            className="modal-panel"
            onClick={(e) => {
              e.stopPropagation()
            }}
          >
            <div className="modal-header">
              <h2 className="modal-title">Add New Customer</h2>
              <button className="modal-close-btn" onClick={handleCloseAddModal} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <form className="modal-form" onSubmit={handleCreateCustomer}>
              <div className="modal-body">
                <div className="modal-field">
                  <label className="modal-label" htmlFor="newCustomerName">
                    Name
                  </label>
                  <input
                    id="newCustomerName"
                    type="text"
                    className="modal-input"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Acme Trading Ltd"
                    autoFocus
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="newCustomerEmail">
                    Email
                  </label>
                  <input
                    id="newCustomerEmail"
                    type="email"
                    className="modal-input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="compliance@customer.com"
                  />
                </div>
                <div className="modal-two-column">
                  <div className="modal-field">
                    <label className="modal-label" htmlFor="newCustomerRisk">
                      Risk Level
                    </label>
                    <select
                      id="newCustomerRisk"
                      className="modal-input"
                      value={newRisk}
                      onChange={(e) => setNewRisk(e.target.value as Customer['risk'])}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label" htmlFor="newCustomerKyc">
                      KYC Status
                    </label>
                    <select
                      id="newCustomerKyc"
                      className="modal-input"
                      value={newKycStatus}
                      onChange={(e) => setNewKycStatus(e.target.value as Customer['kycStatus'])}
                    >
                      <option value="Verified">Verified</option>
                      <option value="Pending">Pending</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={handleCloseAddModal}>
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
                  <span className="modal-value customer-id">{editCustomer.id}</span>
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="editCustomerName">Name</label>
                  <input
                    id="editCustomerName"
                    type="text"
                    className="modal-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Acme Trading Ltd"
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label" htmlFor="editCustomerEmail">Email</label>
                  <input
                    id="editCustomerEmail"
                    type="email"
                    className="modal-input"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="compliance@customer.com"
                  />
                </div>
                <div className="modal-two-column">
                  <div className="modal-field">
                    <label className="modal-label" htmlFor="editCustomerRisk">Risk Level</label>
                    <select
                      id="editCustomerRisk"
                      className="modal-input"
                      value={editRisk}
                      onChange={(e) => setEditRisk(e.target.value as Customer['risk'])}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label" htmlFor="editCustomerKyc">KYC Status</label>
                    <select
                      id="editCustomerKyc"
                      className="modal-input"
                      value={editKycStatus}
                      onChange={(e) => setEditKycStatus(e.target.value as Customer['kycStatus'])}
                    >
                      <option value="Verified">Verified</option>
                      <option value="Pending">Pending</option>
                      <option value="Failed">Failed</option>
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
        <div className="modal-backdrop" onClick={handleCloseDeleteModal}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Customer</h2>
              <button className="modal-close-btn" onClick={handleCloseDeleteModal} aria-label="Close">
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
                <button type="button" className="btn-secondary-action" onClick={handleCloseDeleteModal}>
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
        <div className="modal-backdrop" onClick={handleCloseViewModal}>
          <div
            className="modal-panel modal-panel-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">View Customer</h2>
              <button className="modal-close-btn" onClick={handleCloseViewModal} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="modal-two-column">
                  <div className="modal-field">
                    <span className="modal-label">Customer ID</span>
                    <span className="modal-value customer-id">{viewCustomer.id}</span>
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
                    <span className="modal-label">Risk Level</span>
                    <span className={`modal-value risk-text risk-text-${viewCustomer.risk.toLowerCase()}`}>{viewCustomer.risk}</span>
                  </div>
                </div>
                <div className="modal-two-column">
                  <div className="modal-field">
                    <span className="modal-label">KYC Status</span>
                    <span className={`modal-value kyc-text kyc-text-${viewCustomer.kycStatus.toLowerCase()}`}>{viewCustomer.kycStatus}</span>
                  </div>
                  <div className="modal-field">
                    <span className="modal-label">Last Activity</span>
                    <span className="modal-value muted">{viewCustomer.lastActivity}</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-primary-action" onClick={handleCloseViewModal}>
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

