import React, { useEffect, useMemo, useState } from 'react'
import {
  HiOutlinePause,
  HiOutlinePencil,
  HiOutlinePlay,
  HiOutlinePlus,
  HiOutlineSearch,
  HiOutlineTrash,
  HiOutlineX,
} from 'react-icons/hi'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import './AlertRulesPanel.css'

type RuleType =
  | 'THRESHOLD'
  | 'STRUCTURING'
  | 'VELOCITY'
  | 'UNUSUAL_PATTERN'
  | 'HIGH_RISK_COUNTRY'
  | 'LARGE_CASH'
  | 'ROUND_AMOUNT'
  | 'RAPID_MOVEMENT'
  | 'PEP'
  | 'SANCTION'
  | 'OTHER'

type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

type AlertRule = {
  id: number
  name: string
  description: string
  rule_type: RuleType
  is_active: boolean
  severity: Severity
  threshold_config: Record<string, unknown>
  updated_at: string
}

type RuleTemplate = {
  id: string
  label: string
  rule_type: RuleType
  severity: Severity
  description: string
  threshold_config: Record<string, unknown>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api'
const PAGE_SIZE = 25

const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'single-large',
    label: 'Single Large Transaction',
    rule_type: 'THRESHOLD',
    severity: 'HIGH',
    description: 'Alert when any transaction reaches the reporting threshold.',
    threshold_config: { metric: 'transaction_amount', amount: 10000 },
  },
  {
    id: 'daily-limit',
    label: 'Daily Deposit Limit',
    rule_type: 'THRESHOLD',
    severity: 'HIGH',
    description: 'Alert when deposits exceed a configured amount in a rolling day.',
    threshold_config: { metric: 'daily_transaction_total', transaction_type: 'DEPOSIT', amount: 5000, period_hours: 24 },
  },
  {
    id: 'daily-withdrawal',
    label: 'Daily Withdrawal Limit',
    rule_type: 'THRESHOLD',
    severity: 'HIGH',
    description: 'Alert when withdrawals exceed a configured amount in a rolling day.',
    threshold_config: { metric: 'daily_transaction_total', transaction_type: 'WITHDRAWAL', amount: 5000, period_hours: 24 },
  },
  {
    id: 'high-value-wire',
    label: 'High-Value Wire Transfer',
    rule_type: 'THRESHOLD',
    severity: 'HIGH',
    description: 'Alert on high-value wire transfers.',
    threshold_config: { metric: 'transaction_amount', transaction_type: 'WIRE', amount: 25000 },
  },
  {
    id: 'high-value-crypto',
    label: 'High-Value Crypto Transaction',
    rule_type: 'THRESHOLD',
    severity: 'HIGH',
    description: 'Alert on high-value cryptocurrency transactions.',
    threshold_config: { metric: 'transaction_amount', transaction_type: 'CRYPTO', amount: 10000 },
  },
  {
    id: 'frequency',
    label: 'Frequency Threshold',
    rule_type: 'VELOCITY',
    severity: 'HIGH',
    description: 'Alert when too many transactions occur in a short window.',
    threshold_config: { count: 5, period_hours: 24 },
  },
  {
    id: 'burst',
    label: 'One-Hour Burst Activity',
    rule_type: 'VELOCITY',
    severity: 'MEDIUM',
    description: 'Alert when several transactions occur within one hour.',
    threshold_config: { count: 3, period_hours: 1 },
  },
  {
    id: 'structuring',
    label: 'Structuring Rule',
    rule_type: 'STRUCTURING',
    severity: 'HIGH',
    description: 'Alert when several deposits sit just below the reporting limit.',
    threshold_config: { reporting_limit: 10000, below_percent: 90, min_transactions: 3, period_hours: 24 },
  },
  {
    id: 'extended-structuring',
    label: 'Extended Structuring Pattern',
    rule_type: 'STRUCTURING',
    severity: 'HIGH',
    description: 'Alert on repeated threshold-avoidance over a week.',
    threshold_config: { reporting_limit: 10000, below_percent: 80, min_transactions: 5, period_hours: 168 },
  },
  {
    id: 'country-risk',
    label: 'Country Risk',
    rule_type: 'HIGH_RISK_COUNTRY',
    severity: 'CRITICAL',
    description: 'Alert when funds move to or from high-risk jurisdictions.',
    threshold_config: { countries: ['AF', 'IR', 'KP', 'SY', 'YE'] },
  },
  {
    id: 'customer-risk',
    label: 'Customer Risk Level',
    rule_type: 'OTHER',
    severity: 'HIGH',
    description: 'Apply lower thresholds for customers already rated high risk.',
    threshold_config: { metric: 'customer_risk_level', risk_levels: ['HIGH', 'CRITICAL'], risk_score: 0.4, amount: 2500 },
  },
  {
    id: 'dormant',
    label: 'Dormant Account Activity',
    rule_type: 'UNUSUAL_PATTERN',
    severity: 'HIGH',
    description: 'Alert when an inactive account suddenly receives or sends a large transaction.',
    threshold_config: { metric: 'dormant_account_activity', inactive_days: 90, amount: 5000 },
  },
  {
    id: 'cash-ratio',
    label: 'Cash Ratio',
    rule_type: 'LARGE_CASH',
    severity: 'MEDIUM',
    description: 'Alert when cash-like activity dominates recent transactions.',
    threshold_config: {
      cash_ratio_percent: 70,
      period_days: 30,
      cash_transaction_types: ['DEPOSIT', 'WITHDRAWAL', 'ATM'],
      cash_channels: ['CASH', 'ATM', 'BRANCH'],
    },
  },
  {
    id: 'round-amount',
    label: 'Round Amount Pattern',
    rule_type: 'ROUND_AMOUNT',
    severity: 'MEDIUM',
    description: 'Alert on large round-number transactions.',
    threshold_config: { amount: 5000, multiple: 1000 },
  },
  {
    id: 'rapid-movement',
    label: 'Rapid Movement of Funds',
    rule_type: 'RAPID_MOVEMENT',
    severity: 'HIGH',
    description: 'Alert when money appears to move in and out quickly.',
    threshold_config: { amount: 5000, period_hours: 48 },
  },
  {
    id: 'pep',
    label: 'PEP Customer Activity',
    rule_type: 'PEP',
    severity: 'HIGH',
    description: 'Alert on activity involving politically exposed persons.',
    threshold_config: { match_sender: true, match_receiver: true },
  },
  {
    id: 'sanction',
    label: 'Sanctioned Customer Activity',
    rule_type: 'SANCTION',
    severity: 'CRITICAL',
    description: 'Alert on activity involving sanctioned customers.',
    threshold_config: { match_sender: true, match_receiver: true },
  },
]

function rowsOf<T>(payload: { results?: T[] } | T[]): T[] {
  return Array.isArray(payload) ? payload : payload.results ?? []
}

function formatRuleValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value === null || value === undefined || value === '') return '-'
  return String(value)
}

function summarizeConfig(config: Record<string, unknown>): string {
  return Object.entries(config)
    .filter(([key]) => key !== 'metric')
    .map(([key, value]) => `${key.replaceAll('_', ' ')}: ${formatRuleValue(value)}`)
    .join(' | ')
}

function normalizeConfigForApi(config: Record<string, string>, template: RuleTemplate): Record<string, unknown> {
  const next: Record<string, unknown> = {}
  Object.entries(config).forEach(([key, value]) => {
    if (key === 'countries' || key === 'risk_levels' || key === 'cash_transaction_types' || key === 'cash_channels') {
      next[key] = value.split(',').map((part) => part.trim().toUpperCase()).filter(Boolean)
      return
    }
    if (['amount', 'period_hours', 'count', 'reporting_limit', 'below_percent', 'min_transactions', 'risk_score', 'inactive_days', 'cash_ratio_percent', 'period_days', 'multiple'].includes(key)) {
      next[key] = Number(value)
      return
    }
    if (key === 'match_sender' || key === 'match_receiver') {
      next[key] = value === 'true' || value === 'Yes'
      return
    }
    next[key] = value
  })

  if (template.threshold_config.metric) {
    next.metric = template.threshold_config.metric
  }
  return next
}

function configAsForm(config: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : String(value ?? '')]),
  )
}

export const AlertRulesPanel: React.FC = () => {
  const { token } = useAuth()
  const { showToast } = useToast()
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(RULE_TEMPLATES[0].id)
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<Severity>('HIGH')
  const [isActive, setIsActive] = useState(true)
  const [configForm, setConfigForm] = useState<Record<string, string>>({})

  const authHeaders: Record<string, string> = {}
  if (token) authHeaders.Authorization = `Token ${token}`

  const selectedTemplate = RULE_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? RULE_TEMPLATES[0]
  const activeRules = rules.filter((rule) => rule.is_active).length
  const highImpactRules = rules.filter((rule) => rule.severity === 'HIGH' || rule.severity === 'CRITICAL').length
  const ruleTypesCovered = new Set(rules.map((rule) => rule.rule_type)).size

  const loadRules = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/alert-rules/`, { headers: authHeaders })
      if (!response.ok) throw new Error('Failed to load alert rules')
      const payload = await response.json()
      setRules(rowsOf<AlertRule>(payload))
    } catch (error) {
      console.error(error)
      showToast('Unable to load alert rules.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRules()
  }, [])

  const filteredRules = useMemo(() => {
    const term = activeSearchTerm.toLowerCase()
    if (!term) return rules
    return rules.filter((rule) =>
      `${rule.name} ${rule.description} ${rule.rule_type} ${rule.severity}`.toLowerCase().includes(term),
    )
  }, [rules, activeSearchTerm])
  const visibleRules = filteredRules.slice(0, PAGE_SIZE)

  const openCreateModal = () => {
    const template = RULE_TEMPLATES.find((item) => item.id === selectedTemplateId) ?? RULE_TEMPLATES[0]
    setEditingRule(null)
    setName(template.label)
    setDescription(template.description)
    setSeverity(template.severity)
    setIsActive(true)
    setConfigForm(configAsForm(template.threshold_config))
    setIsModalOpen(true)
  }

  const openEditModal = (rule: AlertRule) => {
    const template = RULE_TEMPLATES.find((item) => item.rule_type === rule.rule_type && item.threshold_config.metric === rule.threshold_config?.metric)
      ?? RULE_TEMPLATES.find((item) => item.rule_type === rule.rule_type)
      ?? RULE_TEMPLATES[0]
    setSelectedTemplateId(template.id)
    setEditingRule(rule)
    setName(rule.name)
    setDescription(rule.description)
    setSeverity(rule.severity)
    setIsActive(rule.is_active)
    setConfigForm(configAsForm({ ...template.threshold_config, ...(rule.threshold_config ?? {}) }))
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingRule(null)
  }

  const saveRule = async () => {
    const payload = {
      name: name.trim(),
      description: description.trim(),
      rule_type: selectedTemplate.rule_type,
      severity,
      is_active: isActive,
      threshold_config: normalizeConfigForApi(configForm, selectedTemplate),
    }
    if (!payload.name) return

    try {
      const response = await fetch(`${API_BASE_URL}/alert-rules/${editingRule ? `${editingRule.id}/` : ''}`, {
        method: editingRule ? 'PATCH' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('Failed to save alert rule')
      await loadRules()
      closeModal()
      showToast(`${payload.name} saved.`)
    } catch (error) {
      console.error(error)
      showToast('Unable to save alert rule.')
    }
  }

  const toggleRule = async (rule: AlertRule) => {
    try {
      const response = await fetch(`${API_BASE_URL}/alert-rules/${rule.id}/toggle_active/`, {
        method: 'POST',
        headers: authHeaders,
      })
      if (!response.ok) throw new Error('Failed to toggle alert rule')
      await loadRules()
    } catch (error) {
      console.error(error)
      showToast('Unable to update rule status.')
    }
  }

  const deleteRule = async (rule: AlertRule) => {
    try {
      const response = await fetch(`${API_BASE_URL}/alert-rules/${rule.id}/`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      if (!response.ok) throw new Error('Failed to delete alert rule')
      await loadRules()
      showToast(`${rule.name} deleted.`)
    } catch (error) {
      console.error(error)
      showToast('Unable to delete alert rule.')
    }
  }

  const visibleConfigEntries = Object.entries(configForm).filter(([key]) => key !== 'metric')

  return (
    <>
      <header className="customers-header">
        <div>
          <h1 className="customers-title">Alert Rules</h1>
          <p className="customers-subtitle">Create the parameters, rules, and thresholds that decide when transactions become alerts.</p>
        </div>
        <div className="customers-header-actions">
          <button type="button" className="btn-primary-action btn-with-icon" onClick={openCreateModal}>
            <HiOutlinePlus size={16} aria-hidden />
            <span>Add Rule</span>
          </button>
        </div>
      </header>

    <section className="customers-container alert-rules-page">
      <div className="alert-rules-overview">
        <div className="alert-rules-stat">
          <span className="alert-rules-stat-label">Active Rules</span>
          <strong>{activeRules}</strong>
        </div>
        <div className="alert-rules-stat">
          <span className="alert-rules-stat-label">High Impact</span>
          <strong>{highImpactRules}</strong>
        </div>
        <div className="alert-rules-stat">
          <span className="alert-rules-stat-label">Rule Types</span>
          <strong>{ruleTypesCovered}</strong>
        </div>
      </div>

      <div className="customers-filters-card report-filters alert-rules-toolbar">
        <div className="report-filters-left">
          <form onSubmit={(e) => { e.preventDefault(); setActiveSearchTerm(searchTerm.trim()) }} className="filter-group filter-group-search">
            <div className="search-input-wrapper">
              <span className="search-icon" aria-hidden><HiOutlineSearch size={18} /></span>
              <input
                type="text"
                className="filter-input search-input"
                placeholder="Search alert rules..."
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
          <div className="filter-group alert-rules-selected-type">
            <span className="filter-label">New Rule:</span>
            <span className="modal-value">{selectedTemplate.label}</span>
          </div>
        </div>
      </div>

      <div className="customers-table-card-outer alert-rules-table-card">
        <div className="report-content-container ecl-table-container">
          <table className="ecl-table">
            <thead>
              <tr>
                <th>RULE</th>
                <th>TYPE</th>
                <th>SEVERITY</th>
                <th>STATUS</th>
                <th>PARAMETERS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 7 }).map((_, idx) => (
                  <tr key={`rule-loading-${idx}`}>{Array.from({ length: 6 }).map((__, cell) => <td key={cell}>Loading...</td>)}</tr>
                ))
              ) : visibleRules.map((rule) => (
                <tr key={rule.id}>
                  <td>
                    <span className="customer-id">{rule.name}</span>
                    <div className="muted">{rule.description}</div>
                  </td>
                  <td>{rule.rule_type}</td>
                  <td><span className={`pill pill-${rule.severity.toLowerCase()}`}>{rule.severity}</span></td>
                  <td>
                    <span className={`pill ${rule.is_active ? 'pill-kyc-verified' : 'pill-kyc-pending'}`}>
                      {rule.is_active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </td>
                  <td className="muted">{summarizeConfig(rule.threshold_config)}</td>
                  <td>
                    <div className="customers-actions">
                      {rule.is_active ? (
                        <HiOutlinePause size={18} className="action-icon action-icon-view" onClick={() => void toggleRule(rule)} title="Pause rule" />
                      ) : (
                        <HiOutlinePlay size={18} className="action-icon action-icon-view" onClick={() => void toggleRule(rule)} title="Activate rule" />
                      )}
                      <HiOutlinePencil size={18} className="action-icon action-icon-edit" onClick={() => openEditModal(rule)} title="Edit rule" />
                      <HiOutlineTrash size={18} className="action-icon action-icon-delete" onClick={() => void deleteRule(rule)} title="Delete rule" />
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredRules.length === 0 && (
                <tr><td colSpan={6} className="muted">No alert rules configured.</td></tr>
              )}
              {!loading && Array.from({ length: Math.max(0, PAGE_SIZE - Math.max(visibleRules.length, filteredRules.length === 0 ? 1 : 0)) }).map((_, idx) => (
                <tr key={`empty-rule-${idx}`}>{Array.from({ length: 6 }).map((__, cell) => <td key={cell}>&nbsp;</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ecl-table-footer">
          <div className="table-footer-left">Showing {filteredRules.length} alert rule{filteredRules.length === 1 ? '' : 's'}.</div>
          <div className="table-footer-right">Active rules control alert detection.</div>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingRule ? 'Edit Alert Rule' : 'Add Alert Rule'}</h2>
              <button type="button" className="modal-close-btn" onClick={closeModal} aria-label="Close">
                <HiOutlineX size={18} />
              </button>
            </div>
            <div className="modal-form">
              <div className="modal-body">
                <div className="modal-two-column">
                  <div className="modal-field">
                    <label className="modal-label">Rule Type</label>
                    <select
                      className="modal-input"
                      value={selectedTemplateId}
                      disabled={Boolean(editingRule)}
                      onChange={(e) => {
                        const template = RULE_TEMPLATES.find((item) => item.id === e.target.value) ?? RULE_TEMPLATES[0]
                        setSelectedTemplateId(template.id)
                        setName(template.label)
                        setDescription(template.description)
                        setSeverity(template.severity)
                        setConfigForm(configAsForm(template.threshold_config))
                      }}
                    >
                      {RULE_TEMPLATES.map((template) => (
                        <option key={template.id} value={template.id}>{template.label}</option>
                      ))}
                    </select>
                    <div className="alert-rule-template-note">
                      <span>{selectedTemplate.description}</span>
                      <span className={`pill pill-${selectedTemplate.severity.toLowerCase()}`}>{selectedTemplate.severity}</span>
                    </div>
                  </div>
                  <div className="modal-field">
                    <label className="modal-label">Severity</label>
                    <select className="modal-input" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </div>
                </div>
                <div className="modal-field">
                  <label className="modal-label">Name</label>
                  <input className="modal-input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="modal-field">
                  <label className="modal-label">Description</label>
                  <textarea className="modal-input modal-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="modal-two-column">
                  {visibleConfigEntries.map(([key, value]) => (
                    <div className="modal-field" key={key}>
                      <label className="modal-label">{key.replaceAll('_', ' ')}</label>
                      <input
                        className="modal-input"
                        value={value}
                        onChange={(e) => setConfigForm((current) => ({ ...current, [key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <label className="modal-field">
                  <span className="modal-label">Active</span>
                  <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary-action" onClick={closeModal}>Cancel</button>
                <button type="button" className="btn-primary-action" onClick={saveRule} disabled={!name.trim()}>Save Rule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
    </>
  )
}
