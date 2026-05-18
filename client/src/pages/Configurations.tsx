import React, { useEffect, useMemo, useState } from 'react'
import { HiOutlineKey, HiOutlinePencil, HiOutlineSearch, HiOutlineTrash, HiOutlineX } from 'react-icons/hi'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import './Customers.css'

type AmlConfig = {
  environment: 'development' | 'staging' | 'production'
  coreApiBaseUrl: string
  transactionFeedApiKey: string
  screeningApiKey: string
  watchlistApiKey: string
  blacklistApiKey: string
  modelRegistryApiKey: string
  customApiKeys: ApiKeyRecord[]
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

type ApiKeyRecord = {
  id: string
  name: string
  key: string
  createdAt: string
}

const PAGE_SIZE = 25
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'

const defaultConfig: AmlConfig = {
  environment: 'development',
  coreApiBaseUrl: 'http://localhost:8000/api',
  transactionFeedApiKey: '',
  screeningApiKey: '',
  watchlistApiKey: '',
  blacklistApiKey: '',
  modelRegistryApiKey: '',
  customApiKeys: [],
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
  field?: keyof AmlConfig
  apiKeyId?: string
  rawValue?: string
  isCustomApiKey?: boolean
}

type ConfigurationsVariant = 'system' | 'email' | 'risk' | 'api'

type ConfigurationsProps = {
  variant?: ConfigurationsVariant
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
  const { token } = useAuth()
  const [config, setConfig] = useState<AmlConfig>(defaultConfig)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [selectedRow, setSelectedRow] = useState<ConfigRow | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editApiKeyName, setEditApiKeyName] = useState('')
  const [editBoolean, setEditBoolean] = useState(false)
  const [isAddApiKeyOpen, setIsAddApiKeyOpen] = useState(false)
  const [addApiKeyName, setAddApiKeyName] = useState('')
  const [addApiKeyValue, setAddApiKeyValue] = useState('')
  const [deleteApiKeyRow, setDeleteApiKeyRow] = useState<ConfigRow | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadConfig = async () => {
      setIsLoading(true)
      try {
        const headers: Record<string, string> = {}
        if (token) headers.Authorization = `Token ${token}`
        const response = await fetch(`${API_BASE_URL}/system-config/`, { headers })
        if (!response.ok) throw new Error('Failed to load configuration')
        const payload = (await response.json()) as Partial<AmlConfig>
        setConfig({ ...defaultConfig, ...payload })
      } catch (error) {
        console.error(error)
        showToast('Unable to load system configuration.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadConfig()
  }, [showToast, token])

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
      { category: 'API Keys', key: 'Transaction Feed API Key', value: secret(config.transactionFeedApiKey), rawValue: config.transactionFeedApiKey, field: 'transactionFeedApiKey' },
      { category: 'API Keys', key: 'Screening API Key', value: secret(config.screeningApiKey), rawValue: config.screeningApiKey, field: 'screeningApiKey' },
      { category: 'API Keys', key: 'Watchlist DB API Key', value: secret(config.watchlistApiKey), rawValue: config.watchlistApiKey, field: 'watchlistApiKey' },
      { category: 'API Keys', key: 'Blacklist API Key', value: secret(config.blacklistApiKey), rawValue: config.blacklistApiKey, field: 'blacklistApiKey' },
      { category: 'API Keys', key: 'Model Registry API Key', value: secret(config.modelRegistryApiKey), rawValue: config.modelRegistryApiKey, field: 'modelRegistryApiKey' },
      ...config.customApiKeys.map((apiKey) => ({
        category: 'API Keys',
        key: apiKey.name,
        value: secret(apiKey.key),
        rawValue: apiKey.key,
        apiKeyId: apiKey.id,
        isCustomApiKey: true,
      })),
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
    () => rows.filter((row) => {
      if (!visibleCategories.includes(row.category)) return false
      if (variant !== 'api' || row.category !== 'API Keys') return true
      return row.isCustomApiKey || !!row.rawValue?.trim()
    }),
    [rows, variant, visibleCategories],
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
  const isBooleanField = (field?: keyof AmlConfig) => !!field && booleanFields.includes(field)
  const isSecretField = (field?: keyof AmlConfig) => !!field && secretFields.includes(field)

  const openAddApiKeyModal = () => {
    setAddApiKeyName('')
    setAddApiKeyValue('')
    setIsAddApiKeyOpen(true)
  }

  const openEditModal = (row: ConfigRow) => {
    setSelectedRow(row)
    if (row.isCustomApiKey) {
      setEditApiKeyName(row.key)
      setEditValue(row.rawValue ?? '')
    } else if (isBooleanField(row.field)) {
      setEditBoolean(Boolean(config[row.field as keyof AmlConfig] as boolean))
    } else if (row.field) {
      setEditValue(String(config[row.field] ?? ''))
    }
  }

  const saveRowValue = async () => {
    if (!selectedRow) return
    if (selectedRow.isCustomApiKey) {
      const nextConfig = {
        ...config,
        customApiKeys: config.customApiKeys.map((apiKey) =>
          apiKey.id === selectedRow.apiKeyId
            ? { ...apiKey, name: editApiKeyName.trim(), key: editValue.trim() }
            : apiKey,
        ),
        updatedAt: new Date().toISOString(),
      } as AmlConfig

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers.Authorization = `Token ${token}`
        const response = await fetch(`${API_BASE_URL}/system-config/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(nextConfig),
        })
        if (!response.ok) throw new Error('Failed to save API key')
        const saved = (await response.json()) as Partial<AmlConfig>
        setConfig({ ...defaultConfig, ...saved })
        setSelectedRow(null)
        setEditApiKeyName('')
        setEditValue('')
        showToast(`${editApiKeyName.trim()} updated.`)
      } catch (error) {
        console.error(error)
        showToast(`Unable to update ${selectedRow.key}.`)
      }
      return
    }

    if (!selectedRow.field) return
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

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Token ${token}`
      const response = await fetch(`${API_BASE_URL}/system-config/`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(nextConfig),
      })
      if (!response.ok) throw new Error('Failed to save configuration')
      const saved = (await response.json()) as Partial<AmlConfig>
      setConfig({ ...defaultConfig, ...saved })
      setSelectedRow(null)
      setEditValue('')
      showToast(`${selectedRow.key} updated.`)
    } catch (error) {
      console.error(error)
      showToast(`Unable to update ${selectedRow.key}.`)
    }
  }

  const saveNewApiKey = async () => {
    if (!addApiKeyName.trim() || !addApiKeyValue.trim()) return
    const now = new Date().toISOString()
    const nextConfig = {
      ...config,
      customApiKeys: [
        ...config.customApiKeys,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: addApiKeyName.trim(),
          key: addApiKeyValue.trim(),
          createdAt: now,
        },
      ],
      updatedAt: now,
    } as AmlConfig

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Token ${token}`
      const response = await fetch(`${API_BASE_URL}/system-config/`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(nextConfig),
      })
      if (!response.ok) throw new Error('Failed to add API key')
      const saved = (await response.json()) as Partial<AmlConfig>
      setConfig({ ...defaultConfig, ...saved })
      setIsAddApiKeyOpen(false)
      setAddApiKeyName('')
      setAddApiKeyValue('')
      showToast(`${addApiKeyName.trim()} added.`)
    } catch (error) {
      console.error(error)
      showToast(`Unable to add ${addApiKeyName.trim() || 'API key'}.`)
    }
  }

  const confirmDeleteApiKey = async () => {
    const row = deleteApiKeyRow
    if (!row) return
    if (row.category !== 'API Keys') return
    const customApiKeys = row.isCustomApiKey
      ? config.customApiKeys.filter((apiKey) => apiKey.id !== row.apiKeyId)
      : config.customApiKeys
    const nextConfig = {
      ...config,
      ...(row.field ? { [row.field]: '' } : {}),
      customApiKeys,
      updatedAt: new Date().toISOString(),
    } as AmlConfig

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Token ${token}`
      const response = await fetch(`${API_BASE_URL}/system-config/`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(nextConfig),
      })
      if (!response.ok) throw new Error('Failed to clear API key')
      const saved = (await response.json()) as Partial<AmlConfig>
      setConfig({ ...defaultConfig, ...saved })
      setDeleteApiKeyRow(null)
      showToast(`${row.key} deleted.`)
    } catch (error) {
      console.error(error)
      showToast(`Unable to delete ${row.key}.`)
    }
  }

  return (
    <div className="reports-container config-page">
      <header className="customers-header">
        <div>
          <h1 className="customers-title">{pageTitle}</h1>
          <p className="customers-subtitle">{pageSubtitle}</p>
        </div>
        {variant === 'api' && (
          <div className="customers-header-actions">
            <button type="button" className="btn-primary-action btn-with-icon" onClick={openAddApiKeyModal}>
              <HiOutlineKey size={16} aria-hidden="true" />
              <span>Add API Key</span>
            </button>
          </div>
        )}
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

          <div className={`customers-table-card-outer config-summary-card ${!isLoading && pageRows.length === 0 ? 'table-empty-state' : ''}`}>
          {!isLoading && pageRows.length === 0 && (
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
                {isLoading ? (
                  Array.from({ length: PAGE_SIZE }).map((_, idx) => (
                    <tr key={`loading-${idx}`}>{Array.from({ length: 4 }).map((__, c) => <td key={c}>Loading...</td>)}</tr>
                  ))
                ) : pageRows.map((row, idx) => (
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
                            onClick={() => setDeleteApiKeyRow(row)}
                            title="Delete API key"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && Array.from({ length: Math.max(0, PAGE_SIZE - pageRows.length) }).map((_, idx) => (
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
        <div className="modal-backdrop" onClick={() => { setSelectedRow(null); setEditValue(''); setEditApiKeyName('') }}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedRow.isCustomApiKey ? 'Edit API Key' : 'Edit Configuration'}</h2>
              <button type="button" className="modal-close-btn" onClick={() => { setSelectedRow(null); setEditValue(''); setEditApiKeyName('') }} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="config-section-header">
                  <h2 className="config-section-title">{selectedRow.key}</h2>
                  <p className="config-section-description">
                    {selectedRow.isCustomApiKey
                      ? 'Update the display name and secret value for this API key.'
                      : `Update the selected ${selectedRow.category.toLowerCase()} setting and save the new value.`}
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
                {selectedRow.isCustomApiKey && (
                  <div className="modal-field">
                    <label className="modal-label">API Key Name</label>
                    <input
                      className="modal-input"
                      value={editApiKeyName}
                      onChange={(e) => setEditApiKeyName(e.target.value)}
                      placeholder="Enter API key name"
                    />
                  </div>
                )}
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
                <button type="button" className="btn-secondary-action" onClick={() => { setSelectedRow(null); setEditValue(''); setEditApiKeyName('') }}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={saveRowValue}
                  disabled={selectedRow.isCustomApiKey && (!editApiKeyName.trim() || !editValue.trim())}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddApiKeyOpen && (
        <div className="modal-backdrop" onClick={() => { setIsAddApiKeyOpen(false); setAddApiKeyName(''); setAddApiKeyValue('') }}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add API Key</h2>
              <button type="button" className="modal-close-btn" onClick={() => { setIsAddApiKeyOpen(false); setAddApiKeyName(''); setAddApiKeyValue('') }} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="config-section-header">
                  <h2 className="config-section-title">Integration Credential</h2>
                  <p className="config-section-description">
                    Give this credential a clear name and store the secret key used by the external service.
                  </p>
                </div>
                <div className="modal-field">
                  <label className="modal-label">API Key Name</label>
                  <input
                    className="modal-input"
                    value={addApiKeyName}
                    onChange={(e) => setAddApiKeyName(e.target.value)}
                    placeholder="Example: Vendor Screening Key"
                  />
                </div>
                <div className="modal-field">
                  <label className="modal-label">API Key</label>
                  <input
                    type="password"
                    className="modal-input"
                    value={addApiKeyValue}
                    onChange={(e) => setAddApiKeyValue(e.target.value)}
                    placeholder="Enter API key"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => { setIsAddApiKeyOpen(false); setAddApiKeyName(''); setAddApiKeyValue('') }}>Cancel</button>
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={saveNewApiKey}
                  disabled={!addApiKeyName.trim() || !addApiKeyValue.trim()}
                >
                  Save API Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteApiKeyRow && (
        <div className="modal-backdrop" onClick={() => setDeleteApiKeyRow(null)}>
          <div className="modal-panel modal-panel-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete API Key</h2>
              <button type="button" className="modal-close-btn" onClick={() => setDeleteApiKeyRow(null)} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="config-section-header">
                  <h2 className="config-section-title">{deleteApiKeyRow.key}</h2>
                  <p className="config-section-description">
                    This will remove the stored secret for this API key. Any integration using it may stop working until a new key is added.
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={() => setDeleteApiKeyRow(null)}>Cancel</button>
                <button type="button" className="btn-danger-action" onClick={confirmDeleteApiKey}>Delete API Key</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
