import React, { useMemo, useState } from 'react'
import { HiOutlinePencil, HiOutlineSearch, HiOutlineTrash, HiOutlineX } from 'react-icons/hi'
import { useToast } from '../contexts/ToastContext'
import './Customers.css'

type AmlConfig = {
  environment: 'development' | 'staging' | 'production'
  coreApiBaseUrl: string
  transactionFeedApiKey: string
  screeningApiKey: string
  watchlistApiKey: string
  blacklistApiKey: string
  modelRegistryApiKey: string
  dbHost: string
  dbPort: string
  dbName: string
  dbUser: string
  dbPassword: string
  dbSslEnabled: boolean
  redisHost: string
  redisPort: string
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPassword: string
  smtpFromEmail: string
  amlRiskThresholdHigh: string
  amlRiskThresholdMedium: string
  autoScreeningEnabled: boolean
  autoSarEnabled: boolean
  modelMonitoringEnabled: boolean
  updatedAt: string
}

const STORAGE_KEY = 'aml_system_config_v1'
const PAGE_SIZE = 25

const defaultConfig: AmlConfig = {
  environment: 'development',
  coreApiBaseUrl: 'http://localhost:8000/api',
  transactionFeedApiKey: '',
  screeningApiKey: '',
  watchlistApiKey: '',
  blacklistApiKey: '',
  modelRegistryApiKey: '',
  dbHost: 'localhost',
  dbPort: '5432',
  dbName: 'aml_database',
  dbUser: 'postgres',
  dbPassword: '',
  dbSslEnabled: false,
  redisHost: 'localhost',
  redisPort: '6379',
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPassword: '',
  smtpFromEmail: '',
  amlRiskThresholdHigh: '0.70',
  amlRiskThresholdMedium: '0.40',
  autoScreeningEnabled: true,
  autoSarEnabled: true,
  modelMonitoringEnabled: true,
  updatedAt: '',
}

type ConfigRow = {
  category: string
  key: string
  value: string
  field: keyof AmlConfig
}

type ConfigurationsVariant = 'system' | 'email' | 'risk' | 'api'

type ConfigurationsProps = {
  variant?: ConfigurationsVariant
}

function parseStoredConfig(raw: string | null): AmlConfig {
  if (!raw) return defaultConfig
  try {
    const parsed = JSON.parse(raw) as Partial<AmlConfig>
    return { ...defaultConfig, ...parsed }
  } catch {
    return defaultConfig
  }
}

function maskValue(value: string): string {
  if (!value) return '-'
  if (value.length <= 4) return '****'
  return `${'*'.repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`
}

function fmtDate(value: string): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-US')
}

export const Configurations: React.FC<ConfigurationsProps> = ({ variant = 'system' }) => {
  const { showToast } = useToast()
  const [config, setConfig] = useState<AmlConfig>(() => parseStoredConfig(localStorage.getItem(STORAGE_KEY)))
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [selectedRow, setSelectedRow] = useState<ConfigRow | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editBoolean, setEditBoolean] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const pageTitle =
    variant === 'email'
      ? 'Email & Notifications'
      : variant === 'risk'
        ? 'Risk & Automation'
        : variant === 'api'
          ? 'API Keys'
          : 'System & Database'
  const pageSubtitle =
    variant === 'email'
      ? 'Configure outbound mail delivery used for alerts, notifications, and analyst communication.'
      : variant === 'risk'
        ? 'Manage AML thresholds and automation switches that control screening, SAR, and model monitoring.'
        : variant === 'api'
          ? 'Secure and manage external integration credentials for transaction feeds, screening, and model registry access.'
          : 'Manage environment, core API, database, and Redis settings for the platform runtime.'

  const rows = useMemo<ConfigRow[]>(() => {
    const secret = (v: string) => maskValue(v)
    return [
      { category: 'System', key: 'Environment', value: config.environment, field: 'environment' },
      { category: 'System', key: 'Core API Base URL', value: config.coreApiBaseUrl || '-', field: 'coreApiBaseUrl' },
      { category: 'System', key: 'Auto Screening', value: config.autoScreeningEnabled ? 'Enabled' : 'Disabled', field: 'autoScreeningEnabled' },
      { category: 'System', key: 'Auto SAR', value: config.autoSarEnabled ? 'Enabled' : 'Disabled', field: 'autoSarEnabled' },
      { category: 'System', key: 'Model Monitoring', value: config.modelMonitoringEnabled ? 'Enabled' : 'Disabled', field: 'modelMonitoringEnabled' },
      { category: 'Risk', key: 'High Threshold', value: config.amlRiskThresholdHigh || '-', field: 'amlRiskThresholdHigh' },
      { category: 'Risk', key: 'Medium Threshold', value: config.amlRiskThresholdMedium || '-', field: 'amlRiskThresholdMedium' },
      { category: 'API Keys', key: 'Transaction Feed API Key', value: secret(config.transactionFeedApiKey), field: 'transactionFeedApiKey' },
      { category: 'API Keys', key: 'Screening API Key', value: secret(config.screeningApiKey), field: 'screeningApiKey' },
      { category: 'API Keys', key: 'Watchlist DB API Key', value: secret(config.watchlistApiKey), field: 'watchlistApiKey' },
      { category: 'API Keys', key: 'Blacklist API Key', value: secret(config.blacklistApiKey), field: 'blacklistApiKey' },
      { category: 'API Keys', key: 'Model Registry API Key', value: secret(config.modelRegistryApiKey), field: 'modelRegistryApiKey' },
      { category: 'Database', key: 'DB Host', value: config.dbHost || '-', field: 'dbHost' },
      { category: 'Database', key: 'DB Port', value: config.dbPort || '-', field: 'dbPort' },
      { category: 'Database', key: 'DB Name', value: config.dbName || '-', field: 'dbName' },
      { category: 'Database', key: 'DB User', value: config.dbUser || '-', field: 'dbUser' },
      { category: 'Database', key: 'DB Password', value: secret(config.dbPassword), field: 'dbPassword' },
      { category: 'Database', key: 'DB SSL', value: config.dbSslEnabled ? 'Enabled' : 'Disabled', field: 'dbSslEnabled' },
      { category: 'Database', key: 'Redis Host', value: config.redisHost || '-', field: 'redisHost' },
      { category: 'Database', key: 'Redis Port', value: config.redisPort || '-', field: 'redisPort' },
      { category: 'Email', key: 'SMTP Host', value: config.smtpHost || '-', field: 'smtpHost' },
      { category: 'Email', key: 'SMTP Port', value: config.smtpPort || '-', field: 'smtpPort' },
      { category: 'Email', key: 'SMTP User', value: config.smtpUser || '-', field: 'smtpUser' },
      { category: 'Email', key: 'SMTP Password', value: secret(config.smtpPassword), field: 'smtpPassword' },
      { category: 'Email', key: 'From Email', value: config.smtpFromEmail || '-', field: 'smtpFromEmail' },
    ]
  }, [config])

  const visibleCategories = useMemo(() => {
    if (variant === 'email') return ['Email']
    if (variant === 'risk') return ['Risk', 'System']
    if (variant === 'api') return ['API Keys']
    return ['System', 'Database']
  }, [variant])

  const scopedRows = useMemo(
    () => rows.filter((row) => visibleCategories.includes(row.category)),
    [rows, visibleCategories],
  )

  const filteredRows = useMemo(() => {
    const term = activeSearchTerm.toLowerCase()
    if (!term) return scopedRows
    return scopedRows.filter((row) =>
      `${row.category} ${row.key} ${row.value}`.toLowerCase().includes(term),
    )
  }, [scopedRows, activeSearchTerm])

  const totalRecords = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const startIndex = (safePage - 1) * PAGE_SIZE
  const pageRows = filteredRows.slice(startIndex, startIndex + PAGE_SIZE)
  const displayStart = totalRecords === 0 ? 0 : startIndex + 1
  const displayEnd = startIndex + pageRows.length

  const booleanFields: Array<keyof AmlConfig> = ['dbSslEnabled', 'autoScreeningEnabled', 'autoSarEnabled', 'modelMonitoringEnabled']
  const secretFields: Array<keyof AmlConfig> = ['transactionFeedApiKey', 'screeningApiKey', 'watchlistApiKey', 'blacklistApiKey', 'modelRegistryApiKey', 'dbPassword', 'smtpPassword']
  const isBooleanField = (field: keyof AmlConfig) => booleanFields.includes(field)
  const isSecretField = (field: keyof AmlConfig) => secretFields.includes(field)

  const openEditModal = (row: ConfigRow) => {
    setSelectedRow(row)
    if (isBooleanField(row.field)) {
      setEditBoolean(Boolean(config[row.field] as boolean))
    } else {
      setEditValue(String(config[row.field] ?? ''))
    }
  }

  const saveRowValue = () => {
    if (!selectedRow) return
    const field = selectedRow.field
    const nextValue = isBooleanField(field)
      ? editBoolean
      : field === 'environment'
        ? (editValue as AmlConfig['environment'])
        : editValue

    const nextConfig = {
      ...config,
      [field]: nextValue,
      updatedAt: new Date().toISOString(),
    } as AmlConfig

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig))
    setConfig(nextConfig)
    setSelectedRow(null)
    setEditValue('')
    showToast(`${selectedRow.key} updated.`)
  }

  const clearApiKey = (row: ConfigRow) => {
    if (row.category !== 'API Keys') return
    const nextConfig = {
      ...config,
      [row.field]: '',
      updatedAt: new Date().toISOString(),
    } as AmlConfig

    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig))
    setConfig(nextConfig)
    showToast(`${row.key} deleted.`)
  }

  return (
    <div className="reports-container config-page">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">{pageTitle}</h1>
          <p className="customers-subtitle">{pageSubtitle}</p>
        </div>
      </header>

      <div className="customers-container">
        <div className="customers-filters-card report-filters">
          <div className="report-filters-left">
            <form onSubmit={(e) => { e.preventDefault(); setActiveSearchTerm(searchTerm.trim()); setCurrentPage(1) }} className="filter-group filter-group-search">
              <div className="search-input-wrapper">
                <span className="search-icon" aria-hidden><HiOutlineSearch size={18} /></span>
                <input
                  type="text"
                  className="filter-input search-input"
                  placeholder="Search configuration key or value..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button type="button" className="search-clear-btn" onClick={() => { setSearchTerm(''); setActiveSearchTerm(''); setCurrentPage(1) }}>
                    <HiOutlineX size={18} />
                  </button>
                )}
              </div>
            </form>
            <div className="filter-group">
              <span className="filter-label">Last Saved:</span>
              <span className="modal-value">{fmtDate(config.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div className={`customers-table-card-outer config-summary-card ${pageRows.length === 0 ? 'table-empty-state' : ''}`}>
          {pageRows.length === 0 && (
            <div className="table-empty-watermark" aria-hidden="true">
              <HiOutlinePencil size={42} />
              <span>No Configuration Items</span>
            </div>
          )}
          <div className="report-content-container ecl-table-container">
            <table className="ecl-table">
              <thead>
                <tr>
                  <th>CATEGORY</th>
                  <th>KEY</th>
                  <th>VALUE</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => (
                  <tr key={`${row.category}-${row.key}-${idx}`}>
                    <td>{row.category}</td>
                    <td className="customer-id">{row.key}</td>
                    <td className="muted">{row.value}</td>
                    <td>
                      <div className="customers-actions">
                        <HiOutlinePencil
                          size={18}
                          className="action-icon action-icon-edit"
                          onClick={() => openEditModal(row)}
                          title="Edit setting"
                        />
                        {row.category === 'API Keys' && (
                          <HiOutlineTrash
                            size={18}
                            className="action-icon action-icon-delete"
                            onClick={() => clearApiKey(row)}
                            title="Delete API key"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, PAGE_SIZE - pageRows.length) }).map((_, idx) => (
                  <tr key={`empty-${idx}`}>{Array.from({ length: 4 }).map((__, c) => <td key={c}>&nbsp;</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ecl-table-footer">
            <div className="table-footer-left">Showing {displayStart} to {displayEnd} of {totalRecords} configuration items.</div>
            <div className="table-footer-right">
              {totalPages > 1 ? (
                <div className="pagination-controls">
                  <button type="button" className="pagination-btn" disabled={safePage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>Previous</button>
                  <span className="pagination-info">Page {safePage} of {totalPages}</span>
                  <button type="button" className="pagination-btn" disabled={safePage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>Next</button>
                </div>
              ) : (
                <span>All data displayed</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedRow && (
        <div className="modal-backdrop" onClick={() => { setSelectedRow(null); setEditValue('') }}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Configuration</h2>
              <button type="button" className="modal-close-btn" onClick={() => { setSelectedRow(null); setEditValue('') }} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="config-section-header">
                  <h2 className="config-section-title">{selectedRow.key}</h2>
                  <p className="config-section-description">
                    Update the selected {selectedRow.category.toLowerCase()} setting and save the new value.
                  </p>
                </div>
                <div className="modal-two-column">
                  <div className="modal-field">
                    <label className="modal-label">Category</label>
                    <input className="modal-input" value={selectedRow.category} readOnly />
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Last Saved</label>
                    <input className="modal-input" value={fmtDate(config.updatedAt)} readOnly />
                  </div>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Value</label>
                  {selectedRow.field === 'environment' ? (
                    <select className="modal-input" value={editValue} onChange={(e) => setEditValue(e.target.value)}>
                      <option value="development">development</option>
                      <option value="staging">staging</option>
                      <option value="production">production</option>
                    </select>
                  ) : isBooleanField(selectedRow.field) ? (
                    <label className="modal-field">
                      <span className="modal-label">Enabled</span>
                      <input type="checkbox" checked={editBoolean} onChange={(e) => setEditBoolean(e.target.checked)} />
                    </label>
                  ) : (
                    <input
                      type={isSecretField(selectedRow.field) ? 'password' : 'text'}
                      className="modal-input"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder={`Enter ${selectedRow.key.toLowerCase()}`}
                    />
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => { setSelectedRow(null); setEditValue('') }}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={saveRowValue}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
